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
