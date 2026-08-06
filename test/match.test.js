const test = require('node:test');
const assert = require('node:assert');
const {
  matchDeck, deckIdentity, withinIdentity, unrecognizedCards, deckCounts,
  legalityCheck, expand, deckNameSet,
  computeSuggestions,
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

test('splitResults: grey folds, however much room is left', () => {
  // The change this reverses kept one of every tier on screen. Grey is the plumbing a
  // loop runs on and it is the same handful of entries under combo after combo, so it
  // folds now even when the limit would have fitted it.
  const all = [
    r('Win the game', 'win'),
    r('Infinite mana', 'decisive'),
    r('Infinite ETB', 'other'), r('Infinite LTB', 'other'), r('Infinite death triggers', 'other'),
  ];
  const { shown, hidden } = splitResults(all, 8);
  assert.deepStrictEqual(shown.map((x) => x.name), ['Win the game', 'Infinite mana']);
  assert.deepStrictEqual(hidden.map((x) => x.tier), ['other', 'other', 'other']);
  assert.strictEqual(shown.length + hidden.length, all.length, 'nothing is lost');
});

// The case that stops the rule turning a row silent: with nothing louder to show, grey
// is what the combo does, so folding it would leave the row saying nothing at all.
test('splitResults: a combo that only produces plumbing still shows it', () => {
  const all = [r('Infinite ETB', 'other'), r('Infinite LTB', 'other')];
  const { shown, hidden } = splitResults(all, 8);
  assert.deepStrictEqual(shown.map((x) => x.name), ['Infinite ETB', 'Infinite LTB']);
  assert.deepStrictEqual(hidden, []);
});

// The limit still bites on what is left: nine decisive results are a wall of yellow
// whatever the tiers say.
test('splitResults: the limit still applies to the louder tiers', () => {
  const all = [
    r('Win the game', 'win'),
    r('Infinite mana', 'decisive'), r('Infinite damage', 'decisive'),
    r('Infinite tokens', 'decisive'), r('Infinite draw', 'decisive'),
    r('Infinite ETB', 'other'),
  ];
  const { shown, hidden } = splitResults(all, 3);
  assert.strictEqual(shown.length, 3);
  assert.ok(shown.every((x) => x.tier !== 'other'), 'grey does not take a slot from yellow');
  assert.strictEqual(hidden.length, 3, 'the yellow tail folds with the grey');
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

// ---- how many cards, and how many of them are lands -------------------------
//
// Counted by quantity, never by line, and split three ways rather than two: a card the
// data has no type line for cannot be a spell. Every one of these numbers renders just
// as happily when wrong, and the strip invites being checked against a deck site.

const COUNTED = {
  cardIdentity: { 'Sol Ring': '', 'Forest': 'G', 'Ancient Tomb': '', 'Vindicate': 'BW' },
  lands: ['Forest', 'Ancient Tomb'],
  basicLands: ['Forest'],
};

test('deckCounts: counts cards by quantity, not by line', () => {
  const counts = deckCounts(COUNTED, [{ card: 'Forest', quantity: 10 }, { card: 'Sol Ring', quantity: 1 }]);
  assert.equal(counts.cards, 11, 'two lines, eleven cards');
  assert.equal(counts.lands, 10);
  assert.equal(counts.spells, 1);
});

// The sum a reader can check at a glance. It is the property the three-way split exists
// to protect, so it is pinned rather than left to arithmetic on the fields.
test('deckCounts: lands + spells + unread is the card count', () => {
  const counts = deckCounts(COUNTED, [
    { card: 'Forest', quantity: 10 }, { card: 'Ancient Tomb', quantity: 1 },
    { card: 'Sol Ring', quantity: 1 }, { card: 'Vindicate', quantity: 1 },
    { card: 'Sol Rimg', quantity: 2 },
  ]);
  assert.equal(counts.cards, 15);
  assert.equal(counts.lands + counts.spells + counts.unread, counts.cards);
  assert.equal(counts.unread, 2, 'by quantity, like everything else here');
});

test('deckCounts: the basics are a subset of the lands', () => {
  const counts = deckCounts(COUNTED, [{ card: 'Forest', quantity: 9 }, { card: 'Ancient Tomb', quantity: 1 }]);
  assert.equal(counts.lands, 10);
  assert.equal(counts.basic, 9);
  assert.equal(counts.nonbasic, 1);
  assert.equal(counts.basicsKnown, true);
});

// A card missing from the identity map has no type line to read, so it cannot be a
// spell — the land list holds only lands, and "absent from it" would otherwise call
// every misspelling a spell.
test('deckCounts: a card the data has never heard of is neither', () => {
  const counts = deckCounts(COUNTED, [{ card: 'Sol Rimg', quantity: 1 }]);
  assert.equal(counts.unread, 1);
  assert.equal(counts.spells, 0);
  assert.equal(counts.lands, 0);
});

// The two shapes a payload can arrive in that cannot answer, told apart from a deck
// that genuinely plays no lands. DeckView turns `mapped: 0` into silence; the facts
// have to make it visible first.
test('deckCounts: no land list is not a landless deck', () => {
  const counts = deckCounts({ cardIdentity: COUNTED.cardIdentity }, [{ card: 'Forest', quantity: 10 }]);
  assert.equal(counts.cards, 10, 'the card count never depended on the lists');
  assert.equal(counts.mapped, 0);
  const empty = deckCounts({ cardIdentity: COUNTED.cardIdentity, lands: [] }, [{ card: 'Forest', quantity: 10 }]);
  assert.equal(empty.mapped, 0, 'a published empty list is the same "cannot say"');
});

test('deckCounts: no basic list is not a deck without basics', () => {
  const counts = deckCounts({ cardIdentity: COUNTED.cardIdentity, lands: COUNTED.lands },
    [{ card: 'Forest', quantity: 10 }]);
  assert.equal(counts.lands, 10);
  assert.equal(counts.basic, 0);
  assert.equal(counts.basicsKnown, false, 'so the page can drop the split rather than print 0 basic');
});

// nameKey() everywhere, the same as every other comparison in this file: the land list
// is Scryfall's spelling and the deck line is whatever somebody pasted.
test('deckCounts: case and a split card are matched', () => {
  const counts = deckCounts(
    { cardIdentity: { 'Hostile Hostel // Creeping Inn': 'B' }, lands: ['Hostile Hostel // Creeping Inn'] },
    [{ card: 'hostile hostel', quantity: 1 }]
  );
  assert.equal(counts.lands, 1);
  assert.equal(counts.unread, 0);
});

test('deckCounts: an empty deck counts nothing', () => {
  assert.equal(deckCounts(COUNTED, []).cards, 0);
  assert.equal(deckCounts(COUNTED, null).cards, 0);
});

// ---- whether the decklist is allowed ---------------------------------------
//
// Two questions the bracket never asks: is a card outside the commander's colour
// identity, and is a card banned. Facts only here — the wording and the decision to
// say anything at all are DeckView.legalityProse()'s, and tested there.

const LEGAL_DATA = {
  cardIdentity: {
    'Kinnan, Bonder Prodigy': 'GU', 'Basalt Monolith': '', 'Palinchron': 'U',
    'Heliod, Sun-Crowned': 'W', 'Murderous Redcap': 'BR', 'Island': 'U',
  },
  banned: ['Murderous Redcap'],
};
const deck = (commanders, main) => commanders.map((card) => ({ card, commander: true }))
  .concat(main.map((card) => ({ card })));

test('legalityCheck: a card outside the commander identity is named, with its colours', () => {
  const found = legalityCheck(LEGAL_DATA, deck(['Kinnan, Bonder Prodigy'], ['Palinchron', 'Heliod, Sun-Crowned']));
  assert.deepStrictEqual(found.offIdentity, [{ card: 'Heliod, Sun-Crowned', colours: 'W' }]);
  assert.deepStrictEqual(found.allowed, ['G', 'U']);
  assert.equal(found.canCheckIdentity, true);
});

test('legalityCheck: colourless and in-identity cards are not accused', () => {
  const found = legalityCheck(LEGAL_DATA, deck(['Kinnan, Bonder Prodigy'], ['Basalt Monolith', 'Island']));
  assert.deepStrictEqual(found.offIdentity, []);
});

// The identity is the commander's, not the deck's. Reading it off every card would
// make every list legal by construction — the union of the deck's colours always
// contains the deck's colours.
test('legalityCheck: the identity is the commander’s and not the deck’s', () => {
  const found = legalityCheck(LEGAL_DATA, deck(['Kinnan, Bonder Prodigy'], ['Heliod, Sun-Crowned']));
  assert.equal(found.offIdentity.length, 1, 'Heliod does not license his own colour');
});

test('legalityCheck: no commander means the identity question is not answered', () => {
  const found = legalityCheck(LEGAL_DATA, deck([], ['Palinchron', 'Heliod, Sun-Crowned']));
  assert.equal(found.canCheckIdentity, false);
  assert.deepStrictEqual(found.offIdentity, [], 'and nothing is accused on the strength of it');
});

// A commander the map cannot look up has no identity, and every coloured card in the
// deck would read as illegal against an empty one.
test('legalityCheck: a commander the map does not know answers nothing', () => {
  const found = legalityCheck(LEGAL_DATA, deck(['Sol Rimg'], ['Heliod, Sun-Crowned']));
  assert.equal(found.canCheckIdentity, false);
  assert.deepStrictEqual(found.offIdentity, []);
});

// Two commanders, and the identity is the union: a partner pair legally plays both.
test('legalityCheck: partners license the union of their colours', () => {
  const found = legalityCheck(LEGAL_DATA,
    deck(['Kinnan, Bonder Prodigy', 'Heliod, Sun-Crowned'], ['Palinchron', 'Murderous Redcap']));
  assert.deepStrictEqual(found.allowed, ['G', 'U', 'W']);
  assert.deepStrictEqual(found.offIdentity, [{ card: 'Murderous Redcap', colours: 'BR' }]);
});

// A card the map has never heard of is an unknown name, not an illegal card — that is
// the unrecognized-cards notice's business, and one typo must not collect two
// accusations.
test('legalityCheck: an unknown card is not accused of being off-identity', () => {
  const found = legalityCheck(LEGAL_DATA, deck(['Kinnan, Bonder Prodigy'], ['Sol Rimg']));
  assert.deepStrictEqual(found.offIdentity, []);
  assert.equal(found.checked, 0, 'and it does not count as checked either');
});

test('legalityCheck: a banned card is named', () => {
  const found = legalityCheck(LEGAL_DATA, deck(['Kinnan, Bonder Prodigy'], ['Murderous Redcap']));
  assert.deepStrictEqual(found.banned, ['Murderous Redcap']);
  assert.equal(found.hasBanList, true);
});

// A commander can be the banned card, which is why the ban check reads the whole
// list and not just the main deck.
test('legalityCheck: a banned commander counts too', () => {
  const found = legalityCheck(LEGAL_DATA, deck(['Murderous Redcap'], ['Island']));
  assert.deepStrictEqual(found.banned, ['Murderous Redcap']);
});

// No published list means "cannot say", the same rule bracketCheck() uses for the
// Game Changers — not "nothing is banned".
test('legalityCheck: no ban list says so rather than declaring the deck clean', () => {
  const found = legalityCheck({ cardIdentity: LEGAL_DATA.cardIdentity }, deck(['Kinnan, Bonder Prodigy'], ['Murderous Redcap']));
  assert.equal(found.hasBanList, false);
  assert.deepStrictEqual(found.banned, []);
});

test('legalityCheck: no identity map answers neither question', () => {
  const found = legalityCheck({}, deck(['Kinnan, Bonder Prodigy'], ['Heliod, Sun-Crowned']));
  assert.equal(found.mapped, 0);
  assert.equal(found.canCheckIdentity, false);
  assert.deepStrictEqual(found.offIdentity, []);
  assert.equal(found.hasBanList, false);
});
