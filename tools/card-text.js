// The oracle-text cache: what is in it, and how old that makes a reading.
//
// Why this exists. `research-log.js` will not accept a pass without verbatim oracle text
// for every card in it, and that rule is right — it was added because two cards were
// reasoned about from memory and one of those readings survived review. But the sandbox
// this repository is usually edited from cannot reach Scryfall at all: `api.scryfall.com`
// 403s at CONNECT, so every card comes through Forge under a banner, and
// "cross-check against XMage" becomes a manual step per card.
//
// So the binding constraint on the research queue is not finding candidates —
// `tools/substitution-scope.js` prints thousands on demand — it is that reading each one
// is expensive. A runner can reach Scryfall. This is where what it read gets kept.
//
// **Normalised, not raw.** A Scryfall card object is 3-5 KB of prices, images, printings
// and rulings; what this tool prints is about 300 bytes of it. Storing the raw object
// would make the queue's worth of cards a multi-megabyte blob nobody can review, and the
// entire argument for keeping the cache in the repository rather than on the data branch
// is that a card's oracle text arrives as a diff somebody reads. So only the fields the
// reader prints are kept, and a shape change means a re-fetch rather than a migration.
//
// **Every entry carries the date its wording last changed**, and the reader says how old
// that makes it. Oracle text is errata'd rarely, which is exactly what makes a silently
// stale copy dangerous: it is a *wrong reading somebody trusts*, which is the single most
// expensive mistake available in this repository. An old entry is still shown — it is
// almost certainly right — but never without saying how old.
//
// **`fetched` is when the text last MOVED, not when it was last looked at**, and the
// difference is what lets a sweep run more than once. The file-level `generated` answers
// "when was every entry last confirmed against Scryfall"; the per-entry date answers "when
// did this wording last change". Conflating them — which this file did until the cache
// went from a few hundred cards to all of them — means a second full sweep rewrites every
// date and lands as a diff in which every line changed, destroying the one property the
// normalisation above exists to protect. With them split, a sweep diffs to the header plus
// exactly the cards whose wording moved.
//
// That is a feature and not a side effect. If Scryfall errata's a card that a row in
// `unofficial.js` or a rule-out in `research-log.js` was reasoned from, nothing used to
// notice. Now the sweep's diff is the notice. See `merge()`.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CACHE_FILE = path.join(__dirname, '..', 'card-text.json');

// Past this, the reader says so out loud rather than in passing. Not a refusal: a year-old
// oracle text is right for all but a handful of cards, and refusing to show it would send
// somebody to Forge's wording instead, which is strictly worse. It is a prompt to re-fetch
// the card if the reasoning turns on the exact words.
const STALE_AFTER_DAYS = 365;

// A day, not a timestamp. The precision that matters is "which errata window", and a full
// ISO timestamp in a checked-in file makes every re-fetch a diff even when the text is
// identical — which would bury the one line that did change.
const today = (now) => new Date(now || Date.now()).toISOString().slice(0, 10);

function ageInDays(fetched, now) {
  const then = Date.parse(String(fetched) + 'T00:00:00Z');
  if (!Number.isFinite(then)) return null; // no date recorded: treated as unknown, not fresh
  return Math.floor((Number(now || Date.now()) - then) / 86400000);
}

const said = (days) => (days < 60 ? `${days} days ago` : `${Math.floor(days / 30)} months ago`);

// How the age is said. Returns null when there is nothing worth saying — a reading from
// today needs no note, and a line of chrome on every card is a line nobody reads.
//
// **The staleness warning moved to confirmedNote() and this is why.** The date on an entry
// now says when the wording last *changed*, so a long age here is reassurance rather than
// risk: a text that has not moved in three years is the most trustworthy kind there is.
// What carries risk is how long since anything was *checked*, which is one date for the
// whole file. Leaving the warning here would have put it on exactly the wrong cards —
// loudest on the most stable ones — while a cache nobody had swept in two years said
// nothing at all.
function ageNote(fetched, now) {
  const days = ageInDays(fetched, now);
  if (days === null) return 'read from Scryfall, but the cache records no date — treat as unknown';
  if (days <= 1) return null;
  return `wording unchanged since ${fetched}, ${said(days)}`;
}

// The staleness question, asked once of the whole cache: when did a sweep last confirm any
// of this against Scryfall? Not a refusal — a year-old reading is right for all but a
// handful of cards, and refusing to show it would send somebody to Forge's wording, which
// is strictly worse. It is a prompt to re-sweep when the reasoning turns on exact words.
function confirmedNote(generated, now) {
  const days = ageInDays(generated, now);
  if (days === null) return 'the cache records no sweep date — treat every reading as unknown';
  if (days <= 1) return null;
  if (days > STALE_AFTER_DAYS) {
    return `last confirmed against Scryfall ${said(days)} — old enough that errata are worth `
      + 'ruling out if the reasoning turns on the exact words. Re-sweep with the "Cache card '
      + 'text" workflow.';
  }
  return `last confirmed against Scryfall ${said(days)}`;
}

// Everything the reader prints, and nothing else. `faces` rather than a single body
// because a split or modal card is two readings and collapsing them loses the half a
// combo usually turns on — the Forge path already learned that.
function normalize(card, when) {
  if (!card || !card.name) return null;
  const faceList = Array.isArray(card.card_faces) && card.card_faces.length
    ? card.card_faces
    : [card];
  return {
    fetched: today(when),
    name: String(card.name),
    // Scryfall's stable identity for a card, which its *name* is not. Kept because a rename
    // is otherwise invisible in the worst possible way: the entry stops matching, the sweep
    // files the new name as an addition and reports the old one as absent, and every row in
    // `unofficial.js` or rule-out in `research-log.js` that cited the old spelling goes on
    // citing a card this cache no longer answers for. With the id, `merge()` recognises the
    // pair as one card and says so. Absent on entries written before this field existed,
    // which `merge()` tolerates — see `sameReading()`.
    oracleId: String(card.oracle_id || ''),
    // The whole-card cost where there is one; otherwise each face's, joined the way the
    // reader already joins them.
    mana: String(card.mana_cost || faceList.map((f) => f.mana_cost).filter(Boolean).join(' // ') || ''),
    identity: (card.color_identity || []).join(''),
    commanderLegal: Boolean(card.legalities && card.legalities.commander === 'legal'),
    faces: faceList.map((f) => {
      const face = {
        types: String(f.type_line || ''),
        oracle: String(f.oracle_text || '').trim(),
      };
      if (f.power || f.toughness) face.pt = `${f.power}/${f.toughness}`;
      if (f.loyalty) face.loyalty = String(f.loyalty);
      return face;
    }),
  };
}

// Names are matched the way a person types them, so a pass can quote a card without
// worrying about the apostrophe. Not the same job as parser.js's nameKey(), which has a
// deck's spellings to survive; this only has to find a card in a file we wrote.
//
// The apostrophe family folds to the plain one, the same set combos.js uses and for the
// same reason — Scryfall spells names with an ASCII quote but a curly one arrives
// constantly, since it is what Scryfall's own oracle *text* uses and what any word
// processor substitutes. Keyed literally the two are different cards. This file did not
// fold them until the sweep made it matter: a research pass quoting "Ashnod’s Altar"
// missed the cached entry and re-fetched it under a second name, so the cache grew a
// duplicate and neither copy was wrong — which is the invisible kind of wrong.
const APOSTROPHES = /[‘’‚‛ʼ´`]/g;
const key = (name) => String(name || '')
  .replace(APOSTROPHES, "'").toLowerCase().replace(/\s+/g, ' ').trim();

// Everything about a reading except when we last looked at it. This is the comparison that
// makes a sweep idempotent: identical reading, keep the existing entry untouched, so the
// diff shows only what moved. JSON.stringify over a normalize()d object is a safe
// comparison because normalize() builds its keys in a fixed order.
// The name is compared by `key()` rather than literally, and that is not a shortcut. Two
// readings only reach this function when their keys already matched, so a difference in the
// name here is always a difference in *spelling* — a cache entry filed under a curly
// apostrophe against Scryfall's ASCII one. Comparing literally made that count as changed
// wording, which moved the date and put the card in the errata report, for a card whose text
// nobody had touched. A real rename cannot arrive this way: it would not match the key, so
// it lands as an add plus an `absent`, which is exactly the pair a person should look at.
// **Is the WORDING the same** — and nothing else is this function's business. `fetched`,
// `name` and `oracleId` are all stripped, because deciding *which card this is* belongs to
// `merge()`, which has already matched the pair by identity or by name before asking.
//
// Both exclusions were bugs first. Comparing `name` literally made normalising a curly
// apostrophe count as changed oracle text, moving the date and putting an untouched card in
// the errata report. Comparing it by key then made a **rename** with identical wording count
// as errata for the same reason, which is the one case the identity matching exists to get
// right. And stripping `oracleId` is the difference between the sweep that first populated it
// costing one line per card and costing a rewritten date on all 34,422 — the whole-file diff
// the split exists to prevent, while reporting the entire cache as changed text in the same
// move.
function sameReading(a, b) {
  if (!a || !b) return false;
  const strip = (e) => {
    const { fetched, name, oracleId, ...rest } = e;
    return JSON.stringify(rest);
  };
  return strip(a) === strip(b);
}

// Fold freshly-read cards into what is already cached.
//
// Four rules, each one a thing that would otherwise be silent:
//
// 1. An unchanged reading keeps its existing `fetched` date. That is what stops a sweep
//    rewriting every line (see the header).
// 2. A changed reading is reported by name, not just counted. A count of "4 changed" in a
//    log is not something anybody acts on; four card names are, because each one may sit
//    under a published row's reasoning.
// 3. **Nothing is ever removed.** A card absent from this sweep is reported as `absent`
//    and kept, because deleting it would quietly withdraw the support for whatever cited
//    it.
// 4. **A card is found by `oracleId` first and by name second.** A rename then lands as a
//    rename — reported in `renamed`, the entry moved, its date kept if the wording did not
//    move — instead of as an addition plus an `absent` that a reader has to pair up by eye.
//    Name-matching alone made those two the same shape as a genuinely retired card and a
//    genuinely new one, which is the wrong question to leave a person holding.
function merge(existing, incoming, when) {
  const cards = Object.assign({}, existing || {});
  const byKey = new Map();
  const byOracle = new Map();
  // key -> the name it is filed under, so a cached entry can be found and, if its spelling
  // differs from Scryfall's, moved rather than duplicated. `byOracle` is the same for
  // identity, and is only populated for entries that carry one — everything written before
  // `oracleId` existed falls through to the name index, which is why both are kept.
  for (const [name, entry] of Object.entries(cards)) {
    byKey.set(key(name), name);
    if (entry && entry.oracleId) byOracle.set(entry.oracleId, name);
  }

  const added = [];
  const changed = [];
  const renamed = [];
  const touched = new Set();
  let unchanged = 0;

  const file = (name, entry, fetched) => {
    cards[name] = Object.assign({}, entry, { fetched });
    byKey.set(key(name), name);
    touched.add(key(name));
    if (entry.oracleId) byOracle.set(entry.oracleId, name);
  };

  for (const entry of incoming || []) {
    if (!entry || !entry.name) continue;
    // Identity first. Only fall back to the name when the incoming card carries no id or
    // nothing cached under it — so a rename is caught, and a pre-`oracleId` cache still works.
    let priorName = entry.oracleId ? byOracle.get(entry.oracleId) : undefined;
    if (priorName === undefined) priorName = byKey.get(key(entry.name));
    const prior = priorName === undefined ? null : cards[priorName];
    if (!prior) {
      file(entry.name, entry, today(when));
      added.push(entry.name);
      continue;
    }
    // Scryfall's spelling wins, so a cache entry filed under a curly apostrophe, odd casing
    // or a retired name is corrected rather than left beside the canonical one.
    if (priorName !== entry.name) {
      delete cards[priorName];
      byKey.delete(key(priorName));
      // A different *key*, not just a different spelling of the same one, is a real rename
      // and the pair is what a reader needs: the old name is what the citations say.
      if (key(priorName) !== key(entry.name)) renamed.push({ from: priorName, to: entry.name });
    }
    if (sameReading(prior, entry)) {
      file(entry.name, entry, prior.fetched);
      unchanged += 1;
      continue;
    }
    file(entry.name, entry, today(when));
    changed.push(entry.name);
  }

  // What the sweep actually filed, collected as it went rather than reconstructed after.
  // Reconstructing it from the incoming names was wrong once already: a renamed card's old
  // entry has been deleted by then, so recomputing from names alone reported the *new* name
  // as absent or the old one as still present depending on the order things were compared.
  const absent = Object.keys(cards).filter((n) => !touched.has(key(n)));
  return { cards, added, changed, renamed, unchanged, absent };
}

function read(file) {
  try {
    const doc = JSON.parse(fs.readFileSync(file || CACHE_FILE, 'utf8'));
    const cards = doc && doc.cards ? doc.cards : {};
    // Indexed on the way in rather than searched per lookup. The file is written by name
    // so it stays readable as a diff; the index is this function's business.
    const byKey = new Map();
    for (const [name, entry] of Object.entries(cards)) byKey.set(key(name), entry);
    // `generated` comes back so a caller can ask confirmedNote() when the whole cache was
    // last checked — the question the per-entry dates deliberately no longer answer.
    return { cards, byKey, count: byKey.size, generated: doc && doc.generated };
  } catch (err) {
    // A missing cache is the ordinary state — it is populated by a workflow, and an
    // absent one must cost nothing but a slower lookup.
    return { cards: {}, byKey: new Map(), count: 0, missing: true };
  }
}

const lookup = (cache, name) => cache.byKey.get(key(name)) || null;

// Written sorted, because the file's only job in the repository is to be read as a diff:
// an entry landing in a stable place means the diff is the card that changed.
function write(cards, file, when) {
  const sorted = {};
  for (const name of Object.keys(cards).sort((a, b) => a.localeCompare(b))) sorted[name] = cards[name];
  const doc = { generated: today(when), count: Object.keys(sorted).length, cards: sorted };
  fs.writeFileSync(file || CACHE_FILE, JSON.stringify(doc, null, 1) + '\n');
  return doc;
}

module.exports = {
  CACHE_FILE, STALE_AFTER_DAYS, normalize, ageInDays, ageNote, confirmedNote,
  read, write, lookup, key, today, sameReading, merge,
};
