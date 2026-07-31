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
