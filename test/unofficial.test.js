'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { matchUnofficial, identityString, deckNameSet, nameKey, expand } = require('../combos.js');
const { COMBOS } = require('../unofficial.js');

// The one part of the page that is not Commander Spellbook's word. Everything here
// is about keeping that distinction honest: the rows have to carry their evidence,
// they have to disappear the moment Spellbook publishes them, and they must never
// leak into the counts and the bracket that speak for the published data.

const DATASET = {
  cardIdentity: {
    'Scurry Oak': 'G',
    Necrosynthesis: 'B',
    'Viscera Seer': 'B',
    'Sol Ring': '',
  },
};

const deck = (...names) => deckNameSet(names.map((card) => ({ card, quantity: 1 })));

// ---- the data file itself --------------------------------------------------

test('unofficial: every row carries the evidence the page prints', () => {
  assert.ok(COMBOS.length > 0, 'no rows to check');
  COMBOS.forEach((row) => {
    const at = row.cards.join(' + ');
    assert.ok(row.cards.length >= 2, at + ': a combo needs at least two cards');
    assert.ok(row.produces.length, at + ': no results');
    assert.ok(['verified', 'derived'].includes(row.confidence), at + ': bad confidence');
    assert.ok(row.from && /^\d+(-\d+)+$/.test(row.from.id), at + ': no published combo cited');
    assert.ok(row.why && row.why.length > 20, at + ': no reasoning given');
    // The swap has to be a swap: one card out, one in, against the cited combo.
    assert.ok(row.from.cards.includes(row.swap.out), at + ': the swapped-out card is not in it');
    assert.ok(row.cards.includes(row.swap.in), at + ': the swapped-in card is not in the result');
    assert.deepStrictEqual(
      row.from.cards.map((c) => (c === row.swap.out ? row.swap.in : c)).slice().sort(),
      row.cards.slice().sort(),
      at + ': the two card lists differ by more than the stated swap'
    );
  });
});

test('unofficial: no row is listed twice', () => {
  const keys = COMBOS.map((r) => r.cards.map(nameKey).sort().join('|'));
  assert.strictEqual(new Set(keys).size, keys.length);
});

// ---- matching --------------------------------------------------------------

const ROW = {
  cards: ['Scurry Oak', 'Necrosynthesis', 'Viscera Seer'],
  produces: ['Infinite scry 1'],
  confidence: 'derived',
  from: { id: '2082-2292-4186', cards: ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'] },
  swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
  why: 'Both halves of the swap are published separately; the pairing is not.',
};

test('match: a deck holding every card gets the row', () => {
  const out = matchUnofficial(DATASET, [ROW], deck('Scurry Oak', 'Necrosynthesis', 'Viscera Seer'), []);
  assert.strictEqual(out.length, 1);
  assert.deepStrictEqual(out[0].c, ROW.cards);
  assert.strictEqual(out[0].unofficial, ROW);
  // Worked out from the cards, not stored, so it cannot drift from the identity data.
  assert.strictEqual(out[0].i, 'BG');
});

test('match: one card short is not a match', () => {
  const out = matchUnofficial(DATASET, [ROW], deck('Scurry Oak', 'Necrosynthesis'), []);
  assert.deepStrictEqual(out, []);
});

// The whole point of the graduation rule. Spellbook is refreshed nightly, and the
// day one of these is published it arrives in `included` on its own authority —
// showing our copy beside it would be the same combo twice, one of them stale.
test('match: a row Spellbook has since published drops out', () => {
  const names = deck('Scurry Oak', 'Necrosynthesis', 'Viscera Seer');
  const published = [{ id: '9-9-9', c: ['Viscera Seer', 'Scurry Oak', 'Necrosynthesis'] }];
  assert.strictEqual(matchUnofficial(DATASET, [ROW], names, published).length, 0);
  // ...and order and case in the published copy make no difference to that.
  const messy = [{ id: '9-9-9', c: ['viscera seer', 'NECROSYNTHESIS', 'Scurry Oak'] }];
  assert.strictEqual(matchUnofficial(DATASET, [ROW], names, messy).length, 0);
  // A different combo that merely overlaps does not count as publishing it.
  const other = [{ id: '9-9-9', c: ['Scurry Oak', 'Necrosynthesis'] }];
  assert.strictEqual(matchUnofficial(DATASET, [ROW], names, other).length, 1);
});

test('match: missing or empty inputs are not an error', () => {
  const names = deck('Scurry Oak');
  assert.deepStrictEqual(matchUnofficial(DATASET, null, names, []), []);
  assert.deepStrictEqual(matchUnofficial(DATASET, [], names, []), []);
  assert.deepStrictEqual(matchUnofficial(DATASET, [ROW], null, []), []);
  assert.deepStrictEqual(matchUnofficial(DATASET, [{ cards: [] }], names, []), []);
  // No `included` argument at all — nothing has been published, so nothing drops.
  assert.strictEqual(matchUnofficial(DATASET, [ROW], deck(...ROW.cards)).length, 1);
});

test('match: expand carries the evidence through to the renderer', () => {
  const row = expand(matchUnofficial(DATASET, [ROW], deck(...ROW.cards), [])[0]);
  assert.strictEqual(row.unofficial.confidence, 'derived');
  assert.strictEqual(row.unofficial.from.id, '2082-2292-4186');
  assert.deepStrictEqual(row.uses.map((u) => u.card.name), ROW.cards);
  // An official row must not grow the field, or every combo would render as derived.
  assert.strictEqual(expand({ id: '1-2-3', c: ['Sol Ring'], p: [] }).unofficial, undefined);
});

test('identityString: colourless is C, and the order is WUBRG', () => {
  assert.strictEqual(identityString(null), 'C');
  assert.strictEqual(identityString(new Set()), 'C');
  assert.strictEqual(identityString(new Set(['G', 'W', 'B'])), 'WBG');
  assert.strictEqual(identityString(new Set(['R', 'U'])), 'UR');
});

// ---- the citations, checked against the data -------------------------------
//
// The rows carry the published combo each was derived from, by id, and that
// citation is the whole basis on which the panel asks to be believed. Nothing in
// this file can check an id against the real data — the tests do not have 28 MB
// of it — so tools/verify-unofficial.js does, against the live snapshot, on
// every daily refresh. What *is* checkable here is that the checker works: that
// a broken citation is caught rather than that today's data happens to be fine.

const { check } = require('../tools/verify-unofficial.js');

const PUBLISHED = {
  combos: [
    { id: '1-2-3', c: ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'] },
    { id: '4-5-6', c: ['Basalt Monolith', 'Rings of Brighthearth'] },
  ],
};
const row = (over) => Object.assign({
  cards: ['Scurry Oak', 'Necrosynthesis', 'Viscera Seer'],
  from: { id: '1-2-3', cards: ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'] },
  swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
}, over);

test('citations: a row citing a real combo with the right cards is fine', () => {
  const out = check(PUBLISHED, [row()]);
  assert.deepStrictEqual(out.problems, []);
  assert.deepStrictEqual(out.graduated, []);
});

test('citations: an id that does not resolve is caught', () => {
  const out = check(PUBLISHED, [row({ from: { id: '9-9-9', cards: ['Scurry Oak'] } })]);
  assert.strictEqual(out.problems.length, 1);
  assert.match(out.problems[0], /not in the published data/);
});

// The quieter half: a transposed digit can land on a combo that exists and is
// about something else entirely, and the page would print that as the evidence.
test('citations: an id resolving to different cards is caught', () => {
  const out = check(PUBLISHED, [row({
    from: { id: '4-5-6', cards: ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'] },
  })]);
  assert.strictEqual(out.problems.length, 1);
  assert.match(out.problems[0], /Basalt Monolith/);
});

// Not a failure — it is what a row is for. The page already drops it; this is
// how anyone finds out the file can lose an entry.
test('citations: a row Spellbook has published is reported as graduated', () => {
  const out = check(PUBLISHED, [row({ cards: ['Basalt Monolith', 'Rings of Brighthearth'] })]);
  assert.deepStrictEqual(out.problems, []);
  assert.deepStrictEqual(out.graduated, ['Basalt Monolith + Rings of Brighthearth']);
});

test('citations: no data and no rows are not an error', () => {
  assert.deepStrictEqual(check(null, null), { problems: [], graduated: [], counted: 0 });
});
