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

test('summarizeResults: plumbing stays grey', () => {
  // The four biggest outcomes in the whole database are loop mechanics, not
  // reasons to run the deck. Keeping them quiet is what makes the chips readable.
  for (const plain of [
    'Infinite ETB',
    'Infinite LTB',
    'Infinite death triggers',
    'Infinite sacrifice triggers',
    'Near-infinite ETB',
    'Infinite landfall triggers',
    'Infinite magecraft triggers',
    'Infinite untap of creatures you control',
  ]) {
    assert.strictEqual(summarizeResults([plain])[0].tier, 'other', plain);
  }
});

test('summarizeResults: outcomes that need a payoff are yellow, by explicit request', () => {
  for (const decisive of [
    'Infinite creature tokens',
    'Infinite creature tokens with haste',
    'Infinite tapped creature tokens',
    'Infinite +1/+1 counters on a creature',
    'Infinite +1/+1 counters on creatures you control',
    'Infinite draw triggers',
    'Infinite card draw',
    'Infinite self-mill',
    'Infinite storm count',
    // Every flavour of mana: colourless, colour-specific and generated.
    'Infinite colorless mana',
    'Infinite colored mana',
    'Infinite red mana',
    'Infinite green mana',
    'Infinite mana creatures you control can produce',
    'Infinite mana lands you control can produce',
  ]) {
    const r = summarizeResults([decisive])[0];
    assert.strictEqual(r.tier, 'decisive', decisive);
    assert.ok(r.why.length > 0, decisive + ' should say what it still needs');
  }
});

test('summarizeResults: a bounded amount is not decisive', () => {
  // The tier is for unbounded results; "Draw a card" is just a thing that happens.
  for (const plain of ['Draw a card', 'Add one mana of any color', 'Create a creature token']) {
    assert.strictEqual(summarizeResults([plain])[0].tier, 'other', plain);
  }
});

test('summarizeResults: "lose the game" in a negation is not a win', () => {
  // These say "lose the game" while meaning the opposite, or hand the choice to
  // an opponent. Matching the words alone coloured all three green.
  for (const notAWin of [
    "You can't lose the game due to having 0 or less life",
    'You are unable to lose the game due to damage or lifeloss',
    'On each of your turns, you take an extra turn unless an opponent chooses to lose the game',
  ]) {
    const r = summarizeResults([notAWin])[0];
    assert.strictEqual(r.tier, 'decisive', notAWin);
    assert.strictEqual(r.win, false, notAWin + ' must not be coloured as a win');
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
  assert.deepStrictEqual(out.map((r) => r.tier), ['win', 'decisive', 'decisive', 'decisive', 'decisive']);
  assert.strictEqual(out[0].name, 'Win the game');
  // Within a tier, alphabetical keeps the output stable.
  assert.deepStrictEqual(out.slice(1).map((r) => r.name), [
    'Infinite colorless mana', 'Infinite lifegain', 'Infinite mill', 'Infinite storm count',
  ]);
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
  // Decisive results lead, each tier alphabetical within itself; "Infinite
  // untap of creatures" is plumbing, so it sorts last.
  assert.deepStrictEqual(first, ['Infinite damage', 'Infinite mana', 'Infinite mill', 'Infinite untap']);
});

// ---- which cards carry the combos ------------------------------------------
const { comboPieces } = require('../combos.js');

function v(id, ...cards) {
  return { id, uses: cards.map((name) => ({ card: { name } })) };
}

test('comboPieces: ranks cards by how many combos they hold together', () => {
  const pieces = comboPieces([
    v('1', 'Basalt Monolith', 'Rings of Brighthearth'),
    v('2', 'Basalt Monolith', 'Kinnan, Bonder Prodigy'),
    v('3', 'Basalt Monolith', 'Power Artifact'),
    v('4', 'Palinchron', 'Deadeye Navigator'),
  ]);
  assert.strictEqual(pieces[0].card, 'Basalt Monolith');
  assert.strictEqual(pieces[0].count, 3);
  assert.deepStrictEqual(pieces[0].combos.map((c) => c.id), ['1', '2', '3']);
  assert.ok(pieces.slice(1).every((p) => p.count === 1));
});

test('comboPieces: ties are alphabetical so the order is stable', () => {
  const combos = [v('1', 'Zealous Conscripts', 'Aetherflux Reservoir')];
  const first = comboPieces(combos).map((p) => p.card);
  const second = comboPieces([...combos].reverse()).map((p) => p.card);
  assert.deepStrictEqual(first, ['Aetherflux Reservoir', 'Zealous Conscripts']);
  assert.deepStrictEqual(first, second);
});

test('comboPieces: a card repeated inside one combo counts that combo once', () => {
  const pieces = comboPieces([v('1', 'Dockside Extortionist', 'Dockside Extortionist', 'Temur Sabertooth')]);
  const dockside = pieces.find((p) => p.card === 'Dockside Extortionist');
  assert.strictEqual(dockside.count, 1);
  assert.strictEqual(pieces.length, 2);
});

test('comboPieces: double-faced cards are counted under their front face', () => {
  const pieces = comboPieces([
    v('1', 'Valki, God of Lies // Tibalt, Cosmic Impostor', 'Sol Ring'),
    v('2', 'Valki, God of Lies', 'Maskwood Nexus'),
  ]);
  const valki = pieces.find((p) => p.card === 'Valki, God of Lies');
  assert.strictEqual(valki.count, 2, 'both spellings are the same card');
});

test('comboPieces: no combos means nothing to carry', () => {
  assert.deepStrictEqual(comboPieces([]), []);
  assert.deepStrictEqual(comboPieces(null), []);
});

test('summarizeResults: Lock is yellow, but lookalikes are not', () => {
  assert.strictEqual(summarizeResults(['Lock'])[0].tier, 'decisive');
  assert.strictEqual(summarizeResults(['Locks out all of your opponents but one'])[0].tier, 'decisive');
  // A lock is not unbounded in the "Infinite X" sense, so it sits outside the
  // magnitude gate — which makes these word-boundary cases worth pinning.
  assert.strictEqual(summarizeResults(['Infinite unlocking of Rooms you control'])[0].tier, 'other');
  assert.strictEqual(summarizeResults(["Opponents can't block creatures you control"])[0].tier, 'other');
  assert.strictEqual(summarizeResults(["Creatures can't block"])[0].tier, 'other');
});

// ---- folding a long results list -------------------------------------------
const { splitResults } = require('../combos.js');

const r = (name, tier) => ({ name, tier, why: '', win: tier === 'win' });

test('splitResults: nothing folds when it all fits', () => {
  const all = [r('Win the game', 'win'), r('Infinite mana', 'decisive')];
  const { shown, hidden } = splitResults(all, 8);
  assert.deepStrictEqual(shown.map((x) => x.name), ['Win the game', 'Infinite mana']);
  assert.deepStrictEqual(hidden, []);
});

test('splitResults: grey survives the fold instead of vanishing', () => {
  // Five yellows would otherwise fill every slot and push the plumbing out of
  // sight entirely — grey is meant to be quieter, not invisible.
  const all = [
    r('Win the game', 'win'),
    r('Infinite mana', 'decisive'), r('Infinite damage', 'decisive'),
    r('Infinite tokens', 'decisive'), r('Infinite draw', 'decisive'),
    r('Infinite ETB', 'other'), r('Infinite LTB', 'other'),
  ];
  const { shown, hidden } = splitResults(all, 4);
  assert.strictEqual(shown.length, 4);
  assert.ok(shown.some((x) => x.tier === 'win'), 'the win stays');
  assert.ok(shown.some((x) => x.tier === 'decisive'), 'yellow stays');
  assert.ok(shown.some((x) => x.tier === 'other'), 'grey stays');
  assert.strictEqual(shown.length + hidden.length, all.length, 'nothing is lost');
});

test('splitResults: what is shown stays in tier order', () => {
  const all = [
    r('Win the game', 'win'),
    r('Infinite mana', 'decisive'), r('Infinite damage', 'decisive'),
    r('Infinite ETB', 'other'), r('Infinite LTB', 'other'), r('Infinite death triggers', 'other'),
  ];
  const { shown } = splitResults(all, 4);
  assert.deepStrictEqual(shown.map((x) => x.tier), ['win', 'decisive', 'decisive', 'other']);
});

test('splitResults: handles junk input', () => {
  assert.deepStrictEqual(splitResults(null, 4), { shown: [], hidden: [] });
  assert.deepStrictEqual(splitResults([], 4), { shown: [], hidden: [] });
});
