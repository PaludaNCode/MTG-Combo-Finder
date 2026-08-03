'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  matchDeck, deckNameSet, comboSize, expand,
} = require('../combos.js');

// A combo can name a template slot — "a Persist Creature" — instead of a card, and
// the deck fills it or it does not. This file is what is left of the one-slot-away
// tests after that panel was removed, and it covers the half that still has callers:
// a slot the deck *fills* is part of a combo the deck has, and one it cannot fill
// takes the combo out of every list.
//
// The removed half asserted the panel's own rules — its ordering, its candidate
// lists, the cards offered for a slot. See the README under "The panel that could
// not answer its own question" for why none of that is here any more.
//
// Kitchen Finks fills both templates, which is why it is the useful example card.
const DATASET = {
  cardIdentity: {
    'Scurry Oak': 'G', 'Sadistic Glee': 'B', 'Heliod, Sun-Crowned': 'W',
    'Kitchen Finks': 'GW', 'Murderous Redcap': 'BR', 'Carrion Feeder': 'B',
    'Viscera Seer': 'B',
  },
  templates: { 7: 'Persist Creature', 9: 'Free Sacrifice Outlet' },
  unresolvable: { 84: 'Haste Enabler' },
  templateCards: {
    'kitchen finks': [7, 9],
    'murderous redcap': [7],
    'carrion feeder': [9],
    'viscera seer': [9],
  },
  combos: [
    { id: 'sac-slot', c: ['Scurry Oak'], t: [9], p: ['Infinite tokens'], i: 'BG', pop: 10 },
    { id: 'persist-slot', c: ['Sadistic Glee'], t: [7], p: ['Infinite tokens'], i: 'BG', pop: 90 },
    { id: 'two-slots', c: ['Scurry Oak'], t: [7, 9], p: ['Infinite tokens'], i: 'BG' },
    { id: 'card-and-slot', c: ['Scurry Oak', 'Heliod, Sun-Crowned'], t: [9], p: ['Infinite damage'], i: 'BGW' },
    { id: 'no-query', c: ['Scurry Oak'], t: [84], p: ['Infinite damage'], i: 'BG' },
    { id: 'unreadable', c: ['Scurry Oak'], t: [null], p: ['Infinite damage'], i: 'BG' },
    { id: 'legacy-count', c: ['Scurry Oak'], t: 1, p: ['Infinite damage'], i: 'BG' },
  ],
};

// A Golgari deck holding every named card the combos above want, and nothing
// that fills a slot.
const DECK = ['Scurry Oak', 'Sadistic Glee'];
const match = (cards) => {
  const entries = cards.map((card) => ({ card }));
  return matchDeck(DATASET, deckNameSet(entries), entries);
};
const ids = (rows) => rows.map((r) => r.id);
const claimed = (m) => ids(m.included.concat(m.almostIncluded, m.almostIncludedByAddingColors));

// The discipline the whole feature rests on, and the one thing removing the panel
// must not have changed: a combo the deck cannot assemble is never counted among
// the ones it can. It used to be reported in a panel of its own; now it is not
// reported at all, which is a different thing from being claimed.
test('a slot the deck cannot fill keeps the combo out of every list', () => {
  const m = match(DECK);
  assert.ok(!claimed(m).includes('sac-slot'));
  assert.ok(!claimed(m).includes('persist-slot'));
});

test('a slot with no published card list cannot be filled either', () => {
  assert.ok(!claimed(match(DECK)).includes('no-query'));
});

test('a requirement whose id could not be read is not treated as filled', () => {
  assert.ok(!claimed(match(DECK)).includes('unreadable'));
});

test('data predating template resolution is not treated as filled', () => {
  assert.ok(!claimed(match(DECK)).includes('legacy-count'));
});

// The other half, which is what survives on the page: fill the slot and the combo
// is a combo the deck has, with the slot named and credited to the card.
test('filling the slot makes it a combo the deck has, and credits the card', () => {
  const m = match(DECK.concat('Carrion Feeder'));
  const row = m.included.find((r) => r.id === 'sac-slot');
  assert.ok(row, 'Carrion Feeder fills the sacrifice slot');
  assert.deepStrictEqual(row.fills, [{ id: 9, slot: 'Free Sacrifice Outlet', card: 'Carrion Feeder' }]);
});

test('one of two slots filled is still a slot short', () => {
  const m = match(DECK.concat('Carrion Feeder'));
  assert.ok(!claimed(m).includes('two-slots'), 'the persist slot is still empty');
});

// A named card still missing is still missing, slot or no slot: this one is one
// card away, so it belongs with the suggestions and not with the combos held.
test('a missing named card puts it among the near misses, not the combos held', () => {
  const m = match(DECK.concat('Carrion Feeder'));
  assert.ok(!ids(m.included).includes('card-and-slot'));
  assert.ok(ids(m.almostIncludedByAddingColors).includes('card-and-slot'), 'Heliod is white');
});

// A slot counts as a card in the size breakdown, because something has to occupy
// it: `Scurry Oak + a Free Sacrifice Outlet` is a two-card combo, and counting
// only the named cards would file it as a one-card one.
test('a filled slot counts as a card in the combo size', () => {
  const row = match(DECK.concat('Carrion Feeder')).included.find((r) => r.id === 'sac-slot');
  assert.equal(comboSize(row), 2, 'Scurry Oak plus the card filling the slot');
});

test('expand: the fill survives, or the row cannot say what filled the slot', () => {
  const row = match(DECK.concat('Carrion Feeder')).included.find((r) => r.id === 'sac-slot');
  assert.deepStrictEqual(expand(row).fills, row.fills);
});
