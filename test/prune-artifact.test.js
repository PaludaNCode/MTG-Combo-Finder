'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { servedBy, plan, main } = require('../tools/prune-artifact.js');
const ServiceWorkerShell = require('../sw.js');

// The prune deletes directories out of the tree that is about to become the live
// site, so the only interesting tests are the ones about it deleting too much.
// Three ways that can happen, and each has a test below: reading a page it cannot
// see the assets in (empty keep set → delete the site), running somewhere that is
// not the site root, and a reference to a file that is not there.

const write = (dir, files) => {
  for (const [name, body] of Object.entries(files)) {
    const at = path.join(dir, name);
    fs.mkdirSync(path.dirname(at), { recursive: true });
    fs.writeFileSync(at, body);
  }
  return dir;
};

const tmp = (files) => write(fs.mkdtempSync(path.join(os.tmpdir(), 'prune-')), files);

// Runs `fn` with the process in `dir`, and puts it back whatever happens — a test
// that leaves the process somewhere else makes every later test read the wrong
// directory, which is a failure nobody would attribute to this file.
function inside(dir, fn) {
  const was = process.cwd();
  process.chdir(dir);
  try {
    return fn();
  } finally {
    process.chdir(was);
  }
}

const PAGE = [
  '<link rel="stylesheet" href="style.css">',
  '<link rel="icon" href="favicon.svg">',
  '<script src="app.js"></script>',
  '<a href="tiers.html">tiers</a>',
  '<a href="https://commanderspellbook.com/">Spellbook</a>',
].join('\n');

test('what the site serves is read out of the page, not listed', () => {
  const keep = servedBy(['index.html'], () => PAGE);
  assert.ok(keep.has('style.css'));
  assert.ok(keep.has('favicon.svg'));
  assert.ok(keep.has('app.js'));
  assert.ok(keep.has('index.html'));
  assert.ok(!keep.has('https://commanderspellbook.com/'), 'somebody else\'s URL is not a file here');
});

// The one that would delete the site. This runs after stamp-assets.js, so every
// reference carries ?v=<sha> by then — and localAssets() ignores URLs with a
// query, because for its own purposes a query means "already stamped".
test('a stamped page is read the same as a bare one', () => {
  const stamped = PAGE.replace(/(href|src)="([^":]+\.(?:css|svg|js))"/g, '$1="$2?v=deadbeef"');
  assert.match(stamped, /app\.js\?v=deadbeef/, 'the fixture is actually stamped');
  const keep = servedBy(['index.html'], () => stamped);
  assert.ok(keep.has('app.js'), 'a stamped reference still keeps its file');
  assert.ok(keep.has('style.css'));
});

// app.js constructs the worker and loads the fallback scripts itself, so no `src=`
// in either page names them. sw.js already carries that list for its precache and
// test/service-worker.test.js pins it against app.js — this reads the same list
// rather than keeping a second one that could fall behind and delete a file the
// page loads at runtime.
test('the files no page references are kept, from sw.js\'s own list', () => {
  const keep = servedBy(['index.html'], () => PAGE);
  assert.ok(keep.has('sw.js'), 'the worker registers from app.js, so nothing references it');
  for (const name of ServiceWorkerShell.NOT_IN_THE_HTML) {
    assert.ok(keep.has(name), `${name} is loaded at runtime and must survive`);
  }
});

test('a page with no assets refuses rather than planning to delete everything', () => {
  assert.throws(
    () => servedBy(['index.html'], () => '<p>hello</p>'),
    /no local asset URLs found/
  );
});

test('hidden entries are neither kept nor dropped — the artifact already excludes them', () => {
  const { kept, dropped } = plan(['.git', '.github', '.gitignore', 'app.js', 'test'], new Set(['app.js']));
  assert.deepStrictEqual(kept, ['app.js']);
  assert.deepStrictEqual(dropped, ['test'], '.git in `dropped` would delete the checkout mid-job');
});

test('an asset in a subdirectory keeps the whole subtree', () => {
  const { kept, dropped } = plan(['img', 'tools'], new Set(['img/pip.svg']));
  assert.deepStrictEqual(kept, ['img']);
  assert.deepStrictEqual(dropped, ['tools']);
});

test('--apply keeps the site and drops the rest', () => {
  const dir = tmp({
    'index.html': PAGE,
    'tiers.html': '<link rel="stylesheet" href="style.css">',
    'style.css': 'body{}',
    'favicon.svg': '<svg/>',
    'app.js': '//',
    'sw.js': '//',
    'card-text.json': '{}',
    'README.md': '#',
    'tools/thing.js': '//',
  });
  for (const name of ServiceWorkerShell.NOT_IN_THE_HTML) fs.writeFileSync(path.join(dir, name), '//');

  const code = inside(dir, () => main(['index.html', 'tiers.html', '--apply']));
  assert.strictEqual(code, 0);

  const left = fs.readdirSync(dir).sort();
  assert.ok(left.includes('index.html') && left.includes('style.css') && left.includes('app.js'));
  assert.ok(left.includes('sw.js'), 'the worker is served and referenced by nothing');
  assert.ok(!left.includes('card-text.json'), '16.5 MB of oracle text nothing fetches');
  assert.ok(!left.includes('README.md'));
  assert.ok(!left.includes('tools'), 'a directory goes too, not just files');
});

test('a dry run deletes nothing', () => {
  const dir = tmp({ 'index.html': PAGE, 'style.css': 'body{}', 'favicon.svg': '<svg/>', 'app.js': '//', 'card-text.json': '{}' });
  const before = fs.readdirSync(dir).sort();
  const code = inside(dir, () => main(['index.html']));
  assert.strictEqual(code, 0);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), before);
});

// The guard that makes computing the keep set safe. A page referencing something
// that is not there would otherwise deploy green and 404 in a browser — the whole
// class of bug the asset stamping exists to end, one layer along.
test('a reference the prune cannot satisfy fails the deploy', () => {
  const dir = tmp({
    'index.html': '<link rel="stylesheet" href="style.css"><script src="gone.js"></script>',
    'style.css': 'body{}',
    'README.md': '#',
  });
  const code = inside(dir, () => main(['index.html', '--apply']));
  assert.strictEqual(code, 1, 'the site serves gone.js and gone.js does not exist');
});

test('running outside the site root refuses before deleting anything', () => {
  const dir = tmp({ 'style.css': 'body{}', 'app.js': '//', 'favicon.svg': '<svg/>', 'keepme.txt': 'x' });
  const page = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'prune-elsewhere-')), 'index.html');
  fs.writeFileSync(page, PAGE);
  const code = inside(dir, () => main([page, '--apply']));
  assert.strictEqual(code, 1);
  assert.ok(fs.existsSync(path.join(dir, 'keepme.txt')), 'nothing was deleted');
});
