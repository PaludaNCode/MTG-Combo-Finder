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
      // `sets` is the machine-readable half — the specific card combinations the
      // reason killed, so tools/deck-gaps.js can stop re-proposing them. Optional,
      // and always a subset of what its reason covers; what is not optional is that
      // it holds card sets rather than something a consumer has to guess at.
      if (!('sets' in out)) return;
      assert.ok(Array.isArray(out.sets) && out.sets.length,
        pass.subject + ': a rule-out with an empty `sets` — leave it off instead');
      out.sets.forEach((cards) => {
        assert.ok(Array.isArray(cards) && cards.length >= 2,
          pass.subject + ': a rule-out set that is not a set of at least two cards');
        cards.forEach((card) => assert.ok(typeof card === 'string' && card.trim().length > 2,
          pass.subject + ': a rule-out set naming something that is not a card'));
      });
      // A `sets` longer than the count it sits under would mean the pass ruled out
      // more combinations than it says it ruled out, which is one of them invented.
      if (Number.isInteger(out.count)) {
        assert.ok(out.sets.length <= out.count,
          pass.subject + ': `sets` names ' + out.sets.length + ' combinations under a '
          + 'rule-out that counted ' + out.count);
      }
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
        + '. Fetch it — node tools/lookup-card.js "' + card + '", which falls back to '
        + 'Forge when Scryfall is blocked — and paste it in.');
    });
  });
});

// This used to be a ratchet with an allowance. Entries written before the
// read-the-card rule existed had never had their text fetched, and pretending
// otherwise would have meant inventing oracle text — the one thing worse than
// admitting the gap — so they carried an explicit UNREAD marker under a cap that
// could only fall. It went 16 -> 36 as a correction (the first count only looked at
// cards listed in `cards`, so a pass could reason about a dozen *peers* and record
// none of them — Ashnod's Altar named twelve and had one text), then 36 -> 30 -> 16
// as they were read, and reached 0 on 2026-08-03.
//
// **The allowance is not coming back.** It is now a flat prohibition: an UNREAD
// marker anywhere in the log fails, whatever its excuse and whatever its number.
// Reintroducing a cap would mean re-opening the debt this test spent four passes
// closing, and anyone tempted should read the Camellia entry first — 35 candidates
// discarded on a text nobody had opened is what one unread card costs.
test('research log: nothing in the log is marked UNREAD', () => {
  const unread = [];
  PASSES.forEach((pass) => {
    Object.entries(pass.read || {}).forEach(([card, text]) => {
      if (String(text).startsWith('UNREAD')) unread.push(pass.subject + ' / ' + card);
    });
  });
  assert.deepStrictEqual(unread, [],
    'the unread backlog is closed and stays closed. Fetch the text — node '
    + 'tools/lookup-card.js "<card>", which falls back to Forge when Scryfall is '
    + 'blocked — and paste it in:\n  ' + unread.join('\n  '));
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

// The index answers "has anybody read this card?", and it is asked with names from three
// places that do not agree on how to type an apostrophe: Spellbook's data, a pasted deck,
// and this file. It used to spell the key rule out for itself rather than using
// DeckCombos.nameKey — which is the drift: the moment nameKey learned that a curly
// apostrophe is an apostrophe, the copy here did not, and every query in the other spelling
// answered NOT SWEPT. The tools built on this index report exactly that answer, which is
// what makes it worth a test.
//
// Asked as "either spelling of the query finds it", because that is the direction the data
// actually exercises: the names in `cards` are straight, the queries are not always. An
// earlier version of this test looked for curly names IN the log, found none, and said so
// rather than passing — which is the only reason this one asks the right question.
test('research log: a swept card is found whichever apostrophe the query uses', () => {
  const swept = sweptCards();
  const withApostrophe = [];
  PASSES.forEach((pass) => (pass.cards || []).forEach((name) => {
    if (name.includes("'")) withApostrophe.push(name);
  }));
  assert.ok(withApostrophe.length, 'no swept card has an apostrophe, so this proves nothing');
  withApostrophe.forEach((name) => {
    assert.ok(swept.has(nameKey(name)), name + ' is not in its own index');
    assert.ok(swept.has(nameKey(name.replace(/'/g, '\u2019'))),
      name + ' cannot be asked for with the apostrophe a word processor types');
  });
});
