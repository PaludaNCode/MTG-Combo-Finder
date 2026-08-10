'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { audit, report, effectFor, oracleOf } = require('../tools/produces-audit.js');

// A row's result chips are a claim about the card that arrived, and until this file
// existed nothing checked one. The audit of 2026-08-10 found 74 chips across 73 rows that
// the swapped-in card cannot produce — Viscera Seer's "Infinite scry 1" still promised on
// 51 rows that had swapped her out for Carrion Feeder, and his "+1/+1 counters" on 22 that
// had swapped him out for her. They had rendered as ordinary chips for months, because a
// wrong result list looks exactly like a right one.
//
// No network: card-text.json holds every card, so this runs with the unit tests rather
// than beside the nightly citation check.

test('produces audit: no live row promises a result its swapped-in card cannot produce', () => {
  const { hits } = audit();
  assert.deepStrictEqual(hits.map((h) => h.cards.join(' + ') + ' :: ' + h.result), [],
    'open each row above; the fix is a reading, or a note saying why the chip holds');
});

// A pass that cannot read a card cannot clear it either. Every card named on a row has to
// be answerable from the cache, or a clean run is only clean about the cards it could see.
test('produces audit: every card on every row is in the text cache', () => {
  const { unread } = audit();
  assert.deepStrictEqual(unread, [], 'run the "Cache card text" sweep before trusting a pass');
});

// ---- the rule itself, on rows built to exercise one half each -----------------
//
// The live file is clean, so nothing above would notice the rule going silent. These do.

const row = (cards, produces, out, into) => ({
  cards, produces, confidence: 'verified', from: { id: '1-2' }, swap: { out, in: into },
});

test('produces audit: an effect only the swapped-away card has is a hit', () => {
  const { hits } = audit([
    row(['Carrion Feeder', 'Mazirek, Kraul Death Priest'], ['Infinite scry 1'], 'Viscera Seer', 'Carrion Feeder'),
  ]);
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].effect, 'scry');
  assert.strictEqual(hits[0].out, 'Viscera Seer');
  assert.match(report({ hits, unread: [] }), /Infinite scry 1/);
});

// Both cards scry, so the swap costs the reader nothing and there is nothing to say.
test('produces audit: an effect the swapped-in card also has is not a hit', () => {
  const { hits } = audit([
    row(['Viscera Seer', 'Mazirek, Kraul Death Priest'], ['Infinite scry 1'], 'Viscera Seer', 'Viscera Seer'),
  ]);
  assert.deepStrictEqual(hits, []);
});

// The half that saved four rows. Ghave, Guru of Spores cannot deal damage and Ulasht can —
// but Slimefoot, the Stowaway is on those rows and deals it, so the chip holds.
test('produces audit: an effect another card on the row supplies is not a hit', () => {
  const { hits } = audit([
    row(['Ghave, Guru of Spores', 'Slimefoot, the Stowaway'], ['Infinite damage'],
      'Ulasht, the Hate Seed', 'Ghave, Guru of Spores'),
  ]);
  assert.deepStrictEqual(hits, []);
});

// ---- what a card supplies that its own text never says ------------------------

// The blind spot that made the wider narrowing unreadable. Academy Manufactor's entire
// text is "If you would create a Clue, Food, or Treasure token, instead create one of
// each" — no "draw" anywhere — and yet its combos rightly claim infinite card draw,
// because a Clue is "{2}, Sacrifice this token: Draw a card". Reading only the creator's
// text called 39 rows liars.
test('produces audit: a card that makes Clues supplies their draw', () => {
  assert.match(oracleOf('Academy Manufactor'), /Draw a card/i);
  const { hits } = audit([
    row(['Academy Manufactor', 'Cauldron Familiar'], ['Infinite card draw'],
      'Peregrin Took', 'Academy Manufactor'),
  ]);
  assert.deepStrictEqual(hits, []);
});

test('produces audit: Food supplies lifegain and Treasure supplies mana', () => {
  assert.match(oracleOf('Peregrin Took'), /You gain 3 life/i, 'Food');
  assert.match(oracleOf('Warren Soultrader'), /Add one mana of any color/i, 'Treasure');
});

// One level deeper, and the same shape: a card that ventures supplies whatever the
// dungeon's rooms do, and the dungeon is a card no deck list names. 112 candidates on the
// Sefris of the Hidden Ways rows were exactly this.
test('produces audit: a venturer inherits the dungeons the cache can answer for', () => {
  const text = oracleOf('Sefris of the Hidden Ways');
  assert.match(text, /venture into the dungeon/i);
  assert.match(text, /Create a Treasure token/i, 'a room from Dungeon of the Mad Mage');
  assert.match(text, /Scry 2/i);
  // And the gap is stated rather than papered over: Undercity is the dungeon most of
  // those rows actually walk and it is not in card-text.json, so anything only it grants
  // is invisible here. If this ever starts passing, drop the DUNGEONS workaround.
  assert.strictEqual(oracleOf('Undercity'), null,
    'Undercity is in the cache now — read its rooms directly instead of inheriting two dungeons');
});

// Five wordings that each cost a false hit. Kept as a list because the next one will be
// a sixth card whose phrasing nobody predicted, and this is where it goes.
test('produces audit: the wordings that read as absent and are not', () => {
  assert.match(oracleOf('Altar of Dementia'), /mills cards/i);
  assert.ok(effectFor('Infinite mill')[1].test(oracleOf('Altar of Dementia')), '"mills", not "mill"');
  assert.ok(effectFor('Infinite colorless mana')[1].test(oracleOf('Mana Echoes')),
    '"add an amount of {C} equal to", not "add {C}"');
  assert.ok(effectFor('Infinite creature tokens')[1].test(oracleOf('Splinter Twin')),
    '"a token that\'s a copy", not "creature token"');
  assert.ok(effectFor('Infinite damage')[1].test(oracleOf('Warstorm Surge')),
    '"deals damage equal to its power" — no word between "deals" and "damage"');
  assert.ok(effectFor('Infinite blinking')[1].test(oracleOf('Living Death')),
    '"puts ... onto the battlefield", not "return"');
});

// A generic trigger count follows from the loop, not from one card's wording, so it is out
// of scope by design. In scope it produced nothing but noise.
test('produces audit: the generic trigger counts are out of scope', () => {
  assert.strictEqual(effectFor('Infinite ETB'), null);
  assert.strictEqual(effectFor('Infinite creature LTB'), null);
  assert.strictEqual(effectFor('Infinite death triggers'), null);
  assert.strictEqual(effectFor('Infinite storm count'), null);
  assert.ok(effectFor('Infinite scry 1'), 'a concrete effect is in scope');
});

// Spellbook and Wizards both write "a Clue, Food, or Treasure token", so "Food token" as
// two adjacent words never appears on Academy Manufactor — which made two of its rows
// false hits until the token patterns matched the bare word.
test('produces audit: a token named in an enumerated list still counts as a source', () => {
  const { hits } = audit([
    row(['Academy Manufactor', 'Warren Soultrader'], ['Infinite Food tokens'],
      'Peregrin Took', 'Academy Manufactor'),
  ]);
  assert.deepStrictEqual(hits, []);
});

// A card the cache cannot answer for is reported, never treated as a card with no such
// wording — those are opposite answers and the second silently clears the row.
test('produces audit: an unknown card is reported rather than cleared', () => {
  const { hits, unread } = audit([
    row(['Nonesuch, the Unprinted', 'Viscera Seer'], ['Infinite scry 1'], 'Carrion Feeder', 'Nonesuch, the Unprinted'),
  ]);
  assert.deepStrictEqual(hits, []);
  assert.deepStrictEqual(unread, ['Nonesuch, the Unprinted']);
  assert.match(report({ hits, unread }), /not in card-text\.json/);
});
