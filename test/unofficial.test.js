'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  matchUnofficial, standInRows, identityString, deckNameSet, nameKey, expand,
} = require('../combos.js');
const { COMBOS, STAND_INS } = require('../unofficial.js');

// The one part of the page that is not Commander Spellbook's word. Everything here
// is about keeping that distinction honest: the rows have to carry their evidence,
// they have to disappear the moment Spellbook publishes them, and they must never
// leak into the counts and the bracket that speak for the published data.

const DATASET = {
  cardIdentity: {
    'Scurry Oak': 'G',
    Necrosynthesis: 'B',
    'Viscera Seer': 'B',
    'Sol Ring': '',
  },
};

const deck = (...names) => deckNameSet(names.map((card) => ({ card, quantity: 1 })));

// ---- the data file itself --------------------------------------------------

test('unofficial: every row carries the evidence the page prints', () => {
  assert.ok(COMBOS.length > 0, 'no rows to check');
  COMBOS.forEach((row) => {
    const at = row.cards.join(' + ');
    assert.ok(row.cards.length >= 2, at + ': a combo needs at least two cards');
    assert.ok(row.produces.length, at + ': no results');
    assert.ok(['verified', 'derived'].includes(row.confidence), at + ': bad confidence');
    assert.ok(row.from && /^\d+(-\d+)+$/.test(row.from.id), at + ': no published combo cited');
    assert.ok(row.why && row.why.length > 20, at + ': no reasoning given');
    // The swap has to be a swap: one card out, one in, against the cited combo.
    assert.ok(row.from.cards.includes(row.swap.out), at + ': the swapped-out card is not in it');
    assert.ok(row.cards.includes(row.swap.in), at + ': the swapped-in card is not in the result');
    assert.deepStrictEqual(
      row.from.cards.map((c) => (c === row.swap.out ? row.swap.in : c)).slice().sort(),
      row.cards.slice().sort(),
      at + ': the two card lists differ by more than the stated swap'
    );
  });
});

test('unofficial: no row is listed twice', () => {
  const keys = COMBOS.map((r) => r.cards.map(nameKey).sort().join('|'));
  assert.strictEqual(new Set(keys).size, keys.length);
});

test('unofficial: every stand-in rule says what it stands in for and why', () => {
  assert.ok(STAND_INS.length > 0, 'no rules to check');
  STAND_INS.forEach((rule) => {
    assert.ok(rule.card, 'a rule with no card');
    assert.ok(['verified', 'derived'].includes(rule.confidence), rule.card + ': bad confidence');
    assert.ok(rule.for && rule.for.length, rule.card + ': stands in for nothing');
    rule.for.forEach((src) => {
      assert.ok(src.card, rule.card + ': a source with no card');
      // A card cannot stand in for itself: the rule would generate the combo it
      // read, and matchUnofficial would print a published combo as ours.
      assert.notStrictEqual(nameKey(src.card), nameKey(rule.card), rule.card + ': stands in for itself');
      assert.ok(src.why && src.why.length > 20, rule.card + '/' + src.card + ': no reasoning given');
    });
    // Listing a source twice would make the ranking meaningless.
    const keys = rule.for.map((src) => nameKey(src.card));
    assert.strictEqual(new Set(keys).size, keys.length, rule.card + ': a source listed twice');
  });
});

// ---- stand-in rules ----------------------------------------------------------
//
// A rule reaches over a thousand combos, so what it does with any one of them is
// not something reading the output will tell you. These check the decisions:
// which source it cites when it has a choice, what it refuses to touch, and that
// it never generates work for a deck that cannot use it.

const OUTLET = {
  combos: [
    { id: '1-2-3', c: ['Scurry Oak', 'Sadistic Glee', 'Twin A'], p: ['Infinite ETB'] },
    { id: '4-5-6', c: ['Scurry Oak', 'Sadistic Glee', 'Twin B'], p: ['Infinite ETB'] },
    { id: '7-8-9', c: ['Gravecrawler', 'Twin B'], p: ['Infinite death triggers'] },
    // A template slot is "any card that does X", filled from the deck.
    { id: '10-11-12', c: ['Basalt Monolith', 'Twin A'], t: [5], p: ['Infinite mana'] },
    // Nothing to swap: no source card in it at all.
    { id: '13-14-15', c: ['Basalt Monolith', 'Rings of Brighthearth'], p: ['Infinite mana'] },
  ],
  templates: { 5: 'Persist Creature' },
  // Both the stand-in and an ordinary card fill the slot, which is how "the
  // stand-in must not fill a slot beside itself" gets to be a real question.
  templateCards: { 'kitchen finks': [5], copycat: [5] },
  cardIdentity: {
    'Scurry Oak': 'G', 'Sadistic Glee': 'B', 'Twin A': 'WB', 'Twin B': 'B',
    Gravecrawler: 'B', Copycat: 'B', 'Basalt Monolith': '', 'Kitchen Finks': 'GW',
  },
};
const RULE = {
  card: 'Copycat',
  confidence: 'verified',
  for: [
    { card: 'Twin A', why: 'Word for word the same ability, so the loop does not notice.' },
    { card: 'Twin B', why: 'The same ability with one more restriction, which this loop clears.' },
  ],
};
const rowFor = (rows, ...cards) => rows.find(
  (r) => r.cards.map(nameKey).sort().join('|') === cards.map(nameKey).sort().join('|')
);

test('stand-in: a published combo becomes a row with the stand-in in it', () => {
  const rows = standInRows(OUTLET, [RULE], deck('Copycat', 'Gravecrawler'));
  assert.strictEqual(rows.length, 1);
  assert.deepStrictEqual(rows[0].cards.slice().sort(), ['Copycat', 'Gravecrawler']);
  // Everything a hand-written row carries, read off the source rather than typed.
  assert.strictEqual(rows[0].from.id, '7-8-9');
  assert.deepStrictEqual(rows[0].swap, { out: 'Twin B', in: 'Copycat' });
  assert.deepStrictEqual(rows[0].produces, ['Infinite death triggers']);
  assert.strictEqual(rows[0].confidence, 'verified');
  assert.strictEqual(rows[0].standIn, true);
});

// The order of `for` is the point of the field: both sources produce the same
// three cards here, and the row has to cite the one whose text matches best.
test('stand-in: with two sources for the same combo, the first listed wins', () => {
  const rows = standInRows(OUTLET, [RULE], deck('Copycat', 'Scurry Oak', 'Sadistic Glee'));
  const row = rowFor(rows, 'Copycat', 'Scurry Oak', 'Sadistic Glee');
  assert.ok(row, 'the combo was not generated at all');
  assert.strictEqual(row.from.id, '1-2-3');
  assert.strictEqual(row.swap.out, 'Twin A');
  // ...and it is one row, not one per source.
  assert.strictEqual(rows.length, 1);
});

test('stand-in: nothing is generated for a deck without the card', () => {
  assert.deepStrictEqual(standInRows(OUTLET, [RULE], deck('Scurry Oak', 'Sadistic Glee')), []);
});

test('stand-in: a combo the deck is short of is not generated', () => {
  // Sadistic Glee missing, so the Scurry Oak lines are out of reach; Gravecrawler
  // is present, so that one still comes through.
  const rows = standInRows(OUTLET, [RULE], deck('Copycat', 'Scurry Oak', 'Gravecrawler'));
  assert.deepStrictEqual(rows.map((r) => r.from.id), ['7-8-9']);
});

// A slot is included on the same terms a published combo's slot is: the deck has
// to fill it, and the row says which card was credited.
test('stand-in: a combo with a template slot comes through once the deck fills it', () => {
  const names = ['Copycat', 'Basalt Monolith', 'Kitchen Finks'];
  const rows = standInRows(OUTLET, [RULE], deck(...names), names.map((card) => ({ card, quantity: 1 })));
  const row = rowFor(rows, 'Copycat', 'Basalt Monolith');
  assert.ok(row, 'the templated combo was not generated');
  assert.strictEqual(row.from.id, '10-11-12');
  assert.deepStrictEqual(row.fills, [{ id: 5, slot: 'Persist Creature', card: 'Kitchen Finks' }]);
});

test('stand-in: a slot the deck cannot fill keeps the combo out', () => {
  const names = ['Copycat', 'Basalt Monolith'];
  const rows = standInRows(OUTLET, [RULE], deck(...names), names.map((card) => ({ card, quantity: 1 })));
  // Copycat fills a Persist Creature slot, and is the card being swapped *in* —
  // crediting it would be the same card twice in one combo.
  assert.deepStrictEqual(rows, []);
});

test('stand-in: a combo already naming the stand-in is not rewritten', () => {
  const data = { combos: [{ id: '1-1-1', c: ['Copycat', 'Twin A'], p: [] }], cardIdentity: {} };
  assert.deepStrictEqual(standInRows(data, [RULE], deck('Copycat', 'Twin A')), []);
});

test('stand-in: missing or empty inputs are not an error', () => {
  const names = deck('Copycat', 'Gravecrawler');
  assert.deepStrictEqual(standInRows(null, [RULE], names), []);
  assert.deepStrictEqual(standInRows(OUTLET, null, names), []);
  assert.deepStrictEqual(standInRows(OUTLET, [RULE], null), []);
  assert.deepStrictEqual(standInRows(OUTLET, [{ card: 'Copycat', for: [] }], names), []);
  assert.deepStrictEqual(standInRows({ combos: [] }, [RULE], names), []);
});

// The two halves of the file meet here, and the failure this prevents is the
// combo printed twice — once because somebody wrote it out and once because a
// rule worked it out.
test('stand-in: a generated row that duplicates a hand-written one is dropped', () => {
  const hand = {
    cards: ['Copycat', 'Gravecrawler'],
    produces: ['Infinite death triggers'],
    confidence: 'verified',
    from: { id: '7-8-9', cards: ['Gravecrawler', 'Twin B'] },
    swap: { out: 'Twin B', in: 'Copycat' },
    why: 'Written out by hand, before the rule existed.',
  };
  const names = deck('Copycat', 'Gravecrawler');
  const rows = standInRows(OUTLET, [RULE], names);
  const out = matchUnofficial(OUTLET, [hand].concat(rows), names, []);
  assert.strictEqual(out.length, 1);
  // First one wins, and search.js puts the hand-written rows first on purpose.
  assert.strictEqual(out[0].unofficial, hand);
});

test('stand-in: a generated row Spellbook has since published drops out', () => {
  const names = deck('Copycat', 'Gravecrawler');
  const rows = standInRows(OUTLET, [RULE], names);
  assert.strictEqual(rows.length, 1);
  const published = [{ id: '9-9-9', c: ['Gravecrawler', 'Copycat'] }];
  assert.strictEqual(matchUnofficial(OUTLET, rows, names, published).length, 0);
});

// ---- matching --------------------------------------------------------------

const ROW = {
  cards: ['Scurry Oak', 'Necrosynthesis', 'Viscera Seer'],
  produces: ['Infinite scry 1'],
  confidence: 'derived',
  from: { id: '2082-2292-4186', cards: ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'] },
  swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
  why: 'Both halves of the swap are published separately; the pairing is not.',
};

test('match: a deck holding every card gets the row', () => {
  const out = matchUnofficial(DATASET, [ROW], deck('Scurry Oak', 'Necrosynthesis', 'Viscera Seer'), []);
  assert.strictEqual(out.length, 1);
  assert.deepStrictEqual(out[0].c, ROW.cards);
  assert.strictEqual(out[0].unofficial, ROW);
  // Worked out from the cards, not stored, so it cannot drift from the identity data.
  assert.strictEqual(out[0].i, 'BG');
});

test('match: one card short is not a match', () => {
  const out = matchUnofficial(DATASET, [ROW], deck('Scurry Oak', 'Necrosynthesis'), []);
  assert.deepStrictEqual(out, []);
});

// The whole point of the graduation rule. Spellbook is refreshed nightly, and the
// day one of these is published it arrives in `included` on its own authority —
// showing our copy beside it would be the same combo twice, one of them stale.
test('match: a row Spellbook has since published drops out', () => {
  const names = deck('Scurry Oak', 'Necrosynthesis', 'Viscera Seer');
  const published = [{ id: '9-9-9', c: ['Viscera Seer', 'Scurry Oak', 'Necrosynthesis'] }];
  assert.strictEqual(matchUnofficial(DATASET, [ROW], names, published).length, 0);
  // ...and order and case in the published copy make no difference to that.
  const messy = [{ id: '9-9-9', c: ['viscera seer', 'NECROSYNTHESIS', 'Scurry Oak'] }];
  assert.strictEqual(matchUnofficial(DATASET, [ROW], names, messy).length, 0);
  // A different combo that merely overlaps does not count as publishing it.
  const other = [{ id: '9-9-9', c: ['Scurry Oak', 'Necrosynthesis'] }];
  assert.strictEqual(matchUnofficial(DATASET, [ROW], names, other).length, 1);
});

test('match: missing or empty inputs are not an error', () => {
  const names = deck('Scurry Oak');
  assert.deepStrictEqual(matchUnofficial(DATASET, null, names, []), []);
  assert.deepStrictEqual(matchUnofficial(DATASET, [], names, []), []);
  assert.deepStrictEqual(matchUnofficial(DATASET, [ROW], null, []), []);
  assert.deepStrictEqual(matchUnofficial(DATASET, [{ cards: [] }], names, []), []);
  // No `included` argument at all — nothing has been published, so nothing drops.
  assert.strictEqual(matchUnofficial(DATASET, [ROW], deck(...ROW.cards)).length, 1);
});

test('match: expand carries the evidence through to the renderer', () => {
  const row = expand(matchUnofficial(DATASET, [ROW], deck(...ROW.cards), [])[0]);
  assert.strictEqual(row.unofficial.confidence, 'derived');
  assert.strictEqual(row.unofficial.from.id, '2082-2292-4186');
  assert.deepStrictEqual(row.uses.map((u) => u.card.name), ROW.cards);
  // An official row must not grow the field, or every combo would render as derived.
  assert.strictEqual(expand({ id: '1-2-3', c: ['Sol Ring'], p: [] }).unofficial, undefined);
});

test('identityString: colourless is C, and the order is WUBRG', () => {
  assert.strictEqual(identityString(null), 'C');
  assert.strictEqual(identityString(new Set()), 'C');
  assert.strictEqual(identityString(new Set(['G', 'W', 'B'])), 'WBG');
  assert.strictEqual(identityString(new Set(['R', 'U'])), 'UR');
});

// ---- the citations, checked against the data -------------------------------
//
// The rows carry the published combo each was derived from, by id, and that
// citation is the whole basis on which the panel asks to be believed. Nothing in
// this file can check an id against the real data — the tests do not have 28 MB
// of it — so tools/verify-unofficial.js does, against the live snapshot, on
// every daily refresh. What *is* checkable here is that the checker works: that
// a broken citation is caught rather than that today's data happens to be fine.

const { check, checkStandIns } = require('../tools/verify-unofficial.js');

const PUBLISHED = {
  combos: [
    { id: '1-2-3', c: ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'] },
    { id: '4-5-6', c: ['Basalt Monolith', 'Rings of Brighthearth'] },
  ],
};
const row = (over) => Object.assign({
  cards: ['Scurry Oak', 'Necrosynthesis', 'Viscera Seer'],
  from: { id: '1-2-3', cards: ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'] },
  swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
}, over);

test('citations: a row citing a real combo with the right cards is fine', () => {
  const out = check(PUBLISHED, [row()]);
  assert.deepStrictEqual(out.problems, []);
  assert.deepStrictEqual(out.graduated, []);
});

test('citations: an id that does not resolve is caught', () => {
  const out = check(PUBLISHED, [row({ from: { id: '9-9-9', cards: ['Scurry Oak'] } })]);
  assert.strictEqual(out.problems.length, 1);
  assert.match(out.problems[0], /not in the published data/);
});

// The quieter half: a transposed digit can land on a combo that exists and is
// about something else entirely, and the page would print that as the evidence.
test('citations: an id resolving to different cards is caught', () => {
  const out = check(PUBLISHED, [row({
    from: { id: '4-5-6', cards: ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'] },
  })]);
  assert.strictEqual(out.problems.length, 1);
  assert.match(out.problems[0], /Basalt Monolith/);
});

// Not a failure — it is what a row is for. The page already drops it; this is
// how anyone finds out the file can lose an entry.
test('citations: a row Spellbook has published is reported as graduated', () => {
  const out = check(PUBLISHED, [row({ cards: ['Basalt Monolith', 'Rings of Brighthearth'] })]);
  assert.deepStrictEqual(out.problems, []);
  assert.deepStrictEqual(out.graduated, ['Basalt Monolith + Rings of Brighthearth']);
});

test('citations: no data and no rows are not an error', () => {
  assert.deepStrictEqual(check(null, null), { problems: [], graduated: [], counted: 0 });
});

// The failure a stand-in rule has that a written row does not: it cannot cite a
// combo that is absent, because it reads its citations off the data — but a
// source card whose name is one accent wrong matches nothing, generates nothing,
// and says nothing about it. The page just quietly shows less.
test('rules: a source card no combo names is caught', () => {
  const out = checkStandIns(OUTLET, [{
    card: 'Copycat',
    for: [{ card: 'Twin A', why: 'x' }, { card: 'Twin Á', why: 'x' }],
  }]);
  assert.strictEqual(out.problems.length, 1);
  assert.match(out.problems[0], /twin á/);
});

test('rules: the summary counts what the rule actually reached', () => {
  const [summary] = checkStandIns(OUTLET, [RULE]).summaries;
  // Three published lines reachable: the Scurry Oak one (both twins have it, so
  // it is one row), the Gravecrawler one, and the one with a slot in it — which
  // is reported separately, because whether it reaches anybody depends on their
  // deck rather than on the rule.
  assert.strictEqual(summary.rows, 3);
  assert.strictEqual(summary.slotted, 1);
  assert.strictEqual(summary.alreadyPublished, 0);
  assert.deepStrictEqual(summary.cited.map((c) => c.rows), [2, 1]);
});

// Not an error either — it is the outcome the rule wants. Every row it makes
// graduates one at a time, and this is the count that shows it happening.
test('rules: the stand-in turning up in published combos is reported', () => {
  const data = { combos: [{ id: '1-1-1', c: ['Copycat', 'Gravecrawler'] }], cardIdentity: {} };
  const [summary] = checkStandIns(data, [{
    card: 'Copycat', for: [{ card: 'Gravecrawler', why: 'x' }],
  }]).summaries;
  assert.strictEqual(summary.alreadyPublished, 1);
});

test('rules: no data and no rules are not an error', () => {
  assert.deepStrictEqual(checkStandIns(null, null), { problems: [], summaries: [] });
});
