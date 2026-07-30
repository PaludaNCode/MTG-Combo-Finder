const test = require('node:test');
const assert = require('node:assert');
const { matchDeck, deckIdentity, expand, deckNameSet, computeSuggestions } = require('../combos.js');

// A miniature stand-in for the published combos.json.
const DATASET = {
  cardIdentity: {
    'Kinnan, Bonder Prodigy': 'GU',
    'Basalt Monolith': '',
    'Rings of Brighthearth': '',
    'Palinchron': 'U',
    'Deadeye Navigator': 'U',
    'Great Whale': 'U',
    'Walking Ballista': '',
    'Heliod, Sun-Crowned': 'W',
    'Thassa\'s Oracle': 'U',
    'Demonic Consultation': 'B',
  },
  combos: [
    { id: '1', c: ['Kinnan, Bonder Prodigy', 'Basalt Monolith'], p: ['Infinite mana'], i: 'GU', pop: 50 },
    { id: '2', c: ['Basalt Monolith', 'Rings of Brighthearth'], p: ['Infinite mana'], i: 'C', pop: 90 },
    { id: '3', c: ['Palinchron', 'Deadeye Navigator'], p: ['Infinite mana'], i: 'U' },
    { id: '4', c: ['Great Whale', 'Deadeye Navigator'], p: ['Infinite mana'], i: 'U' },
    { id: '5', c: ['Walking Ballista', 'Heliod, Sun-Crowned'], p: ['Infinite damage'], i: 'W' },
    { id: '6', c: ['Thassa\'s Oracle', 'Demonic Consultation'], p: ['Win the game'], i: 'UB' },
    { id: '7', c: ['Basalt Monolith', 'Some Sac Outlet'], p: ['Infinite'], i: 'C', t: 1 },
  ],
};

const DECK = [
  { card: 'Basalt Monolith' }, { card: 'Palinchron' }, { card: 'Great Whale' },
  { card: 'Walking Ballista' }, { card: 'Thassa\'s Oracle' },
];
const COMMANDERS = [{ card: 'Kinnan, Bonder Prodigy' }];

function run() {
  return matchDeck(DATASET, deckNameSet(COMMANDERS.concat(DECK)), COMMANDERS);
}

test('matchDeck: finds combos whose every card is present', () => {
  const ids = run().included.map((c) => c.id);
  assert.deepStrictEqual(ids, ['1']);
});

test('matchDeck: deck identity comes from the commander', () => {
  const identity = deckIdentity(COMMANDERS, DATASET.cardIdentity);
  assert.deepStrictEqual([...identity].sort(), ['G', 'U']);
});

test('matchDeck: one-card-away combos split by color identity', () => {
  const { almostIncluded, almostIncludedByAddingColors } = run();
  // Rings (colorless) and Deadeye (blue) fit Kinnan's GU identity.
  assert.deepStrictEqual(almostIncluded.map((c) => c.id).sort(), ['2', '3', '4']);
  // Heliod is white and Demonic Consultation black — both outside GU.
  assert.deepStrictEqual(almostIncludedByAddingColors.map((c) => c.id).sort(), ['5', '6']);
});

test('matchDeck: combos needing a template are never suggested', () => {
  const all = run();
  const ids = [...all.included, ...all.almostIncluded, ...all.almostIncludedByAddingColors].map((c) => c.id);
  assert.ok(!ids.includes('7'), 'template combo should be excluded');
});

test('matchDeck: suggestions rank the card that unlocks the most combos first', () => {
  const { almostIncluded } = run();
  const deckNames = deckNameSet(COMMANDERS.concat(DECK));
  const suggestions = computeSuggestions(almostIncluded.map(expand), deckNames);
  assert.strictEqual(suggestions[0].card, 'Deadeye Navigator');
  assert.strictEqual(suggestions[0].unlocks.length, 2); // Palinchron + Great Whale
  assert.strictEqual(suggestions[1].card, 'Rings of Brighthearth');
});

test('matchDeck: an unknown commander disables color filtering rather than hiding everything', () => {
  const commanders = [{ card: 'Some Unreleased Commander' }];
  const result = matchDeck(DATASET, deckNameSet(commanders.concat(DECK)), commanders);
  assert.strictEqual(result.identity, null);
  assert.strictEqual(result.almostIncludedByAddingColors.length, 0);
  assert.ok(result.almostIncluded.length >= 4, 'everything one card away stays visible');
});

test('expand: compact rows become the shape the renderer expects', () => {
  const v = expand({ id: '9', c: ['A', 'B'], p: ['Infinite mana'], i: 'U' });
  assert.deepStrictEqual(v.uses, [{ card: { name: 'A' } }, { card: { name: 'B' } }]);
  assert.deepStrictEqual(v.produces, [{ feature: { name: 'Infinite mana' } }]);
  assert.strictEqual(v.id, '9');
});
