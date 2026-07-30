'use strict';
const test = require('node:test');
const assert = require('node:assert');
const ComboSearch = require('../search.js');

// The published database is ~2.9 MB on the wire and raw.githubusercontent.com
// serves it with `max-age=300`, so without a cache of our own every visit — and
// every reload five minutes into a visit — downloads the whole thing again.
//
// Cache Storage is the right tool and cannot be relied on: it is missing in
// private mode, it fails when the disk is full, and it can simply never answer
// (headless Chrome on a virtual clock leaves `caches.open()` pending forever).
// So these tests are mostly about what happens when it misbehaves.

const URL_A = 'https://example.test/combos.json';

const payload = (mark) => JSON.stringify({
  updatedAt: '2026-01-01T00:00:00Z',
  cardIdentity: { 'Basalt Monolith': '' },
  combos: [{ id: mark, c: ['Basalt Monolith'], p: ['Infinite colorless mana'], i: 'C' }],
});

// A Cache Storage stand-in. `open` and `match` are overridable per test, since
// misbehaving is the interesting case.
function fakeCaches(options) {
  const opts = options || {};
  const store = new Map(opts.entries || []);
  const calls = { open: 0, match: 0, put: 0 };
  const cache = {
    match(url) {
      calls.match += 1;
      if (opts.matchHangs) return new Promise(() => {});
      if (opts.matchThrows) return Promise.reject(new Error('no'));
      const held = store.get(url);
      return Promise.resolve(held ? held.clone() : undefined);
    },
    put(url, res) {
      calls.put += 1;
      store.set(url, res);
      return Promise.resolve();
    },
  };
  return {
    calls,
    store,
    api: {
      open() {
        calls.open += 1;
        if (opts.openHangs) return new Promise(() => {});
        if (opts.openThrows) return Promise.reject(new Error('nope'));
        return Promise.resolve(cache);
      },
    },
  };
}

function stubFetch(responses) {
  const seen = [];
  globalThis.fetch = (url, init) => {
    seen.push({ url, init: init || {} });
    const next = responses.shift();
    if (!next) return Promise.reject(new Error('unexpected fetch'));
    return Promise.resolve(next);
  };
  return seen;
}

const held = (body) => new Response(body, { headers: { etag: 'W/"held"' } });

function setup(options) {
  const fake = options && options.caches;
  if (fake) globalThis.caches = fake.api;
  else delete globalThis.caches;
  // A short deadline so the "never answers" case does not stall the suite.
  ComboSearch.reset({ cacheDeadlineMs: 25 });
  return fake;
}

const DECK = [{ card: 'Basalt Monolith', quantity: 1 }];
const idOf = (out) => out.included.concat(out.almostIncluded)[0].id;

test.afterEach(() => {
  delete globalThis.caches;
  delete globalThis.fetch;
  ComboSearch.reset({ cacheDeadlineMs: 1500 });
});

test('with no Cache Storage at all, the database is downloaded', async () => {
  setup({});
  const seen = stubFetch([new Response(payload('net'))]);
  const out = await ComboSearch.run(URL_A, DECK);
  assert.equal(out.meta.source, 'network');
  assert.equal(seen.length, 1);
  assert.equal(idOf(out), 'net');
});

test('a first visit downloads and keeps a copy', async () => {
  const fake = setup({ caches: fakeCaches() });
  stubFetch([new Response(payload('net'))]);
  const out = await ComboSearch.run(URL_A, DECK);
  assert.equal(out.meta.source, 'network');
  assert.equal(fake.calls.put, 1, 'the copy has to be kept, or nothing is saved next time');
  assert.ok(fake.store.has(URL_A));
});

test('a later visit reads the copy instead of downloading it again', async () => {
  const fake = setup({ caches: fakeCaches({ entries: [[URL_A, held(payload('cached'))]] }) });
  // The only fetch this may make is the background check for a newer copy.
  const seen = stubFetch([new Response(null, { status: 304 })]);
  const out = await ComboSearch.run(URL_A, DECK);
  assert.equal(out.meta.source, 'cache');
  assert.equal(idOf(out), 'cached', 'the kept copy is what was searched');
  assert.equal(fake.calls.match, 1);
  // Whatever it did on the wire, it was conditional — not the whole file again.
  if (seen.length) assert.equal(seen[0].init.headers['If-None-Match'], 'W/"held"');
});

test('the background check replaces the copy when the data has moved on', async () => {
  const fake = setup({ caches: fakeCaches({ entries: [[URL_A, held(payload('cached'))]] }) });
  stubFetch([new Response(payload('fresher'), { headers: { etag: 'W/"new"' } })]);
  const out = await ComboSearch.run(URL_A, DECK);
  assert.equal(idOf(out), 'cached', 'this search still used the copy it had');
  // The replacement is not awaited, so let the microtasks drain.
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(fake.calls.put, 1, 'and next visit will find the newer one');
});

test('the background check leaves the copy alone when nothing changed', async () => {
  const fake = setup({ caches: fakeCaches({ entries: [[URL_A, held(payload('cached'))]] }) });
  stubFetch([new Response(null, { status: 304 })]);
  await ComboSearch.run(URL_A, DECK);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(fake.calls.put, 0);
});

// The failure this guards against is not a wrong answer, it is no answer: a page
// that says "Downloading the combo database…" and stays that way forever.
test('a cache that never answers does not stop the search', async () => {
  setup({ caches: fakeCaches({ openHangs: true }) });
  stubFetch([new Response(payload('net'))]);
  const out = await ComboSearch.run(URL_A, DECK);
  assert.equal(out.meta.source, 'network');
});

test('a cache whose lookup never answers does not stop the search either', async () => {
  setup({ caches: fakeCaches({ matchHangs: true }) });
  stubFetch([new Response(payload('net'))]);
  const out = await ComboSearch.run(URL_A, DECK);
  assert.equal(out.meta.source, 'network');
});

test('a cache that refuses outright is simply not used', async () => {
  setup({ caches: fakeCaches({ openThrows: true }) });
  stubFetch([new Response(payload('net'))]);
  assert.equal((await ComboSearch.run(URL_A, DECK)).meta.source, 'network');

  setup({ caches: fakeCaches({ matchThrows: true }) });
  stubFetch([new Response(payload('net'))]);
  assert.equal((await ComboSearch.run(URL_A, DECK)).meta.source, 'network');
});

test('the second search of a session touches neither network nor cache', async () => {
  const fake = setup({ caches: fakeCaches() });
  stubFetch([new Response(payload('net'))]);
  await ComboSearch.run(URL_A, DECK);
  const again = await ComboSearch.run(URL_A, DECK); // no fetch queued: any call throws
  assert.equal(again.meta.source, 'memory');
  assert.equal(fake.calls.match, 1);
});

// The failure report is the only thing a reader can act on, so what went wrong
// has to survive as data rather than as a message.
test('a missing database says what to do about it', async () => {
  setup({});
  stubFetch([new Response('nope', { status: 404 })]);
  await assert.rejects(() => ComboSearch.run(URL_A, DECK), /HTTP 404/);
  assert.match(ComboSearch.diagnostics().likelyCause, /has not been published yet/);
  assert.equal(ComboSearch.diagnostics().status, 404);
});

test('a database that is not JSON keeps the first of what came back', async () => {
  setup({});
  stubFetch([new Response('<html>rate limited</html>')]);
  await assert.rejects(() => ComboSearch.run(URL_A, DECK), /Could not read/);
  assert.match(ComboSearch.diagnostics().responseSnippet, /rate limited/);
});

test('an empty database is refused rather than shown as a deck with no combos', async () => {
  setup({});
  stubFetch([new Response(JSON.stringify({ combos: [] }))]);
  await assert.rejects(() => ComboSearch.run(URL_A, DECK), /empty/);
});
