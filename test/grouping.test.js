// Interchangeable cards, in the two panels that read them differently.
//
// Spellbook stores one variant per concrete card list, so "Spike Feeder + 1 of 8 cards"
// reaches us as eight rows. A *suggestion* still collapses those into one choice —
// groupSuggestions() below — because eight rows there read as eight recommendations
// instead of one. "Combos in your deck" no longer collapses anything: it draws one row per
// combo and relies on interchangeableIn() and byDrawnRow() to sit a family's rows together
// with the card that varies in one column. See the note above byDrawnRow() in combos.js.
const test = require('node:test');
const assert = require('node:assert');
const {
  groupSuggestions, interchangeableIn, orderComboNames,
  computeSuggestions, deckNameSet, variantSignature, variantCardNames,
} = require('../combos.js');

// There was an n-versions-of-one-combo helper here, written so the threshold tests could say
// "one short of COLLAPSE_FROM" rather than a literal. The threshold is gone and the tests that
// remain are about what a family *reads* like, so they name their cards: `t0-t3` says nothing
// about whether four rows line up and six real names do.

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
//
// Nothing merges here any more. "Combos in your deck" used to fold a family of four or
// more versions into one "any of N" row, and the suite that pinned the threshold — the
// number itself, one row below it, one row at it, a family cut below it by a bigger one —
// went with the fold. What is left to check is that a family still *reads* as one: every
// version is its own row, and the two functions below put them next to each other with the
// card that changes in the same column. That is what the byDrawnRow tests further down do.

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
// One row per combo, so what these check is that a family's rows come back adjacent and
// each one still says what it says. The rows used to be groups, and a group could already
// be a block of versions folded into one line; the fold is gone and so is that difficulty.

const { byDrawnRow, comboRowNames } = require('../combos.js');

// The panel as app.js builds it: read the trails across the whole panel, then order it.
const panel = (variants) => {
  const trails = interchangeableIn(variants);
  return byDrawnRow(variants, trails).map((v) => comboRowNames(v, trails).join(' + '));
};

test('byDrawnRow: rows a card apart sit together', () => {
  // Two combos one card apart that pay off differently — and a third row that sorts
  // alphabetically between them.
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

// The case that used to fold, and the reason the fold could be removed without the panel
// coming apart: four versions of one combo, written out, land in one run with the card that
// varies in the same column — and the two rows that share those cards and pay off
// differently land in the same run, which is more than the fold managed. A folded row put
// those two outside itself.
test('byDrawnRow: every version of a family reads as one block of rows', () => {
  const rows = panel([
    variant('t0', ['Chatterfang', 'Warren Soultrader', 'Blood Artist'], ['Infinite tokens']),
    variant('t1', ['Chatterfang', 'Warren Soultrader', 'Zulaport Cutthroat'], ['Infinite tokens']),
    variant('t2', ['Chatterfang', 'Warren Soultrader', 'Bastion of Remembrance'], ['Infinite tokens']),
    variant('t3', ['Chatterfang', 'Warren Soultrader', 'Cruel Celebrant'], ['Infinite tokens']),
    variant('3', ['Aetherflux Reservoir', 'Bolas\'s Citadel'], ['Infinite damage']),
    variant('4', ['Chatterfang', 'Warren Soultrader', 'Academy Manufactor'], ['Infinite Food']),
    variant('5', ['Chatterfang', 'Warren Soultrader', 'Peregrin Took'], ['Infinite Clues']),
  ]);
  assert.deepStrictEqual(rows, [
    // Size first: the 2-card combo leads whatever the names and the blocks do.
    'Aetherflux Reservoir + Bolas\'s Citadel',
    // Then one block, ordered on the card that changes — which is the last name on every
    // one of them, because that is where the trail sends it.
    'Chatterfang + Warren Soultrader + Academy Manufactor',
    'Chatterfang + Warren Soultrader + Bastion of Remembrance',
    'Chatterfang + Warren Soultrader + Blood Artist',
    'Chatterfang + Warren Soultrader + Cruel Celebrant',
    'Chatterfang + Warren Soultrader + Peregrin Took',
    'Chatterfang + Warren Soultrader + Zulaport Cutthroat',
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

// Two rows can name exactly the same cards and pay off differently — Spellbook publishes
// those, and interchangeableIn() deliberately does not read the results, so nothing here
// tells them apart by card. Their drawn names are one string, so without a last term they
// fall back to the order they happened to arrive in. Asserted on the ids rather than the
// drawn names, because the whole difficulty is that the drawn names are identical.
test('byDrawnRow: two rows naming the same cards break the tie on what they produce', () => {
  const shared = ['Ashnod\'s Altar', 'Ghave, Guru of Spores'];
  const rows = [
    variant('tokens', shared, ['Infinite tokens']),
    variant('mana', shared, ['Infinite mana']),
  ];
  const order = (vs) => byDrawnRow(vs, interchangeableIn(vs)).map((v) => v.id);
  // The result chips are the next thing on the row a reader can actually see, so they are
  // what breaks the tie.
  assert.deepStrictEqual(order(rows), ['mana', 'tokens']);
  assert.deepStrictEqual(order(rows.slice().reverse()), ['mana', 'tokens'],
    'and not whichever arrived first');
});

// Rows move and cards do not. The comparator reads the drawn name, and reading it is one
// keystroke from rewriting it — the same invariant test/combos.test.js pins for the
// nested lists, asked of this panel.
test('byDrawnRow: ordering the rows leaves every row saying exactly what it said', () => {
  const rows = [
    variant('1', ['Kitchen Finks', 'Viscera Seer', 'Archangel of Thune'], ['Infinite lifegain']),
    variant('2', ['Kitchen Finks', 'Viscera Seer', 'Heliod, Sun-Crowned'], ['Infinite damage']),
    variant('3', ['Scurry Oak', 'Archangel of Thune', 'Soul Warden'], ['Infinite tokens']),
    variant('4', ['Scurry Oak', 'Archangel of Thune', 'Essence Warden'], ['Infinite tokens']),
    variant('5', ['Animation Module', 'Cauldron Familiar'], ['Infinite mill']),
  ];
  const trails = interchangeableIn(rows);
  const before = rows.map((v) => comboRowNames(v, trails).join(' + ')).sort();
  const after = byDrawnRow(rows, trails).map((v) => comboRowNames(v, trails).join(' + ')).sort();
  assert.deepStrictEqual(after, before, 'a row was redrawn, not just moved');
  // And nothing is lost or duplicated on the way through — the panel draws what it is
  // handed, so a comparator that dropped a row would drop a combo.
  assert.deepStrictEqual(byDrawnRow(rows, trails).map((v) => v.id).sort(),
    ['1', '2', '3', '4', '5'], 'every row comes back, exactly once');
});

test('byDrawnRow: nothing in, nothing out', () => {
  assert.deepStrictEqual(byDrawnRow([], new Map()), []);
  assert.deepStrictEqual(byDrawnRow(null, new Map()), []);
  assert.deepStrictEqual(comboRowNames(null), []);
});

// The block a row is counted under is read off the family that claimed it, not off "the
// drawn name minus its last card" — which is the same thing on the rows that have a
// family and is wrong on the rows that do not. A lone row's *whole* card list would become
// a key, and a key of n-1 cards is exactly what a family's shared cards are: the 2-card row
// below would be counted into the block of 3-card rows above it, making that block look one
// row bigger than it is. Size keeps the lone row apart on screen, so the damage is silent —
// an inflated count promoting one block over another it should follow.
test('byDrawnRow: a lone row is not counted into the block that shares its cards', () => {
  const rows = panel([
    variant('lone', ['A', 'B'], ['Infinite mill']),
    // A block of two whose shared cards are that lone row's whole combo. Counting the lone
    // row into it would read as three, which is the next block's real size.
    variant('p1', ['A', 'B', 'C'], ['Infinite tokens']),
    variant('p2', ['A', 'B', 'D'], ['Infinite tokens']),
    // A real block of three, which therefore leads.
    variant('q1', ['E', 'F', 'G'], ['Infinite lifegain']),
    variant('q2', ['E', 'F', 'H'], ['Infinite damage']),
    variant('q3', ['E', 'F', 'I'], ['Infinite mana']),
  ]);
  assert.deepStrictEqual(rows, [
    'A + B',
    'E + F + G',
    'E + F + H',
    'E + F + I',
    'A + B + C',
    'A + B + D',
  ], 'the real block of three leads the block of two');
});

// ---- one list, ours among Spellbook's ---------------------------------------
//
// A suggestion used to draw two lists: the published combos, then a heading saying whose
// the rest were, then ours. The argument was that "somebody published this" is not a
// property of a row — which is true, and splitting the list made it the property that
// decided where a row *sat*. So a row of ours landed below the fold, away from the family
// it belongs to, and a reader comparing near-identical lines had to compare them across a
// heading. "Cards carrying your combos" never did that, and this is now the same shape.
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
