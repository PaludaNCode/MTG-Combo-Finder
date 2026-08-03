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
//
// The same failure, one level down: **an anchor checks the instance it matched and
// nothing else.** This README introduces a figure in bold and then refers back to
// it — "**264 candidates have been read** … and which 183 is no longer a matter of
// reading the prose above" — and for a while that sentence disagreed with itself by
// 81 while this file reported success, correctly by its own rules: the anchor is
// `/\*\*([\d,]+) candidates have been\s+read/`, and the second number is simply not
// inside it. It arose the way it always will, from two branches both bumping the
// number and whoever resolved the conflict fixing the half the marker showed them.
//
// So a matched claim now also has to survive its own sentence. The general version
// of that check — "no other number nearby may disagree" — is unusable: a sentence
// legitimately carries 137 verified against 25 derived, and a table row carries 148
// templates before filtering against 134 after. What marks a *restatement* rather
// than a different figure is the grammar, not the distance: English refers back with
// "which N", "those N", "the same N", "all N". Scanning for those inside the
// anchor's own sentence catches the case above and nothing else in this README —
// measured, not assumed.
//
// The alternative was letting a claim declare a second anchor. That fixes the one
// sentence and leaves the next one to be noticed by a human, which is the state this
// check exists to get out of, so it is not what happens here.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const README = path.join(ROOT, 'README.md');

// How the README writes a number: 1,079 rather than 1079. Both spellings are
// accepted when matching so a claim can be re-anchored without fighting the regex,
// but the comparison itself is on the value.
const parse = (text) => Number(String(text).replace(/,/g, ''));

// How English restates a number it has already given. Deliberately a short list of
// back-referencing determiners rather than "any number nearby": the point is to
// catch a figure being *repeated*, and a sentence is free to carry other figures.
const RESTATED = /\b(?:which|those|these|the same|that same|all)\s+([\d,]+)\b/gi;

// Where the sentence around an index starts and ends. A sentence ends at .?!; , at a
// table cell wall, or at a blank line — but **not at a single newline**, because the
// README wraps mid-sentence and the drift this looks for hides across the wrap. That
// is not hypothetical: the anchor for the candidates claim already carries a `\s+`
// for exactly that reason, and the restatement it missed sat on the following line.
const isEdge = (text, i) => /[.?!;|]/.test(text[i])
  || (text[i] === '\n' && (text[i + 1] === '\n' || text[i - 1] === '\n'));

function sentenceAround(text, index) {
  let start = index;
  while (start > 0 && !isEdge(text, start - 1)) start -= 1;
  let end = index;
  while (end < text.length && !isEdge(text, end)) end += 1;
  return { start, text: text.slice(start, end) };
}

// Every restatement of a matched claim, other than the match itself.
function restatements(readme, match) {
  const sentence = sentenceAround(readme, match.index);
  const out = [];
  for (const back of sentence.text.matchAll(RESTATED)) {
    const at = sentence.start + back.index;
    // The anchor's own text often *is* a back-reference — "All 235 hand-written
    // rows" — and checking a claim against itself would report every claim twice.
    if (at >= match.index && at < match.index + match[0].length) continue;
    out.push({ said: back[1], phrase: back[0].trim() });
  }
  return out;
}

function claims() {
  const unofficial = require('../unofficial.js');
  const tiers = require('../result-tiers.js');
  const research = require('../research-log.js');
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
      what: 'candidates read across every recorded pass',
      is: research.totals().examined,
      // "**183 candidates have been read, out of thousands proposed**"
      //
      // The number the whole "nothing remains open" correction turns on, so it is
      // the last one that should be allowed to drift. It now comes from
      // research-log.js rather than from somebody adding up prose, which means a
      // pass that gets logged moves the README and a pass that does not, cannot.
      // \s+ because the sentence wraps mid-phrase in the README, which the first
      // version of this anchor did not survive — and said so, correctly.
      find: /\*\*([\d,]+) candidates have been\s+read/g,
      source: 'research-log.js PASSES',
    },
    {
      what: 'stand-in rules',
      is: unofficial.STAND_INS.length,
      // Spelled out rather than written as a digit, which is the honest way to
      // anchor it: the day there are two, "the one stand-in rule" is the sentence
      // that has to change, and this is what notices. It did — the day came, the
      // check failed on "one" against three, and the singular went with it. The
      // words stay spelled out and the plural is part of the match, so the sentence
      // cannot go back to reading "the three stand-in rule" unnoticed either.
      find: /and the (one|two|three|four|five|six) stand-in rules?/g,
      source: 'unofficial.js STAND_INS',
      spelled: { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 },
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
      // The sentence the match sits in has to agree with itself. A claim written as
      // a word ("the one stand-in rule") has no digits to restate, so it is skipped.
      if (claim.spelled) continue;
      for (const back of restatements(readme, match)) {
        if (parse(back.said) === claim.is) continue;
        problems.push(`${claim.what}: the same sentence restates it as "${back.phrase}", `
          + `and ${claim.source} has ${claim.is}. The anchor only checks the instance it `
          + `matched — fix the restatement too.`);
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

module.exports = { check, claims, parse, main, sentenceAround, restatements };
