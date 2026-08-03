// Downloading the combo database and matching a deck against it.
//
// Kept out of app.js because neither job belongs on the thread drawing the page:
// the published file is ~9 MB of JSON and the database is ~100k combos, so
// parsing and matching it in the window means the window stops responding.
// search-worker.js imports this file and does both off-thread; index.html also
// loads it, so a browser with no Worker still has a way through (see app.js).
//
// Runs in a worker, in the page, and under Node (module.exports) so the parts
// that are just logic stay testable.
(function (global) {
  'use strict';

  const DeckCombos = global.DeckCombos || (typeof require === 'function' ? require('./combos.js') : null);
  // The handful of combos we believe in that Spellbook has not published. Loaded
  // the same way as the rest, and optional: if the file is missing the page shows
  // the official list and nothing else, rather than failing to search.
  const Unofficial = global.UnofficialCombos
    || (typeof require === 'function' ? require('./unofficial.js') : null);

  // Bumping the name is how a payload shape change abandons old copies: a cached
  // response from before a new field existed would otherwise be served forever.
  // v3: the payload now interns card names and result strings into two tables
  // (see DeckCombos.decode). A v2 copy has neither, and while decode() would pass
  // it through untouched, an old cached file is also three times the size for the
  // same data — so abandoning it is the point rather than a side effect.
  const CACHE_NAME = 'mtg-combo-finder-data-v3';
  // Which caches are ours to tidy up. Named by prefix rather than by listing the
  // old versions, so bumping the name above is the only step a shape change needs.
  const CACHE_PREFIX = 'mtg-combo-finder-data-';

  // Everything learned about a load, so a failure can be reported in full rather
  // than reduced to "it didn't work".
  let diagnostics = {};
  let dataset = null; // parsed once per worker, reused for every search

  // How long each third of a search took, in milliseconds, on the machine that
  // ran it. Collected because the alternative is guessing: the download is a few
  // MB, the parse builds tens of thousands of objects, and the match walks all of
  // them, and which of the three dominates depends entirely on the device. A
  // laptop says one thing and a five-year-old phone says another, and only one of
  // those is the reader.
  //
  // This is the number that says whether the data-side work is worth doing at
  // all. Kept beside the diagnostics rather than in a devtools trace, because the
  // machine worth measuring belongs to somebody who is not going to open one.
  //
  // performance.now() where there is one — a monotonic clock, unaffected by the
  // system time changing mid-search — and Date.now() under Node, where the tests
  // run and the precision does not matter.
  const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now());

  // Rounded on the way in. These are reported to a person, and a tenth of a
  // millisecond of a JSON parse is noise dressed as precision.
  const took = (from) => Math.round(now() - from);

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
  // *reading* the old one and leaves it on the reader's disk for good — a 26 MB
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
  // would otherwise refetch the whole file five minutes into a session — 1.7 MB
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
      // No download and no parse to report. The absence is the measurement: the
      // second search of a session is a walk over data already in hand, and a
      // zero here would read as "it was instant" rather than "it did not happen".
      return dataset;
    }

    const startedFetch = now();
    const raw = await fetchDatabase(url, diagnostics);
    diagnostics.msFetch = took(startedFetch);
    diagnostics.bytes = raw.length;

    const startedParse = now();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      diagnostics.responseSnippet = raw.slice(0, 400);
      diagnostics.likelyCause = 'The combo database is not valid JSON.';
      throw new Error('Could not read the combo database');
    }
    // Indices into the payload's two string tables become the strings themselves,
    // sharing one object per distinct value — 69 MB of heap becomes 35 MB, and no
    // other line in this file or in combos.js has to know. Counted inside the
    // parse timing on purpose: it is part of the cost of turning bytes into a
    // dataset, and reporting it separately would invite reading it as optional.
    DeckCombos.decode(parsed);
    diagnostics.msParse = took(startedParse);
    if (!parsed.combos || !parsed.combos.length) {
      diagnostics.likelyCause = 'The combo database downloaded but contains no combos.';
      throw new Error('Combo database is empty');
    }
    dataset = parsed;
    diagnostics.loaded = `${dataset.combos.length} combos, updated ${dataset.updatedAt || 'unknown'}`;
    return dataset;
  }

  // Match a deck and hand back only what the page draws. The dataset itself
  // stays here: posting the whole dataset back to the window every search would undo the
  // point of doing the work off-thread.
  function matchAgainst(data, entries) {
    const deckNames = DeckCombos.deckNameSet(entries);
    const matched = DeckCombos.matchDeck(data, deckNames, entries);
    const included = matched.included.map(DeckCombos.expand);

    // The unofficial rows are matched against the deck after the published ones,
    // and with one card of slack: a row the deck can assemble is a combo it has,
    // and a row it is one card short of is a reason to add that card. Both come
    // out of the same call, split here on what each turned out to need.
    //
    // Checked against the published combos it could conflict with, which is not
    // the same set for the two halves — a row the deck can assemble graduates
    // against `included`, while one it is a card short of graduates against the
    // combos that are also a card short. Handing the wrong set to either would
    // print our copy of something Spellbook already says.
    const rows = ((Unofficial && Unofficial.COMBOS) || []).concat(
      // Hand-written rows go first: where both name the same cards,
      // matchUnofficial() keeps the first, and a row somebody reasoned about by
      // name beats the same row produced by a rule.
      DeckCombos.standInRows(data, (Unofficial && Unofficial.STAND_INS) || [], deckNames, entries, 1)
    );
    const unofficial = DeckCombos.matchUnofficial(data, rows, deckNames, matched.included);
    const nearly = DeckCombos.matchUnofficial(
      data,
      rows,
      deckNames,
      matched.included
        .concat(matched.almostIncluded)
        .concat(matched.almostIncludedByAddingColors),
      1
    ).filter((row) => row.needs);
    const inColour = (row) => DeckCombos.withinIdentity(row, matched.identity);

    return {
      meta: {
        updatedAt: data.updatedAt || null,
        count: data.combos.length,
        source: diagnostics.source || null,
      },
      identity: matched.identity,
      // The Game Changer list lives in the dataset, and the dataset stays here —
      // so the bracket is worked out beside the match rather than in the page.
      // Deliberately `included` and not the unofficial rows: the bracket is a
      // claim about what a deck is allowed to be, and it should rest on what
      // Spellbook has published rather than on a swap we worked out ourselves.
      bracket: DeckCombos.bracketCheck(data, deckNames, included),
      included,
      unofficial: unofficial.map(DeckCombos.expand),
      // Split on colour the same way the published near-misses are, so a card the
      // deck could not legally run lands behind the same tab either way.
      unofficialAlmost: nearly.filter(inColour).map(DeckCombos.expand),
      unofficialAlmostByAddingColors: nearly.filter((r) => !inColour(r)).map(DeckCombos.expand),
      almostIncluded: matched.almostIncluded.map(DeckCombos.expand),
      almostIncludedByAddingColors: matched.almostIncludedByAddingColors.map(DeckCombos.expand),
    };
  }

  // url: where combos.json lives. entries: every card in the deck, commanders
  // included, as { card, quantity } — the shape DeckParser produces.
  async function run(url, entries) {
    diagnostics = { endpoint: url, method: 'GET' };
    const started = now();
    const data = await loadDataset(url);
    const startedMatch = now();
    const out = matchAgainst(data, entries);
    diagnostics.msMatch = took(startedMatch);
    // Not the sum of the three: the total is what the reader waited, and the
    // difference between it and the parts is worth being able to see rather than
    // arithmetic away.
    diagnostics.msTotal = took(started);
    out.meta.timing = {
      fetch: diagnostics.msFetch,
      parse: diagnostics.msParse,
      match: diagnostics.msMatch,
      total: diagnostics.msTotal,
      bytes: diagnostics.bytes,
    };
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
