#!/usr/bin/env node
// Print one whole variant from Commander Spellbook's bulk export, exactly as they
// send it.
//
// Why this exists: `compact()` in fetch-combos.js keeps six fields and throws the
// rest away, so nothing in this repository has ever recorded what the rest *are*.
// combo-steps.js was written against field names read off their site and guessed
// at — `description`, `otherPrerequisites`, `manaNeeded`, `zoneLocations` — and a
// guessed field name does not fail loudly. It comes back `undefined` and the panel
// quietly shows nothing.
//
// It has to run in CI. Their API refuses browser requests from anywhere but their
// own origin, and the sandbox this was developed in cannot reach their hosts at
// all; a GitHub runner streams this same export every night, which is the one
// place in this project that can actually see the answer.
//
//   node tools/peek-variant.js [id]
//
// With an id, prints that variant. Without, prints the first one the export yields.
// Either way it stops reading as soon as it has what it came for — the export is
// over 500 MB and this is a diagnostic, not a download.
//
// Deliberately a tool rather than a test: it asks a live third party a question,
// and a check that fails when somebody else has an outage is a check that gets
// muted. Run it when the shape is in doubt, read the answer, write it down.
'use strict';

const { streamVariants, BULK_URL } = require('./fetch-combos.js');

// Long enough to see the shape, short enough to read in a step summary. Their
// `description` is the steps and can run to a paragraph per line.
const MAX = 4000;

async function main(argv) {
  const wanted = argv[0] ? String(argv[0]) : null;
  console.log(wanted
    ? `Looking for variant ${wanted} in ${BULK_URL}`
    : `Taking the first variant from ${BULK_URL}`);

  let found = null;
  let seen = 0;
  const done = new Error('__found__'); // the only way to stop the stream early

  try {
    await streamVariants(BULK_URL, (variant) => {
      seen += 1;
      const id = String(variant && (variant.id !== undefined ? variant.id : ''));
      if (wanted ? id === wanted : true) {
        found = variant;
        throw done;
      }
      // A miss on every row of a 100k-row export is a wrong id, not a slow day.
      if (seen % 25000 === 0) console.log(`  ${seen} variants read, still looking…`);
    });
  } catch (err) {
    if (err !== done) throw err;
  }

  if (!found) {
    console.log(`\nNo variant matched after ${seen} rows.`);
    return 1;
  }

  console.log(`\nFound after ${seen} row(s). Top-level keys:\n`);
  console.log('  ' + Object.keys(found).sort().join(', '));

  // The fields the steps panel needs, called out by name, because that is the
  // question this was written to answer.
  console.log('\nWhat combo-steps.js reads, and whether it is there:\n');
  for (const field of ['description', 'otherPrerequisites', 'notablePrerequisites', 'easyPrerequisites', 'manaNeeded']) {
    const value = found[field];
    const shown = value === undefined ? '— absent —'
      : JSON.stringify(String(value).slice(0, 120));
    console.log(`  ${field.padEnd(22)} ${shown}`);
  }

  const use = (found.uses || [])[0];
  console.log('\n  uses[0] keys           ' + (use ? Object.keys(use).sort().join(', ') : '— no uses —'));
  if (use) console.log('  uses[0]                ' + JSON.stringify(use).slice(0, 400));

  console.log('\nThe whole variant:\n');
  const whole = JSON.stringify(found, null, 2);
  console.log(whole.length > MAX ? whole.slice(0, MAX) + `\n… (${whole.length - MAX} more characters)` : whole);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

module.exports = { main };
