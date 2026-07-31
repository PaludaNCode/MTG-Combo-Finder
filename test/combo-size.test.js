'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  comboSize, sizeBreakdown, expand, matchDeck, deckNameSet, computeSuggestions, groupSuggestions,
} = require('../combos.js');

// A count of combos says nothing about how hard they are to assemble: "+6
// combos" reads the same whether it is six two-card combos or five four-card
// ones and a two. Size is how many cards have to be on the table.

const variant = (names, fills) => ({
  uses: names.map((name) => ({ card: { name } })),
  fills,
});

test('comboSize: the cards a combo names', () => {
  assert.equal(comboSize(variant(['Basalt Monolith', 'Rings of Brighthearth'])), 2);
  assert.equal(comboSize(variant(['A', 'B', 'C', 'D'])), 4);
});

// A slot is a card the combo needs; the deck merely happens to supply it.
// Counting only named cards would call "Rings of Brighthearth + a Persist
// Creature" a one-card combo.
test('comboSize: a filled slot counts as a card', () => {
  const withSlot = variant(['Rings of Brighthearth'], [{ id: 7, slot: 'Persist Creature', card: 'Kitchen Finks' }]);
  assert.equal(comboSize(withSlot), 2);
});

test('comboSize: junk is zero rather than a crash', () => {
  assert.equal(comboSize(null), 0);
  assert.equal(comboSize({}), 0);
});

test('sizeBreakdown: smallest first', () => {
  const out = sizeBreakdown([
    variant(['A', 'B', 'C']),
    variant(['A', 'B']),
    variant(['A', 'B', 'C', 'D']),
    variant(['A', 'B', 'C']),
  ]);
  assert.deepStrictEqual(out, [
    { size: 2, count: 1 },
    { size: 3, count: 2 },
    { size: 4, count: 1 },
  ]);
});

// The reason to show this per card rather than per panel: the parts add up to
// the number already on the badge, so there is no second denominator to explain.
test('sizeBreakdown: the counts sum to the combos given', () => {
  const variants = [
    variant(['A', 'B']), variant(['A', 'B', 'C']), variant(['A', 'B', 'C']),
    variant(['A', 'B', 'C', 'D']), variant(['A', 'B', 'C', 'D']),
  ];
  const out = sizeBreakdown(variants);
  assert.equal(out.reduce((n, row) => n + row.count, 0), variants.length);
});

test('sizeBreakdown: nothing in, nothing out', () => {
  assert.deepStrictEqual(sizeBreakdown([]), []);
  assert.deepStrictEqual(sizeBreakdown(null), []);
});

// End to end: the shape a suggestion row actually renders from. Pitiless
// Plunderer is the real case this exists for — six combos, five of them
// four-card, one of them a two-card line that the count alone hides.
const DATASET = {
  cardIdentity: {
    'Scurry Oak': 'G', 'Sadistic Glee': 'B', 'Carrion Feeder': 'B',
    'Ashnod\'s Altar': '', 'Blood Artist': 'B', 'Zulaport Cutthroat': 'B',
  },
  combos: [
    // Adding Ashnod's Altar completes one two-card combo...
    { id: 'easy', c: ['Scurry Oak', 'Ashnod\'s Altar'], p: ['Infinite tokens'], i: 'G', pop: 5 },
    // ...and two four-card ones.
    { id: 'hard-1', c: ['Scurry Oak', 'Sadistic Glee', 'Carrion Feeder', 'Ashnod\'s Altar'], p: ['Infinite damage'], i: 'BG', pop: 9 },
    { id: 'hard-2', c: ['Scurry Oak', 'Sadistic Glee', 'Blood Artist', 'Ashnod\'s Altar'], p: ['Infinite drain'], i: 'BG', pop: 8 },
  ],
};

test('a suggestion carries the sizes of the combos it unlocks', () => {
  const deck = ['Scurry Oak', 'Sadistic Glee', 'Carrion Feeder', 'Blood Artist'].map((card) => ({ card }));
  const names = deckNameSet(deck);
  const matched = matchDeck(DATASET, names, deck);
  const groups = groupSuggestions(
    computeSuggestions(matched.almostIncluded.map(expand), names), names
  );

  const altar = groups.find((g) => g.cards[0] === 'Ashnod\'s Altar');
  assert.ok(altar, 'the card completing all three is suggested');
  assert.equal(altar.unlocks.length, 3);
  assert.deepStrictEqual(sizeBreakdown(altar.unlocks), [
    { size: 2, count: 1 },
    { size: 4, count: 2 },
  ]);
});

// expand() strips the compact fields, so a breakdown taken after it must still
// see the slot that was filled — otherwise every template combo shrinks by one.
test('the breakdown survives expand()', () => {
  const row = { id: 'x', c: ['Rings of Brighthearth'], p: [], fills: [{ id: 7, slot: 'Persist Creature', card: 'Kitchen Finks' }] };
  assert.equal(comboSize(expand(row)), 2);
});

// ---- the order the deck's own combos come back in -------------------------

// Sorting happens on compact rows, before expand(): a size function that only
// understood `uses` would score every one of them zero and leave the order to
// the popularity tie-break alone.
test('comboSize: reads the compact shape as well as the expanded one', () => {
  assert.equal(comboSize({ c: ['A', 'B', 'C'] }), 3);
  assert.equal(comboSize({ c: ['A'], fills: [{ id: 1, slot: 'x', card: 'B' }] }), 2);
  assert.equal(comboSize({ uses: [{ card: { name: 'A' } }, { card: { name: 'B' } }] }), 2);
});

const DECK_ORDER = {
  cardIdentity: { A: '', B: '', C: '', D: '', E: '' },
  combos: [
    // Deliberately awkward: the biggest combo is also the most played, so an
    // order that merely looked right under popularity cannot pass by accident.
    { id: 'big-popular', c: ['A', 'B', 'C', 'D'], p: ['Infinite mana'], i: 'C', pop: 900 },
    { id: 'small-quiet', c: ['A', 'B'], p: ['Infinite mana'], i: 'C', pop: 2 },
    { id: 'small-played', c: ['A', 'C'], p: ['Infinite mana'], i: 'C', pop: 400 },
    { id: 'medium', c: ['A', 'B', 'C'], p: ['Infinite mana'], i: 'C', pop: 50 },
  ],
};

test('the deck\'s combos start with the easiest, most played first within a size', () => {
  const deck = ['A', 'B', 'C', 'D'].map((card) => ({ card }));
  const { included } = matchDeck(DECK_ORDER, deckNameSet(deck), deck);
  assert.deepStrictEqual(included.map((c) => c.id), [
    'small-played',  // 2 cards, pop 400
    'small-quiet',   // 2 cards, pop 2
    'medium',        // 3 cards
    'big-popular',   // 4 cards, however popular
  ]);
});

test('a slot makes a combo bigger for ordering, not just for display', () => {
  const DATA = {
    cardIdentity: { A: '', B: '', 'Kitchen Finks': 'GW' },
    templates: { 7: 'Persist Creature' },
    templateCards: { 'kitchen finks': [7] },
    combos: [
      { id: 'two-named', c: ['A', 'B'], p: ['x'], i: 'C', pop: 1 },
      // One named card plus a slot the deck fills: two cards on the table, so it
      // sorts with the two-card combos rather than ahead of them.
      { id: 'one-plus-slot', c: ['A'], t: [7], p: ['x'], i: 'C', pop: 999 },
    ],
  };
  const deck = ['A', 'B', 'Kitchen Finks'].map((card) => ({ card }));
  const { included } = matchDeck(DATA, deckNameSet(deck), deck);
  assert.deepStrictEqual(included.map((c) => c.id), ['one-plus-slot', 'two-named']);
  assert.deepStrictEqual(included.map(comboSize), [2, 2]);
});
