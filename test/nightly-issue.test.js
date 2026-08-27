'use strict';
// The nightly's standing issue, which is the only channel it has that a person
// actually passes.
//
// Every branch below runs at 04:17 on the default branch and nowhere else, which is
// exactly why the decision was taken out of the workflow's `run:` block: exercising
// it there means merging to `main` and waiting until tomorrow, and getting it wrong
// costs another night. Two of these four states are indistinguishable from success
// if you write them carelessly — a run that published nothing, and a run whose check
// wrote no findings because it crashed — and both would have this job close the
// issue and report all-clear.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { decide, parseArgs, readReport, TITLE } = require('../tools/nightly-issue.js');

const clean = { snapshot: '2026-08-27T15:19:16.683Z', checked: 834, problems: [], news: [], graduated: [] };
const report = (over) => Object.assign({}, clean, over);

test('a night that published nothing is reported, not shrugged at', () => {
  // The site keeps serving the last good snapshot, which is why nothing else notices:
  // the page works, the data is just frozen. There are no findings to list on this
  // path, so the absence of a list must not be read as an absence of a problem.
  const out = decide({ published: false, fetchResult: 'failure', runUrl: 'http://run/1' });
  assert.strictEqual(out.action, 'open');
  assert.match(out.body, /did not publish a snapshot/);
  assert.match(out.body, /`fetch` job ended `failure`/);
  assert.match(out.body, /http:\/\/run\/1/);
});

test('a published snapshot whose check wrote no report is reported too', () => {
  // `|| true` in the workflow means a crash in verify-unofficial exits 0 and leaves no
  // file. Silence and an all-clear are the same shape on disk, so they are told apart
  // here — the alternative is this job closing the issue over a check that never ran.
  const out = decide({ published: true, report: null });
  assert.strictEqual(out.action, 'open');
  assert.match(out.body, /produced no report/);
  assert.doesNotMatch(out.body, /Graduated/, 'it must claim nothing about the rows either way');
});

test('a clean night closes the issue', () => {
  const out = decide({ published: true, report: report() });
  assert.strictEqual(out.action, 'close');
  assert.match(out.body, /834 rows checked/);
  assert.match(out.body, /Closing/);
});

// The three finding kinds, and the whole point is that they are not equal. Only the
// first failed the run; the other two are things the job cannot fail over and must
// still not lose, which is what the ten red nights of Aug 2026 got wrong in both
// directions at once.
test('broken evidence is drawn as the one that also failed the run', () => {
  const out = decide({ published: true, report: report({ problems: ['X: cites 1-2, which is not in the published data'] }) });
  assert.strictEqual(out.action, 'open');
  assert.match(out.body, /## Broken evidence — 1/);
  assert.match(out.body, /also failed the run/);
  assert.match(out.body, /- X: cites 1-2/);
});

test('a moved claim is drawn as something that deliberately did not fail the run', () => {
  const out = decide({ published: true, report: report({ news: ['Hammerhead: records no card id'] }) });
  assert.strictEqual(out.action, 'open');
  assert.match(out.body, /## The published data moved under a claim of ours — 1/);
  assert.match(out.body, /does not fail the run/);
});

test('graduated rows are drawn as the outcome a row is for', () => {
  const out = decide({ published: true, report: report({ graduated: ['A + B', 'C + D'] }) });
  assert.strictEqual(out.action, 'open');
  assert.match(out.body, /## Graduated — Spellbook now publishes these — 2/);
});

test('a heading with nothing under it is never drawn', () => {
  // An issue listing three empty sections reads as three problems at a glance, and
  // the glance is all a standing issue ever gets.
  const out = decide({ published: true, report: report({ graduated: ['A + B'] }) });
  assert.doesNotMatch(out.body, /Broken evidence/);
  assert.doesNotMatch(out.body, /moved under a claim/);
});

test('every body says it is machine-written, and names the live answer', () => {
  // CLAUDE.md's rule is that an issue points at where the live answer lives rather
  // than restating it, because a hand-copied list rots the moment somebody acts on
  // it. A regenerated one cannot — provided the reader can tell which kind it is.
  for (const state of [
    { published: false },
    { published: true, report: null },
    { published: true, report: report({ graduated: ['A + B'] }) },
  ]) {
    assert.match(decide(state).body, /rewritten by the nightly data job/);
    assert.match(decide(state).body, /Finish condition:/);
  }
  assert.match(decide({ published: true, report: report({ graduated: ['A + B'] }) }).body,
    /npm run verify:unofficial/);
});

test('the title is one constant, because the issue is found by exact title', () => {
  // `gh issue list --json title` matched exactly is what keeps this to one standing
  // issue rather than one a night. A title that varied with the findings would open a
  // new issue every time the list changed.
  const titles = new Set([
    decide({ published: false }).title,
    decide({ published: true, report: report() }).title,
    decide({ published: true, report: report({ news: ['n'] }) }).title,
  ]);
  assert.deepStrictEqual([...titles], [TITLE]);
});

test('args: the flags are read in any order and a missing one has a default', () => {
  assert.deepStrictEqual(parseArgs(['--run', 'u', '--body', 'b.md', '--published', 'true']),
    { body: 'b.md', report: null, published: true, fetchResult: '', runUrl: 'u' });
});

test('args: only the exact word "true" counts as published', () => {
  // It arrives from a workflow expression, where an unset job output is the empty
  // string — and `Boolean('false')` is true, which would report a failed night as a
  // successful one.
  assert.strictEqual(parseArgs(['--published', 'false']).published, false);
  assert.strictEqual(parseArgs(['--published', '']).published, false);
  assert.strictEqual(parseArgs([]).published, false);
});

test('a report file that is missing or malformed reads as absent, not as a crash', () => {
  // Dying here would take the night's reporting with it — the same class of loss the
  // job's own `|| true` exists to prevent.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nightly-issue-'));
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, '{ not json');
  assert.strictEqual(readReport(bad), null);
  assert.strictEqual(readReport(path.join(dir, 'absent.json')), null);
  assert.strictEqual(readReport(null), null);
  fs.rmSync(dir, { recursive: true, force: true });
});
