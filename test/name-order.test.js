'use strict';
const test = require('node:test');
const assert = require('node:assert');
const DeckCombos = require('../combos.js');

const order = (names, opts) => DeckCombos.orderComboNames(names, opts);

// How a combo's cards are named on screen. Alphabetical by default, with two
// overrides that exist for the same reason: the reader should not have to hunt
// across a line for the card the row is actually about.

test('names: alphabetical with nothing to pin', () => {
  assert.deepStrictEqual(
    order(['Warren Soultrader', 'Chatterfang, Squirrel General', 'Essence Warden']),
    ['Chatterfang, Squirrel General', 'Essence Warden', 'Warren Soultrader']
  );
});

test('names: a lead goes first, the rest alphabetical', () => {
  assert.deepStrictEqual(
    order(['Warren Soultrader', 'Chatterfang, Squirrel General', 'Essence Warden'],
      { lead: 'Warren Soultrader' }),
    ['Warren Soultrader', 'Chatterfang, Squirrel General', 'Essence Warden']
  );
});

// The case this ordering was built for, and the one plain alphabetical gets wrong:
// four versions of one combo differing in a single card, whose name falls in the
// middle. Alphabetically these read "Chatterfang + Essence Warden + Warren
// Soultrader" and the difference moves line to line; the interchangeable card has to
// go last so every version reads "X + Y + the one that changes".
test('names: interchangeable cards go last even when they sort first or middle', () => {
  const shared = ['Chatterfang, Squirrel General', 'Warren Soultrader'];
  const choices = ['Essence Warden', 'Soul Warden', 'Prosperous Innkeeper', 'Lunarch Veteran // Luminous Phantom'];

  choices.forEach((choice) => {
    const names = shared.concat([choice]);
    assert.deepStrictEqual(order(names, { trail: choices }), [
      'Chatterfang, Squirrel General', 'Warren Soultrader', choice,
    ], `wrong order with ${choice}`);
    // The point, stated as the invariant: the card that differs is always last.
    assert.strictEqual(order(names, { trail: choices }).at(-1), choice);
  });
});

// Plain alphabetical would have put this one first, which is the regression this
// pins: 'Basalt Monolith' sorts above both shared cards.
test('names: a trailing card that sorts first is still sent last', () => {
  assert.deepStrictEqual(
    order(['Sword of the Meek', 'Walking Ballista', 'Basalt Monolith'], { trail: ['Basalt Monolith'] }),
    ['Sword of the Meek', 'Walking Ballista', 'Basalt Monolith']
  );
});

test('names: both sides of a trail are sorted', () => {
  assert.deepStrictEqual(
    order(['Zulaport Cutthroat', 'Blood Artist', 'Warren Soultrader', 'Chatterfang, Squirrel General'],
      { trail: ['Zulaport Cutthroat', 'Blood Artist'] }),
    ['Chatterfang, Squirrel General', 'Warren Soultrader', 'Blood Artist', 'Zulaport Cutthroat']
  );
});

// An ordering must never lose a card or invent one — the row is the combo.
test('names: every card survives every ordering', () => {
  const names = ['Warren Soultrader', 'Chatterfang, Squirrel General', 'Essence Warden'];
  [{}, { lead: 'Essence Warden' }, { trail: ['Essence Warden'] }, { lead: 'Nobody', trail: ['Essence Warden'] }]
    .forEach((opts) => {
      const out = order(names, opts);
      assert.strictEqual(out.length, names.length, `lost or gained a card with ${JSON.stringify(opts)}`);
      assert.deepStrictEqual([...out].sort(), [...names].sort());
    });
});

// A lead names one card; a trail names a set. Where both are given the lead wins,
// which is what the suggestion panel relies on — the card you would be adding reads
// first there, and it is often one of the interchangeable ones.
test('names: a lead outranks a trail', () => {
  assert.deepStrictEqual(
    order(['Chatterfang, Squirrel General', 'Warren Soultrader', 'Essence Warden'],
      { lead: 'Essence Warden', trail: ['Essence Warden'] }),
    ['Essence Warden', 'Chatterfang, Squirrel General', 'Warren Soultrader']
  );
});

// Matching is by the deck's own name key, so casing and spacing from a decklist do
// not quietly turn the ordering off.
test('names: trail matching ignores case and stray spacing', () => {
  assert.deepStrictEqual(
    order(['Chatterfang, Squirrel General', 'Essence Warden'], { trail: ['  essence   warden '] }),
    ['Chatterfang, Squirrel General', 'Essence Warden']
  );
  assert.deepStrictEqual(
    order(['Basalt Monolith', 'Warren Soultrader'], { trail: ['BASALT MONOLITH'] }),
    ['Warren Soultrader', 'Basalt Monolith']
  );
});

// A lead or trail naming nothing in this combo leaves it alphabetical rather than
// throwing or emptying the row.
test('names: pins that match nothing fall back to alphabetical', () => {
  const names = ['Warren Soultrader', 'Chatterfang, Squirrel General'];
  const alpha = ['Chatterfang, Squirrel General', 'Warren Soultrader'];
  assert.deepStrictEqual(order(names, { lead: 'Black Lotus' }), alpha);
  assert.deepStrictEqual(order(names, { trail: ['Black Lotus'] }), alpha);
  assert.deepStrictEqual(order(names, { trail: [] }), alpha);
  assert.deepStrictEqual(order(names, null), alpha);
  assert.deepStrictEqual(order(names), alpha);
});

test('names: nothing in, nothing out', () => {
  assert.deepStrictEqual(order([]), []);
  assert.deepStrictEqual(order(null), []);
  assert.deepStrictEqual(order(undefined, { trail: ['x'] }), []);
  assert.deepStrictEqual(order(['', '  ', null, 7, 'Blood Artist']), ['Blood Artist']);
});
