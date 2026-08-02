// Where a combo's steps come from: one small file per combo on the data branch,
// fetched when a reader opens the "How it works" panel and never before.
//
// The shape of the answer is combo-steps.js's business; this file only knows how
// to go and get one. It runs in the page and under Node (module.exports) so the
// publisher can import the very same pathFor() it publishes to — the two sides of
// a URL agreeing by construction rather than by both being written carefully.
//
// ---- why a file per combo, and not the four cleverer things ------------------
//
// The steps are 51.70 MB across 103,737 combos — median 459 bytes each — which is
// far too much to add to a download the page already works hard to make once. So
// the reader fetches one combo's worth, on request. Five designs were built and
// measured (tools/measure-steps.js); what each costs to open one combo:
//
//   one file per combo        1 request     0.5 KB
//   blob + offset table       1 request     0.5 KB   after a 126.9 KB index
//   sharded JSON, 512 ways    1 request    21.7 KB
//   SQLite over byte ranges   4 requests   16.0 KB   sequential, each trip decides the next
//   Parquet, best tuning      2 requests   76.0 KB
//
// The blob tied on paper and lost on two things that only turned up when the
// design was tested against the actual host rather than reasoned about:
//
//   1. **A range request to raw.githubusercontent.com does not address the bytes
//      you think it does.** They serve almost everything as `text/plain` and
//      Fastly gzips it, so `Range: bytes=1000-1099` returns bytes 1000-1099 *of
//      the gzip stream* — a 100 KB file reports a total size of 133. A browser
//      cannot opt out, because `Accept-Encoding` is a forbidden header. Of 25
//      extensions probed, only `.zip` came back uncompressed with honest ranges.
//      Every range-based design here — the blob and SQLite both — needs that one
//      door, and the SQLite measurement above was taken with curl, which sends no
//      `Accept-Encoding` and so measured something a browser cannot do.
//   2. **An offset table has to be keyed on something.** Keyed by row number it is
//      small, and it silently breaks every morning: search.js serves a cached
//      combos.json for the session and revalidates behind it, so on the first
//      visit after a refresh the reader's row numbers are yesterday's and the
//      offsets are today's. Keyed by combo id instead — the only stable key — the
//      table has to carry the ids, which makes it big enough to want sharding,
//      which costs the extra round trip the blob existed to avoid.
//
// Follow that to the end and the index disappears into the filename: if the URL
// contains the id, there is nothing to look up. No index to download before the
// first answer, no byte offsets to keep in step with anything, no dependence on
// how a CDN feels about content encodings, and a 404 is a complete and correct
// answer meaning "no steps recorded".
//
// The cost lands on the publisher, which is where it can be measured and
// afforded: 103,737 files is 24s to `git add`, 1.6s to commit and a 19.8 MB pack.
// The nightly job already spends minutes streaming a 512 MB export.
(function (global) {
  'use strict';

  // 256 directories rather than one. Not for the reader — raw.githubusercontent
  // does not care — but for git: a directory's tree object is rewritten whole
  // whenever any file in it changes, so one flat directory would mean rewriting a
  // 3 MB tree nightly, while 256 of them means rewriting only the handful that
  // actually moved. Steps text rarely changes, so that is most of the difference
  // between pushing 20 MB a night and pushing almost nothing.
  const BUCKETS = 256;

  // Deliberately the cheapest thing that works, and deliberately shared: the
  // publisher writes to the path this produces and the reader asks for it, so a
  // change here moves both at once. Anything stronger (SHA-1 of the id, which was
  // measured) buys no evenness worth a crypto import — see the spread test.
  //
  // The xor-fold is insurance rather than a fix. `% 256` reads only the low eight
  // bits, which is where structure survives in structured input — but measured
  // against all 103,737 real ids it changes the spread from 1.158 to 1.151, which
  // is nothing. It stays because it is free and because the ids are Spellbook's to
  // reformat, not because it is currently earning anything.
  function bucketOf(id) {
    const s = String(id);
    let sum = 0;
    for (let i = 0; i < s.length; i += 1) sum = (sum * 31 + s.charCodeAt(i)) >>> 0;
    sum = (sum ^ (sum >>> 16)) >>> 0;
    return sum % BUCKETS;
  }

  // A combo id reaches a filesystem here, so it has to be a filename. Spellbook's
  // ids are digits, dashes and nothing else, and every id the page holds is either
  // one of theirs or rebuilt to their format by DeckCombos.rebuildId — but "every
  // id is well formed" is an assumption about someone else's data, and the cost of
  // it being wrong is a path traversal in the publisher. So it is checked instead,
  // in the one place both sides read.
  const SAFE_ID = /^[0-9]+(?:-[0-9]+)*(?:--[0-9]+)*$/;
  const isSafeId = (id) => SAFE_ID.test(String(id || ''));

  // The path a combo's steps live at, relative to wherever the data is published,
  // or null for an id that has no business being one. Callers treat null the same
  // way they treat a 404: no steps, and nothing went wrong.
  function pathFor(id) {
    if (!isSafeId(id)) return null;
    const bucket = bucketOf(id).toString(16).padStart(2, '0');
    return 'steps/' + bucket + '/' + id + '.json';
  }

  // A steps request that never answers is worse than one that fails: the panel
  // says "Looking up the steps…" and keeps saying it, with no way back. Ten
  // seconds is far past a 500-byte file on any connection worth waiting for.
  const TIMEOUT_MS = 10000;

  // Fetch one combo's steps. Resolves to Spellbook's own payload shape (which is
  // what combo-steps.js normalize() reads), or null when there are none.
  //
  // `base` is where the data lives — the data branch in production, the checkout
  // locally — and must end in a slash or be empty.
  function reader(options) {
    const opts = options || {};
    const base = String(opts.base || '');
    // Injected so the tests can drive this without a network, and so a page
    // without fetch fails as "no steps" rather than as a thrown ReferenceError.
    // Passing the option at all means "use exactly this" — including passing
    // something that is not a function, which is the only way a test running under
    // Node can stand in for an environment that has no fetch to fall back to.
    const doFetch = Object.prototype.hasOwnProperty.call(opts, 'fetch')
      ? (typeof opts.fetch === 'function' ? opts.fetch : null)
      : (typeof fetch === 'function' ? fetch.bind(global) : null);
    const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : TIMEOUT_MS;

    return async function fetchSteps(id) {
      const rel = pathFor(id);
      if (!rel || !doFetch) return null;

      // AbortController is not universal in the environments this has to survive
      // (it is absent under some test harnesses), and its absence should cost the
      // timeout rather than the feature.
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = setTimeout(() => controller && controller.abort(), timeoutMs);

      let res;
      try {
        res = await doFetch(base + rel, controller ? { signal: controller.signal } : undefined);
      } finally {
        clearTimeout(timer);
      }

      // The whole index, in one status code. A combo Spellbook records no steps
      // for simply has no file, and that is an answer rather than a failure.
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const payload = await res.json();
      if (!payload || typeof payload !== 'object') return null;

      // The id is in the URL, so this can only disagree if a file was published
      // to the wrong path — but the cost of that going unnoticed is the page
      // confidently printing another combo's steps, which is the one failure this
      // project engineers against everywhere else (see the permalink note in
      // CLAUDE.md). It costs about fifteen bytes a row to make impossible.
      if (String(payload.id) !== String(id)) {
        throw new Error('steps file for ' + id + ' holds ' + payload.id);
      }
      return payload;
    };
  }

  const api = { bucketOf, pathFor, isSafeId, reader, BUCKETS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.StepsSource = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
