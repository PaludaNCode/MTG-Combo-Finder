'use strict';
// What a card costs: the lookup, the total, and every sentence around them.
//
// The rule this whole feature turns on is that **an absent price is not zero**. A missing
// figure read as free would put exactly the cards nobody can buy at the top of a cheapest
// ranking, and it would look like a working feature — so most of what is pinned here is the
// gap rather than the number.
const test = require('node:test');
const assert = require('node:assert');
const Prices = require('../prices.js');
const DeckView = require('../view-model.js');

const TABLE = {
  generated: '2026-08-14',
  updatedAt: '2026-08-14T00:00:00Z',
  currency: 'usd',
  named: 4,
  count: 3,
  usd: { 'sol ring': 1.5, 'rings of brighthearth': 19, 'basalt monolith': 0.99 },
};

test.beforeEach(() => Prices.__reset());

// ---- the lookup -------------------------------------------------------------

test('of: a card is found by the same name key every other lookup uses', () => {
  Prices.__setTable(TABLE);
  assert.strictEqual(Prices.of('Sol Ring'), 1.5);
  // The deck's own spelling is not normalised, so the lookup has to be.
  assert.strictEqual(Prices.of('  SOL   Ring '), null, 'inner spacing is not normalised by nameKey');
  assert.strictEqual(Prices.of('sol ring'), 1.5);
});

test('of: a front face answers for a double-faced card, as nameKey defines it', () => {
  Prices.__setTable({ usd: { 'lunarch veteran': 0.4 } });
  assert.strictEqual(Prices.of('Lunarch Veteran // Luminous Phantom'), 0.4);
});

test('of: absent is null, never zero', () => {
  Prices.__setTable(TABLE);
  assert.strictEqual(Prices.of('Mox Diamond'), null);
  assert.strictEqual(Prices.of(''), null);
  assert.strictEqual(Prices.of(null), null);
});

test('of: a zero or negative figure in the file is treated as no price', () => {
  Prices.__setTable({ usd: { 'free card': 0, 'broken card': -2 } });
  assert.strictEqual(Prices.of('Free Card'), null, 'a $0 card is a data error, not a bargain');
  assert.strictEqual(Prices.of('Broken Card'), null);
});

test('of: with no table at all, every card is unpriced', () => {
  assert.strictEqual(Prices.loaded(), false);
  assert.strictEqual(Prices.of('Sol Ring'), null);
});

// ---- the fetch --------------------------------------------------------------
//
// The page must be correct when this file does not exist, which is every local checkout —
// so "the request failed" is a supported state and not an error path.

test('load: a table that arrives is used', async () => {
  const url = 'https://example.invalid/prices.json';
  global.fetch = async () => ({ ok: true, json: async () => TABLE });
  const got = await Prices.load(url);
  assert.strictEqual(got.count, 3);
  assert.strictEqual(Prices.of('Sol Ring'), 1.5);
});

test('load: a 404 leaves the page with no figures and no error', async () => {
  global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  assert.strictEqual(await Prices.load('x'), null);
  assert.strictEqual(Prices.loaded(), false);
});

test('load: a network failure is silent', async () => {
  global.fetch = async () => { throw new Error('offline'); };
  assert.strictEqual(await Prices.load('x'), null);
});

test('load: a payload with no table is refused rather than half-used', async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({ generated: '2026-08-14' }) });
  assert.strictEqual(await Prices.load('x'), null);
  assert.strictEqual(Prices.loaded(), false, 'a table-less payload must not count as loaded');
});

test('load: two callers share one request', async () => {
  let calls = 0;
  global.fetch = async () => { calls += 1; return { ok: true, json: async () => TABLE }; };
  await Promise.all([Prices.load('x'), Prices.load('x')]);
  assert.strictEqual(calls, 1, 'every search calls load(); only the first may fetch');
});

// ---- the basket total -------------------------------------------------------

test('totalOf: sums what it can and counts what it cannot', () => {
  Prices.__setTable(TABLE);
  const total = Prices.totalOf([
    { card: 'Sol Ring', quantity: 1 },
    { card: 'Rings of Brighthearth', quantity: 1 },
    { card: 'Mox Diamond', quantity: 1 },
  ]);
  assert.strictEqual(total.sum, 20.5);
  assert.strictEqual(total.priced, 2);
  assert.strictEqual(total.unpriced, 1);
});

test('totalOf: quantity counts', () => {
  Prices.__setTable(TABLE);
  assert.strictEqual(Prices.totalOf([{ card: 'Sol Ring', quantity: 4 }]).sum, 6);
  // A missing or nonsense quantity is one card, not none.
  assert.strictEqual(Prices.totalOf([{ card: 'Sol Ring' }]).sum, 1.5);
});

test('totalOf: an unpriced basket is not a free basket', () => {
  Prices.__setTable(TABLE);
  const total = Prices.totalOf([{ card: 'Mox Diamond', quantity: 1 }]);
  assert.strictEqual(total.sum, 0);
  assert.strictEqual(total.priced, 0);
  assert.strictEqual(
    DeckView.basketPriceNote(total),
    null,
    'nothing priced means no sentence — "About $0" would read as a free basket'
  );
});

test('totalOf: with no table there is nothing to say', () => {
  const total = Prices.totalOf([{ card: 'Sol Ring', quantity: 1 }]);
  assert.strictEqual(total.known, false);
  assert.strictEqual(DeckView.basketPriceNote(total), null);
});

// ---- the wording ------------------------------------------------------------

test('priceLabel: two decimals always, so the column lines up', () => {
  assert.strictEqual(DeckView.priceLabel(4).text, '$4.00');
  assert.strictEqual(DeckView.priceLabel(0.5).text, '$0.50');
  assert.strictEqual(DeckView.priceLabel(19.999).text, '$20.00');
});

test('priceLabel: absent says so, and is marked as not a figure', () => {
  const label = DeckView.priceLabel(null);
  assert.strictEqual(label.text, 'no price');
  assert.strictEqual(label.known, false);
  assert.doesNotMatch(label.text, /0|free/i, 'the one thing it must not read as');
});

test('priceTitle: says which printing, which currency, and which day', () => {
  const title = DeckView.priceTitle(4, '2026-08-14');
  assert.match(title, /cheapest non-foil printing/);
  assert.match(title, /US dollars/);
  assert.match(title, /before postage/);
  assert.match(title, /2026-08-14/, 'a price with no date is a claim about now');
});

test('priceTitle: the absent case explains itself and rules out free', () => {
  const title = DeckView.priceTitle(null, '2026-08-14');
  assert.match(title, /no non-foil printing/);
  assert.match(title, /Not the same as free/);
});

test('priceTitle: an undated table still says the rest', () => {
  assert.doesNotMatch(DeckView.priceTitle(4, null), /prices from/);
  assert.match(DeckView.priceTitle(4, null), /before postage\./);
});

test('basketPriceNote: about, never exact', () => {
  const note = DeckView.basketPriceNote({ known: true, priced: 5, unpriced: 0, sum: 46.75 });
  assert.match(note, /^About \$47 /, `a snapshot of cheapest printings cannot support $46.75: ${note}`);
  assert.match(note, /5 cards priced here/);
  assert.match(note, /before postage/);
});

test('basketPriceNote: a small total keeps its pennies', () => {
  const note = DeckView.basketPriceNote({ known: true, priced: 2, unpriced: 0, sum: 1.49 });
  assert.match(note, /About \$1\.49/, 'rounding a $1.49 basket to $1 is a worse lie than the pennies');
});

test('basketPriceNote: says when the total is short', () => {
  const note = DeckView.basketPriceNote({ known: true, priced: 4, unpriced: 2, sum: 12 });
  assert.match(note, /2 of them have no price/);
  assert.match(note, /the total is short/, 'a total quietly missing two cards is worse than no total');
  const one = DeckView.basketPriceNote({ known: true, priced: 4, unpriced: 1, sum: 12 });
  assert.match(one, /1 of them has no price/);
});

test('basketPriceNote: one card reads as one card', () => {
  const note = DeckView.basketPriceNote({ known: true, priced: 1, unpriced: 0, sum: 3 });
  assert.match(note, /for the card priced here/);
});
