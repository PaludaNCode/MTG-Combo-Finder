'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseDecklist, addMainDeckCard } = require('../parser.js');
const { nameKey, deckNameSet } = require('../combos.js');

// Whole decklists as the sites actually hand them over, rather than a line at a time.
// The line-level cases live in parser.test.js; what these add is the *shape* — where
// the sections are, what order they come in, and what that does to a card written back
// into the box.
//
// That last part is why this file exists. "+ Add to deck" writes into a list someone
// pasted, and the reported bug was entirely about shape: a card appended to the end of
// an export that ends in a section is read as a sideboard card and never enters the
// deck, so the suggestion comes back and the button looks broken. Every format below is
// therefore checked twice — parsed, then added to and parsed again.

const CARD = 'Heliod, Sun-Crowned';

// What the page does when + Add to deck is pressed, and what the next search reads.
function afterAdding(text) {
  const box = addMainDeckCard(text, CARD, 1);
  const parsed = parseDecklist(box);
  return {
    box,
    main: parsed.main.map((e) => e.card),
    commanders: parsed.commanders.map((e) => e.card),
    inDeck: deckNameSet(parsed.main.concat(parsed.commanders)).has(nameKey(CARD)),
    isCommander: parsed.commanders.some((e) => nameKey(e.card) === nameKey(CARD)),
  };
}

// ---- the shapes ------------------------------------------------------------

const EXPORTS = {
  // Moxfield's plainest text export: set code and collector number, no headings at
  // all. This is what was pasted into the box in the session that found the bug.
  'moxfield, no headings': [
    '1 Arcane Signet (C20) 237',
    '1 Scurry Oak (MH2) 172',
    '1 Sol Ring (C18) 222',
  ].join('\n'),

  // With the commander called out, which is the usual Commander export.
  'moxfield, Commander then Deck': [
    'Commander',
    '1 Chatterfang, Squirrel General (MH2) 178',
    '',
    'Deck',
    '1 Arcane Signet (C20) 237',
    '1 Scurry Oak (MH2) 172',
  ].join('\n'),

  // The order reported from a live box: the command zone comes *last*.
  'moxfield, Main / Sideboard / Commanders': [
    'Main',
    '1 Arcane Signet (C20) 237',
    '1 Scurry Oak (MH2) 172',
    '',
    'Sideboard',
    '1 Pithing Needle (WWK) 1',
    '',
    'Commanders',
    '1 Chatterfang, Squirrel General (MH2) 178',
  ].join('\n'),

  // ...and the same three sections the other way round, which is where a card
  // appended to the end is lost rather than promoted.
  'moxfield, Main / Commanders / Sideboard': [
    'Main',
    '1 Arcane Signet (C20) 237',
    '',
    'Commanders',
    '1 Chatterfang, Squirrel General (MH2) 178',
    '',
    'Sideboard',
    '1 Pithing Needle (WWK) 1',
  ].join('\n'),

  // Headings carrying their own counts, decorated the way exports decorate them.
  'moxfield, counted headings': [
    'Commander (1)',
    '1 Chatterfang, Squirrel General',
    '',
    'Deck (99)',
    '1 Arcane Signet',
    '1 Scurry Oak',
    '',
    'Sideboard (7)',
    '1 Pithing Needle',
  ].join('\n'),

  // Grouped by card type. The type lines are labels, not boards, and must not stop
  // the main deck early — a card added after one still belongs to the deck.
  'moxfield, grouped by type': [
    'Commander (1)',
    '1 Chatterfang, Squirrel General',
    '',
    'Deck (3)',
    'Creatures (2)',
    '1 Scurry Oak',
    '1 Basking Broodscale',
    '',
    'Artifacts (1)',
    '1 Sol Ring',
  ].join('\n'),

  // `1x` quantities and foil / etched annotations.
  'moxfield, 1x quantities and foil markers': [
    '1x Arcane Signet (C20) 237 *F*',
    '1x Scurry Oak (MH2) 172',
    '2x Forest (WAR) 263 *E*',
  ].join('\n'),

  // MTGO puts its sideboard on prefixed lines rather than under a heading, so the
  // main deck never ends and an appended card lands in it either way.
  'mtgo, SB: prefixed sideboard': [
    '1 Arcane Signet',
    '1 Scurry Oak',
    'SB: 1 Pithing Needle',
  ].join('\n'),

  // Arena's export: a blank line and a bare Sideboard heading.
  'arena, Deck / Sideboard': [
    'Deck',
    '1 Arcane Signet (C20) 237',
    '1 Scurry Oak (MH2) 172',
    '',
    'Sideboard',
    '1 Pithing Needle (WWK) 1',
  ].join('\n'),
};

// ---- every shape parses into the right boards ------------------------------

test('exports: the main deck is found in every shape', () => {
  for (const [label, text] of Object.entries(EXPORTS)) {
    const parsed = parseDecklist(text);
    assert.ok(parsed.main.length > 0, `${label}: no main-deck cards were found`);
    // Arcane Signet is in every fixture's main deck, whatever the shape around it.
    assert.ok(
      parsed.main.some((e) => nameKey(e.card) === nameKey('Arcane Signet'))
        || parsed.main.some((e) => nameKey(e.card) === nameKey('Scurry Oak')),
      `${label}: the main deck is missing its cards`
    );
  }
});

test('exports: a sideboard is never counted as deck', () => {
  for (const [label, text] of Object.entries(EXPORTS)) {
    if (!/sideboard/i.test(text)) continue;
    const held = deckNameSet(parseDecklist(text).main.concat(parseDecklist(text).commanders));
    assert.ok(!held.has(nameKey('Pithing Needle')), `${label}: a sideboard card reached the deck`);
  }
});

test('exports: a named commander lands in the command zone', () => {
  for (const [label, text] of Object.entries(EXPORTS)) {
    if (!/^command/im.test(text)) continue;
    const parsed = parseDecklist(text);
    assert.deepStrictEqual(
      parsed.commanders.map((e) => e.card),
      ['Chatterfang, Squirrel General'],
      `${label}: wrong command zone`
    );
  }
});

// ---- and every shape survives having a card written back into it -----------

test('exports: an added card reaches the deck in every shape', () => {
  for (const [label, text] of Object.entries(EXPORTS)) {
    const out = afterAdding(text);
    assert.ok(out.inDeck, `${label}: the added card never entered the deck`);
  }
});

// The quiet half of the reported bug. With the command zone last, appending to the end
// of the box did not lose the card — it promoted it, silently changing the deck's
// commander and with it the colour identity every suggestion is filtered by.
test('exports: an added card never joins the command zone', () => {
  for (const [label, text] of Object.entries(EXPORTS)) {
    const out = afterAdding(text);
    assert.ok(!out.isCommander, `${label}: the added card became a commander`);
  }
});

test('exports: adding a card disturbs nothing else in the list', () => {
  for (const [label, text] of Object.entries(EXPORTS)) {
    const before = parseDecklist(text);
    const out = afterAdding(text);
    assert.deepStrictEqual(
      out.commanders, before.commanders.map((e) => e.card),
      `${label}: the command zone changed`
    );
    before.main.forEach((e) => {
      assert.ok(
        out.main.some((n) => nameKey(n) === nameKey(e.card)),
        `${label}: ${e.card} was lost from the main deck`
      );
    });
    assert.strictEqual(out.main.length, before.main.length + 1, `${label}: wrong main-deck count`);
  }
});

// The two orders are worth pinning individually, because they failed differently and a
// single "it works now" test would hide that.
test('exports: with the sideboard last, the card goes above it', () => {
  const out = afterAdding(EXPORTS['moxfield, Main / Commanders / Sideboard']);
  const lines = out.box.split('\n').map((l) => l.trim());
  assert.ok(lines.indexOf('1 ' + CARD) < lines.findIndex((l) => /^sideboard/i.test(l)));
  assert.ok(out.inDeck);
});

test('exports: with the command zone last, the card still is not a commander', () => {
  const out = afterAdding(EXPORTS['moxfield, Main / Sideboard / Commanders']);
  const lines = out.box.split('\n').map((l) => l.trim());
  assert.ok(lines.indexOf('1 ' + CARD) < lines.findIndex((l) => /^sideboard/i.test(l)));
  assert.deepStrictEqual(out.commanders, ['Chatterfang, Squirrel General']);
  assert.ok(out.inDeck);
});

// Type groupings are labels, not boards: a card added to a list grouped by type goes
// under the last group rather than being treated as leaving the deck.
test('exports: type groupings do not end the main deck', () => {
  const out = afterAdding(EXPORTS['moxfield, grouped by type']);
  assert.ok(out.inDeck);
  assert.deepStrictEqual(out.main, ['Scurry Oak', 'Basking Broodscale', 'Sol Ring', CARD]);
  // And it went under the deck rather than above the command zone.
  const lines = out.box.split('\n').map((l) => l.trim());
  assert.ok(lines.indexOf('1 ' + CARD) > lines.findIndex((l) => /^commander/i.test(l)));
});
