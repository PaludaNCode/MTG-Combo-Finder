'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const CardText = require('../tools/card-text.js');
const { parseArgs } = require('../tools/cache-card-text.js');

// The oracle-text cache. What it keeps, what it refuses to keep, and how old it admits to
// being.
//
// The rule this serves: research-log.js will not accept a pass without verbatim oracle
// text, because two cards were once reasoned about from memory and one of those readings
// survived review. A cache that is wrong, or that is stale without saying so, would put
// that failure back — a *wrong reading somebody trusts* is the most expensive mistake
// available here, and unlike a missing reading it produces no complaint.

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cardtext-')), 'card-text.json');

// Scryfall's shape, cut down to the fields normalize() reads. The extra keys are there on
// purpose: the point of normalizing is that they do not survive.
const SCRY = {
  name: 'Basalt Monolith',
  mana_cost: '{3}',
  color_identity: [],
  type_line: 'Artifact',
  oracle_text: "Basalt Monolith doesn't untap during your untap step.\n{T}: Add {C}{C}{C}.",
  legalities: { commander: 'legal', modern: 'not_legal' },
  prices: { usd: '3.14' },
  image_uris: { normal: 'https://example.test/big.jpg' },
  rulings_uri: 'https://example.test/rulings',
};

// ---- what a cached entry holds ---------------------------------------------

test('normalize keeps what the reader prints and nothing else', () => {
  const entry = CardText.normalize(SCRY);
  assert.deepStrictEqual(Object.keys(entry).sort(),
    ['commanderLegal', 'faces', 'fetched', 'identity', 'mana', 'name']);
  assert.strictEqual(entry.mana, '{3}');
  assert.strictEqual(entry.identity, '');
  assert.strictEqual(entry.commanderLegal, true);
  assert.match(entry.faces[0].oracle, /doesn't untap/);
});

// The reason the cache is allowed to live in the repository at all. A raw Scryfall card is
// kilobytes of prices, images and printings; the queue's worth of them would be a
// multi-megabyte blob nobody reviews, and "somebody reads the diff" is the whole argument.
test('normalize drops the bulk that would make the file unreviewable', () => {
  const json = JSON.stringify(CardText.normalize(SCRY));
  for (const gone of ['prices', 'image_uris', 'rulings_uri', 'not_legal']) {
    assert.doesNotMatch(json, new RegExp(gone), `${gone} should not be cached`);
  }
  assert.ok(json.length < 600, `an entry is ${json.length} bytes — too big to stay reviewable`);
});

// A split or modal card is two readings, and collapsing them loses the half a combo
// usually turns on. The Forge path already learned this; the cache must not unlearn it.
test('normalize keeps both faces of a two-faced card', () => {
  const entry = CardText.normalize({
    name: 'Fire // Ice',
    color_identity: ['R', 'U'],
    card_faces: [
      { type_line: 'Instant', oracle_text: 'Fire deals 2 damage.', mana_cost: '{1}{R}' },
      { type_line: 'Instant', oracle_text: 'Tap target permanent.', mana_cost: '{1}{U}' },
    ],
  });
  assert.strictEqual(entry.faces.length, 2);
  assert.strictEqual(entry.mana, '{1}{R} // {1}{U}');
  assert.strictEqual(entry.identity, 'RU');
});

test('normalize carries power/toughness and loyalty when a card has them', () => {
  const creature = CardText.normalize({ name: 'A', power: '2', toughness: '3', oracle_text: '', type_line: 'Creature' });
  assert.strictEqual(creature.faces[0].pt, '2/3');
  const walker = CardText.normalize({ name: 'B', loyalty: '4', oracle_text: '', type_line: 'Planeswalker' });
  assert.strictEqual(walker.faces[0].loyalty, '4');
});

test('normalize refuses a card with no name rather than caching a blank', () => {
  assert.strictEqual(CardText.normalize(null), null);
  assert.strictEqual(CardText.normalize({}), null);
});

// ---- how old it admits to being --------------------------------------------

const on = (iso) => Date.parse(iso + 'T00:00:00Z');

test('a reading from today says nothing — chrome on every card is chrome nobody reads', () => {
  assert.strictEqual(CardText.ageNote('2026-08-03', on('2026-08-03')), null);
});

test('a reading from this month says how many days ago', () => {
  assert.match(CardText.ageNote('2026-07-20', on('2026-08-03')), /read from Scryfall 14 days ago/);
});

test('an older reading switches to months, because 400 days is not a useful number', () => {
  assert.match(CardText.ageNote('2026-02-03', on('2026-08-03')), /6 months ago/);
});

// Shown, not refused. A year-old oracle text is right for all but a handful of cards, and
// refusing it would send somebody to Forge's wording instead — strictly worse.
test('past a year it says so and names the fix, rather than withholding the text', () => {
  const note = CardText.ageNote('2025-01-01', on('2026-08-03'));
  assert.match(note, /errata are worth ruling out/);
  assert.match(note, /Cache card text/);
});

// An entry with no date is the shape a hand-edited file would have. It must not read as
// fresh — that is the one direction of error that cannot be noticed.
test('a missing date is unknown, never fresh', () => {
  assert.strictEqual(CardText.ageInDays(undefined), null);
  assert.strictEqual(CardText.ageInDays('not a date'), null);
  assert.match(CardText.ageNote(undefined), /no date — treat as unknown/);
});

test('the date is a day, not a timestamp', () => {
  // A full ISO timestamp would make every re-fetch a diff even when the text is identical,
  // which buries the one line that did change.
  assert.match(CardText.normalize(SCRY).fetched, /^\d{4}-\d{2}-\d{2}$/);
});

// ---- reading and writing the file ------------------------------------------

test('a missing cache is the ordinary state and costs nothing', () => {
  const cache = CardText.read(path.join(os.tmpdir(), 'definitely-not-here-' + Date.now() + '.json'));
  assert.strictEqual(cache.count, 0);
  assert.strictEqual(cache.missing, true);
  assert.strictEqual(CardText.lookup(cache, 'Anything'), null);
});

test('junk in the file is a miss, not a crash', () => {
  const file = tmp();
  fs.writeFileSync(file, 'this is not json');
  assert.strictEqual(CardText.read(file).count, 0);
});

test('a card is found however the name was typed', () => {
  const file = tmp();
  CardText.write({ 'Basalt Monolith': CardText.normalize(SCRY) }, file);
  const cache = CardText.read(file);
  for (const spelling of ['Basalt Monolith', 'basalt monolith', '  BASALT   MONOLITH  ']) {
    assert.ok(CardText.lookup(cache, spelling), `${spelling} should find the card`);
  }
  assert.strictEqual(CardText.lookup(cache, 'Basalt Monolit'), null, 'but not a misspelling');
});

// The file's only job in the repository is to be read as a diff, so an entry has to land
// in a stable place — otherwise adding one card reshuffles the file and the diff is
// everything.
test('the file is written sorted, so a diff is the card that changed', () => {
  const file = tmp();
  CardText.write({
    Zealot: CardText.normalize({ name: 'Zealot', oracle_text: 'z', type_line: 'Creature' }),
    Aardvark: CardText.normalize({ name: 'Aardvark', oracle_text: 'a', type_line: 'Creature' }),
    Monolith: CardText.normalize({ name: 'Monolith', oracle_text: 'm', type_line: 'Artifact' }),
  }, file);
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepStrictEqual(Object.keys(written.cards), ['Aardvark', 'Monolith', 'Zealot']);
  assert.strictEqual(written.count, 3);
});

test('a round trip through the file changes nothing', () => {
  const file = tmp();
  const entry = CardText.normalize(SCRY);
  CardText.write({ [entry.name]: entry }, file);
  assert.deepStrictEqual(CardText.lookup(CardText.read(file), 'Basalt Monolith'), entry);
});

// ---- the writer's argument handling ----------------------------------------

test('names are trimmed and blanks dropped', () => {
  assert.deepStrictEqual(parseArgs(['  Sol Ring ', '', 'Mana Crypt']).names,
    ['Sol Ring', 'Mana Crypt']);
});

test('a name with a comma in it stays one card', () => {
  // The reason every card-list input here is semicolon-separated. Splitting on commas
  // turns one legendary creature into two cards that do not exist.
  assert.deepStrictEqual(parseArgs(['Camellia, the Seedmiser']).names, ['Camellia, the Seedmiser']);
});
