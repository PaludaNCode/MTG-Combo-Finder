// The service worker: serves the shell offline.
//
// The data already survives going offline and the page did not, which was the wrong
// way round for a tool you would use at a table with bad wifi. A reader who has
// searched once holds the whole snapshot on the device — search.js keeps it in Cache
// Storage under its own name — and then plane mode failed on index.html, so none of
// it was reachable.
//
// Why this repository can run one safely. The classic service-worker failure is
// shipping an update nobody receives, and the machinery against that was already here:
// tools/stamp-assets.js rewrites every local `src=`/`href=` to carry `?v=<commit sha>`
// at deploy time, so every asset URL is immutable and every deploy mints a fresh set.
// A cache-first worker over immutable URLs cannot serve a half-updated mix.
//
// THE ASYMMETRY, which is not a simplification waiting to be made: index.html is
// deliberately *not* stamped, because it is the document that carries the new stamps
// and has to stay cacheable-but-fresh. So the HTML is network-first and everything
// else is cache-first. A cache-first HTML would pin a reader to one deploy forever —
// the exact bug the stamping exists to prevent, reintroduced one layer up.
//
// And the same reasoning extends past the HTML: **cache-first is only for URLs that
// carry a stamp.** A bare `app.js` is not immutable — it is what this page is served
// as locally, in `npm run verify`, and under `npm run test:ui` — so trusting one from
// the cache would mean editing a file and being served yesterday's for as long as the
// cache lived. Stamped is immutable and cached hard; unstamped is asked for and only
// falls back to the cache when the network cannot answer. Both are stored either way,
// which is what makes an unstamped local page work offline too.
//
// Runs as a service worker in a browser and as a plain module under Node, so the
// decision below — which strategy a request gets — is unit-testable without a browser.
// That decision is the whole worker; everything else is plumbing around it.
(function (global) {
  'use strict';

  // Replaced at deploy time, alongside the shell list below, by
  // tools/stamp-assets.js. `dev` locally, which is correct: an unstamped page gets
  // network-first for everything and never needs a cache name to change.
  const BUILD = 'dev';

  const CACHE_NAME = 'mtg-combo-finder-shell-' + BUILD;
  // Ours to tidy up. By prefix rather than by listing old builds, so a new build is
  // the only thing a deploy has to change.
  const CACHE_PREFIX = 'mtg-combo-finder-shell-';

  // The shell. tools/stamp-assets.js rewrites this array at deploy time from the same
  // localAssets() walk that stamps the pages, so adding a <script> to a page is still
  // just adding a <script> to a page — there is no list here to keep in step.
  //
  // Everything below the two pages is a placeholder for local use, where nothing is
  // stamped and the runtime cache does the work anyway.
  // __SHELL_START__
  const SHELL = [
    './',
    'index.html',
    'tiers.html',
  ];
  // __SHELL_END__

  // The three files no `src=` in either page references, so the walk above cannot see
  // them: search-worker.js is constructed in app.js, and it and the no-Worker fallback
  // path load unofficial.js and search.js themselves. Precached explicitly, because
  // the alternative is a reader whose Worker failed being handed a page that cannot
  // search — the one part of going offline that would look like a bug rather than a
  // limit. test/service-worker.test.js reads the names back out of app.js and
  // search-worker.js and fails if this list stops covering them, which is the drift
  // that would otherwise be invisible.
  const NOT_IN_THE_HTML = [
    'search-worker.js',
    'result-tiers.js',
    'combos.js',
    'unofficial.js',
    'search.js',
  ];

  // What is not ours. The combo payload lives on raw.githubusercontent.com and
  // search.js owns it — its own versioned cache, its own revalidation, its own
  // deadline discipline. Two caching layers over one URL is the kind of thing that
  // looks fine until they disagree about which copy is current, so this one does not
  // touch it. Named as well as being cross-origin, because the test harnesses serve
  // the fixture from their own origin and must not start depending on that.
  const NOT_OURS = /(?:^|\/)combos(?:-tiers)?\.json$|(?:^|\/)steps\//;

  // Which strategy a request gets, as a pure function of the request. The whole
  // worker, and the reason this file is requirable under Node: "the HTML is never
  // served stale" is the property that makes a fresh deploy visible at all, and it is
  // worth a test that does not need a deploy to run.
  //
  //   'skip'          not ours — let the network have it, uncached
  //   'network-first' ask, fall back to the cache: HTML, and anything unstamped
  //   'cache-first'   an immutable URL, so the cache is as good as the network
  function strategyFor(request) {
    if (!request || (request.method && request.method !== 'GET')) return 'skip';
    let url;
    try {
      url = new URL(request.url, global.location ? global.location.href : 'https://example.invalid');
    } catch (err) {
      return 'skip';
    }
    const here = global.location ? global.location.origin : null;
    if (here && url.origin !== here) return 'skip';
    if (NOT_OURS.test(url.pathname)) return 'skip';
    // A navigation is the document, whatever it is called. `mode` is the honest test
    // and the extension is the fallback for a request object without one.
    if (request.mode === 'navigate' || /\.html?$/i.test(url.pathname) || url.pathname.endsWith('/')) {
      return 'network-first';
    }
    return /(?:^|&|\?)v=[^&]/.test(url.search) ? 'cache-first' : 'network-first';
  }

  // ---- the plumbing ---------------------------------------------------------

  function put(cache, request, response) {
    // Only a real answer, and only a basic one: an opaque cross-origin response has
    // no status to read, and caching an error page is how a site serves its own 404
    // for a week.
    if (!response || !response.ok || (response.type && response.type !== 'basic')) return response;
    try {
      cache.put(request, response.clone());
    } catch (err) {
      /* a full disk is not a reason to fail the request */
    }
    return response;
  }

  async function networkFirst(cache, request) {
    try {
      return put(cache, request, await fetch(request));
    } catch (err) {
      const held = await cache.match(request);
      if (held) return held;
      // Nothing in hand and no network. For a navigation, the shell we do have is a
      // better answer than the browser's offline page — this is a static tool, and
      // index.html is every page of it.
      if (request.mode === 'navigate') {
        const shell = await cache.match('index.html') || await cache.match('./');
        if (shell) return shell;
      }
      throw err;
    }
  }

  async function cacheFirst(cache, request) {
    const held = await cache.match(request);
    if (held) return held;
    return put(cache, request, await fetch(request));
  }

  async function handle(request) {
    const cache = await global.caches.open(CACHE_NAME);
    return strategyFor(request) === 'cache-first'
      ? cacheFirst(cache, request)
      : networkFirst(cache, request);
  }

  // One at a time and failures ignored, rather than cache.addAll(), which rejects the
  // whole install if a single URL 404s. A shell missing one file still works; an
  // install that failed leaves the reader with no worker at all, and the difference
  // matters most in exactly the case that causes it — a stale list after a rename.
  // The stamp the page itself would ask for. The five files above are requested from
  // JS with `?v=<build>` appended (see ASSET_VERSION in app.js), so precaching them
  // bare would warm URLs nobody asks for and leave the real ones to a cold fetch.
  // `dev` means nothing is stamped, which is what an unstamped page requests.
  const stamped = (url) => (BUILD === 'dev' ? url : url + '?v=' + BUILD);

  async function precache() {
    const cache = await global.caches.open(CACHE_NAME);
    await Promise.all(SHELL.concat(NOT_IN_THE_HTML.map(stamped)).map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        put(cache, url, res);
      } catch (err) {
        /* it will be cached on first use, or it is gone and the page will say so */
      }
    }));
  }

  async function dropOldCaches() {
    const names = await global.caches.keys();
    await Promise.all(names.map((name) => (
      name !== CACHE_NAME && name.startsWith(CACHE_PREFIX)
        ? global.caches.delete(name)
        : null
    )));
  }

  // Registered only in a real service worker. `self.registration` is what says so —
  // under Node this file is a module and must not try to listen for anything.
  if (global.registration && typeof global.addEventListener === 'function') {
    global.addEventListener('install', (event) => {
      // Straight past `waiting`. Safe here precisely because of the asymmetry at the
      // top of this file: assets are immutable, so a page that started on the old
      // worker and finishes on the new one cannot be handed a mismatched pair. The
      // alternative is a reader who has to close every tab to get a fix.
      event.waitUntil(precache().then(() => global.skipWaiting()));
    });

    global.addEventListener('activate', (event) => {
      event.waitUntil(dropOldCaches().then(() => global.clients && global.clients.claim()));
    });

    global.addEventListener('fetch', (event) => {
      if (strategyFor(event.request) === 'skip') return; // straight to the network
      event.respondWith(handle(event.request));
    });
  }

  const api = { strategyFor, stamped, CACHE_NAME, CACHE_PREFIX, BUILD, SHELL, NOT_IN_THE_HTML, NOT_OURS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.ServiceWorkerShell = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
