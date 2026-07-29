// Page logic: reads the form, asks Commander Spellbook's find-my-combos
// endpoint about the deck, renders combos found + ranked card suggestions.
(function () {
  'use strict';

  const SPELLBOOK_API = 'https://backend.commanderspellbook.com/find-my-combos';
  const SPELLBOOK_COMBO_URL = 'https://commanderspellbook.com/combo/';
  const MOXFIELD_API = 'https://api2.moxfield.com/v3/decks/all/';
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

    const included = results.included || [];
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
      DeckCombos.computeSuggestions(results.almostIncluded || [], deckNames),
      deckNames,
      'No single-card additions would complete a combo (within your color identity).'
    );

    renderSuggestions(
      $('offcolor'),
      'Outside your color identity',
      DeckCombos.computeSuggestions(results.almostIncludedByAddingColors || [], deckNames),
      deckNames,
      '' // hide section entirely when empty
    );
  }

  // ---- API calls -----------------------------------------------------------

  async function findCombos(commanders, main) {
    const res = await fetch(SPELLBOOK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commanders, main }),
    });
    if (!res.ok) throw new Error('Commander Spellbook API returned HTTP ' + res.status);
    const data = await res.json();
    return data.results || data;
  }

  async function loadDeckUrl() {
    const url = $('deck-url').value.trim();
    const ref = DeckParser.parseDeckUrl(url);
    if (!ref) {
      setStatus('Unsupported deck URL — expected moxfield.com/decks/… or archidekt.com/decks/…. For other sites, paste the text export below.', true);
      return;
    }
    setStatus('Loading deck from ' + ref.site + '…');
    try {
      let parsed;
      if (ref.site === 'moxfield') {
        const res = await fetch(MOXFIELD_API + encodeURIComponent(ref.id));
        if (!res.ok) throw new Error('HTTP ' + res.status);
        parsed = DeckParser.fromMoxfield(await res.json());
      } else {
        const res = await fetch(ARCHIDEKT_API + encodeURIComponent(ref.id) + '/');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        parsed = DeckParser.fromArchidekt(await res.json());
      }
      const { commanders, main } = parsed;
      if (!main.length && !commanders.length) throw new Error('Deck appears to be empty');
      $('commanders').value = commanders.map((c) => c.card).join('\n');
      $('decklist').value = main.map((c) => `${c.quantity} ${c.card}`).join('\n');
      setStatus(`Loaded ${main.length} cards${commanders.length ? ' + ' + commanders.length + ' commander(s)' : ''} from ${ref.site}.`);
    } catch (err) {
      // Some deck sites block cross-origin browser requests; pasting the
      // site's text export is the reliable fallback.
      setStatus(
        'Could not load the deck from ' + ref.site + ' (' + err.message + '). ' +
        'Use the site’s Export feature, copy the list, and paste it below instead.',
        true
      );
    }
  }

  async function onSubmit(event) {
    event.preventDefault();

    const parsed = DeckParser.parseDecklist($('decklist').value);
    const commanderParsed = DeckParser.parseDecklist($('commanders').value);
    // Anything typed in the commander box counts as a commander, and
    // "Commander:" sections inside the main paste do too.
    const commanders = commanderParsed.main
      .concat(commanderParsed.commanders, parsed.commanders);
    const main = parsed.main;

    if (!main.length && !commanders.length) {
      setStatus('Paste a decklist first.', true);
      return;
    }

    $('results').hidden = true;
    setStatus(`Searching combos for ${main.length + commanders.length} cards…`);
    $('find-combos').disabled = true;
    try {
      const results = await findCombos(commanders, main);
      setStatus('');
      renderResults(results, DeckCombos.deckNameSet(commanders.concat(main)));
    } catch (err) {
      setStatus('Combo search failed: ' + err.message, true);
    } finally {
      $('find-combos').disabled = false;
    }
  }

  $('deck-form').addEventListener('submit', onSubmit);
  $('load-deck').addEventListener('click', loadDeckUrl);
})();
