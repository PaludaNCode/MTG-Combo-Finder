#!/usr/bin/env node
// Compare a freshly fetched combos.json against the one currently published, and
// refuse the publish if it looks like a bad day upstream.
//
// Why this exists: the `data` branch is a single orphan commit, force-pushed. There
// is no history on it and nothing to roll back to — the previous snapshot is gone
// the moment a worse one lands. `tools/fetch-combos.js` has two guards of its own,
// refuse-to-write-zero-combos and refuse-under-1000-card-identities, and the second
// exists because that failure already happened once, silently. Neither compares
// today against yesterday, so a half-published upstream export, or a schema change
// that makes compact() drop most rows, produces a file that passes both and then
// overwrites the good one.
//
// Deliberately runs *before* publishing, unlike verify-unofficial.js which runs
// after. That one checks our own citations, and holding today's combos back over a
// stale citation would be the wrong end of the stick. This one checks whether
// today's combos are worth publishing at all.
//
//   node tools/check-snapshot.js <new.json> [published.json] [--steps <dir>]
//
// With one argument it fetches the published copy from the data branch. With two it
// compares two files, which is how it is tested and how it can be run by hand.
// `--steps` additionally checks the tree of per-combo steps files published beside
// it; see checkSteps() below for what that can catch that nothing else can.
//
// It is not a substitute for the fetcher's guards and does not replace them: those
// catch a file that is wrong on its own terms, this catches a file that is only
// wrong next to the last one.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
// The same rebuild the page will run. Checking the published shape with a copy of
// the logic would let the two drift, and this gate exists precisely for the day
// the shape moves.
const { rebuildId } = require('../combos.js');
// And the same path the page will ask for. Same reasoning.
const StepsSource = require('../steps-source.js');

const PUBLISHED = 'https://raw.githubusercontent.com/PaludaNCode/MTG-Combo-Finder/data/combos.json';
const USER_AGENT = 'MTG-Combo-Finder (github.com/PaludaNCode/MTG-Combo-Finder)';

// How far a count may fall before this is somebody else's outage rather than a
// day's normal churn. Spellbook publishes combos continuously and occasionally
// retires a batch; 10% of 103,737 is ten thousand combos disappearing overnight,
// which has never happened and would not be routine if it did.
const MAX_DROP = 0.1;

// The counts worth comparing: each is a whole subsystem of the page, and each has
// its own way of going quietly empty. cardIdentity going missing disables colour
// filtering; gameChangers going missing silently downgrades every bracket check;
// templateCards going missing takes every template slot with it.
const COUNTS = [
  { key: 'combos', of: (d) => (Array.isArray(d.combos) ? d.combos.length : 0), what: 'combos' },
  { key: 'cardIdentity', of: (d) => Object.keys(d.cardIdentity || {}).length, what: 'card identities' },
  { key: 'gameChangers', of: (d) => (d.gameChangers || []).length, what: 'Game Changers' },
  { key: 'templateCards', of: (d) => Object.keys(d.templateCards || {}).length, what: 'template cards' },
  // The string tables. A table shrinking without the combo count shrinking means
  // rows are pointing somewhere new, which is a shape change wearing a normal
  // day's clothes.
  { key: 'names', of: (d) => (d.names || []).length, what: 'interned card names' },
  { key: 'results', of: (d) => (d.results || []).length, what: 'interned results' },
  // One Spellbook card id per distinct card. Rows drop their own id when it can be
  // rebuilt from these, so this table going missing takes every permalink with it.
  { key: 'cardIds', of: (d) => (d.cardIds || []).filter((v) => typeof v === 'number').length, what: 'derived card ids' },
];

// What the page reads off every row. Checked here rather than trusted, because an
// upstream field rename does not error — it produces rows the page renders as blank,
// and the first report of it is somebody looking at an empty combo.
//
// This runs on the file as published, so `c` and `p` hold indices into the two
// string tables rather than the strings themselves — DeckCombos.decode() resolves
// them on the reader's side. Both shapes are accepted, because a local combos.json
// from before the tables existed should still be checkable, and because the shape
// is exactly the thing under test: refusing to read one of them would mean the gate
// stops working on the day the payload changes, which is the day it matters most.
function checkShape(data) {
  const problems = [];
  const rows = Array.isArray(data.combos) ? data.combos : [];
  if (!rows.length) problems.push('no combos array');

  const names = Array.isArray(data.names) ? data.names : null;
  const results = Array.isArray(data.results) ? data.results : null;
  // An entry is usable if it is a non-empty string, or an index that lands on one.
  // A row full of integers pointing past the end of the table is the failure this
  // is really for: it parses, it passes a length check, and it renders as nothing.
  const usable = (value, table) => (
    typeof value === 'string'
      ? Boolean(value)
      : Number.isInteger(value) && Boolean(table && typeof table[value] === 'string' && table[value])
  );
  const allUsable = (list, table) => Array.isArray(list) && list.every((v) => usable(v, table));

  // Every row, not a sample. It is one pass over data already in memory, and a
  // sample answers "probably fine", which is not what a publish gate is for.
  // A row may legitimately carry no `id`: most do not, because theirs is rebuilt
  // from `cardIds`. What is never acceptable is a row with neither — that is a
  // combo whose "View on Commander Spellbook" link has nowhere to go, and it would
  // render as a missing link rather than as an error.
  const cardIds = Array.isArray(data.cardIds) ? data.cardIds : null;
  const hasId = (row) => {
    if (typeof row.id === 'string' && row.id) return true;
    if (!cardIds || !Array.isArray(row.c)) return false;
    return typeof rebuildId(row, cardIds) === 'string';
  };

  const missing = { id: 0, c: 0, i: 0, p: 0 };
  for (const row of rows) {
    if (!row || !hasId(row)) missing.id += 1;
    if (!Array.isArray(row && row.c) || !row.c.length || !allUsable(row.c, names)) missing.c += 1;
    if (typeof (row && row.i) !== 'string') missing.i += 1;
    if (!allUsable(row && row.p, results)) missing.p += 1;
  }
  for (const [field, n] of Object.entries(missing)) {
    if (n) problems.push(`${n} row(s) with no usable \`${field}\``);
  }

  // A table that has gone missing takes every row with it, so it is worth saying
  // once rather than 103,737 times.
  if (rows.some((r) => (r.c || []).some(Number.isInteger)) && !names) {
    problems.push('rows index a `names` table that is not in the payload');
  }
  if (rows.some((r) => (r.p || []).some(Number.isInteger)) && !results) {
    problems.push('rows index a `results` table that is not in the payload');
  }

  if (typeof data.updatedAt !== 'string' || !data.updatedAt) problems.push('no updatedAt');
  return problems;
}

// ---- the steps tree --------------------------------------------------------
//
// The steps have no index — steps-source.js turns a combo id straight into a URL,
// and a 404 means "none recorded". That is what makes them cheap to publish and it
// is also what makes them impossible to check by reading any one file: there is no
// manifest to disagree with, so a tree that is wrong is a tree that is silently
// missing answers. Nothing downstream would report it. A reader would press the
// button, be told there are no steps, and believe it.
//
// So this is the manifest, computed rather than published, and checked once a night:
//
//   * coverage — how many combos got a file at all. Today it is 100%, because
//     every combo Spellbook publishes has a description. A rename of that field
//     would take it to zero without erroring anywhere.
//   * every file readable, valid JSON, and stamped with an id.
//   * every file at the path StepsSource.pathFor() would ask for. A file in the
//     wrong bucket is a file no reader can ever reach.
//   * no orphans — a file for a combo that is not in today's snapshot means the
//     tree was not rebuilt from the same run, which is the one way these two
//     published things can drift apart.
//
// Every file, not a sample: it is 50 MB of reads inside a job that just streamed
// 512 MB, and a sample answers "probably", which is not what a publish gate is for.
const MIN_STEPS_COVERAGE = 0.9;

function checkSteps(dir, data, options) {
  const opts = options || {};
  const floor = typeof opts.minCoverage === 'number' ? opts.minCoverage : MIN_STEPS_COVERAGE;
  const lines = [];
  const failures = [];

  if (!fs.existsSync(dir)) {
    return { lines, failures: [`no steps tree at ${dir}`] };
  }

  // What the page will actually ask for: the id it holds after decode(), which is
  // the row's own id or the one rebuilt from the card-id table.
  const cardIds = Array.isArray(data.cardIds) ? data.cardIds : null;
  const expected = new Set();
  for (const row of data.combos || []) {
    const id = (typeof row.id === 'string' && row.id)
      || (cardIds && Array.isArray(row.c) ? rebuildId(row, cardIds) : null);
    if (id) expected.add(id);
  }

  const bad = { unreadable: [], misplaced: [], mismatched: [], orphan: [] };
  const note = (bucket, id) => { if (bucket.length < 5) bucket.push(id); };
  let files = 0;
  let bytes = 0;

  for (const bucket of fs.readdirSync(dir).sort()) {
    const bucketDir = path.join(dir, bucket);
    if (!fs.statSync(bucketDir).isDirectory()) continue;
    for (const name of fs.readdirSync(bucketDir)) {
      files += 1;
      const at = 'steps/' + bucket + '/' + name;
      const id = name.replace(/\.json$/, '');
      let record;
      try {
        const raw = fs.readFileSync(path.join(bucketDir, name), 'utf8');
        bytes += Buffer.byteLength(raw);
        record = JSON.parse(raw);
      } catch (err) {
        note(bad.unreadable, at);
        continue;
      }
      if (StepsSource.pathFor(id) !== at) note(bad.misplaced, at);
      // The reader refuses a record whose id disagrees with the URL, so this would
      // not show a reader the wrong combo — it would show them nothing, for ever.
      if (!record || String(record.id) !== id) note(bad.mismatched, at);
      if (!expected.has(id)) note(bad.orphan, at);
    }
  }

  const combos = (data.combos || []).length;
  const coverage = combos ? files / combos : 0;
  lines.push(`steps files: ${files.toLocaleString()} for ${combos.toLocaleString()} combos `
    + `(${(coverage * 100).toFixed(1)}%, ${(bytes / 1024 / 1024).toFixed(2)} MB)`);

  if (combos && coverage < floor) {
    failures.push(`only ${(coverage * 100).toFixed(1)}% of combos have steps, under the `
      + `${(floor * 100).toFixed(0)}% floor — check whether Spellbook renamed \`description\``);
  }
  const report = (list, what) => {
    if (list.length) failures.push(`${list.length}+ steps file(s) ${what}: ${list.join(', ')}`);
  };
  report(bad.unreadable, 'could not be read as JSON');
  report(bad.misplaced, 'are in a bucket no reader will look in');
  report(bad.mismatched, 'carry an id that is not their filename');
  report(bad.orphan, 'are for combos not in this snapshot');

  return { lines, failures };
}

// next vs previous. Returns every line worth printing plus whether to stop, so the
// caller does the reporting and this stays a pure function of two payloads.
function compare(next, previous, options) {
  const opts = options || {};
  const maxDrop = typeof opts.maxDrop === 'number' ? opts.maxDrop : MAX_DROP;
  const lines = [];
  const failures = [];

  for (const { of, what } of COUNTS) {
    const now = of(next);
    // A first publish, or a field the previous snapshot did not have yet — a new
    // count appearing is not a regression, and comparing against zero would make
    // every addition look like an infinite improvement.
    if (!previous) {
      lines.push(`${what}: ${now.toLocaleString()} (nothing published yet to compare against)`);
      continue;
    }
    const before = of(previous);
    const delta = now - before;
    const drop = before ? -delta / before : 0;
    const pct = before ? ((delta / before) * 100).toFixed(1) : '—';
    const arrow = delta === 0 ? '=' : delta > 0 ? '+' : '';
    lines.push(`${what}: ${before.toLocaleString()} → ${now.toLocaleString()} (${arrow}${delta.toLocaleString()}, ${pct}%)`);
    if (drop > maxDrop) {
      failures.push(`${what} fell ${(drop * 100).toFixed(1)}%, past the ${(maxDrop * 100).toFixed(0)}% limit`);
    }
  }

  const shape = checkShape(next);
  for (const problem of shape) failures.push(problem);

  return { lines, failures };
}

async function fetchPublished(url) {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  // Nothing published yet is a legitimate state — the first run of this workflow on
  // a fresh repository, and the one run that must not be blocked by a comparison it
  // cannot make.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not read the published snapshot: HTTP ${res.status}`);
  return res.json();
}

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

async function main(argv) {
  const stepsAt = argv.indexOf('--steps');
  const stepsDir = stepsAt === -1 ? null : argv[stepsAt + 1];
  const [nextFile, previousFile] = stepsAt === -1 ? argv : argv.slice(0, stepsAt).concat(argv.slice(stepsAt + 2));
  if (!nextFile || (stepsAt !== -1 && !stepsDir)) {
    console.error('usage: node tools/check-snapshot.js <new.json> [published.json] [--steps <dir>]');
    return 1;
  }

  const next = read(nextFile);
  let previous;
  try {
    previous = previousFile ? read(previousFile) : await fetchPublished(PUBLISHED);
  } catch (err) {
    // Not being able to read the published copy is not evidence that the new one is
    // bad. Say so loudly and let the publish through: this gate exists to catch a
    // bad snapshot, not to make the refresh depend on a second network call.
    console.log(`Could not compare against the published snapshot (${err.message}).`);
    console.log('Publishing anyway — this check is a comparison, not a requirement.');
    return 0;
  }

  const { lines, failures } = compare(next, previous, {
    maxDrop: process.env.MAX_DROP ? Number(process.env.MAX_DROP) : undefined,
  });
  // The steps tree is published from the same run and checked in the same gate:
  // holding one back and letting the other through would put the two out of step,
  // which is the state neither of them can detect on its own.
  if (stepsDir) {
    const steps = checkSteps(stepsDir, next);
    lines.push(...steps.lines);
    failures.push(...steps.failures);
  }
  for (const line of lines) console.log(`  ${line}`);

  if (!failures.length) {
    console.log('\nSnapshot looks sane against the published one.');
    return 0;
  }

  console.log('');
  for (const failure of failures) console.log(`  REFUSING: ${failure}`);
  // The override is the point of naming it here. A real shrink — Spellbook retiring
  // a whole family of combos — is a thing that can happen, and the answer to it is a
  // human deciding to publish, not this file being edited in a hurry.
  if (process.env.ALLOW_SHRINK === 'true') {
    console.log('\nALLOW_SHRINK is set — publishing anyway.');
    return 0;
  }
  console.log('\nRe-run the workflow with "allow_shrink" if this drop is real.');
  return 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

module.exports = { compare, checkShape, checkSteps, COUNTS, MAX_DROP, MIN_STEPS_COVERAGE, main };
