'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { matchDeck, deckNameSet, candidateCombos, lastScan } = require('../combos.js');

// matchDeck() used to walk all 103,891 combos and call nameKey() on every card as
// it went. It now walks the combos an index says could possibly qualify — issue
// #181 for the measurements, and combos.js for why the candidate set is a quarter
// of the database rather than the handful it sounds like.
//
// **Nothing about the results can tell you which walk ran.** A rewrite back to the
// linear scan returns identical answers, just slower, so the two properties worth
// pinning are the count of combos examined and equivalence with a linear pass
// written out independently below. A duration assertion would be a CI flake.

// A dataset big enough for "examined a fraction of it" to mean something, built
// from a rule rather than typed out: combo n names cards (n mod 40) and
// ((n * 7) mod 40), so a deck holding ten of the forty reaches some combos with
// both cards, some with one, and most with neither.
const CARD = (n) => 'Card ' + String(n).padStart(2, '0');
const COMBOS = Array.from({ length: 400 }, (unused, n) => ({
  id: String(n),
  c: [CARD(n % 40), CARD((n * 7) % 40)],
  p: ['Infinite mana'],
  i: 'C',
}));

// The two shapes the index cannot reach through a deck card, kept at the end so
// their positions are stable and easy to assert on.
const LONE = { id: 'lone', c: ['Card 99'], p: ['Infinite mana'], i: 'C' };            // one card, not in the deck
const TWICE = { id: 'twice', c: ['Card 00', 'Card 00', 'Card 98'], p: ['x'], i: 'C' }; // the same card named twice

const DATASET = {
  cardIdentity: Object.fromEntries(
    Array.from({ length: 40 }, (unused, n) => [CARD(n), '']).concat([['Card 98', ''], ['Card 99', '']])
  ),
  combos: COMBOS.concat([LONE, TWICE]),
};

const HOLDS = Array.from({ length: 10 }, (unused, n) => ({ card: CARD(n * 3) })); // 0, 3, 6 … 27
const NAMES = deckNameSet(HOLDS);

// The walk this replaced, written out: every combo, one nameKey() per card, count
// the ones the deck does not have. The point is that it is derived from nothing —
// if the two disagree, this is the one that is right by construction.
function linear() {
  const included = [];
  const almost = [];
  for (const combo of DATASET.combos) {
    let missing = 0;
    for (const name of combo.c || []) if (!NAMES.has(name.trim().toLowerCase())) missing += 1;
    if (missing === 0) included.push(combo.id);
    else if (missing === 1) almost.push(combo.id);
  }
  return { included: included.sort(), almost: almost.sort() };
}

test('the indexed walk returns exactly what a linear pass does', () => {
  const got = matchDeck(DATASET, NAMES);
  const want = linear();
  assert.deepStrictEqual(got.included.map((c) => c.id).sort(), want.included);
  assert.deepStrictEqual(
    got.almostIncluded.concat(got.almostIncludedByAddingColors).map((c) => c.id).sort(),
    want.almost
  );
  assert.ok(want.included.length > 0 && want.almost.length > 0, 'a fixture proving nothing would pass too');
});

// The anti-regression assertion, and the only one that fails if somebody puts the
// linear scan back.
test('matchDeck examines a fraction of the database, not all of it', () => {
  matchDeck(DATASET, NAMES);
  const { examined, total } = lastScan();
  assert.strictEqual(total, DATASET.combos.length);
  assert.ok(examined < total, `examined ${examined} of ${total} — the walk is linear again`);
  assert.ok(examined > 0, 'examining nothing is not an optimisation');
});

// A combo naming one card can be one card short while naming nothing the deck
// holds, so no deck card can ever lead the index to it. There are 7 in the
// published database and they are carried as a list beside the index.
test('a one-card combo is reached even though the deck names none of it', () => {
  const almost = matchDeck(DATASET, NAMES).almostIncluded
    .concat(matchDeck(DATASET, NAMES).almostIncludedByAddingColors)
    .map((c) => c.id);
  assert.ok(almost.includes('lone'), 'the combo the index cannot see was dropped');
});

// The trap, and the reason the index stores one posting per *occurrence* rather
// than per distinct card. `twice` names Card 00, Card 00 and Card 98; the deck has
// Card 00. The old walk counted the names it could not find — one — so this is a
// suggestion. Score the combo on distinct cards instead and it is two short and
// disappears. Both are defensible readings and only one of them is what the page
// has always done, which is what makes this a silent behaviour change rather than
// a fix. No published combo names a card twice, so nothing else here would notice.
test('a combo naming the same card twice is counted the way the old walk counted it', () => {
  const got = matchDeck(DATASET, NAMES);
  const short = got.almostIncluded.concat(got.almostIncludedByAddingColors).map((c) => c.id);
  assert.ok(short.includes('twice'), 'counted on distinct cards, this would have vanished');
  assert.ok(linear().almost.includes('twice'), 'and the linear pass agrees, which is the point');
});

test('candidates come back in database order', () => {
  const { order } = candidateCombos(DATASET.combos, NAMES, true);
  const sorted = order.slice().sort((a, b) => a - b);
  assert.deepStrictEqual(order, sorted);
  assert.ok(order.length > 1, 'one candidate is trivially in order');
});

// Ordering is not cosmetic here: matchDeck hands its results to stable sorts, and
// 42% of published combos carry no `pop` for those sorts to separate. An unsorted
// walk returns the same combos in a different order and silently reorders the page.
test('an unsorted walk would reorder the results, which is why the sort is not optional', () => {
  const { order, held } = candidateCombos(DATASET.combos, NAMES, true);
  const complete = order.filter((at) => (DATASET.combos[at].c || []).length - held[at] === 0);
  const asDatabase = complete.map((at) => DATASET.combos[at].id);
  const byPosition = complete.slice().sort((a, b) => a - b).map((at) => DATASET.combos[at].id);
  assert.deepStrictEqual(asDatabase, byPosition);
});

// The index is kept on the combos array, so a second dataset gets its own and a
// test that mutated one could not poison another.
test('two datasets do not share an index', () => {
  const other = {
    cardIdentity: { 'Card 00': '', 'Card 01': '' },
    combos: [{ id: 'only', c: ['Card 00', 'Card 01'], p: ['x'], i: 'C' }],
  };
  assert.deepStrictEqual(matchDeck(other, deckNameSet([{ card: 'Card 00' }, { card: 'Card 01' }]))
    .included.map((c) => c.id), ['only']);
  assert.strictEqual(lastScan().total, 1);
  // And the first dataset still answers for itself.
  matchDeck(DATASET, NAMES);
  assert.strictEqual(lastScan().total, DATASET.combos.length);
});
