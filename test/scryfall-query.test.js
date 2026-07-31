'use strict';
const test = require('node:test');
const assert = require('node:assert');
const DeckCombos = require('../combos.js');

// A suggestion can be a choice between sixteen cards that do the same job, and
// making that choice means looking at all sixteen. scryfallSetQuery() is the query
// that puts them on one Scryfall page, so the page can offer one link instead of
// leaving the reader to middle-click sixteen.
//
// What matters here is the query being *exact*: a loose search matches every card
// whose name contains one of these, which quietly turns a comparison of sixteen
// specific cards into a list of forty.

test('scryfall query: exact names, joined with or', () => {
  assert.strictEqual(
    DeckCombos.scryfallSetQuery(['Blood Artist', 'Zulaport Cutthroat']),
    '!"Blood Artist" or !"Zulaport Cutthroat"'
  );
});

test('scryfall query: one card needs no or', () => {
  assert.strictEqual(DeckCombos.scryfallSetQuery(['Blood Artist']), '!"Blood Artist"');
});

// The bang is the whole point. Without it Scryfall reads the words as a substring
// search, and "Blood Artist" also brings back anything else carrying those words —
// a different set of cards than the one the page is offering to compare.
test('scryfall query: every name is anchored as exact', () => {
  const q = DeckCombos.scryfallSetQuery(['Blood Artist', "Nadier's Nightblade", 'Relic Vial']);
  q.split(' or ').forEach((term) => {
    assert.match(term, /^!".+"$/, `not an exact term: ${term}`);
  });
});

// Apostrophes and commas are ordinary in Magic names and must survive untouched —
// they are inside a quoted term, so Scryfall takes them literally.
test('scryfall query: punctuation in names is left alone', () => {
  assert.strictEqual(
    DeckCombos.scryfallSetQuery(["Nadier's Nightblade", 'Sephiroth, Fabled SOLDIER']),
    '!"Nadier\'s Nightblade" or !"Sephiroth, Fabled SOLDIER"'
  );
});

// The same card twice is a wasted term in a URL that already carries sixteen, and
// Scryfall shows it once regardless. Deduplicated by the deck's own name key, so
// casing and stray spacing count as the same card here as everywhere else.
test('scryfall query: the same card is asked for once', () => {
  assert.strictEqual(
    DeckCombos.scryfallSetQuery(['Blood Artist', 'blood artist', '  Blood   Artist ']),
    '!"Blood Artist"'
  );
});

test('scryfall query: blanks and non-strings are dropped, not rendered', () => {
  assert.strictEqual(
    DeckCombos.scryfallSetQuery(['Blood Artist', '', '   ', null, undefined, 7, 'Relic Vial']),
    '!"Blood Artist" or !"Relic Vial"'
  );
});

// Nothing to compare is not a query — the caller draws no button for an empty
// string, and a bare `?q=` would open an error page on Scryfall.
test('scryfall query: nothing in, nothing out', () => {
  assert.strictEqual(DeckCombos.scryfallSetQuery([]), '');
  assert.strictEqual(DeckCombos.scryfallSetQuery(null), '');
  assert.strictEqual(DeckCombos.scryfallSetQuery(undefined), '');
  assert.strictEqual(DeckCombos.scryfallSetQuery(['', null]), '');
});

// A double quote would close the term early and change what the query matches. No
// real card name contains one, which is exactly why this is worth pinning: the day
// one arrives from the dataset, it must not be able to rewrite the search.
test('scryfall query: a quote in a name cannot break out of the term', () => {
  const q = DeckCombos.scryfallSetQuery(['Say "Ahh"']);
  assert.strictEqual(q, '!"Say Ahh"');
  assert.strictEqual((q.match(/"/g) || []).length, 2);
});

// The real shape this was built for: the sixteen-card group from a live search.
// Sixteen exact terms, fifteen joins, and a URL well inside what browsers and
// Scryfall accept once encoded.
test('scryfall query: a full sixteen-card choice', () => {
  const names = [
    'Al Bhed Salvagers', 'Bastion of Remembrance', 'Blood Artist', 'Cauldron of Essence',
    'Cruel Celebrant', 'Embalmed Ascendant', 'Falkenrath Noble', 'Funeral Room',
    "Nadier's Nightblade", 'Popular Egotist', 'Relic Vial', 'Sephiroth, Fabled SOLDIER',
    'Susurian Voidborn', 'Venerated Stormsinger', 'Vengeful Bloodwitch', 'Zulaport Cutthroat',
  ];
  const q = DeckCombos.scryfallSetQuery(names);
  assert.strictEqual(q.split(' or ').length, 16);
  names.forEach((name) => assert.ok(q.includes('!"' + name + '"'), `missing ${name}`));
  assert.ok(encodeURIComponent(q).length < 2000, 'query too long to be a URL');
});
