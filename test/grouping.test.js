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
    variant('3', ['A', 'D'], ['Infinite lifegain']),
    variant('4', ['X', 'Y'], ['Infinite damage']),
  ]);
  assert.strictEqual(groups.length, 2);
  const alone = groups.find((g) => !g.choices.length);
  assert.deepStrictEqual(alone.shared, ['X', 'Y']);
  assert.strictEqual(alone.variants.length, 1);
});

// The threshold, from both sides. A pair is two rows; the same pair with a third
// version is one. Written as one test because the number is the whole subject — a pair
// that collapses and a triple that does not are the two ways to get this wrong, and
// they are one edit apart.
test('groupVariants: two versions stay two rows, three become a choice', () => {
  const pair = groupVariants([
    variant('1', ['A', 'B'], ['Infinite lifegain']),
    variant('2', ['A', 'C'], ['Infinite lifegain']),
  ]);
  assert.strictEqual(pair.length, 2, 'a pair is written out');
  assert.ok(pair.every((g) => !g.choices.length && g.variants.length === 1));
  // Nothing is lost on the way: both variants still come back, exactly once each.
  assert.deepStrictEqual(pair.flatMap((g) => g.variants.map((v) => v.id)).sort(), ['1', '2']);

  const triple = groupVariants([
    variant('1', ['A', 'B'], ['Infinite lifegain']),
    variant('2', ['A', 'C'], ['Infinite lifegain']),
    variant('3', ['A', 'D'], ['Infinite lifegain']),
  ]);
  assert.strictEqual(triple.length, 1, 'three versions are one decision');
  assert.deepStrictEqual(triple[0].choices.slice().sort(), ['B', 'C', 'D']);
});

// Counted on the rows still free, not on the bucket. A family of three that loses one
// member to a bigger family is a pair, and a pair is written out — otherwise the
// threshold would hold for families read off the data and not for families left over.
test('groupVariants: a family down to two survivors is written out, not folded', () => {
  const groups = groupVariants([
    // A family of three on [P], which claims all three...
    variant('1', ['P', 'x'], ['Infinite mill']),
    variant('2', ['P', 'y'], ['Infinite mill']),
    variant('3', ['P', 'z'], ['Infinite mill']),
    // ...leaving these two crossing it on [x] and [y] with only themselves free.
    variant('4', ['Q', 'x'], ['Infinite mill']),
    variant('5', ['Q', 'y'], ['Infinite mill']),
  ]);
  const folded = groups.filter((g) => g.choices.length);
  assert.strictEqual(folded.length, 1, 'only the family of three folds');
  assert.deepStrictEqual(folded[0].choices.slice().sort(), ['x', 'y', 'z']);
  assert.deepStrictEqual(
    groups.filter((g) => !g.choices.length).flatMap((g) => g.variants.map((v) => v.id)).sort(),
    ['4', '5']
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
// family term — and it belongs beside the rows that share its cards. The live fixture
// deck draws exactly this: "Chatterfang + Warren Soultrader + any of 3" with two whole
// rows that share those two cards and pay off differently.
test('byDrawnRow: a collapsed row sits in the family it shares its cards with', () => {
  const rows = panel([
    variant('1', ['Chatterfang', 'Warren Soultrader', 'Soul Warden'], ['Infinite tokens']),
    variant('2', ['Chatterfang', 'Warren Soultrader', 'Essence Warden'], ['Infinite tokens']),
    variant('2b', ['Chatterfang', 'Warren Soultrader', 'Prosperous Innkeeper'], ['Infinite tokens']),
    variant('3', ['Aetherflux Reservoir', 'Bolas\'s Citadel'], ['Infinite damage']),
    variant('4', ['Chatterfang', 'Warren Soultrader', 'Academy Manufactor'], ['Infinite Food']),
    variant('5', ['Chatterfang', 'Warren Soultrader', 'Peregrin Took'], ['Infinite Clues']),
  ]);
  assert.deepStrictEqual(rows, [
    // Size first: the 2-card combo leads whatever the names and the blocks do.
    'Aetherflux Reservoir + Bolas\'s Citadel',
    'Chatterfang + Warren Soultrader + any of 3',
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
  const rows = [
    variant('a1', ['Ashnod\'s Altar', 'Ghave, Guru of Spores', 'V'], ['Infinite tokens']),
    variant('a2', ['Ashnod\'s Altar', 'Ghave, Guru of Spores', 'W'], ['Infinite tokens']),
    variant('a3', ['Ashnod\'s Altar', 'Ghave, Guru of Spores', 'X'], ['Infinite tokens']),
    variant('a4', ['Ashnod\'s Altar', 'Ghave, Guru of Spores', 'Y'], ['Infinite tokens']),
    variant('b1', ['Ashnod\'s Altar', 'Ghave, Guru of Spores', 'L'], ['Infinite mana']),
    variant('b2', ['Ashnod\'s Altar', 'Ghave, Guru of Spores', 'M'], ['Infinite mana']),
    variant('b3', ['Ashnod\'s Altar', 'Ghave, Guru of Spores', 'N'], ['Infinite mana']),
  ];
  const drawn = panel(rows);
  assert.deepStrictEqual(drawn, [
    'Ashnod\'s Altar + Ghave, Guru of Spores + any of 4',
    'Ashnod\'s Altar + Ghave, Guru of Spores + any of 3',
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
    variant('c1', ['A', 'B', 'C'], ['Infinite tokens']),
    variant('c2', ['A', 'B', 'D'], ['Infinite tokens']),
    variant('c3', ['A', 'B', 'E'], ['Infinite tokens']),
    // A real block of two: same cards but one, different payoffs, so two rows.
    variant('b1', ['E', 'F', 'G'], ['Infinite lifegain']),
    variant('b2', ['E', 'F', 'H'], ['Infinite damage']),
  ]);
  assert.deepStrictEqual(rows, [
    'A + B',
    'E + F + G',
    'E + F + H',
    'A + B + any of 3',
  ], 'the real block of two leads the 3-card rows');
});

// And when even the version counts match, the last thing on screen that tells the two
// rows apart is the line of choices under the heading. Two rows drawing the same words
// in a page-order nobody chose is the failure this closes.
test('byDrawnRow: two rows offering the same many versions order on the choices they list', () => {
  const rows = [
    variant('q1', ['A', 'B', 'M'], ['Infinite mana']),
    variant('q2', ['A', 'B', 'N'], ['Infinite mana']),
    variant('q3', ['A', 'B', 'O'], ['Infinite mana']),
    variant('p1', ['A', 'B', 'C'], ['Infinite tokens']),
    variant('p2', ['A', 'B', 'D'], ['Infinite tokens']),
    variant('p3', ['A', 'B', 'E'], ['Infinite tokens']),
  ];
  const listed = (vs) => byDrawnRow(groupVariants(vs), interchangeableIn(vs))
    .map((g) => g.choices.slice().sort().join(' · '));
  assert.deepStrictEqual(listed(rows), ['C · D · E', 'M · N · O']);
  assert.deepStrictEqual(listed(rows.slice().reverse()), ['C · D · E', 'M · N · O'],
    'and not whichever arrived first');
});
