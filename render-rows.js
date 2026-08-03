// The shared vocabulary every result row is built from: mana pips, result chips, card
// links, the + Add to deck button, the size breakdown, the two-number split line.
//
// This file is the answer to the question that made splitting app.js's rendering awkward:
// a combo row, a suggestion row, a piece row and a one-slot-away row are four different
// things built from the same handful of pieces. Without somewhere shared to put them, the
// two renderers below would each have needed half of them, or a copy.
//
// It is not page-dom.js, and the line between them is worth keeping: that file is markup
// plumbing with no opinions, and resultChips() sorts by tier and folds past the fourth,
// which is closer to a decision. The decisions themselves — what a sentence says, how a
// number is phrased — are still in view-model.js where node --test can reach them; what is
// here is the DOM those decisions get poured into.
(function (global) {
  'use strict';

  const Dom = global.PageDom || (typeof require === 'function' ? require('./page-dom.js') : null);
  const { $, el, link, setStatus } = Dom;

  // Where a combo's own page lives. Here rather than in app.js because both renderers
  // link to it and neither should carry its own copy of the URL.
  const SPELLBOOK_COMBO_URL = 'https://commanderspellbook.com/combo/';

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

  // The cards of a combo, alphabetically. Spellbook lists them in the order the
  // combo was authored in, which means two rows sharing the same pieces can name
  // them in different orders — and with no description shown, that order carries
  // nothing. Alphabetical makes a row scannable and two rows comparable.
  const alphabetical = (names) => names.slice().sort((a, b) => a.localeCompare(b));

  // `lead` puts the card the reader is already looking at first; `trail` sends the
  // interchangeable cards of a collapsed group last. The rule itself lives in
  // combos.js beside the data it orders, where it can be tested without a browser —
  // see orderComboNames() there for why each exists.
  function comboCardNames(variant, lead, trail) {
    return DeckCombos.orderComboNames(DeckCombos.variantCardNames(variant), { lead, trail });
  }


  function cardLinks(name) {
    const links = el('span', 'card-links');
    links.appendChild(link('https://edhrec.com/cards/' + DeckCombos.edhrecSlug(name), 'EDHREC'));
    links.appendChild(document.createTextNode(' · '));
    links.appendChild(link('https://scryfall.com/search?q=' + encodeURIComponent('!"' + name + '"'), 'Scryfall'));
    return links;
  }


  // A suggestion is a decision, and until now the step after taking one was to
  // type the card into the box yourself and press the button again. The dataset is
  // already parsed and sitting in the worker, so searching again is a walk over
  // memory — which is what makes this worth a button rather than a note.

  // What the next search should say it was for. The search that follows an add
  // writes its own status line the moment it finishes, so "Added X" would be on
  // screen for about as long as it took to read the first word — the note has to
  // survive into that line instead of being replaced by it.
  let addedNote = null;

  function addCardToDeck(name) {
    const box = $('decklist');
    // Both boxes, the same two the search itself reads: a card already in the
    // command zone is already in the deck, and adding it again is not an edit.
    const decklist = DeckParser.parseDecklist(box.value);
    const commanders = DeckParser.parseDecklist($('commanders').value);
    const held = DeckCombos.deckNameSet(
      decklist.main.concat(decklist.commanders, commanders.main, commanders.commanders)
    );
    if (held.has(DeckCombos.nameKey(name))) {
      setStatus(name + ' is already in this decklist.');
      return;
    }

    // Written with a quantity, so the line reads like every other line in the box
    // and survives being copied out of it — and written into the *main deck*, which
    // is not always the end of the box. A list ending in "Sideboard:" is how several
    // sites export, and a card appended below that heading is parsed as a sideboard
    // card: it never enters the deck, so the next search still suggests it and the
    // button looks like it did nothing. DeckParser knows where the sections are.
    box.value = DeckParser.addMainDeckCard(box.value, name, 1);
    DeckIO.saveDeck();
    addedNote = name;
    setStatus('Added ' + name + ' — searching again…');

    // Through the form rather than by calling the handler: the form is what knows
    // what a search involves — disabling the button, clearing the last report,
    // re-reading both boxes — and none of that should have a second path.
    const form = $('deck-form');
    if (typeof form.requestSubmit === 'function') form.requestSubmit($('find-combos'));
    else form.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  function addButton(name, label) {
    const button = el('button', 'add-card', label || '+ Add to deck');
    button.type = 'button';
    // The visible label is short because it sits at the end of a row of links;
    // what it will do is spelled out for a screen reader and on hover.
    const spoken = 'Add ' + name + ' to your decklist and search again';
    button.title = spoken;
    button.setAttribute('aria-label', spoken);
    button.addEventListener('click', () => addCardToDeck(name));
    return button;
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
  // Rendered inline, on the same line as the card and its count, so the whole
  // recommendation is one line: "Herd Baloth +10  1 × 2-card  9 × 3-card". A
  // second line per row costs 80 lines down a list this long, and the pills are
  // short enough not to need one.
  //
  // Unlabelled on purpose. "1 × 2-card" beside a count, under a heading reading
  // "Suggested additions", does not need a caption telling the reader it is about
  // combo sizes — and a caption repeated on every row is 80 of them.
  function sizeRow(variants) {
    // Slate pills, deliberately not the green/yellow/grey a result uses: those say
    // what a combo achieves, and "2-card" must not read as "this wins". What each
    // pill says, and which one is marked easiest, is DeckView.sizePills().
    const pills = DeckView.sizePills(DeckCombos.sizeBreakdown(variants));
    if (!pills.length) return null;

    const row = el('span', 'sizes');
    pills.forEach((p) => {
      const pill = el('span', 'size' + (p.easiest ? ' is-easiest' : ''), p.label);
      pill.title = p.title;
      row.appendChild(pill);
    });
    return row;
  }

  function alternativeItem(name) {
    const li = el('li');
    // The name is the column that gives way when the row is too narrow, clipped with
    // an ellipsis in CSS rather than shortened here — the text stays whole in the DOM
    // that way. The title is for the pointer, which has nothing else to go on once
    // the drawing stops early.
    const cardName = el('span', 'card-name', name);
    cardName.title = name;
    li.appendChild(cardName);
    li.appendChild(cardLinks(name));
    li.appendChild(addButton(name, '+ Add'));
    return li;
  }

  // Every card in one choice, on one Scryfall page, with the images that make the
  // choice possible to actually make. Sixteen alternatives is sixteen tabs
  // otherwise, and the row of links beside each name only ever goes to one card.
  //
  // A link and not a button on purpose: Scryfall serves this as a GET, so the
  // comparison costs this page no request, needs no JavaScript to have run, and
  // opens in a new tab like every other card link here. It is styled as a button
  // because that is what it does.
  // A link that opens a set of cards on one Scryfall page. Two callers, and they need
  // two different verbs, because they are asking two different things of the reader:
  //
  //   - a choice between interchangeable cards is a *comparison* — the point is to
  //     weigh them and pick one
  //   - the cards a combo needs are not alternatives at all, they are all required.
  //     Calling that "compare" invites the reader to choose between them, which is
  //     the opposite of what the row means.
  //
  // So the label and the spoken name are the caller's, and only the query is shared.
  function cardsOnScryfall(names, label, spoken) {
    const query = DeckCombos.scryfallSetQuery(names);
    if (!query) return null;
    const a = link('https://scryfall.com/search?q=' + encodeURIComponent(query), label);
    a.className = 'alt-all';
    // An icon-free pill saying "all 3" does not say where it goes; the accessible name
    // and the tooltip do.
    a.title = spoken;
    a.setAttribute('aria-label', spoken);
    return a;
  }

  // Where a count is part Spellbook's and part ours: one number on the row, and
  // the split on a quiet second line beneath it.
  //
  // The badge carries the total because the panels are ranked columns and the
  // question each answers — what does cutting this cost, what would adding this
  // give me — is answered by the total before anything else is read. Two badges
  // made the reader add them up; one badge and no split hid half the answer.
  //
  // The line appears only on the rows that have a split, so the majority of rows
  // are exactly what they were. The unofficial half is in the accent — the colour
  // the page already spends on its own links and buttons, and the one colour that
  // means "the site talking" rather than "a property of the combo". Green, khaki
  // and grey are the result tiers, and a fourth hue in that family would read as
  // a fourth tier.
  //
  // Written out in words rather than parked in a tooltip: "5 unofficial" is the
  // whole claim, and a claim a reader has to hover to find is one the page is
  // hiding.
  function splitLine(official, ours, plus) {
    const parts = DeckView.splitParts(official, ours, plus);
    if (!parts) return null;
    const line = el('p', 'split-line');
    if (parts.official) {
      line.appendChild(document.createTextNode(parts.official));
      line.appendChild(el('span', 'dot', ' · '));
    }
    line.appendChild(el('span', 'ours', parts.ours));
    if (parts.none) {
      line.appendChild(el('span', 'dot', ' · '));
      line.appendChild(document.createTextNode(parts.none));
    }
    return line;
  }


  // Set when + Add to deck was pressed and read exactly once, by the render that follows
  // the re-search it triggers. A getter that clears is the honest shape for that: the note
  // belongs to one render and leaving it set would repeat it on the next one.
  function takeAddedNote() {
    const name = addedNote;
    addedNote = null;
    return name;
  }

  const api = { SPELLBOOK_COMBO_URL, ALTERNATIVES_SHOWN, manaPips, resultChips, alphabetical, comboCardNames, cardLinks, addCardToDeck, addButton, sizeRow, alternativeItem, cardsOnScryfall, splitLine, takeAddedNote };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.RenderRows = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
