// Page logic: reads the form, asks search.js to match the deck against the
// combo database, renders combos found + ranked card suggestions.
//
// The matching happens on this side rather than through Commander Spellbook's
// find-my-combos endpoint because that endpoint only accepts browser requests
// from their own site and localhost. A GitHub Action publishes the database to
// the `data` branch and we fetch it from there — the same split MTG-Pricerunner
// uses for prices. Downloading and matching it happens in a worker; this file
// only draws what comes back.
(function () {
  'use strict';

  const ARCHIDEKT_API = 'https://archidekt.com/api/decks/';
  const DATA_URL = /github\.io$/.test(location.hostname)
    ? 'https://raw.githubusercontent.com/PaludaNCode/MTG-Combo-Finder/data/combos.json'
    : 'combos.json'; // local checkout / any other host

  // The steps tree sits beside combos.json wherever that is, because the two are
  // published by the same job in the same run. Derived from DATA_URL rather than
  // written out twice, so a data branch that moves takes the steps with it.
  const STEPS_BASE = DATA_URL.replace(/combos\.json$/, '');

  // Wired here rather than inside combo-steps.js so that module stays free of any
  // opinion about where data lives — the same reason search.js takes a URL.
  if (typeof ComboSteps !== 'undefined' && typeof StepsSource !== 'undefined') {
    ComboSteps.setSource(StepsSource.reader({ base: STEPS_BASE }));
  }

  // The DOM helpers and the collapsible panel live in page-dom.js now: every renderer
  // split out of this file wanted the same four, and a second copy of el() is how two
  // parts of one page stop agreeing about markup.
  const { $, el, panel, setStatus } = PageDom;

  // The deploy rewrites every asset URL in the HTML to carry `?v=<commit sha>`,
  // because the Pages CDN caches by full URL and a deploy purges nothing — so
  // unversioned URLs can serve new HTML with old JS. The worker is loaded from
  // here rather than from the HTML, so it has to carry the same stamp, and this
  // file's own URL is where to find it. No stamp locally, which is fine.
  const ASSET_VERSION = (() => {
    const src = (document.currentScript && document.currentScript.src) || '';
    const query = src.indexOf('?');
    return query === -1 ? '' : src.slice(query);
  })();

  // The shell, offline. Registered from here rather than from the HTML for the same
  // reason the search worker is: it needs the stamp, and this file's own URL is where
  // the stamp is. `worker-src 'self'` in both pages' CSP already permits it.
  //
  // Deliberately last and deliberately ignorable: everything on this page works
  // without it, a browser that refuses one is not a browser that should see an error,
  // and an insecure origin refuses by design. See sw.js for the strategy — the short
  // version is that the HTML is never served stale.
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      navigator.serviceWorker.register('sw.js' + ASSET_VERSION).catch(() => {});
    } catch (err) {
      /* nothing on this page depends on it */
    }
  }

  function renderIdentity(container, identity) {
    container.textContent = '';
    // An empty set is colourless — a real identity, worth showing as {C}. Null
    // means the data couldn't tell us, which is worth showing as nothing.
    if (!identity) return;

    const line = el('p', 'identity-line');
    line.appendChild(el('span', 'identity-label', 'Colour identity'));
    line.appendChild(RenderRows.manaPips(identity));
    container.appendChild(line);
  }

  // ---- what bracket the list is in ----------------------------------------
  //
  // Wizards' own words for each bracket, so a number on the page is followed by
  // the name people actually use for it.

  // The five brackets as a row of pips, in the shape of the colour identity line
  // above it: a label, a compact visual, no prose. Brackets the list has ruled
  // itself out of are struck through, the floor is filled, the ones still open are
  // outlined — so the number reads as a position on a scale rather than a score from
  // nowhere, and "anything from here up" is visible without a word of explanation.
  //
  // A floor, never a verdict — see bracketCheck() in combos.js for why, and for the
  // two criteria this rests on.
  //
  // Everything that used to be printed under the number now lives in one panel
  // attached to the pips, and that is a real trade: the caveat was previously kept
  // deliberately unfoldable, on the grounds that a bare bracket number reads as the
  // whole answer. It is now one hover, focus or tap away. What follows from that is
  // that the panel has to carry everything a reader needed in order not to be misled
  // — the reasoning, the Game Changers *with their links*, the combos behind the
  // floor, and the criteria nobody checked — rather than being a summary of it.

  // Which of the pasted cards the snapshot has never heard of, written out.
  //
  // Above the results and not folded into the diagnostics disclosure, because the
  // complaint this answers is that nothing on screen said why the answer came back
  // smaller than the deck deserves — and a closed <details> is nothing on screen.
  // It is not showDiagnostics()' population either: that lists lines the parser
  // *dropped*, and an unrecognized card is one the parser accepted.
  //
  // Whether to say anything, and how it is worded, is DeckView.unrecognizedNote() —
  // a count and a pluralisation that could be confidently wrong, plus the rule that
  // a thin identity map must produce silence rather than a wall of names.
  function renderUnrecognized(container, found) {
    container.textContent = '';
    const note = DeckView.unrecognizedNote(found);
    if (!note) return;

    const box = el('section', 'unknown-cards');
    box.appendChild(el('p', 'unknown-head', note.sentence));

    // The names themselves, as the reader typed them — the whole point of the
    // section. Their own spelling, because that is what they have to find in the
    // box to fix, and any "corrected" version would be a guess.
    const list = el('ul', 'unknown-list');
    note.names.forEach((name) => {
      const li = el('li');
      li.appendChild(el('span', 'card-name', name));
      list.appendChild(li);
    });
    box.appendChild(list);
    if (note.more) box.appendChild(el('p', 'unknown-more', `…and ${note.more} more.`));

    box.appendChild(el('p', 'unknown-why', note.why));
    container.appendChild(box);
  }

  function renderBracket(container, bracket) {
    container.textContent = '';
    // No published list means the question cannot be asked at all. Half a bracket
    // check is worse than none, so nothing is drawn.
    if (!bracket) return;

    // The words, the reasoning and which pip is in which state are all
    // DeckView.bracketProse() — every one of them a claim about what a deck is
    // allowed to be, and every one of them able to be wrong while rendering
    // perfectly. This function draws what it returns.
    const prose = DeckView.bracketProse(bracket);
    if (!prose) return;
    const changers = bracket.gameChangers || [];
    const wins = bracket.twoCardWins || [];
    const named = prose.named;

    const line = el('p', 'bracket-line');
    line.appendChild(el('span', 'bracket-label', 'Bracket'));

    // The pips and their explanation share a wrapper: the panel is positioned
    // against it, and shown while anything inside it is hovered or focused.
    const wrap = el('span', 'bracket-wrap');

    const scale = el('button', 'bracket-scale');
    scale.type = 'button';
    scale.setAttribute('aria-expanded', 'false');
    scale.setAttribute('aria-controls', 'bracket-why');
    // Five numbered circles read as "1 2 3 4 5" to a screen reader, which is worse
    // than nothing. The pips are decorative; the button carries the answer.
    scale.setAttribute('aria-label', named + '. Why this bracket?');
    scale.title = named;
    prose.steps.forEach((step) => {
      const pip = el('span', 'step ' + step.state, String(step.n));
      pip.setAttribute('aria-hidden', 'true');
      scale.appendChild(pip);
    });
    wrap.appendChild(scale);

    const why = el('div', 'bracket-why');
    why.id = 'bracket-why';
    why.appendChild(el('p', 'why-floor', named));

    why.appendChild(el('p', 'why-reason', prose.reason));

    // Named and still linked. These are the cards the answer rests on, and a name
    // you cannot look up is a claim the reader has to take on trust.
    if (changers.length) {
      const list = el('p', 'why-cards');
      list.appendChild(el('span', 'why-label', 'Game Changers you play: '));
      changers.forEach((name, i) => {
        if (i > 0) list.appendChild(document.createTextNode(' · '));
        list.appendChild(el('span', 'card-name', name));
        list.appendChild(RenderRows.cardLinks(name));
      });
      why.appendChild(list);
    }

    // The combos behind the floor, named rather than drawn as cards: each is already
    // rendered in full under "Combos in your deck", and repeating them there was the
    // bulk of what made this a panel in the first place.
    if (wins.length) {
      const list = el('p', 'why-cards');
      list.appendChild(el('span', 'why-label', wins.length === 1
        ? 'The two-card win: ' : `The ${wins.length} two-card wins: `));
      wins.forEach((v, i) => {
        if (i > 0) list.appendChild(document.createTextNode(' · '));
        list.appendChild(el('span', 'card-name', RenderRows.comboCardNames(v).join(' + ')));
      });
      why.appendChild(list);
    }

    why.appendChild(el('p', 'why-note',
      'Only two of the criteria can be read off a card list, and those are the two above. '
      + 'Mass land denial, chained extra turns, how many tutors counts as “a few” and how early a '
      + 'combo lands are judgement calls this page does not make — so this is the lowest bracket the '
      + 'list is eligible for, not a verdict on the deck.'));

    wrap.appendChild(why);
    line.appendChild(wrap);
    container.appendChild(line);

    // Hover and keyboard focus open it in CSS. This is for touch, where there is no
    // hover: a tap opens it, a second tap closes it again.
    scale.addEventListener('click', () => {
      scale.setAttribute('aria-expanded', scale.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
    });
    scale.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') scale.setAttribute('aria-expanded', 'false');
    });
  }

  // Whether the list is allowed, beside the bracket that says how strong it is.
  //
  // Two lines and not one, because an off-identity card and a banned card are
  // different accusations: the first is a decklist mistake the reader can fix by
  // cutting a card, the second is the format saying no. Only the ban gets --error;
  // a card in the wrong colours is wrong, not alarming.
  //
  // Nothing at all when there is nothing to report — no empty line, no green tick.
  // The claim this can support is two rules read off a card list, which is what the
  // footnote says, and a tick would be read as covering everything else.
  function renderLegality(container, legality) {
    container.textContent = '';
    const prose = DeckView.legalityProse(legality);
    if (!prose) return;

    const box = el('section', 'legality');

    // Named, and named first: the reader needs the card, not the count.
    const listLine = (cls, label, sentence, items) => {
      const line = el('p', 'legality-line ' + cls);
      line.appendChild(el('span', 'legality-label', label));
      line.appendChild(el('span', 'legality-claim', sentence));
      const names = el('span', 'legality-cards');
      items.forEach((item, i) => {
        if (i > 0) names.appendChild(document.createTextNode(' · '));
        names.appendChild(el('span', 'card-name', item.card || item));
        // The colours the card carries that the commander does not — the reason it
        // is on this line, so it does not have to be looked up to be believed.
        if (item.colours) names.appendChild(el('span', 'legality-colours', ' ' + item.colours));
        names.appendChild(RenderRows.cardLinks(item.card || item));
      });
      line.appendChild(names);
      box.appendChild(line);
    };

    if (prose.banned.length) {
      listLine('is-banned', 'Banned', prose.bannedSentence, prose.banned.map((card) => ({ card })));
    }
    if (prose.offIdentity.length) {
      listLine('is-off-identity', 'Colours', prose.identitySentence, prose.offIdentity);
    }

    // What went unanswered, with the finding rather than in place of it.
    prose.unchecked.forEach((said) => box.appendChild(el('p', 'legality-note', said)));
    box.appendChild(el('p', 'legality-note', prose.note));
    container.appendChild(box);
  }

  // ---- what the reader waits for, and what can arrive after -----------------
  //
  // renderResults() used to be one synchronous task, and that is what made a big deck
  // feel broken: the browser cannot paint until a task finishes, so a reader whose
  // combos were ready after ~800ms sat looking at a dead page for 2.9s while the map,
  // the pieces panel and the suggestions panel — none of which are on screen, they are
  // nine screens down — were built underneath them.
  //
  // So the render is cut in two at the only line that matters: the combos, and then
  // everything else. Measured on a 520-combo deck at 390px with the CPU throttled 4x,
  // combos reach the screen in 1,674ms instead of 2,905ms.
  //
  // It is a trade and not a free win. Total work goes *up* — 1,976ms of building
  // becomes 3,335ms, because scheduling frames costs something — so the phone does
  // slightly more work than before. It just stops making the reader watch it happen.
  //
  // `token` is the part that is easy to leave out and expensive to debug. A search can
  // start before the previous one's deferred half has run — "+ Add to deck" fires one
  // immediately — and a stale callback landing after a newer render would draw the
  // previous deck's map over the current deck's results, which is the exact failure the
  // map's "rebuilt on every search" rule exists to prevent. Anything deferred carries
  // the token of the render that booked it and does nothing if it is no longer current.
  let renderToken = 0;

  function afterPaint(token, fn) {
    // rAF first, so the frame carrying the combos is produced before this runs at all;
    // then a task, because rAF callbacks still run before paint. One task per panel
    // rather than one for all three, so the page can answer a tap between them.
    requestAnimationFrame(() => {
      if (token !== renderToken) return;
      setTimeout(() => { if (token === renderToken) fn(); }, 0);
    });
  }

  function renderResults(results, deckNames) {
    $('results').hidden = false;
    const token = ++renderToken;

    renderUnrecognized($('unrecognized'), results.unrecognized);
    renderIdentity($('identity'), results.identity);
    renderBracket($('bracket'), results.bracket);
    renderLegality($('legality'), results.legality);

    const included = results.included;
    // What each row differs from the rest of the panel by, so every row of a family
    // sends that card last. Read across the whole panel rather than per family: these
    // rows are read down one column, and two combos one card apart that do different
    // things are still two rows side by side to the reader.
    const trails = DeckCombos.interchangeableIn(included);
    // One row per combo — "Scurry Oak + Archangel of Thune + Soul Warden" and the same
    // combo with Essence Warden in that slot are two rows, each with its own Spellbook
    // link and "How it works" — ordered the way every other list of combos is ordered:
    // size, then the biggest block of versions, then what the row draws.
    const rows = DeckCombos.byDrawnRow(included, trails);
    const includedBody = panel($('included'), 'included', 'Combos in your deck', included.length || null);
    if (rows.length) {
      rows.forEach((v) => includedBody.appendChild(RenderCombos.includedComboCard(v, trails)));
    } else {
      includedBody.appendChild(el('p', 'empty', 'No known combos found in this deck.'));
    }

    RenderSuggestions.renderUnofficial($('unofficial'), results.unofficial || []);

    // ---- everything below the fold, one frame later -------------------------
    //
    // Emptied now and filled later, rather than left alone until their new contents
    // are ready. Leaving them would be smoother — no gap, no re-grow — and would put
    // the previous deck's numbers on screen for a second and a half after the list
    // above them had already changed. Three panels quietly a search out of date is
    // worse than three panels visibly absent, and the map has a rule about this
    // already: one search behind says the added card is in no combos.
    //
    // Three textContent writes, so this costs nothing worth measuring.
    $('graph').textContent = '';
    $('pieces').textContent = '';
    $('suggestions').textContent = '';

    // Drawn from the same `included` the list above is — Spellbook's own combos
    // and not the unofficial ones, which is the same line "Cards carrying your
    // combos" draws, so the two panels cannot disagree about what a card is in.
    // Rebuilt on every search, including the one "+ Add to deck" fires, so the
    // picture is never a search behind the list beside it.
    afterPaint(token, () => RenderMap.renderGraph($('graph'), included));

    // Both halves, because the question this panel asks — what does cutting this
    // card cost me — has the same answer whoever published the combo. The two
    // numbers stay apart on the row; see ourBadge().
    afterPaint(token, () => RenderSuggestions.renderPieces($('pieces'), included, results.unofficial || []));

    // computeSuggestions() and groupSuggestions() are inside the deferred callback and
    // not evaluated as arguments to it, which is the difference between deferring the
    // drawing and deferring the work: they are ~150ms of the search on this deck, and
    // as arguments they would still run on the critical path to hand a finished list
    // to a function that is not going to be called for another frame.
    afterPaint(token, () => RenderSuggestions.renderSuggestions(
      $('suggestions'),
      DeckCombos.groupSuggestions(DeckCombos.computeSuggestions(
        results.almostIncluded, deckNames, results.unofficialAlmost
      ), deckNames),
      DeckCombos.groupSuggestions(DeckCombos.computeSuggestions(
        results.almostIncludedByAddingColors, deckNames, results.unofficialAlmostByAddingColors
      ), deckNames),
      deckNames,
      results.identity
    ));
  }

  // ---- combo database ------------------------------------------------------
  //
  // Downloading, parsing and matching all happen in search-worker.js. The
  // published file is ~9 MB of JSON over ~100k combos, and doing that here
  // meant the page stopped responding for as long as it took.

  // Everything we learn about a load, kept so a failure can be shown in full
  // rather than reduced to "it didn't work". The worker sends it back with every
  // reply, success or failure.
  let lastDiagnostics = null;
  let lastSent = {}; // what the last search was handed, for the failure report
  let loadedOnce = false; // is the database already in the worker's memory?
  let worker = null;
  let useWorker = typeof Worker === 'function';
  let inFlight = null; // only one search runs at a time — the button is disabled

  function settle(reject, err) {
    const entry = inFlight;
    inFlight = null;
    if (entry) (reject ? entry.reject : entry.resolve)(err);
  }

  function startWorker() {
    const w = new Worker('search-worker.js' + ASSET_VERSION);
    w.addEventListener('message', (event) => {
      const msg = event.data || {};
      lastDiagnostics = msg.diagnostics || lastDiagnostics;
      if (msg.ok) settle(false, msg);
      else settle(true, Object.assign(new Error(msg.error.message), { name: msg.error.name }));
    });
    // A worker that cannot start, or dies mid-search, must not take the search
    // with it — fall back to running in the page. Slower, but it works, and the
    // alternative is a page that does nothing and cannot say why.
    w.addEventListener('error', () => {
      worker = null;
      useWorker = false;
      settle(true, Object.assign(new Error('the background worker failed'), { retryInPage: true }));
    });
    return w;
  }

  function workerSearch(entries) {
    return new Promise((resolve, reject) => {
      try {
        if (!worker) worker = startWorker();
      } catch (err) {
        useWorker = false;
        reject(Object.assign(new Error('no background worker available'), { retryInPage: true }));
        return;
      }
      inFlight = { resolve, reject };
      worker.postMessage({ url: new URL(DATA_URL, location.href).href, entries });
    });
  }

  // What the in-page fallback needs and the page does not otherwise have, in load
  // order — search.js reads UnofficialCombos at load time, so unofficial.js goes first.
  //
  // **Two files, not four, and the difference is worth writing down** because the
  // review that proposed this said four. `result-tiers.js` and `combos.js` cannot leave
  // index.html: app.js uses `DeckCombos` throughout the rendering, graph.js and
  // view-model.js read it too, and combos.js reads the tier inventory at load. Only
  // `unofficial.js` and `search.js` are touched by nothing on the page except
  // inPageSearch() below — which is now the only thing that loads them.
  //
  // That is still 34.5 KB gzipped of a 143 KB shell, and unofficial.js is the largest
  // single script the page had. It saves no bytes: the worker fetches the same URLs and
  // the HTTP cache serves one download. What it saves is building the 235-row table on
  // the main thread, ahead of first paint, for a path that almost never runs — and it
  // stops that cost growing every time somebody adds a row.
  //
  // Stamped from ASSET_VERSION exactly as the worker's own URL is. That makes three
  // hops the deploy's rewrite cannot reach — these two, the worker's URL, and the
  // worker's own importScripts — and an unstamped one is invisible: it resolves
  // perfectly well and serves whatever the CDN last cached. The stamped/no-worker
  // viewport in tools/verify-layout.js is what proves these carry it, and it had to be
  // added for this change: `desktop (no worker)` runs unstamped and
  // `desktop (asset-stamped)` asserts the search went through the *worker*, so nothing
  // covered the stamped page path until now.
  const FALLBACK_SCRIPTS = ['unofficial.js', 'search.js'];
  let fallbackReady = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.addEventListener('load', () => resolve());
      el.addEventListener('error', () => reject(new Error('could not load ' + src)));
      document.head.appendChild(el);
    });
  }

  // Loaded once per page, however many searches fall back. Chained rather than fired
  // in parallel with `async = false`: the ordering guarantee for injected scripts is
  // real but easy to lose to a later refactor, and there is nothing to gain here —
  // this path is already the slow one by definition.
  function loadFallback() {
    if (typeof ComboSearch !== 'undefined') return Promise.resolve();
    if (!fallbackReady) {
      fallbackReady = FALLBACK_SCRIPTS.reduce(
        (chain, src) => chain.then(() => loadScript(src + ASSET_VERSION)),
        Promise.resolve(),
      );
    }
    return fallbackReady;
  }

  async function inPageSearch(entries) {
    await loadFallback();
    try {
      const out = await ComboSearch.run(new URL(DATA_URL, location.href).href, entries);
      lastDiagnostics = out.diagnostics;
      return out;
    } catch (err) {
      lastDiagnostics = ComboSearch.diagnostics();
      throw err;
    }
  }

  // Which of the two paths served the last search. Worth reporting rather than
  // inferring: the fallback and the worker produce the same output by design, so
  // "did the worker actually run" is otherwise unanswerable — from a failure
  // report, or from a test asserting that the fallback is reachable at all.
  let lastVia = null;

  async function runSearch(entries) {
    if (useWorker) {
      try {
        const out = await workerSearch(entries);
        lastVia = 'worker';
        return out;
      } catch (err) {
        if (!err || !err.retryInPage) throw err;
      }
    }
    const out = await inPageSearch(entries);
    lastVia = 'page';
    return out;
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function loadDeckUrl() {
    const url = $('deck-url').value.trim();
    const ref = DeckParser.parseDeckUrl(url);
    if (!ref) {
      setStatus('That’s not a deck URL we can read. Archidekt links work here; for Moxfield and everywhere else, paste the deck’s text export below.', true);
      return;
    }
    if (!ref.browserImport) {
      // Fetching would fail no matter what — say so up front instead of
      // spending a round trip to show the same advice.
      setStatus(ref.why + ' ' + ref.exportHint, true);
      return;
    }

    setStatus('Loading deck from ' + ref.label + '…');
    try {
      const parsed = DeckParser.fromArchidekt(await fetchJson(ARCHIDEKT_API + encodeURIComponent(ref.id) + '/'));
      const { commanders, main } = parsed;
      if (!main.length && !commanders.length) {
        setStatus(`That ${ref.label} deck came back empty. ${ref.exportHint}`, true);
        return;
      }
      $('commanders').value = commanders.map((c) => c.card).join('\n');
      $('decklist').value = main.map((c) => `${c.quantity} ${c.card}`).join('\n');
      setStatus(`Loaded ${main.length} cards${commanders.length ? ' + ' + commanders.length + ' commander(s)' : ''} from ${ref.label}.`);
    } catch (err) {
      setStatus(DeckParser.describeLoadFailure(err, ref.site), true);
    }
  }

  // Renders a copyable report of what we sent and what came back. Without this
  // a failure is just "it didn't work", which is not something anyone can act on.
  function showDiagnostics(err, parsed, kind) {
    const failed = kind !== 'notice';
    const d = lastDiagnostics || {};
    const lines = [
      failed ? 'MTG Combo Finder — error report' : 'MTG Combo Finder — skipped-line report',
      'when:     ' + new Date().toISOString(),
      'endpoint: ' + (d.method || 'GET') + ' ' + (d.endpoint || '(not reached)'),
      'status:   ' + (d.status ? d.status + ' ' + (d.statusText || '') : '(no response received)'),
      // Where the data came from matters when the data is the problem: a bad
      // parse of a kept copy and a bad download need different answers.
      'data:     ' + (d.source || '(not loaded)'),
      'searched: ' + (lastVia ? 'in a ' + lastVia : '(did not get that far)'),
    ];
    if (failed) {
      lines.push('error:    ' + (d.error || err.name + ': ' + err.message));
      lines.push('cause:    ' + (d.likelyCause || 'unknown'));
    }
    // Recorded before the search rather than after it, so a failure reports what
    // it was given as readily as a success does.
    lines.push('sent:     ' + (lastSent.sent
      ? lastSent.sent.main + ' main + ' + lastSent.sent.commanders + ' commanders'
      : '(nothing)'));
    if (lastSent.firstCards && lastSent.firstCards.length) {
      lines.push('first cards sent:', ...lastSent.firstCards.map((c) => '  ' + c));
    }
    if (d.loaded) lines.push('database: ' + d.loaded);
    if (parsed && parsed.skipped && parsed.skipped.length) {
      lines.push('skipped lines (' + parsed.skipped.length + '):');
      parsed.skipped.slice(0, 20).forEach((s) => lines.push('  [' + s.reason + '] ' + s.line));
      if (parsed.skipped.length > 20) lines.push('  …and ' + (parsed.skipped.length - 20) + ' more');
    }
    if (d.responseSnippet) lines.push('response body:', d.responseSnippet);
    const report = lines.join('\n');

    const box = $('diagnostics');
    box.textContent = '';
    box.hidden = false;

    const details = el('details', failed ? 'diag' : 'diag notice');
    details.open = failed;
    details.appendChild(el('summary', null, failed
      ? 'Error details — copy this'
      : `${parsed && parsed.skipped ? parsed.skipped.length : 0} line(s) skipped — see which`));
    const pre = el('pre', 'diag-body', report);
    details.appendChild(pre);

    const copy = el('button', 'copy-btn', 'Copy report');
    copy.type = 'button';
    copy.addEventListener('click', () => {
      navigator.clipboard.writeText(report).then(
        () => { copy.textContent = 'Copied'; },
        () => { copy.textContent = 'Press Ctrl+C to copy'; }
      );
    });
    details.appendChild(copy);
    box.appendChild(details);
  }

  async function onSubmit(event) {
    event.preventDefault();
    $('diagnostics').hidden = true;
    lastSent = {}; // so a report about this search never quotes the last one
    // Claimed by whichever search runs next, whether or not that is the one the
    // add started — a note left over from an earlier add would be a lie on a
    // search someone else asked for.
    const added = RenderRows.takeAddedNote();

    const parsed = DeckParser.parseDecklist($('decklist').value);
    const commanderParsed = DeckParser.parseDecklist($('commanders').value);
    // Anything typed in the commander box counts as a commander, and so does a
    // "Commander:" heading or a "*CMDR*" marker inside the main paste.
    const typed = commanderParsed.main.concat(commanderParsed.commanders);
    // Commanders are still read, because they are cards in the deck and combos
    // use them. They no longer decide the deck's colours — the cards do.
    let commanders = typed.concat(parsed.commanders);
    let main = parsed.main;

    if (!main.length && !commanders.length) {
      setStatus('No card names found in that decklist. Paste one card per line, e.g. "1 Sol Ring".', true);
      showDiagnostics(new Error('nothing parsed from the decklist'), parsed);
      return;
    }

    // Staying inside the endpoint's limits turns a confusing 400 into a notice.
    const limits = DeckParser.API_LIMITS;
    const trimmed = [];
    if (main.length > limits.maxMain) {
      trimmed.push(`only the first ${limits.maxMain} deck cards were sent`);
      main = main.slice(0, limits.maxMain);
    }
    if (commanders.length > limits.maxCommanders) {
      trimmed.push(`only the first ${limits.maxCommanders} commanders were sent`);
      commanders = commanders.slice(0, limits.maxCommanders);
    }

    $('results').hidden = true;
    setStatus(loadedOnce
      ? `Searching combos for ${main.length + commanders.length} cards…`
      : 'Downloading the combo database (once per visit)…');
    $('find-combos').disabled = true;
    // Marked, so the search can tell which cards are in the command zone. It is one
    // list from here on — every consumer but the legality check treats a commander as
    // an ordinary card, which it is — and the flag is what lets that check read the
    // colour identity off the commanders rather than off the deck. Reading it off the
    // deck would make every list legal by construction.
    const allEntries = commanders.map((e) => Object.assign({}, e, { commander: true })).concat(main);
    lastSent = {
      sent: { main: main.length, commanders: commanders.length },
      firstCards: allEntries.slice(0, 5).map((c) => `${c.quantity} ${c.card}`),
    };
    try {
      // allEntries is passed so a card credited with a template slot is named
      // the way the decklist spelled it, not as its lowercased lookup key.
      const results = await runSearch(allEntries);
      loadedOnce = true;
      const deckNames = DeckCombos.deckNameSet(allEntries);
      // A sideboard being left out is the parser doing its job, not a problem
      // report. Only lines we could not make sense of are worth interrupting
      // over — a 26-card maybeboard raising a warning trains people to ignore it.
      const ignored = parsed.skipped.filter((s) => /sideboard|ignored section/i.test(s.reason));
      const unparsed = parsed.skipped.filter((s) => !ignored.includes(s));

      const notes = [];
      if (ignored.length) notes.push(`${ignored.length} sideboard line(s) left out`);
      if (unparsed.length) notes.push(`${unparsed.length} line(s) not understood`);
      notes.push(...trimmed);
      notes.unshift(`${(results.meta.count || 0).toLocaleString()} known combos`);
      setStatus((added ? 'Added ' + added + '. ' : '')
        + 'Searched ' + (main.length + commanders.length) + ' cards against ' + notes.join('; ') + '.');
      renderResults(results, deckNames);
      renderDataAge(results.meta);
      DeckIO.saveDeck();
      if (unparsed.length) showDiagnostics(null, parsed, 'notice');
    } catch (err) {
      setStatus('Combo search failed: ' + err.message, true);
      showDiagnostics(err, parsed);
    } finally {
      $('find-combos').disabled = false;
    }
  }

  // ---- how old the data is -------------------------------------------------
  //
  // The database is a daily snapshot, and which snapshot you are looking at is
  // not something to have to guess at — especially now that a copy is kept
  // between visits. `data-source` says where this one came from, which is also
  // how the layout test can tell that caching is still working.
  function renderDataAge(meta) {
    const line = $('data-age');
    if (!line) return;
    const when = meta && meta.updatedAt;
    if (!when) {
      line.hidden = true;
      return;
    }
    const date = new Date(when);
    const shown = Number.isNaN(date.getTime())
      ? String(when)
      : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const stamp = el('time', null, shown);
    stamp.setAttribute('datetime', String(when));
    line.textContent = '';
    line.appendChild(document.createTextNode('Combo data from '));
    line.appendChild(stamp);
    line.appendChild(document.createTextNode(
      ` · ${(meta.count || 0).toLocaleString()} combos · refreshed daily`
    ));
    // `meta.source` decides whether the first phase reads "download" or "cache".
    const timing = DeckView.timingSentence(meta.timing, meta.source);
    if (timing) line.appendChild(el('span', 'timing', ' · ' + timing));
    line.dataset.source = meta.source || 'network';
    line.dataset.via = lastVia || 'unknown';
    line.title = meta.source === 'cache'
      ? 'Read from the copy your browser kept, and checked for a newer one in the background.'
      : 'Downloaded just now and kept for next time.';
    line.hidden = false;
  }

  // ---- wiring ---------------------------------------------------------------
  //
  // What is left of this file after the split: read the form, ask for a search, draw
  // what comes back, and connect the controls to the modules that do the work.

  $('deck-form').addEventListener('submit', onSubmit);
  $('load-deck').addEventListener('click', loadDeckUrl);
  $('decklist').addEventListener('input', DeckIO.saveDeckSoon);
  $('commanders').addEventListener('input', DeckIO.saveDeckSoon);
  $('clear-deck').addEventListener('click', DeckIO.clearDeck);
  DeckIO.wireDeckFiles();
  $('copy-link').addEventListener('click', () => {
    const button = $('copy-link');
    if (!$('decklist').value.trim() && !$('commanders').value.trim()) {
      setStatus('Nothing to share yet — paste a decklist first.', true);
      return;
    }
    const href = DeckIO.shareLink();
    history.replaceState(null, '', href);
    navigator.clipboard.writeText(href).then(
      () => { button.textContent = 'Link copied'; setTimeout(() => { button.textContent = 'Copy link'; }, 2000); },
      () => { setStatus('Could not copy — the link is in the address bar, copy it from there.'); }
    );
  });

  DeckIO.restoreDeck();
  // After the page is wired, because nothing here waits for it.
  registerServiceWorker();
})();
