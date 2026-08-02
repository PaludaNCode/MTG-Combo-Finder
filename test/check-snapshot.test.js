'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { compare, checkShape } = require('../tools/check-snapshot.js');

// The publish gate on the nightly refresh. Worth testing carefully for a reason
// that has nothing to do with how complicated it is: the `data` branch is one
// orphan commit, force-pushed, so a bad snapshot getting through does not leave a
// previous version to go back to. This is the only thing standing between a bad
// morning upstream and the published database.

const row = (id) => ({ id, c: ['Basalt Monolith'], p: ['Infinite colorless mana'], i: 'C' });

function snapshot(n, extra) {
  return Object.assign({
    updatedAt: '2026-08-02T06:48:06.618Z',
    combos: Array.from({ length: n }, (_, i) => row('id-' + i)),
    cardIdentity: Object.fromEntries(Array.from({ length: n }, (_, i) => ['Card ' + i, 'C'])),
    gameChangers: ['Sol Ring'],
    templateCards: { 'Basalt Monolith': [1] },
  }, extra);
}

const fails = (result) => result.failures.join(' | ');

test('an ordinary day passes', () => {
  const { failures } = compare(snapshot(1000), snapshot(995));
  assert.deepStrictEqual(failures, []);
});

test('growth is never a failure', () => {
  const { failures } = compare(snapshot(5000), snapshot(1000));
  assert.deepStrictEqual(failures, []);
});

// 10% of 103,737 is ten thousand combos vanishing overnight. That is not churn.
test('a big drop is refused, and says which count and by how much', () => {
  const { failures } = compare(snapshot(800), snapshot(1000));
  assert.match(fails({ failures }), /combos fell 20\.0%/);
});

test('a drop just inside the limit is allowed', () => {
  const { failures } = compare(snapshot(910), snapshot(1000));
  assert.deepStrictEqual(failures, []);
});

test('the limit is adjustable, because the right number is a judgement', () => {
  assert.deepStrictEqual(compare(snapshot(910), snapshot(1000), { maxDrop: 0.5 }).failures, []);
  assert.match(fails(compare(snapshot(990), snapshot(1000), { maxDrop: 0.005 })), /combos fell/);
});

// Each of these is a whole subsystem going quietly dark rather than loudly wrong:
// no identities means no colour filtering, no Game Changers means every bracket
// check silently downgrades, no template cards means every slot stops resolving.
test('the other three counts are guarded too', () => {
  const previous = snapshot(1000);

  const noIdentity = snapshot(1000, { cardIdentity: {} });
  assert.match(fails(compare(noIdentity, previous)), /card identities fell 100/);

  const noChangers = snapshot(1000, { gameChangers: [] });
  assert.match(fails(compare(noChangers, previous)), /Game Changers fell 100/);

  const noTemplates = snapshot(1000, { templateCards: {} });
  assert.match(fails(compare(noTemplates, previous)), /template cards fell 100/);
});

// The first run on a fresh repository is the one run that must not be blocked by a
// comparison it cannot make.
test('with nothing published yet, it reports and passes', () => {
  const { lines, failures } = compare(snapshot(1000), null);
  assert.deepStrictEqual(failures, []);
  assert.ok(lines.some((l) => /nothing published yet/.test(l)));
});

test('the report names the before, the after and the change', () => {
  const { lines } = compare(snapshot(1200), snapshot(1000));
  assert.ok(lines.some((l) => /combos: 1,000 → 1,200 \(\+200, 20\.0%\)/.test(l)), lines.join('\n'));
});

// ---- shape -----------------------------------------------------------------
//
// A renamed field upstream does not error. It produces rows the page renders as
// blank, and the first report of it is somebody looking at an empty combo.

test('a sound snapshot has nothing to say about its shape', () => {
  assert.deepStrictEqual(checkShape(snapshot(10)), []);
});

test('rows missing what the page reads are counted, by field', () => {
  const data = snapshot(3);
  delete data.combos[0].id;
  data.combos[1].c = [];
  data.combos[2].i = undefined;
  delete data.combos[2].p;
  const problems = checkShape(data).join(' | ');
  assert.match(problems, /1 row\(s\) with no usable `id`/);
  assert.match(problems, /1 row\(s\) with no usable `c`/);
  assert.match(problems, /1 row\(s\) with no usable `i`/);
  assert.match(problems, /1 row\(s\) with no usable `p`/);
});

test('an empty or absent combos array is a shape problem, not a small one', () => {
  assert.match(checkShape({ updatedAt: 'x', combos: [] }).join(' '), /no combos array/);
  assert.match(checkShape({ updatedAt: 'x' }).join(' '), /no combos array/);
});

test('a snapshot with no updatedAt is refused — the footer reads that field', () => {
  const data = snapshot(5);
  delete data.updatedAt;
  assert.match(checkShape(data).join(' '), /no updatedAt/);
});

// The shape check runs as part of compare(), so a well-sized file full of unusable
// rows is caught by the same gate as a small one.
test('shape problems fail the comparison even when every count grew', () => {
  const broken = snapshot(2000);
  for (const r of broken.combos) delete r.p;
  assert.match(fails(compare(broken, snapshot(1000))), /no usable `p`/);
});

// ---- the interned payload --------------------------------------------------
//
// This gate runs on the file as published, where `c` and `p` hold indices into two
// string tables. Refusing to read that shape would mean the check stops working on
// the day the payload changes, which is the day it matters most.

const internedSnapshot = (n, extra) => Object.assign({
  updatedAt: '2026-08-02T06:48:06.618Z',
  names: ['Basalt Monolith'],
  results: ['Infinite colorless mana'],
  combos: Array.from({ length: n }, (_, i) => ({ id: 'id-' + i, c: [0], p: [0], i: 'C' })),
  cardIdentity: Object.fromEntries(Array.from({ length: n }, (_, i) => ['Card ' + i, 'C'])),
  gameChangers: ['Sol Ring'],
  templateCards: { 'Basalt Monolith': [1] },
}, extra);

test('the interned shape passes on its own terms', () => {
  assert.deepStrictEqual(checkShape(internedSnapshot(100)), []);
});

// The failure this is really for. Indices that point past the end of the table
// parse fine, pass a length check, and render as nothing at all.
test('an index that lands nowhere is caught', () => {
  const data = internedSnapshot(3);
  data.combos[0].c = [7];
  data.combos[1].p = [9];
  const problems = checkShape(data).join(' | ');
  assert.match(problems, /1 row\(s\) with no usable `c`/);
  assert.match(problems, /1 row\(s\) with no usable `p`/);
});

// One line, not 103,737 of them: a table going missing takes every row with it.
test('a missing table is reported once', () => {
  const data = internedSnapshot(50);
  delete data.names;
  const problems = checkShape(data).join(' | ');
  assert.match(problems, /rows index a `names` table that is not in the payload/);
});

test('the tables are counted, so one shrinking is noticed', () => {
  const previous = internedSnapshot(1000);
  const next = internedSnapshot(1000, { names: [] });
  assert.match(fails(compare(next, previous)), /interned card names fell 100/);
});

// The first publish of the new shape compares against a payload that has no tables
// at all. Gaining a count is not a regression.
test('gaining the tables is growth, not a drop', () => {
  const previous = snapshot(1000); // plain strings, no tables
  const { failures } = compare(internedSnapshot(1000), previous);
  assert.deepStrictEqual(failures, []);
});
