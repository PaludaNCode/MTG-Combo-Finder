'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  matchDeck, deckNameSet, deckTemplateIndex, fillTemplates, expand, comboPieces,
} = require('../combos.js');

// Two templates, deliberately overlapping: Kitchen Finks satisfies both, so a
// combo needing both cannot be filled by Kitchen Finks alone.
const DATASET = {
  cardIdentity: {
    'Kitchen Finks': 'GW',
    'Murderous Redcap': 'BR',
    'Carrion Feeder': 'B',
    'Scurry Oak': 'G',
    'Sadistic Glee': 'B',
    'Basalt Monolith': '',
  },
  templates: { 7: 'Persist Creature', 9: 'Free Sacrifice Outlet' },
  templateCards: {
    'kitchen finks': [7, 9],
    'murderous redcap': [7],
    'carrion feeder': [9],
  },
  combos: [
    { id: 'named-only', c: ['Scurry Oak', 'Sadistic Glee'], p: ['Infinite tokens'], i: 'BG' },
    { id: 'one-slot', c: ['Scurry Oak'], t: [9], p: ['Infinite tokens'], i: 'BG' },
    { id: 'two-slots', c: ['Scurry Oak'], t: [7, 9], p: ['Infinite tokens'], i: 'BG' },
    { id: 'same-slot-twice', c: ['Scurry Oak'], t: [7, 7], p: ['Infinite tokens'], i: 'BG' },
    { id: 'unresolvable', c: ['Scurry Oak'], t: [999], p: ['Infinite tokens'], i: 'BG' },
    { id: 'legacy-count', c: ['Scurry Oak'], t: 1, p: ['Infinite tokens'], i: 'BG' },
    { id: 'unreadable', c: ['Scurry Oak'], t: [null], p: ['Infinite tokens'], i: 'BG' },
  ],
};

const idsOf = (list) => list.map((c) => c.id).sort();
const match = (cards) => matchDeck(DATASET, deckNameSet(cards.map((card) => ({ card }))), [], cards.map((card) => ({ card })));

test('a slot the deck fills makes the combo count', () => {
  const { included } = match(['Scurry Oak', 'Carrion Feeder']);
  assert.ok(idsOf(included).includes('one-slot'));
});

test('a slot the deck cannot fill keeps the combo out', () => {
  const { included, almostIncluded, almostIncludedByAddingColors } = match(['Scurry Oak']);
  const all = idsOf(included.concat(almostIncluded, almostIncludedByAddingColors));
  assert.ok(!all.includes('one-slot'));
});

test('two slots need two different cards, not one card twice', () => {
  // Kitchen Finks alone satisfies both templates, but it is one card.
  const one = match(['Scurry Oak', 'Kitchen Finks']);
  assert.ok(!idsOf(one.included).includes('two-slots'));

  // Carrion Feeder takes the sacrifice slot, leaving Kitchen Finks the other.
  const two = match(['Scurry Oak', 'Kitchen Finks', 'Carrion Feeder']);
  assert.ok(idsOf(two.included).includes('two-slots'));
});

test('the same template twice needs two cards on that template', () => {
  const one = match(['Scurry Oak', 'Kitchen Finks']);
  assert.ok(!idsOf(one.included).includes('same-slot-twice'));

  const two = match(['Scurry Oak', 'Kitchen Finks', 'Murderous Redcap']);
  assert.ok(idsOf(two.included).includes('same-slot-twice'));
});

// The reason the assignment is a matching rather than a greedy pass. Deck:
// Kitchen Finks (fills either slot) and Murderous Redcap (Persist only). Taking
// Kitchen Finks for the Persist slot first — it is the first candidate — strands
// the sacrifice slot, which nothing else can fill. Only by moving Persist onto
// Murderous Redcap do both slots fill, and a greedy pass never does that.
test('a card is moved off a slot rather than stranding another', () => {
  const deck = [{ card: 'Kitchen Finks' }, { card: 'Murderous Redcap' }];
  const byTemplate = deckTemplateIndex(DATASET, deckNameSet(deck), deck);

  const fills = fillTemplates({ c: [], t: [7, 9] }, byTemplate, DATASET.templates);
  assert.ok(fills, 'both slots are fillable, in the only way that works');
  const bySlot = Object.fromEntries(fills.map((f) => [f.id, f.card]));
  assert.deepStrictEqual(bySlot, {
    7: 'Murderous Redcap',   // moved here so that...
    9: 'Kitchen Finks',      // ...the only card that can fill this one is free
  });
});

test('a slot nothing in the deck fills cannot be faked by reshuffling', () => {
  const deck = [{ card: 'Murderous Redcap' }];
  const byTemplate = deckTemplateIndex(DATASET, deckNameSet(deck), deck);
  assert.equal(fillTemplates({ c: [], t: [7, 9] }, byTemplate, DATASET.templates), null);
});

test('a card the combo already names cannot also fill its slot', () => {
  const byTemplate = deckTemplateIndex(
    DATASET,
    deckNameSet([{ card: 'Carrion Feeder' }]),
    [{ card: 'Carrion Feeder' }]
  );
  const fills = fillTemplates({ c: ['Carrion Feeder'], t: [9] }, byTemplate, DATASET.templates);
  assert.equal(fills, null);
});

test('a template with no resolved card list stays excluded', () => {
  const { included } = match(['Scurry Oak', 'Kitchen Finks', 'Carrion Feeder']);
  assert.ok(!idsOf(included).includes('unresolvable'));
});

// compact() writes null for a requirement it could not read an id from. It has
// to behave like a slot nothing fills, not like no slot at all.
test('a requirement with no id excludes the combo', () => {
  const { included } = match(['Scurry Oak', 'Kitchen Finks', 'Carrion Feeder']);
  assert.ok(!idsOf(included).includes('unreadable'));
});

test('data predating template resolution is still excluded', () => {
  const { included } = match(['Scurry Oak', 'Kitchen Finks', 'Carrion Feeder']);
  assert.ok(!idsOf(included).includes('legacy-count'));
});

test('the filling card is named, with the spelling the decklist used', () => {
  const { included } = match(['Scurry Oak', 'Carrion Feeder']);
  const combo = included.find((c) => c.id === 'one-slot');
  assert.deepStrictEqual(combo.fills, [
    { id: 9, slot: 'Free Sacrifice Outlet', card: 'Carrion Feeder' },
  ]);
  assert.deepStrictEqual(expand(combo).fills, combo.fills);
});

test('combos with no slots are untouched', () => {
  const { included } = match(['Scurry Oak', 'Sadistic Glee']);
  const combo = included.find((c) => c.id === 'named-only');
  assert.equal(combo.fills, undefined);
  assert.equal(expand(combo).fills, undefined);
});

test('a card filling a slot counts as a piece of the combo', () => {
  const { included } = match(['Scurry Oak', 'Carrion Feeder']);
  const pieces = comboPieces(included.map(expand));
  const feeder = pieces.find((p) => p.card === 'Carrion Feeder');
  assert.ok(feeder, 'the card holding the slot up is load-bearing too');
  assert.equal(feeder.count, 1);
});

test('a slot still excludes the combo from one-card-away suggestions', () => {
  // Scurry Oak missing AND the slot unfilled is two cards away, not one.
  const { almostIncluded } = match(['Sadistic Glee']);
  assert.ok(!idsOf(almostIncluded).includes('one-slot'));
});

test('a filled slot leaves a one-card-away combo suggestible', () => {
  // Which of the two "almost" buckets it lands in is a colour question, settled
  // elsewhere; what matters here is that a filled slot no longer excludes it.
  const m = match(['Carrion Feeder', 'Sadistic Glee']);
  const almost = idsOf(m.almostIncluded.concat(m.almostIncludedByAddingColors));
  assert.ok(almost.includes('one-slot'));
});
