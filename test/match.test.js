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

// ---- what a combo produces -------------------------------------------------
const { summarizeResults } = require('../combos.js');

test('summarizeResults: game-ending results come first', () => {
  const out = summarizeResults([
    'Infinite storm count',
    'Win the game',
    'Infinite colorless mana',
  ]);
  assert.strictEqual(out[0].name, 'Win the game');
  assert.strictEqual(out[0].tier, 'win');
  assert.deepStrictEqual(out.slice(1).map((r) => r.name), ['Infinite colorless mana', 'Infinite storm count']);
  assert.ok(out.slice(1).every((r) => r.win === false));
});

test('summarizeResults: recognises the ways a combo can end a game', () => {
  const wins = [
    'Win the game',
    'Each opponent loses the game',
    'Win the game at the beginning of your next upkeep',
    'All opponents lose the game',
  ];
  for (const w of wins) {
    assert.strictEqual(summarizeResults([w])[0].tier, 'win', w);
  }
});

test('summarizeResults: game-deciding results are their own tier, not wins', () => {
  // Infinite life beats most decks but is not a win: poison ignores life
  // totals, and mill or an alternate win condition goes over the top. Claiming
  // it wins would be wrong in exactly the games where it matters.
  for (const decisive of [
    'Infinite lifegain',
    'Infinite life',
    'Near-infinite damage',
    'Infinite damage to each opponent',
    'Infinite mill',
    'Infinite turns',
    'Infinite combats',
  ]) {
    const r = summarizeResults([decisive])[0];
    assert.strictEqual(r.tier, 'decisive', decisive);
    assert.strictEqual(r.win, false, decisive + ' must not claim to win');
    assert.ok(r.why.length > 0, decisive + ' should explain its caveat');
  }
});

test('summarizeResults: enablers stay plain results', () => {
  for (const plain of ['Infinite colorless mana', 'Infinite ETB triggers', 'Infinite storm count', 'Infinite untap']) {
    assert.strictEqual(summarizeResults([plain])[0].tier, 'other', plain);
  }
});

test('summarizeResults: tiers sort win, then decisive, then the rest', () => {
  const out = summarizeResults([
    'Infinite storm count',
    'Infinite lifegain',
    'Win the game',
    'Infinite colorless mana',
    'Infinite mill',
  ]);
  assert.deepStrictEqual(out.map((r) => r.tier), ['win', 'decisive', 'decisive', 'other', 'other']);
  assert.strictEqual(out[0].name, 'Win the game');
  // Within a tier, alphabetical keeps the output stable.
  assert.deepStrictEqual(out.slice(1, 3).map((r) => r.name), ['Infinite lifegain', 'Infinite mill']);
});

test('summarizeResults: duplicates collapse regardless of case or spacing', () => {
  const out = summarizeResults([
    'Infinite ETB triggers',
    'infinite etb triggers',
    'Infinite  ETB   triggers',
    'Infinite LTB triggers',
  ]);
  assert.deepStrictEqual(out.map((r) => r.name), ['Infinite ETB triggers', 'Infinite LTB triggers']);
});

test('summarizeResults: blanks and nullish entries are dropped', () => {
  assert.deepStrictEqual(summarizeResults(['', '   ', null, undefined, 'Infinite mana']).map((r) => r.name), ['Infinite mana']);
  assert.deepStrictEqual(summarizeResults([]), []);
  assert.deepStrictEqual(summarizeResults(null), []);
});

test('summarizeResults: ordering is stable regardless of input order', () => {
  const names = ['Infinite damage', 'Infinite mill', 'Infinite untap', 'Infinite mana'];
  const first = summarizeResults(names).map((r) => r.name);
  const second = summarizeResults([...names].reverse()).map((r) => r.name);
  assert.deepStrictEqual(first, second);
  // Decisive results lead, each tier alphabetical within itself.
  assert.deepStrictEqual(first, ['Infinite damage', 'Infinite mill', 'Infinite mana', 'Infinite untap']);
});
