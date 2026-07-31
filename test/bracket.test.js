'use strict';
const test = require('node:test');
const assert = require('node:assert');
const DeckCombos = require('../combos.js');

// Wizards' bracket system rates a deck 1–5. Two of its criteria are properties of
// a card list — the Game Changers in it, and whether it can assemble a two-card
// combo that ends the game — and those are the two checked here. Everything else
// about a bracket is a judgement call, so what comes back is the lowest bracket
// the list is still eligible for, never a verdict.
//
// The tests worth having are the boundaries (three Game Changers versus four) and
// the things that must *not* count: a two-card combo that only makes mana, a
// three-card win, a Game Changer nobody is playing.

const deck = (...names) => DeckCombos.deckNameSet(names.map((card) => ({ card, quantity: 1 })));

const CHANGERS = ['Rhystic Study', 'Smothering Tithe', 'Cyclonic Rift', 'Necropotence', 'The One Ring'];
const dataset = (gameChangers) => ({ gameChangers });

// Combos arrive here after expand(), which is the shape the page renders.
const combo = (cards, results, fills) => ({
  id: cards.join('+'),
  uses: cards.map((name) => ({ card: { name } })),
  produces: results.map((name) => ({ feature: { name } })),
  fills,
});

// Both names are real results, and both are taken from result-tiers.js rather than
// invented: green is what "ends the game" means here, and a made-up result would
// fall to grey and quietly pass every test below.
const WIN = 'Win the game';             // green
const MANA = 'Infinite colorless mana'; // yellow — something else still has to convert it

test('a dataset with no Game Changer list cannot answer at all', () => {
  // Half a check is worse than none: a deck full of Game Changers would read as
  // bracket 3 on the strength of its combos alone.
  assert.equal(DeckCombos.bracketCheck({}, deck('Rhystic Study'), []), null);
  assert.equal(DeckCombos.bracketCheck(dataset([]), deck('Rhystic Study'), []), null);
  assert.equal(DeckCombos.bracketCheck(null, deck('Rhystic Study'), []), null);
});

test('nothing to report leaves brackets 1 and 2 open', () => {
  const out = DeckCombos.bracketCheck(dataset(CHANGERS), deck('Sol Ring', 'Llanowar Elves'), []);
  assert.equal(out.floor, 2);
  assert.deepEqual(out.gameChangers, []);
  assert.deepEqual(out.twoCardWins, []);
});

test('one Game Changer puts the floor at 3', () => {
  const out = DeckCombos.bracketCheck(dataset(CHANGERS), deck('Sol Ring', 'Rhystic Study'), []);
  assert.equal(out.floor, 3);
  assert.deepEqual(out.gameChangers, ['Rhystic Study']);
});

test('three is bracket 3’s allowance and four is past it', () => {
  const three = deck('Rhystic Study', 'Smothering Tithe', 'Cyclonic Rift');
  assert.equal(DeckCombos.bracketCheck(dataset(CHANGERS), three, []).floor, 3);

  const four = deck('Rhystic Study', 'Smothering Tithe', 'Cyclonic Rift', 'Necropotence');
  const out = DeckCombos.bracketCheck(dataset(CHANGERS), four, []);
  assert.equal(out.floor, 4);
  // Alphabetical, and only the ones actually in the deck.
  assert.deepEqual(out.gameChangers,
    ['Cyclonic Rift', 'Necropotence', 'Rhystic Study', 'Smothering Tithe']);
});

test('a two-card combo that ends the game puts the floor at 3 on its own', () => {
  const out = DeckCombos.bracketCheck(
    dataset(CHANGERS),
    deck('Thassa\'s Oracle', 'Demonic Consultation'),
    [combo(['Thassa\'s Oracle', 'Demonic Consultation'], [WIN])]
  );
  assert.equal(out.floor, 3);
  assert.equal(out.twoCardWins.length, 1);
  assert.deepEqual(out.gameChangers, []);
});

test('a two-card combo that only makes mana is not a two-card win', () => {
  // "Two-card infinite combo" in Wizards' wording is a two-card line that wins.
  // Basalt Monolith + Rings of Brighthearth loops all day and wins nothing.
  const out = DeckCombos.bracketCheck(
    dataset(CHANGERS),
    deck('Basalt Monolith', 'Rings of Brighthearth'),
    [combo(['Basalt Monolith', 'Rings of Brighthearth'], [MANA])]
  );
  assert.equal(out.floor, 2);
  assert.deepEqual(out.twoCardWins, []);
});

test('a three-card win is not a two-card combo', () => {
  const out = DeckCombos.bracketCheck(
    dataset(CHANGERS),
    deck('Scurry Oak', 'Archangel of Thune', 'Soul Warden'),
    [combo(['Scurry Oak', 'Archangel of Thune', 'Soul Warden'], [WIN])]
  );
  assert.equal(out.floor, 2);
});

test('a filled slot counts as one of the two cards', () => {
  // Something has to occupy the slot, and the deck is what occupies it — the same
  // rule comboSize() follows. One named card plus one slot is two cards on the
  // table, so a win off that pair is a two-card win.
  const out = DeckCombos.bracketCheck(
    dataset(CHANGERS),
    deck('Rings of Brighthearth', 'Kitchen Finks'),
    [combo(['Rings of Brighthearth'], [WIN], [{ slot: 'a Persist Creature', card: 'Kitchen Finks' }])]
  );
  assert.equal(out.floor, 3);
  assert.equal(out.twoCardWins.length, 1);
});

test('Game Changers are matched the way every other card name is', () => {
  // Lowercased, front face only — a decklist writes "Valki, God of Lies" where
  // the published list has the whole double-faced name.
  const out = DeckCombos.bracketCheck(
    dataset(['Valki, God of Lies // Tibalt, Cosmic Impostor', 'rhystic study']),
    deck('VALKI, GOD OF LIES', 'Rhystic Study'),
    []
  );
  assert.equal(out.floor, 3);
  assert.deepEqual(out.gameChangers, ['rhystic study', 'Valki, God of Lies']);
});

test('the count is of Game Changers held, not of the list', () => {
  const out = DeckCombos.bracketCheck(dataset(CHANGERS), deck('Sol Ring'), []);
  assert.equal(out.gameChangers.length, 0, 'a list of five is not five in the deck');
});

// ---- the list arriving at all ---------------------------------------------
//
// The Game Changer list is read off Scryfall's `game_changer` flag rather than
// kept in this repo, so it cannot go stale — but it can go *away*, if that field
// is ever renamed. What happens then is nothing: bracketCheck() returns null and
// the panel is not drawn, which looks exactly like a deck with nothing to report.
// So the data refresh says so, loudly, and this is that.
const { reportGameChangers, GAME_CHANGERS_EXPECTED } = require('../tools/fetch-combos.js');

function captureGameChangers(names) {
  const lines = [];
  const real = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try {
    reportGameChangers(names);
  } finally {
    console.log = real;
  }
  return lines.join('\n');
}

test('a plausible Game Changer list is reported as a count', () => {
  const out = captureGameChangers(new Array(GAME_CHANGERS_EXPECTED + 33).fill('Rhystic Study'));
  assert.match(out, new RegExp(`Read ${GAME_CHANGERS_EXPECTED + 33} Game Changers`));
  assert.doesNotMatch(out, /expected at least/);
});

test('an empty Game Changer list says the field may have moved', () => {
  const out = captureGameChangers([]);
  assert.match(out, /Only 0 card\(s\)/);
  assert.match(out, /game_changer/);
  assert.match(out, /scryfall\.com\/docs\/api\/cards/);
});

test('a suspiciously short list is treated the same as an empty one', () => {
  const out = captureGameChangers(['Rhystic Study', 'Smothering Tithe']);
  assert.match(out, /expected at least/);
});

// The boundary itself, so "at least N" means N and not N-1.
test('the threshold warns one short and stays quiet on the number', () => {
  const short = captureGameChangers(new Array(GAME_CHANGERS_EXPECTED - 1).fill('Rhystic Study'));
  assert.match(short, /expected at least/);
  const exact = captureGameChangers(new Array(GAME_CHANGERS_EXPECTED).fill('Rhystic Study'));
  assert.doesNotMatch(exact, /expected at least/);
});

// The tests above all derive from the constant, so they pass at any value it takes —
// including the 20 this started at, which was set before the real size of Wizards' list
// was known and would have let a flag that had half stopped working through: 21 of 53
// flagged cards would have been reported as fine.
//
// So the value gets pinned, not just the comparison. The band is deliberate rather than
// exact: 53 is the count as of the 9 February 2026 bracket update and Wizards revise the
// list with every one, so a threshold equal to it would fail the first time they trim a
// card, and one below ~two-thirds of it stops being a check at all.
const OFFICIAL_GAME_CHANGERS_2026_02_09 = 53;
test('the threshold is a real check against the size of the published list', () => {
  assert.ok(
    GAME_CHANGERS_EXPECTED >= Math.floor(OFFICIAL_GAME_CHANGERS_2026_02_09 * 0.66),
    `${GAME_CHANGERS_EXPECTED} is too low to catch a half-broken flag against a list of `
      + `${OFFICIAL_GAME_CHANGERS_2026_02_09}`
  );
  assert.ok(
    GAME_CHANGERS_EXPECTED < OFFICIAL_GAME_CHANGERS_2026_02_09,
    `${GAME_CHANGERS_EXPECTED} leaves no headroom for Wizards trimming the list`
  );
});

// The log has to be actionable on its own: whoever reads a failed refresh should not
// have to come back here to learn what the number ought to be.
test('the warning says how long the official list is', () => {
  const out = captureGameChangers([]);
  assert.match(out, new RegExp(String(OFFICIAL_GAME_CHANGERS_2026_02_09)));
});
