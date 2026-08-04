'use strict';
// Where the Cache card text workflow commits, both paths, without dispatching anything.
//
// This test exists because of what it costs to check the other way. The step it covers used
// to REFUSE when dispatched from the default branch, which is the branch the Actions UI
// offers first — so the natural dispatch failed, the reason sat in a log, and it read as a
// broken workflow for two hours. Proving the fix by running it would mean merging the
// workflow to `main` first, since a dispatch uses the file from the ref it is given: a merge
// per attempt. Here it is a millisecond, and `checks` runs it on every PR from now on.
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { targetBranch } = require('../tools/cache-target-branch.js');

const CLI = path.join(__dirname, '..', 'tools', 'cache-target-branch.js');

// The ordinary case: somebody on a research branch caching the cards it is about.
test('a feature branch commits to itself', () => {
  const out = targetBranch({
    GITHUB_REF_NAME: 'claude/some-research-pass',
    DEFAULT_BRANCH: 'main',
    GITHUB_RUN_NUMBER: '41',
  });
  assert.deepStrictEqual(out, { branch: 'claude/some-research-pass', redirected: false });
});

// The case that used to fail. `main` refuses direct pushes, so the commit goes to a branch
// named for the run — and `redirected` is what the workflow keys its summary on, because a
// commit on a branch nobody is told about is the same as no commit.
test('the default branch is redirected to a branch named for the run', () => {
  const out = targetBranch({
    GITHUB_REF_NAME: 'main',
    DEFAULT_BRANCH: 'main',
    GITHUB_RUN_NUMBER: '77',
  });
  assert.deepStrictEqual(out, { branch: 'card-text/run-77', redirected: true });
});

// Two dispatches on the same day must not collide, which is the only reason the run number
// is in the name at all.
test('two runs from the default branch get different branches', () => {
  const a = targetBranch({ GITHUB_REF_NAME: 'main', DEFAULT_BRANCH: 'main', GITHUB_RUN_NUMBER: '1' });
  const b = targetBranch({ GITHUB_REF_NAME: 'main', DEFAULT_BRANCH: 'main', GITHUB_RUN_NUMBER: '2' });
  assert.notStrictEqual(a.branch, b.branch);
});

// The default branch is read from the repository rather than assumed to be "main": this
// repo's is, and a rule that hardcodes it silently stops applying to a fork whose is not.
test('the default branch is whatever the repository says it is', () => {
  assert.strictEqual(
    targetBranch({ GITHUB_REF_NAME: 'trunk', DEFAULT_BRANCH: 'trunk', GITHUB_RUN_NUMBER: '5' }).redirected,
    true
  );
  assert.strictEqual(
    targetBranch({ GITHUB_REF_NAME: 'main', DEFAULT_BRANCH: 'trunk', GITHUB_RUN_NUMBER: '5' }).redirected,
    false,
    'main is not special — being the default branch is'
  );
});

// Both refusals are deliberate. A missing ref or run number means this is not running where
// it was designed to, and the alternative to throwing is pushing a commit to a guessed
// branch name — which is the failure mode this whole file is about, one layer down.
test('a missing ref refuses rather than guessing', () => {
  assert.throws(() => targetBranch({ DEFAULT_BRANCH: 'main', GITHUB_RUN_NUMBER: '3' }),
    /GITHUB_REF_NAME is empty/);
  assert.throws(() => targetBranch({}), /GITHUB_REF_NAME is empty/);
});

test('a missing run number refuses rather than naming a branch card-text/run-', () => {
  assert.throws(() => targetBranch({ GITHUB_REF_NAME: 'main', DEFAULT_BRANCH: 'main' }),
    /GITHUB_RUN_NUMBER is empty/);
});

// No DEFAULT_BRANCH at all is treated as "not the default branch" rather than as an error:
// the workflow always passes it, and the safe reading of not knowing is to commit where you
// stand instead of inventing a branch.
test('not knowing the default branch commits where it stands', () => {
  assert.deepStrictEqual(
    targetBranch({ GITHUB_REF_NAME: 'some-branch', GITHUB_RUN_NUMBER: '9' }),
    { branch: 'some-branch', redirected: false }
  );
});

// And the workflow calls the CLI, not the function, so the CLI is what has to print a bare
// branch name on stdout — a stray newline or a log line here would end up in a git refspec.
test('the CLI prints the branch and nothing else', () => {
  const out = execFileSync(process.execPath, [CLI], {
    encoding: 'utf8',
    env: { GITHUB_REF_NAME: 'main', DEFAULT_BRANCH: 'main', GITHUB_RUN_NUMBER: '12' },
  });
  assert.strictEqual(out, 'card-text/run-12\n');
});

test('the CLI exits non-zero when it cannot decide', () => {
  assert.throws(() => execFileSync(process.execPath, [CLI], { encoding: 'utf8', env: {} }));
});
