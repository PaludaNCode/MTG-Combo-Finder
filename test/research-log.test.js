'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { PASSES, sweptCards, totals } = require('../research-log.js');
const { COMBOS } = require('../unofficial.js');
const { nameKey } = require('../combos.js');

// The log is a claim about what has been looked at, and a claim nobody checks is
// decoration — the same reasoning that put tools/verify-unofficial.js behind the
// row citations. What is checkable without the live data is the shape, and the one
// thing that actually rots: rows arriving in unofficial.js that no pass here
// accounts for, which is how the file would drift back to being unsearchable.

test('research log: every pass says what it covered and what it found', () => {
  assert.ok(PASSES.length, 'no passes recorded');
  PASSES.forEach((pass) => {
    const at = pass.subject;
    assert.ok(at && at.length > 3, 'a pass with no subject');
    assert.ok(Array.isArray(pass.cards) && pass.cards.length, at + ': covers no cards');
    assert.ok(Array.isArray(pass.cardIds) && pass.cardIds.length === pass.cards.length,
      at + ': a card id per card, or null where the data has none');
    pass.cardIds.forEach((id) => assert.ok(id === null || Number.isInteger(id),
      at + ': a card id that is neither a number nor null'));
    assert.match(pass.date, /^\d{4}-\d{2}(-\d{2})?$/, at + ': no date');
    assert.ok(pass.method && pass.method.length > 10, at + ': does not say how it searched');
    [pass.proposed, pass.examined, pass.kept].forEach((n) => assert.ok(
      Number.isInteger(n) && n >= 0, at + ': proposed/examined/kept must be counts'));
    assert.ok(pass.notes && pass.notes.length > 20, at + ': no notes');
  });
});

// The rule-outs are the part worth keeping — the README says so and the first
// sweep's are more useful than its survivors. A count is optional because a
// mechanical rule-out kills thousands at once and inventing a figure for it would
// be worse than leaving it off; a *reason* is not optional.
test('research log: every rule-out gives a reason, and a count only if it has one', () => {
  PASSES.forEach((pass) => {
    assert.ok(Array.isArray(pass.ruledOut), pass.subject + ': no rule-outs recorded');
    pass.ruledOut.forEach((out) => {
      assert.ok(out.reason && out.reason.length > 20,
        pass.subject + ': a rule-out with no reason worth reading');
      assert.ok(!('count' in out) || Number.isInteger(out.count),
        pass.subject + ': a rule-out count that is not a number');
    });
  });
});

test('research log: a card is not listed under the same pass twice', () => {
  PASSES.forEach((pass) => {
    const keys = pass.cards.map(nameKey);
    assert.strictEqual(new Set(keys).size, keys.length, pass.subject + ': a card listed twice');
  });
});

// The one that catches drift. A row added for a card nobody logged sweeping means
// the index has stopped being an index — somebody researched something and the
// only trace is the row itself, which is the state this file was written to end.
test('research log: no unofficial row belongs to a card no pass covers', () => {
  const swept = sweptCards();
  const orphans = COMBOS
    .filter((row) => !row.cards.some((card) => swept.has(nameKey(card))))
    .map((row) => row.cards.join(' + '));
  assert.deepStrictEqual(orphans, [],
    'these rows trace to no recorded pass — add the pass that found them');
});

// Deliberately not asserted: that kept adds up to COMBOS.length. It does not, and
// should not be made to. The file predates the log, and passes whose working was
// never written down are honestly absent rather than back-filled from guesswork —
// which is exactly the kind of tidying this log exists to stop.
test('research log: the totals are the sum of the passes, and nothing more', () => {
  const sum = totals();
  assert.strictEqual(sum.examined, PASSES.reduce((a, p) => a + p.examined, 0));
  assert.ok(sum.kept <= COMBOS.length,
    'the log claims more kept rows than unofficial.js holds');
  assert.ok(sum.examined <= sum.proposed,
    'more candidates were read than were ever proposed');
});
