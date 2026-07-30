'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { resolveTemplates, MAX_PAGES } = require('../tools/templates.js');

// The resolver only talks to the network, so it is tested by standing in for
// the network. Everything that matters here is failure behaviour: what happens
// to a template that 503s, that pages forever, or that comes back empty. Those
// are the cases that decide whether a combo is claimed or excluded, and none of
// them can be reproduced by pointing at the real Scryfall.

const reply = (body, init = {}) => ({
  ok: init.status ? init.status >= 200 && init.status < 300 : true,
  status: init.status || 200,
  headers: { get: (k) => (init.headers || {})[k.toLowerCase()] ?? null },
  json: async () => body,
});

const template = (id, name) => ({ id, name, scryfallQuery: 'q', scryfallApi: `https://api/${id}` });
const page = (names, next) => reply({ data: names.map((name) => ({ name })), has_more: Boolean(next), next_page: next });

// Runs resolveTemplates() against a routing table of url -> handler, with the
// backoff waits collapsed so a retry test does not take 15 seconds.
async function withStub(templates, routes, run) {
  const realFetch = globalThis.fetch;
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realTimeout(fn, 0);
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (String(url).includes('/templates/')) return reply({ results: templates, next: null });
    const handler = routes[String(url)];
    if (!handler) throw new Error('unstubbed url ' + url);
    return handler(calls.filter((c) => String(c) === String(url)).length);
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = realFetch;
    globalThis.setTimeout = realTimeout;
  }
}

const quiet = () => {};

test('a template becomes the list of cards that fill it, keyed for lookup', async () => {
  await withStub(
    [template(7, 'Persist Creature')],
    { 'https://api/7': () => page(['Kitchen Finks', 'Murderous Redcap']) },
    async () => {
      const { templates, templateCards } = await resolveTemplates(quiet);
      assert.deepStrictEqual({ ...templates }, { 7: 'Persist Creature' });
      assert.deepStrictEqual(templateCards['kitchen finks'], [7]);
      assert.deepStrictEqual(templateCards['murderous redcap'], [7]);
    }
  );
});

test('card keys match how a decklist is read, front face and lowercase', async () => {
  await withStub(
    [template(7, 'Persist Creature')],
    { 'https://api/7': () => page(['Valki, God of Lies // Tibalt, Cosmic Impostor']) },
    async () => {
      const { templateCards } = await resolveTemplates(quiet);
      assert.deepStrictEqual(Object.keys(templateCards), ['valki, god of lies']);
    }
  );
});

test('every page is followed, and a card repeated across pages is counted once', async () => {
  await withStub(
    [template(7, 'Persist Creature')],
    {
      'https://api/7': () => page(['Kitchen Finks'], 'https://api/7?p=2'),
      'https://api/7?p=2': () => page(['Kitchen Finks', 'Murderous Redcap']),
    },
    async () => {
      const { templateCards } = await resolveTemplates(quiet);
      assert.deepStrictEqual(templateCards['kitchen finks'], [7]);
      assert.equal(Object.keys(templateCards).length, 2);
    }
  );
});

test('a transient failure is waited out rather than recorded as an empty template', async () => {
  await withStub(
    [template(7, 'Persist Creature')],
    { 'https://api/7': (n) => (n === 1 ? reply(null, { status: 503 }) : page(['Kitchen Finks'])) },
    async () => {
      const { templates, templateCards, stats } = await resolveTemplates(quiet);
      assert.deepStrictEqual({ ...templates }, { 7: 'Persist Creature' });
      assert.deepStrictEqual(templateCards['kitchen finks'], [7]);
      assert.equal(stats.retries, 1);
    }
  );
});

test('a template that keeps failing is dropped, and the rest still resolve', async () => {
  await withStub(
    [template(7, 'Persist Creature'), template(9, 'Free Sacrifice Outlet')],
    {
      'https://api/7': () => reply(null, { status: 503 }),
      'https://api/9': () => page(['Carrion Feeder']),
    },
    async () => {
      const { templates, templateCards, stats } = await resolveTemplates(quiet);
      // Dropped, not half-published: an unresolved template excludes its combos.
      assert.deepStrictEqual({ ...templates }, { 9: 'Free Sacrifice Outlet' });
      assert.deepStrictEqual(Object.keys(templateCards), ['carrion feeder']);
      assert.equal(stats.failed.length, 1);
      assert.match(stats.failed[0].why, /503/);
    }
  );
});

// A truncated list is worse than no list: it would quietly under-report combos
// with nothing to show that anything went wrong.
test('a template that pages past the guard is dropped, not published half-resolved', async () => {
  await withStub(
    [template(7, 'Persist Creature')],
    { 'https://api/7': () => page(['Kitchen Finks'], 'https://api/7') },
    async (calls) => {
      const { templates, templateCards, stats } = await resolveTemplates(quiet);
      assert.deepStrictEqual({ ...templates }, {});
      assert.deepStrictEqual({ ...templateCards }, {});
      assert.match(stats.failed[0].why, new RegExp(String(MAX_PAGES)));
      assert.equal(calls.filter((c) => String(c) === 'https://api/7').length, MAX_PAGES);
    }
  );
});

test('a template with no query is never requested', async () => {
  await withStub(
    [{ id: 3, name: 'Haste Enabler', scryfallQuery: null, scryfallApi: null }],
    {},
    async (calls) => {
      const { templates } = await resolveTemplates(quiet);
      assert.deepStrictEqual({ ...templates }, {});
      assert.equal(calls.filter((c) => !String(c).includes('/templates/')).length, 0);
    }
  );
});

test('a query matching nothing is not an error, but yields no template', async () => {
  await withStub(
    [template(7, 'Persist Creature')],
    { 'https://api/7': () => reply(null, { status: 404 }) },
    async () => {
      const { templates, stats } = await resolveTemplates(quiet);
      assert.deepStrictEqual({ ...templates }, {});
      assert.deepStrictEqual(stats.failed, []);
    }
  );
});
