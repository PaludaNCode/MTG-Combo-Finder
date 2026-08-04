// Collapsing interchangeable cards. Spellbook stores one variant per concrete
// card list, so "Spike Feeder + 1 of 8 cards" reaches us as eight rows; left
// alone that reads as eight recommendations instead of one choice.
const test = require('node:test');
const assert = require('node:assert');
const {
  groupSuggestions, groupVariants, COLLAPSE_FROM, interchangeableIn, orderComboNames,
  computeSuggestions, deckNameSet, variantSignature,
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

// ---- the order "Combos in your deck" reads in --------------------------------
//
// The panel used to be the exception: size, then play count. Every other list of combos
// sorts on what its rows draw, and the exception cost this one the same thing it costs
// anywhere — four rows of the fixture deck reading "Cauldron Familiar + Samwise Gamgee +
// the one that changes" sat at 11, 12, 13 and 16, split by two rows about other cards,
// so the aligned column had nothing to align against.
//
// The rows here are groups rather than variants, which is the whole difficulty: a row can
// already be a block of versions folded into one line.

const { byDrawnRow, comboRowNames } = require('../combos.js');

// The panel as app.js builds it: group, then order the groups.
const panel = (variants) => {
  const trails = interchangeableIn(variants);
  return byDrawnRow(groupVariants(variants), trails)
    .map((g) => comboRowNames(g, trails).join(' + ')
      + (g.choices.length >= 2 ? ' + any of ' + g.choices.length : ''));
};

test('byDrawnRow: rows a card apart sit together even when grouping kept them separate', () => {
  // Two combos one card apart that pay off differently, so groupVariants() must leave
  // them as two rows — and a third row that sorts alphabetically between them.
  const rows = panel([
    variant('1', ['Cauldron Familiar', 'Samwise Gamgee', 'Viscera Seer'], ['Infinite death triggers']),
    variant('2', ['Camellia, the Seedmiser', 'Peregrin Took', 'Umbral Collar Zealot'], ['Infinite mill']),
    variant('3', ['Cauldron Familiar', 'Samwise Gamgee', 'Carrion Feeder'], ['Infinite lifegain']),
  ]);
  assert.deepStrictEqual(rows, [
    'Cauldron Familiar + Samwise Gamgee + Carrion Feeder',
    'Cauldron Familiar + Samwise Gamgee + Viscera Seer',
    'Camellia, the Seedmiser + Peregrin Took + Umbral Collar Zealot',
  ]);
});

// A collapsed row is one row, whatever it folds away, so it counts as one against the
// family term — and it belongs beside the rows that share its cards. The live tuning deck
// draws exactly this: a "Chatterfang + Warren Soultrader + any of N" row with two whole
// rows that share those two cards and pay off differently.
test('byDrawnRow: a collapsed row sits in the family it shares its cards with', () => {
  const rows = panel([
    ...family(['Chatterfang', 'Warren Soultrader'], ['Infinite tokens'], COLLAPSE_FROM, 'tok'),
    variant('3', ['Aetherflux Reservoir', 'Bolas\'s Citadel'], ['Infinite damage']),
    variant('4', ['Chatterfang', 'Warren Soultrader', 'Academy Manufactor'], ['Infinite Food']),
    variant('5', ['Chatterfang', 'Warren Soultrader', 'Peregrin Took'], ['Infinite Clues']),
  ]);
  assert.deepStrictEqual(rows, [
    // Size first: the 2-card combo leads whatever the names and the blocks do.
    'Aetherflux Reservoir + Bolas\'s Citadel',
    `Chatterfang + Warren Soultrader + any of ${COLLAPSE_FROM}`,
    'Chatterfang + Warren Soultrader + Academy Manufactor',
    'Chatterfang + Warren Soultrader + Peregrin Took',
  ]);
});

test('byDrawnRow: the biggest block of rows leads, then smaller, then the rows on their own', () => {
  const rows = panel([
    // One row of its own that sorts alphabetically above everything else.
    variant('single', ['Animation Module', 'Cauldron Familiar', 'Samwise Gamgee'], ['Infinite mill']),
    // A block of two: same cards but one, different payoffs, so two rows.
    variant('two-a', ['Herd Baloth', 'Necrosynthesis', 'Zulaport Cutthroat'], ['Infinite drain']),
    variant('two-b', ['Herd Baloth', 'Necrosynthesis', 'Blood Artist'], ['Infinite lifegain']),
    // A block of three.
    variant('three-a', ['Kitchen Finks', 'Viscera Seer', 'Archangel of Thune'], ['Infinite lifegain']),
    variant('three-b', ['Kitchen Finks', 'Viscera Seer', 'Heliod, Sun-Crowned'], ['Infinite damage']),
    variant('three-c', ['Kitchen Finks', 'Viscera Seer', 'Heroic Feast'], ['Infinite tokens']),
  ]);
  assert.deepStrictEqual(rows, [
    'Kitchen Finks + Viscera Seer + Archangel of Thune',
    'Kitchen Finks + Viscera Seer + Heliod, Sun-Crowned',
    'Kitchen Finks + Viscera Seer + Heroic Feast',
    'Herd Baloth + Necrosynthesis + Blood Artist',
    'Herd Baloth + Necrosynthesis + Zulaport Cutthroat',
    'Animation Module + Cauldron Familiar + Samwise Gamgee',
  ]);
});

// Two collapsed rows can name the same cards and differ only in what they fold away,
// which the Chatterfang deck draws: "Ashnod's Altar + Ghave, Guru of Spores + any of 4"
// above the same two cards "+ any of 2". Their drawn names are one string, so without a
// tie-break the two rows fall back to the order they happened to arrive in. Both groups
// are three or more here, since a pair is written out rather than folded.
test('byDrawnRow: two rows naming the same cards break the tie on what they offer', () => {
  const shared = ['Ashnod\'s Altar', 'Ghave, Guru of Spores'];
  const rows = family(shared, ['Infinite tokens'], COLLAPSE_FROM + 1, 'big')
    .concat(family(shared, ['Infinite mana'], COLLAPSE_FROM, 'small'));
  const drawn = panel(rows);
  assert.deepStrictEqual(drawn, [
    `Ashnod's Altar + Ghave, Guru of Spores + any of ${COLLAPSE_FROM + 1}`,
    `Ashnod's Altar + Ghave, Guru of Spores + any of ${COLLAPSE_FROM}`,
  ], 'the row offering more versions leads');
  assert.deepStrictEqual(panel(rows.slice().reverse()), drawn,
    'and the answer does not depend on the order they arrived in');
});

// Rows move and cards do not. The comparator reads the drawn name, and reading it is one
// keystroke from rewriting it — the same invariant test/combos.test.js pins for the
// nested lists, asked of the panel that draws groups.
test('byDrawnRow: ordering the rows leaves every row saying exactly what it said', () => {
  const rows = [
    variant('1', ['Kitchen Finks', 'Viscera Seer', 'Archangel of Thune'], ['Infinite lifegain']),
    variant('2', ['Kitchen Finks', 'Viscera Seer', 'Heliod, Sun-Crowned'], ['Infinite damage']),
    variant('3', ['Scurry Oak', 'Archangel of Thune', 'Soul Warden'], ['Infinite tokens']),
    variant('4', ['Scurry Oak', 'Archangel of Thune', 'Essence Warden'], ['Infinite tokens']),
    variant('5', ['Animation Module', 'Cauldron Familiar'], ['Infinite mill']),
  ];
  const trails = interchangeableIn(rows);
  const groups = groupVariants(rows);
  const before = groups.map((g) => comboRowNames(g, trails).join(' + ')).sort();
  const after = byDrawnRow(groups, trails).map((g) => comboRowNames(g, trails).join(' + ')).sort();
  assert.deepStrictEqual(after, before, 'a row was redrawn, not just moved');
});

test('byDrawnRow: nothing in, nothing out', () => {
  assert.deepStrictEqual(byDrawnRow([], new Map()), []);
  assert.deepStrictEqual(byDrawnRow(null, new Map()), []);
  assert.deepStrictEqual(comboRowNames(null), []);
});

// The block a row is counted under is read off the family that claimed it, not off "the
// drawn name minus its last card" — which is the same thing on the rows that have a
// family and is wrong on the rows that do not. A lone row's *whole* card list would
// become a key, and a key of n-1 cards is exactly what a collapsed row's shared cards
// are: the 2-card row below would be counted into the 3-card row's block. Size keeps
// them apart on screen, so the damage is silent — an inflated count promoting a row over
// the block it should follow.
test('byDrawnRow: a lone row is not counted into a bigger row that shares its cards', () => {
  const rows = panel([
    variant('lone', ['A', 'B'], ['Infinite mill']),
    // A collapsed row whose shared cards are that lone row's whole combo.
    ...family(['A', 'B'], ['Infinite tokens'], COLLAPSE_FROM, 'c'),
    // A real block of two: same cards but one, different payoffs, so two rows.
    variant('b1', ['E', 'F', 'G'], ['Infinite lifegain']),
    variant('b2', ['E', 'F', 'H'], ['Infinite damage']),
  ]);
  assert.deepStrictEqual(rows, [
    'A + B',
    'E + F + G',
    'E + F + H',
    `A + B + any of ${COLLAPSE_FROM}`,
  ], 'the real block of two leads the 3-card rows');
});

// And when even the version counts match, the last thing on screen that tells the two
// rows apart is the line of choices under the heading. Two rows drawing the same words
// in a page-order nobody chose is the failure this closes.
test('byDrawnRow: two rows offering the same many versions order on the choices they list', () => {
  const rows = family(['A', 'B'], ['Infinite mana'], COLLAPSE_FROM, 'zz')
    .concat(family(['A', 'B'], ['Infinite tokens'], COLLAPSE_FROM, 'aa'));
  const listed = (vs) => byDrawnRow(groupVariants(vs), interchangeableIn(vs))
    .map((g) => g.choices.slice().sort()[0]);
  // Both rows draw the same words and fold the same number away, so the only thing left
  // that a reader can see is the line of choices under the heading.
  assert.deepStrictEqual(listed(rows), ['aa-0', 'zz-0']);
  assert.deepStrictEqual(listed(rows.slice().reverse()), ['aa-0', 'zz-0'],
    'and not whichever arrived first');
});
