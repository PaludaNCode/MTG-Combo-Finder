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
  const calls = { open: 0, match: 0, put: 0, keys: 0 };
  // Which caches this browser holds, by name — the tidy-up's subject matter.
  const names = (opts.names || []).slice();
  const deleted = [];
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
  const api = {
    open() {
      calls.open += 1;
      if (opts.openHangs) return new Promise(() => {});
      if (opts.openThrows) return Promise.reject(new Error('nope'));
      return Promise.resolve(cache);
    },
  };
  // Left off entirely when the test is about a browser that has no listing at
  // all, which has to be survivable rather than merely unlikely.
  if (!opts.noKeys) {
    api.keys = () => {
      calls.keys += 1;
      if (opts.keysHangs) return new Promise(() => {});
      if (opts.keysThrows) throw new Error('no listing for you');
      return Promise.resolve(names.slice());
    };
    api.delete = (name) => {
      deleted.push(name);
      return Promise.resolve(true);
    };
  }
  return { calls, store, deleted, api };
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

// ---- tidying up after an abandoned cache version --------------------------
//
// Bumping CACHE_NAME stops the page reading an old copy. It does not delete it,
// so before this the first version's ~28 MB sat in the reader's browser for good,
// and every future shape change would have added another. Nothing observable goes
// wrong, which is exactly why it is worth a test.

const settled = () => new Promise((r) => setTimeout(r, 10));

test('a copy left by an abandoned cache version is deleted', async () => {
  const fake = setup({
    caches: fakeCaches({ names: ['mtg-combo-finder-data-v1', ComboSearch.CACHE_NAME, 'unrelated-cache'] }),
  });
  stubFetch([new Response(payload('net'))]);
  await ComboSearch.run(URL_A, DECK);
  await settled();
  assert.deepEqual(fake.deleted, ['mtg-combo-finder-data-v1'],
    'the old version goes; the current one and other people\'s caches stay');
});

test('the tidy-up happens once a session, not once a search', async () => {
  const fake = setup({ caches: fakeCaches({ names: ['mtg-combo-finder-data-v1'] }) });
  stubFetch([new Response(payload('net'))]);
  await ComboSearch.run(URL_A, DECK);
  await ComboSearch.run(URL_A, DECK); // served from memory: any fetch would throw
  await settled();
  assert.equal(fake.calls.keys, 1);
  assert.deepEqual(fake.deleted, ['mtg-combo-finder-data-v1']);
});

// The same rule the rest of the cache follows: it is a nicety, so every way it
// can misbehave has to leave the search alone.
test('a listing that never answers does not stop the search', async () => {
  setup({ caches: fakeCaches({ keysHangs: true }) });
  stubFetch([new Response(payload('net'))]);
  assert.equal((await ComboSearch.run(URL_A, DECK)).meta.source, 'network');
});

test('a browser that refuses to list its caches still gets to use one', async () => {
  const fake = setup({ caches: fakeCaches({ keysThrows: true }) });
  stubFetch([new Response(payload('net'))]);
  assert.equal((await ComboSearch.run(URL_A, DECK)).meta.source, 'network');
  assert.equal(fake.calls.put, 1, 'the copy is still kept — only the tidy-up was lost');
});

test('a browser with no cache listing at all is fine', async () => {
  const fake = setup({ caches: fakeCaches({ noKeys: true }) });
  stubFetch([new Response(payload('net'))]);
  assert.equal((await ComboSearch.run(URL_A, DECK)).meta.source, 'network');
  assert.equal(fake.calls.put, 1);
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

// ---- the two kinds of unofficial row, wired together -----------------------
//
// matchUnofficial() and standInRows() are each tested on their own in
// unofficial.test.js. What is only true here is that search.js calls both, and
// concatenates them in the order the deduplication depends on. A wiring mistake
// leaves the page silently missing a thousand rows, and nothing else would catch
// it: the unit tests would still pass and the panel would simply be shorter.

const OUTLET_DATA = {
  updatedAt: '2026-01-01T00:00:00Z',
  cardIdentity: {
    'Bartolomé del Presidio': 'WB',
    'Hammerhead, Maggia Boss': 'B',
    'Scurry Oak': 'G',
    'Sadistic Glee': 'B',
  },
  combos: [{
    id: '2082-2921-4186',
    c: ['Scurry Oak', 'Sadistic Glee', 'Bartolomé del Presidio'],
    p: ['Infinite ETB'],
    i: 'WBG',
  }],
};

test('a deck holding the stand-in gets the combos its twin is published in', () => {
  const out = ComboSearch.matchAgainst(OUTLET_DATA, [
    { card: 'Hammerhead, Maggia Boss', quantity: 1 },
    { card: 'Scurry Oak', quantity: 1 },
    { card: 'Sadistic Glee', quantity: 1 },
  ]);
  assert.strictEqual(out.unofficial.length, 1);
  const row = out.unofficial[0];
  assert.deepStrictEqual(
    row.uses.map((u) => u.card.name).sort(),
    ['Hammerhead, Maggia Boss', 'Sadistic Glee', 'Scurry Oak']
  );
  // The evidence, read off the source combo rather than written down.
  assert.strictEqual(row.unofficial.from.id, '2082-2921-4186');
  assert.strictEqual(row.unofficial.swap.out, 'Bartolomé del Presidio');
  assert.strictEqual(row.unofficial.standIn, true);
  // Worked out from the cards: Hammerhead is mono-black where Bartolomé is not,
  // which is the whole reason a Golgari deck can run this line.
  assert.strictEqual(row.i || row.identity, 'BG');
  // And it stays out of the published count, which speaks for Spellbook.
  assert.strictEqual(out.included.length, 0);
});

test('a deck without the stand-in is told nothing extra', () => {
  const out = ComboSearch.matchAgainst(OUTLET_DATA, [
    { card: 'Bartolomé del Presidio', quantity: 1 },
    { card: 'Scurry Oak', quantity: 1 },
    { card: 'Sadistic Glee', quantity: 1 },
  ]);
  assert.strictEqual(out.included.length, 1);
  assert.deepStrictEqual(out.unofficial, []);
});

// The two halves of the unofficial match, which are the same rows asked a
// different question: what can this deck assemble, and what is it one card short
// of. Only the second feeds the suggestions, and only the first is a combo.
test('unofficial rows split into what the deck has and what it is one card from', () => {
  const data = {
    updatedAt: '2026-01-01T00:00:00Z',
    cardIdentity: {
      'Bartolomé del Presidio': 'WB', 'Hammerhead, Maggia Boss': 'B',
      'Scurry Oak': 'G', 'Sadistic Glee': 'B', 'Gravecrawler': 'B',
    },
    combos: [
      { id: '1-1-1', c: ['Scurry Oak', 'Sadistic Glee', 'Bartolomé del Presidio'], p: ['Infinite ETB'], i: 'WBG' },
      { id: '2-2-2', c: ['Gravecrawler', 'Bartolomé del Presidio'], p: ['Infinite death triggers'], i: 'WB' },
    ],
  };
  // Hammerhead plus one whole line, and one card short of the other.
  const out = ComboSearch.matchAgainst(data, [
    { card: 'Hammerhead, Maggia Boss', quantity: 1 },
    { card: 'Scurry Oak', quantity: 1 },
    { card: 'Sadistic Glee', quantity: 1 },
  ]);

  // Asserted by name rather than by count: matchAgainst reads the real
  // unofficial.js, so a hand-written row this deck happens to be one card short
  // of turns up here too, and it is not this test's business.
  const named = (rows, ...cards) => rows.find(
    (r) => r.uses.map((u) => u.card.name).sort().join('|') === cards.slice().sort().join('|')
  );

  const held = named(out.unofficial, 'Scurry Oak', 'Sadistic Glee', 'Hammerhead, Maggia Boss');
  assert.ok(held, 'the combo the deck can assemble is missing');
  assert.strictEqual(held.needs, undefined, 'a combo the deck has says it needs something');

  const nearly = out.unofficialAlmost.concat(out.unofficialAlmostByAddingColors);
  const short = named(nearly, 'Gravecrawler', 'Hammerhead, Maggia Boss');
  assert.ok(short, 'the near miss is missing');
  assert.deepStrictEqual(short.needs, ['Gravecrawler']);
  // A combo the deck has must not also be offered as a reason to add a card.
  assert.ok(!named(nearly, 'Scurry Oak', 'Sadistic Glee', 'Hammerhead, Maggia Boss'));
  // Mono-black card, black-green deck: in colour, split the same way the
  // published near-misses are.
  assert.ok(named(out.unofficialAlmost, 'Gravecrawler', 'Hammerhead, Maggia Boss'));
});

// The deck does not hold the stand-in at all, and the card worth suggesting is
// the stand-in itself. Hammerhead's whole case, and the reason the scan cannot
// simply skip a deck that does not run him.
test('a deck missing only the stand-in is told to add it', () => {
  const data = {
    updatedAt: '2026-01-01T00:00:00Z',
    cardIdentity: { 'Bartolomé del Presidio': 'WB', 'Hammerhead, Maggia Boss': 'B', Gravecrawler: 'B' },
    combos: [{ id: '2-2-2', c: ['Gravecrawler', 'Bartolomé del Presidio'], p: ['Infinite death triggers'], i: 'WB' }],
  };
  const out = ComboSearch.matchAgainst(data, [{ card: 'Gravecrawler', quantity: 1 }]);
  assert.deepStrictEqual(out.unofficial, []);
  const nearly = out.unofficialAlmost.concat(out.unofficialAlmostByAddingColors);
  assert.strictEqual(nearly.length, 1);
  assert.deepStrictEqual(nearly[0].needs, ['Hammerhead, Maggia Boss']);
});

// Graduation, for the half that was easy to get wrong: a row the deck is one card
// short of collides with the published combos that are also one card short, not
// with the ones it can assemble. Checked against the wrong set, the page would
// suggest a card twice — once on Spellbook's authority and once on ours.
test('a near-miss row Spellbook already publishes does not appear twice', () => {
  const data = {
    updatedAt: '2026-01-01T00:00:00Z',
    cardIdentity: { 'Bartolomé del Presidio': 'WB', 'Hammerhead, Maggia Boss': 'B', Gravecrawler: 'B' },
    combos: [
      { id: '2-2-2', c: ['Gravecrawler', 'Bartolomé del Presidio'], p: ['Infinite death triggers'], i: 'WB' },
      // Spellbook has caught up: the swap we would have proposed is published.
      { id: '3-3-3', c: ['Gravecrawler', 'Hammerhead, Maggia Boss'], p: ['Infinite death triggers'], i: 'B' },
    ],
  };
  const out = ComboSearch.matchAgainst(data, [{ card: 'Gravecrawler', quantity: 1 }]);
  const nearly = out.unofficialAlmost.concat(out.unofficialAlmostByAddingColors);
  assert.deepStrictEqual(
    nearly.map((r) => r.uses.map((u) => u.card.name).join(' + ')),
    [],
    'our copy of a published suggestion is still being offered'
  );
  // ...and Spellbook's own version is the one suggesting the card. Mono-black, so
  // it is in this deck's colours; the Bartolomé version is not and sits behind
  // the other tab.
  assert.deepStrictEqual(
    out.almostIncluded.map((r) => r.uses.map((u) => u.card.name).join(' + ')),
    ['Gravecrawler + Hammerhead, Maggia Boss']
  );
  assert.strictEqual(out.almostIncludedByAddingColors.length, 1);
});
