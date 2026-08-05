// Reading Scryfall's bulk data: which file to ask for, and how to get cards out of it
// without holding the whole thing in memory.
//
// Why bulk at all. `/cards/named?exact=` is one request per card, and the sweep this
// serves wants every card there is. Scryfall asks consumers not to iterate a card endpoint
// for bulk use, and at 120ms a request the full space took ~40 minutes against a workflow
// that times out at 15. `/bulk-data` is one request that names a download for every card.
//
// Why streaming. A `JSON.parse` of the download needs the whole payload as a string plus
// the whole parsed graph, and the payload grows every set. That makes the file's size an
// input to the design — the exact thing that made the per-card path unusable. Splitting
// top-level objects out of the byte stream costs a fixed amount of memory whatever
// arrives, so a bigger file is slower and never a redesign. It also means the choice of
// bulk file (oracle cards today, every printing if that is ever wanted) stops being
// bounded by heap.
//
// **This could not be checked against the live API.** Every Scryfall host is 403 at CONNECT
// from the sandbox this repository is usually edited in, docs included. What is here rests
// on one real `/bulk-data` entry pasted in by hand, and that paste corrected two things a
// reasonable guess got wrong — worth writing down, because both would have failed at the
// first live run and only at the first live run:
//
//   - **The download field is `jsonl_download_uri`, not `download_uri`.** The entry carries
//     `compressed_size` and no `size`/`content_type`/`content_encoding`, so the classic
//     array-of-objects download either is gone or is no longer the one advertised.
//   - **The payload is gzipped JSONL from `data.scryfall.io`** — `…jsonl.gz`, 77MB
//     compressed for `default_cards`. A `.gz` file is usually served as content rather than
//     as a transfer encoding, so `fetch` does not unwrap it and the bytes have to be
//     inflated here.
//
// So the shape is treated as something that moves. `downloadUrl()` takes either field and
// throws listing the entry's actual keys; `pickBulk()` prefers `oracle_cards`, falls back to
// anything mentioning "oracle", and throws listing every type offered; and the stream is
// gunzipped **on the gzip magic bytes rather than on the file extension**, so it is correct
// whether the payload arrives compressed, already inflated by `fetch`, or as plain text.
//
// `splitObjects()` reads JSONL and a pretty-printed array identically, because it tracks
// brace depth outside strings rather than assuming a separator. That was written before the
// format was known and is kept now that it is: the format has already changed once.
//
// `oracle_cards` rather than `default_cards`, deliberately. `default_cards` is one object
// per *printing* — ~100k entries repeating the same oracle text under the same name — and
// this cache is keyed by name and holds only wording. `oracle_cards` is one per distinct
// card, which is what "every card" means for a reader of oracle text, at roughly a third of
// the bytes.
'use strict';

const { Readable } = require('node:stream');
const zlib = require('node:zlib');

const BULK_INDEX = 'https://api.scryfall.com/bulk-data';

// Scryfall asks for a descriptive agent and an explicit Accept. Same values the
// single-card path sends; kept here rather than imported so this module can be read alone.
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'MTG-Combo-Finder/1.0 (github.com/PaludaNCode/MTG-Combo-Finder)',
};

// A card object, or something else Scryfall ships in the same file.
//
// The bulk files carry entries whose `layout` is not a playable card — tokens, emblems, art
// series, the double-faced token backs. They have oracle text, they would cache cleanly, and
// they would put thousands of entries into a file whose whole argument for living in the
// repository is that somebody reads its diff. So they are dropped, and the count of what was
// dropped is reported rather than absorbed: a layout list that goes stale should show up as
// a number that moved, not as a quietly larger cache.
const SKIP_LAYOUTS = new Set([
  'token', 'double_faced_token', 'emblem', 'art_series', 'vanguard', 'scheme', 'planar',
  'augment', 'host',
]);

// Non-English printings repeat oracle text we already have under a name nobody cites.
const isWanted = (card) => Boolean(card)
  && typeof card.name === 'string'
  && !SKIP_LAYOUTS.has(String(card.layout || ''))
  && (card.lang === undefined || card.lang === 'en');

// Which URL on a bulk entry to fetch. `jsonl_download_uri` is what a real entry carried;
// `download_uri` is what the older array-of-objects form used. Either is read, and neither
// being present throws **listing the entry's own keys**, because that error message is the
// entire fix for the next time this shape moves.
function downloadUrl(entry) {
  const url = entry && (entry.jsonl_download_uri || entry.download_uri);
  if (url) return String(url);
  const keys = Object.keys(entry || {}).join(', ') || '(none)';
  throw new Error(
    'The chosen bulk entry has neither jsonl_download_uri nor download_uri. Keys present: '
    + keys + '.',
  );
}

// Choose the download. Documented type first, then anything that says "oracle", then throw
// with the actual menu — see the header for why this is not a single string comparison.
function pickBulk(list) {
  const items = Array.isArray(list) ? list : (list && list.data) || [];
  const exact = items.find((b) => b && b.type === 'oracle_cards');
  if (exact) return exact;
  const loose = items.find((b) => b
    && /oracle/i.test(String(b.type || '') + ' ' + String(b.name || '')));
  if (loose) return loose;
  const offered = items.map((b) => (b && b.type) || '(no type)').join(', ') || '(nothing)';
  throw new Error(
    'Scryfall /bulk-data offered no oracle-cards file. Types present: ' + offered
    + '. If the type was renamed, that list is the fix.',
  );
}

// Pull complete top-level `{...}` objects out of a stream of text chunks.
//
// State is brace depth plus whether we are inside a string, because a card's oracle text
// contains braces constantly — every mana symbol is one, `{2}{G}`, and a naive depth count
// walks straight off the end on the first such card. Escapes are tracked for the same
// reason: `\"` inside a string must not close it.
//
// Returns a `push(chunk) -> string[]` function. The buffer keeps only the bytes of an
// object still being assembled, so memory is the size of the largest single card and not of
// the file. Scanning resumes where it stopped rather than restarting at 0, so a big file is
// linear rather than quadratic — the version that rescanned was fine on a fixture and would
// have been unusable on the real download.
function splitObjects() {
  let buf = '';
  let scan = 0;
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  return function push(chunk) {
    const out = [];
    buf += chunk;
    for (; scan < buf.length; scan++) {
      const c = buf[scan];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') { inString = true; continue; }
      if (c === '{') { if (depth === 0) start = scan; depth += 1; continue; }
      if (c === '}') {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          out.push(buf.slice(start, scan + 1));
          // Drop everything consumed. Without this the buffer is the whole download and
          // the streaming is decoration.
          buf = buf.slice(scan + 1);
          scan = -1;
          start = -1;
        }
      }
    }
    return out;
  };
}

// Inflate the stream if it is gzip, pass it through if it is not.
//
// **Decided on the magic bytes, never on the file extension or the headers.** A `.jsonl.gz`
// served as content arrives compressed and has to be inflated here; the same URL served
// with `Content-Encoding: gzip` has already been inflated by `fetch`, and inflating twice
// fails with an unhelpful error about an incorrect header check. Sniffing is right in both
// cases and stays right if Scryfall changes which one it does.
// **The two magic bytes are gathered across chunks, not read off the first one.** The first
// version tested `first.length > 1`, which is true of every chunk a fixture produces and not
// guaranteed of any chunk a socket produces: a one-byte first read made the check decide
// "not gzip", the compressed bytes went to the splitter as text, and it found no `{` in
// them — so the sweep yielded nothing, threw nothing, and would have reported an empty
// download as a successful run. Its own test caught it, which is the only reason it is
// written down here rather than shipped.
async function* inflateIfGzip(chunks) {
  const it = chunks[Symbol.asyncIterator]();
  const head = [];
  let held = 0;
  while (held < 2) {
    const next = await it.next();
    if (next.done) { yield* head; return; } // shorter than two bytes: nothing to inflate
    head.push(next.value);
    held += next.value.length;
  }
  const prefix = Buffer.concat(head.map((c) => Buffer.from(c)));
  const rest = (async function* () { yield prefix; for await (const c of it) yield c; })();
  if (prefix[0] !== 0x1f || prefix[1] !== 0x8b) { yield* rest; return; }
  yield* Readable.from(rest).pipe(zlib.createGunzip());
}

// Fetch the bulk index, then stream the download it names, yielding parsed card objects.
//
// `deps.fetch` is injected so the whole path is testable without a network — which is not a
// convenience here, it is the only way this code could be tested at all from a sandbox that
// cannot reach any Scryfall host.
//
// Yields `{ card, meta }` on the first item's `meta` so a caller can record which snapshot
// it read: the entry's `updated_at` is the honest provenance for a sweep, since a run today
// against a file Scryfall built three days ago confirms wording as of three days ago.
async function* streamCards(deps = {}) {
  const get = deps.fetch || fetch;
  const indexRes = await get(deps.indexUrl || BULK_INDEX, { headers: HEADERS });
  if (!indexRes.ok) throw new Error(`Scryfall /bulk-data answered ${indexRes.status}`);
  const chosen = pickBulk(await indexRes.json());
  const url = downloadUrl(chosen);

  const res = await get(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`The bulk download answered ${res.status}`);

  const meta = { type: chosen.type, updatedAt: chosen.updated_at, url };
  const push = splitObjects();
  const decoder = new TextDecoder();
  // A chunk can split a multi-byte character, so decoding is streamed too. Getting this
  // wrong corrupts exactly the card names that need an accent — Lim-Dûl, Æther — and
  // nothing else, which is a bug that would hide in a 30,000-card sweep.
  for await (const chunk of inflateIfGzip(res.body)) {
    for (const text of push(decoder.decode(chunk, { stream: true }))) {
      yield { card: JSON.parse(text), meta };
    }
  }
  for (const text of push(decoder.decode())) yield { card: JSON.parse(text), meta };
}

module.exports = {
  BULK_INDEX, HEADERS, SKIP_LAYOUTS,
  isWanted, pickBulk, downloadUrl, splitObjects, inflateIfGzip, streamCards,
};
