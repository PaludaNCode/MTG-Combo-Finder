'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Every .js file in the repository has to be matched by a block in
// eslint.config.mjs — and this is a test rather than a comment because of how
// flat config fails when one is not.
//
// A file that no block's `files` matches is not linted leniently. It is not
// linted at all: no rules apply, and `npx eslint .` reports it as clean. Three
// of this page's own scripts — theme.js, unofficial.js and graph.js — sat
// outside every block for a while, and the lint step stayed green the whole
// time. Proved by putting `documnet.title` in one of them and watching CI pass.
//
// So the thing worth asserting is not "the lint passes", which it did. It is
// that the linter is actually looking at each file.

const ROOT = path.join(__dirname, '..');
// Nothing in here is ours: fetched packages, per-run test output, git's own
// storage, and the combo database, which is data rather than code.
const SKIP = new Set(['node_modules', '.git', 'test-results', 'playwright-report']);

function everyScript(dir, found) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) everyScript(full, found);
    else if (entry.name.endsWith('.js')) found.push(path.relative(ROOT, full));
  }
  return found;
}

// The two shapes eslint.config.mjs actually uses: an exact path, and a
// directory glob like `tools/**/*.js`. Deliberately not a general glob engine —
// this has to be obviously correct, and a pattern it cannot read should fail
// loudly rather than quietly match nothing.
function matcher(pattern) {
  if (pattern.includes('**')) {
    const [prefix, suffix] = pattern.split('**');
    assert.ok(suffix.startsWith('/'), `unreadable pattern: ${pattern}`);
    const tail = suffix.slice(1);
    assert.ok(tail === '*.js' || tail === '*.spec.js', `unreadable pattern: ${pattern}`);
    const ext = tail.slice(1);
    return (file) => file.startsWith(prefix) && file.endsWith(ext);
  }
  assert.ok(!pattern.includes('*'), `unreadable pattern: ${pattern}`);
  return (file) => file === pattern;
}

test('lint config: every script in the repository is linted by something', async () => {
  const config = (await import('../eslint.config.mjs')).default;
  const patterns = config.flatMap((block) => block.files || []);
  assert.ok(patterns.length, 'the lint config matches nothing at all');
  const matches = patterns.map(matcher);

  const orphans = everyScript(ROOT, []).filter((file) => !matches.some((m) => m(file)));
  assert.deepStrictEqual(orphans, [],
    'these files match no block in eslint.config.mjs, so `npx eslint .` reports '
    + 'them clean without reading them');
});

// The two environments are not interchangeable: a page script linted with Node
// globals would accept `process.exit()` in the browser, and a Node file linted
// with browser globals would accept `document` in a tool.
test('lint config: the page scripts and the Node files are told apart', async () => {
  const config = (await import('../eslint.config.mjs')).default;
  const globalsFor = (file) => config
    .filter((block) => (block.files || []).some((p) => matcher(p)(file)))
    .flatMap((block) => Object.keys(block.languageOptions.globals));

  assert.ok(globalsFor('app.js').includes('document'), 'the page is not linted as a page');
  assert.ok(!globalsFor('app.js').includes('process'), 'the page may reach for process');
  assert.ok(globalsFor('tools/verify-layout.js').includes('process'), 'a tool is not linted as node');
  assert.ok(!globalsFor('tools/verify-layout.js').includes('document'),
    'a tool may reach for document');
  // The browser tests are both at once, on purpose: page.evaluate() callbacks
  // are browser code inside a Node file.
  const spec = globalsFor('e2e/map.spec.js');
  assert.ok(spec.includes('document') && spec.includes('require'),
    'the browser tests need both environments');
});
