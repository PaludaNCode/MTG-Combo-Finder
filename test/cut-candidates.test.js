'use strict';
// "Cards carrying no combo" — the panel that lists the reader's own cards under a heading
// they could read as an accusation, which is why almost every test here is about what it
// must NOT say or count.
//
// The panel is not reachable from either browser harness's tuning deck (every card in it
// carries a combo), so this file and the dedicated `cut` run in tools/verify-layout.js are
// between them the whole of what watches it. The measurement behind the design is in
// prototypes/no-combo-panel.md.
const test = require('node:test');
const assert = require('node:assert');
const DeckCombos = require('../combos.js');
const DeckView = require('../view-model.js');

const { cutCandidates, publishedCounts, CUT_NEEDS_SHOWN } = DeckCombos;

// A combo in the compact shape the payload publishes, since that is what the worker holds
// when it calls this — `c` and not `uses`. That pair of shapes is the first trap under
// CLAUDE.md § Data shapes, and cutCandidates() reads both through variantCardNames().
const combo = (...cards) => ({ c: cards });
const deck = (...cards) => cards.map((card) => (typeof card === 'string' ? { card, quantity: 1 } : card));

// Enough of a dataset to answer the three questions cutCandidates() asks of one: is this
// card known at all, is it a land, and how many published combos name it.
//
// `known` is separate from the combos because a card in no combo still has to be in the
// identity map — that is exactly what tells a real card apart from a misspelling, and it
// is the difference between the third group and `unknown`.
const data = (combos, known, extra) => Object.assign({
  combos,
  cardIdentity: Object.fromEntries(
    [...new Set(combos.flatMap((c) => c.c).concat(known || []))].map((n) => [n, ''])
  ),
  lands: [],
}, extra || {});

// ---- publishedCounts: the second group's number -----------------------------

test('publishedCounts: how many published combos name each card', () => {
  const combos = [combo('A', 'B'), combo('A', 'C'), combo('C', 'D')];
  const counts = publishedCounts(combos, ['a', 'b', 'c', 'd']);
  assert.strictEqual(counts.get('a'), 2);
  assert.strictEqual(counts.get('b'), 1);
  assert.strictEqual(counts.get('c'), 2);
});

test('publishedCounts: a card in nothing counts 0 rather than going missing', () => {
  const counts = publishedCounts([combo('A', 'B')], ['a', 'z']);
  assert.strictEqual(counts.get('z'), 0, 'the key must be present — an absent one reads as undefined downstream');
});

// The index stores one posting per *occurrence* on purpose (see comboIndex), so the naive
// count of a card's postings is not the count of combos naming it. This number is shown to
// a reader as "in 92 published combos".
test('publishedCounts: a combo naming the same card twice is one combo', () => {
  const counts = publishedCounts([combo('A', 'A', 'B')], ['a']);
  assert.strictEqual(counts.get('a'), 1);
});

// ---- the three groups -------------------------------------------------------

test('cutCandidates: one card away, no partner here, and no combo at all', () => {
  const combos = [
    combo('Carrying', 'Partner'),          // the deck has both -> neither is in the panel
    combo('Nearly', 'Missing'),            // one card short
    combo('Unpaired', 'Nowhere', 'Else'),  // two cards short
  ];
  const cut = cutCandidates(
    data(combos, ['Vanilla']),
    deck('Carrying', 'Partner', 'Nearly', 'Unpaired', 'Vanilla'),
    [combo('Carrying', 'Partner')],
    [combo('Nearly', 'Missing')]
  );

  assert.deepStrictEqual(cut.away.map((r) => r.card), ['Nearly']);
  assert.deepStrictEqual(cut.unpaired.map((r) => r.card), ['Unpaired']);
  assert.deepStrictEqual(cut.none.map((r) => r.card), ['Vanilla']);
  assert.strictEqual(cut.carrying, 2, 'the two cards that do carry one are counted, not listed');
  assert.strictEqual(cut.cards, 5, 'and the caption reconciles against every nonland card');
  assert.strictEqual(cut.away[0].combos, 1);
  assert.deepStrictEqual(cut.away[0].needs, ['Missing']);
  assert.strictEqual(cut.unpaired[0].published, 1);
});

// The whole reason the panel is three groups. A single ranked list would put these two
// cards next to each other, and they are not the same kind of thing at all.
test('cutCandidates: a card is in exactly one group', () => {
  const combos = [combo('Nearly', 'Missing'), combo('Nearly', 'AlsoMissing')];
  const cut = cutCandidates(data(combos), deck('Nearly'), [], combos);
  assert.strictEqual(cut.away.length, 1);
  assert.strictEqual(cut.unpaired.length, 0, 'a card one away is not also reported as unpaired');
  assert.strictEqual(cut.none.length, 0);
  // Both of its near-misses count, and both missing cards are offered.
  assert.strictEqual(cut.away[0].combos, 2);
  assert.deepStrictEqual(cut.away[0].needs, ['AlsoMissing', 'Missing']);
});

// A card holding up nothing but one of our own rows is not carrying nothing. The two
// panels would otherwise contradict each other: "Combos in your deck" lists it above and
// this one says it carries none.
test('cutCandidates: an unofficial combo counts as carrying', () => {
  const combos = [combo('Ours', 'Partner')];
  const cut = cutCandidates(data(combos), deck('Ours', 'Partner'), [combo('Ours', 'Partner')], []);
  assert.strictEqual(cut.away.length + cut.unpaired.length + cut.none.length, 0);
  assert.strictEqual(cut.carrying, 2);
});

// ---- what it leaves out, and says so ----------------------------------------

test('cutCandidates: lands are excluded and counted', () => {
  const cut = cutCandidates(
    data([combo('Spell', 'Missing')], ['Forest', 'Command Tower'], { lands: ['Forest', 'Command Tower'] }),
    deck('Spell', 'Forest', 'Command Tower'),
    [],
    []
  );
  assert.strictEqual(cut.lands, 2, 'both lands are hidden');
  assert.strictEqual(cut.cards, 1, 'and the reconciliation is against the nonland cards only');
  assert.deepStrictEqual(cut.unpaired.map((r) => r.card), ['Spell']);
  assert.ok(cut.none.every((r) => r.card !== 'Forest'), 'no land is listed');
});

// A misspelling is not a card in no combo. It is already named above the results, and
// listing it here would accuse the reader's typo of being unplayable.
test('cutCandidates: a card the snapshot has never heard of is not in any group', () => {
  const cut = cutCandidates(
    data([combo('Known', 'Missing')]),
    deck('Known', 'Sol Rimg'),
    [],
    []
  );
  assert.strictEqual(cut.unknown, 1);
  assert.ok([...cut.away, ...cut.unpaired, ...cut.none].every((r) => r.card !== 'Sol Rimg'));
  assert.strictEqual(cut.cards, 1, 'and it is not counted in the deck the caption reconciles against');
});

// ---- ordering and the cap ---------------------------------------------------

test('cutCandidates: each group is ranked by the number its own rows print', () => {
  const combos = [
    combo('Two', 'X'), combo('Two', 'Y'),
    combo('One', 'Z'),
    combo('Big', 'P', 'Q'), combo('Big', 'R', 'S'), combo('Small', 'T', 'U'),
  ];
  const cut = cutCandidates(
    data(combos),
    deck('One', 'Two', 'Big', 'Small'),
    [],
    [combos[0], combos[1], combos[2]]
  );
  assert.deepStrictEqual(cut.away.map((r) => r.card), ['Two', 'One']);
  assert.deepStrictEqual(cut.unpaired.map((r) => [r.card, r.published]), [['Big', 2], ['Small', 1]]);
});

test('cutCandidates: the needs list is capped and says how many it did not name', () => {
  const wanted = ['A', 'B', 'C', 'D', 'E', 'F'];
  const combos = wanted.map((n) => combo('Nearly', n));
  const cut = cutCandidates(data(combos), deck('Nearly'), [], combos);
  assert.strictEqual(cut.away[0].needs.length, CUT_NEEDS_SHOWN);
  assert.strictEqual(cut.away[0].needsMore, wanted.length - CUT_NEEDS_SHOWN);
  const why = DeckView.cutWhy(cut.away[0], 'away');
  assert.match(why, /and 2 others\.$/, `the row must not claim to have named them all: ${why}`);
});

test('cutCandidates: nothing in, nothing out', () => {
  const cut = cutCandidates(data([]), [], [], []);
  assert.deepStrictEqual(
    { away: cut.away, unpaired: cut.unpaired, none: cut.none, lands: cut.lands },
    { away: [], unpaired: [], none: [], lands: 0 }
  );
});

// ---- what the panel is allowed to say ---------------------------------------

const someCut = (over) => Object.assign({
  away: [{ card: 'Nearly', quantity: 1, combos: 2, needs: ['Missing'], needsMore: 0 }],
  unpaired: [{ card: 'Unpaired', quantity: 1, published: 92 }],
  none: [{ card: 'Vanilla', quantity: 1 }],
  lands: 23,
  unknown: 0,
  carrying: 21,
  cards: 62,
}, over || {});

test('cutCandidatesNote: says how many, that it is normal, and what it hid', () => {
  const note = DeckView.cutCandidatesNote(someCut());
  assert.strictEqual(note.count, 3);
  assert.match(note.sentence, /3 of your 62 nonland cards/);
  assert.match(note.sentence, /That is normal/);
  assert.match(note.sentence, /23 lands are not shown\./);
});

// The one thing this panel must never do. There is no automatic way to check a tone, so
// what is pinned is the phrasing that was rejected — if the caption ever recommends a cut
// in these words, this fails.
test('cutCandidatesNote: never recommends a cut', () => {
  const note = DeckView.cutCandidatesNote(someCut());
  assert.doesNotMatch(note.sentence, /\bcut (these|this|it)\b/i);
  assert.doesNotMatch(note.sentence, /candidates? for cutting|should be cut/i);
  assert.match(note.sentence, /rather than listed as cuts/, 'it says outright that it is not a cut list');
});

test('cutCandidatesNote: silent about lands when it hid none', () => {
  const note = DeckView.cutCandidatesNote(someCut({ lands: 0 }));
  assert.doesNotMatch(note.sentence, /lands? (is|are) not shown/, '"0 lands are not shown" reads as a bug');
});

test('cutCandidatesNote: one land is singular', () => {
  assert.match(DeckView.cutCandidatesNote(someCut({ lands: 1 })).sentence, /1 land is not shown\./);
});

test('cutCandidatesNote: nothing to report draws no panel at all', () => {
  assert.strictEqual(DeckView.cutCandidatesNote(null), null);
  assert.strictEqual(
    DeckView.cutCandidatesNote(someCut({ away: [], unpaired: [], none: [] })),
    null,
    'an empty panel headed "Cards carrying no combo" answers a question nobody asked'
  );
});

test('cutGroups: three groups, each with its own count, sentence and empty text', () => {
  const groups = DeckView.cutGroups(someCut());
  assert.deepStrictEqual(groups.map((g) => g.id), ['away', 'unpaired', 'none']);
  assert.deepStrictEqual(groups.map((g) => g.count), [1, 1, 1]);
  for (const g of groups) {
    assert.ok(g.label, 'every group is labelled');
    assert.ok(g.note, `"${g.label}" has no sentence of its own`);
    // A tab pressed onto nothing has to say why, or the panel reads as broken.
    assert.ok(g.empty, `"${g.label}" says nothing when it is empty`);
  }
  assert.strictEqual(
    groups.reduce((n, g) => n + g.count, 0),
    DeckView.cutCandidatesNote(someCut()).count,
    'the badge counts the groups it is over'
  );
});

// The word under the figure is the whole reason cutGutter() exists: the shipped label says
// "combos", which under a heading saying the card carries none is the page contradicting
// itself in the same breath.
test('cutGutter: the label never reads "combos"', () => {
  const cut = someCut();
  for (const [row, group] of [[cut.away[0], 'away'], [cut.unpaired[0], 'unpaired']]) {
    const gutter = DeckView.cutGutter(row, group);
    assert.doesNotMatch(gutter.label, /^combos?$/);
    assert.match(gutter.count, /^\d+$/);
    assert.ok(gutter.spoken.length > gutter.label.length, 'the figure says what it counts somewhere');
  }
});

test('cutGutter: each group counts something it can name', () => {
  const cut = someCut();
  assert.deepStrictEqual(
    DeckView.cutGutter(cut.away[0], 'away'),
    { count: '2', label: 'one away', spoken: 'one card away from 2 combos' }
  );
  assert.deepStrictEqual(
    DeckView.cutGutter(cut.unpaired[0], 'unpaired'),
    { count: '92', label: 'elsewhere', spoken: 'named in 92 published combos, none of them in this deck' }
  );
});

test('cutWhy: alternatives read as alternatives', () => {
  const one = { needs: ['Ashnod\'s Altar'], needsMore: 0 };
  const two = { needs: ['Ashnod\'s Altar', 'Mana Echoes'], needsMore: 0 };
  const three = { needs: ['A', 'B', 'C'], needsMore: 0 };
  assert.strictEqual(DeckView.cutWhy(one, 'away'), "Needs Ashnod's Altar.");
  // "and" would claim the row needs both.
  assert.strictEqual(DeckView.cutWhy(two, 'away'), "Needs Ashnod's Altar or Mana Echoes.");
  assert.strictEqual(DeckView.cutWhy(three, 'away'), 'Needs A, B or C.');
});

test('cutWhy: the second group says what its number is not', () => {
  const why = DeckView.cutWhy({ published: 92 }, 'unpaired');
  assert.match(why, /92 published combos/);
  assert.match(why, /none with a card you play/, 'or the 92 reads as combos the reader has');
  assert.match(why, /none you are one card from/, 'and it says why it is not in the first group');
});

test('cutWhy: the third group has nothing to add', () => {
  assert.strictEqual(DeckView.cutWhy({ card: 'Vanilla' }, 'none'), null);
  assert.strictEqual(DeckView.cutWhy({ needs: [], needsMore: 0 }, 'away'), null);
});
