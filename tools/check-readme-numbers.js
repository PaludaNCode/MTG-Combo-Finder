#!/usr/bin/env node
// The README states real counts in prose, and those counts move when the files
// they describe do. This checks the ones that can be counted.
//
// Why bother: the README is the reference for this repository and it is kept
// current on purpose, so a number in it is read as a fact rather than as a
// decoration. "All 63 hand-written rows" stops being true the moment somebody adds
// a sixty-fourth, and nothing anywhere would have said so — CLAUDE.md has carried
// a note asking people to remember, which is not a mechanism.
//
// Only what this repository can count. Anything measured against the published
// database — 103,737 combos, 53 Game Changers, MB on the wire — is a snapshot of
// somebody else's data taken on a particular morning, and pinning those would mean
// a red build every time Spellbook published a combo. Those stay prose.
//
// The design point worth stating: **a pattern that matches nothing is a failure.**
// A checker that silently finds no claim to check reports success for work it did
// not do, which is worse than not having one — it converts "nobody verified this"
// into "this was verified". So every claim below asserts that its phrasing is still
// in the README, and rewording a sentence out from under a check fails loudly and
// tells you which claim to re-anchor.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const README = path.join(ROOT, 'README.md');

// How the README writes a number: 1,079 rather than 1079. Both spellings are
// accepted when matching so a claim can be re-anchored without fighting the regex,
// but the comparison itself is on the value.
const parse = (text) => Number(String(text).replace(/,/g, ''));

function claims() {
  const unofficial = require('../unofficial.js');
  const tiers = require('../result-tiers.js');
  const templates = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates.json'), 'utf8'));

  return [
    {
      what: 'results in the tier inventory',
      is: tiers.size,
      // "lists all 1,079 results Commander Spellbook publishes"
      find: /lists all ([\d,]+) results Commander Spellbook publishes/g,
      source: 'result-tiers.js',
    },
    {
      what: 'hand-written unofficial rows',
      is: unofficial.COMBOS.length,
      // "All 63 hand-written rows and the one stand-in rule are `verified`."
      find: /All ([\d,]+) hand-written rows/g,
      source: 'unofficial.js COMBOS',
    },
    {
      what: 'stand-in rules',
      is: unofficial.STAND_INS.length,
      // Spelled out rather than written as a digit, which is the honest way to
      // anchor it: the day there are two, "the one stand-in rule" is the sentence
      // that has to change, and this is what notices.
      find: /and the (one) stand-in rule/g,
      source: 'unofficial.js STAND_INS',
      spelled: { one: 1 },
    },
    {
      what: 'templates resolved in templates.json',
      is: Object.keys(templates.templates || {}).length,
      // "| Templates resolved | 148 | **134** (14 skipped) |"
      find: /Templates resolved \| [\d,]+ \| \*\*([\d,]+)\*\*/g,
      source: 'templates.json templates',
    },
    {
      what: 'templates skipped as unused',
      is: Object.keys(templates.skipped || {}).length,
      find: /\*\*[\d,]+\*\* \(([\d,]+) skipped\)/g,
      source: 'templates.json skipped',
    },
    {
      what: 'cards that fill at least one template',
      is: Object.keys(templates.cards || {}).length,
      // "| Cards in the file | 21,769 | **12,472** |"
      find: /Cards in the file \| [\d,]+ \| \*\*([\d,]+)\*\*/g,
      source: 'templates.json cards',
    },
    {
      what: 'templates with no Scryfall query',
      is: Object.keys(templates.unresolvable || {}).length,
      // "The 29 templates Spellbook gives no Scryfall query for" and its siblings.
      find: /([\d,]+) query-less templates are recorded/g,
      source: 'templates.json unresolvable',
    },
  ];
}

function check(readme, list) {
  const problems = [];
  for (const claim of list) {
    const found = [...readme.matchAll(claim.find)];
    if (!found.length) {
      // The important half. A claim whose phrasing has been edited away is not a
      // claim that passed — it is one nobody is checking any more.
      problems.push(`${claim.what}: the README no longer contains the phrasing this `
        + `check anchors on (${claim.find.source}). Re-anchor it or drop the claim.`);
      continue;
    }
    for (const match of found) {
      const said = claim.spelled ? claim.spelled[match[1]] : parse(match[1]);
      if (said !== claim.is) {
        problems.push(`${claim.what}: the README says ${match[1]}, ${claim.source} has ${claim.is}`);
      }
    }
  }
  return problems;
}

function main() {
  const readme = fs.readFileSync(README, 'utf8');
  const list = claims();
  const problems = check(readme, list);

  for (const claim of list) {
    console.log(`  ${String(claim.is).padStart(6)}  ${claim.what} (${claim.source})`);
  }

  if (!problems.length) {
    console.log(`\nAll ${list.length} countable claims in the README still hold.`);
    return 0;
  }
  console.log('');
  for (const problem of problems) console.log(`  ${problem}`);
  console.log('\nThe README states real measurements. Update the prose, or the file it describes.');
  return 1;
}

if (require.main === module) process.exit(main());

module.exports = { check, claims, parse, main };
