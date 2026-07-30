'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  matchDeck, deckNameSet, slotCandidates, expand,
} = require('../combos.js');

// Combos whose every named card is in the deck, held up only by a slot nothing
// in the deck fills. These used to be dropped in silence — the deck was simply
// never told about them.
//
// Kitchen Finks fills both templates, which is why it is the useful example
// card: it would unstick two of these combos at once.
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
    { id: 'off-colour', c: ['Scurry Oak'], t: [9], p: ['Infinite damage'], i: 'BGR' },
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

test('a combo short of one slot is reported instead of dropped', () => {
  const { oneSlotAway } = match(DECK);
  assert.ok(ids(oneSlotAway).includes('sac-slot'));
});

test('the most played of them comes first', () => {
  const { oneSlotAway } = match(DECK);
  assert.deepStrictEqual(ids(oneSlotAway).slice(0, 2), ['persist-slot', 'sac-slot']);
});

// The whole discipline of this feature: a combo the deck cannot assemble must
// never be counted among the ones it can.
test('being one slot away is not being able to do it', () => {
  const { included, almostIncluded, almostIncludedByAddingColors } = match(DECK);
  const claimed = ids(included.concat(almostIncluded, almostIncludedByAddingColors));
  assert.ok(!claimed.includes('sac-slot'));
  assert.ok(!claimed.includes('persist-slot'));
});

test('the slot it is short of is named', () => {
  const { oneSlotAway } = match(DECK);
  const row = oneSlotAway.find((r) => r.id === 'sac-slot');
  assert.deepStrictEqual(row.gaps, [{ id: 9, slot: 'Free Sacrifice Outlet' }]);
});

test('two slots short is two cards away, so it stays out', () => {
  assert.ok(!ids(match(DECK).oneSlotAway).includes('two-slots'));
});

test('a missing named card as well as a slot stays out', () => {
  assert.ok(!ids(match(DECK).oneSlotAway).includes('card-and-slot'));
});

// A combo the deck could not legally run is not a decision anyone has to make.
test('a combo outside the deck colours stays out', () => {
  assert.ok(!ids(match(DECK).oneSlotAway).includes('off-colour'));
});

// 29 of Spellbook's templates carry no Scryfall query, so there is no card list
// and never will be. The slot can still be named, which is the difference
// between "needs a Haste Enabler" and saying nothing at all.
test('a slot with no card list is still named from the unresolvable list', () => {
  const { oneSlotAway, slotCandidates: candidates } = match(DECK);
  const row = oneSlotAway.find((r) => r.id === 'no-query');
  assert.deepStrictEqual(row.gaps, [{ id: 84, slot: 'Haste Enabler' }]);
  assert.equal(candidates['84'].total, 0, 'nothing can be offered for it');
});

test('a requirement whose id could not be read says nothing', () => {
  assert.ok(!ids(match(DECK).oneSlotAway).includes('unreadable'));
});

test('data predating template resolution says nothing either', () => {
  assert.ok(!ids(match(DECK).oneSlotAway).includes('legacy-count'));
});

test('a partly filled combo still credits the slot it did fill', () => {
  const entries = ['Scurry Oak', 'Sadistic Glee', 'Carrion Feeder'].map((card) => ({ card }));
  const { oneSlotAway } = matchDeck(DATASET, deckNameSet(entries), entries);
  const row = oneSlotAway.find((r) => r.id === 'two-slots');
  assert.ok(row, 'the sacrifice slot is filled now, so only one slot is short');
  assert.deepStrictEqual(row.fills, [{ id: 9, slot: 'Free Sacrifice Outlet', card: 'Carrion Feeder' }]);
  assert.deepStrictEqual(row.gaps, [{ id: 7, slot: 'Persist Creature' }]);
});

test('expand: the gap survives, or the page cannot say what is missing', () => {
  const { oneSlotAway } = match(DECK);
  const row = oneSlotAway.find((r) => r.id === 'sac-slot');
  assert.deepStrictEqual(expand(row).gaps, row.gaps);
});

// ---- the cards that would fill the slot ----------------------------------

test('candidates: every card is counted, only playable ones are named', () => {
  const { oneSlotAway, slotCandidates: candidates } = match(DECK);
  assert.ok(oneSlotAway.length);
  const sac = candidates['9'];
  // Kitchen Finks, Carrion Feeder and Viscera Seer fill the slot; Kitchen Finks
  // is white, which this deck is not.
  assert.equal(sac.total, 3);
  assert.equal(sac.inColour, 2);
  assert.deepStrictEqual(sac.names, ['Carrion Feeder', 'Viscera Seer']);
});

test('candidates: a card that unsticks two of your combos is named first', () => {
  const entries = ['Scurry Oak', 'Sadistic Glee', 'Heliod, Sun-Crowned'].map((card) => ({ card }));
  const white = matchDeck(DATASET, deckNameSet(entries), entries);
  // Now that the deck plays white, Kitchen Finks is legal — and it fills both
  // the sacrifice slot and the persist slot, so it leads both lists.
  assert.equal(white.slotCandidates['9'].names[0], 'Kitchen Finks');
  assert.equal(white.slotCandidates['7'].names[0], 'Kitchen Finks');
});

test('candidates: a card already in the deck is not an addition', () => {
  const entries = ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'].map((card) => ({ card }));
  const held = matchDeck(DATASET, deckNameSet(entries), entries);
  const sac = held.slotCandidates['9'];
  // Viscera Seer fills the slot, so nothing here is one slot away any more —
  // but where it is still counted, it is never offered as something to add.
  for (const id of Object.keys(held.slotCandidates)) {
    assert.ok(!held.slotCandidates[id].names.includes('Viscera Seer'));
  }
  assert.equal(sac, undefined, 'the slot is filled, so nothing is waiting on it');
});

test('candidates: nothing is computed when nothing is stuck', () => {
  assert.deepStrictEqual({ ...slotCandidates(DATASET, [], deckNameSet([]), null) }, {});
});

test('candidates: the list of names is capped', () => {
  const rows = [{ gaps: [{ id: 9, slot: 'Free Sacrifice Outlet' }] }];
  const capped = slotCandidates(DATASET, rows, deckNameSet([]), null, 1);
  assert.equal(capped['9'].names.length, 1);
  assert.equal(capped['9'].total, 3, 'the count still knows about all of them');
});
