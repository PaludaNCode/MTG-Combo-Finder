'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const SW = require('../sw.js');
const { writeShell, writeBuild, localAssets } = require('../tools/stamp-assets.js');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

// The service worker's whole decision is which strategy a request gets, and the one
// property that has to hold is that **a fresh deploy is never invisible**. A
// cache-first HTML would pin a reader to one build for as long as the cache lived,
// which is the bug the deploy's stamping exists to prevent, one layer up — and it is
// not something to find out by trying it once, because a stale shell is invisible to
// every other test here and would only be found by a reader.
//
// So it is tested as a function rather than through a browser. sw.js exports it for
// that reason; the plumbing around it is exercised by e2e/offline.spec.js, which is
// the only harness that can run a real worker.
const req = (url, over) => Object.assign({ url, method: 'GET' }, over);

test('sw: the document is never served from the cache first', () => {
  for (const url of ['/', '/index.html', '/tiers.html', 'https://x.test/']) {
    assert.equal(SW.strategyFor(req(url)), 'network-first', url);
  }
  // And by mode, which is what a real navigation carries whatever it is called.
  assert.equal(SW.strategyFor(req('/deck', { mode: 'navigate' })), 'network-first');
});

test('sw: a stamped asset is immutable, so the cache is as good as the network', () => {
  assert.equal(SW.strategyFor(req('/app.js?v=deadbeef')), 'cache-first');
  assert.equal(SW.strategyFor(req('/style.css?v=deadbeef')), 'cache-first');
  assert.equal(SW.strategyFor(req('/search-worker.js?v=deadbeef')), 'cache-first');
});

// The case that makes local work bearable, and it is not a detail: an unstamped URL
// is not immutable. `npm run verify`, `npm run test:ui` and a local `npx serve` all
// serve this page unstamped, and trusting those from the cache would mean editing a
// file and being served yesterday's copy.
test('sw: an unstamped asset is asked for, not assumed', () => {
  assert.equal(SW.strategyFor(req('/app.js')), 'network-first');
  assert.equal(SW.strategyFor(req('/style.css')), 'network-first');
  // A query that is not a stamp is not a stamp.
  assert.equal(SW.strategyFor(req('/app.js?debug=1')), 'network-first');
  assert.equal(SW.strategyFor(req('/app.js?v=')), 'network-first');
});

// The combo payload is search.js's, with its own versioned cache, its own
// revalidation and its own deadline discipline. Two caching layers over one URL is
// the thing that looks fine until they disagree about which copy is current.
test('sw: the combo data is not the worker’s business', () => {
  assert.equal(SW.strategyFor(req('/combos.json')), 'skip');
  assert.equal(SW.strategyFor(req('/combos.json?v=deadbeef')), 'skip');
  assert.equal(SW.strategyFor(req('/combos-tiers.json')), 'skip');
  assert.equal(SW.strategyFor(req('/steps/ab/1234.json')), 'skip');
});

test('sw: anything that is not a GET is left alone', () => {
  assert.equal(SW.strategyFor(req('/app.js?v=deadbeef', { method: 'POST' })), 'skip');
  assert.equal(SW.strategyFor(null), 'skip');
});

// ---- the shell list ---------------------------------------------------------

// The list is written by the deploy from the same localAssets() walk that stamps the
// pages, so adding a <script> to a page stays just that. What this checks is that the
// rewrite lands: a worker precaching last week's URLs is worse than one precaching
// nothing, and it would look identical from outside.
test('sw: the deploy writes the stamped shell into the worker', () => {
  const assets = localAssets(read('index.html'));
  const out = writeShell(writeBuild(read('sw.js'), 'deadbeef'), ['index.html'], assets, 'deadbeef');
  assert.ok(out, 'the markers are where the deploy looks for them');
  assert.match(out, /const BUILD = 'deadbeef';/);
  for (const asset of assets) {
    assert.ok(out.includes(`'${asset}?v=deadbeef',`), `${asset} is in the shell, stamped`);
  }
  assert.ok(out.includes("'index.html',"), 'and the page itself, unstamped');
  // Still a program afterwards. A rewrite that produced a syntax error would take the
  // whole worker with it, and registration failing is silent by design.
  assert.doesNotThrow(() => new Function(out));
  // And the markers survive, so a second run finds them.
  assert.ok(writeShell(out, ['index.html'], assets, 'cafe'), 'idempotent');
});

test('sw: a worker without the markers fails the deploy rather than shipping bare', () => {
  assert.equal(writeShell('const SHELL = [];', ['index.html'], ['app.js'], 'deadbeef'), null);
});

// The three-and-a-bit files no page references with a `src=`, so the walk cannot see
// them: app.js constructs the search worker, and both it and the no-Worker fallback
// load their scripts themselves. They are the one list in the worker maintained by
// hand, which is exactly why the drift is checked here — a rename would otherwise
// leave a reader whose Worker failed with a page that cannot search, offline only.
test('sw: the precache list still covers the scripts no page references', () => {
  const app = read('app.js');
  const fallback = (app.match(/const FALLBACK_SCRIPTS = \[([^\]]*)\]/) || [])[1] || '';
  const named = fallback.match(/'([^']+)'/g).map((s) => s.replace(/'/g, ''));
  assert.ok(named.length, 'found the fallback list in app.js');
  const worker = (app.match(/new Worker\('([^']+)'/) || [])[1];
  assert.ok(worker, 'found the worker script in app.js');
  const imported = (read('search-worker.js').match(/importScripts\(([^)]*)\)/) || [])[1] || '';
  const imports = (imported.match(/'([^']+)'/g) || []).map((s) => s.replace(/'/g, ''));
  assert.ok(imports.length, 'found the worker’s imports');

  for (const file of named.concat(worker, imports)) {
    // The imports carry the worker's own query string in some cases; compare names.
    const name = String(file).split('?')[0].replace(/^\.\//, '');
    assert.ok(SW.NOT_IN_THE_HTML.includes(name), `${name} is precached by sw.js`);
  }
});

test('sw: everything it precaches by hand is a file that exists', () => {
  for (const file of SW.NOT_IN_THE_HTML) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), file);
  }
});

// Locally nothing is stamped, and the page asks for these bare — so the worker must
// ask for them bare too, or it warms URLs nobody wants.
test('sw: the hand-listed files carry the build’s stamp, or none at all', () => {
  assert.equal(SW.BUILD, 'dev', 'the committed worker is the unstamped one');
  assert.equal(SW.stamped('search.js'), 'search.js');
});

// The page registers it, or none of the above happens at all.
test('sw: the page registers the worker, with the stamp its own URL carries', () => {
  const app = read('app.js');
  assert.match(app, /navigator\.serviceWorker\.register\('sw\.js' \+ ASSET_VERSION\)/);
  // Both pages' CSP has to allow it. index.html loads app.js; tiers.html does not
  // register one, but the directive is shared and worth keeping true.
  assert.match(read('index.html'), /worker-src 'self'/);
});
