// Page logic: reads the form, asks Commander Spellbook's find-my-combos
// endpoint about the deck, renders the result.
(function () {
  'use strict';

  const SPELLBOOK_API = 'https://backend.commanderspellbook.com/find-my-combos';
  const SPELLBOOK_COMBO_URL = 'https://commanderspellbook.com/combo/';
  const MOXFIELD_API = 'https://api2.moxfield.com/v3/decks/all/';

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

  // ---- Rendering -----------------------------------------------------------

  function comboCard(variant) {
    const card = el('article', 'combo');

    const cards = (variant.uses || [])
      .map((u) => (u.card && u.card.name) || u.name)
      .filter(Boolean);
    const header = el('h3');
    cards.forEach((name, i) => {
      if (i > 0) header.appendChild(el('span', 'plus', ' + '));
      header.appendChild(el('span', 'card-name', name));
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
      const a = el('a', null, 'View on Commander Spellbook →');
      a.href = SPELLBOOK_COMBO_URL + encodeURIComponent(variant.id) + '/';
      a.target = '_blank';
      a.rel = 'noopener';
      p.appendChild(a);
      card.appendChild(p);
    }

    return card;
  }

  function renderSection(container, title, variants, emptyText) {
    container.textContent = '';
    container.appendChild(el('h2', null, title + (variants.length ? ` (${variants.length})` : '')));
    if (!variants.length) {
      if (emptyText) container.appendChild(el('p', 'empty', emptyText));
      return;
    }
    variants.forEach((v) => container.appendChild(comboCard(v)));
  }

  function renderResults(results) {
    $('results').hidden = false;

    const identity = $('identity');
    identity.textContent = '';
    if (results.identity) {
      identity.appendChild(el('p', 'identity-line', 'Deck color identity: ' + String(results.identity).toUpperCase()));
    }

    renderSection(
      $('included'),
      'Combos in your deck',
      results.included || [],
      'No known combos found in this deck.'
    );

    const almost = results.almostIncluded || [];
    renderSection(
      $('almost'),
      'One card away',
      almost,
      ''
    );
    if (!almost.length) $('almost').textContent = '';
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

  async function loadMoxfield() {
    const url = $('moxfield-url').value.trim();
    const id = DeckParser.moxfieldDeckId(url);
    if (!id) {
      setStatus('That does not look like a Moxfield deck URL (expected https://moxfield.com/decks/…).', true);
      return;
    }
    setStatus('Loading deck from Moxfield…');
    try {
      const res = await fetch(MOXFIELD_API + encodeURIComponent(id));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const deck = await res.json();
      const { commanders, main } = DeckParser.fromMoxfield(deck);
      if (!main.length && !commanders.length) throw new Error('Deck appears to be empty');
      $('commanders').value = commanders.map((c) => c.card).join('\n');
      $('decklist').value = main.map((c) => `${c.quantity} ${c.card}`).join('\n');
      setStatus(`Loaded ${main.length} cards${commanders.length ? ' + ' + commanders.length + ' commander(s)' : ''} from Moxfield.`);
    } catch (err) {
      // Moxfield blocks cross-origin browser requests for some decks/setups;
      // pasting the export is the reliable fallback.
      setStatus(
        'Could not load the deck from Moxfield (' + err.message + '). ' +
        'Open the deck on Moxfield, use More → Export → copy the list, and paste it below instead.',
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
      renderResults(results);
    } catch (err) {
      setStatus('Combo search failed: ' + err.message, true);
    } finally {
      $('find-combos').disabled = false;
    }
  }

  $('deck-form').addEventListener('submit', onSubmit);
  $('load-moxfield').addEventListener('click', loadMoxfield);
})();
