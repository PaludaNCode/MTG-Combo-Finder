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
// **Every entry carries the date it was fetched**, and the reader says how old it is.
// Oracle text is errata'd rarely, which is exactly what makes a silently stale copy
// dangerous: it is a *wrong reading somebody trusts*, which is the single most expensive
// mistake available in this repository. An old entry is still shown — it is almost
// certainly right — but never without saying when it was read.
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

// How the age is said. Returns null when there is nothing worth saying — a reading from
// today needs no note, and a line of chrome on every card is a line nobody reads.
function ageNote(fetched, now) {
  const days = ageInDays(fetched, now);
  if (days === null) return 'read from Scryfall, but the cache records no date — treat as unknown';
  if (days <= 1) return null;
  const said = days < 60 ? `${days} days ago` : `${Math.floor(days / 30)} months ago`;
  if (days > STALE_AFTER_DAYS) {
    return `read from Scryfall ${said} — old enough that errata are worth ruling out if the `
      + 'reasoning turns on the exact words. Re-fetch with the "Cache card text" workflow.';
  }
  return `read from Scryfall ${said}`;
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
const key = (name) => String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();

function read(file) {
  try {
    const doc = JSON.parse(fs.readFileSync(file || CACHE_FILE, 'utf8'));
    const cards = doc && doc.cards ? doc.cards : {};
    // Indexed on the way in rather than searched per lookup. The file is written by name
    // so it stays readable as a diff; the index is this function's business.
    const byKey = new Map();
    for (const [name, entry] of Object.entries(cards)) byKey.set(key(name), entry);
    return { cards, byKey, count: byKey.size };
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
  CACHE_FILE, STALE_AFTER_DAYS, normalize, ageInDays, ageNote, read, write, lookup, key, today,
};
