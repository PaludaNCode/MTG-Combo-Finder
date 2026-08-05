#!/usr/bin/env node
// Which cards changed wording, and which of those this repository actually cites.
//
//   node tools/sweep-impact.js old-card-text.json new-card-text.json
//
// A sweep of every card reports every change, and at 34,422 cards that is a firehose: most
// wording that moves belongs to a card nothing here has ever reasoned about. **The valuable
// subset is the cards `unofficial.js` and `research-log.js` name**, because a row citing
// "sacrifice a Food" and a card that stopped saying it is exactly the failure nothing in this
// repository would otherwise notice — the row keeps matching, the tests keep passing, and the
// reasoning underneath it is wrong.
//
// So this splits a sweep's diff in two. Cited changes want a person. Everything else is
// recorded and ignored.
//
// **It compares two committed revisions rather than reading the sweep's own report**, which
// is deliberate: `git show HEAD~1:card-text.json` against the working copy needs no artifact
// passed between jobs, works for any pair of commits after the fact, and cannot be wrong
// about what actually landed. A report written by the process being audited is the thing a
// reader has to take on trust.
'use strict';

const fs = require('node:fs');
const CardText = require('./card-text.js');

// Every card name this repository has committed reasoning about: the cards in each unofficial
// row, plus each research pass's subjects and the verbatim oracle text it pasted in. The
// `read` keys are the strongest signal in here — somebody looked that card up on purpose.
function citedNames(deps = {}) {
  const { COMBOS } = deps.unofficial || require('../unofficial.js');
  const { PASSES } = deps.researchLog || require('../research-log.js');
  const names = new Set();
  for (const row of COMBOS || []) for (const name of row.c || []) names.add(name);
  for (const pass of PASSES || []) {
    for (const name of pass.cards || []) names.add(name);
    for (const name of Object.keys(pass.read || {})) names.add(name);
  }
  return names;
}

// What moved between two versions of the cache.
//
// Matched by `oracleId` where both sides carry one, so a rename is a rename rather than a
// disappearance plus an arrival — the same rule `CardText.merge()` uses, and for the same
// reason: the citations name the OLD spelling.
function compare(before, after) {
  const oldCards = (before && before.cards) || {};
  const newCards = (after && after.cards) || {};

  const newByOracle = new Map();
  const newByKey = new Map();
  for (const [name, entry] of Object.entries(newCards)) {
    newByKey.set(CardText.key(name), name);
    if (entry && entry.oracleId) newByOracle.set(entry.oracleId, name);
  }

  const changed = [];
  const renamed = [];
  const gone = [];
  for (const [name, entry] of Object.entries(oldCards)) {
    let now = entry.oracleId ? newByOracle.get(entry.oracleId) : undefined;
    if (now === undefined) now = newByKey.get(CardText.key(name));
    if (now === undefined) { gone.push(name); continue; }
    if (CardText.key(now) !== CardText.key(name)) renamed.push({ from: name, to: now });
    if (!CardText.sameReading(entry, newCards[now])) changed.push({ name, now });
  }

  const oldKeys = new Set(Object.keys(oldCards).map(CardText.key));
  const oldOracles = new Set(Object.values(oldCards).map((e) => e && e.oracleId).filter(Boolean));
  const added = Object.entries(newCards)
    .filter(([name, e]) => !oldKeys.has(CardText.key(name))
      && !(e && e.oracleId && oldOracles.has(e.oracleId)))
    .map(([name]) => name);

  return { changed, renamed, gone, added };
}

// The split that decides whether anybody needs to be told.
function impact(before, after, deps = {}) {
  const diff = compare(before, after);
  const cited = deps.cited || citedNames(deps);
  // Keyed, not compared name-by-name, so a citation written with a curly apostrophe still
  // matches the card — and so this stays a lookup rather than spreading the set per candidate.
  const citedKeys = new Set([...cited].map(CardText.key));
  const isCited = (name) => citedKeys.has(CardText.key(name));

  const citedChanged = diff.changed.filter((c) => isCited(c.name));
  const citedRenamed = diff.renamed.filter((r) => isCited(r.from));
  const citedGone = diff.gone.filter((n) => isCited(n));

  return {
    ...diff,
    citedChanged,
    citedRenamed,
    citedGone,
    // Renames and disappearances of cited cards are always worth a person. So is changed
    // wording on a cited card. Everything else is a number in a summary.
    needsAttention: citedChanged.length + citedRenamed.length + citedGone.length > 0,
  };
}

// The issue body, rewritten in full each time rather than appended to — the same shape
// update-data.yml's standing issue uses, so the issue is always current state rather than a
// log somebody has to read backwards.
function issueBody(result, meta = {}) {
  const lines = [];
  lines.push('A sweep of Scryfall found wording that moved on cards this repository cites.');
  lines.push('');
  lines.push('**Do not treat this list as the live answer** — it is a snapshot of one sweep.');
  lines.push('Re-derive it any time with:');
  lines.push('');
  lines.push('```bash');
  lines.push('node tools/sweep-impact.js <(git show HEAD~1:card-text.json) card-text.json');
  lines.push('```');
  lines.push('');
  if (meta.sha) lines.push(`Sweep: \`${meta.sha}\`${meta.snapshot ? ` against Scryfall's ${meta.snapshot}` : ''}.`);
  lines.push('');

  if (result.citedChanged.length) {
    lines.push(`## ${result.citedChanged.length} cited card(s) whose oracle text changed`);
    lines.push('');
    lines.push('Each one may sit under a row in `unofficial.js` or a rule-out in `research-log.js`.');
    lines.push('**Read the card, then read what cited it.**');
    lines.push('');
    for (const c of result.citedChanged) lines.push(`- \`${c.name}\``);
    lines.push('');
  }
  if (result.citedRenamed.length) {
    lines.push(`## ${result.citedRenamed.length} cited card(s) renamed`);
    lines.push('');
    lines.push('The card is fine; the citations are what point at the old spelling.');
    lines.push('');
    for (const r of result.citedRenamed) lines.push(`- \`${r.from}\` ⇒ \`${r.to}\``);
    lines.push('');
  }
  if (result.citedGone.length) {
    lines.push(`## ${result.citedGone.length} cited card(s) Scryfall stopped listing`);
    lines.push('');
    lines.push('Kept in the cache rather than deleted, so nothing lost its evidence. Worth understanding why.');
    lines.push('');
    for (const n of result.citedGone) lines.push(`- \`${n}\``);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('**Close this when the cards above have been read against what cites them.** Nothing closes');
  lines.push('it automatically: a later sweep finding no new change says nothing about whether that');
  lines.push('reading happened, and an issue closed on that basis is unfinished work marked done.');
  lines.push('');
  lines.push(`Sweep totals, for scale: ${result.changed.length} changed, ${result.renamed.length} renamed, `
    + `${result.added.length} added, ${result.gone.length} no longer listed — across every card, `
    + 'cited or not.');
  return lines.join('\n');
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function main(argv) {
  if (argv.length < 2) {
    console.error('Usage: node tools/sweep-impact.js <old card-text.json> <new card-text.json>');
    return 2;
  }
  const result = impact(readJson(argv[0]), readJson(argv[1]));
  // Machine-readable when asked, because the workflow reads it with jq and a workflow parsing
  // prose is how a run block ends up making a decision.
  const json = argv.indexOf('--json');
  if (json !== -1) {
    const out = {
      needsAttention: result.needsAttention,
      citedChanged: result.citedChanged.map((c) => c.name),
      citedRenamed: result.citedRenamed,
      citedGone: result.citedGone,
      totals: {
        changed: result.changed.length,
        renamed: result.renamed.length,
        added: result.added.length,
        gone: result.gone.length,
      },
    };
    const target = argv[json + 1];
    if (target && !target.startsWith('--')) fs.writeFileSync(target, JSON.stringify(out, null, 1) + '\n');
    else console.log(JSON.stringify(out, null, 1));
    return 0;
  }
  console.log(issueBody(result));
  return 0;
}

module.exports = { citedNames, compare, impact, issueBody, main };

if (require.main === module) process.exit(main(process.argv.slice(2)));
