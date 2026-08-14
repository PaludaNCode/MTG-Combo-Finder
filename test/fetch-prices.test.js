'use strict';
// The price fetcher, which cannot be run live from this sandbox at all — every Scryfall
// host is 403 at CONNECT — so this is the whole of what says it works. The nightly job is
// the first live run of anything changed here.
//
// The four decisions it makes, and each is a way to be confidently wrong:
//   which file      default_cards, one object per printing, not the wording file
//   which printing  the cheapest, not the representative one
//   which price     non-foil USD, and no figure at all rather than a foil one
//   whether to publish at all — a short file replaces a working one irrecoverably
const test = require('node:test');
const assert = require('node:assert');
const { cheapest, publish, comboCardKeys, round, PRICED_FLOOR } = require('../tools/fetch-prices.js');
const { pickBulk } = require('../tools/scryfall-bulk.js');

const card = (name, usd, over) => Object.assign({
  name, layout: 'normal', lang: 'en', prices: { usd },
}, over || {});

const wanted = (...names) => new Map(names.map((n) => [n.toLowerCase(), n]));

// ---- which printing ---------------------------------------------------------

test('cheapest: the lowest price across printings wins', () => {
  const found = cheapest(
    [card('Sol Ring', '12.50'), card('Sol Ring', '1.25'), card('Sol Ring', '3.00')],
    wanted('sol ring')
  );
  assert.strictEqual(found.usd.get('sol ring'), 1.25);
  assert.strictEqual(found.printings, 3);
});

// The reason this reads default_cards rather than the file the text cache reads: oracle_cards
// carries one printing's price per card, and it can be the expensive one.
test('pickBulk: prices ask for default_cards, wording asks for oracle_cards', () => {
  const menu = { data: [{ type: 'oracle_cards' }, { type: 'default_cards' }] };
  assert.strictEqual(pickBulk(menu, 'default_cards').type, 'default_cards');
  assert.strictEqual(pickBulk(menu).type, 'oracle_cards', 'the default is unchanged');
});

test('pickBulk: a renamed prices file is still found, and the error names the menu', () => {
  assert.strictEqual(
    pickBulk({ data: [{ type: 'default_cards_v2' }] }, 'default_cards').type,
    'default_cards_v2'
  );
  assert.throws(
    () => pickBulk({ data: [{ type: 'rulings' }] }, 'default_cards'),
    /default-cards.*rulings/s
  );
});

// ---- which price ------------------------------------------------------------

test('cheapest: a foil-only card gets no figure rather than its foil price', () => {
  const found = cheapest(
    [card('Foil Only', null, { prices: { usd: null, usd_foil: '30.00' } })],
    wanted('foil only')
  );
  assert.strictEqual(found.usd.has('foil only'), false, 'a foil figure beside a non-foil one is not a comparison');
});

// Number('') is 0, so this is the line between "no price" and a free Mox Diamond.
test('cheapest: an empty or unparseable price is not zero', () => {
  const found = cheapest([
    card('Empty', ''),
    card('Missing', undefined),
    card('Nonsense', 'ask'),
    card('Zero', '0.00'),
  ], wanted('empty', 'missing', 'nonsense', 'zero'));
  assert.strictEqual(found.usd.size, 0);
});

test('cheapest: tokens and non-English printings are skipped and counted', () => {
  const found = cheapest([
    card('Walking Ballista', '9.99'),
    card('Walking Ballista', '0.01', { layout: 'token' }),
    card('Walking Ballista', '1.00', { lang: 'de' }),
  ], wanted('walking ballista'));
  assert.strictEqual(found.usd.get('walking ballista'), 9.99);
  assert.strictEqual(found.skipped, 2);
  assert.strictEqual(found.printings, 1);
});

// ---- which cards ------------------------------------------------------------

test('comboCardKeys: only the cards a combo names, keyed the way the page looks them up', () => {
  const keys = comboCardKeys({ combos: [{ c: ['Sol Ring', 'Basalt Monolith'] }, { c: ['Sol Ring'] }] });
  assert.deepStrictEqual([...keys.keys()].sort(), ['basalt monolith', 'sol ring']);
  assert.strictEqual(keys.get('sol ring'), 'Sol Ring', 'the display name is kept for the report');
});

test('cheapest: a card no combo names is not carried', () => {
  const found = cheapest([card('Sol Ring', '1.25'), card('Shivan Dragon', '0.50')], wanted('sol ring'));
  assert.strictEqual(found.usd.size, 1, 'nothing outside the combo database can ever be suggested');
});

// ---- the file ---------------------------------------------------------------

test('publish: sorted keys, so a nightly diff is readable', () => {
  const found = cheapest([card('Zzz', '1.00'), card('Aaa', '2.00')], wanted('zzz', 'aaa'));
  const out = publish(wanted('zzz', 'aaa'), found, { type: 'default_cards', updatedAt: 'x' });
  assert.deepStrictEqual(Object.keys(out.usd), ['aaa', 'zzz']);
});

test('publish: coverage is stated, not implied', () => {
  const keys = wanted('priced', 'unpriced');
  const found = cheapest([card('Priced', '1.00')], keys);
  const out = publish(keys, found, null);
  assert.strictEqual(out.named, 2);
  assert.strictEqual(out.count, 1);
  assert.strictEqual(out.currency, 'usd');
});

test('round: pennies, and no floating-point tails', () => {
  assert.strictEqual(round(1.005), 1);
  assert.strictEqual(round(0.1 + 0.2), 0.3);
  assert.strictEqual(round(19.999), 20);
});

// The guard exists because the data branch is one force-pushed orphan commit: a short file
// does not sit beside the good one, it replaces it.
test('the floor is a share of the named cards, well below a healthy run', () => {
  assert.ok(PRICED_FLOOR > 0.5 && PRICED_FLOOR < 0.9, `implausible floor: ${PRICED_FLOOR}`);
});
