// Collapsing interchangeable cards. Spellbook stores one variant per concrete
// card list, so "Spike Feeder + 1 of 8 cards" reaches us as eight rows; left
// alone that reads as eight recommendations instead of one choice.
const test = require('node:test');
const assert = require('node:assert');
const {
  groupSuggestions, groupVariants, COLLAPSE_FROM, interchangeableIn, orderComboNames,
  computeSuggestions, deckNameSet, variantSignature, variantCardNames,
} = require('../combos.js');

// n versions of one combo: the same shared cards, a different last card on each.
//
// Written against COLLAPSE_FROM rather than a literal, so moving the threshold does not
// mean rewriting the suite around it — the tests below say "one short of the threshold"
// and "at the threshold", which is what they are actually about. One test pins the number
// itself, because a suite that only ever asks that would happily follow the constant
// anywhere, including somewhere nobody chose.
const family = (shared, results, n, tag) => Array.from({ length: n }, (_, i) =>
  variant(`${tag}${i}`, shared.concat(`${tag}-${i}`), results));

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
  const groups = groupVariants(
    family(['Scurry Oak', 'Archangel of Thune'], ['Infinite creature tokens'], COLLAPSE_FROM, 'w')
  );

  assert.strictEqual(groups.length, 1);
  assert.deepStrictEqual(groups[0].shared.sort(), ['Archangel of Thune', 'Scurry Oak']);
  assert.strictEqual(groups[0].choices.length, COLLAPSE_FROM);
  assert.strictEqual(groups[0].variants.length, COLLAPSE_FROM);
});

test('groupVariants: an unrelated combo stands on its own', () => {
  const groups = groupVariants(
    family(['A'], ['Infinite lifegain'], COLLAPSE_FROM, 'a')
      .concat([variant('4', ['X', 'Y'], ['Infinite damage'])])
  );
  assert.strictEqual(groups.length, 2);
  const alone = groups.find((g) => !g.choices.length);
  assert.deepStrictEqual(alone.shared, ['X', 'Y']);
  assert.strictEqual(alone.variants.length, 1);
});

// The number itself, pinned. Every other test here is written against COLLAPSE_FROM and
// would follow it anywhere; this one is the reason that is safe. Four is a judgement —
// a triple has every one of its cards on screen already, so folding it asks the reader to
// assemble three combos out of a heading and a list rather than saving them anything.
test('groupVariants: the threshold is four, and it is a decision rather than a default', () => {
  assert.strictEqual(COLLAPSE_FROM, 4,
    'if this moved on purpose, move it here too — and add a version to test/fixtures/dataset.js');
});

// The threshold from both sides. One short of it is written out; at it, one row. Written
// as one test because the number is the whole subject, and the two ways to get it wrong
// are one edit apart.
test('groupVariants: one short of the threshold stays written out, at it becomes a choice', () => {
  const under = groupVariants(family(['A'], ['Infinite lifegain'], COLLAPSE_FROM - 1, 'u'));
  assert.strictEqual(under.length, COLLAPSE_FROM - 1, 'below the threshold every version is a row');
  assert.ok(under.every((g) => !g.choices.length && g.variants.length === 1));
  // Nothing is lost on the way: every variant still comes back, exactly once.
  assert.strictEqual(under.flatMap((g) => g.variants).length, COLLAPSE_FROM - 1);

  const at = groupVariants(family(['A'], ['Infinite lifegain'], COLLAPSE_FROM, 'v'));
  assert.strictEqual(at.length, 1, 'at the threshold they are one decision');
  assert.strictEqual(at[0].choices.length, COLLAPSE_FROM);
});

// Counted on the rows still free, not on the bucket. A family that loses members to a
// bigger one is smaller than it looks, and if what is left is under the threshold it is
// written out — otherwise the rule would hold for families read straight off the data and
// not for the ones left over.
test('groupVariants: a family cut below the threshold is written out, not folded', () => {
  // A full family on [P], which claims all of its rows...
  const claimed = family(['P'], ['Infinite mill'], COLLAPSE_FROM, 'p');
  // ...leaving these crossing it on each of those cards with only themselves free. One
  // short of the threshold, so they are rows rather than a choice.
  const leftover = claimed.slice(0, COLLAPSE_FROM - 1).map((v, i) =>
    variant(`q${i}`, ['Q', `p-${i}`], ['Infinite mill']));
  const groups = groupVariants(claimed.concat(leftover));

  const folded = groups.filter((g) => g.choices.length);
  assert.strictEqual(folded.length, 1, 'only the family that kept its rows folds');
  assert.deepStrictEqual(folded[0].shared, ['P']);
  assert.deepStrictEqual(
    groups.filter((g) => !g.choices.length).flatMap((g) => g.variants.map((v) => v.id)).sort(),
    leftover.map((v) => v.id).sort()
  );
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
  const variants = family(['A'], ['Infinite lifegain'], COLLAPSE_FROM, 'o');
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

// A row can sit in two families at once — "the lead + one of these + one of those" —
// and Carrion Feeder's real list holds a 2×2 of them: {Herd Baloth, Scurry Oak} against
// {Necrosynthesis, Sadistic Glee}. Every one of the four rows can be read as either
// dimension varying, so something has to pick an axis for the block. Choosing per row
// let two of the four pick the other one: the Scurry Oak rows sent Scurry Oak last while
// the Herd Baloth rows sent it middle, and the block came apart. A family claims the rows
// it orders, so the axis is settled once and all four rows agree on it.
test('interchangeableIn: a row in two families is ordered on one axis, and the block agrees', () => {
  const lead = 'Carrion Feeder';
  const grid = [
    variant('1', [lead, 'Herd Baloth', 'Necrosynthesis'], ['Infinite tokens']),
    variant('2', [lead, 'Herd Baloth', 'Sadistic Glee'], ['Infinite tokens']),
    variant('3', [lead, 'Scurry Oak', 'Necrosynthesis'], ['Infinite tokens']),
    variant('4', [lead, 'Scurry Oak', 'Sadistic Glee'], ['Infinite tokens']),
  ];
  const trails = interchangeableIn(grid);
  const drawn = grid.map((v) => orderComboNames(
    v.uses.map((u) => u.card.name), { lead, trail: trails.get(v) }
  ));

  // Every row leads with the card the list is under, names its axis card second, and
  // ends on the card that changes along that axis.
  for (const row of drawn) {
    assert.strictEqual(row[0], lead);
    assert.ok(['Herd Baloth', 'Scurry Oak'].includes(row[1]),
      `"${row.join(' + ')}" put the changing card in the middle`);
    assert.ok(['Necrosynthesis', 'Sadistic Glee'].includes(row[2]),
      `"${row.join(' + ')}" did not end on the card that changes`);
  }
  // And the axis is the same one for the whole block, rather than each pair choosing.
  assert.deepStrictEqual(drawn.map((r) => r[1]).sort(),
    ['Herd Baloth', 'Herd Baloth', 'Scurry Oak', 'Scurry Oak']);
});

// The other half of claiming: a family left holding one unclaimed row is not a family.
// Ordering that row against siblings drawn elsewhere would send a card last with nothing
// beside it to compare against, which is noise dressed as a rule.
test('interchangeableIn: a family down to one unclaimed row does not order it', () => {
  const rows = [
    // A family of three on [A], which claims all three...
    variant('1', ['A', 'x'], ['Infinite mill']),
    variant('2', ['A', 'y'], ['Infinite mill']),
    variant('3', ['A', 'z'], ['Infinite mill']),
    // ...leaving this one crossing it on [x] with only itself unclaimed.
    variant('4', ['B', 'x'], ['Infinite mill']),
  ];
  const trails = interchangeableIn(rows);
  assert.ok(trails.get(rows[0]), 'the family of three still orders its rows');
  assert.strictEqual(trails.get(rows[3]), undefined, 'a lone leftover row is left alphabetical');
});

// ---- the order a panel of combo rows read in --------------------------------
//
// Eight tests stood here, over byDrawnRow() and comboRowNames(): the ordering of the
// panel that listed every combo the deck could assemble as its own row, and what a
// collapsed row's heading drew. Both functions are gone with that panel — "Combos in your
// deck" is one row per card now — so the tests went with them rather than being kept
// green against nothing.
//
// What they were protecting is still pinned, one layer down: byDrawnName() and
// orderComboNames() above hold the rule (size, then the biggest block of versions, then
// what the row draws), and the nested lists a card's combos are drawn in are ordered by
// it. The layout run checks that on the built page — see `leads` in tools/verify-layout.js.

// ---- one list, ours among Spellbook's ---------------------------------------
//
// A suggestion used to draw two lists: the published combos, then a heading saying whose
// the rest were, then ours. The argument was that "somebody published this" is not a
// property of a row — which is true, and splitting the list made it the property that
// decided where a row *sat*. So a row of ours landed below the fold, away from the family
// it belongs to, and a reader comparing near-identical lines had to compare them across a
// heading. "Combos in your deck" never did that, and this is now the same shape.
//
// Each row says whose it is instead; that badge is render-combos.js's job and the layout
// run's to check. What belongs here is the order.

const oursVariant = (id, needs, ...cardNames) => Object.assign(
  variant(id, cardNames, ['Infinite tokens']),
  { needs: [needs], unofficial: { confidence: 'verified' } }
);

test('groupSuggestions: a suggestion lists ours and Spellbook\'s in one order', () => {
  // Everything but "Add Me" is in the deck, so every row below is one card away from it
  // — which is what puts them all under the same suggestion.
  const deck = deckNameSet(
    ['Held', 'Alpha', 'Beta', 'Gamma', 'Delta'].map((card) => ({ card }))
  );
  // Three published, one of ours whose cards sort into the middle of them.
  const published = [
    variant('p1', ['Held', 'Add Me', 'Alpha'], ['Infinite tokens']),
    variant('p2', ['Held', 'Add Me', 'Gamma'], ['Infinite tokens']),
    variant('p3', ['Held', 'Add Me', 'Delta'], ['Infinite tokens']),
  ];
  const unofficial = [oursVariant('u1', 'Add Me', 'Held', 'Add Me', 'Beta')];

  const [group] = groupSuggestions(
    computeSuggestions(published, deck, unofficial), deck
  );

  assert.strictEqual(group.combos.length, 4, 'every combo the card unlocks, in one list');
  // Ours sits where its cards put it, not after the published ones.
  const ids = group.combos.map((v) => v.id);
  assert.deepStrictEqual(ids, ['p1', 'u1', 'p3', 'p2'],
    `ours was not ordered among them: ${ids.join(', ')}`);
  // And the counts stay apart, because "+3" and "+1 of our own" are different claims.
  assert.strictEqual(group.unlocks.length, 3);
  assert.strictEqual(group.unofficial.length, 1);
});

test('groupSuggestions: the merged list leads with the card you would be adding', () => {
  const deck = deckNameSet(
    ['Held', 'Zebra', 'Aardvark'].map((card) => ({ card }))
  );
  const published = [variant('p1', ['Held', 'Zebra', 'Add Me'], ['Infinite tokens'])];
  const unofficial = [oursVariant('u1', 'Add Me', 'Held', 'Aardvark', 'Add Me')];
  const [group] = groupSuggestions(computeSuggestions(published, deck, unofficial), deck);
  // The lead is per row and has to be the one the render side draws, or the list was
  // ordered on a string nobody sees.
  for (const v of group.combos) {
    assert.strictEqual(orderComboNames(variantCardNames(v), { lead: 'Add Me' })[0], 'Add Me');
  }
});

test('groupSuggestions: a suggestion with nothing of ours still gets its list', () => {
  const deck = deckNameSet([{ card: 'Held' }]);
  const published = [variant('p1', ['Held', 'Add Me'], ['Infinite tokens'])];
  const [group] = groupSuggestions(computeSuggestions(published, deck, []), deck);
  assert.deepStrictEqual(group.combos.map((v) => v.id), ['p1']);
  assert.strictEqual(group.unofficial.length, 0);
});
