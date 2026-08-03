'use strict';
// The two research tools' reporting, which is where both of them were quietly wrong.
//
// Neither bug failed anything. `try-deck.js` printed ten lines of "! [object Object]" and
// `deck-cards.js --unswept` printed a count that was false by construction, and both went
// unnoticed through several passes precisely because a tool's output is read by a person
// once and believed. So the two decisions are functions now, and this is what watches them.
const test = require('node:test');
const assert = require('node:assert');
const { skippedLines } = require('../tools/try-deck.js');
const { sweepStatus } = require('../tools/deck-cards.js');

// ---- try-deck.js: the lines the parser dropped ------------------------------

test('skippedLines: a skipped line names its reason and its text', () => {
  assert.deepStrictEqual(
    skippedLines([{ line: '1 Elvish Mystic', reason: 'sideboard / ignored section' }], 10),
    ['  ! [sideboard / ignored section] 1 Elvish Mystic']
  );
});

// The regression, stated as the thing a reader saw: parseDecklist() hands back objects,
// and the old line interpolated them straight into a template literal.
test('skippedLines: never prints an object', () => {
  const skipped = [
    { line: 'Creatures (24)', reason: 'category heading' },
    { line: 'SB: 1 Swamp', reason: 'sideboard (SB:) line' },
  ];
  for (const line of skippedLines(skipped, 10)) {
    assert.ok(!line.includes('[object Object]'), `printed an object: ${line}`);
    assert.ok(line.includes('!'), `lost the marker: ${line}`);
  }
});

test('skippedLines: truncation is stated, not silent', () => {
  const many = Array.from({ length: 29 }, (_, i) => ({ line: `line ${i}`, reason: 'sideboard / ignored section' }));
  const lines = skippedLines(many, 10);
  assert.strictEqual(lines.length, 11, 'ten lines and one saying what was held back');
  assert.strictEqual(lines[10], '  …and 19 more.');
});

test('skippedLines: nothing in, nothing out', () => {
  assert.deepStrictEqual(skippedLines([], 10), []);
  assert.deepStrictEqual(skippedLines(null, 10), []);
  // A bare string is not the shape the parser produces, but it must not regress to
  // printing "[object Object]" either.
  assert.deepStrictEqual(skippedLines(['just a line'], 10), ['  ! just a line']);
});

// ---- deck-cards.js: the swept / unswept counts ------------------------------

const card = (name, combos) => ({ name, combos, played: combos * 10 });
const cards = [card('Phyrexian Altar', 5167), card("Ashnod's Altar", 6063), card('Aunt May', 82)];
const sweptSet = new Set(["ashnod's altar"]);

test('sweepStatus: the counts describe the deck, and add up to it', () => {
  const status = sweepStatus(cards, sweptSet);
  assert.strictEqual(status.swept, 1);
  assert.strictEqual(status.unswept, 2);
  assert.strictEqual(status.swept + status.unswept, cards.length, 'the counts must cover every row');
});

// The bug, pinned by the thing that made it possible: the caller filters the rows for its
// table, and that must not be able to move the counts. Taking them from the filtered list
// is what made "--unswept" report 0 swept on a deck with 27.
test('sweepStatus: filtering the rows afterwards cannot change the counts', () => {
  const status = sweepStatus(cards, sweptSet);
  const shown = status.rows.filter((r) => !r.swept);
  assert.strictEqual(shown.length, 2, 'the table holds only the unswept');
  assert.strictEqual(status.swept, 1, 'and the sentence above it still says one was swept');
});

test('sweepStatus: ranked on combos, played breaking the tie', () => {
  const tied = [
    { name: 'Fewer plays', combos: 100, played: 5 },
    { name: 'More plays', combos: 100, played: 900 },
    { name: 'Most combos', combos: 101, played: 1 },
  ];
  assert.deepStrictEqual(
    sweepStatus(tied, new Set()).rows.map((r) => r.name),
    ['Most combos', 'More plays', 'Fewer plays']
  );
});

test('sweepStatus: matching is by the deck\'s own name key', () => {
  // sweptCards() returns keys, and a decklist's spelling of a card is not normalized.
  const status = sweepStatus([card('  ASHNOD\'S   Altar', 1)], sweptSet);
  assert.strictEqual(status.swept, 0, 'inner spacing is not normalized by nameKey, so this misses');
  assert.strictEqual(sweepStatus([card("Ashnod's Altar", 1)], sweptSet).swept, 1);
});

test('sweepStatus: nothing in, nothing out', () => {
  assert.deepStrictEqual(sweepStatus([], new Set()), { rows: [], swept: 0, unswept: 0 });
  assert.deepStrictEqual(sweepStatus(null, null), { rows: [], swept: 0, unswept: 0 });
  // No sweep data at all reports everything unswept rather than throwing.
  assert.strictEqual(sweepStatus(cards, null).unswept, 3);
});
