'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isLocalAsset, localAssets, rewriteAssets, stamp, main } = require('../tools/stamp-assets.js');

// The deploy's cache-busting, which is the one piece of this repository whose
// failures only ever appear in production: an unstamped asset resolves perfectly
// well, it just serves whatever the Pages CDN cached last. So the interesting
// test is not that stamping works — it is that a page with something unstamped
// is *rejected*, because the version this replaced could not tell.

test('local assets are stamped; other people\'s URLs are not', () => {
  const html = [
    '<link rel="stylesheet" href="style.css">',
    '<script src="app.js"></script>',
    '<a href="https://commanderspellbook.com/">Spellbook</a>',
    '<img src="//cdn.example.com/x.png">',
    '<a href="#top">top</a>',
  ].join('\n');
  const got = stamp(html, 'abc123');
  assert.match(got, /href="style\.css\?v=abc123"/);
  assert.match(got, /src="app\.js\?v=abc123"/);
  assert.match(got, /href="https:\/\/commanderspellbook\.com\/"/, 'external URL untouched');
  assert.match(got, /src="\/\/cdn\.example\.com\/x\.png"/, 'protocol-relative untouched');
  assert.match(got, /href="#top"/, 'fragment untouched');
});

// A commit SHA in a URL people bookmark is the opposite of what this is for, and
// the HTML is deliberately the one thing left cacheable-and-current.
test('a link to the other page is navigation, not an asset', () => {
  assert.strictEqual(isLocalAsset('tiers.html'), false);
  assert.strictEqual(isLocalAsset('index.html'), false);
  assert.strictEqual(stamp('<a href="tiers.html">t</a>', 'x'), '<a href="tiers.html">t</a>');
});

test('stamping twice is a no-op, not app.js?v=a?v=b', () => {
  const once = stamp('<script src="app.js"></script>', 'first');
  assert.strictEqual(stamp(once, 'second'), once);
});

test('localAssets finds each file once, in document order', () => {
  const html = '<link href="style.css"><script src="app.js"></script><script src="app.js"></script>';
  assert.deepStrictEqual(localAssets(html), ['style.css', 'app.js']);
});

test('rewriteAssets takes any rewrite, which is what the layout test needs', () => {
  const got = rewriteAssets('<script src="app.js"></script>', (url) => `/stamped/${url}?v=t`);
  assert.strictEqual(got, '<script src="/stamped/app.js?v=t"></script>');
});

// ---- the real pages --------------------------------------------------------

test('both shipped pages stamp completely', () => {
  for (const page of ['index.html', 'tiers.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.ok(localAssets(html).length >= 3, page + ' references assets');
    assert.deepStrictEqual(localAssets(stamp(html, 'sha')), [], page + ' has nothing left bare');
  }
});

// The whole point of the rewrite. The list-and-count version could not see this:
// the new file went out unstamped while the count still matched, which is exactly
// how unofficial.js and graph.js each shipped a stale-JS bug.
test('a script added to a page is stamped without being listed anywhere', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
    .replace('</body>', '  <script src="brand-new-file.js"></script>\n</body>');
  const got = stamp(html, 'sha');
  assert.match(got, /src="brand-new-file\.js\?v=sha"/);
  assert.deepStrictEqual(localAssets(got), []);
});

// ---- the CLI, which is what the deploy actually runs ------------------------

function inTempDir(files, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stamp-'));
  const quiet = { log: console.log, error: console.error };
  console.log = () => {};
  console.error = () => {};
  try {
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
    return run(dir);
  } finally {
    console.log = quiet.log;
    console.error = quiet.error;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the CLI writes the stamped page and reports success', () => {
  inTempDir({ 'p.html': '<script src="app.js"></script>' }, (dir) => {
    const page = path.join(dir, 'p.html');
    assert.strictEqual(main(['sha1', page]), 0);
    assert.strictEqual(fs.readFileSync(page, 'utf8'), '<script src="app.js?v=sha1"></script>');
  });
});

// Being pointed at the wrong file has to be a failure. Silently stamping nothing
// and exiting 0 is how a deploy reports success for work it did not do.
test('a page with no assets fails rather than passing quietly', () => {
  inTempDir({ 'p.html': '<p>nothing here</p>' }, (dir) => {
    assert.strictEqual(main(['sha1', path.join(dir, 'p.html')]), 1);
  });
});

test('the CLI needs a version and at least one page', () => {
  assert.strictEqual(main([]), 1);
  assert.strictEqual(main(['sha-only']), 1);
});

test('one bad page fails the run even when another succeeded', () => {
  inTempDir({ 'good.html': '<script src="app.js"></script>', 'bad.html': '<p>none</p>' }, (dir) => {
    assert.strictEqual(main(['sha1', path.join(dir, 'good.html'), path.join(dir, 'bad.html')]), 1);
    assert.match(fs.readFileSync(path.join(dir, 'good.html'), 'utf8'), /\?v=sha1/, 'the good page still stamped');
  });
});
