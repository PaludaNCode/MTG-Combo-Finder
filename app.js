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

  const SPELLBOOK_COMBO_URL = 'https://commanderspellbook.com/combo/';
  const ARCHIDEKT_API = 'https://archidekt.com/api/decks/';
  const DATA_URL = /github\.io$/.test(location.hostname)
    ? 'https://raw.githubusercontent.com/PaludaNCode/MTG-Combo-Finder/data/combos.json'
    : 'combos.json'; // local checkout / any other host

  const $ = (id) => document.getElementById(id);

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
    // A combo can ask for "a Persist Creature" rather than a named card. Show
    // the slot as Spellbook words it, and next to it the card of yours that
    // fills it — a combo that appears because of a slot has to be able to say
    // why, or it reads as the page making things up.
    (variant.fills || []).forEach((fill) => {
      header.appendChild(el('span', 'plus', ' + '));
      const slot = el('span', 'slot', fill.slot);
      slot.title = 'A slot, not a specific card — filled here by ' + fill.card;
      header.appendChild(slot);
    });

    card.appendChild(header);

    if ((variant.fills || []).length) {
      const filled = el('p', 'fills');
      filled.appendChild(el('span', 'fills-label', 'From your deck: '));
      variant.fills.forEach((fill, i) => {
        if (i > 0) filled.appendChild(document.createTextNode(' · '));
        filled.appendChild(el('span', 'card-name', fill.card));
        filled.appendChild(document.createTextNode(' as ' + fill.slot));
      });
      card.appendChild(filled);
    }

    card.appendChild(resultChips(variant));

    // No "how it works" here on purpose. Spellbook writes one, but the fetcher
    // does not publish it (test/scanner.test.js pins that): a description for
    // every one of ~100k combos would multiply the download the page already
    // makes. The link below goes to the combo's own page, which has the steps.
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

  // What a suggestion's count is actually made of, card by card: "1 × 2-card,
  // 9 × 3-card". A two-card combo is far easier to assemble in a game than a
  // four-card one, and "+10 combos" hides the difference completely — a card
  // whose ten combos all need four pieces reads exactly like one that hands you
  // a two-card line.
  //
  // The smallest is marked, because that is the one being looked for. The parts
  // sum to the badge beside them, so there is no second total to reconcile.
  function sizeRow(variants) {
    const breakdown = DeckCombos.sizeBreakdown(variants);
    if (!breakdown.length) return null;
    // One combo of one size is what the header already says.
    if (breakdown.length === 1 && breakdown[0].count === 1) {
      const only = el('p', 'sizes');
      only.appendChild(el('span', 'size is-easiest', breakdown[0].size + '-card combo'));
      return only;
    }

    const row = el('p', 'sizes');
    row.appendChild(el('span', 'sizes-label', 'Combo sizes'));
    breakdown.forEach(({ size, count }, i) => {
      // Slate, deliberately not the green/yellow/grey a result uses: those say
      // what a combo achieves, and "2-card" must not read as "this wins".
      const pill = el('span', 'size' + (i === 0 ? ' is-easiest' : ''), count + ' × ' + size + '-card');
      pill.title = count === 1
        ? `One combo needing ${size} cards on the table`
        : `${count} combos needing ${size} cards on the table`;
      row.appendChild(pill);
    });
    return row;
  }

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

    const sizes = sizeRow(group.unlocks);
    if (sizes) card.appendChild(sizes);

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

  // How many cards that fill a slot to name before the number has to speak for
  // itself. Six is enough to recognise what kind of card is wanted.
  const CANDIDATES_SHOWN = 6;

  // A combo you hold every named card for, and cannot assemble because nothing
  // in the deck fills its slot. These used to be dropped in silence, which is
  // the one thing they should not be: "you have Rings of Brighthearth and need
  // any Persist Creature" is a deckbuilding decision, and an invisible one.
  //
  // It is deliberately not phrased as a suggestion. There is no single card to
  // recommend for a slot 394 cards fill, so the row reports the slot, how many
  // cards fill it, and a few of them — ranked by how many of *your* stuck combos
  // each would complete, which is read off your own list.
  function slotAwayCard(variant, candidates) {
    const card = el('article', 'combo slot-away');

    const header = el('h3');
    DeckCombos.variantCardNames(variant).forEach((name, i) => {
      if (i > 0) header.appendChild(el('span', 'plus', ' + '));
      header.appendChild(el('span', 'card-name', name));
    });
    (variant.fills || []).forEach((fill) => {
      header.appendChild(el('span', 'plus', ' + '));
      const slot = el('span', 'slot', fill.slot);
      slot.title = 'A slot, not a specific card — filled here by ' + fill.card;
      header.appendChild(slot);
    });
    (variant.gaps || []).forEach((gap) => {
      header.appendChild(el('span', 'plus', ' + '));
      header.appendChild(el('span', 'slot slot-missing', gap.slot));
    });
    card.appendChild(header);

    (variant.gaps || []).forEach((gap) => {
      const need = el('p', 'gap');
      const found = candidates && candidates[String(gap.id)];
      if (!found || !found.total) {
        // Spellbook attaches no Scryfall query to 29 of its templates, so there
        // is no card list to offer. Saying so beats implying the slot is narrow.
        need.appendChild(el('span', 'gap-label', 'Needs ' + gap.slot + ' — '));
        need.appendChild(document.createTextNode('no card list published for this slot yet.'));
        card.appendChild(need);
        return;
      }
      need.appendChild(el('span', 'gap-label', 'Needs ' + gap.slot + ' — '));
      need.appendChild(document.createTextNode(
        found.total + ' card' + (found.total === 1 ? '' : 's') + ' fill it'
        + (found.inColour < found.total ? `, ${found.inColour} in your colours` : '') + '.'
      ));
      card.appendChild(need);

      if (found.names.length) {
        const list = el('p', 'candidates');
        list.appendChild(el('span', 'gap-label', 'For example: '));
        found.names.slice(0, CANDIDATES_SHOWN).forEach((name, i) => {
          if (i > 0) list.appendChild(document.createTextNode(' · '));
          list.appendChild(el('span', 'card-name', name));
          list.appendChild(cardLinks(name));
        });
        card.appendChild(list);
      }
    });

    card.appendChild(resultChips(variant));

    if (variant.id) {
      const p = el('p', 'combo-link');
      p.appendChild(link(SPELLBOOK_COMBO_URL + encodeURIComponent(variant.id) + '/', 'View on Commander Spellbook →'));
      card.appendChild(p);
    }

    return card;
  }

  function renderSlots(container, rows, candidates) {
    if (!rows.length) {
      container.textContent = '';
      return;
    }
    const body = panel(container, 'slots', 'One slot away', rows.length);
    body.appendChild(el('p', 'empty',
      'Every card these combos name is already in your deck. What each one is short of is a slot — '
      + 'a kind of card rather than a specific one — so there is no single card to recommend.'));
    rows.forEach((row) => body.appendChild(slotAwayCard(row, candidates)));
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

  // The header strip: the deck's colours as mana symbols.
  //
  // Colours are read off the cards, not off a commander. The deck used to be
  // searched for a commander whenever the box was empty, and where several
  // legendary creatures could fit it offered a shortlist to choose from — a
  // guess, plus a question, in place of an answer the decklist already gives.
  // Every card in the list is a card the deck plays, so the cards settle it.
  //
  // A commander that *was* given still matters: it is part of the deck, so its
  // colours are in here along with everything else's.
  function renderIdentity(container, identity) {
    container.textContent = '';
    // An empty set is colourless — a real identity, worth showing as {C}. Null
    // means the data couldn't tell us, which is worth showing as nothing.
    if (!identity) return;

    const line = el('p', 'identity-line');
    line.appendChild(el('span', 'identity-label', 'Colour identity'));
    line.appendChild(manaPips(identity));
    container.appendChild(line);
  }

  function renderResults(results, deckNames) {
    $('results').hidden = false;

    renderIdentity($('identity'), results.identity);

    const included = results.included;
    // Grouped, so "Scurry Oak + Archangel of Thune + Soul Warden" and the same
    // combo with Essence Warden in that slot are one row rather than three.
    const groups = DeckCombos.groupVariants(included);
    // The count is every combo, not every row. Collapsing "Scurry Oak + Sadistic
    // Glee + Carrion Feeder" and its Viscera Seer version into one row makes the
    // list readable, but they are still two combos, and a deck with 34 of them
    // should not be told it has 23. Each row says how many versions it holds.
    const includedBody = panel($('included'), 'included', 'Combos in your deck', included.length || null);
    if (groups.length) {
      groups.forEach((g) => includedBody.appendChild(comboGroupCard(g)));
    } else {
      includedBody.appendChild(el('p', 'empty', 'No known combos found in this deck.'));
    }

    renderSlots($('slots'), results.oneSlotAway || [], results.slotCandidates || {});

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
  //
  // Downloading, parsing and matching all happen in search-worker.js. The
  // published file is ~25 MB of JSON over ~100k combos, and doing that here
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

  async function inPageSearch(entries) {
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
    const allEntries = commanders.concat(main);
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
      setStatus('Searched ' + (main.length + commanders.length) + ' cards against ' + notes.join('; ') + '.');
      renderResults(results, deckNames);
      renderDataAge(results.meta);
      saveDeck();
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
    line.dataset.source = meta.source || 'network';
    line.dataset.via = lastVia || 'unknown';
    line.title = meta.source === 'cache'
      ? 'Read from the copy your browser kept, and checked for a newer one in the background.'
      : 'Downloaded just now and kept for next time.';
    line.hidden = false;
  }

  // ---- keeping the decklist ------------------------------------------------
  //
  // A reload used to lose whatever was pasted in, which is a strange thing for a
  // page whose entire input is a long paste. The list is kept locally — it never
  // leaves the browser — and a link can carry it deliberately.
  const DECK_KEY = 'mtg-combo-finder.deck';

  function saveDeck() {
    try {
      localStorage.setItem(DECK_KEY, JSON.stringify({
        decklist: $('decklist').value,
        commanders: $('commanders').value,
      }));
    } catch (err) {
      /* private mode, or over quota — not worth bothering the reader about */
    }
  }

  // base64url, because a decklist is full of newlines and commas and the URL has
  // to survive being pasted into a chat window.
  function encodeDeck(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeDeck(param) {
    const padded = param.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function shareLink() {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('deck', encodeDeck($('decklist').value));
    const commanders = $('commanders').value.trim();
    if (commanders) url.searchParams.set('cmd', encodeDeck(commanders));
    return url.href;
  }

  // A link wins over the stored list: someone who opens a shared deck means to
  // see that deck, not the one they were last working on.
  function restoreDeck() {
    const params = new URLSearchParams(location.search);
    if (params.has('deck')) {
      try {
        $('decklist').value = decodeDeck(params.get('deck'));
        $('commanders').value = params.has('cmd') ? decodeDeck(params.get('cmd')) : '';
        setStatus('Deck loaded from the link. Press “Find combos”.');
        return;
      } catch (err) {
        setStatus('That shared link’s decklist could not be read — paste the list below instead.', true);
      }
    }
    try {
      const saved = JSON.parse(localStorage.getItem(DECK_KEY)) || {};
      if (saved.decklist) $('decklist').value = saved.decklist;
      if (saved.commanders) $('commanders').value = saved.commanders;
    } catch (err) {
      /* nothing kept, or junk in there */
    }
  }

  function clearDeck() {
    $('decklist').value = '';
    $('commanders').value = '';
    $('deck-url').value = '';
    try {
      localStorage.removeItem(DECK_KEY);
    } catch (err) {
      /* nothing to remove */
    }
    // Leaving ?deck= in the address bar would resurrect the list on reload.
    if (location.search) history.replaceState(null, '', location.pathname);
    $('results').hidden = true;
    $('diagnostics').hidden = true;
    const age = $('data-age');
    if (age) age.hidden = true;
    setStatus('Cleared.');
    $('decklist').focus();
  }

  let saveTimer = null;
  function saveDeckSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDeck, 400);
  }

  $('deck-form').addEventListener('submit', onSubmit);
  $('load-deck').addEventListener('click', loadDeckUrl);
  $('decklist').addEventListener('input', saveDeckSoon);
  $('commanders').addEventListener('input', saveDeckSoon);
  $('clear-deck').addEventListener('click', clearDeck);
  $('copy-link').addEventListener('click', () => {
    const button = $('copy-link');
    if (!$('decklist').value.trim() && !$('commanders').value.trim()) {
      setStatus('Nothing to share yet — paste a decklist first.', true);
      return;
    }
    const href = shareLink();
    history.replaceState(null, '', href);
    navigator.clipboard.writeText(href).then(
      () => { button.textContent = 'Link copied'; setTimeout(() => { button.textContent = 'Copy link'; }, 2000); },
      () => { setStatus('Could not copy — the link is in the address bar, copy it from there.'); }
    );
  });

  restoreDeck();
})();
