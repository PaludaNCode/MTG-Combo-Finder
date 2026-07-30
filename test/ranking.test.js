'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  computeSuggestions, groupSuggestions, matchDeck, deckNameSet, expand,
} = require('../combos.js');

// Spellbook publishes a popularity per variant and the fetcher carries it as
// `pop`. It used to decide the order of the combos you already have and nothing
// else: suggestions were ranked by count alone, and the combos inside a
// suggestion arrived in whatever order the database listed them.
const deck = deckNameSet([{ card: 'Basalt Monolith' }]);

const variant = (missing, pop, results) => ({
  uses: [{ card: { name: 'Basalt Monolith' } }, { card: { name: missing } }],
  produces: (results || ['Infinite colorless mana']).map((name) => ({ feature: { name } })),
  pop,
});

test('computeSuggestions: cards unlocking as much are ranked by how played it is', () => {
  const suggestions = computeSuggestions([
    variant('Forsaken Monument', 5),
    variant('Rings of Brighthearth', 900),
  ], deck);
  assert.deepStrictEqual(suggestions.map((s) => s.card), ['Rings of Brighthearth', 'Forsaken Monument']);
});

test('computeSuggestions: a card unlocking more still wins over a popular one', () => {
  const suggestions = computeSuggestions([
    variant('Rings of Brighthearth', 900),
    variant('Power Artifact', 1, ['Infinite colorless mana']),
    variant('Power Artifact', 2, ['Infinite untaps']),
  ], deck);
  assert.deepStrictEqual(suggestions.map((s) => s.card), ['Power Artifact', 'Rings of Brighthearth']);
});

test('computeSuggestions: the combos a suggestion unlocks list the most played first', () => {
  const [suggestion] = computeSuggestions([
    variant('Power Artifact', 10, ['a']),
    variant('Power Artifact', 800, ['b']),
    variant('Power Artifact', 300, ['c']),
  ], deck);
  assert.deepStrictEqual(suggestion.unlocks.map((v) => v.pop), [800, 300, 10]);
});

// Popularity is a tie-break, not a replacement: data with no popularity at all
// must still come out in a stable, predictable order.
test('computeSuggestions: with nothing to choose between them, ties stay alphabetical', () => {
  const suggestions = computeSuggestions([
    variant('Rings of Brighthearth'),
    variant('Forsaken Monument'),
  ], deck);
  assert.deepStrictEqual(suggestions.map((s) => s.card), ['Forsaken Monument', 'Rings of Brighthearth']);
});

test('groupSuggestions: equally sized groups are ranked by how played their combos are', () => {
  const groups = groupSuggestions(computeSuggestions([
    variant('Forsaken Monument', 5, ['Infinite colorless mana']),
    variant('Rings of Brighthearth', 900, ['Infinite untaps']),
  ], deck), deck);
  assert.deepStrictEqual(groups.map((g) => g.cards[0]), ['Rings of Brighthearth', 'Forsaken Monument']);
});

const DATASET = {
  cardIdentity: { 'Basalt Monolith': '', 'Rings of Brighthearth': '', 'Power Artifact': 'U' },
  combos: [
    { id: 'quiet', c: ['Basalt Monolith', 'Rings of Brighthearth'], p: ['Infinite mana'], i: 'C', pop: 3 },
    { id: 'played', c: ['Basalt Monolith', 'Power Artifact'], p: ['Infinite mana'], i: 'U', pop: 700 },
    { id: 'unplayed', c: ['Basalt Monolith', 'Forsaken Monument'], p: ['Infinite mana'], i: 'C' },
  ],
};

test('matchDeck: the one-card-away lists come back most played first', () => {
  const entries = [{ card: 'Basalt Monolith' }];
  const { almostIncluded, almostIncludedByAddingColors } = matchDeck(DATASET, deckNameSet(entries), entries);
  // A colourless deck: the blue combo is the one that needs a colour added.
  assert.deepStrictEqual(almostIncluded.map((c) => c.id), ['quiet', 'unplayed']);
  assert.deepStrictEqual(almostIncludedByAddingColors.map((c) => c.id), ['played']);
});

test('expand: popularity survives, or ranking silently reads as unplayed', () => {
  assert.equal(expand({ id: 'x', c: ['A'], p: [], pop: 42 }).pop, 42);
});
