// The combo search, off the thread that draws the page.
//
// Downloading ~25 MB of JSON, parsing it and walking ~100k combos are all
// things the window used to do between one paint and the next, which is why a
// search on a phone felt like the tab had died. None of it touches the DOM, so
// none of it needs to be there.
//
// The dataset is parsed once and kept here, so the second search of a session
// is a walk over data already in memory.
'use strict';

// Load order matters: combos.js reads the tier inventory at load time, and
// search.js reads combos.js the same way.
//
// The deploy stamps `?v=<sha>` onto every asset URL so fresh HTML can never pair
// with stale JS from the Pages CDN. These three are loaded from here rather than
// from the HTML, where the deploy's sed cannot reach them — but a worker's own
// query string is its script URL's, so it can pass the same stamp along. Empty
// in a local checkout, which is exactly right.
const VERSION = location.search;
importScripts(
  'result-tiers.js' + VERSION, 'combos.js' + VERSION,
  'unofficial.js' + VERSION, 'search.js' + VERSION
);

self.onmessage = async (event) => {
  const { id, url, entries } = event.data || {};
  try {
    const out = await ComboSearch.run(url, entries);
    self.postMessage(Object.assign({ id, ok: true }, out));
  } catch (err) {
    // Errors do not survive postMessage, and the page's failure report is built
    // out of these fields — send them as data rather than letting the worker
    // throw, which would arrive as a bare "error" with no cause.
    self.postMessage({
      id,
      ok: false,
      error: { name: (err && err.name) || 'Error', message: (err && err.message) || String(err) },
      diagnostics: ComboSearch.diagnostics(),
    });
  }
};
