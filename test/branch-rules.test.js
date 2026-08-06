'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { CLAIMS, checkClaims } = require('../tools/check-branch-rules.js');

// What can be tested here is the tool's judgement, not GitHub's answers: given a
// configuration, does it decide correctly whether this repository's documented
// branching rules actually hold? That judgement is the whole tool. The 5 Aug 2026
// failure it exists to catch was a *true-looking* configuration — PRs merging, CI
// green, no ruleset anywhere — so every case below is written as "make the docs
// false, and check the tool says so".
//
// The fixture is the real response, recorded. It is the one case that proves the
// tool parses the shape GitHub actually sends rather than the shape I imagined:
// re-record it with the curl in the tool's header if the API ever changes.

const FIXTURE = path.join(__dirname, 'fixtures', 'branch-rules.json');
const recorded = () => JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

const levelsFor = (o, claim) => checkClaims(o).findings
  .filter((f) => f.claim === claim).map((f) => f.level);

// Every claim, once, so a claim added without a case here is visible: the point of
// the tool is coverage of the documented rules, and an unexercised check is one
// nobody has seen work.
const MERGE_CLAIM = 'the only way to merge is a merge commit';
const RULESET_CLAIM = 'a ruleset applies to `main` at all';
const STRICT_CLAIM = 'branches must be up to date before merging (strict status checks)';

test('the recorded live configuration has nothing broken', () => {
  const got = checkClaims(recorded());
  assert.deepStrictEqual(got.broken, [], 'a BROKEN finding against the real repo needs acting on, not silencing');
  assert.strictEqual(got.total, CLAIMS.length);
});

test('the recorded configuration is fragile on merge methods and silent on bypass', () => {
  const got = checkClaims(recorded());
  // Both are deliberate: the merge-commit invariant is held by a repository
  // checkbox the ruleset does not back up, and bypass_actors is absent from an
  // unauthenticated response. Neither may be reported as a pass.
  assert.deepStrictEqual(got.fragile.map((f) => f.claim), [MERGE_CLAIM]);
  assert.deepStrictEqual(got.unknown.map((f) => f.claim), ['nothing can bypass the ruleset']);
});

test('bypass is never a pass, however the configuration looks', () => {
  // Not conditional on anything. An endpoint that cannot answer must not be able to
  // contribute to "N of N claims hold" — that is how prose earns authority it has
  // not got, which is the whole failure this tool was written for.
  for (const o of [recorded(), { mainRules: [], dataRules: [], repo: {} }]) {
    assert.deepStrictEqual(levelsFor(o, 'nothing can bypass the ruleset'), ['UNKNOWN']);
  }
});

test('no ruleset at all is BROKEN, and says so first', () => {
  const o = recorded();
  o.mainRules = [];
  const got = checkClaims(o);
  assert.strictEqual(got.broken[0].claim, RULESET_CLAIM);
  // The dependent claims report too — a PR requirement and a required check cannot
  // hold when nothing applies — but the fix is one thing, so the first line names it.
  assert.ok(got.broken.length >= 4, `expected the dependent claims too, got ${got.broken.length}`);
});

test('a squash merge enabled anywhere is BROKEN, not fragile', () => {
  const o = recorded();
  o.repo.allow_squash_merge = true;
  assert.deepStrictEqual(levelsFor(o, MERGE_CLAIM), ['BROKEN']);
  // Because `main`'s tip stops being a descendant of the PR head, which is what
  // CLAUDE.md, "The designated branch after its PR merges" rests on entirely.
  assert.match(checkClaims(o).broken[0].then, /force-push/);
});

test('pinning the ruleset to merge-only clears the fragility', () => {
  const o = recorded();
  const pr = o.mainRules.find((r) => r.type === 'pull_request');
  pr.parameters.allowed_merge_methods = ['merge'];
  assert.deepStrictEqual(levelsFor(o, MERGE_CLAIM), [], 'this is the recommended fix; it has to read as a pass');
});

test('a ruleset pinned to merge-only holds even if the repo checkbox comes back on', () => {
  // The reason the recommendation is worth making at all: GitHub offers the merge
  // buttons that BOTH sides allow, so a pinned ruleset survives somebody ticking
  // "Allow squash merging" in Settings. Without this case the tool could ignore the
  // ruleset entirely and every other test here would still pass — it did, and that
  // is how this test came to exist.
  const o = recorded();
  o.repo.allow_squash_merge = true;
  o.mainRules.find((r) => r.type === 'pull_request').parameters.allowed_merge_methods = ['merge'];
  assert.deepStrictEqual(levelsFor(o, MERGE_CLAIM), []);
});

test('a ruleset silent on merge methods is judged by the repo settings alone', () => {
  const o = recorded();
  const pr = o.mainRules.find((r) => r.type === 'pull_request');
  delete pr.parameters.allowed_merge_methods;
  assert.deepStrictEqual(levelsFor(o, MERGE_CLAIM), [], 'repo allows merge only, so the invariant holds');
  o.repo.allow_rebase_merge = true;
  assert.deepStrictEqual(levelsFor(o, MERGE_CLAIM), ['BROKEN']);
});

test('losing strict status checks is BROKEN and points at ci.yml', () => {
  const o = recorded();
  o.mainRules.find((r) => r.type === 'required_status_checks')
    .parameters.strict_required_status_checks_policy = false;
  const got = checkClaims(o).findings.find((f) => f.claim === STRICT_CLAIM);
  assert.strictEqual(got.level, 'BROKEN');
  // Because this is the setting that licenses CI not running on push to `main`.
  assert.match(got.then, /ci\.yml/);
});

test('`checks` dropping out of the required list is BROKEN', () => {
  const o = recorded();
  o.mainRules.find((r) => r.type === 'required_status_checks')
    .parameters.required_status_checks = [{ context: 'static' }, { context: 'browser' }];
  const got = checkClaims(o).broken.map((f) => f.claim);
  assert.ok(got.includes('`checks` is a required status check'));
  // The realistic way to break it: split the workflow, require the new names, and
  // never notice that the aggregator nobody requires is the one with if: always().
});

test('requiring an approval is BROKEN on a solo repo', () => {
  const o = recorded();
  o.mainRules.find((r) => r.type === 'pull_request')
    .parameters.required_approving_review_count = 1;
  assert.deepStrictEqual(levelsFor(o, 'required approvals is 0'), ['BROKEN']);
});

test('linear history is checked as an absence', () => {
  const o = recorded();
  assert.deepStrictEqual(levelsFor(o, 'linear history is NOT required'), []);
  o.mainRules.push({ type: 'required_linear_history' });
  assert.deepStrictEqual(levelsFor(o, 'linear history is NOT required'), ['BROKEN']);
});

test('dropping the force-push and deletion rules is BROKEN', () => {
  const o = recorded();
  o.mainRules = o.mainRules.filter((r) => r.type !== 'non_fast_forward' && r.type !== 'deletion');
  const got = checkClaims(o).broken.map((f) => f.claim);
  assert.ok(got.includes('force-pushes to `main` are blocked'));
  assert.ok(got.includes('deleting `main` is blocked'));
});

test('protecting `data` is BROKEN, because the nightly job force-pushes it', () => {
  const o = recorded();
  o.dataRules = [{ type: 'non_fast_forward' }];
  const got = checkClaims(o).findings.find((f) => f.claim.includes('`data` is not protected'));
  assert.strictEqual(got.level, 'BROKEN');
  // The symptom is silent: the page keeps serving the last snapshot that landed.
  assert.match(got.then, /update-data\.yml/);
  o.dataRules = [{ type: 'pull_request' }];
  assert.strictEqual(checkClaims(o).broken.length, 1);
});

test('turning branch auto-delete back on is BROKEN', () => {
  const o = recorded();
  o.repo.delete_branch_on_merge = true;
  const got = checkClaims(o).findings.find((f) => f.claim === 'merged branches are kept');
  assert.strictEqual(got.level, 'BROKEN');
  // .githooks/pre-push catches the resulting force-push; it is the fallback, and the
  // finding has to say which is which or somebody "fixes" it by trusting the hook.
  assert.match(got.then, /pre-push/);
});

test('losing auto-merge is BROKEN', () => {
  const o = recorded();
  o.repo.allow_auto_merge = false;
  assert.deepStrictEqual(levelsFor(o, 'auto-merge is available'), ['BROKEN']);
});

test('a missing observation is not read as a passing one', () => {
  // An empty object is what a failed fetch or a truncated fixture looks like. It must
  // not come back clean — "0 rules apply" and "I could not ask" are the same bytes
  // here, and the safe reading is the alarming one.
  const got = checkClaims({});
  assert.ok(got.broken.length > 0);
  assert.strictEqual(got.passed + got.findings.length, CLAIMS.length);
});

test('every claim names where it is documented', () => {
  // A finding whose `where` is stale sends somebody to a section that no longer says
  // it — the rot test/doc-pointers.test.js exists for, in a second place.
  for (const c of CLAIMS) {
    assert.match(c.where, /CLAUDE\.md|README|\.github\/workflows/, `${c.claim} names no source`);
    assert.strictEqual(typeof c.claim, 'string');
  }
});
