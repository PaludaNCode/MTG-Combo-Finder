#!/usr/bin/env node
// Which of an unofficial row's result chips only the card it swapped away could produce.
//
//   node tools/produces-audit.js            # every row, exit 1 if anything is claimed
//   node tools/produces-audit.js --verbose  # and the reasoning per hit
//
// Why this exists. A row in unofficial.js takes a published combo, changes one card and
// keeps the published combo's result list. That list is a *claim*, and nothing checked it
// against the card that arrived: on 2026-08-10 an audit found **74 chips across 73 rows**
// that the swapped-in card cannot produce — 51 rows still promising Viscera Seer's
// "Infinite scry 1" after swapping her out for Carrion Feeder, and 22 still promising
// Carrion Feeder's "+1/+1 counters" after swapping him out for her. The Quina row shipped
// "Infinite creature tokens" for months while its own `why` explained that the Frog count
// never moves. Every one of them rendered as a perfectly ordinary chip.
//
// The rule, and it is deliberately narrow: flag a result whose effect appears in the
// swapped-OUT card's oracle text, does NOT appear in the swapped-IN card's, and appears
// in no other card on the row. All three halves are needed —
//
//   - without the first, every generic result ("Infinite ETB") is a hit
//   - without the second, a swap between two cards that both scry is a hit
//   - without the third, a result another card on the row supplies is a hit. This is the
//     half that saved four Ulasht -> Ghave rows: Ghave cannot deal damage and Ulasht can,
//     but Slimefoot, the Stowaway is on those rows and deals the damage.
//
// **It is a narrowing and never a verdict.** It reads oracle text with regexes, so it is
// blind in both directions: a result produced by a *token* a card creates is invisible to
// it (Academy Manufactor's Clue draws cards, and the word "draw" is nowhere in its text),
// and a card whose wording merely mentions an effect it cannot repeat will look like a
// source. So a hit is a row to open, and the fix is a reading, never a regex tweak to make
// it quiet.
//
// **Measured against the file it was written for: 72 of the 74.** Run over `unofficial.js`
// as it stood before the audit, it flags 51 of the 52 scry chips and 21 of the 22 counter
// chips. The two it cannot see are the same shape, and they are the blind spot above rather
// than a bug to fix:
//
//   Weatherlight Compleated is on one of the scry rows and its text says "scry 1" — but
//   only below seven phyresis counters, after which it draws instead, so it cannot be an
//   *infinite* scry source. Wording says yes, arithmetic says no.
//   Haunted One is on one of the counter rows and grants undying, whose reminder text
//   names a +1/+1 counter — but that counter annihilates against the persist counter the
//   same loop applies, so nothing accumulates.
//
// Both were caught by reading, and neither could have been caught by a regex over text.
// That ratio is the honest claim for this check: it finds the family, a person finishes it.
//
// The effect vocabulary is the concrete half of Spellbook's result names only. The generic
// trigger counts — ETB, LTB, death triggers, sacrifice triggers, storm count — follow from
// the loop rather than from one card's text, and are out of scope on purpose: including
// them produced nothing but noise.
'use strict';

const path = require('node:path');
const CARDS = require(path.join(__dirname, '..', 'card-text.json')).cards;
const { COMBOS } = require(path.join(__dirname, '..', 'unofficial.js'));

// A result name → the wording that would let a card produce it. Ordered longest label
// first at match time so "Infinite scry 1" is not read as some shorter label's.
//
// The token entries match the bare word rather than "Food token", because Spellbook and
// Wizards both write the enumerated form: Academy Manufactor says "a Clue, Food, or
// Treasure token", where "Food token" as two adjacent words never appears. That was two
// false hits before it was fixed, and both were about the same card.
const EFFECTS = [
  ['scry', /scry/i],
  ['surveil', /surveil/i],
  ['investigate', /investigate/i],
  ['connive', /connives?/i],
  ['+1/+1 counters', /\+1\/\+1 counter/i],
  ['-1/-1 counters', /-1\/-1 counter/i],
  ['energy', /\{E\}/i],
  ['mill', /\bmill\b/i],
  ['indestructible', /indestructible/i],
  ['turns', /extra turn/i],
  ['Blood tokens', /\bBlood\b/i],
  ['Food tokens', /\bFood\b/i],
  ['Clue tokens', /\bClue\b|investigate/i],
  ['Treasure tokens', /\bTreasure\b/i],
];

const byName = new Map();
for (const key of Object.keys(CARDS)) byName.set(CARDS[key].name.toLowerCase(), CARDS[key]);

// Every face's text, joined. A card absent from the cache answers null rather than '' —
// "no text" and "text with no scry in it" are opposite answers, and the second is the one
// that would silently clear a row.
function oracleOf(name) {
  const card = byName.get(String(name).toLowerCase());
  if (!card) return null;
  return (card.faces || []).map((face) => face.oracle || '').join('\n');
}

const effectFor = (result) => EFFECTS.slice()
  .sort((a, b) => b[0].length - a[0].length)
  .find(([label]) => result.toLowerCase().includes(label.toLowerCase())) || null;

// Rows whose result list promises something only the swapped-away card could do.
// `unread` names cards the text cache could not answer for, per row: a pass that cannot
// read a card cannot clear it either, so those are reported rather than skipped quietly.
function audit(rows) {
  const hits = [];
  const unread = new Set();
  for (const row of rows || COMBOS) {
    const swaps = (row.swaps || [row.swap]).filter(Boolean);
    for (const name of row.cards) if (oracleOf(name) === null) unread.add(name);
    for (const result of row.produces || []) {
      const effect = effectFor(result);
      if (!effect) continue;
      const [label, re] = effect;
      for (const swap of swaps) {
        const gone = oracleOf(swap.out);
        const arrived = oracleOf(swap.in);
        if (gone === null || arrived === null) {
          unread.add(gone === null ? swap.out : swap.in);
          continue;
        }
        if (!re.test(gone) || re.test(arrived)) continue;
        // Anything else on the row that could supply it. The swapped-in card is excluded
        // because it has already been asked and answered no.
        const elsewhere = row.cards.filter((n) => n !== swap.in && re.test(oracleOf(n) || ''));
        if (elsewhere.length) continue;
        hits.push({
          cards: row.cards.slice(),
          result,
          effect: label,
          out: swap.out,
          in: swap.in,
          citing: row.from && row.from.id,
        });
      }
    }
  }
  return { hits, unread: [...unread] };
}

function report({ hits, unread }, verbose) {
  const lines = [];
  if (unread.length) {
    lines.push(`${unread.length} card(s) are not in card-text.json, so no row naming them was cleared:`);
    for (const name of unread) lines.push(`  ${name}`);
    lines.push('Re-sweep with the "Cache card text" workflow before trusting a clean run.');
  }
  if (!hits.length) {
    lines.push(`No row promises a result only the card it swapped away could produce (${COMBOS.length} rows).`);
    return lines.join('\n');
  }
  lines.push(`${hits.length} result chip(s) name something the swapped-in card cannot do:`);
  for (const hit of hits) {
    lines.push(`  «${hit.result}»  on  ${hit.cards.join(' + ')}`);
    lines.push(`      ${hit.in} replaced ${hit.out}, and ${hit.effect} is ${hit.out}'s`
      + `${hit.citing ? ' — cited combo ' + hit.citing : ''}`);
    if (verbose) {
      lines.push(`      ${hit.out}: ${(oracleOf(hit.out) || '').replace(/\n/g, ' / ')}`);
      lines.push(`      ${hit.in}: ${(oracleOf(hit.in) || '').replace(/\n/g, ' / ')}`);
    }
  }
  lines.push('');
  lines.push('Open each one. The fix is to drop the chip, or to record why it holds —');
  lines.push('never to widen a regex until the run goes quiet.');
  return lines.join('\n');
}

module.exports = { audit, report, oracleOf, effectFor, EFFECTS };

if (require.main === module) {
  const result = audit();
  console.log(report(result, process.argv.includes('--verbose')));
  process.exitCode = result.hits.length ? 1 : 0;
}
