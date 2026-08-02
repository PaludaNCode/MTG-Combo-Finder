'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Source = require('../steps-source.js');

// steps-source.js is half of a contract with tools/fetch-combos.js: the publisher
// writes to pathFor() and the page reads from it. Both import this module, so the
// tests that matter here are the ones about the path itself and about what the
// reader does with each answer it can get back.

// ---- the path --------------------------------------------------------------

test('pathFor: the id is in the URL, which is the whole design', () => {
  const at = Source.pathFor('2290-2919');
  assert.match(at, /^steps\/[0-9a-f]{2}\/2290-2919\.json$/);
  assert.strictEqual(Source.pathFor('2290-2919'), at, 'and it is stable');
});

test('bucketOf: every bucket is two lowercase hex digits, 0..255', () => {
  for (const id of ['1', '2290-2919', '215-579--85--181', '99999-1-2-3']) {
    const n = Source.bucketOf(id);
    assert.ok(Number.isInteger(n) && n >= 0 && n < Source.BUCKETS, id + ' → ' + n);
    assert.match(Source.pathFor(id), /\/[0-9a-f]{2}\//);
  }
});

// The publisher makes 256 directories and the reader picks one of them. If those
// two numbers ever disagree the reader asks for a directory that was never
// created, so the count is pinned rather than left as a coincidence.
test('bucketOf: never lands outside the directories the publisher creates', () => {
  const seen = new Set();
  for (let i = 0; i < 20000; i += 1) seen.add(Source.bucketOf(i + '-' + (i * 7)));
  assert.strictEqual(seen.size, Source.BUCKETS, 'every bucket is reachable');
});

// Measured against all 103,737 real ids in the published snapshot: min 345,
// median 404, max 465 — a spread of 1.15. This is the same shape of check on
// synthetic ids, loose enough not to be brittle and tight enough to catch a hash
// that has stopped mixing at all.
test('bucketOf: spreads combo ids evenly enough', () => {
  const counts = new Array(Source.BUCKETS).fill(0);
  const total = 51200; // 200 per bucket if perfect
  for (let i = 0; i < total; i += 1) counts[Source.bucketOf(i + '-' + ((i * 7) % 9000))] += 1;
  counts.sort((a, b) => a - b);
  const median = counts[Source.BUCKETS >> 1];
  assert.ok(counts[0] > 0, 'no empty bucket');
  assert.ok(counts[counts.length - 1] / median < 1.5,
    `worst bucket ${counts[counts.length - 1]} vs median ${median}`);
});

// An id becomes a filename in the publisher and a URL path in the page. Both
// failures are worse than "no steps", so both ends refuse rather than sanitise.
test('isSafeId: only Spellbook-shaped ids, and pathFor refuses the rest', () => {
  for (const good of ['1', '2290-2919', '1110-4694-7839--112', '215-579--85--181']) {
    assert.ok(Source.isSafeId(good), good);
    assert.ok(Source.pathFor(good), good);
  }
  for (const bad of ['../../etc/passwd', 'a/b', '2290 2919', '', null, undefined,
    'no-such-combo', '2290-2919.json', '-1', '1-']) {
    assert.ok(!Source.isSafeId(bad), String(bad));
    assert.strictEqual(Source.pathFor(bad), null, String(bad));
  }
});

// ---- the reader ------------------------------------------------------------

const ok = (body) => ({ status: 200, ok: true, json: async () => body });

test('reader: a combo with steps comes back as Spellbook\'s own shape', async () => {
  const asked = [];
  const read = Source.reader({
    base: 'https://example.test/data/',
    fetch: async (url) => { asked.push(url); return ok({ id: '2290-2919', description: 'Do the thing.' }); },
  });
  const got = await read('2290-2919');
  assert.deepStrictEqual(got, { id: '2290-2919', description: 'Do the thing.' });
  assert.strictEqual(asked.length, 1, 'one request, which is the point of the design');
  assert.strictEqual(asked[0], 'https://example.test/data/' + Source.pathFor('2290-2919'));
});

// The absence of a file is the answer, not a failure — it is what stands in for
// the index this design deliberately does not have.
test('reader: 404 means "no steps recorded", not an error', async () => {
  const read = Source.reader({ fetch: async () => ({ status: 404, ok: false }) });
  assert.strictEqual(await read('2290-2919'), null);
});

test('reader: a real failure throws, so combo-steps.js can offer a retry', async () => {
  const read = Source.reader({ fetch: async () => ({ status: 503, ok: false }) });
  await assert.rejects(() => read('2290-2919'), /HTTP 503/);
});

// The id is in the URL, so this can only fire if a file was published to the
// wrong path. It is still checked: the alternative is the page confidently
// printing another combo's instructions, which no test and no reader would catch.
test('reader: a record whose id disagrees with the URL is refused, not shown', async () => {
  const read = Source.reader({ fetch: async () => ok({ id: '1-2', description: 'Someone else\'s.' }) });
  await assert.rejects(() => read('2290-2919'), /holds 1-2/);
});

test('reader: an id that is not a safe filename is never requested', async () => {
  let asked = 0;
  const read = Source.reader({ fetch: async () => { asked += 1; return ok({}); } });
  assert.strictEqual(await read('../../secrets'), null);
  assert.strictEqual(asked, 0);
});

test('reader: a body that is not an object is "no steps" rather than a crash', async () => {
  const read = Source.reader({ fetch: async () => ({ status: 200, ok: true, json: async () => null }) });
  assert.strictEqual(await read('1-2'), null);
});

// A request that never answers leaves the panel saying "Looking up the steps…"
// for ever, with no way back — worse than a failure, which at least offers a
// retry. So it is given a deadline and the abort is what ends it.
test('reader: a request that never answers is aborted', async () => {
  const read = Source.reader({
    timeoutMs: 20,
    fetch: (url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }),
  });
  await assert.rejects(() => read('1-2'), /aborted/);
});

// Cleared on the way out, or a page that opened twenty panels would hold twenty
// pending timers for ten seconds each.
test('reader: the deadline does not outlive the request', async () => {
  let aborted = false;
  const read = Source.reader({
    timeoutMs: 10,
    fetch: async (url, init) => {
      init.signal.addEventListener('abort', () => { aborted = true; });
      return ok({ id: '1-2' });
    },
  });
  await read('1-2');
  await new Promise((r) => setTimeout(r, 40));
  assert.strictEqual(aborted, false, 'the timer was cleared when the answer arrived');
});

// A browser with no fetch should lose the panel, not the page. Node 22 has one,
// so an explicit null is how a test stands in for an environment that does not.
test('reader: no fetch to call is "no steps", not a thrown ReferenceError', async () => {
  assert.strictEqual(await Source.reader({ fetch: null })('1-2'), null);
});

// Omitting the option is the production path: the page's own fetch.
test('reader: left alone, it uses the environment\'s fetch', async () => {
  const original = globalThis.fetch;
  let asked = null;
  globalThis.fetch = async (url) => { asked = url; return ok({ id: '1-2' }); };
  try {
    assert.deepStrictEqual(await Source.reader({ base: '/d/' })('1-2'), { id: '1-2' });
    assert.strictEqual(asked, '/d/' + Source.pathFor('1-2'));
  } finally {
    globalThis.fetch = original;
  }
});

// Headers can come back promptly on a connection that then stalls, and the panel
// cannot tell that apart from a slow request — it just keeps saying "Looking up
// the steps…". So the deadline covers reading the body, not only reaching it.
test('reader: the deadline covers the body, not just the headers', async () => {
  const read = Source.reader({
    timeoutMs: 20,
    fetch: async (url, init) => ({
      status: 200,
      ok: true,
      json: () => new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted mid-body')));
      }),
    }),
  });
  await assert.rejects(() => read('1-2'), /aborted mid-body/);
});
