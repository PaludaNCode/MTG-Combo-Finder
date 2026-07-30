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

  // Colour identity, drawn the way Magic draws it. WUBRG is the printed order,
  // so a Golgari deck always reads {B}{G} and never {G}{B}.
  const WUBRG = ['W', 'U', 'B', 'R', 'G'];
  const COLOUR_NAMES = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green', C: 'colorless' };

  function manaPips(colours) {
    const set = colours instanceof Set ? colours : new Set(String(colours || ''));
    const wrap = el('span', 'mana');
    const order = WUBRG.filter((c) => set.has(c));
    // No colours at all is colourless, not "nothing" — {C} is a real identity.
    for (const c of order.length ? order : ['C']) {
      const pip = el('span', 'pip pip-' + c, c);
      // The letter is decoration for anyone who can see the colour; a screen
      // reader should hear "green", not "G".
      pip.setAttribute('role', 'img');
      pip.setAttribute('aria-label', COLOUR_NAMES[c]);
      pip.title = COLOUR_NAMES[c];
      wrap.appendChild(pip);
    }
    return wrap;
  }

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

  // A combo you can already assemble, with the parts that are interchangeable
  // shown as a choice rather than as separate combos. The variants are real and
  // still reachable — each keeps its own link to Spellbook.
  function comboGroupCard(group) {
    if (group.choices.length < 2) return comboCard(group.variants[0], null);

    const card = el('article', 'combo');

    const header = el('h3');
    group.shared.forEach((name, i) => {
      if (i > 0) header.appendChild(el('span', 'plus', ' + '));
      header.appendChild(el('span', 'card-name', name));
    });
    header.appendChild(el('span', 'plus', ' + '));
    header.appendChild(el('span', 'either', 'any of ' + group.choices.length));
    card.appendChild(header);

    const choices = el('p', 'choices');
    group.choices.forEach((name, i) => {
      if (i > 0) choices.appendChild(document.createTextNode(' · '));
      choices.appendChild(el('span', 'card-name', name));
    });
    card.appendChild(choices);

    card.appendChild(resultChips(group.variants[0]));

    const details = el('details');
    details.appendChild(el('summary', null, `All ${group.variants.length} versions`));
    group.variants.forEach((v) => details.appendChild(comboCard(v, null)));
    card.appendChild(details);

    return card;
  }

  function cardLinks(name) {
    const links = el('span', 'card-links');
    links.appendChild(link('https://edhrec.com/cards/' + DeckCombos.edhrecSlug(name), 'EDHREC'));
    links.appendChild(document.createTextNode(' · '));
    links.appendChild(link('https://scryfall.com/search?q=' + encodeURIComponent('!"' + name + '"'), 'Scryfall'));
    return links;
  }

  // How many alternatives to spell out before folding the rest away. A group of
  // 17 is real — the whole list is a wall, and the first few make the point.
  const ALTERNATIVES_SHOWN = 5;

  // One suggestion, which may be a choice between cards that do the same job.
  // Grouping them matters: four cards each claiming "+7 combos" is four ways of
  // describing one decision, and reads as four decisions.
  function suggestionCard(group, rank, deckNames) {
    const card = el('article', 'combo suggestion');
    const [first, ...rest] = group.cards;

    const header = el('h3');
    header.appendChild(el('span', 'rank', rank + '. '));
    header.appendChild(el('span', 'card-name', first));
    header.appendChild(el('span', 'badge', '+' + group.unlocks.length + ' combo' + (group.unlocks.length === 1 ? '' : 's')));
    card.appendChild(header);

    const links = el('p', 'card-links');
    links.appendChild(cardLinks(first));
    card.appendChild(links);

    if (rest.length) {
      const alt = el('div', 'alternatives');
      alt.appendChild(el('span', 'alt-label',
        `or any one of these ${rest.length} instead — same ${group.unlocks.length === 1 ? 'combo' : 'combos'}:`));
      const shown = rest.slice(0, ALTERNATIVES_SHOWN);
      const list = el('ul', 'alt-list');
      shown.forEach((name) => {
        const li = el('li');
        li.appendChild(el('span', 'card-name', name));
        li.appendChild(cardLinks(name));
        list.appendChild(li);
      });
      alt.appendChild(list);

      if (rest.length > shown.length) {
        const more = el('details', 'alt-more');
        more.appendChild(el('summary', null, `${rest.length - shown.length} more`));
        const tail = el('ul', 'alt-list');
        rest.slice(ALTERNATIVES_SHOWN).forEach((name) => {
          const li = el('li');
          li.appendChild(el('span', 'card-name', name));
          li.appendChild(cardLinks(name));
          tail.appendChild(li);
        });
        more.appendChild(tail);
        alt.appendChild(more);
      }
      card.appendChild(alt);
    }

    const details = el('details');
    details.appendChild(el('summary', null, 'Combos this unlocks'));
    group.unlocks.forEach((v) => details.appendChild(comboCard(v, deckNames)));
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
    head.appendChild(el('span', 'rank', rank + '. '));
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
    // The per-card count says this already; a sentence restating it for the
    // top card is just noise above the list.
    pieces.forEach((p, i) => body.appendChild(pieceCard(p, i + 1)));
  }

  // Suggestions in two tabs. An off-colour card is still worth knowing about —
  // decks get rebuilt — but if your deck isn't red, a red card is noise while
  // you're reading the list, so it goes behind a tab instead of sitting in the
  // flow underneath.
  function renderSuggestions(container, onColour, offColour, deckNames, identity) {
    const total = onColour.length + offColour.length;
    const colours = identity && identity.size ? [...identity].join('').toUpperCase() : null;
    const body = panel(container, 'suggestions', 'Suggested additions', total || null);

    const tabs = [
      {
        id: 'in-colour',
        label: colours ? 'In your colours · ' + colours : 'In your colours',
        items: onColour,
        empty: 'No single-card addition would complete a combo in your colours.',
      },
      {
        id: 'off-colour',
        label: 'Other colours',
        items: offColour,
        empty: 'Nothing outside your colours would complete a combo either.',
      },
    ];

    const strip = el('div', 'tabs');
    strip.setAttribute('role', 'tablist');
    const built = [];

    tabs.forEach((tab, index) => {
      const button = el('button', 'tab');
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.id = 'tab-' + tab.id;
      button.setAttribute('aria-controls', 'pane-' + tab.id);
      button.appendChild(el('span', 'tab-label', tab.label));
      button.appendChild(el('span', 'tab-count', String(tab.items.length)));

      const pane = el('div', 'tab-pane');
      pane.id = 'pane-' + tab.id;
      pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('aria-labelledby', button.id);
      if (tab.items.length) {
        tab.items.forEach((s, i) => pane.appendChild(suggestionCard(s, i + 1, deckNames)));
      } else {
        pane.appendChild(el('p', 'empty', tab.empty));
      }

      const select = () => {
        built.forEach((b, i) => {
          const active = i === index;
          b.button.classList.toggle('is-active', active);
          b.button.setAttribute('aria-selected', String(active));
          b.button.tabIndex = active ? 0 : -1;
          b.pane.hidden = !active;
        });
      };
      button.addEventListener('click', select);

      built.push({ button, pane, select });
      strip.appendChild(button);
    });

    body.appendChild(strip);
    built.forEach((b) => body.appendChild(b.pane));

    // Open on whichever tab has something in it: landing on an empty "In your
    // colours" while suggestions sit unseen behind the other tab would read as
    // "there are no suggestions".
    (onColour.length || !offColour.length ? built[0] : built[1]).select();
  }

  // The header strip: the deck's colours as mana symbols, and who is leading it.
  //
  // The commander line is the interesting part. Nobody should have to type a
  // card that is already in the list they pasted, so when the box is empty the
  // commander is worked out from the deck — and labelled as worked out, because
  // an inference presented as a fact is worse than no answer.
  function renderIdentity(container, identity, commanderInfo) {
    container.textContent = '';
    // An empty set is colourless — a real identity, worth showing as {C}. Null
    // means the data couldn't tell us, which is worth showing as nothing.
    if (!identity) return;

    const line = el('p', 'identity-line');
    line.appendChild(el('span', 'identity-label', 'Colour identity'));
    line.appendChild(manaPips(identity));
    container.appendChild(line);

    if (!commanderInfo) return;

    const { commanders, source, candidates } = commanderInfo;
    if (commanders.length) {
      const p = el('p', 'commander-line');
      p.appendChild(el('span', 'commander-label', commanders.length > 1 ? 'Commanders' : 'Commander'));
      commanders.forEach((c, i) => {
        if (i) p.appendChild(el('span', 'plus', ' + '));
        p.appendChild(el('strong', 'card-name', c.card));
      });
      if (source === 'marked') p.appendChild(el('span', 'from-deck', 'marked in your list'));
      if (source === 'inferred') p.appendChild(el('span', 'from-deck', 'found in your list'));
      container.appendChild(p);
      return;
    }

    // Couldn't tell — say so, and show what it was choosing between rather than
    // picking one and being quietly wrong.
    if (candidates && candidates.length) {
      const p = el('p', 'commander-line muted');
      const few = candidates.slice(0, 4);
      p.appendChild(el('span', null,
        'No commander given, and several cards could be one: ' + few.join(', ')
        + (candidates.length > few.length ? `, and ${candidates.length - few.length} more` : '')
        + '. Colours come from the deck itself.'));
      container.appendChild(p);
    }
  }

  function renderResults(results, deckNames) {
    $('results').hidden = false;

    renderIdentity($('identity'), results.identity, results.commanderInfo);

    const included = results.included;
    // Grouped, so "Scurry Oak + Archangel of Thune + Soul Warden" and the same
    // combo with Essence Warden in that slot are one row rather than three.
    const groups = DeckCombos.groupVariants(included);
    const includedBody = panel($('included'), 'included', 'Combos in your deck', groups.length || null);
    if (groups.length) {
      groups.forEach((g) => includedBody.appendChild(comboGroupCard(g)));
    } else {
      includedBody.appendChild(el('p', 'empty', 'No known combos found in this deck.'));
    }

    renderPieces($('pieces'), included);

    renderSuggestions(
      $('suggestions'),
      DeckCombos.groupSuggestions(DeckCombos.computeSuggestions(results.almostIncluded, deckNames), deckNames),
      DeckCombos.groupSuggestions(DeckCombos.computeSuggestions(results.almostIncludedByAddingColors, deckNames), deckNames),
      deckNames,
      results.identity
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
    // Anything typed in the commander box counts as a commander, and so does a
    // "Commander:" heading or a "*CMDR*" marker inside the main paste.
    const typed = commanderParsed.main.concat(commanderParsed.commanders);
    let commanders = typed.concat(parsed.commanders);
    // Where the answer came from decides how the header labels it: typed is a
    // statement, anything else is us reading the deck.
    let commanderSource = typed.length ? 'typed' : (parsed.commanders.length ? 'marked' : null);
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
      const allEntries = commanders.concat(main);
      const deckNames = DeckCombos.deckNameSet(allEntries);

      // With the commander box empty, look for the commander among the cards
      // themselves. A confident answer is used exactly as if it had been typed;
      // an unsure one is shown as a shortlist and changes nothing, so colours
      // still come from the deck's own cards.
      const detected = commanders.length ? null : DeckCombos.detectCommanders(allEntries, data);
      let effective = commanders;
      if (detected && detected.confident) {
        effective = detected.commanders;
        commanderSource = 'inferred';
      }

      const matched = DeckCombos.matchDeck(data, deckNames, effective);
      const results = {
        identity: matched.identity,
        commanderInfo: {
          commanders: effective,
          source: commanderSource,
          candidates: (detected && detected.candidates) || [],
        },
        included: matched.included.map(DeckCombos.expand),
        almostIncluded: matched.almostIncluded.map(DeckCombos.expand),
        almostIncludedByAddingColors: matched.almostIncludedByAddingColors.map(DeckCombos.expand),
      };
      // A sideboard being left out is the parser doing its job, not a problem
      // report. Only lines we could not make sense of are worth interrupting
      // over — a 26-card maybeboard raising a warning trains people to ignore it.
      const ignored = parsed.skipped.filter((s) => /sideboard|ignored section/i.test(s.reason));
      const unparsed = parsed.skipped.filter((s) => !ignored.includes(s));

      const notes = [];
      if (ignored.length) notes.push(`${ignored.length} sideboard line(s) left out`);
      if (unparsed.length) notes.push(`${unparsed.length} line(s) not understood`);
      notes.push(...trimmed);
      notes.unshift(`${data.combos.length.toLocaleString()} known combos`);
      setStatus('Searched ' + (main.length + commanders.length) + ' cards against ' + notes.join('; ') + '.');
      renderResults(results, deckNames);
      if (unparsed.length) showDiagnostics(null, parsed, 'notice');
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
