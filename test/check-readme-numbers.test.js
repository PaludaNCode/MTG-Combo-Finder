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

// ---- a number restated inside its own sentence -------------------------------
//
// The hole this closes: an anchor checks the instance it matched and nothing else,
// and this README's normal style is to give a figure in bold and then refer back to
// it. `main` once carried "**264 candidates have been read** … and which 183 is no
// longer a matter of reading the prose above" — the sentence disagreeing with itself
// by 81 — and the checker passed, correctly by its own rules, because the second
// number is not inside the anchor.

test('a number restated in the same sentence is checked too', () => {
  const problems = check('All 63 widgets are here, and which 62 is not in doubt.', [claim()]);
  assert.strictEqual(problems.length, 1);
  assert.match(problems[0], /restates it as "which 62"/);
  assert.match(problems[0], /widgets\.js has 63/);
});

test('a restatement that agrees is not a problem', () => {
  assert.deepStrictEqual(
    check('All 63 widgets are here, and which 63 is not in doubt.', [claim()]),
    []
  );
});

// The whole reason the scan is grammatical rather than positional. A sentence is
// free to carry other numbers — 137 verified against 25 derived, or a table row with
// a before and an after column — and flagging those would make the check unusable.
test('an unrelated number in the same sentence is left alone', () => {
  assert.deepStrictEqual(
    check('All 63 widgets are here, 40 of them blue and 23 of them red.', [claim()]),
    []
  );
  assert.deepStrictEqual(
    check('| Widgets | 148 | All 63 widgets | 12 |', [claim()]),
    []
  );
});

// The README wraps mid-sentence, so a single newline cannot end a sentence — the
// drift that shipped sat on the line after its anchor. A blank line does end one.
test('a restatement across a wrapped line is still the same sentence', () => {
  const wrapped = 'All 63 widgets are here, and\nwhich 62 is not in doubt.';
  assert.match(check(wrapped, [claim()])[0], /restates it as "which 62"/);
});

test('a number in the next paragraph is not a restatement', () => {
  assert.deepStrictEqual(
    check('All 63 widgets are here.\n\nAnd which 62 is a separate matter.', [claim()]),
    []
  );
});

// A claim written as a word has no digits to restate, and running the scan on it
// would compare "the one rule" against every "all 3" in the paragraph.
test('a spelled-out claim is not scanned for restatements', () => {
  const spelled = claim({ what: 'rules', is: 1, find: /the (one) rule/g, spelled: { one: 1 } });
  assert.deepStrictEqual(check('the one rule, and all 7 of those cases', [spelled]), []);
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

// ---- and against CLAUDE.md ---------------------------------------------------
//
// The checker anchors on the README, which means a countable claim written into any
// other file is unwatched. CLAUDE.md carried one — a test count, in the `npm test`
// comment — and it was wrong by 17 inside a fortnight. Nothing failed, because
// nothing was looking.
//
// A test count is the one number this checker cannot own: it is not held in a file to
// be counted, it is the output of running the suite, and having `check:readme` run
// `node --test` to verify a comment would be slower than the suite it describes and
// circular besides. So the fix was to delete the claim rather than to check it, and
// this is what stops it coming back — the mechanism CLAUDE.md's note was never able
// to be.
test('CLAUDE.md states no test count', () => {
  const doc = fs.readFileSync(path.join(__dirname, '..', 'CLAUDE.md'), 'utf8');
  // Only a bare count of the suite. "590 tests" and "607 tests" match; the prose
  // around research passes ("all 37 candidates", "1,197 of his 1,202") does not, and
  // must not — those are history, and history is allowed to hold still.
  const stated = [...doc.matchAll(/\b([\d,]+)\s+tests\b/gi)];
  assert.deepStrictEqual(
    stated.map((m) => m[0]), [],
    'CLAUDE.md gives a test count. `npm test` prints the real one, and nothing here '
    + 'watches a number in that file — say "a couple of seconds" instead.',
  );
});
