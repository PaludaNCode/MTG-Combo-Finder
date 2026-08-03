// Collapsing interchangeable cards. Spellbook stores one variant per concrete
// card list, so "Spike Feeder + 1 of 8 cards" reaches us as eight rows; left
// alone that reads as eight recommendations instead of one choice.
const test = require('node:test');
const assert = require('node:assert');
const {
  groupSuggestions, groupVariants, interchangeableIn, orderComboNames,
  computeSuggestions, deckNameSet, variantSignature,
} = require('../combos.js');

// The real shape: cards under `uses`, results under `produces`.
const variant = (id, cards, produces) => ({
  id,
  uses: cards.map((name) => ({ card: { name } })),
  produces: produces.map((name) => ({ feature: { name } })),
});

test('groupSuggestions: cards unlocking exactly the same combos become one row', () => {
  // Spike Feeder is in the deck; four different partners each finish the combo.
  const deck = deckNameSet([{ card: 'Spike Feeder' }]);
  const almost = [
    variant('a', ['Spike Feeder', 'Heliod, Sun-Crowned'], ['Infinite lifegain']),
    variant('b', ['Spike Feeder', 'Cleric Class'], ['Infinite lifegain']),
    variant('c', ['Spike Feeder', 'Light of Promise'], ['Infinite lifegain']),
  ];
  const groups = groupSuggestions(computeSuggestions(almost, deck), deck);

  assert.strictEqual(groups.length, 1, 'three interchangeable cards are one decision');
  assert.deepStrictEqual(groups[0].cards, ['Cleric Class', 'Heliod, Sun-Crowned', 'Light of Promise']);
  assert.strictEqual(groups[0].unlocks.length, 1);
});

test('groupSuggestions: a card that unlocks more is not folded in with one that unlocks less', () => {
  const deck = deckNameSet([{ card: 'Spike Feeder' }, { card: 'Walking Ballista' }]);
  const almost = [
    // Heliod finishes two different combos; Cleric Class only one.
    variant('a', ['Spike Feeder', 'Heliod, Sun-Crowned'], ['Infinite lifegain']),
    variant('b', ['Walking Ballista', 'Heliod, Sun-Crowned'], ['Infinite damage']),
    variant('c', ['Spike Feeder', 'Cleric Class'], ['Infinite lifegain']),
  ];
  const groups = groupSuggestions(computeSuggestions(almost, deck), deck);

  assert.strictEqual(groups.length, 2);
  assert.deepStrictEqual(groups[0].cards, ['Heliod, Sun-Crowned'], 'most combos first');
  assert.strictEqual(groups[0].unlocks.length, 2);
  assert.deepStrictEqual(groups[1].cards, ['Cleric Class']);
});

test('groupSuggestions: same partner but different results is not the same combo', () => {
  const deck = deckNameSet([{ card: 'Spike Feeder' }]);
  const almost = [
    variant('a', ['Spike Feeder', 'Heliod, Sun-Crowned'], ['Infinite lifegain']),
    variant('b', ['Spike Feeder', 'Cleric Class'], ['Infinite damage']),
  ];
  const groups = groupSuggestions(computeSuggestions(almost, deck), deck);
  assert.strictEqual(groups.length, 2, 'different payoffs are different decisions');
});

test('groupSuggestions: every suggested card survives, exactly once', () => {
  const deck = deckNameSet([{ card: 'A' }, { card: 'B' }]);
  const almost = [
    variant('1', ['A', 'X'], ['Infinite lifegain']),
    variant('2', ['A', 'Y'], ['Infinite lifegain']),
    variant('3', ['B', 'Z'], ['Infinite damage']),
    variant('4', ['A', 'Z'], ['Infinite mill']),
  ];
  const suggestions = computeSuggestions(almost, deck);
  const groups = groupSuggestions(suggestions, deck);

  const before = suggestions.map((s) => s.card).sort();
  const after = groups.flatMap((g) => g.cards).sort();
  assert.deepStrictEqual(after, before, 'grouping must not lose or duplicate a card');
});

test('groupSuggestions: no suggestions, no groups', () => {
  assert.deepStrictEqual(groupSuggestions([], deckNameSet([])), []);
  assert.deepStrictEqual(groupSuggestions(null, deckNameSet([])), []);
});

test('variantSignature: the same combo with one slot filled differently matches', () => {
  const deck = deckNameSet([{ card: 'Spike Feeder' }]);
  const a = variant('a', ['Spike Feeder', 'Heliod, Sun-Crowned'], ['Infinite lifegain']);
  const b = variant('b', ['Spike Feeder', 'Cleric Class'], ['Infinite lifegain']);
  const c = variant('c', ['Spike Feeder', 'Cleric Class'], ['Infinite damage']);
  assert.strictEqual(variantSignature(a, deck), variantSignature(b, deck));
  assert.notStrictEqual(variantSignature(a, deck), variantSignature(c, deck));
});

// ---- combos you already have ----------------------------------------------

test('groupVariants: variants differing in one card collapse into a choice', () => {
  const groups = groupVariants([
    variant('1', ['Scurry Oak', 'Archangel of Thune', 'Soul Warden'], ['Infinite creature tokens']),
    variant('2', ['Scurry Oak', 'Archangel of Thune', 'Essence Warden'], ['Infinite creature tokens']),
    variant('3', ['Scurry Oak', 'Archangel of Thune', 'Prosperous Innkeeper'], ['Infinite creature tokens']),
  ]);

  assert.strictEqual(groups.length, 1);
  assert.deepStrictEqual(groups[0].shared.sort(), ['Archangel of Thune', 'Scurry Oak']);
  assert.deepStrictEqual(groups[0].choices.sort(),
    ['Essence Warden', 'Prosperous Innkeeper', 'Soul Warden']);
  assert.strictEqual(groups[0].variants.length, 3);
});

test('groupVariants: an unrelated combo stands on its own', () => {
  const groups = groupVariants([
    variant('1', ['A', 'B'], ['Infinite lifegain']),
    variant('2', ['A', 'C'], ['Infinite lifegain']),
    variant('3', ['X', 'Y'], ['Infinite damage']),
  ]);
  assert.strictEqual(groups.length, 2);
  const alone = groups.find((g) => !g.choices.length);
  assert.deepStrictEqual(alone.shared, ['X', 'Y']);
  assert.strictEqual(alone.variants.length, 1);
});

test('groupVariants: every variant lands in exactly one group', () => {
  const variants = [
    variant('1', ['A', 'B'], ['Infinite lifegain']),
    variant('2', ['A', 'C'], ['Infinite lifegain']),
    variant('3', ['A', 'D'], ['Infinite lifegain']),
    variant('4', ['B', 'C'], ['Infinite lifegain']),
    variant('5', ['Z'], ['Infinite mill']),
  ];
  const groups = groupVariants(variants);
  const ids = groups.flatMap((g) => g.variants.map((v) => v.id)).sort();
  assert.deepStrictEqual(ids, ['1', '2', '3', '4', '5'], 'nothing lost, nothing counted twice');
});

test('groupVariants: the result does not depend on input order', () => {
  const variants = [
    variant('1', ['A', 'B'], ['Infinite lifegain']),
    variant('2', ['A', 'C'], ['Infinite lifegain']),
    variant('3', ['A', 'D'], ['Infinite lifegain']),
  ];
  const shape = (gs) => gs.map((g) => [g.shared.slice().sort(), g.choices.slice().sort()]);
  assert.deepStrictEqual(shape(groupVariants(variants)), shape(groupVariants(variants.slice().reverse())));
});

test('groupVariants: same cards, different results, stays separate', () => {
  const groups = groupVariants([
    variant('1', ['A', 'B'], ['Infinite lifegain']),
    variant('2', ['A', 'C'], ['Infinite damage']),
  ]);
  assert.strictEqual(groups.length, 2, 'a different payoff is a different combo');
  assert.ok(groups.every((g) => !g.choices.length));
});

test('groupVariants: nothing in, nothing out', () => {
  assert.deepStrictEqual(groupVariants([]), []);
  assert.deepStrictEqual(groupVariants(null), []);
});

// ---- what a nested list's rows differ by ------------------------------------
//
// The same relation, asked one row at a time, for the lists that are drawn as
// separate rows rather than collapsed: a suggestion's combos and a piece's combos.
// Those rows are compared against each other just as closely as a collapsed
// group's versions are, and until this existed every one of them was alphabetical.

test('interchangeableIn: every row of a family learns what varies across it', () => {
  const variants = [
    variant('1', ['Chatterfang, Squirrel General', 'Warren Soultrader', 'Essence Warden'], ['Infinite lifegain']),
    variant('2', ['Chatterfang, Squirrel General', 'Warren Soultrader', 'Soul Warden'], ['Infinite lifegain']),
    variant('3', ['Chatterfang, Squirrel General', 'Warren Soultrader', 'Aunt May'], ['Infinite lifegain']),
  ];
  const trails = interchangeableIn(variants);
  assert.strictEqual(trails.size, 3, 'every row of the family is in the lookup');
  for (const v of variants) {
    assert.deepStrictEqual(
      trails.get(v).slice().sort(),
      ['Aunt May', 'Essence Warden', 'Soul Warden'],
      `row ${v.id} did not learn the whole set of choices`
    );
  }
});

test('interchangeableIn: a row with nothing to compare against gets no trail', () => {
  const alone = variant('1', ['A', 'B'], ['Infinite mill']);
  const trails = interchangeableIn([alone]);
  assert.strictEqual(trails.get(alone), undefined, 'one row is not a family');
  // Which is the case the render side hands to orderComboNames() as `undefined`,
  // and it has to mean "alphabetical" rather than throwing.
  assert.deepStrictEqual(orderComboNames(['B', 'A'], { trail: trails.get(alone) }), ['A', 'B']);
});

// The screenshot that prompted this: a nested list under Chatterfang, whose rows
// differed only in the gainer and named it in the middle on every line. Asserted as
// the drawn strings, because that is the thing that was wrong.
test('interchangeableIn: a lead-first list still sends the card that changes last', () => {
  const lead = 'Chatterfang, Squirrel General';
  const variants = [
    variant('1', [lead, 'Warren Soultrader', 'Essence Warden'], ['Infinite lifegain']),
    variant('2', [lead, 'Warren Soultrader', 'Lunarch Veteran // Luminous Phantom'], ['Infinite lifegain']),
    variant('3', [lead, 'Warren Soultrader', 'Soul Warden'], ['Infinite lifegain']),
  ];
  const trails = interchangeableIn(variants);
  const drawn = variants.map((v) => orderComboNames(
    v.uses.map((u) => u.card.name), { lead, trail: trails.get(v) }
  ).join(' + '));

  assert.deepStrictEqual(drawn, [
    'Chatterfang, Squirrel General + Warren Soultrader + Essence Warden',
    'Chatterfang, Squirrel General + Warren Soultrader + Lunarch Veteran // Luminous Phantom',
    'Chatterfang, Squirrel General + Warren Soultrader + Soul Warden',
  ]);
  // The invariant the shape rests on, stated once: every row of the list opens with
  // the card it is listed under and closes with the card that makes it this row.
  drawn.forEach((line) => {
    assert.ok(line.startsWith(lead), `"${line}" does not lead with the card it is under`);
    assert.ok(line.includes(' + Warren Soultrader + '), `"${line}" moved the shared card`);
  });
});
