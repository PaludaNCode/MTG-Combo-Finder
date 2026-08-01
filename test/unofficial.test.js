'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  matchUnofficial, matchSubstitutions, identityString, deckNameSet, nameKey, expand,
} = require('../combos.js');
const { COMBOS, SUBSTITUTIONS } = require('../unofficial.js');

// The one part of the page that is not Commander Spellbook's word. Everything here
// is about keeping that distinction honest: the rows have to carry their evidence,
// they have to disappear the moment Spellbook publishes them, and they must never
// leak into the counts and the bracket that speak for the published data.

const DATASET = {
  cardIdentity: {
    'Scurry Oak': 'G',
    Necrosynthesis: 'B',
    'Viscera Seer': 'B',
    'Sol Ring': '',
  },
};

const deck = (...names) => deckNameSet(names.map((card) => ({ card, quantity: 1 })));

// ---- the data file itself --------------------------------------------------

test('unofficial: every row carries the evidence the page prints', () => {
  assert.ok(COMBOS.length > 0, 'no rows to check');
  COMBOS.forEach((row) => {
    const at = row.cards.join(' + ');
    assert.ok(row.cards.length >= 2, at + ': a combo needs at least two cards');
    assert.ok(row.produces.length, at + ': no results');
    assert.ok(['verified', 'derived'].includes(row.confidence), at + ': bad confidence');
    assert.ok(row.from && /^\d+(-\d+)+$/.test(row.from.id), at + ': no published combo cited');
    assert.ok(row.why && row.why.length > 20, at + ': no reasoning given');
    // The swap has to be a swap: one card out, one in, against the cited combo.
    assert.ok(row.from.cards.includes(row.swap.out), at + ': the swapped-out card is not in it');
    assert.ok(row.cards.includes(row.swap.in), at + ': the swapped-in card is not in the result');
    assert.deepStrictEqual(
      row.from.cards.map((c) => (c === row.swap.out ? row.swap.in : c)).slice().sort(),
      row.cards.slice().sort(),
      at + ': the two card lists differ by more than the stated swap'
    );
  });
});

test('unofficial: no row is listed twice', () => {
  const keys = COMBOS.map((r) => r.cards.map(nameKey).sort().join('|'));
  assert.strictEqual(new Set(keys).size, keys.length);
});

// ---- matching --------------------------------------------------------------

const ROW = {
  cards: ['Scurry Oak', 'Necrosynthesis', 'Viscera Seer'],
  produces: ['Infinite scry 1'],
  confidence: 'derived',
  from: { id: '2082-2292-4186', cards: ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'] },
  swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
  why: 'Both halves of the swap are published separately; the pairing is not.',
};

test('match: a deck holding every card gets the row', () => {
  const out = matchUnofficial(DATASET, [ROW], deck('Scurry Oak', 'Necrosynthesis', 'Viscera Seer'), []);
  assert.strictEqual(out.length, 1);
  assert.deepStrictEqual(out[0].c, ROW.cards);
  assert.strictEqual(out[0].unofficial, ROW);
  // Worked out from the cards, not stored, so it cannot drift from the identity data.
  assert.strictEqual(out[0].i, 'BG');
});

test('match: one card short is not a match', () => {
  const out = matchUnofficial(DATASET, [ROW], deck('Scurry Oak', 'Necrosynthesis'), []);
  assert.deepStrictEqual(out, []);
});

// The whole point of the graduation rule. Spellbook is refreshed nightly, and the
// day one of these is published it arrives in `included` on its own authority —
// showing our copy beside it would be the same combo twice, one of them stale.
test('match: a row Spellbook has since published drops out', () => {
  const names = deck('Scurry Oak', 'Necrosynthesis', 'Viscera Seer');
  const published = [{ id: '9-9-9', c: ['Viscera Seer', 'Scurry Oak', 'Necrosynthesis'] }];
  assert.strictEqual(matchUnofficial(DATASET, [ROW], names, published).length, 0);
  // ...and order and case in the published copy make no difference to that.
  const messy = [{ id: '9-9-9', c: ['viscera seer', 'NECROSYNTHESIS', 'Scurry Oak'] }];
  assert.strictEqual(matchUnofficial(DATASET, [ROW], names, messy).length, 0);
  // A different combo that merely overlaps does not count as publishing it.
  const other = [{ id: '9-9-9', c: ['Scurry Oak', 'Necrosynthesis'] }];
  assert.strictEqual(matchUnofficial(DATASET, [ROW], names, other).length, 1);
});

test('match: missing or empty inputs are not an error', () => {
  const names = deck('Scurry Oak');
  assert.deepStrictEqual(matchUnofficial(DATASET, null, names, []), []);
  assert.deepStrictEqual(matchUnofficial(DATASET, [], names, []), []);
  assert.deepStrictEqual(matchUnofficial(DATASET, [ROW], null, []), []);
  assert.deepStrictEqual(matchUnofficial(DATASET, [{ cards: [] }], names, []), []);
  // No `included` argument at all — nothing has been published, so nothing drops.
  assert.strictEqual(matchUnofficial(DATASET, [ROW], deck(...ROW.cards)).length, 1);
});

test('match: expand carries the evidence through to the renderer', () => {
  const row = expand(matchUnofficial(DATASET, [ROW], deck(...ROW.cards), [])[0]);
  assert.strictEqual(row.unofficial.confidence, 'derived');
  assert.strictEqual(row.unofficial.from.id, '2082-2292-4186');
  assert.deepStrictEqual(row.uses.map((u) => u.card.name), ROW.cards);
  // An official row must not grow the field, or every combo would render as derived.
  assert.strictEqual(expand({ id: '1-2-3', c: ['Sol Ring'], p: [] }).unofficial, undefined);
});

test('identityString: colourless is C, and the order is WUBRG', () => {
  assert.strictEqual(identityString(null), 'C');
  assert.strictEqual(identityString(new Set()), 'C');
  assert.strictEqual(identityString(new Set(['G', 'W', 'B'])), 'WBG');
  assert.strictEqual(identityString(new Set(['R', 'U'])), 'UR');
});

// ---- the rule that stands one card in for another --------------------------
//
// The list above is one row per combo, which stops working when a whole card is
// missing rather than a single line: Hammerhead, Maggia Boss has the same free
// "sacrifice another creature or artifact" ability as Umbral Collar Zealot, and the
// Zealot is in 1,514 published combos while Hammerhead is in none. These check the
// guards, because a rule that fires too widely invents combos at scale.

const RULE = {
  card: 'Hammerhead, Maggia Boss',
  substituteFor: 'Umbral Collar Zealot',
  attestedBy: 'Bartolomé del Presidio',
  confidence: 'verified',
  why: 'The same ability for the same cost, and the loop is published with a second '
    + 'outlet of that class as well.',
};

// Two published combos: the same loop with each of the two outlets. The pair is what
// attests the swap.
const SET = {
  cardIdentity: {
    'Scurry Oak': 'G',
    'Sadistic Glee': 'B',
    'Umbral Collar Zealot': 'B',
    'Bartolomé del Presidio': 'BW',
    'Hammerhead, Maggia Boss': 'B',
  },
  combos: [
    {
      id: '1-1-1',
      c: ['Scurry Oak', 'Sadistic Glee', 'Umbral Collar Zealot'],
      p: ['Infinite ETB', 'Infinite surveil'],
    },
    {
      id: '2-2-2',
      c: ['Scurry Oak', 'Sadistic Glee', 'Bartolomé del Presidio'],
      p: ['Infinite ETB', 'Infinite +1/+1 counters on a creature'],
    },
  ],
};

const held = deck('Scurry Oak', 'Sadistic Glee', 'Hammerhead, Maggia Boss');

test('rule: the substitute picks up the combo the deck can now assemble', () => {
  const out = matchSubstitutions(SET, [RULE], held, []);
  assert.strictEqual(out.length, 1);
  assert.deepStrictEqual(out[0].c.slice().sort(),
    ['Hammerhead, Maggia Boss', 'Sadistic Glee', 'Scurry Oak']);
  assert.strictEqual(out[0].unofficial.swap.in, 'Hammerhead, Maggia Boss');
  assert.strictEqual(out[0].unofficial.from.id, '1-1-1');
  // Mono-black substitute in place of the Zealot: identity is worked out from the
  // cards, so it is BG and not the BW the attesting combo would give.
  assert.strictEqual(out[0].i, 'BG');
});

// The reason `attestedBy` exists. "Infinite surveil" comes from the Zealot's own
// ability, not from the loop — printing it beside Hammerhead would state something
// false, so the results come from the attested twin instead.
test('rule: the results come from the twin, not the combo being replaced', () => {
  const [row] = matchSubstitutions(SET, [RULE], held, []);
  assert.deepStrictEqual(row.p, ['Infinite ETB', 'Infinite +1/+1 counters on a creature']);
  assert.ok(!row.p.some((p) => /surveil/i.test(p)), 'the replaced card’s rider leaked through');
});

test('rule: nothing fires unless the deck actually holds the substitute', () => {
  const without = deck('Scurry Oak', 'Sadistic Glee', 'Umbral Collar Zealot');
  assert.deepStrictEqual(matchSubstitutions(SET, [RULE], without, []), []);
});

test('rule: an unattested combo is left alone', () => {
  // The Zealot version alone, with no second outlet published for the same loop —
  // which is exactly the shape of a combo that wants the surveil rather than the
  // sacrifice, and the one case the wording cannot tell apart.
  const lonely = { cardIdentity: SET.cardIdentity, combos: [SET.combos[0]] };
  assert.deepStrictEqual(matchSubstitutions(lonely, [RULE], held, []), []);
});

test('rule: a combo with a template slot is skipped', () => {
  // Only the full resolveSlots() walk can say whether the deck fills a slot, and a
  // row claiming a combo the deck cannot assemble is worse than no row.
  const slotted = {
    cardIdentity: SET.cardIdentity,
    combos: SET.combos.map((c) => Object.assign({}, c, { t: [42] })),
  };
  assert.deepStrictEqual(matchSubstitutions(slotted, [RULE], held, []), []);
});

test('rule: a combo Spellbook has since published is not offered again', () => {
  const now = {
    cardIdentity: SET.cardIdentity,
    combos: SET.combos.concat([{
      id: '3-3-3',
      c: ['Scurry Oak', 'Sadistic Glee', 'Hammerhead, Maggia Boss'],
      p: ['Infinite ETB'],
    }]),
  };
  assert.deepStrictEqual(matchSubstitutions(now, [RULE], held, []), []);
  // ...and the same via the included list, before the dataset catches up.
  assert.deepStrictEqual(
    matchSubstitutions(SET, [RULE], held,
      [{ id: 'x', c: ['Hammerhead, Maggia Boss', 'Scurry Oak', 'Sadistic Glee'] }]),
    []
  );
});

test('rule: missing or empty inputs are not an error', () => {
  assert.deepStrictEqual(matchSubstitutions(SET, [], held, []), []);
  assert.deepStrictEqual(matchSubstitutions(SET, null, held, []), []);
  assert.deepStrictEqual(matchSubstitutions(null, [RULE], held, []), []);
  assert.deepStrictEqual(matchSubstitutions(SET, [RULE], null, []), []);
  assert.deepStrictEqual(matchSubstitutions(SET, [{}], held, []), []);
});

test('rule: the shipped rules are shaped the way the page prints them', () => {
  assert.ok(SUBSTITUTIONS.length > 0);
  SUBSTITUTIONS.forEach((rule) => {
    assert.ok(rule.card && rule.substituteFor, 'a rule with nothing to swap');
    assert.notStrictEqual(nameKey(rule.card), nameKey(rule.substituteFor));
    assert.ok(['verified', 'derived'].includes(rule.confidence));
    assert.ok(rule.why && rule.why.length > 20, rule.card + ': no reasoning given');
    // Unattested rules are the dangerous kind — they would fire on every combo the
    // replaced card appears in, including the ones that want its rider.
    assert.ok(rule.attestedBy, rule.card + ': a rule must name a card that attests it');
    assert.notStrictEqual(nameKey(rule.attestedBy), nameKey(rule.substituteFor));
  });
});
