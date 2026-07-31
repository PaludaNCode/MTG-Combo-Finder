'use strict';
const test = require('node:test');
const assert = require('node:assert');
const DeckTheme = require('../theme.js');

// Which theme the page should be in is a decision with two inputs — what the reader
// chose, and what their system asks for — and a precedence between them. That is
// worth testing without a browser; the wiring that applies the answer is checked by
// the layout test, which can press the button and read the colours back.

test('theme: a stored choice wins over the system', () => {
  assert.strictEqual(DeckTheme.resolveTheme('dark', 'light'), 'dark');
  assert.strictEqual(DeckTheme.resolveTheme('light', 'dark'), 'light');
});

// The point of the whole change: without a choice the system still decides, so
// nobody's page changes until they ask for it to.
test('theme: with no choice, the system decides', () => {
  assert.strictEqual(DeckTheme.resolveTheme(null, 'light'), 'light');
  assert.strictEqual(DeckTheme.resolveTheme(null, 'dark'), 'dark');
  assert.strictEqual(DeckTheme.resolveTheme(undefined, 'light'), 'light');
});

// Storage is shared with every other site on the origin and with older versions of
// this one. Junk under our key is not a choice, and must not become one.
test('theme: junk in storage is not a choice', () => {
  assert.strictEqual(DeckTheme.resolveTheme('LIGHT', 'light'), 'light');
  assert.strictEqual(DeckTheme.resolveTheme('sepia', 'light'), 'light');
  assert.strictEqual(DeckTheme.resolveTheme('', 'light'), 'light');
  assert.strictEqual(DeckTheme.resolveTheme('{}', 'dark'), 'dark');
  assert.strictEqual(DeckTheme.resolveTheme(0, 'light'), 'light');
});

// A browser too old for matchMedia, or one that answers with nothing: dark is the
// base theme, so that is what an unanswerable question falls back to.
test('theme: dark when neither input says anything', () => {
  assert.strictEqual(DeckTheme.resolveTheme(null, null), 'dark');
  assert.strictEqual(DeckTheme.resolveTheme(null, 'sideways'), 'dark');
  assert.strictEqual(DeckTheme.resolveTheme(undefined, undefined), 'dark');
});

test('theme: the toggle goes both ways and only two ways', () => {
  assert.strictEqual(DeckTheme.otherTheme('dark'), 'light');
  assert.strictEqual(DeckTheme.otherTheme('light'), 'dark');
  // Pressing it twice is where you started, which is what makes it a toggle.
  assert.strictEqual(DeckTheme.otherTheme(DeckTheme.otherTheme('light')), 'light');
});

// The label names the destination, not the current state. A button reading "Light
// mode" while the page is already light is the bug this pins.
test('theme: the label says what pressing it will do', () => {
  assert.strictEqual(DeckTheme.labelFor('dark'), 'Light mode');
  assert.strictEqual(DeckTheme.labelFor('light'), 'Dark mode');
});

test('theme: the storage key is namespaced to this site', () => {
  assert.match(DeckTheme.KEY, /^mtg-combo-finder\./);
});
