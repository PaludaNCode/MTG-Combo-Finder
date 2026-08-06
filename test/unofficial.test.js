'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  matchUnofficial, standInRows, identityString, deckNameSet, nameKey, expand,
  variantCardNames, comboSize,
} = require('../combos.js');
const { COMBOS, STAND_INS } = require('../unofficial.js');
const fs = require('node:fs');
const path = require('node:path');
const DeckParser = require('../parser.js');

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
    // Almost every row is one swap. A row may declare a chain instead, and then
    // the chain is what has to add up: each step has to find the card it claims
    // to replace, in the list as the step before it left it, and the last step
    // has to land on the cards the row says it has. A row cannot quietly change
    // two cards under cover of naming one.
    const chain = row.swaps || [row.swap];
    assert.ok(chain.length && chain.every(Boolean), at + ': no swap stated');
    assert.ok(!(row.swaps && row.swap), at + ': states both a swap and a chain of them');
    let cards = row.from.cards.slice();
    chain.forEach((step, i) => {
      assert.ok(cards.includes(step.out), at + ': step ' + (i + 1) + ' replaces a card that is not there');
      cards = cards.map((c) => (c === step.out ? step.in : c));
    });
    assert.ok(row.cards.includes(chain[chain.length - 1].in), at + ': the last card swapped in is not in the result');
    assert.deepStrictEqual(
      cards.slice().sort(),
      row.cards.slice().sort(),
      at + ': the two card lists differ by more than the stated swaps'
    );
  });
});

// A chain is a weaker claim than a single swap and has to look like one on the
// page, so it is worth knowing how many rows make it. Every extra step is another
// judgement the reader is being asked to accept at once.
test('unofficial: a chained row is the exception, not the shape', () => {
  const chained = COMBOS.filter((r) => r.swaps);
  assert.ok(chained.length <= 3, chained.length + ' rows are more than one swap deep');
  chained.forEach((row) => {
    assert.strictEqual(row.swaps.length, 2, row.cards.join(' + ') + ': deeper than two swaps');
    // The second step has to be a stand-in rule rather than another judgement:
    // that is the whole argument for allowing a chain at all.
    const rule = STAND_INS.find((s) => nameKey(s.card) === nameKey(row.swaps[1].in));
    assert.ok(rule, row.cards.join(' + ') + ': the second swap is not a declared stand-in');
    assert.ok(
      rule.for.some((src) => nameKey(src.card) === nameKey(row.swaps[1].out)),
      row.cards.join(' + ') + ': ' + rule.card + ' does not stand in for ' + row.swaps[1].out
    );
  });
});

// The swapped-in card is the one name in the file with nothing behind it: the
// cited combo anchors `from.cards`, and `cards` is that list with the swaps
// applied, but the card coming *in* is only ever a string somebody typed. The id
// beside it is what tools/verify-unofficial.js reads it against, so the id has to
// be there — null is a real answer, meaning "the published data has no such card".
test('unofficial: every swap records the card id of what it swaps in', () => {
  COMBOS.forEach((row) => {
    const at = row.cards.join(' + ');
    (row.swaps || [row.swap]).forEach((step) => {
      assert.ok('inId' in step, at + ': no card id recorded for ' + step.in);
      assert.ok(step.inId === null || Number.isInteger(step.inId),
        at + ': ' + step.in + ' has a card id that is neither a number nor null');
    });
  });
  STAND_INS.forEach((rule) => {
    assert.ok('cardId' in rule, rule.card + ': no card id recorded');
    (rule.for || []).forEach((src) => {
      assert.ok('cardId' in src, rule.card + ': no card id recorded for ' + src.card);
      assert.ok(Number.isInteger(src.cardId), rule.card + ': ' + src.card + ' stands in for '
        + 'a card the published data does not name — a rule reads published combos only');
    });
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

// The rules are a list somebody will add to, and the combo list is 100,000 long.
// A per-rule scan would make every new rule cost another sweep of the database on
// every search anybody runs — so the rules are indexed by the cards they stand in
// for, and the database itself is walked once **per dataset** rather than once per
// call: combos.js builds a card -> combo index and keeps it on the combos array.
//
// This counts the walks rather than trusting the comment. The list is a real Array
// so it can be indexed, with a Symbol.iterator that counts each pass over it.
test('stand-in: the combo list is walked once per dataset, whatever the rules cost', () => {
  let passes = 0;
  const counted = OUTLET.combos.slice();
  const plain = counted[Symbol.iterator].bind(counted);
  Object.defineProperty(counted, Symbol.iterator, {
    configurable: true,
    value() { passes += 1; return plain(); },
  });
  const counting = Object.assign({}, OUTLET, { combos: counted });
  const names = deck('Copycat', 'Understudy', 'Gravecrawler', 'Scurry Oak', 'Sadistic Glee');

  standInRows(counting, [RULE], names);
  assert.strictEqual(passes, 1, 'one rule took ' + passes + ' passes over the combo list');

  // Ten rules, and the same dataset again. Zero now, not one: the index is built
  // once and kept, so the second search of a session does not walk the database at
  // all — which is the property the index exists for and the one a rewrite would
  // quietly lose while still returning the right rows.
  passes = 0;
  const many = [RULE].concat(Array.from({ length: 9 }, (unused, i) => ({
    card: 'Understudy',
    confidence: 'verified',
    for: [{ card: 'Twin ' + String.fromCharCode(65 + i), why: 'Another rule, for the count.' }],
  })));
  standInRows(counting, many, names);
  assert.strictEqual(passes, 0, 'ten rules took ' + passes + ' more pass(es) over the combo list');
});

// The suggestions half. A row the deck is one card short of is not a combo it
// has — it is a reason to add that card — so it is built only when asked for and
// comes back naming what it needs.
test('stand-in: with one card of slack, a combo the deck is short of comes back', () => {
  const rows = standInRows(OUTLET, [RULE], deck('Copycat', 'Scurry Oak'), null, 1);
  const row = rowFor(rows, 'Copycat', 'Scurry Oak', 'Sadistic Glee');
  assert.ok(row, 'the near miss was not generated');
  assert.strictEqual(row.from.id, '1-2-3');
  // matchUnofficial is what works out what is missing, from the row's own cards.
  assert.deepStrictEqual(
    matchUnofficial(OUTLET, [row], deck('Copycat', 'Scurry Oak'), [], 1)[0].needs,
    ['Sadistic Glee']
  );
});

// Hammerhead's own case, and the reason a deck without the stand-in cannot simply
// be skipped: the card worth suggesting is the stand-in itself.
test('stand-in: a deck without the card is told to add it', () => {
  const names = deck('Scurry Oak', 'Sadistic Glee', 'Gravecrawler');
  assert.deepStrictEqual(standInRows(OUTLET, [RULE], names), [], 'built without being asked');
  const rows = standInRows(OUTLET, [RULE], names, null, 1);
  const row = rowFor(rows, 'Copycat', 'Scurry Oak', 'Sadistic Glee');
  assert.ok(row, 'the deck was not told to add the stand-in');
  assert.deepStrictEqual(matchUnofficial(OUTLET, [row], names, [], 1)[0].needs, ['Copycat']);
});

test('stand-in: two cards short is still nothing, with slack or without', () => {
  const names = deck('Copycat');
  assert.deepStrictEqual(standInRows(OUTLET, [RULE], names, null, 1)
    .filter((r) => r.cards.filter((c) => !names.has(nameKey(c))).length > 1), []);
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

const { check, checkStandIns, checkCardIds, cardIndex, parseArgs } = require('../tools/verify-unofficial.js');

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

// ---- a real deck, against the real rows -------------------------------------
//
// Every other test here builds a two-card deck to exercise one branch. This one
// reads a decklist somebody actually plays — 103 cards, built to sit on top of
// this file — and pins what the panel gives it. That is a different kind of
// check: not "does matchUnofficial() do what it says" but "does the file, as
// written today, still reach the deck it was written for".
//
// It is deliberately an exact list rather than a count. A count moves when a row
// is added and says nothing about which; the list fails with the name of whatever
// appeared or vanished. Adding rows to unofficial.js is *expected* to change it —
// the five Necrosynthesis rows below are what this session added, and before them
// the same deck saw 39 — so a diff here is a prompt to read, not a break.
//
// The fixture is matched against a small stand-in dataset rather than the real
// 28 MB one: matchUnofficial() only consults it to drop rows Spellbook has since
// published, and an empty list of those is the honest state for these rows today.
// tools/verify-unofficial.js is what checks that claim against the live data.
const DECK_TEXT = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'chatterfang-deck.txt'), 'utf8'
);

test('a real deck: the fixture parses to its 103 maindeck cards, sideboard ignored', () => {
  const parsed = DeckParser.parseDecklist(DECK_TEXT);
  const entries = (parsed.commanders || []).concat(parsed.main || []);
  assert.strictEqual(entries.length, 103);
  // The sideboard is 27 cards plus two loose lines after it, and none of them
  // may reach the deck — Nadier's Nightblade sits there precisely because it
  // would otherwise light up rows the maindeck should not have.
  const names = deckNameSet(entries);
  assert.ok(!names.has(nameKey("Nadier's Nightblade")), 'a sideboard card reached the deck');
  assert.ok(!names.has(nameKey('Elvish Mystic')), 'a sideboard card reached the deck');
  assert.ok(names.has(nameKey('Chatterfang, Squirrel General')));
  assert.ok(names.has(nameKey('Lunarch Veteran')), 'the front face of a split card should match');
});

test('a real deck: the unofficial rows it unlocks are exactly these', () => {
  const parsed = DeckParser.parseDecklist(DECK_TEXT);
  const names = deckNameSet((parsed.commanders || []).concat(parsed.main || []));
  const rows = matchUnofficial({}, COMBOS, names, [], 0)
    .map((r) => r.c.join(' + ')).sort();

  assert.deepStrictEqual(rows, [
    "Animation Module + Ashnod's Altar + Heroic Feast + Aunt May",
    "Animation Module + Ashnod's Altar + Heroic Feast + Case of the Uneaten Feast",
    "Animation Module + Ashnod's Altar + Heroic Feast + Elas il-Kor, Sadistic Pilgrim",
    "Animation Module + Ashnod's Altar + Heroic Feast + Essence Warden",
    "Animation Module + Ashnod's Altar + Heroic Feast + Hinterland Sanctifier",
    "Animation Module + Ashnod's Altar + Heroic Feast + Lunarch Veteran // Luminous Phantom",
    "Animation Module + Ashnod's Altar + Heroic Feast + Prosperous Innkeeper",
    "Animation Module + Ashnod's Altar + Heroic Feast + Soul Warden",
    'Animation Module + Phyrexian Altar + Heroic Feast + Elas il-Kor, Sadistic Pilgrim',
    'Animation Module + Phyrexian Altar + Heroic Feast + Lunarch Veteran // Luminous Phantom',
    'Basking Broodscale + Archangel of Thune + Aunt May',
    'Basking Broodscale + Archangel of Thune + Elas il-Kor, Sadistic Pilgrim',
    // The one row the Broodscale sweep added that this deck can cast. The other 37
    // want cards it does not hold — which is the expected shape: the sweep looked
    // across the whole database, not across this deck.
    "Basking Broodscale + Ghave, Guru of Spores + Ashnod's Altar",
    'Basking Broodscale + Heliod, Sun-Crowned + Aunt May',
    'Basking Broodscale + Heliod, Sun-Crowned + Elas il-Kor, Sadistic Pilgrim',
    'Basking Broodscale + Heliod, Sun-Crowned + Lunarch Veteran // Luminous Phantom',
    // Four of the twelve rows the Cauldron Familiar + Peregrin Took token-slot sweep
    // added. The Cat, Took, Camellia and Trudge Garden are all in this deck already,
    // and so are three of the eleven outlets — the other eight rows want an outlet it
    // does not hold. Camellia's three are the ones to read if this list moves again:
    // she is in the slot because she answers the Food *sacrifice* rather than the Cat
    // leaving the graveyard, which is the same lap one step earlier.
    'Cauldron Familiar + Peregrin Took + Camellia, the Seedmiser + Carrion Feeder',
    'Cauldron Familiar + Peregrin Took + Camellia, the Seedmiser + Phyrexian Altar',
    'Cauldron Familiar + Peregrin Took + Camellia, the Seedmiser + Viscera Seer',
    "Cauldron Familiar + Peregrin Took + Trudge Garden + Ashnod's Altar",
    'Herd Baloth + Necrosynthesis + Carrion Feeder',
    'Herd Baloth + Necrosynthesis + Hammerhead, Maggia Boss',
    'Herd Baloth + Necrosynthesis + Umbral Collar Zealot',
    'Herd Baloth + Necrosynthesis + Viscera Seer',
    "Kitchen Finks + Ashnod's Altar + Heroic Feast",
    'Kitchen Finks + Heroic Feast + Bartolomé del Presidio',
    'Kitchen Finks + Heroic Feast + Carrion Feeder',
    'Kitchen Finks + Heroic Feast + Hammerhead, Maggia Boss',
    'Kitchen Finks + Heroic Feast + Phyrexian Altar',
    'Kitchen Finks + Heroic Feast + Umbral Collar Zealot',
    'Kitchen Finks + Viscera Seer + Heroic Feast',
    // The five this session added that this deck can actually assemble.
    "Necrosynthesis + Animation Module + Ashnod's Altar",
    'Necrosynthesis + Animation Module + Phyrexian Altar',
    'Necrosynthesis + Ghave, Guru of Spores + Phyrexian Altar',
    'Necrosynthesis + Herd Baloth + Bartolomé del Presidio',
    'Necrosynthesis + Scurry Oak + Bartolomé del Presidio',
    'Quina, Qu Gourmet + Warren Soultrader + Academy Manufactor',
    'Scurry Oak + Heroic Feast + Lunarch Veteran // Luminous Phantom',
    'Scurry Oak + Necrosynthesis + Carrion Feeder',
    'Scurry Oak + Necrosynthesis + Hammerhead, Maggia Boss',
    'Scurry Oak + Necrosynthesis + Umbral Collar Zealot',
    'Scurry Oak + Necrosynthesis + Viscera Seer',
    'Stridehangar Automaton + Warren Soultrader + Academy Manufactor',
    "Trudge Garden + Ashnod's Altar + Aunt May",
    "Trudge Garden + Ashnod's Altar + Case of the Uneaten Feast",
    'Trudge Garden + Pitiless Plunderer + Phyrexian Altar + Lunarch Veteran // Luminous Phantom',
    'Warren Soultrader + Chatterfang, Squirrel General + Aunt May',
    'Warren Soultrader + Chatterfang, Squirrel General + Case of the Uneaten Feast',
    'Warren Soultrader + Stridehangar Automaton + Aunt May',
    'Warren Soultrader + Stridehangar Automaton + Case of the Uneaten Feast',
  ].sort());
});

// The Chatterfang rows name cards this deck does not hold, which is the point of
// checking: a row that fires for every deck is a row matching on something too
// loose. These need exactly one card each, and the panel says which. Three are
// the gainers this session added; Virulent Emissary was already here, and it
// belongs in the list for the same reason the others do.
test('a real deck: the Chatterfang rows are each one card away', () => {
  const parsed = DeckParser.parseDecklist(DECK_TEXT);
  const names = deckNameSet((parsed.commanders || []).concat(parsed.main || []));
  const away = matchUnofficial({}, COMBOS, names, [], 1)
    .filter((r) => (r.needs || []).length === 1 && r.c.includes('Chatterfang, Squirrel General'))
    .map((r) => r.needs[0]).sort();
  assert.deepStrictEqual(away,
    ['Anointer Priest', 'Dazzling Angel', 'Pactdoll Terror', 'Virulent Emissary']);
});

// ---- the card id beside the name -------------------------------------------
//
// The failure this exists for cannot be reached by any other check: a card
// misspelled where it is swapped *in* names nothing, matches no deck, and reads on
// the page exactly like a card that simply nobody plays. The id is the second
// opinion, and these prove it is actually consulted.

const CARDS = cardIndex({
  names: ['Scurry Oak', 'Necrosynthesis', 'Viscera Seer', 'Sadistic Glee'],
  cardIds: [4186, 1628, 2292, 2082],
});
const idRow = (over) => Object.assign({
  cards: ['Scurry Oak', 'Necrosynthesis', 'Viscera Seer'],
  from: { id: '1-2-3', cards: ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'] },
  swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
}, over);

test('card ids: a swap whose name and id agree is fine', () => {
  assert.deepStrictEqual(checkCardIds(CARDS, [idRow()], []), []);
});

test('card ids: a card id the data does not have is caught', () => {
  const out = checkCardIds(CARDS, [idRow({
    swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 9999 },
  })], []);
  assert.strictEqual(out.length, 1);
  assert.match(out[0], /does not have/);
});

// The one the id exists for: upstream renames the card, the name stops matching
// anything, and without the id nothing would say why.
test('card ids: an id that now carries a different name is caught', () => {
  const out = checkCardIds(CARDS, [idRow({
    swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 2292 },
  })], []);
  assert.strictEqual(out.length, 1);
  assert.match(out[0], /is now "Viscera Seer"/);
});

// null is a claim, not a blank: it says the published data has no such card. That
// is Hammerhead's whole position, and it stops being true one day.
test('card ids: null on a card the data does not name is fine', () => {
  const out = checkCardIds(CARDS, [idRow({
    cards: ['Scurry Oak', 'Hammerhead, Maggia Boss', 'Viscera Seer'],
    swap: { out: 'Sadistic Glee', in: 'Hammerhead, Maggia Boss', inId: null },
  })], []);
  assert.deepStrictEqual(out, []);
});

test('card ids: null on a card the data now names is reported', () => {
  const out = checkCardIds(CARDS, [idRow({
    swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: null },
  })], []);
  assert.strictEqual(out.length, 1);
  assert.match(out[0], /now names it \(id 1628\)/);
});

test('card ids: the stand-in rules are read the same way', () => {
  const out = checkCardIds(CARDS, [], [{
    card: 'Hammerhead, Maggia Boss',
    cardId: null,
    for: [{ card: 'Viscera Seer', cardId: 4186 }],
  }]);
  assert.strictEqual(out.length, 1);
  assert.match(out[0], /is now "Scurry Oak"/);
});

// A payload with no tables — the fixtures, and any older local combos.json — has
// no ids to read, and that is not a failure. It is the same no-op decode() makes.
test('card ids: a payload without the tables is skipped, not failed', () => {
  assert.strictEqual(cardIndex({ combos: [] }), null);
  assert.deepStrictEqual(checkCardIds(null, [idRow()], []), []);
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

// ---- --graduated, the half of the report nobody was reading ------------------
//
// A broken citation fails the nightly job and is impossible to miss. A row
// Spellbook has *since published* exits 0 and prints into the step summary of a job
// that passed, which is the same as not reporting it — so the list is also written
// as JSON and update-data.yml turns it into a standing issue. The flag has to work
// whichever side of the snapshot path it lands on, because a workflow that has to
// remember the order will get it wrong once and write the report over combos.json.
test('args: the snapshot alone', () => {
  assert.deepStrictEqual(parseArgs(['combos.json']),
    { snapshot: 'combos.json', graduatedOut: null });
});

test('args: --graduated on either side of the snapshot', () => {
  assert.deepStrictEqual(parseArgs(['combos.json', '--graduated', 'out.json']),
    { snapshot: 'combos.json', graduatedOut: 'out.json' });
  assert.deepStrictEqual(parseArgs(['--graduated', 'out.json', 'combos.json']),
    { snapshot: 'combos.json', graduatedOut: 'out.json' });
});

test('args: --graduated without a snapshot still fetches the live data', () => {
  assert.deepStrictEqual(parseArgs(['--graduated', 'out.json']),
    { snapshot: undefined, graduatedOut: 'out.json' });
});

test('args: nothing at all', () => {
  assert.deepStrictEqual(parseArgs([]), { snapshot: undefined, graduatedOut: null });
});

// ---- what the file costs the page --------------------------------------------
//
// `unofficial.js` is the largest single script the page loads and it only grows:
// rows go in by hand, and the only thing that ever takes one out is Spellbook
// publishing it. So the README writes down the size at which it stops being source
// and becomes data on the `data` branch, along with what that costs — and this is
// the mechanism, because a threshold nobody measures is the "please remember" note
// this repository has already replaced twice.
//
// Gzipped, not raw: the reader waits for the wire size, and GitHub Pages compresses.
// Ceiling rather than a pinned size, and that distinction is what makes this safe to
// run in CI: a compressed length depends on the zlib build, so asserting today's exact
// figure would be a check that can go red on a Node upgrade rather than on anything
// anybody did. A ceiling with room to spare cannot — the same reason the coverage
// numbers are floors set a point under, rather than equalities.
//
// Crossing it is not a bug and this test failing is not a defect. It is the moment
// the decision in the README comes due, and the failure message says so.
const zlib = require('node:zlib');

// Raised from 50 KB, deliberately, which is what the failure message below asks for. The
// reasoning is in the README section named there; the short version is that this file is
// `importScripts`'d by the worker and is in no HTML, so it is never parsed on the main
// thread — it delays a first search that is already waiting on a 1.28 MB database, not a
// first paint. 43 KB today, and one four-card sweep has cost 14 KB, so this is a dozen
// passes of headroom rather than a hundred.
const MOVE_TO_DATA_BRANCH_AT = 200 * 1024;

test('unofficial.js is still small enough to ship as source', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'unofficial.js'));
  const wire = zlib.gzipSync(source, { level: 9 }).length;
  assert.ok(
    wire < MOVE_TO_DATA_BRANCH_AT,
    `unofficial.js is ${wire} bytes gzipped, at or past the ${MOVE_TO_DATA_BRANCH_AT}-byte `
    + 'threshold. Nothing is broken — this is the decision in the README\'s "What the file '
    + 'costs, and the size at which it stops being source" coming due. Move COMBOS to the '
    + 'data branch as JSON, or move the threshold on purpose and say why.',
  );
});

// ---- the order the panel is drawn in ----------------------------------------
//
// matchUnofficial() sorts before search.js expands, which is the trap: variantCardNames()
// read `uses` alone, and these rows carry `c`. So the sort compared every row's drawn name
// as '' against '', found no row sharing cards with any other, and handed back 46 rows in
// the order they happen to sit in unofficial.js. Nothing failed. Combo size still
// separated them, because comboSize() worked around the shape at its own call site, so the
// panel looked ordered — 2-card rows, then 3-card rows — and inside a size it was the file.
//
// The rows are one shape short of the panel's real ones on purpose: this is exactly the
// pre-expand shape matchUnofficial() hands back, which is the shape that broke.
test('unofficial: the panel is ordered by what its rows draw, before anything expands', () => {
  const dataset = { cardIdentity: { A: 'G', B: 'G', M: 'G', X: 'G', Y: 'G', Z: 'G' } };
  const row = (...cards) => ({
    cards,
    produces: ['Infinite tokens'],
    confidence: 'derived',
    from: { id: '1-2-3', cards: ['A', 'B'] },
    swap: { out: 'B', in: cards[cards.length - 1] },
    why: 'For the ordering, not the reasoning.',
  });
  // A family of three sharing [A, B], with a row about other cards dropped in the middle
  // of the file to sort between them if the order is the file's rather than the panel's.
  const rows = [row('A', 'B', 'X'), row('M', 'Z', 'Z2'), row('A', 'B', 'Y'), row('A', 'B', 'Z')];
  const names = deck('A', 'B', 'M', 'X', 'Y', 'Z', 'Z2');

  const drawn = matchUnofficial(dataset, rows, names, []).map((v) => v.c.join(' + '));
  assert.deepStrictEqual(drawn, [
    'A + B + X',
    'A + B + Y',
    'A + B + Z',
    'M + Z + Z2',
  ], 'the family is together and the odd row follows, whatever order the file holds');
});

// The root cause, asked directly. Two shapes, one contract — the same one comboSize()
// documents. A caller holding a compact row used to get an empty list, which is not an
// error and not a zero: it is a value every ordering rule accepts.
test('unofficial: a combo names its cards in either shape, compact or expanded', () => {
  const compact = { id: '1', c: ['Scurry Oak', 'Viscera Seer'], p: ['Infinite scry 1'] };
  assert.deepStrictEqual(variantCardNames(compact), ['Scurry Oak', 'Viscera Seer']);
  assert.deepStrictEqual(variantCardNames(expand(compact)), ['Scurry Oak', 'Viscera Seer']);
  assert.strictEqual(comboSize(compact), comboSize(expand(compact)));
  // And the shapes nothing should throw on.
  assert.deepStrictEqual(variantCardNames(null), []);
  assert.deepStrictEqual(variantCardNames({}), []);
});
