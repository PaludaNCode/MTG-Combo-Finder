'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { CANDIDATES, probe, ORIGIN } = require('../tools/probe-cors.js');

// The tool asks live third parties a question, so what can be tested here is its
// judgement rather than its answers: given a response, does it decide correctly
// whether a browser could have read it? That judgement is the whole tool — get it
// backwards and a site gets an adapter that can never work, which is the Moxfield
// mistake with extra steps.

const respond = (headers, status) => ({
  status: status || 200,
  headers: { get: (k) => (Object.prototype.hasOwnProperty.call(headers, k) ? headers[k] : null) },
});

async function verdictFor(headers, status) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => respond(headers, status);
  try {
    return await probe({ site: 'x', url: 'https://example.test/' });
  } finally {
    globalThis.fetch = original;
  }
}

test('a wildcard allows a browser to read it', async () => {
  const got = await verdictFor({ 'access-control-allow-origin': '*' });
  assert.strictEqual(got.readable, true);
});

test('an exact echo of our origin allows it too', async () => {
  assert.strictEqual((await verdictFor({ 'access-control-allow-origin': ORIGIN })).readable, true);
  assert.strictEqual((await verdictFor({ 'access-control-allow-origin': ORIGIN.toUpperCase() })).readable, true);
});

// The Moxfield case: the request succeeds, the body is fine, and the browser
// throws it away. A tool that reported this as usable would be worse than none.
test('no header at all is refused, however healthy the response', async () => {
  const got = await verdictFor({}, 200);
  assert.strictEqual(got.readable, false);
  assert.strictEqual(got.allow, null);
});

test('a header naming somebody else is refused', async () => {
  assert.strictEqual((await verdictFor({ 'access-control-allow-origin': 'https://example.com' })).readable, false);
  assert.strictEqual((await verdictFor({ 'access-control-allow-origin': 'null' })).readable, false);
});

// CORS headers come back on error responses too, which is the whole reason the
// probe does not need real deck ids to answer the question.
test('a 404 still answers the CORS question', async () => {
  const got = await verdictFor({ 'access-control-allow-origin': '*' }, 404);
  assert.strictEqual(got.status, 404);
  assert.strictEqual(got.readable, true, 'the deck is missing; the site would still let us read one');
});

test('a network failure is reported, not counted as a refusal', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('getaddrinfo ENOTFOUND'); };
  try {
    const got = await probe({ site: 'x', url: 'https://example.test/' });
    assert.match(got.error, /ENOTFOUND/);
    assert.strictEqual(got.readable, undefined, 'no verdict, rather than a false one');
  } finally {
    globalThis.fetch = original;
  }
});

// Without both controls a run cannot tell "this site refuses" from "the probe is
// broken" — which matters because it runs on a network nobody is watching.
test('the candidate list carries both controls', () => {
  const sites = CANDIDATES.map((c) => c.site);
  assert.ok(sites.includes('archidekt'), 'the must-be-allowed control');
  assert.ok(sites.includes('moxfield'), 'the must-be-refused control');
  for (const c of CANDIDATES) {
    assert.match(c.url, /^https:\/\//, c.site + ' is probed over https');
    assert.ok(c.what, c.site + ' says what it is');
  }
});

test('the origin probed is the deployed page, not localhost', () => {
  assert.strictEqual(ORIGIN, 'https://paludancode.github.io');
});
