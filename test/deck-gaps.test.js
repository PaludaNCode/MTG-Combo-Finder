'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { findGaps, ruledOutIndex } = require('../tools/deck-gaps.js');
const { deckNameSet } = require('../combos.js');
const { ruledOutSets } = require('../research-log.js');

// tools/deck-gaps.js proposes combos a deck could cast that Spellbook has not
// published. For a long time it also re-proposed things a pass had already thrown
// out, and could not help it: the decision lived in research-log.js as a sentence
// and there was nothing machine-readable to match against. `sets` on a rule-out is
// that half, and this is the check that the two files actually talk.

const deck = (...names) => deckNameSet(names.map((name) => ({ name })));

// A tiny dataset with one substitutable pair: Twin A and Twin B share the shape
// "+ Engine", and only Twin A is published with Outlet.
const DATA = {
  combos: [
    { c: ['Twin A', 'Engine'], id: '1-2', pop: 10 },
    { c: ['Twin B', 'Engine'], id: '2-3', pop: 10 },
    { c: ['Twin A', 'Outlet'], id: '1-4', pop: 99 },
  ],
};

test('deck-gaps: proposes the shape one twin has and the other lacks', () => {
  const { gaps, ruledOut } = findGaps(DATA, deck('Twin A', 'Twin B', 'Engine', 'Outlet'), 0.3, []);
  assert.deepStrictEqual(
    gaps.map((g) => [g.subject, ...g.rest].sort().join(' + ')),
    ['Outlet + Twin B']
  );
  assert.deepStrictEqual(ruledOut, []);
});

test('deck-gaps: a card set a pass ruled out is dropped', () => {
  const { gaps } = findGaps(DATA, deck('Twin A', 'Twin B', 'Engine', 'Outlet'), 0.3, [
    { cards: ['Twin B', 'Outlet'], subject: 'A pass', reason: 'because the outlet needs a body' },
  ]);
  assert.deepStrictEqual(gaps, []);
});

// Dropped, not disappeared. A filter nobody can see is a filter nobody can check,
// and a candidate list that quietly got shorter is indistinguishable from a shorter
// candidate list — so the reason travels with the row and main() prints it.
test('deck-gaps: a dropped candidate is reported with the pass that killed it', () => {
  const { ruledOut } = findGaps(DATA, deck('Twin A', 'Twin B', 'Engine', 'Outlet'), 0.3, [
    { cards: ['Outlet', 'Twin B'], subject: 'A pass', reason: 'because the outlet needs a body' },
  ]);
  assert.strictEqual(ruledOut.length, 1);
  assert.strictEqual(ruledOut[0].settledAs.subject, 'A pass');
  assert.match(ruledOut[0].settledAs.reason, /needs a body/);
});

// The card set is a set: the order it was written down in is not part of it, and
// neither is the case or the accent, because nameKey() owns that everywhere else.
test('deck-gaps: a rule-out matches however its cards were written down', () => {
  const index = ruledOutIndex([{ cards: ['Sadistic Glee', 'Scurry Oak'], subject: 's', reason: 'r' }]);
  assert.ok(index.has(['Scurry Oak', 'Sadistic Glee'].map((n) => n.toLowerCase()).sort().join('|')));
});

test('deck-gaps: no rule-outs recorded means nothing is dropped', () => {
  const { gaps, ruledOut } = findGaps(DATA, deck('Twin A', 'Twin B', 'Engine', 'Outlet'), 0.3, null);
  assert.strictEqual(gaps.length, 1);
  assert.deepStrictEqual(ruledOut, []);
});

// ---- against the real log ----------------------------------------------------
//
// The two the issue was written about. They are a pair rather than a shape needing
// a third card — Basking Broodscale's Eldrazi Spawn sacrifices itself where the
// Squirrel and the Beast cannot — and both were being re-offered on every run.
test('the live log rules out the two pairs the first sweep threw away', () => {
  const index = ruledOutIndex(ruledOutSets());
  const key = (names) => names.map((n) => n.toLowerCase()).sort().join('|');
  assert.ok(index.has(key(['Scurry Oak', 'Sadistic Glee'])), 'Scurry Oak + Sadistic Glee');
  assert.ok(index.has(key(['Herd Baloth', 'Sadistic Glee'])), 'Herd Baloth + Sadistic Glee');
});

// Every set has to name a pass and a reason, or a tool would drop a candidate and
// be unable to say why — which is the one thing worse than proposing it again.
test('every recorded rule-out set carries the pass and the reason it died to', () => {
  const sets = ruledOutSets();
  assert.ok(sets.length, 'no rule-out is recorded as cards at all');
  sets.forEach((entry) => {
    const at = entry.cards.join(' + ');
    assert.ok(Array.isArray(entry.cards) && entry.cards.length >= 2, at + ': not a card set');
    entry.cards.forEach((card) => assert.ok(typeof card === 'string' && card.length > 2,
      at + ': a card name that is not one'));
    assert.strictEqual(new Set(entry.cards).size, entry.cards.length, at + ': a card twice');
    assert.ok(entry.subject && entry.subject.length > 3, at + ': names no pass');
    assert.ok(entry.reason && entry.reason.length > 20, at + ': gives no reason');
  });
});
