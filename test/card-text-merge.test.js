'use strict';
// Folding a sweep into the cache, which is the thing that makes a sweep repeatable.
//
// The cache went from a few hundred hand-picked cards to every card there is. At that size
// the old shape had a trap: every entry carried the date it was last *fetched*, so a second
// full sweep rewrote all of them and landed as a diff where every line changed — destroying
// the one property `tools/card-text.js` normalises the entries to protect, which is that a
// card's wording arrives as a diff somebody reads. These tests pin the split that fixes it,
// and the two rules that stop a sweep losing information.
const test = require('node:test');
const assert = require('node:assert');
const CardText = require('../tools/card-text.js');

const scryfall = (name, oracle, extra = {}) => Object.assign({
  name,
  layout: 'normal',
  lang: 'en',
  mana_cost: '{2}{G}',
  color_identity: ['G'],
  legalities: { commander: 'legal' },
  type_line: 'Creature — Squirrel Warrior',
  oracle_text: oracle,
}, extra);

const reading = (name, oracle, extra) => CardText.normalize(scryfall(name, oracle, extra));
const at = (iso) => Date.parse(iso + 'T00:00:00Z');

// ---- the date only moves when the wording does --------------------------------

test('an unchanged wording keeps its old date, so a re-sweep is not a whole-file diff', () => {
  const first = CardText.merge({}, [reading('Chatterfang', 'Tap: make a Squirrel.')], at('2026-01-01'));
  assert.deepStrictEqual(first.added, ['Chatterfang']);
  assert.strictEqual(first.cards.Chatterfang.fetched, '2026-01-01');

  const again = CardText.merge(
    first.cards,
    [reading('Chatterfang', 'Tap: make a Squirrel.')],
    at('2026-08-05'),
  );
  assert.deepStrictEqual(again.changed, []);
  assert.strictEqual(again.unchanged, 1);
  // The whole point: seven months later, the entry is byte-identical.
  assert.deepStrictEqual(again.cards.Chatterfang, first.cards.Chatterfang);
});

test('a changed wording takes the new date and is reported by name, not just counted', () => {
  const first = CardText.merge({}, [reading('Chatterfang', 'old text')], at('2026-01-01'));
  const errata = CardText.merge(first.cards, [reading('Chatterfang', 'new text')], at('2026-08-05'));
  assert.deepStrictEqual(errata.changed, ['Chatterfang']);
  assert.strictEqual(errata.cards.Chatterfang.fetched, '2026-08-05');
  assert.strictEqual(errata.cards.Chatterfang.faces[0].oracle, 'new text');
});

// A count of "4 changed" is not something anybody acts on; four names are, because each may
// sit under a published row's reasoning. This is the sweep's only errata detector.
test('a change in any field the reader prints counts as a change', () => {
  const base = CardText.merge({}, [reading('X', 'text')], at('2026-01-01')).cards;
  const cases = {
    'mana cost': { mana_cost: '{3}{G}' },
    'colour identity': { color_identity: ['G', 'B'] },
    'commander legality': { legalities: { commander: 'banned' } },
    'type line': { type_line: 'Creature — Fox Rogue' },
    'power and toughness': { power: '2', toughness: '2' },
  };
  for (const [what, extra] of Object.entries(cases)) {
    const out = CardText.merge(base, [reading('X', 'text', extra)], at('2026-08-05'));
    assert.deepStrictEqual(out.changed, ['X'], `${what} should count as a change`);
  }
});

// It compares wording, not identity — `merge()` has already decided which card this is, by
// oracleId or by name, before asking. So the date, the name and the id are all invisible here
// and a difference in the printed reading is not.
test('sameReading compares the wording, ignoring date, name and identity', () => {
  const a = reading('X', 'text');
  assert.ok(CardText.sameReading(a, Object.assign({}, a, { fetched: '1999-01-01' })));
  assert.ok(CardText.sameReading(a, Object.assign({}, a, { name: 'Renamed' })));
  assert.ok(CardText.sameReading(a, Object.assign({}, a, { oracleId: 'whatever' })));
  assert.ok(!CardText.sameReading(a, reading('X', 'other')));
  assert.ok(!CardText.sameReading(a, null));
});

// ---- nothing is ever lost ----------------------------------------------------

// Deleting would quietly withdraw the support for whatever cited the card, and a rename is
// the ordinary cause. So it is kept and reported, and wants a person.
test('a cached card the sweep did not see is kept and reported, never deleted', () => {
  const existing = CardText.merge({}, [reading('Gone Away', 'text')], at('2026-01-01')).cards;
  const out = CardText.merge(existing, [reading('Still Here', 'text')], at('2026-08-05'));
  assert.deepStrictEqual(out.absent, ['Gone Away']);
  assert.ok(out.cards['Gone Away'], 'the absent card must survive the sweep');
  assert.strictEqual(out.cards['Gone Away'].fetched, '2026-01-01');
});

// ---- the apostrophe, which is why this needed a key at all --------------------

// Scryfall spells names with an ASCII quote; a curly one arrives constantly, because it is
// what Scryfall's own oracle *text* uses and what any word processor substitutes. Keyed
// literally the two are different cards, so the cache used to grow a second entry and
// neither copy was wrong — the invisible kind of wrong.
test('a curly apostrophe matches the ASCII one instead of creating a second entry', () => {
  assert.strictEqual(CardText.key('Ashnod’s Altar'), CardText.key("Ashnod's Altar"));
  const curly = CardText.merge({}, [reading('Ashnod’s Altar', 'text')], at('2026-01-01')).cards;
  const swept = CardText.merge(curly, [reading("Ashnod's Altar", 'text')], at('2026-08-05'));
  assert.strictEqual(Object.keys(swept.cards).length, 1, 'one card, not two spellings of it');
  // Scryfall's spelling wins, and the date does not move — the wording never changed.
  assert.ok(swept.cards["Ashnod's Altar"]);
  assert.strictEqual(swept.cards["Ashnod's Altar"].fetched, '2026-01-01');
  assert.deepStrictEqual(swept.absent, []);
});

test('the existing cache has no two names that fold to one key', () => {
  // Folding apostrophes changed what `key()` considers the same card. If two real cards in
  // the committed cache collided under the new rule, one would silently shadow the other.
  const names = Object.keys(require('../card-text.json').cards);
  const seen = new Map();
  for (const name of names) {
    const k = CardText.key(name);
    assert.ok(!seen.has(k), `${name} collides with ${seen.get(k)}`);
    seen.set(k, name);
  }
});

// ---- the file stays readable -------------------------------------------------

test('a sweep writes names sorted, so an entry lands in a stable place', () => {
  const out = CardText.merge({}, [reading('Zephyr', 'a'), reading('Aether', 'b')], at('2026-01-01'));
  const tmp = require('node:path').join(
    require('node:os').tmpdir(), `card-text-merge-${process.pid}.json`,
  );
  const doc = CardText.write(out.cards, tmp, at('2026-01-01'));
  require('node:fs').unlinkSync(tmp);
  assert.deepStrictEqual(Object.keys(doc.cards), ['Aether', 'Zephyr']);
  assert.strictEqual(doc.generated, '2026-01-01');
  assert.strictEqual(doc.count, 2);
});

// ---- the finish condition for the sweep --------------------------------------

// Issue #162's phase 1 finishes here: every card this repository has already reasoned about
// resolves from the committed cache alone, so `tools/lookup-card.js` needs no network for
// any of it and a research pass never waits on a workflow round trip. That round trip was
// the point of the sweep — it produced the two worst end-to-end latencies in this repo's
// history, 550 minutes and 62 minutes against a 5-minute median.
//
// It strengthens on its own: every row added to `unofficial.js` and every pass logged in
// `research-log.js` adds names this has to keep answering. A new card that Scryfall published
// after the last sweep is what makes it fail, and the fix is a sweep, not an exception.
test('every card unofficial.js and research-log.js name is in the cache already', () => {
  const cache = CardText.read();
  const { COMBOS } = require('../unofficial.js');
  const { PASSES } = require('../research-log.js');

  const want = new Set();
  for (const row of COMBOS) for (const name of row.c || []) want.add(name);
  for (const pass of PASSES) {
    for (const name of pass.cards || []) want.add(name);
    // The `read` keys are the verbatim oracle text the pass pasted in, so these are exactly
    // the cards somebody had to look up.
    for (const name of Object.keys(pass.read || {})) want.add(name);
  }

  const missing = [...want].filter((name) => !CardText.lookup(cache, name));
  assert.deepStrictEqual(
    missing, [],
    `${missing.length} of ${want.size} named cards are not cached — re-run the "Cache card `
    + 'text" workflow with `sweep` ticked',
  );
  // A floor as well as a list, so an empty COMBOS or a broken require cannot pass this by
  // asking about nothing.
  assert.ok(want.size > 150, `only ${want.size} names were checked — that is too few to mean anything`);
});

// ---- phase 2: a card is found by identity, not only by name ------------------

// Names are not stable identifiers. Before `oracleId`, a rename produced an addition under
// the new name and an `absent` under the old one — the same shape as a genuinely new card
// plus a genuinely retired one, leaving a reader to pair them up by eye. Every row in
// `unofficial.js` and rule-out in `research-log.js` cites the OLD name, so getting this wrong
// silently detaches the reasoning from the card.
const withId = (name, oracle, id, extra) => Object.assign(
  reading(name, oracle, extra), { oracleId: id },
);

test('a renamed card is recognised as one card and reported as a rename', () => {
  const before = CardText.merge({}, [withId('Old Name', 'text', 'abc-123')], at('2026-01-01')).cards;
  const after = CardText.merge(before, [withId('New Name', 'text', 'abc-123')], at('2026-08-05'));

  assert.deepStrictEqual(after.renamed, [{ from: 'Old Name', to: 'New Name' }]);
  assert.deepStrictEqual(after.added, [], 'a rename is not an addition');
  assert.deepStrictEqual(after.absent, [], 'a rename is not a disappearance');
  assert.deepStrictEqual(Object.keys(after.cards), ['New Name'], 'one card, under the new name');
  // The wording never moved, so neither does the date — a rename is not errata.
  assert.strictEqual(after.cards['New Name'].fetched, '2026-01-01');
});

test('a rename that also changes the wording is both, and takes the new date', () => {
  const before = CardText.merge({}, [withId('Old Name', 'old', 'abc-123')], at('2026-01-01')).cards;
  const after = CardText.merge(before, [withId('New Name', 'NEW', 'abc-123')], at('2026-08-05'));
  assert.deepStrictEqual(after.renamed, [{ from: 'Old Name', to: 'New Name' }]);
  assert.deepStrictEqual(after.changed, ['New Name']);
  assert.strictEqual(after.cards['New Name'].fetched, '2026-08-05');
});

// Same name, different card. Without the id check ordering being identity-first-then-name,
// this is indistinguishable from the rename above.
test('two different cards sharing a name are not collapsed into one', () => {
  const before = CardText.merge({}, [withId('Ambiguous', 'first', 'id-one')], at('2026-01-01')).cards;
  const after = CardText.merge(before, [withId('Ambiguous', 'second', 'id-two')], at('2026-08-05'));
  // Matched by name because id-two is unknown, so it replaces rather than duplicating — the
  // file is keyed by name and cannot hold both. What matters is that it is reported as
  // changed rather than passed over as unchanged.
  assert.deepStrictEqual(after.changed, ['Ambiguous']);
  assert.strictEqual(after.cards.Ambiguous.oracleId, 'id-two');
});

// The reason `oracleId` is stripped in sameReading(). The sweep that first populated the
// field ran against 34,422 entries that had none; counting that as errata would have moved
// every date, produced the whole-file diff the split exists to prevent, and reported the
// entire cache as changed text in the same move.
test('adding oracleId to an entry that lacked one is not a wording change', () => {
  const legacy = CardText.merge({}, [reading('Chatterfang', 'text')], at('2026-01-01')).cards;
  delete legacy.Chatterfang.oracleId; // the pre-phase-2 shape
  const swept = CardText.merge(legacy, [withId('Chatterfang', 'text', 'abc-123')], at('2026-08-05'));
  assert.deepStrictEqual(swept.changed, [], 'gaining an identity is not errata');
  assert.strictEqual(swept.unchanged, 1);
  assert.strictEqual(swept.cards.Chatterfang.fetched, '2026-01-01', 'the date must not move');
  assert.strictEqual(swept.cards.Chatterfang.oracleId, 'abc-123', 'but the id must be stored');
});

test('an entry with no oracleId is still found by name, so a legacy cache keeps working', () => {
  const legacy = CardText.merge({}, [reading('Chatterfang', 'text')], at('2026-01-01')).cards;
  delete legacy.Chatterfang.oracleId;
  const swept = CardText.merge(legacy, [reading('Chatterfang', 'text')], at('2026-08-05'));
  assert.deepStrictEqual(swept.added, []);
  assert.strictEqual(swept.unchanged, 1);
});
