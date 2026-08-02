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

// The rule the rest of this file exists to hold up. A pass reasons about card
// behaviour, and the cheapest way to get it wrong is to recall the card instead of
// reading it — which produces a rule-out that is invisible: no row, no failure, no
// complaint, just a card that looks covered. Camellia's first entry threw away 35
// candidates on a text nobody had opened.
//
// So the text is part of the record, not a step somebody is asked to remember. The
// check is deliberately dumb — every card in `cards` needs a verbatim entry in
// `read` — because a clever version would be one somebody could argue their way
// around, and the instruction that used to live here was already argued around once.
test('research log: no pass reasons about a card whose text it did not record', () => {
  PASSES.forEach((pass) => {
    assert.ok(pass.read && typeof pass.read === 'object',
      pass.subject + ': records no oracle text at all — read the cards');
    pass.cards.forEach((card) => {
      const text = pass.read[card];
      assert.ok(typeof text === 'string' && text.trim().length > 30,
        pass.subject + ': no oracle text recorded for ' + card
        + '. Fetch it (WebSearch — Scryfall is blocked here) and paste it in.');
    });
  });
});

// A ratchet, not a gate. Entries written before the rule existed never had their
// text fetched; pretending otherwise would mean inventing oracle text, which is the
// one thing worse than admitting the gap. So they carry an explicit UNREAD marker
// and this caps the number.
//
// **The number may go down. It may never go up.** A new pass that cannot be
// bothered to read its cards fails here, and an old entry gets fixed by fetching
// the text and deleting a marker. Anyone tempted to raise the cap should read the
// Camellia entry first — that is what an unread card costs.
//
// It went up once, 16 -> 36, as a correction rather than borrowing, then down to 30
// when Broodscale, Scurry Oak and Herd Baloth were finally read. The
// first count only covered cards listed in `cards`, so a pass could reason about a
// dozen *peers* and record none of them — Ashnod's Altar named twelve and had one
// text. Those twenty were always unread; the number was wrong, not the debt. If it
// ever rises again, that is the same bug or a new excuse, and neither is allowed.
const UNREAD_DEBT = 30;

test('research log: the unread backlog only ever shrinks', () => {
  const unread = [];
  PASSES.forEach((pass) => {
    Object.entries(pass.read || {}).forEach(([card, text]) => {
      if (String(text).startsWith('UNREAD')) unread.push(pass.subject + ' / ' + card);
    });
  });
  assert.ok(unread.length <= UNREAD_DEBT,
    'the unread backlog grew to ' + unread.length + ' (cap ' + UNREAD_DEBT + '). '
    + 'A new pass must record real oracle text:\n  ' + unread.join('\n  '));
  if (unread.length < UNREAD_DEBT) {
    assert.fail('the backlog is down to ' + unread.length + ' — lower UNREAD_DEBT to '
      + unread.length + ' so it cannot drift back up');
  }
});

// Peers are where the reasoning actually happens: the subject is compared *against*
// something, and that something's text decides the answer as much as the subject's.
// Recording only the subject would satisfy the letter of the rule and miss the case
// that broke — Confectioner was the card misremembered, and he is a peer.
test('research log: a card named in a rule-out has its text recorded too', () => {
  PASSES.forEach((pass) => {
    const known = Object.keys(pass.read || {});
    const reasons = (pass.ruledOut || []).map((r) => r.reason).join(' ') + ' ' + (pass.notes || '');
    // Any card this pass claims to have read is fine. What is not fine is naming a
    // card in `cards` inside a reason without its text — that is reasoning from memory.
    pass.cards.forEach((card) => {
      if (!reasons.includes(card.split(',')[0])) return;
      assert.ok(known.includes(card),
        pass.subject + ': ' + card + ' is reasoned about in a rule-out but has no recorded text');
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
