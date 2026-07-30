// Page logic: reads the form, matches the deck against the combo database,
// renders combos found + ranked card suggestions.
//
// The matching happens here rather than through Commander Spellbook's
// find-my-combos endpoint because that endpoint only accepts browser requests
// from their own site and localhost. A GitHub Action publishes the database to
// the `data` branch and we fetch it from there — the same split MTG-Pricerunner
// uses for prices.
(function () {
  'use strict';

  const SPELLBOOK_COMBO_URL = 'https://commanderspellbook.com/combo/';
  const ARCHIDEKT_API = 'https://archidekt.com/api/decks/';
  const DATA_URL = /github\.io$/.test(location.hostname)
    ? 'https://raw.githubusercontent.com/PaludaNCode/MTG-Combo-Finder/data/combos.json'
    : 'combos.json'; // local checkout / any other host

  const $ = (id) => document.getElementById(id);

  function setStatus(msg, isError) {
    const el = $('status');
    el.textContent = msg || '';
    el.classList.toggle('error', Boolean(isError));
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function link(href, text) {
    const a = el('a', null, text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  // ---- Rendering -----------------------------------------------------------

  // How many results to show before folding the rest away. Eight shows every
  // result on 93% of combos — the old cap of four folded something on 58% of
  // them, which is how the grey tier ended up invisible in practice.
  const RESULTS_SHOWN = 8;

  // The results of a combo, as chips rather than a comma-run: a game-ending
  // result should be findable at a glance instead of buried mid-sentence.
  function resultChips(variant) {
    const wrap = el('div', 'results');
    const results = DeckCombos.summarizeResults(
      (variant.produces || []).map((p) => (p.feature && p.feature.name) || p.name)
    );
    if (!results.length) {
      wrap.appendChild(el('span', 'result-none', 'No result recorded'));
      return wrap;
    }

    const { shown, hidden } = DeckCombos.splitResults(results, RESULTS_SHOWN);
    const chip = (r) => {
      const node = el('span', 'result tier-' + r.tier, r.name);
      if (r.why) node.title = r.why; // the caveat, on hover
      return node;
    };
    shown.forEach((r) => wrap.appendChild(chip(r)));

    if (hidden.length) {
      const more = el('button', 'result more', '+' + hidden.length + ' more');
      more.type = 'button';
      more.addEventListener('click', () => {
        hidden.forEach((r) => wrap.insertBefore(chip(r), more));
        more.remove();
      });
      wrap.appendChild(more);
    }
    return wrap;
  }

  function comboCard(variant, deckNames) {
    const card = el('article', 'combo');

    const header = el('h3');
    DeckCombos.variantCardNames(variant).forEach((name, i) => {
      if (i > 0) header.appendChild(el('span', 'plus', ' + '));
      const inDeck = !deckNames || deckNames.has(DeckCombos.nameKey(name));
      header.appendChild(el('span', inDeck ? 'card-name' : 'card-name missing', name));
    });
    card.appendChild(header);

    card.appendChild(resultChips(variant));

    if (variant.description) {
      const details = el('details');
      details.appendChild(el('summary', null, 'How it works'));
      const steps = el('div', 'description');
      String(variant.description).split(/\r?\n/).forEach((line) => {
        if (line.trim()) steps.appendChild(el('p', null, line.trim()));
      });
      details.appendChild(steps);
      card.appendChild(details);
    }

    if (variant.id) {
      const p = el('p', 'combo-link');
      p.appendChild(link(SPELLBOOK_COMBO_URL + encodeURIComponent(variant.id) + '/', 'View on Commander Spellbook →'));
      card.appendChild(p);
    }

    return card;
  }

  function suggestionCard(suggestion, rank, deckNames) {
    const card = el('article', 'combo suggestion');

    const header = el('h3');
    header.appendChild(el('span', 'rank', rank + '. '));
    header.appendChild(el('span', 'card-name', suggestion.card));
    header.appendChild(el('span', 'badge', '+' + suggestion.unlocks.length + ' combo' + (suggestion.unlocks.length === 1 ? '' : 's')));
    card.appendChild(header);

    const links = el('p', 'card-links');
    links.appendChild(link('https://edhrec.com/cards/' + DeckCombos.edhrecSlug(suggestion.card), 'EDHREC'));
    links.appendChild(document.createTextNode(' · '));
    links.appendChild(link('https://scryfall.com/search?q=' + encodeURIComponent('!"' + suggestion.card + '"'), 'Scryfall'));
    card.appendChild(links);

    const details = el('details');
    details.appendChild(el('summary', null, 'Combos this unlocks'));
    suggestion.unlocks.forEach((v) => details.appendChild(comboCard(v, deckNames)));
    card.appendChild(details);

    return card;
  }

  // ---- collapsible sections -----------------------------------------------

  // Remember which sections the reader closed, so a new search doesn't reopen
  // everything they just tidied away.
  const COLLAPSE_KEY = 'mtg-combo-finder.collapsed';

  function readCollapsed() {
    try {
      return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {};
    } catch (err) {
      return {}; // private mode, or someone put junk in there
    }
  }

  function writeCollapsed(state) {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state));
    } catch (err) {
      /* not worth bothering the reader about */
    }
  }

  // A titled section whose header is the collapse control. Using a real
  // <button> gets keyboard and screen-reader behaviour for free.
  function panel(container, key, title, count) {
    container.textContent = '';

    const section = el('section', 'panel');
    const head = el('button', 'panel-head');
    head.type = 'button';
    const bodyId = 'panel-' + key;
    head.setAttribute('aria-controls', bodyId);

    head.appendChild(el('span', 'chev', '▸'));
    head.appendChild(el('h2', 'panel-title', title));
    if (count != null) head.appendChild(el('span', 'panel-count', String(count)));

    const body = el('div', 'panel-body');
    body.id = bodyId;

    const apply = (collapsed) => {
      section.classList.toggle('is-collapsed', collapsed);
      head.setAttribute('aria-expanded', String(!collapsed));
      head.title = collapsed ? 'Expand' : 'Collapse';
      body.hidden = collapsed;
    };
    apply(Boolean(readCollapsed()[key]));

    head.addEventListener('click', () => {
      const collapsed = !section.classList.contains('is-collapsed');
      apply(collapsed);
      const state = readCollapsed();
      state[key] = collapsed;
      writeCollapsed(state);
    });

    section.appendChild(head);
    section.appendChild(body);
    container.appendChild(section);
    return body;
  }

  // One of your cards, with the combos it holds together.
  function pieceCard(piece, rank) {
    const card = el('article', 'combo suggestion');

    const head = el('div', 'sug-head');
    head.appendChild(el('span', 'rank', rank + '.'));
    head.appendChild(el('span', 'card-name', piece.card));
    head.appendChild(el('span', 'badge', 'in ' + piece.count + ' combo' + (piece.count === 1 ? '' : 's')));
    card.appendChild(head);

    const links = el('p', 'card-links');
    links.appendChild(link('https://edhrec.com/cards/' + DeckCombos.edhrecSlug(piece.card), 'EDHREC'));
    links.appendChild(document.createTextNode(' · '));
    links.appendChild(link('https://scryfall.com/search?q=' + encodeURIComponent('!"' + piece.card + '"'), 'Scryfall'));
    card.appendChild(links);

    const details = el('details');
    details.appendChild(el('summary', null, piece.count === 1 ? 'The combo it is part of' : 'The combos it holds together'));
    piece.combos.forEach((v) => details.appendChild(comboCard(v, null)));
    card.appendChild(details);

    return card;
  }

  function renderPieces(container, included) {
    if (!included.length) {
      container.textContent = '';
      return;
    }
    const pieces = DeckCombos.comboPieces(included);
    const body = panel(container, 'pieces', 'Cards carrying your combos', pieces.length);
    const top = pieces[0];
    body.appendChild(el('p', 'section-note', top.count > 1
      ? `${top.card} appears in ${top.count} of them — cutting it costs you all ${top.count}.`
      : 'Each of these appears in one combo.'));
    pieces.forEach((p, i) => body.appendChild(pieceCard(p, i + 1)));
  }

  function renderSuggestions(container, key, title, suggestions, deckNames, emptyText) {
    if (!suggestions.length && !emptyText) {
      container.textContent = '';
      return;
    }
    const body = panel(container, key, title, suggestions.length || null);
    if (!suggestions.length) {
      body.appendChild(el('p', 'empty', emptyText));
      return;
    }
    suggestions.forEach((s, i) => body.appendChild(suggestionCard(s, i + 1, deckNames)));
  }

  function renderResults(results, deckNames) {
    $('results').hidden = false;

    const identity = $('identity');
    identity.textContent = '';
    if (results.identity && results.identity.size) {
      identity.appendChild(el('p', 'identity-line',
        'Deck color identity: ' + [...results.identity].join('').toUpperCase()));
    }

    const included = results.included;
    const includedBody = panel($('included'), 'included', 'Combos in your deck', included.length || null);
    if (included.length) {
      included.forEach((v) => includedBody.appendChild(comboCard(v, null)));
    } else {
      includedBody.appendChild(el('p', 'empty', 'No known combos found in this deck.'));
    }

    renderPieces($('pieces'), included);

    renderSuggestions(
      $('suggestions'),
      'suggestions',
      'Suggested additions',
      DeckCombos.computeSuggestions(results.almostIncluded, deckNames),
      deckNames,
      'No single-card additions would complete a combo (within your color identity).'
    );

    renderSuggestions(
      $('offcolor'),
      'offcolor',
      'Outside your color identity',
      DeckCombos.computeSuggestions(results.almostIncludedByAddingColors, deckNames),
      deckNames,
      '' // hide section entirely when empty
    );
  }

  // ---- combo database ------------------------------------------------------

  // Everything we learn about a load, kept so a failure can be shown in full
  // rather than reduced to "it didn't work".
  let lastDiagnostics = null;
  let dataset = null; // cached for the session — it's a few MB

  async function loadDataset() {
    if (dataset) return dataset;

    const diag = { endpoint: DATA_URL, method: 'GET' };
    lastDiagnostics = diag;

    let res;
    try {
      res = await fetch(DATA_URL, { cache: 'default' });
    } catch (networkErr) {
      diag.error = networkErr.name + ': ' + networkErr.message;
      diag.likelyCause = DATA_URL.startsWith('http')
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

    const raw = await res.text();
    try {
      dataset = JSON.parse(raw);
    } catch (err) {
      diag.responseSnippet = raw.slice(0, 400);
      diag.likelyCause = 'The combo database is not valid JSON.';
      throw new Error('Could not read the combo database');
    }
    if (!dataset.combos || !dataset.combos.length) {
      diag.likelyCause = 'The combo database downloaded but contains no combos.';
      throw new Error('Combo database is empty');
    }
    diag.loaded = `${dataset.combos.length} combos, updated ${dataset.updatedAt || 'unknown'}`;
    return dataset;
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
      'endpoint: ' + d.method + ' ' + d.endpoint,
      'status:   ' + (d.status ? d.status + ' ' + (d.statusText || '') : '(no response received)'),
    ];
    if (failed) {
      lines.push('error:    ' + (d.error || err.name + ': ' + err.message));
      lines.push('cause:    ' + (d.likelyCause || 'unknown'));
    }
    lines.push('sent:     ' + (d.sent ? d.sent.main + ' main + ' + d.sent.commanders + ' commanders' : '(nothing)'));
    if (d.firstCards && d.firstCards.length) {
      lines.push('first cards sent:', ...d.firstCards.map((c) => '  ' + c));
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

    const parsed = DeckParser.parseDecklist($('decklist').value);
    const commanderParsed = DeckParser.parseDecklist($('commanders').value);
    // Anything typed in the commander box counts as a commander, and
    // "Commander:" sections inside the main paste do too.
    let commanders = commanderParsed.main
      .concat(commanderParsed.commanders, parsed.commanders);
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
    setStatus(dataset
      ? `Searching combos for ${main.length + commanders.length} cards…`
      : 'Downloading the combo database (once per visit)…');
    $('find-combos').disabled = true;
    try {
      const data = await loadDataset();
      const deckNames = DeckCombos.deckNameSet(commanders.concat(main));
      const matched = DeckCombos.matchDeck(data, deckNames, commanders);
      const results = {
        identity: matched.identity,
        included: matched.included.map(DeckCombos.expand),
        almostIncluded: matched.almostIncluded.map(DeckCombos.expand),
        almostIncludedByAddingColors: matched.almostIncludedByAddingColors.map(DeckCombos.expand),
      };
      const notes = [];
      if (parsed.skipped.length) notes.push(`${parsed.skipped.length} line(s) skipped`);
      notes.push(...trimmed);
      notes.unshift(`${data.combos.length.toLocaleString()} combos searched`);
      setStatus('Searched ' + (main.length + commanders.length) + ' cards against ' + notes.join('; ') + '.');
      renderResults(results, deckNames);
      if (parsed.skipped.length) showDiagnostics(null, parsed, 'notice');
    } catch (err) {
      setStatus('Combo search failed: ' + err.message, true);
      showDiagnostics(err, parsed);
    } finally {
      $('find-combos').disabled = false;
    }
  }

  $('deck-form').addEventListener('submit', onSubmit);
  $('load-deck').addEventListener('click', loadDeckUrl);
})();
