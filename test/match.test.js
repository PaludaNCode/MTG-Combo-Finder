const test = require('node:test');
const assert = require('node:assert');
const {
  matchDeck, deckIdentity, withinIdentity, unrecognizedCards, expand, deckNameSet, computeSuggestions,
} = require('../combos.js');

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
  return matchDeck(DATASET, deckNameSet(COMMANDERS.concat(DECK)));
}

test('matchDeck: finds combos whose every card is present', () => {
  const ids = run().included.map((c) => c.id);
  assert.deepStrictEqual(ids, ['1']);
});

test('matchDeck: deck identity is the union of the cards played', () => {
  const identity = deckIdentity(DATASET.cardIdentity, deckNameSet(COMMANDERS.concat(DECK)));
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

test('matchDeck: an unknown commander falls back to the colours the deck plays', () => {
  // The deck here is blue and colourless, so white and black suggestions are
  // still off-colour even with no commander to read it from. Previously this
  // gave up and filtered nothing, which put red cards in front of mono-blue
  // decks as though they were castable.
  const commanders = [{ card: 'Some Unreleased Commander' }];
  const result = matchDeck(DATASET, deckNameSet(commanders.concat(DECK)));
  assert.deepStrictEqual([...result.identity].sort(), ['U']);
  assert.ok(result.almostIncludedByAddingColors.length > 0, 'off-colour combos are still separated');
  assert.ok(
    result.almostIncluded.every((c) => !/[WBRG]/.test(String(c.i).replace(/C/g, ''))),
    'nothing outside the deck colours is offered as in-colour'
  );
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
    'Up to three target opponents lose the game',
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
    'Infinite lifegain triggers',
    'Infinite self-mill',
    'Infinite storm count',
    'Infinite colored mana',
    'Infinite Treasure tokens',
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
    'Infinite surveil',
    'Infinite scry 1',
    'Infinite untap of creatures you control',
  ]) {
    assert.strictEqual(summarizeResults([plain])[0].tier, 'other', plain);
  }
});

test('summarizeResults: outcomes that need a payoff are yellow, by explicit request', () => {
  for (const decisive of [
    'Infinite +1/+1 counters on a creature token',
    'Infinite lifegain',
    'Infinite self-mill',
    'Infinite storm count',
    'Infinite blinking',
    'Infinite looting',
    'Infinite rummaging',
    // Every flavour of mana: colourless, colour-specific and generated.
    'Infinite colorless mana',
    'Infinite colored mana',
    'Infinite red mana',
    'Infinite green mana',
    'Infinite mana creatures you control can produce',
    'Infinite mana lands you control can produce',
    'Near-infinite colored mana',
    'Infinite colorless mana that can only be spent to activate abilities',
    // Resource tokens: stored mana, life and cards under another name.
    'Infinite Treasure tokens',
    'Infinite Food tokens',
    'Infinite Clue tokens',
    'Infinite Blood tokens',
    'Near-infinite Treasure tokens',
    'Infinite tapped Treasure tokens',
    'Infinite tapped Forest tokens',
    'Infinite Map tokens',
  ]) {
    const r = summarizeResults([decisive])[0];
    assert.strictEqual(r.tier, 'decisive', decisive);
    assert.ok(r.why.length > 0, decisive + ' should say what it still needs');
  }
});

test('summarizeResults: "nontoken" is not a token', () => {
  // \btokens?\b must not fire on the middle of "nontoken", or loop plumbing
  // would turn yellow along with the resource tokens.
  assert.strictEqual(summarizeResults(['Infinite untap of nontoken creatures you control'])[0].tier, 'other');
  assert.strictEqual(summarizeResults(['Infinite untap of nontoken artifacts you control'])[0].tier, 'other');
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
    'Infinite ETB',
  ]);
  assert.deepStrictEqual(out.map((r) => r.tier), ['win', 'decisive', 'decisive', 'decisive', 'other']);
  assert.strictEqual(out[0].name, 'Win the game');
  // Within a tier, alphabetical keeps the output stable.
  assert.deepStrictEqual(out.slice(1).map((r) => r.name), [
    'Infinite colorless mana', 'Infinite lifegain', 'Infinite storm count', 'Infinite ETB',
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
  assert.deepStrictEqual(summarizeResults(['', '   ', null, undefined, 'Infinite colored mana']).map((r) => r.name), ['Infinite colored mana']);
  assert.deepStrictEqual(summarizeResults([]), []);
  assert.deepStrictEqual(summarizeResults(null), []);
});

test('summarizeResults: ordering is stable regardless of input order', () => {
  const names = ['Infinite lifegain', 'Infinite storm count', 'Infinite untap', 'Infinite colored mana'];
  const first = summarizeResults(names).map((r) => r.name);
  const second = summarizeResults([...names].reverse()).map((r) => r.name);
  assert.deepStrictEqual(first, second);
  // Decisive results lead, each tier alphabetical within itself; "Infinite
  // untap of creatures" is plumbing, so it sorts last.
  assert.deepStrictEqual(first, ['Infinite colored mana', 'Infinite lifegain', 'Infinite storm count', 'Infinite untap']);
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
  // The combos under a card are re-sorted rather than left in the order they arrived:
  // smallest first, then alphabetically by their cards. All three are two-card here,
  // so it comes down to the names — Kinnan, then Power Artifact, then Rings.
  assert.deepStrictEqual(pieces[0].combos.map((c) => c.id), ['2', '3', '1']);
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
  assert.strictEqual(summarizeResults([
    'Locks out all of your opponents but one, and allows you to choose which of your two neighboring opponents get to have turns',
  ])[0].tier, 'decisive');
  // Named outcomes that merely contain the letters "lock" are grey, and stay
  // grey because nothing reads their wording any more.
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

// Colours come from the cards, full stop. There is no commander in this any
// more: the deck's own list answers the question and cannot be wrong about it.
test('deckIdentity: the colours are the ones the deck plays', () => {
  const identities = { 'Swords to Plowshares': 'W', 'Vindicate': 'BW', 'Sol Ring': '' };
  const deck = new Set(['swords to plowshares', 'vindicate', 'sol ring']);
  assert.deepStrictEqual([...deckIdentity(identities, deck)].sort(), ['B', 'W']);
});

// A commander is a card in the deck like any other, so its colours are counted
// with the rest — no special case, and no way for it to be missed.
test('deckIdentity: a commander counts because it is one of the cards', () => {
  const identities = { 'Karador, Ghost Chieftain': 'BGW', 'Island': 'U' };
  const withKarador = deckIdentity(identities, new Set(['karador, ghost chieftain', 'island']));
  assert.deepStrictEqual([...withKarador].sort(), ['B', 'G', 'U', 'W']);
});

// The colour a commander permits but the deck never plays is simply not there.
// Accepted: it describes the list as pasted, and the suggestion still shows —
// under "other colours" rather than "in your colours".
test('deckIdentity: a colour the deck plays none of is not in its identity', () => {
  const identities = { 'Karador, Ghost Chieftain': 'BGW', 'Swamp': 'B' };
  const id = deckIdentity(identities, new Set(['swamp']));
  assert.deepStrictEqual([...id].sort(), ['B']);
});

test('deckIdentity: colourless cards do not add a colour', () => {
  const id = deckIdentity({ 'Sol Ring': '', 'Swamp': 'B' }, new Set(['sol ring', 'swamp']));
  assert.deepStrictEqual([...id].sort(), ['B']);
});

test('deckIdentity: nothing recognisable means do not filter', () => {
  assert.strictEqual(deckIdentity({ 'Vindicate': 'BW' }, new Set(['nothing we know'])), null);
  assert.strictEqual(deckIdentity(null, new Set(['vindicate'])), null);
});

test('withinIdentity: a three-colour deck accepts any pair inside it', () => {
  const abzan = new Set(['B', 'G', 'W']);
  for (const ci of ['', 'C', 'W', 'B', 'G', 'BW', 'GW', 'BG', 'BGW']) {
    assert.strictEqual(withinIdentity({ i: ci }, abzan), true, ci || 'colourless');
  }
  for (const ci of ['R', 'U', 'BR', 'GU', 'WUBRG']) {
    assert.strictEqual(withinIdentity({ i: ci }, abzan), false, ci);
  }
});

// ---- the cards the identity map has never heard of --------------------------
//
// The same lookup deckIdentity() does, keeping the misses. `1 Sol Rimg` parses as a
// card line by every rule in parser.js, so it reaches the search and matches nothing;
// without this it is never mentioned again.

const IDENTITIES = { 'Sol Ring': '', 'Swamp': 'B', 'Vindicate': 'BW' };
const entries = (...names) => names.map((card) => ({ card }));

test('unrecognizedCards: a name the map has never heard of is kept', () => {
  const found = unrecognizedCards(IDENTITIES, entries('Sol Ring', 'Sol Rimg', 'Swamp'));
  assert.deepStrictEqual(found.names, ['Sol Rimg']);
  assert.equal(found.checked, 3);
  assert.equal(found.mapped, 3, 'the size of the map, so the page can tell thin from broken');
});

test('unrecognizedCards: the spelling kept is the one that was typed', () => {
  const found = unrecognizedCards(IDENTITIES, entries('SOL RIMG'));
  assert.deepStrictEqual(found.names, ['SOL RIMG']);
});

// Case and the second face are not misses: the lookup is nameKey()'d, the same as
// every other comparison here.
test('unrecognizedCards: case and a split card are recognised', () => {
  const found = unrecognizedCards({ 'Valki, God of Lies // Tibalt, Cosmic Impostor': 'BR' },
    entries('valki, god of lies', 'VALKI, GOD OF LIES'));
  assert.deepStrictEqual(found.names, []);
  assert.equal(found.checked, 1, 'the same card twice is one card');
});

test('unrecognizedCards: the same unknown card twice is reported once', () => {
  const found = unrecognizedCards(IDENTITIES, entries('Sol Rimg', 'Sol Rimg'));
  assert.deepStrictEqual(found.names, ['Sol Rimg']);
  assert.equal(found.checked, 1);
});

// No map is not "everything is unknown" — it is a question that cannot be answered.
// The facts still say so honestly; DeckView is what turns `mapped: 0` into silence.
test('unrecognizedCards: with no map at all, nothing has been checked against anything', () => {
  const found = unrecognizedCards(null, entries('Sol Ring', 'Sol Rimg'));
  assert.equal(found.mapped, 0);
  assert.equal(found.names.length, 2);
});

test('unrecognizedCards: an empty deck reports nothing', () => {
  assert.deepStrictEqual(unrecognizedCards(IDENTITIES, []).names, []);
  assert.deepStrictEqual(unrecognizedCards(IDENTITIES, null).names, []);
});
