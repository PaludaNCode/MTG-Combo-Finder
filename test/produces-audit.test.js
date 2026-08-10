'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { audit, report, effectFor } = require('../tools/produces-audit.js');

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
