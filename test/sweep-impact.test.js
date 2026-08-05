'use strict';
// Splitting a sweep's diff into "somebody needs to read this" and "a number in a summary".
//
// A sweep of 34,422 cards reports every wording that moved, and almost all of it belongs to
// cards nothing here has reasoned about. The subset that matters is the cards `unofficial.js`
// and `research-log.js` cite, because that is the failure nothing else catches: a row citing
// "sacrifice a Food" and a card that stopped saying it. The row keeps matching, the tests keep
// passing, and the reasoning underneath is wrong.
const test = require('node:test');
const assert = require('node:assert');
const CardText = require('../tools/card-text.js');
const { citedNames, compare, impact, issueBody } = require('../tools/sweep-impact.js');

const entry = (name, oracle, extra = {}) => Object.assign(CardText.normalize({
  name,
  layout: 'normal',
  lang: 'en',
  mana_cost: '{1}{G}',
  color_identity: ['G'],
  legalities: { commander: 'legal' },
  type_line: 'Creature — Test',
  oracle_text: oracle,
  oracle_id: extra.oracleId,
}), extra);

const doc = (...entries) => ({
  generated: '2026-08-05',
  count: entries.length,
  cards: Object.fromEntries(entries.map((e) => [e.name, e])),
});

// A tiny stand-in for the two real data files, so these tests do not move when a row is added.
const CITES = {
  unofficial: { COMBOS: [{ c: ['Cited Card', 'Other Half'] }] },
  researchLog: { PASSES: [{ cards: ['Swept Subject'], read: { 'Read Card': 'text' } }] },
};

// ---- what counts as cited ----------------------------------------------------

test('cited names come from rows, pass subjects and the pasted oracle text alike', () => {
  const names = citedNames(CITES);
  assert.ok(names.has('Cited Card'));
  assert.ok(names.has('Other Half'));
  assert.ok(names.has('Swept Subject'));
  // The strongest signal: somebody looked this card up on purpose and pasted its text.
  assert.ok(names.has('Read Card'));
  assert.ok(!names.has('Never Mentioned'));
});

test('the real data files are readable and cite a plausible number of cards', () => {
  // A floor, so a broken require or an emptied file cannot make every sweep look harmless.
  const names = citedNames();
  assert.ok(names.size > 150, `only ${names.size} cited names — too few to mean anything`);
});

// ---- the comparison ----------------------------------------------------------

test('a changed wording is found, an unchanged one is not', () => {
  const before = doc(entry('A', 'old'), entry('B', 'same'));
  const after = doc(entry('A', 'NEW'), entry('B', 'same'));
  const out = compare(before, after);
  assert.deepStrictEqual(out.changed.map((c) => c.name), ['A']);
  assert.deepStrictEqual(out.added, []);
  assert.deepStrictEqual(out.gone, []);
});

test('a rename is a rename, not a disappearance plus an arrival', () => {
  const before = doc(entry('Old Name', 'text', { oracleId: 'id-1' }));
  const after = doc(entry('New Name', 'text', { oracleId: 'id-1' }));
  const out = compare(before, after);
  assert.deepStrictEqual(out.renamed, [{ from: 'Old Name', to: 'New Name' }]);
  assert.deepStrictEqual(out.gone, [], 'a renamed card has not gone');
  assert.deepStrictEqual(out.added, [], 'and has not arrived');
  assert.deepStrictEqual(out.changed, [], 'and its wording did not move');
});

test('a genuinely new card is added and a genuinely dropped one is gone', () => {
  const before = doc(entry('Stays', 'text'), entry('Drops', 'text'));
  const after = doc(entry('Stays', 'text'), entry('Arrives', 'text'));
  const out = compare(before, after);
  assert.deepStrictEqual(out.added, ['Arrives']);
  assert.deepStrictEqual(out.gone, ['Drops']);
});

test('the date moving on its own is not a change', () => {
  const before = doc(entry('A', 'text'));
  const after = doc(Object.assign({}, entry('A', 'text'), { fetched: '2030-01-01' }));
  assert.deepStrictEqual(compare(before, after).changed, []);
});

// ---- the split that decides whether to tell anyone ---------------------------

test('a changed card nobody cites is counted and does not raise attention', () => {
  const before = doc(entry('Random Card', 'old'));
  const after = doc(entry('Random Card', 'NEW'));
  const out = impact(before, after, CITES);
  assert.strictEqual(out.changed.length, 1, 'still counted for scale');
  assert.deepStrictEqual(out.citedChanged, []);
  assert.strictEqual(out.needsAttention, false);
});

test('a changed card something cites needs attention', () => {
  const before = doc(entry('Cited Card', 'sacrifice a Food'));
  const after = doc(entry('Cited Card', 'sacrifice a creature'));
  const out = impact(before, after, CITES);
  assert.deepStrictEqual(out.citedChanged.map((c) => c.name), ['Cited Card']);
  assert.strictEqual(out.needsAttention, true);
});

test('a renamed cited card needs attention even though its wording is intact', () => {
  const before = doc(entry('Cited Card', 'text', { oracleId: 'id-1' }));
  const after = doc(entry('Renamed Entirely', 'text', { oracleId: 'id-1' }));
  const out = impact(before, after, CITES);
  assert.deepStrictEqual(out.citedRenamed, [{ from: 'Cited Card', to: 'Renamed Entirely' }]);
  assert.strictEqual(out.needsAttention, true);
});

test('a cited card Scryfall stopped listing needs attention', () => {
  const out = impact(doc(entry('Cited Card', 'text')), doc(entry('Unrelated', 'text')), CITES);
  assert.deepStrictEqual(out.citedGone, ['Cited Card']);
  assert.strictEqual(out.needsAttention, true);
});

// The apostrophe again. A citation written with a curly quote must still be recognised as
// citing the card, or the filter silently answers "nothing to see".
test('a citation spelled with a curly apostrophe still matches the card', () => {
  const cites = { unofficial: { COMBOS: [{ c: ['Ashnod’s Altar'] }] }, researchLog: { PASSES: [] } };
  const out = impact(
    doc(entry("Ashnod's Altar", 'old')),
    doc(entry("Ashnod's Altar", 'NEW')),
    cites,
  );
  assert.deepStrictEqual(out.citedChanged.map((c) => c.name), ["Ashnod's Altar"]);
  assert.strictEqual(out.needsAttention, true);
});

test('an unchanged sweep needs nobody', () => {
  const same = doc(entry('Cited Card', 'text'));
  const out = impact(same, same, CITES);
  assert.strictEqual(out.needsAttention, false);
  assert.deepStrictEqual(out.changed, []);
});

// ---- the issue body ----------------------------------------------------------

test('the body names the cards and points at the command rather than claiming to be current', () => {
  const out = impact(
    doc(entry('Cited Card', 'old'), entry('Random', 'old')),
    doc(entry('Cited Card', 'NEW'), entry('Random', 'NEW')),
    CITES,
  );
  const body = issueBody(out, { sha: 'abc1234', snapshot: '2026-08-05' });
  assert.match(body, /Cited Card/);
  // CLAUDE.md's rule for an issue: point at the live answer, do not become a second one.
  assert.match(body, /Do not treat this list as the live answer/);
  assert.match(body, /node tools\/sweep-impact\.js/);
  assert.match(body, /abc1234/);
  // The uncited change is a total, not a bullet.
  assert.match(body, /2 changed/);
  assert.doesNotMatch(body, /- `Random`/);
});

// Nothing closes this issue but a person, and the body has to say so. The first version of the
// workflow closed it on the next sweep that found no NEW cited change — which is unfinished
// work marked done, because a sweep cannot know whether the reading it asked for happened.
test('the body says a person closes it, and why nothing else can', () => {
  const out = impact(doc(entry('Cited Card', 'old')), doc(entry('Cited Card', 'NEW')), CITES);
  const body = issueBody(out);
  assert.match(body, /Close this when the cards above have been read/);
  assert.match(body, /Nothing closes\s+it automatically/);
});
