'use strict';
// The Playwright version is pinned in two files and they have to agree.
//
// package.json's `test:ui` fetches `@playwright/test@X`; ci.yml's PLAYWRIGHT_VERSION
// fetches `playwright@Y` for the browser AND names the version in the cache key. The
// cache key is what makes a mismatch worth a test: a key naming Y restores the build Y
// wants, then X launches and cannot find the build IT wants. That surfaces as
// "Executable doesn't exist at …/ms-playwright/…" and reads as a broken cache rather
// than as two numbers that stopped matching — and the natural fix for a broken cache is
// to bump the key, which does nothing at all here.
//
// There is no way to single-source it: a workflow cannot read package.json to build a
// step's `run` string before the checkout, and the npx pin has to be a literal.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const ci = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
const warm = fs.readFileSync(path.join(root, '.github', 'workflows', 'warm-cache.yml'), 'utf8');

// Both anchored on the surrounding syntax rather than a bare version number: a regex
// loose enough to match "1.56.1" anywhere would also match the axe-core pin, or a
// version inside a comment, and then agree with itself about nothing.
function playwrightPinInPackage(scripts = pkg.scripts) {
  const m = /@playwright\/test@(\d+\.\d+\.\d+)/.exec(scripts['test:ui'] || '');
  return m && m[1];
}

function playwrightPinInWorkflow(yaml = ci) {
  const m = /^\s*PLAYWRIGHT_VERSION:\s*(\d+\.\d+\.\d+)\s*$/m.exec(yaml);
  return m && m[1];
}

test('both files pin a Playwright version at all', () => {
  // Checked separately from the comparison below, because two nulls are equal and
  // that is exactly how this test would pass while measuring nothing — the failure
  // mode every check in this repository is written to avoid.
  assert.match(String(playwrightPinInPackage()), /^\d+\.\d+\.\d+$/,
    'package.json test:ui should fetch a pinned @playwright/test');
  assert.match(String(playwrightPinInWorkflow()), /^\d+\.\d+\.\d+$/,
    'ci.yml should set PLAYWRIGHT_VERSION to a pinned version');
});

test('the version that downloads the browser is the version that runs the suite', () => {
  assert.strictEqual(playwrightPinInWorkflow(), playwrightPinInPackage(),
    'ci.yml PLAYWRIGHT_VERSION and package.json test:ui must name the same version');
});

test('the workflow builds its install command and cache key from that one pin', () => {
  // The point of the env var is that the number appears once. If a later edit
  // hard-codes a version back into either place, the test above stops covering it.
  assert.match(ci, /playwright@\$\{\{ env\.PLAYWRIGHT_VERSION \}\}/,
    'the install steps should fetch playwright@${{ env.PLAYWRIGHT_VERSION }}');
  assert.match(ci, /key: playwright-\$\{\{ runner\.os \}\}-\$\{\{ env\.PLAYWRIGHT_VERSION \}\}-chromium/,
    'the cache key should name the version through env.PLAYWRIGHT_VERSION');
  const literal = playwrightPinInPackage();
  const stray = ci.split('\n').filter((l) => l.includes(literal) && !/PLAYWRIGHT_VERSION:/.test(l));
  assert.deepStrictEqual(stray, [], `ci.yml should name ${literal} only on the PLAYWRIGHT_VERSION line`);
});

// The gate the `main` ruleset requires, checked here because getting it wrong is
// invisible: a required check that stops reporting does not block anything, and a
// `needs:` job with no `if: always()` is SKIPPED rather than failed when a dependency
// fails — which GitHub reports as neutral, not as a failure.
test('the checks gate runs even when a job it needs has failed', () => {
  const gate = ci.slice(ci.indexOf('\n  checks:'));
  assert.match(gate, /if: always\(\)/, 'the checks job must run even when a dependency failed');
  assert.match(gate, /needs: \[static, browser\]/, 'the checks job must wait for both working jobs');
  assert.match(gate, /contains\(needs\.\*\.result, 'failure'\)/, 'the gate must fail on a failed dependency');
  assert.match(gate, /contains\(needs\.\*\.result, 'cancelled'\)/, 'the gate must fail on a cancelled dependency');
});

// ---- the cache warmer has to agree with the cache reader ----------------------

// warm-cache.yml writes the cache on the default branch; ci.yml restores it on every branch.
// **They agree by string equality on the key or they do not share a cache at all** — and the
// failure is silent in the direction that matters: a mismatched key simply misses, ci.yml takes
// the cold path, and the whole point of the warmer is lost while both workflows stay green.
// That is exactly how the cache in #161 came to be believed for a day without working.
test('the warmer and the reader name the same version', () => {
  const inWarm = /^\s*PLAYWRIGHT_VERSION:\s*(\d+\.\d+\.\d+)\s*$/m.exec(warm);
  assert.ok(inWarm, 'warm-cache.yml should set PLAYWRIGHT_VERSION');
  assert.strictEqual(inWarm[1], playwrightPinInWorkflow(), 'warm-cache.yml and ci.yml must agree');
  assert.strictEqual(inWarm[1], playwrightPinInPackage(), 'and both must agree with package.json');
});

test('the warmer and the reader use a byte-identical cache key', () => {
  const keyOf = (yaml) => {
    const m = /^\s*key:\s*(\S.*?)\s*$/m.exec(yaml);
    return m && m[1];
  };
  const a = keyOf(ci);
  const b = keyOf(warm);
  assert.ok(a, 'ci.yml should declare a cache key');
  assert.strictEqual(b, a, 'a different key means a different cache, and the warmer does nothing');
});

// The push trigger alone cannot recover from a cache that has stopped existing: the three paths it
// watches change rarely, so every PR until one of them is edited pays the cold path. That is a leak
// nobody notices — CI stays green and just gets slower — so the schedule is the fix and this stops it
// being removed quietly.
test('the warmer also runs on a schedule, so a missing cache heals itself', () => {
  const triggers = warm.slice(0, warm.indexOf('jobs:'));
  assert.match(triggers, /^\s*schedule:\s*$/m, 'warm-cache.yml must keep its schedule');
  assert.match(triggers, /cron:/, 'the schedule must name a cron');
  // Path filters do not apply to a schedule event, which is the whole point — a scheduled run fires
  // whether or not those three files moved.
  assert.match(triggers, /^\s*paths:\s*$/m, 'the push trigger should still be path-filtered');
});

test('the warmer runs on the default branch, which is the only place a shared cache can be written', () => {
  // The entire reason this file exists. A cache written on a feature branch is restorable by that
  // branch alone and is never visible to a sibling, so a new branch name always starts cold.
  assert.match(warm, /^\s*branches: \[main\]\s*$/m, 'warm-cache.yml must trigger on main');
  // And ci.yml must not warm the cache by running on the default branch. It DOES run on a
  // push now — that is how a required check stops depending on one webhook arriving, see the
  // note on the trigger — but a push to `main` is a different claim and still excluded, both
  // because it re-tests a tree the pull request already tested and because it would make
  // this file's own reasoning about who writes the shared cache false.
  const ciTriggers = ci.slice(0, ci.indexOf('jobs:'));
  assert.match(ciTriggers, /^\s*push:\s*$/m, 'ci.yml runs on push, so a dropped pull_request event cannot strand a PR');
  assert.match(ciTriggers, /^\s*branches-ignore:\s*$\n\s*- main\s*$/m,
    'ci.yml must exclude main from its push trigger; warm-cache.yml is what runs there');
  assert.doesNotMatch(ciTriggers, /^\s*branches: \[main\]\s*$/m, 'ci.yml must not opt back into push-to-main');
});

module.exports = { playwrightPinInPackage, playwrightPinInWorkflow };
