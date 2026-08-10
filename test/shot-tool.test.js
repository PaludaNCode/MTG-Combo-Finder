'use strict';
// `npm run shot` is two untestable halves with a testable middle: a shell string in
// package.json, a Playwright spec that no unit test can load, and the plan between them.
// This covers the middle, and reaches the shell half by running it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { shotPlan, DEFAULT_OUT, DEFAULT_PAGE } = require('../tools/shot-config.js');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('a value with a space in it reaches Playwright as one argument', () => {
  // The fault: `${SHOT_PROJECT:+--project=$SHOT_PROJECT}` word-splits, so a two-word
  // project name arrives as two arguments and Playwright complains about the second
  // rather than about the name — issue #210.
  //
  // Run through a real shell rather than matched as text: the claim is about expansion,
  // and a regex asserting the quotes are present would pass against any other way of
  // getting it wrong.
  const expansion = /(\$\{SHOT_PROJECT:\+[^}]*\})/.exec(pkg.scripts.shot);
  assert.ok(expansion, 'the shot script should still build --project from SHOT_PROJECT');
  const argv = execFileSync('sh', ['-c', `printf '%s\\n' ${expansion[1]}`], {
    encoding: 'utf8',
    env: { ...process.env, SHOT_PROJECT: 'no such project' },
  }).trim().split('\n');
  assert.deepEqual(argv, ['--project=no such project']);
});

test('no project named means no flag at all, so both profiles run', () => {
  const expansion = /(\$\{SHOT_PROJECT:\+[^}]*\})/.exec(pkg.scripts.shot);
  const out = execFileSync('sh', ['-c', `printf '%s\\n' ${expansion[1]}`], {
    encoding: 'utf8',
    env: { ...process.env, SHOT_PROJECT: '' },
  });
  // One empty line from printf, no `--project=`: the `:+` form is what makes the flag
  // vanish rather than arrive empty, and an empty --project= is an error.
  assert.equal(out.trim(), '');
});

test('the default output directory is not the one Playwright empties', () => {
  // The whole fault in one assertion: `test-results/` is cleared at the start of every
  // run, so a picture taken by `npm run shot` disappeared the moment anybody ran
  // `npm run test:ui` — a tool that quietly loses its only output.
  assert.notEqual(DEFAULT_OUT, 'test-results');
  assert.equal(shotPlan({}).out, path.join(root, DEFAULT_OUT));
  // And it is ignored by git, or every shot would offer itself as a commit.
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), new RegExp('^' + DEFAULT_OUT + '/$', 'm'));
});

test('a page other than index.html can be photographed, and is not searched', () => {
  // tiers.html has no decklist box, so a shot of it that searched anyway would die on a
  // missing selector rather than take a picture. Page and search are one decision.
  const tiers = shotPlan({ SHOT_PAGE: 'tiers.html' });
  assert.equal(tiers.page, '/tiers.html');
  assert.equal(tiers.search, false);
  // A bare name and a path are the same request.
  assert.equal(shotPlan({ SHOT_PAGE: '/tiers.html' }).page, '/tiers.html');
  assert.equal(shotPlan({}).page, DEFAULT_PAGE);
});

test('the empty state is reachable on the deck page itself', () => {
  // The page before anybody has pasted anything — which has shipped bugs and was
  // unphotographable while the search was unconditional.
  const empty = shotPlan({ SHOT_SEARCH: '0' });
  assert.equal(empty.page, DEFAULT_PAGE);
  assert.equal(empty.search, false);
  // …and the default target moves with it, because #results does not exist until a
  // search lands: a shot of it would wait for a selector that is never coming.
  assert.equal(empty.selector, 'body');
  assert.equal(shotPlan({}).selector, '#results');
  // An explicit selector is still honoured, whichever state the page is in.
  assert.equal(shotPlan({ SHOT_SEARCH: '0', SHOT_SELECTOR: '#decklist' }).selector, '#decklist');
});

test('the plan passes the rest through, so the spec holds no defaults of its own', () => {
  const plan = shotPlan({
    SHOT_DECK: 'unofficialAlmost',
    SHOT_OPEN: '.bracket-scale',
    SHOT_WAIT: '#bracket-why',
    SHOT_COMMANDERS: 'Kinnan, Bonder Prodigy',
    SHOT_WIDTH: '1440',
    SHOT_HEIGHT: '1000',
    SHOT_OUT: '/tmp/elsewhere',
  });
  assert.deepEqual(plan, {
    page: '/index.html',
    search: true,
    deck: 'unofficialAlmost',
    selector: '#results',
    open: '.bracket-scale',
    waitFor: '#bracket-why',
    commanders: 'Kinnan, Bonder Prodigy',
    width: 1440,
    height: 1000,
    out: '/tmp/elsewhere',
  });
  // A width that is not a number is no width, not NaN: setViewportSize(NaN) throws deep
  // inside Playwright and reads as a broken harness.
  assert.equal(shotPlan({ SHOT_WIDTH: 'wide' }).width, 0);
});
