'use strict';
const test = require('node:test');
const assert = require('node:assert');

const { commanderNames, markCommanders, expand } = require('../combos.js');
const DeckView = require('../view-model.js');

// The pin on a combo row that names a card in your command zone. Three things decide
// whether it says something true: which entries count as commanders, which rows get
// marked, and whether anything is said at all when no commander was declared — which is
// the common case for a pasted list and the branch an author never tests, because the
// author always has a marked deck in front of them.

test('only entries flagged commander count, and only once each', () => {
  const names = commanderNames([
    { card: 'Kinnan, Bonder Prodigy', commander: true },
    { card: 'Basalt Monolith' },
    // The same commander from both the marker and the commander box, which is exactly
    // how app.js can produce it: typed entries are concatenated with parsed ones.
    { card: "Kinnan, Bonder Prodigy", commander: true },
    { card: 'Thrasios, Triton Hero', commander: true },
  ]);
  assert.deepEqual(names, ['Kinnan, Bonder Prodigy', 'Thrasios, Triton Hero']);
});

test('a deck with no commander declared produces no names at all', () => {
  assert.deepEqual(commanderNames([{ card: 'Sol Ring' }, { card: 'Basalt Monolith' }]), []);
  assert.deepEqual(commanderNames([]), []);
  assert.deepEqual(commanderNames(undefined), []);
});

test('the folded key decides, so an apostrophe or a case difference still matches', () => {
  const rows = [expand({ id: '1', c: ["Ashnod's Altar", 'Nim Deathmantle'] })];
  // The curly apostrophe an export pastes in, against the straight one in the data.
  markCommanders(rows, ['Ashnod’s ALTAR']);
  assert.deepEqual(rows[0].commanders, ["Ashnod's Altar"]);
});

test('a row naming no commander is left without the field, not with an empty one', () => {
  const rows = [
    expand({ id: '1', c: ['Kinnan, Bonder Prodigy', 'Basalt Monolith'] }),
    expand({ id: '2', c: ['Sol Ring', 'Basalt Monolith'] }),
  ];
  markCommanders(rows, ['Kinnan, Bonder Prodigy']);
  assert.deepEqual(rows[0].commanders, ['Kinnan, Bonder Prodigy']);
  // Absent rather than []. The renderer's test is the field being there, and an empty
  // array is truthy — it would draw a pin naming nobody.
  assert.equal('commanders' in rows[1], false);
});

test('no commander declared marks nothing, so the page has no field to draw from', () => {
  const rows = [expand({ id: '1', c: ['Kinnan, Bonder Prodigy', 'Basalt Monolith'] })];
  markCommanders(rows, []);
  assert.equal('commanders' in rows[0], false);
  markCommanders(rows, undefined);
  assert.equal('commanders' in rows[0], false);
});

test('both halves of a partner pair are marked', () => {
  const rows = [expand({ id: '1', c: ['Thrasios, Triton Hero', 'Tymna the Weaver', 'Sol Ring'] })];
  markCommanders(rows, ['Thrasios, Triton Hero', 'Tymna the Weaver']);
  assert.deepEqual(rows[0].commanders, ['Thrasios, Triton Hero', 'Tymna the Weaver']);
});

test('the pin says nothing when there is nothing to say', () => {
  // The branch that has to stay silent, asserted directly: no commander, no pin, and
  // the renderer draws not even an empty element.
  assert.equal(DeckView.commanderPin(undefined), null);
  assert.equal(DeckView.commanderPin([]), null);
  assert.equal(DeckView.commanderPin(['', '  ']), null);
});

test('the pin names which card, because the row cannot', () => {
  const one = DeckView.commanderPin(['Kinnan, Bonder Prodigy']);
  assert.equal(one.label, 'Commander');
  // The label is on the row, so a three-card combo gives no way to tell which of the
  // three is the free one. The title is where that is answered.
  assert.match(one.title, /Kinnan, Bonder Prodigy is your commander/);

  const two = DeckView.commanderPin(['Thrasios, Triton Hero', 'Tymna the Weaver']);
  // Both named and pluralised. Picking one of a partner pair would be a claim about
  // which of them mattered.
  assert.match(two.title, /Thrasios, Triton Hero and Tymna the Weaver are your commanders/);
});
