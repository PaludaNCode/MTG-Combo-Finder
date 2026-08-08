'use strict';
const test = require('node:test');
const assert = require('node:assert');
const DeckCombos = require('../combos.js');
const DeckView = require('../view-model.js');

// "Cards you've added": the diff that decides what is in it, and the sentence over it.
//
// Both halves are here rather than in a browser test because both are decisions. The
// panel that renders them belongs to `npm run verify`; what a card has to do to *be* in
// the basket, and what the caption is allowed to claim about them, are answerable
// without a DOM and would otherwise be answerable only by looking.

const entry = (card, quantity = 1) => ({ quantity, card });

test('basket: no baseline means an empty basket, not a full one', () => {
  // The first search of a visit is what establishes a baseline. Until then the honest
  // answer is "nothing has been added", and the dangerous answer — the one a naive
  // `!baseline` check produces — is "the whole deck is new", which would offer to sell
  // somebody the deck they already own.
  assert.deepStrictEqual(DeckCombos.basketFrom(null, [entry('Sol Ring')]), []);
  assert.deepStrictEqual(DeckCombos.basketFrom(undefined, [entry('Sol Ring')]), []);
});

test('basket: it is the cards the deck has now and did not have then', () => {
  const before = [entry('Sol Ring'), entry('Basking Broodscale')];
  const now = [entry('Sol Ring'), entry('Basking Broodscale'), entry('Herd Baloth'), entry('Cleric Class')];
  assert.deepStrictEqual(DeckCombos.basketFrom(before, now), [
    { quantity: 1, card: 'Herd Baloth' },
    { quantity: 1, card: 'Cleric Class' },
  ]);
});

test('basket: a card typed straight into the box counts', () => {
  // The reason this is a diff and not a log of "+ Add to deck" presses. A click log
  // misses this case entirely, and nothing on screen would say so — the panel would
  // simply be one card short of the truth.
  const before = [entry('Sol Ring')];
  const now = [entry('Sol Ring'), entry('Ashnod’s Altar')];
  assert.deepStrictEqual(DeckCombos.basketFrom(before, now), [{ quantity: 1, card: 'Ashnod’s Altar' }]);
});

test('basket: a card deleted by hand leaves the basket on its own', () => {
  // The other half of the same argument: a log would need an un-log path, and would be
  // wrong until somebody wrote one.
  const before = [entry('Sol Ring')];
  assert.deepStrictEqual(DeckCombos.basketFrom(before, [entry('Sol Ring'), entry('Herd Baloth')]).length, 1);
  assert.deepStrictEqual(DeckCombos.basketFrom(before, [entry('Sol Ring')]), []);
});

test('basket: names are compared the way the rest of the page compares them', () => {
  // nameKey() folds the apostrophes and the case, and takes the front face of a
  // double-faced name. A basket that did its own comparison would offer to sell
  // somebody a card already in their deck, spelled differently.
  const before = [entry("Ashnod's Altar"), entry('Fire // Ice')];
  const now = [entry('ASHNOD’S ALTAR'), entry('Fire'), entry('Herd Baloth')];
  assert.deepStrictEqual(DeckCombos.basketFrom(before, now), [{ quantity: 1, card: 'Herd Baloth' }]);
});

test('basket: a name is listed once however many lines carry it', () => {
  const now = [entry('Herd Baloth'), entry('herd baloth')];
  assert.deepStrictEqual(DeckCombos.basketFrom([], now), [{ quantity: 1, card: 'Herd Baloth' }]);
});

test('basket: a bigger quantity of a card you already had is not a purchase', () => {
  // This is a singleton format, the case is vanishingly rare, and "you added a second
  // Sol Ring" is a claim about what somebody owns — which this page has never known and
  // must not start guessing at. Same caution as leaving an already-owned card for the
  // reader to remove rather than inferring it away.
  const before = [entry('Sol Ring', 1)];
  assert.deepStrictEqual(DeckCombos.basketFrom(before, [entry('Sol Ring', 4)]), []);
});

test('basket: the order follows the deck', () => {
  // So the panel reads down the decklist the way the box does, rather than in the order
  // somebody happened to press the button.
  const now = [entry('Zebra'), entry('Alpha'), entry('Mid')];
  assert.deepStrictEqual(DeckCombos.basketFrom([], now).map((e) => e.card), ['Zebra', 'Alpha', 'Mid']);
});

const only = (official) => ({ official, ours: 0 });

test('basket caption: the badge counts cards and the sentence says so', () => {
  // The trap this repository has met before: a count beside a heading that does not
  // count the panel's rows. Here the badge is cards and the claim is combos, which is
  // fine as long as the sentence leads with the cards.
  const note = DeckView.basketNote(5, only(33), only(80));
  assert.strictEqual(note.count, 5);
  assert.strictEqual(note.sentence,
    '5 cards that were not in the deck you started with. With them in, this deck has 80 combos rather than 33.');
});

test('basket caption: one card reads as one card', () => {
  const note = DeckView.basketNote(1, only(33), only(34));
  assert.strictEqual(note.sentence,
    '1 card that was not in the deck you started with. With it in, this deck has 34 combos rather than 33.');
});

test('basket caption: without a baseline figure it claims no delta', () => {
  // A restored deck can have a baseline whose combo count was never recorded. Saying
  // "from null combos" is the failure; saying only what is known is the fix.
  assert.strictEqual(DeckView.basketNote(3, null, only(80)).sentence,
    '3 cards that were not in the deck you started with.');
  assert.strictEqual(DeckView.basketNote(3, only(33), null).sentence,
    '3 cards that were not in the deck you started with.');
});

test('basket caption: adding cards that changed nothing says so', () => {
  // "went from 33 combos to 33" reads as an arithmetic error rather than as the useful
  // fact it is, which is that the reader has bought nothing.
  assert.strictEqual(DeckView.basketNote(2, only(33), only(33)).sentence,
    '2 cards that were not in the deck you started with. With them in, this deck still has 33 combos — none of them changed that.');
});

test('basket caption: a deck that lost combos is not phrased as a gain', () => {
  // Reachable: the basket only holds additions, but the reader can cut cards by hand in
  // the same sitting. Phrasing that as an increase would be the page lying about the
  // reader's own edit.
  assert.strictEqual(DeckView.basketNote(1, only(33), only(28)).sentence,
    '1 card that was not in the deck you started with. With it in, this deck has 28 combos, down from 33.');
});

test('basket caption: nothing added is no panel', () => {
  assert.strictEqual(DeckView.basketNote(0, only(33), only(33)), null);
});

test('basket caption: a card that only unlocks combos of ours is not reported as nothing', () => {
  // The bug this pair of numbers exists for. Counting only the published half read
  // "this deck still has 0 combos — none of them changed that" directly above a row
  // saying "1 combo · 0 official · 1 unofficial": a caption contradicting its own rows,
  // in the one case the unofficial panel exists to serve.
  assert.strictEqual(DeckView.basketNote(1, { official: 0, ours: 0 }, { official: 0, ours: 1 }).sentence,
    '1 card that was not in the deck you started with. With it in, this deck has 0 combos '
    + 'published by Commander Spellbook (was 0) and 1 of ours (was 0).');
});

test('basket caption: the two halves are never added together', () => {
  // An unofficial row is not published data and is never counted as though it were —
  // the rule the whole unofficial panel rests on. "13 combos" here would be 10 of
  // Spellbook's and 3 of ours reported as though Spellbook had published 13.
  const note = DeckView.basketNote(2, { official: 10, ours: 1 }, { official: 12, ours: 3 });
  assert.ok(!/1[345] combos/.test(note.sentence), note.sentence);
  assert.strictEqual(note.sentence,
    '2 cards that were not in the deck you started with. With them in, this deck has 12 combos '
    + 'published by Commander Spellbook (was 10) and 3 of ours (was 1).');
});
