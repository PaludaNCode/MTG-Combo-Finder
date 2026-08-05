'use strict';
// Reading Scryfall's bulk data, tested against fixtures because it cannot be tested against
// Scryfall: every Scryfall host answers 403 at CONNECT from the sandbox this repository is
// edited in, the docs page included. So the live shape is second-hand, and the code is
// written to survive being wrong about it. That is what most of this file pins.
const test = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');
const {
  isWanted, pickBulk, downloadUrl, splitObjects, inflateIfGzip, streamCards,
} = require('../tools/scryfall-bulk.js');

// ---- choosing the file -------------------------------------------------------

// The real entry that was pasted in by hand, kept verbatim as the shape of record. Note
// `jsonl_download_uri` and `compressed_size`, and the absence of `download_uri`, `size`,
// `content_type` and `content_encoding` — a guess at this object had all four of the
// missing ones and none of the two present.
const DEFAULT_CARDS = {
  object: 'bulk_data',
  id: 'e2ef41e3-5778-4bc2-af3f-78eca4dd9c23',
  type: 'default_cards',
  updated_at: '2026-08-05T09:09:39.141+00:00',
  uri: 'https://api.scryfall.com/bulk-data/e2ef41e3-5778-4bc2-af3f-78eca4dd9c23',
  name: 'Default Cards',
  description: 'A JSON file containing every card object on Scryfall in English…',
  jsonl_download_uri: 'https://data.scryfall.io/default-cards/default-cards-20260805090939.jsonl.gz',
  compressed_size: 77383519,
};
const ORACLE_CARDS = Object.assign({}, DEFAULT_CARDS, {
  type: 'oracle_cards',
  name: 'Oracle Cards',
  jsonl_download_uri: 'https://data.scryfall.io/oracle-cards/oracle-cards-20260805.jsonl.gz',
});

test('oracle cards is chosen over default cards, which is three times the bytes for the same wording', () => {
  assert.strictEqual(pickBulk({ data: [DEFAULT_CARDS, ORACLE_CARDS] }).type, 'oracle_cards');
  assert.strictEqual(pickBulk([ORACLE_CARDS, DEFAULT_CARDS]).type, 'oracle_cards');
});

// The point of not hard-coding the type string. A rename must not produce an empty sweep.
test('a renamed type is still found when it mentions oracle', () => {
  const renamed = Object.assign({}, ORACLE_CARDS, { type: 'oracle_cards_v2' });
  assert.strictEqual(pickBulk({ data: [DEFAULT_CARDS, renamed] }).type, 'oracle_cards_v2');
});

test('found nothing throws listing what was actually offered, because that list is the fix', () => {
  assert.throws(
    () => pickBulk({ data: [DEFAULT_CARDS, { type: 'rulings' }] }),
    (err) => /default_cards/.test(err.message) && /rulings/.test(err.message),
  );
  assert.throws(() => pickBulk({ data: [] }), /nothing/);
});

// ---- the download URL --------------------------------------------------------

test('either download field is read, the jsonl one first', () => {
  assert.match(downloadUrl(ORACLE_CARDS), /oracle-cards-20260805\.jsonl\.gz$/);
  assert.strictEqual(downloadUrl({ download_uri: 'https://x/y.json' }), 'https://x/y.json');
});

test('neither field throws listing the entry keys, not a generic message', () => {
  assert.throws(
    () => downloadUrl({ type: 'oracle_cards', uri: 'https://api/x', compressed_size: 1 }),
    (err) => /compressed_size/.test(err.message) && /uri/.test(err.message),
  );
});

// ---- splitting objects out of the stream -------------------------------------

const collect = (push, chunks) => chunks.flatMap((c) => push(c));

test('one object per line, split however the chunks fall', () => {
  const push = splitObjects();
  const got = collect(push, ['{"name":"A"}\n{"na', 'me":"B"}\n{"name":"C"}\n']);
  assert.deepStrictEqual(got.map((s) => JSON.parse(s).name), ['A', 'B', 'C']);
});

// A pretty-printed array reads identically, which is the reason for counting braces rather
// than splitting on newlines: the format has already changed once.
test('a pretty-printed JSON array reads the same as JSONL', () => {
  const push = splitObjects();
  const got = collect(push, ['[\n  {\n    "name": "A"\n  },\n  {\n    "name": "B"\n  }\n]\n']);
  assert.deepStrictEqual(got.map((s) => JSON.parse(s).name), ['A', 'B']);
});

// The bug this exists to prevent. Every mana symbol in oracle text is a brace, so a naive
// depth count walks off the end of the first card that costs {2}{G}.
test('braces inside oracle text do not end the object — every mana symbol is a brace', () => {
  const push = splitObjects();
  const line = '{"name":"Chatterfang","mana_cost":"{2}{G}","oracle_text":"Sacrifice {C}: {T} it."}\n';
  const got = collect(push, [line]);
  assert.strictEqual(got.length, 1);
  assert.strictEqual(JSON.parse(got[0]).mana_cost, '{2}{G}');
});

test('an escaped quote does not end the string, so the brace after it still counts', () => {
  const push = splitObjects();
  const got = collect(push, ['{"name":"A \\" {","x":1}\n{"name":"B"}\n']);
  assert.deepStrictEqual(got.map((s) => JSON.parse(s).name), ['A " {', 'B']);
});

test('a backslash before a quote is itself escapable — \\\\" closes the string', () => {
  const push = splitObjects();
  const got = collect(push, ['{"a":"ends with backslash \\\\","b":2}\n{"name":"next"}\n']);
  assert.strictEqual(JSON.parse(got[0]).b, 2);
  assert.strictEqual(JSON.parse(got[1]).name, 'next');
});

// Not a style point. The first version rescanned the buffer from 0 on every chunk, which is
// fine on a fixture and quadratic on a 30,000-card download.
test('the buffer does not keep what it has already emitted', () => {
  const push = splitObjects();
  let emitted = 0;
  for (let i = 0; i < 500; i++) emitted += push(`{"n":${i}}\n`).length;
  assert.strictEqual(emitted, 500);
  // A 501st object still parses, which it would not if indices had drifted as the buffer
  // was trimmed.
  assert.deepStrictEqual(JSON.parse(push('{"n":500}\n')[0]), { n: 500 });
});

// ---- gzip, decided on the bytes ----------------------------------------------

const iterate = async (chunks) => {
  const out = [];
  for await (const c of inflateIfGzip((async function* () { yield* chunks; })())) out.push(Buffer.from(c));
  return Buffer.concat(out).toString('utf8');
};

test('a gzipped stream is inflated', async () => {
  const gz = zlib.gzipSync(Buffer.from('{"name":"A"}\n'));
  assert.strictEqual(await iterate([gz]), '{"name":"A"}\n');
});

// The half that a `.gz` extension check would get wrong: fetch may have already inflated it,
// and inflating twice fails on an incorrect header check.
test('a plain stream is passed through rather than inflated twice', async () => {
  assert.strictEqual(await iterate([Buffer.from('{"name":"A"}\n')]), '{"name":"A"}\n');
});

test('gzip split across chunks still inflates', async () => {
  const gz = zlib.gzipSync(Buffer.from('{"name":"Lim-Dûl"}\n'));
  const half = Math.floor(gz.length / 2);
  assert.match(await iterate([gz.subarray(0, half), gz.subarray(half)]), /Lim-Dûl/);
});

test('an empty stream yields nothing rather than throwing', async () => {
  assert.strictEqual(await iterate([]), '');
});

// The bug the whole-path test below found. A socket may hand over one byte first, and the
// sniff used to need two in the very first chunk — so it called gzip "not gzip", passed the
// compressed bytes on as text, and the sweep ended with no cards, no error, and an exit 0.
test('the gzip magic is gathered across chunks, not read off the first one', async () => {
  const gz = zlib.gzipSync(Buffer.from('{"name":"A"}\n'));
  const oneByteAtATime = [...gz].map((b) => Uint8Array.of(b));
  assert.strictEqual(await iterate(oneByteAtATime), '{"name":"A"}\n');
});

test('a one-byte-first plain stream is still passed through, not mistaken for gzip', async () => {
  const text = Buffer.from('{"name":"A"}\n');
  assert.strictEqual(await iterate([...text].map((b) => Uint8Array.of(b))), '{"name":"A"}\n');
});

test('a stream shorter than the magic yields what it had', async () => {
  assert.strictEqual(await iterate([Uint8Array.of(0x7b)]), '{');
});

// ---- what counts as a card ---------------------------------------------------

test('tokens, emblems and art series are not cards', () => {
  assert.ok(isWanted({ name: 'Chatterfang', layout: 'normal', lang: 'en' }));
  assert.ok(isWanted({ name: 'Delver of Secrets', layout: 'transform', lang: 'en' }));
  assert.ok(!isWanted({ name: 'Squirrel', layout: 'token', lang: 'en' }));
  assert.ok(!isWanted({ name: 'Art', layout: 'art_series', lang: 'en' }));
  assert.ok(!isWanted({ name: 'X', layout: 'double_faced_token', lang: 'en' }));
});

test('a non-English printing is skipped, and a card with no lang is kept', () => {
  assert.ok(!isWanted({ name: 'Wald', layout: 'normal', lang: 'de' }));
  assert.ok(isWanted({ name: 'Forest', layout: 'normal' }));
});

test('anything without a name is not a card, whatever else it carries', () => {
  assert.ok(!isWanted({ layout: 'normal', lang: 'en' }));
  assert.ok(!isWanted(null));
});

// ---- the whole path, against an injected Scryfall ----------------------------

// Multi-byte characters split across a chunk boundary are the failure this proves is
// handled: get the streaming decode wrong and it corrupts exactly the names that need an
// accent and nothing else, which is invisible in a 30,000-card sweep.
test('the stream yields cards and the snapshot metadata, accents intact across chunks', async () => {
  const body = '{"name":"Lim-Dûl the Necromancer","layout":"normal","lang":"en"}\n'
    + '{"name":"Æther Vial","layout":"normal","lang":"en"}\n';
  const bytes = zlib.gzipSync(Buffer.from(body, 'utf8'));
  const fakeFetch = async (url) => {
    if (/bulk-data/.test(url)) {
      return { ok: true, json: async () => ({ data: [DEFAULT_CARDS, ORACLE_CARDS] }) };
    }
    return {
      ok: true,
      // One byte at a time, which is the worst case for both the gzip and the UTF-8 decode.
      body: (async function* () { for (const b of bytes) yield Uint8Array.of(b); })(),
    };
  };
  const got = [];
  for await (const item of streamCards({ fetch: fakeFetch })) got.push(item);
  assert.deepStrictEqual(got.map((g) => g.card.name), ['Lim-Dûl the Necromancer', 'Æther Vial']);
  assert.strictEqual(got[0].meta.type, 'oracle_cards');
  assert.strictEqual(got[0].meta.updatedAt, '2026-08-05T09:09:39.141+00:00');
});

test('a refused index or download throws with the status rather than yielding nothing', async () => {
  const failIndex = async () => ({ ok: false, status: 403 });
  await assert.rejects(async () => {
    for await (const x of streamCards({ fetch: failIndex })) void x;
  }, /403/);

  const failDownload = async (url) => (/bulk-data/.test(url)
    ? { ok: true, json: async () => ({ data: [ORACLE_CARDS] }) }
    : { ok: false, status: 500 });
  await assert.rejects(async () => {
    for await (const x of streamCards({ fetch: failDownload })) void x;
  }, /500/);
});
