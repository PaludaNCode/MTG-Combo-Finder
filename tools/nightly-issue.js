#!/usr/bin/env node
// What the nightly data job should say in its standing issue, and whether there
// should be one at all.
//
// **A red cron run is not a notification.** That is the lesson this file exists to
// hold. The nightly failed on the same step for ten consecutive nights in Aug 2026
// and nobody found out until somebody asked why the pipelines were red — the only
// channels it had were an exit code, a step summary nobody opens, and a GitHub
// failure email that reads like every other GitHub email. The finding underneath was
// worth a minute's work.
//
// So the job keeps one issue, and the issue is the report: opened when the nightly
// wants a person, edited in place every night it still does, closed by the job
// itself the night it does not. CLAUDE.md's rule is that outstanding work is a
// GitHub issue and nothing else, and this is the nightly obeying it.
//
// The decision lives here rather than in the workflow's `run:` block because shell
// in a workflow is the one thing in this repository nothing can unit-test — and this
// decision has four branches, three of which only ever run at 04:17. Exercising them
// used to mean merging to the default branch and waiting for tomorrow.
// `tools/cache-target-branch.js` is the same move for the same reason.
//
//   node tools/nightly-issue.js --body body.md [--report r.json] [--published true]
//                               [--fetch success|failure] [--run <url>]
//
// Prints one word — `open` or `close` — and writes the text the workflow hands to
// `gh` into --body. Nothing here talks to GitHub: this says *what*, the shell does
// it, and the split is what makes the wording testable.
'use strict';

const fs = require('node:fs');

// One title, matched exactly by the workflow's `gh issue list`, which is what keeps
// this to a single standing issue instead of one a night. Changing it orphans any
// issue already open under the old one — there was none open when this was renamed
// from "Unofficial rows Spellbook now publishes", which is the only reason the
// rename was free.
const TITLE = 'The nightly data job has something for a person';

// Repeated at the top of every body it writes. The rule in CLAUDE.md is that an
// issue points at where the live answer lives rather than restating it, because a
// hand-copied count rots the moment somebody acts on it. A body a machine rewrites
// every night cannot rot — but only the machine may write it, and the next reader
// has no way to tell the two apart unless it says so.
const REWRITTEN = '**This body is rewritten by the nightly data job. Do not edit it by hand.**';

function parseArgs(argv) {
  const out = { body: null, report: null, published: false, fetchResult: '', runUrl: '' };
  const flags = {
    '--body': (v) => { out.body = v; },
    '--report': (v) => { out.report = v; },
    // Compared against the string rather than coerced: this arrives from a workflow
    // expression, where an unset job output is the empty string and `Boolean('false')`
    // is true. Only the exact word counts as published.
    '--published': (v) => { out.published = v === 'true'; },
    '--fetch': (v) => { out.fetchResult = v; },
    '--run': (v) => { out.runUrl = v; },
  };
  for (let i = 0; i < argv.length; i += 1) {
    const take = flags[argv[i]];
    if (take) { take(argv[i + 1]); i += 1; }
  }
  return out;
}

// A section is only drawn when it has entries, so an issue never shows an empty
// heading — but the heading always carries its count, because "Graduated" over four
// bullets tells a reader less than "Graduated (4)" does in the notification email.
function section(lines, heading, items, note) {
  if (!items || !items.length) return;
  lines.push(`## ${heading} — ${items.length}`, '');
  if (note) lines.push(note, '');
  items.forEach((i) => lines.push(`- ${i}`));
  lines.push('');
}

// The whole decision, as a pure function of what the run knows about itself. Every
// branch below is reachable from a unit test, which is the point of it being here.
function decide({ published = false, fetchResult = '', report = null, runUrl = '' } = {}) {
  // An empty line rather than an empty string, so a run with no URL does not leave a
  // blank paragraph where the link belongs.
  const link = runUrl ? [`Run: ${runUrl}`, ''] : [];

  // Nothing on the branch. This is the most serious of the three states and the one
  // with no findings to list: the site keeps serving whatever last night left, and
  // stays that way, silently, for as long as this goes unnoticed. It is reported
  // even for a single bad night — one issue that closes itself tomorrow morning is
  // a cheaper mistake than the alternative this file was written after.
  if (!published) {
    return {
      action: 'open',
      title: TITLE,
      body: [
        '**The nightly did not publish a snapshot.**'
          + (fetchResult ? ` The \`fetch\` job ended \`${fetchResult}\`.` : ''),
        '',
        'The `data` branch still holds whatever the last successful run left there, and',
        'the site is serving that. Nothing is broken for a reader today; every further',
        'night is a day of drift, and no other signal says so.',
        '',
        ...link,
        REWRITTEN,
        'Finish condition: the next nightly publishes. This job closes the issue itself.',
      ].join('\n'),
    };
  }

  // A published snapshot and no report is not "nothing to report". `verify-unofficial`
  // is run with `|| true`, so a crash in it — a shape change in the payload, a decode
  // that throws — leaves no file and exits 0, and reading that as all-clear would have
  // this job *close* the standing issue on the strength of a check that never ran.
  // Silence and an all-clear are the same shape, which is the failure this whole file
  // is a response to, so they are separated here.
  if (!report) {
    return {
      action: 'open',
      title: TITLE,
      body: [
        '**The snapshot published, but the check on it produced no report.**',
        '',
        '`tools/verify-unofficial.js` is run with `|| true` so that a broken citation',
        'cannot cost a night of reporting — which means a crash in it exits 0 and writes',
        'nothing at all. No claim is being made here about the rows either way: nobody',
        'checked them tonight.',
        '',
        ...link,
        REWRITTEN,
        'Finish condition: a nightly in which that command writes its JSON again.',
      ].join('\n'),
    };
  }

  const { problems = [], news = [], graduated = [], snapshot = 'unknown', checked = 0 } = report;
  if (!problems.length && !news.length && !graduated.length) {
    return {
      action: 'close',
      title: TITLE,
      body: [
        'Nothing here needs a person any more.',
        '',
        `Snapshot \`${snapshot}\`: ${checked} rows checked — every citation resolves, no`,
        'claim of ours has been overtaken, and nothing has graduated.',
        '',
        'Closing — the nightly opens a fresh one the night that changes.',
      ].join('\n'),
    };
  }

  const lines = [
    "The nightly published tonight's snapshot and found things a person has to decide.",
    '',
    REWRITTEN,
    'The live answer is `npm run verify:unofficial`, which prints these same lists',
    "against today's data.",
    '',
    'Finish condition: that command reports nothing under any heading below. This job',
    'closes the issue itself when that happens.',
  ];
  lines.push('', ...link, '---', '');

  // Ordered by what it costs to leave alone. A broken citation is on the page now;
  // a moved claim is a minute's work; a graduate is tidying.
  section(lines, 'Broken evidence', problems,
    'A row on the page cites something the published data does not have. '
    + '**This also failed the run** — it is the only one of the three that does.');
  section(lines, 'The published data moved under a claim of ours', news,
    'Not a defect anybody can see: no reader is shown a card id and every one of these'
    + ' rows still cites by name and still matches. It wants a judgement, which is why'
    + ' it does not fail the run.');
  section(lines, 'Graduated — Spellbook now publishes these', graduated,
    '**That is what a row is for.** `matchUnofficial()` already drops a graduated row at'
    + ' run time, so no reader sees a duplicate. They can come out of the file.');

  lines.push(`Snapshot \`${snapshot}\` — ${checked} rows checked.`);
  return { action: 'open', title: TITLE, body: lines.join('\n') };
}

// A report that is absent or unreadable is treated as no report rather than as a
// crash. The workflow runs `verify-unofficial` with `|| true` and the file is the
// only thing carrying the findings across — if reading it throws here, the job dies
// and takes the night's reporting with it, which is the failure this whole change
// exists to stop happening twice.
function readReport(path) {
  if (!path) return null;
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function main(argv) {
  const args = parseArgs(argv);
  const { action, body } = decide({
    published: args.published,
    fetchResult: args.fetchResult,
    report: readReport(args.report),
    runUrl: args.runUrl,
  });
  if (args.body) fs.writeFileSync(args.body, `${body}\n`);
  console.log(action);
}

module.exports = { decide, parseArgs, readReport, TITLE };

if (require.main === module) main(process.argv.slice(2));
