// Downloading the combo database and matching a deck against it.
//
// Kept out of app.js because neither job belongs on the thread drawing the page:
// the published file is ~25 MB of JSON and the database is ~100k combos, so
// parsing and matching it in the window means the window stops responding.
// search-worker.js imports this file and does both off-thread; index.html also
// loads it, so a browser with no Worker still has a way through (see app.js).
//
// Runs in a worker, in the page, and under Node (module.exports) so the parts
// that are just logic stay testable.
(function (global) {
  'use strict';

  const DeckCombos = global.DeckCombos || (typeof require === 'function' ? require('./combos.js') : null);

  // Bumping the name is how a payload shape change abandons old copies: a cached
  // response from before a new field existed would otherwise be served forever.
  const CACHE_NAME = 'mtg-combo-finder-data-v2';
  // Which caches are ours to tidy up. Named by prefix rather than by listing the
  // old versions, so bumping the name above is the only step a shape change needs.
  const CACHE_PREFIX = 'mtg-combo-finder-data-';

  // Everything learned about a load, so a failure can be reported in full rather
  // than reduced to "it didn't work".
  let diagnostics = {};
  let dataset = null; // parsed once per worker, reused for every search

  const caches = () => (global.caches && typeof global.caches.open === 'function' ? global.caches : null);

  // Cache Storage is a nicety, never a requirement: private mode, a full disk
  // and an insecure origin all take it away, and none of them should stop a
  // search. Every call here is allowed to fail silently.
  //
  // It is also allowed to never answer at all, which is the part worth writing
  // down: under a headless Chrome running on a virtual clock, `caches.open()`
  // returns a promise that stays pending forever. Awaiting one on the way to the
  // data means a page that loads, says "Downloading…" and never finishes — a
  // worse failure than not caching at all. So every cache call is raced against
  // a deadline, and a cache that is slow is treated as a cache that is absent.
  let cacheDeadlineMs = 1500;

  function withDeadline(promise, fallback) {
    return Promise.race([
      Promise.resolve(promise).catch(() => fallback),
      new Promise((resolve) => setTimeout(() => resolve(fallback), cacheDeadlineMs)),
    ]);
  }

  // Abandoning a copy is not the same as deleting it. Bumping CACHE_NAME stops us
  // *reading* the old one and leaves it on the reader's disk for good — a ~28 MB
  // orphan, per shape change, that nothing will ever ask for again. So every
  // cache of ours that is not the current one is dropped.
  //
  // Housekeeping, and treated like it: once per worker, never awaited, never on
  // the path to the data, and every failure ignored. A browser that will not let
  // us tidy up is not a browser that should fail a search.
  let tidied = false;
  function dropStaleCaches(store) {
    if (tidied || typeof store.keys !== 'function' || typeof store.delete !== 'function') return;
    tidied = true;
    let listing;
    try {
      listing = store.keys();
    } catch (err) {
      return; // a browser that will not list its caches still gets to use one
    }
    withDeadline(listing, []).then((names) => {
      for (const name of names || []) {
        // Only ours, and only the ones this version has stopped reading.
        if (String(name) === CACHE_NAME || !String(name).startsWith(CACHE_PREFIX)) continue;
        try {
          Promise.resolve(store.delete(name)).catch(() => {});
        } catch (err) {
          /* nothing to do about it, and nothing depends on it */
        }
      }
    }, () => {});
  }

  function openCache() {
    const store = caches();
    if (!store) return Promise.resolve(null);
    try {
      // Started alongside the open rather than before it, so a slow tidy-up
      // cannot delay the search it is tidying up after.
      dropStaleCaches(store);
      return withDeadline(store.open(CACHE_NAME), null);
    } catch (err) {
      return Promise.resolve(null);
    }
  }

  // Ask whether the copy we hold is still current, without downloading it again.
  // raw.githubusercontent.com sends `cache-control: max-age=300`, so the browser
  // would otherwise refetch the whole file five minutes into a session — 2.9 MB
  // on the wire to learn that a once-a-day cron has not run since.
  async function revalidate(cache, url, held) {
    try {
      const etag = held.headers.get('etag');
      const res = await fetch(url, {
        cache: 'no-store',
        headers: etag ? { 'If-None-Match': etag } : {},
      });
      if (res.status === 304 || !res.ok) return; // unchanged, or not worth acting on
      await cache.put(url, res.clone());
    } catch (err) {
      /* offline, or the etag went away — the copy we have is still good */
    }
  }

  // The database as text, plus where it came from. A cached copy is used as-is
  // and checked in the background: the refresh runs once a day, so serving the
  // copy in hand and picking the new one up on the next visit costs nothing a
  // reader would notice, and it makes a repeat visit free.
  async function fetchDatabase(url, diag) {
    const cache = await openCache();
    if (cache) {
      let held = null;
      try {
        held = await withDeadline(cache.match(url), null);
      } catch (err) {
        held = null;
      }
      if (held) {
        diag.source = 'cache';
        const text = await held.text();
        revalidate(cache, url, held); // deliberately not awaited
        return text;
      }
    }

    diag.source = 'network';
    let res;
    try {
      res = await fetch(url, { cache: 'default' });
    } catch (networkErr) {
      diag.error = networkErr.name + ': ' + networkErr.message;
      diag.likelyCause = /^https?:/.test(url)
        ? 'Could not download the combo database. Check your connection, or whether the data branch has been published yet.'
        : 'No local combos.json. Run: node tools/fetch-combos.js';
      throw networkErr;
    }

    diag.status = res.status;
    diag.statusText = res.statusText;
    if (!res.ok) {
      diag.likelyCause = res.status === 404
        ? 'The combo database has not been published yet — run the "Update combo data" workflow.'
        : 'The combo database could not be downloaded.';
      throw Object.assign(new Error('Combo database returned HTTP ' + res.status), { status: res.status });
    }

    // Storing is never awaited: it is next visit's problem, and this visit is
    // holding a parse it could be getting on with.
    if (cache) {
      try {
        Promise.resolve(cache.put(url, res.clone())).catch(() => {});
      } catch (err) {
        /* over quota, or an origin that forbids it — the search still works */
      }
    }
    return res.text();
  }

  async function loadDataset(url) {
    if (dataset) {
      diagnostics.source = 'memory';
      return dataset;
    }

    const raw = await fetchDatabase(url, diagnostics);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      diagnostics.responseSnippet = raw.slice(0, 400);
      diagnostics.likelyCause = 'The combo database is not valid JSON.';
      throw new Error('Could not read the combo database');
    }
    if (!parsed.combos || !parsed.combos.length) {
      diagnostics.likelyCause = 'The combo database downloaded but contains no combos.';
      throw new Error('Combo database is empty');
    }
    dataset = parsed;
    diagnostics.loaded = `${dataset.combos.length} combos, updated ${dataset.updatedAt || 'unknown'}`;
    return dataset;
  }

  // Match a deck and hand back only what the page draws. The dataset itself
  // stays here: posting 25 MB back to the window every search would undo the
  // point of doing the work off-thread.
  function matchAgainst(data, entries) {
    const deckNames = DeckCombos.deckNameSet(entries);
    const matched = DeckCombos.matchDeck(data, deckNames, entries);
    const included = matched.included.map(DeckCombos.expand);
    return {
      meta: {
        updatedAt: data.updatedAt || null,
        count: data.combos.length,
        source: diagnostics.source || null,
      },
      identity: matched.identity,
      // The Game Changer list lives in the dataset, and the dataset stays here —
      // so the bracket is worked out beside the match rather than in the page.
      bracket: DeckCombos.bracketCheck(data, deckNames, included),
      included,
      oneSlotAway: matched.oneSlotAway.map(DeckCombos.expand),
      slotCandidates: matched.slotCandidates,
      almostIncluded: matched.almostIncluded.map(DeckCombos.expand),
      almostIncludedByAddingColors: matched.almostIncludedByAddingColors.map(DeckCombos.expand),
    };
  }

  // url: where combos.json lives. entries: every card in the deck, commanders
  // included, as { card, quantity } — the shape DeckParser produces.
  async function run(url, entries) {
    diagnostics = { endpoint: url, method: 'GET' };
    const data = await loadDataset(url);
    const out = matchAgainst(data, entries);
    out.diagnostics = diagnostics;
    return out;
  }

  const api = {
    run,
    matchAgainst,
    diagnostics: () => diagnostics,
    CACHE_NAME,
    // Test support. The dataset is deliberately kept for the life of the worker,
    // and the deadline is deliberately long enough not to fire on a real cache —
    // neither of which suits a test suite that runs a dozen loads in a second.
    reset(options) {
      dataset = null;
      diagnostics = {};
      tidied = false;
      if (options && typeof options.cacheDeadlineMs === 'number') cacheDeadlineMs = options.cacheDeadlineMs;
    },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.ComboSearch = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
