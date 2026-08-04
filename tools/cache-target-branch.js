#!/usr/bin/env node
// Which branch the Cache card text workflow commits to.
//
// Four lines of shell would do it, and shell inside a `run:` block is the one kind of code
// in this repository that nothing can test: to exercise it you dispatch the workflow, and to
// exercise the branch that only fires on the default branch you first have to merge the
// workflow to the default branch. That is a round trip per attempt, and it is why the
// refusal this replaces went unexamined for as long as it did.
//
// So the decision lives here, where `node --test` reaches both paths in milliseconds, and
// the workflow keeps only the parts that cannot be wrong quietly — the push and the summary.
//
//   node tools/cache-target-branch.js          # prints the branch name
//
// Reads the environment GitHub Actions already sets, so the workflow passes nothing.
'use strict';

// `main` refuses direct pushes, so a run dispatched from it cannot commit where it stands.
// It branches rather than refusing: the caller's mistake is picking the branch the Actions
// UI offers first, and answering that with a red X buried in a log is a workflow that looks
// broken. Named for the run so two dispatches never collide.
//
// Anything else commits to itself, which is the ordinary case: somebody on a research branch
// caching the cards that branch is about.
function targetBranch(env) {
  const refName = String((env && env.GITHUB_REF_NAME) || '').trim();
  const fallback = String((env && env.DEFAULT_BRANCH) || '').trim();
  const run = String((env && env.GITHUB_RUN_NUMBER) || '').trim();

  // No ref at all is not a case to paper over with a default: it means this ran somewhere
  // it was not designed for, and inventing a branch name would push a commit to a guess.
  if (!refName) throw new Error('GITHUB_REF_NAME is empty — refusing to guess a branch');

  if (!fallback || refName !== fallback) return { branch: refName, redirected: false };

  // The run number is what keeps two dispatches on the same day apart. Missing, the run id
  // would do, and if neither is set this is not Actions and should say so rather than
  // committing to card-text/run-.
  if (!run) throw new Error('GITHUB_RUN_NUMBER is empty — cannot name a branch for this run');
  return { branch: 'card-text/run-' + run, redirected: true };
}

if (require.main === module) {
  try {
    process.stdout.write(targetBranch(process.env).branch + '\n');
  } catch (err) {
    process.stderr.write(err.message + '\n');
    process.exit(1);
  }
}

module.exports = { targetBranch };
