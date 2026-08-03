#!/usr/bin/env node
// The static server the Playwright suite runs against: the real repository as
// it deploys, with one substitution — `combos.json` is answered from
// test/fixtures/dataset.js rather than from disk.
//
// That substitution is the whole reason this file exists rather than
// `npx serve`. The published database is ~28 MB and changes every morning, so a
// test that used it would be slow, would need the network, and would fail on the
// day Spellbook published a combo that changed a count. The fixture is a made-up
// deck that produces every section of the page.
//
// Serving from disk otherwise, unbuilt: what the tests press is the same HTML,
// CSS and JavaScript that goes to Pages, so a broken script tag is a failing test
// rather than something only production finds. The deploy's `?v=<sha>` stamping
// is not applied here — tools/verify-layout.js has a run dedicated to that.
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { FIXTURE, asPublished, stepsFiles } = require('../test/fixtures/dataset.js');

const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

// A second dataset for the tiers page, which is about results the tier inventory
// has not classified — nothing to do with a deck. Kept behind its own path so a
// test can ask for it explicitly.
const { TIERS_FIXTURE } = require('../test/fixtures/dataset.js');

const DATASETS = {
  // Served the way the deploy publishes it — interned, most ids derived — so a
  // page that forgets DeckCombos.decode() fails here rather than in production.
  '/combos.json': asPublished(FIXTURE),
  '/combos-tiers.json': asPublished(TIERS_FIXTURE),
};

// The steps tree the nightly job publishes beside combos.json, at the same paths.
// Served from the fixture rather than from disk because `steps/` is a build
// artifact and gitignored — and because a combo with no file has to answer 404,
// which is how "no steps recorded" is published.
const STEPS = stepsFiles();

// Standing in for a deploy, for exactly one test.
//
// A service worker's whole hazard is shipping an update nobody receives, and the only
// way to prove the shell is not stale is to change what the server sends and load the
// page again. Playwright's request interception cannot do it — it does not apply to
// requests a service worker makes, and the navigation goes through the worker — so the
// change has to happen out here.
//
// Deliberately a rewrite of the served bytes rather than a write to disk: this suite
// runs against the real repository, unbuilt, and must not edit it. `/__deploy?h1=…`
// sets it, and it is off until a test asks. Nothing else in the suite is affected,
// because nothing else sets it.
let deployedH1 = null;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;

  if (pathname === '/__deploy') {
    deployedH1 = url.searchParams.get('h1');
    res.writeHead(200, { 'content-type': MIME['.txt'], 'cache-control': 'no-store' });
    res.end('h1 is now ' + (deployedH1 || '(as committed)'));
    return;
  }

  if (pathname.startsWith('/steps/')) {
    const body = STEPS[pathname];
    if (!body) {
      res.writeHead(404, { 'content-type': MIME['.txt'] }).end('no steps for ' + pathname);
      return;
    }
    res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
    res.end(body);
    return;
  }

  const dataset = DATASETS[pathname];
  if (dataset) {
    const body = JSON.stringify(dataset);
    // No-store, because a page that keeps a copy in Cache Storage between tests
    // would make the second test's data depend on the first test's run.
    res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
    res.end(body);
    return;
  }

  // Resolved and then checked, so a request for /../../etc/passwd cannot leave
  // the repository even though this only ever listens on localhost.
  const file = path.resolve(ROOT, '.' + pathname);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('outside the repository');
    return;
  }
  fs.readFile(file, (err, body) => {
    if (err) {
      res.writeHead(404, { 'content-type': MIME['.txt'] }).end('no such file: ' + pathname);
      return;
    }
    // The one substitution besides the dataset, and only when a test has asked for it.
    const out = deployedH1 && /\.html$/.test(file)
      ? Buffer.from(String(body).replace(/<h1>[^<]*<\/h1>/, '<h1>' + deployedH1 + '</h1>'))
      : body;
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(out);
  });
});

const port = Number(process.env.PORT || 4173);
server.listen(port, '127.0.0.1', () => {
  // Playwright's webServer waits for this port to answer; the line is for
  // someone running the server by hand.
  process.stdout.write('serving ' + ROOT + ' on http://127.0.0.1:' + port + '\n');
});
