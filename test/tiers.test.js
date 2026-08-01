// The tier inventory is hand-maintained data, so the tests that matter are the
// ones a careless edit would trip: a name in two tiers, a duplicate, a stray
// blank. Nothing here reads wording — that is the point of the file.
const test = require('node:test');
const assert = require('node:assert');
const TIERS = require('../result-tiers.js');
const { summarizeResults } = require('../combos.js');

function names(groups) {
  return groups.flatMap(([, list]) => list);
}

const WIN = names(TIERS.WIN);
const DECISIVE = names(TIERS.DECISIVE);
const ALL = WIN.concat(DECISIVE, TIERS.OTHER);

test('tiers: nothing is listed twice, anywhere', () => {
  const seen = new Map();
  for (const name of ALL) {
    const key = name.trim().toLowerCase();
    assert.ok(!seen.has(key), `"${name}" is listed twice (also as "${seen.get(key)}")`);
    seen.set(key, name);
  }
  assert.strictEqual(seen.size, TIERS.size, 'the lookup index lost entries to collisions');
});

test('tiers: every entry is a real, non-blank name', () => {
  for (const name of ALL) {
    assert.strictEqual(typeof name, 'string');
    assert.ok(name.trim().length > 0, 'a blank entry would swallow every blank result');
    assert.strictEqual(name, name.trim(), `"${name}" has stray whitespace`);
  }
});

test('tiers: every green and yellow group states its reason', () => {
  for (const [why, list] of TIERS.WIN.concat(TIERS.DECISIVE)) {
    assert.ok(typeof why === 'string' && why.length > 10, `a group has no usable reason: ${why}`);
    assert.ok(list.length > 0, `the "${why}" group is empty`);
  }
});

test('tiers: an outcome nobody has classified is grey, not a guess', () => {
  // The cost of an explicit list: a result Spellbook adds later matches nothing.
  // Falling to grey is the intended behaviour, not an accident.
  const r = summarizeResults(['Infinite something Wizards has not printed yet'])[0];
  assert.strictEqual(r.tier, 'other');
  assert.strictEqual(r.why, '');
});

test('tiers: lookup ignores case and stray spacing', () => {
  assert.strictEqual(TIERS.tierOf('INFINITE TURNS').tier, 'win');
  assert.strictEqual(TIERS.tierOf('  infinite   turns  ').tier, 'win');
});

// The classifications asked for by name. If one of these ever flips, it was an
// edit to the inventory, and the test says exactly which line to look at.
test('tiers: the calls made on each outcome, pinned', () => {
  const expected = [
    // Wins, including the lowered bar: an unbounded board or unbounded damage.
    ['Win the game', 'win'],
    ['Each opponent loses the game', 'win'],
    ['Infinite turns', 'win'],
    ['Near-infinite turns', 'win'],
    ['Infinite creature tokens', 'win'],
    ['Infinite creature tokens with haste', 'win'],
    ['Near-infinite tapped creature tokens', 'win'],
    ['Infinite lifeloss', 'win'],
    ['Near-infinite lifeloss', 'win'],
    ['Infinite damage', 'win'],
    ['Near-infinite damage', 'win'],
    ['Infinite combat damage', 'win'],
    ['Infinite +1/+1 counters on creatures you control', 'win'],
    ['Infinite +1/+1 counters on most creatures you control', 'win'],
    ['Infinitely large creatures you control until end of turn', 'win'],
    ['Infinite draw triggers for any number of opponents', 'win'],
    // The lowered bar, second pass: one huge creature, unlimited cards,
    // unlimited attacks, milling out, and the dungeon.
    ['Infinite +1/+1 counters on a creature', 'win'],
    ['Near-infinite +1/+1 counters on a creature', 'win'],
    ['Infinitely large creature until end of turn', 'win'],
    ['Infinitely powerful creature until end of turn', 'win'],
    ['Infinite card draw', 'win'],
    ['Infinite draw triggers', 'win'],
    ['Near-infinite card draw', 'win'],
    ['Infinite combat phases', 'win'],
    ['Near-infinite combat phases', 'win'],
    ['Infinite mill', 'win'],
    ['Infinite ventures into the dungeon', 'win'],
    ['Near-infinite ventures into the dungeon', 'win'],

    // Deliberately not wins — each of these is one word away from one above.
    ['Infinite turns for each opponent', 'decisive'],
    ['Infinite creature tokens for target opponent', 'decisive'],
    ['Near-infinite lifeloss for all players', 'decisive'],
    ['Infinite damage to creatures', 'decisive'],

    // Yellow: value that still needs converting.
    ['Infinite colored mana', 'decisive'],
    ['Infinite Treasure tokens', 'decisive'],
    ['Infinite Food tokens', 'decisive'],
    ['Infinite Clue tokens', 'decisive'],
    ['Infinite lifegain', 'decisive'],
    ['Infinite self-mill', 'decisive'],
    ['Infinite blinking', 'decisive'],
    ['Infinite looting', 'decisive'],
    ['Infinite rummaging', 'decisive'],
    ['Infinite landfall triggers', 'decisive'],
    ['Infinite magecraft triggers', 'decisive'],
    ['Infinite untap of lands you control', 'decisive'],
    ['Lock', 'decisive'],

    // Grey: loop plumbing.
    ['Infinite ETB', 'other'],
    ['Infinite LTB', 'other'],
    ['Infinite death triggers', 'other'],
    ['Infinite sacrifice triggers', 'other'],
  ];
  for (const [name, tier] of expected) {
    assert.strictEqual(TIERS.tierOf(name).tier, tier, name);
  }
});

// Two outcomes that read as plumbing and are not. Neither says "infinite", which
// is what kept them grey, but the question a tier answers is whether the game is
// over — not whether the number is. A hundred-card singleton deck put into your
// hands at once holds whatever you built it to win with.
//
// Pinned by name because that is what the file is: moving one outcome between
// tiers is moving one string, and this is the string.
test('tiers: your whole library, all at once, is green', () => {
  for (const name of [
    'Exile your library with the ability to play the exiled cards until your next turn',
    'Put all creature cards from your library onto the battlefield',
  ]) {
    const { tier, why } = TIERS.tierOf(name);
    assert.strictEqual(tier, 'win', `"${name}" is ${tier}, not green`);
    assert.ok(why.length > 10, `"${name}" is green without saying why`);
  }
});

// ...and the neighbours it would be easy to sweep up with them, which are grey on
// purpose. Into your hand still costs the mana to cast them; exiling your library
// with no way to play the cards is a drawback; and putting your creatures onto the
// battlefield only to bin them is a graveyard filler, not a board.
test('tiers: the near-identical wordings around them stay grey', () => {
  for (const name of [
    'Exile your library',
    'Put all creature cards from your library into your hand',
    'Put all creature cards in your library onto the battlefield, then into your graveyard',
  ]) {
    assert.strictEqual(TIERS.tierOf(name).tier, 'other', `"${name}" was swept into another tier`);
  }
});
