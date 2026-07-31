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

// Popularity ranks the *cards* above, and deliberately does not order the combos
// underneath one. Ordering those by play count scatters every repeated partner down
// the list — Archangel of Thune at 999 plays, two other combos, Archangel again at
// 493, three more, Archangel at 186 — which reads as unsorted to anyone scanning for
// a card, since the play counts are not on screen.
test('computeSuggestions: play count does not order the combos inside a suggestion', () => {
  const [suggestion] = computeSuggestions([
    variant('Power Artifact', 10, ['a']),
    variant('Power Artifact', 800, ['b']),
    variant('Power Artifact', 300, ['c']),
  ], deck);
  // Same two cards in each, so nothing distinguishes them and the input order
  // survives. What matters is that 800 was not floated to the top.
  assert.deepStrictEqual(suggestion.unlocks.map((v) => v.pop), [10, 800, 300]);
});

// Size first: a suggestion opens on its easiest line, the same order as the size
// breakdown printed on the row above it. Popularity alone put a 4-card combo at the
// top of a list headed "1 × 2-card · 4 × 3-card · 7 × 4-card".
test('computeSuggestions: a suggestion lists its smallest combos first', () => {
  const held = deckNameSet([{ card: 'Basalt Monolith' }, { card: 'Sol Ring' }]);
  const sized = (cards, pop) => ({
    uses: cards.map((name) => ({ card: { name } })),
    produces: [{ feature: { name: 'Infinite colorless mana' } }],
    pop,
  });
  const [suggestion] = computeSuggestions([
    // The most played is also the largest, so popularity alone would float it to the
    // top. That is exactly the shape this pins.
    sized(['Basalt Monolith', 'Sol Ring', 'Power Artifact'], 900),
    sized(['Sol Ring', 'Power Artifact'], 50),
    sized(['Basalt Monolith', 'Power Artifact'], 5),
  ], held);
  assert.deepStrictEqual(suggestion.unlocks.map((v) => v.uses.length), [2, 2, 3]);
  // Alphabetical within a size, by the cards as they are drawn: "Basalt Monolith +
  // Power Artifact" before "Power Artifact + Sol Ring" — and note that puts the
  // 5-play combo above the 50-play one, which is the point.
  assert.deepStrictEqual(suggestion.unlocks.map((v) => v.pop), [5, 50, 900]);
});

// Within a size, the order is the names as drawn. This is the case from the report:
// a combo whose partner sorts late was sitting third of eleven because it had more
// plays than the two below it.
test('computeSuggestions: within a size, combos are alphabetical by their cards', () => {
  // Everything but Scurry Oak is in the deck, so all three combos are one card away
  // from the same card and land under one suggestion — which is the shape the report
  // came from: eleven rows under a single card, differing in one partner.
  const held = deckNameSet([
    { card: 'Sadistic Glee' }, { card: 'Viscera Seer' },
    { card: "Ashnod's Altar" }, { card: 'Carrion Feeder' },
  ]);
  const trio = (partner, pop) => ({
    uses: [{ card: { name: 'Scurry Oak' } }, { card: { name: 'Sadistic Glee' } }, { card: { name: partner } }],
    produces: [{ feature: { name: 'Infinite creature tokens' } }],
    pop,
  });
  const [suggestion] = computeSuggestions([
    trio('Viscera Seer', 377),
    trio("Ashnod's Altar", 333),
    trio('Carrion Feeder', 216),
  ], held);
  assert.strictEqual(suggestion.card, 'Scurry Oak');
  // Play count would have given 377, 333, 216 — exactly the order that put Viscera
  // Seer third of eleven on screen.
  assert.deepStrictEqual(
    suggestion.unlocks.map((v) => v.uses[2].card.name),
    ["Ashnod's Altar", 'Carrion Feeder', 'Viscera Seer']
  );
});

// A slot counts as a card, because something has to occupy it — so a combo needing
// "Rings of Brighthearth + a Persist Creature" is not easier than a two-card line.
test('computeSuggestions: a template slot counts toward the size it is sorted by', () => {
  const held = deckNameSet([{ card: 'Basalt Monolith' }]);
  const withSlot = {
    uses: [{ card: { name: 'Basalt Monolith' } }, { card: { name: 'Power Artifact' } }],
    produces: [{ feature: { name: 'Infinite colorless mana' } }],
    fills: [{ slot: 'a Persist Creature', card: 'Kitchen Finks' }],
    pop: 900,
  };
  const plain = {
    uses: [{ card: { name: 'Basalt Monolith' } }, { card: { name: 'Power Artifact' } }],
    produces: [{ feature: { name: 'Infinite colorless mana' } }],
    pop: 1,
  };
  const [suggestion] = computeSuggestions([withSlot, plain], held);
  assert.deepStrictEqual(suggestion.unlocks.map((v) => v.pop), [1, 900]);
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
