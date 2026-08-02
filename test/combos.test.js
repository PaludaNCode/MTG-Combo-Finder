const test = require('node:test');
const assert = require('node:assert');
const { computeSuggestions, deckNameSet, nameKey, edhrecSlug } = require('../combos.js');

function variant(id, ...cardNames) {
  return { id, uses: cardNames.map((name) => ({ card: { name } })) };
}

test('computeSuggestions: ranks cards by combos unlocked', () => {
  const deck = deckNameSet([{ card: 'Basalt Monolith' }, { card: 'Kinnan, Bonder Prodigy' }]);
  const variants = [
    variant('1', 'Basalt Monolith', 'Rings of Brighthearth'),
    variant('2', 'Basalt Monolith', 'Rings of Brighthearth'), // Rings again -> 2 unlocks
    variant('3', 'Kinnan, Bonder Prodigy', 'Basalt Monolith', 'Zealous Conscripts'),
  ];
  const suggestions = computeSuggestions(variants, deck);
  assert.strictEqual(suggestions.length, 2);
  assert.strictEqual(suggestions[0].card, 'Rings of Brighthearth');
  assert.strictEqual(suggestions[0].unlocks.length, 2);
  assert.strictEqual(suggestions[1].card, 'Zealous Conscripts');
  assert.strictEqual(suggestions[1].unlocks.length, 1);
});

test('computeSuggestions: combos missing 2+ cards are not suggestions', () => {
  const deck = deckNameSet([{ card: 'Sol Ring' }]);
  const variants = [variant('1', 'Sol Ring', 'Basalt Monolith', 'Rings of Brighthearth')];
  assert.deepStrictEqual(computeSuggestions(variants, deck), []);
});

test('computeSuggestions: ties broken alphabetically', () => {
  const deck = deckNameSet([{ card: 'Sol Ring' }]);
  const variants = [
    variant('1', 'Sol Ring', 'Zealous Conscripts'),
    variant('2', 'Sol Ring', 'Aetherflux Reservoir'),
  ];
  const suggestions = computeSuggestions(variants, deck);
  assert.deepStrictEqual(suggestions.map((s) => s.card), ['Aetherflux Reservoir', 'Zealous Conscripts']);
});

test('computeSuggestions: double-faced Spellbook names match front-face deck entries', () => {
  const deck = deckNameSet([{ card: 'Valki, God of Lies' }, { card: 'Sol Ring' }]);
  const variants = [
    variant('1', 'Valki, God of Lies // Tibalt, Cosmic Impostor', 'Sol Ring', 'Maskwood Nexus'),
  ];
  const suggestions = computeSuggestions(variants, deck);
  assert.strictEqual(suggestions.length, 1);
  assert.strictEqual(suggestions[0].card, 'Maskwood Nexus');
});

test('nameKey: case-insensitive, front face only', () => {
  assert.strictEqual(nameKey('Valki, God of Lies // Tibalt, Cosmic Impostor'), 'valki, god of lies');
  assert.strictEqual(nameKey('SOL RING'), 'sol ring');
});

test('edhrecSlug: strips punctuation and accents', () => {
  assert.strictEqual(edhrecSlug('Kinnan, Bonder Prodigy'), 'kinnan-bonder-prodigy');
  assert.strictEqual(edhrecSlug("Jötun Grunt"), 'jotun-grunt');
  assert.strictEqual(edhrecSlug('Valki, God of Lies // Tibalt, Cosmic Impostor'), 'valki-god-of-lies');
});

// ---- the second count ------------------------------------------------------
//
// Both panels used to speak only for Spellbook, which answered their own question
// wrong: a card holding up four combos nobody published was shown as holding up
// none, and a card that would unlock four could not be suggested at all. The two
// numbers now sit side by side and never merge — one is Spellbook's word and one
// is ours, and adding them would be a claim neither of them makes.

const { comboPieces } = require('../combos.js');

const ours = (id, needs, ...cardNames) => Object.assign(
  variant(id, ...cardNames),
  { needs, unofficial: { confidence: 'verified' } }
);

test('comboPieces: unofficial combos are counted beside the published ones', () => {
  const published = [variant('1', 'Scurry Oak', 'Sadistic Glee')];
  const unofficial = [
    ours('u1', undefined, 'Scurry Oak', 'Necrosynthesis'),
    ours('u2', undefined, 'Scurry Oak', 'Hammerhead, Maggia Boss'),
  ];
  const pieces = comboPieces(published, unofficial);
  const oak = pieces.find((p) => p.card === 'Scurry Oak');
  assert.strictEqual(oak.count, 1, 'the published count absorbed ours');
  assert.strictEqual(oak.unofficial, 2);
  // Both lists are behind the row, because cutting the card costs all three.
  assert.strictEqual(oak.combos.length, 3);
});

// The case the old panel could not express: the card is not in it at all.
test('comboPieces: a card carrying only unofficial combos is still listed', () => {
  const pieces = comboPieces([], [ours('u1', undefined, 'Hammerhead, Maggia Boss', 'Scurry Oak')]);
  const hammerhead = pieces.find((p) => p.card === 'Hammerhead, Maggia Boss');
  assert.ok(hammerhead, 'the card is missing from the panel');
  assert.strictEqual(hammerhead.count, 0);
  assert.strictEqual(hammerhead.unofficial, 1);
});

test('comboPieces: ranking is by the two together, published breaking the tie', () => {
  const published = [
    variant('1', 'Two Published', 'x'),
    variant('2', 'Two Published', 'y'),
    variant('3', 'One Each', 'z'),
  ];
  const unofficial = [
    ours('u1', undefined, 'One Each', 'q'),
    ours('u2', undefined, 'Three Ours', 'q'),
    ours('u3', undefined, 'Three Ours', 'r'),
    ours('u4', undefined, 'Three Ours', 's'),
  ];
  const order = comboPieces(published, unofficial).map((p) => p.card);
  assert.deepStrictEqual(order.slice(0, 3), ['Three Ours', 'Two Published', 'One Each']);
});

test('computeSuggestions: an unofficial near miss is its own count on the row', () => {
  const deck = deckNameSet([{ card: 'Scurry Oak' }, { card: 'Necrosynthesis' }]);
  const published = [variant('1', 'Scurry Oak', 'Sadistic Glee')];
  const unofficial = [
    ours('u1', ['Viscera Seer'], 'Scurry Oak', 'Necrosynthesis', 'Viscera Seer'),
    ours('u2', ['Viscera Seer'], 'Scurry Oak', 'Viscera Seer', 'Sadistic Glee'),
  ];
  const suggestions = computeSuggestions(published, deck, unofficial);
  const seer = suggestions.find((s) => s.card === 'Viscera Seer');
  assert.ok(seer, 'a card only our rows want was not suggested');
  assert.strictEqual(seer.unlocks.length, 0);
  assert.strictEqual(seer.unofficial.length, 2);
  // Ranked above a card with one published unlock, because two beats one.
  assert.strictEqual(suggestions[0].card, 'Viscera Seer');
});

test('computeSuggestions: a row the deck can already assemble is not a suggestion', () => {
  const deck = deckNameSet([{ card: 'Scurry Oak' }, { card: 'Necrosynthesis' }]);
  // No `needs`, so it is a combo the deck has rather than a reason to add a card.
  const held = [ours('u1', undefined, 'Scurry Oak', 'Necrosynthesis')];
  assert.deepStrictEqual(computeSuggestions([], deck, held), []);
});

test('computeSuggestions: equal reach puts the published unlocks first', () => {
  const deck = deckNameSet([{ card: 'Held' }]);
  const published = [variant('1', 'Held', 'Theirs'), variant('2', 'Held', 'Theirs')];
  const unofficial = [
    ours('u1', ['Ours'], 'Held', 'Ours'),
    ours('u2', ['Ours'], 'Held', 'Ours', 'x'),
  ];
  const order = computeSuggestions(published, deck, unofficial).map((s) => s.card);
  assert.deepStrictEqual(order, ['Theirs', 'Ours']);
});
