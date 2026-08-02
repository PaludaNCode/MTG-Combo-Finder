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
//   node tools/check-snapshot.js <new.json> [published.json]
//
// With one argument it fetches the published copy from the data branch. With two it
// compares two files, which is how it is tested and how it can be run by hand.
//
// It is not a substitute for the fetcher's guards and does not replace them: those
// catch a file that is wrong on its own terms, this catches a file that is only
// wrong next to the last one.
'use strict';

const fs = require('node:fs');

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
];

// What the page reads off every row. Checked here rather than trusted, because an
// upstream field rename does not error — it produces rows the page renders as blank,
// and the first report of it is somebody looking at an empty combo.
function checkShape(data) {
  const problems = [];
  const rows = Array.isArray(data.combos) ? data.combos : [];
  if (!rows.length) problems.push('no combos array');

  // Every row, not a sample. It is one pass over data already in memory, and a
  // sample answers "probably fine", which is not what a publish gate is for.
  const missing = { id: 0, c: 0, i: 0, p: 0 };
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id) missing.id += 1;
    if (!Array.isArray(row && row.c) || !row.c.length) missing.c += 1;
    if (typeof (row && row.i) !== 'string') missing.i += 1;
    if (!Array.isArray(row && row.p)) missing.p += 1;
  }
  for (const [field, n] of Object.entries(missing)) {
    if (n) problems.push(`${n} row(s) with no usable \`${field}\``);
  }

  if (typeof data.updatedAt !== 'string' || !data.updatedAt) problems.push('no updatedAt');
  return problems;
}

// next vs previous. Returns every line worth printing plus whether to stop, so the
// caller does the reporting and this stays a pure function of two payloads.
function compare(next, previous, options) {
  const opts = options || {};
  const maxDrop = typeof opts.maxDrop === 'number' ? opts.maxDrop : MAX_DROP;
  const lines = [];
  const failures = [];

  for (const { key, of, what } of COUNTS) {
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
  const [nextFile, previousFile] = argv;
  if (!nextFile) {
    console.error('usage: node tools/check-snapshot.js <new.json> [published.json]');
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

module.exports = { compare, checkShape, COUNTS, MAX_DROP, main };
