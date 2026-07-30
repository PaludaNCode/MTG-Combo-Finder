// Page logic: reads the form, asks Commander Spellbook's find-my-combos
// endpoint about the deck, renders combos found + ranked card suggestions.
(function () {
  'use strict';

  const SPELLBOOK_API = 'https://backend.commanderspellbook.com/find-my-combos';
  const SPELLBOOK_COMBO_URL = 'https://commanderspellbook.com/combo/';
  const ARCHIDEKT_API = 'https://archidekt.com/api/decks/';

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

  function comboCard(variant, deckNames) {
    const card = el('article', 'combo');

    const header = el('h3');
    DeckCombos.variantCardNames(variant).forEach((name, i) => {
      if (i > 0) header.appendChild(el('span', 'plus', ' + '));
      const inDeck = !deckNames || deckNames.has(DeckCombos.nameKey(name));
      header.appendChild(el('span', inDeck ? 'card-name' : 'card-name missing', name));
    });
    card.appendChild(header);

    const produces = (variant.produces || [])
      .map((p) => (p.feature && p.feature.name) || p.name)
      .filter(Boolean);
    if (produces.length) {
      card.appendChild(el('p', 'produces', 'Produces: ' + produces.join(', ')));
    }

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

  function renderSuggestions(container, title, suggestions, deckNames, emptyText) {
    container.textContent = '';
    if (!suggestions.length && !emptyText) return;
    container.appendChild(el('h2', null, title + (suggestions.length ? ` (${suggestions.length} cards)` : '')));
    if (!suggestions.length) {
      container.appendChild(el('p', 'empty', emptyText));
      return;
    }
    suggestions.forEach((s, i) => container.appendChild(suggestionCard(s, i + 1, deckNames)));
  }

  function renderResults(results, deckNames) {
    $('results').hidden = false;

    const identity = $('identity');
    identity.textContent = '';
    if (results.identity) {
      identity.appendChild(el('p', 'identity-line', 'Deck color identity: ' + String(results.identity).toUpperCase()));
    }

    const included = pick(results, 'included', 'included');
    const includedEl = $('included');
    includedEl.textContent = '';
    includedEl.appendChild(el('h2', null, 'Combos in your deck' + (included.length ? ` (${included.length})` : '')));
    if (included.length) {
      included.forEach((v) => includedEl.appendChild(comboCard(v, null)));
    } else {
      includedEl.appendChild(el('p', 'empty', 'No known combos found in this deck.'));
    }

    renderSuggestions(
      $('suggestions'),
      'Suggested additions — ranked by combos unlocked',
      DeckCombos.computeSuggestions(pick(results, 'almost_included', 'almostIncluded'), deckNames),
      deckNames,
      'No single-card additions would complete a combo (within your color identity).'
    );

    renderSuggestions(
      $('offcolor'),
      'Outside your color identity',
      DeckCombos.computeSuggestions(
        pick(results, 'almost_included_by_adding_colors', 'almostIncludedByAddingColors'),
        deckNames
      ),
      deckNames,
      '' // hide section entirely when empty
    );
  }

  // ---- API calls -----------------------------------------------------------

  // Everything we learn about a request, kept so a failure can be shown in full
  // rather than reduced to "it didn't work".
  let lastDiagnostics = null;

  async function findCombos(commanders, main) {
    const payload = { commanders, main };
    const diag = {
      endpoint: SPELLBOOK_API,
      method: 'POST',
      sent: { commanders: commanders.length, main: main.length },
      firstCards: main.slice(0, 5).map((c) => `${c.quantity} ${c.card}`),
    };
    lastDiagnostics = diag;

    let res;
    try {
      res = await fetch(SPELLBOOK_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      // No response at all: CORS, offline, DNS, TLS.
      diag.error = networkErr.name + ': ' + networkErr.message;
      diag.likelyCause = 'The browser blocked or could not send the request (CORS, offline, or the API is unreachable).';
      throw networkErr;
    }

    diag.status = res.status;
    diag.statusText = res.statusText;

    const raw = await res.text();
    diag.responseSnippet = raw.slice(0, 800);

    if (!res.ok) {
      // Django REST Framework puts field-level validation errors in the body,
      // which is where a rejected decklist actually explains itself.
      diag.likelyCause = res.status === 400
        ? 'The API rejected the decklist — see the response below for the offending field.'
        : 'The API responded with an error status.';
      const err = new Error('Commander Spellbook API returned HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (parseErr) {
      diag.likelyCause = 'The API returned a body that is not JSON.';
      throw new Error('Could not read the API response as JSON');
    }

    // The endpoint paginates, so the payload we want sits under `results`.
    const results = data.results || data;
    diag.responseKeys = Object.keys(results).join(', ');
    return results;
  }

  // The API returns snake_case keys (included, almost_included,
  // almost_included_by_adding_colors). Accept camelCase too so an older or
  // proxied response shape still renders instead of silently showing nothing.
  function pick(results, snake, camel) {
    const value = results[snake] !== undefined ? results[snake] : results[camel];
    return Array.isArray(value) ? value : [];
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
    if (d.responseKeys) lines.push('response keys: ' + d.responseKeys);
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
    setStatus(`Searching combos for ${main.length + commanders.length} cards…`);
    $('find-combos').disabled = true;
    try {
      const results = await findCombos(commanders, main);
      const notes = [];
      if (parsed.skipped.length) notes.push(`${parsed.skipped.length} line(s) skipped`);
      notes.push(...trimmed);
      setStatus(notes.length ? 'Searched ' + (main.length + commanders.length) + ' cards — ' + notes.join('; ') + '.' : '');
      renderResults(results, DeckCombos.deckNameSet(commanders.concat(main)));
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
