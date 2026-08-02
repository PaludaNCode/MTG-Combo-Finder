'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { check, claims, parse } = require('../tools/check-readme-numbers.js');

// The README states real counts, and CLAUDE.md has carried a note asking people to
// remember that when they change a data file. This is that note, mechanised.

const claim = (over) => Object.assign({
  what: 'widgets',
  is: 63,
  find: /All ([\d,]+) widgets/g,
  source: 'widgets.js',
}, over);

test('a claim that matches the file passes', () => {
  assert.deepStrictEqual(check('All 63 widgets are here.', [claim()]), []);
});

test('a number that has moved is reported with both sides', () => {
  const problems = check('All 62 widgets are here.', [claim()]);
  assert.strictEqual(problems.length, 1);
  assert.match(problems[0], /widgets: the README says 62, widgets\.js has 63/);
});

// The half that makes the whole thing worth having. A checker that finds no claim
// and exits 0 reports success for work it did not do — it converts "nobody verified
// this" into "this was verified", which is worse than not having a checker.
test('phrasing edited out from under a check is a failure, not a pass', () => {
  const problems = check('We have a good number of widgets.', [claim()]);
  assert.strictEqual(problems.length, 1);
  assert.match(problems[0], /no longer contains the phrasing this check anchors on/);
  assert.match(problems[0], /Re-anchor it or drop the claim/);
});

test('every occurrence is checked, not just the first', () => {
  const readme = 'All 63 widgets here. Later: All 61 widgets.';
  const problems = check(readme, [claim()]);
  assert.strictEqual(problems.length, 1);
  assert.match(problems[0], /says 61/);
});

test('thousands separators are read as numbers', () => {
  assert.strictEqual(parse('12,472'), 12472);
  assert.strictEqual(parse('1,079'), 1079);
  assert.strictEqual(parse('63'), 63);
  assert.deepStrictEqual(
    check('All 12,472 widgets are here.', [claim({ is: 12472 })]),
    []
  );
});

// A count small enough to be written as a word still has to be checked, because the
// sentence around it is what breaks: the day there are two stand-in rules, "the one
// stand-in rule" is prose that has quietly become false.
test('a number spelled as a word is checked too', () => {
  const spelled = claim({
    what: 'rules',
    is: 1,
    find: /the (one) rule/g,
    spelled: { one: 1 },
  });
  assert.deepStrictEqual(check('and the one rule applies', [spelled]), []);
  assert.match(check('and the one rule applies', [Object.assign({}, spelled, { is: 2 })])[0], /says one/);
});

test('several broken claims are all reported, not just the first', () => {
  const problems = check('All 1 widgets. All 2 gadgets.', [
    claim(),
    claim({ what: 'gadgets', is: 9, find: /All ([\d,]+) gadgets/g, source: 'gadgets.js' }),
  ]);
  assert.strictEqual(problems.length, 2);
});

// ---- against the real README ------------------------------------------------

test('every claim anchors on phrasing the README actually contains', () => {
  const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  for (const c of claims()) {
    const found = [...readme.matchAll(c.find)];
    assert.ok(found.length, `${c.what}: ${c.find.source} matches nothing in the README`);
  }
});

test('the README agrees with the files it describes', () => {
  const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  assert.deepStrictEqual(check(readme, claims()), []);
});

// Only what this repository can count. Anything measured against the published
// database is a snapshot of somebody else's data on a particular morning, and
// pinning it would mean a red build every time Spellbook published a combo.
test('nothing is anchored on the published snapshot', () => {
  const sources = claims().map((c) => c.source).join(' ');
  assert.doesNotMatch(sources, /combos\.json|data branch/i);
});
