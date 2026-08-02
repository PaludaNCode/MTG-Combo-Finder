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

  // ---- how a combo is actually executed ------------------------------------
  //
  // A disclosure on the combo row: pressed, it fetches the steps for that one
  // combo and draws them underneath. Collapsed by default and collapsed on every
  // row — a list of twenty-two combos is a list, and twenty-two sets of steps is
  // a document nobody asked for.
  //
  // Four states, and the last two matter as much as the first two: the steps are
  // fetched, so they can be slow, they can fail, and Spellbook can simply not have
  // written any. Each says what happened and leaves the link beside the control as
  // the way out. See combo-steps.js for where the text comes from.
  let disclosureSeq = 0;

  function stepsList(data, derived) {
    const body = el('div', 'steps-body');

    // An unofficial row borrows the published combo's steps, and the whole point
    // of the row is that one card has been swapped — so the steps name a card the
    // reader does not have. Saying so is not optional: unattributed, this panel
    // would be the page quietly printing instructions that do not match the deck.
    const swaps = derived ? (derived.swaps || (derived.swap ? [derived.swap] : [])) : [];
    if (swaps.length) {
      const caveat = el('p', 'steps-caveat');
      caveat.appendChild(document.createTextNode('These are the published combo’s steps. Read '));
      swaps.forEach((step, i) => {
        if (i > 0) caveat.appendChild(document.createTextNode(', and '));
        caveat.appendChild(el('span', 'card-name', step.out));
        caveat.appendChild(document.createTextNode(' as '));
        caveat.appendChild(el('span', 'card-name', step.in));
      });
      caveat.appendChild(document.createTextNode('.'));
      body.appendChild(caveat);
    }

    if (data.prerequisites.length) {
      body.appendChild(el('h4', 'steps-head', 'Before you start'));
      const ul = el('ul', 'steps-pre');
      data.prerequisites.forEach((line) => ul.appendChild(el('li', null, line)));
      body.appendChild(ul);
    }

    if (data.steps.length) {
      body.appendChild(el('h4', 'steps-head', 'Then, in order'));
      // A real <ol>: these are a sequence, the numbers carry the order, and a
      // reader who loses their place mid-loop needs them.
      const ol = el('ol', 'steps-list');
      data.steps.forEach((line) => ol.appendChild(el('li', null, line)));
      body.appendChild(ol);
    }

    return body;
  }

  function stepsDisclosure(comboId, derived) {
    // Optional, like the unofficial rows are to search.js: if the file did not
    // arrive, the row keeps its link and loses a control it never had.
    if (typeof ComboSteps === 'undefined' || !ComboSteps) return null;

    const id = 'steps-' + (disclosureSeq += 1);
    const control = el('button', 'steps-toggle');
    control.type = 'button';
    control.setAttribute('aria-expanded', 'false');
    control.setAttribute('aria-controls', id);
    control.appendChild(el('span', 'chev', '▸'));
    control.appendChild(document.createTextNode('How it works'));

    const panel = el('div', 'steps');
    panel.id = id;
    panel.hidden = true;

    let loaded = false;
    // Waiting, failed and "there aren't any" all go here. The panel drops its
    // quoted-block styling for them: a line saying there is nothing to read
    // should not occupy the page as heavily as three steps that there are.
    const say = (className, text) => {
      panel.textContent = '';
      panel.classList.add('is-note');
      panel.appendChild(el('p', className, text));
    };

    control.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      control.setAttribute('aria-expanded', String(open));
      control.classList.toggle('is-open', open);
      if (!open || loaded) return;

      // Only fetched once, and only when someone asks. A row nobody opens costs
      // nothing, which is the entire reason the steps are not in the download.
      loaded = true;
      say('steps-pending', 'Looking up the steps…');
      ComboSteps.get(comboId).then((data) => {
        if (data && data.error) {
          // Retryable, unlike a combo with no steps — so the next press asks again.
          loaded = false;
          say('steps-note', 'Could not load the steps: ' + data.error
            + '. The link beside this one goes to the combo’s own page, which has them.');
          return;
        }
        if (!data) {
          say('steps-note', 'No steps recorded for this combo yet.');
          return;
        }
        panel.textContent = '';
        panel.classList.remove('is-note');
        panel.appendChild(stepsList(data, derived));
      });
    });

    return { control, panel };
  }

  // `opts.steps` puts the "How it works" disclosure on the row. Off by default,
  // and deliberately not on every row that draws a combo: the steps are how you
  // execute a line you have, so they belong on the two panels that answer "what
  // can this deck do" — the combos found and the unofficial ones — and nowhere
  // else. A suggestion is a combo the deck cannot assemble yet, a one-slot-away
  // row is the same, and the pieces panel relists combos the found panel has
  // already offered them on, once per card in each. Left on all four, a page
  // carried 429 controls, most of them a second or third way to ask the same
  // question.
  function comboCard(variant, deckNames, lead, trail, opts) {
    const card = el('article', 'combo');

    const header = el('h3');
    comboCardNames(variant, lead, trail).forEach((name, i) => {
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

    // Above the results, not below them. What a combo *needs* is read before what it
    // *does*: the cards decide whether the row is worth reading at all, and a reader
    // who wants the steps or the card images should not have to scroll past a wall of
    // result chips to find the way out.
    //
    // The steps are not published with the combos — a description for every one of
    // ~100k combos would multiply the download the page already makes, and
    // test/scanner.test.js pins that the fetcher drops them. They are fetched for
    // the one combo a reader stops on, by combo-steps.js, from this same line: the
    // line that used to exist only to send people away now offers to bring the
    // answer here first, and keeps the link as the way out when it cannot.
    //
    // An unofficial row has no page of its own to link to — that is what makes it
    // unofficial. It links to the published combo it was derived from instead, which
    // is also the evidence for it, so a reader can go and judge the swap.
    const derived = variant.unofficial;
    const linkId = derived ? derived.from && derived.from.id : variant.id;
    if (linkId) {
      const p = el('p', 'combo-link');
      const steps = opts && opts.steps ? stepsDisclosure(linkId, derived) : null;
      if (steps) {
        p.appendChild(steps.control);
        p.appendChild(document.createTextNode(' · '));
      }
      p.appendChild(link(
        SPELLBOOK_COMBO_URL + encodeURIComponent(linkId) + '/',
        derived ? 'View the published combo this came from →' : 'View on Commander Spellbook →'
      ));
      // Every card in the combo on one Scryfall page. One link rather than a link per
      // name: a four-card combo would carry four, and the heading is the combo, not a
      // list of links — and reading the cards is one action, so it is one press.
      //
      // Named cards only. A template slot has no card to open, and the row already
      // names what fills it.
      const cards = DeckCombos.variantCardNames(variant);
      const compare = cardsOnScryfall(
        cards,
        `See all ${cards.length} cards`,
        `Open all ${cards.length} cards in this combo on Scryfall`
      );
      if (compare) {
        p.appendChild(document.createTextNode(' · '));
        p.appendChild(compare);
      }
      card.appendChild(p);
      // Directly under the control that opens it. A disclosure that opens
      // somewhere else on the row reads as something else happening.
      if (steps) card.appendChild(steps.panel);
    }

    // Why we think this one works, on the row rather than in a footnote. A combo
    // nobody has published is only worth showing if it shows its working.
    if (derived) {
      const note = el('p', 'derived-note');
      note.appendChild(el('span', 'derived-badge ' + derived.confidence, derived.confidence));
      // Usually one swap. A row may instead name a chain of them, and then the
      // reader is owed every step: "B in place of A, then D in place of C" is a
      // weaker claim than one swap, and hiding the second step would be the one
      // thing this note exists to prevent.
      const steps = derived.swaps || (derived.swap ? [derived.swap] : []);
      steps.forEach((step, i) => {
        note.appendChild(document.createTextNode(i ? ', then ' : ' '));
        note.appendChild(el('span', 'card-name', step.in));
        note.appendChild(document.createTextNode(' in place of '));
        note.appendChild(el('span', 'card-name', step.out));
        if (i === steps.length - 1) note.appendChild(document.createTextNode('. '));
      });
      note.appendChild(document.createTextNode(derived.why || ''));
      card.appendChild(note);
    }

    card.appendChild(resultChips(variant));

    return card;
  }

  // A combo you can already assemble, with the parts that are interchangeable
  // shown as a choice rather than as separate combos. The variants are real and
  // still reachable — each keeps its own link to Spellbook.
  function comboGroupCard(group) {
    if (group.choices.length < 2) return comboCard(group.variants[0], null, null, null, { steps: true });

    const card = el('article', 'combo');

    const header = el('h3');
    alphabetical(group.shared).forEach((name, i) => {
      if (i > 0) header.appendChild(el('span', 'plus', ' + '));
      header.appendChild(el('span', 'card-name', name));
    });
    header.appendChild(el('span', 'plus', ' + '));
    header.appendChild(el('span', 'either', 'any of ' + group.choices.length));
    card.appendChild(header);

    const choices = el('p', 'choices');
    alphabetical(group.choices).forEach((name, i) => {
      if (i > 0) choices.appendChild(document.createTextNode(' · '));
      choices.appendChild(el('span', 'card-name', name));
    });
    card.appendChild(choices);

    // Same order as the rows above: what it needs, then what it does.
    // The same one-press look at the cards the other rows get. A collapsed row asks
    // for its shared cards plus one of the interchangeable ones, so the comparison
    // covers the whole set — that is what the reader is choosing between.
    const groupCards = alphabetical(group.shared).concat(alphabetical(group.choices));
    const groupCompare = cardsOnScryfall(
      groupCards,
      `See all ${groupCards.length} cards`,
      `Open all ${groupCards.length} cards this row involves on Scryfall`
    );
    if (groupCompare) {
      const p = el('p', 'combo-link');
      p.appendChild(groupCompare);
      card.appendChild(p);
    }

    card.appendChild(resultChips(group.variants[0]));

    const details = el('details');
    details.appendChild(el('summary', null, `All ${group.variants.length} versions`));
    // The interchangeable cards go last in every version, so each row reads in the
    // same shape as the heading above them — the shared cards, then the one that
    // makes this version this version.
    group.variants.forEach((v) => details.appendChild(comboCard(v, null, null, group.choices, { steps: true })));
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

  // ---- taking a suggestion -------------------------------------------------
  //
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
    saveDeck();
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
    const breakdown = DeckCombos.sizeBreakdown(variants);
    if (!breakdown.length) return null;

    const row = el('span', 'sizes');
    // A single combo needs no multiplier: "2-card" says it.
    const only = breakdown.length === 1 && breakdown[0].count === 1;
    breakdown.forEach(({ size, count }) => {
      // Two cards is as small as a combo gets, so a two-card pill is the easiest
      // thing on the page and the one worth marking. Filling whichever pill
      // happens to be smallest on its row would instead mark "smallest of one
      // size" — a card whose seven combos all need three would light up for it.
      const easiest = size <= 2;
      // Slate, deliberately not the green/yellow/grey a result uses: those say
      // what a combo achieves, and "2-card" must not read as "this wins".
      const label = only ? size + '-card' : count + ' × ' + size + '-card';
      const pill = el('span', 'size' + (easiest ? ' is-easiest' : ''), label);
      pill.title = count === 1
        ? `One combo needing ${size} cards on the table`
        : `${count} combos needing ${size} cards on the table`;
      row.appendChild(pill);
    });
    return row;
  }

  // One interchangeable card: its name, where to read about it, and a way to take
  // it. Two lists render these — the first few, and the folded-away remainder.
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
    if (!ours) return null;
    const line = el('p', 'split-line');
    const n = (count) => (plus ? '+' : '') + count;
    if (official) {
      line.appendChild(document.createTextNode(n(official) + ' official'));
      line.appendChild(el('span', 'dot', ' · '));
    }
    line.appendChild(el('span', 'ours', n(ours) + ' unofficial'));
    // A card whose whole case is ours says so, rather than leaving the reader to
    // infer it from a missing half.
    if (!official) {
      line.appendChild(el('span', 'dot', ' · '));
      line.appendChild(document.createTextNode('none published'));
    }
    return line;
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
    // Just the number. The word was carrying nothing that the panel heading and
    // the size pills beside it do not already say, and it was repeated on every
    // row — but the meaning still has to reach a screen reader, so it moves into
    // the label rather than disappearing.
    // The total, because a card that would unlock three published combos and five
    // of ours is an eight-combo decision. What kind of eight it is goes on the
    // line below.
    const ours = (group.unofficial || []).length;
    const total = group.unlocks.length + ours;
    const badge = el('span', 'badge', '+' + total);
    const spoken = 'unlocks ' + total + ' combo' + (total === 1 ? '' : 's');
    badge.title = spoken;
    badge.setAttribute('aria-label', spoken);
    header.appendChild(badge);
    const sizes = sizeRow(group.unlocks.concat(group.unofficial || []));
    if (sizes) header.appendChild(sizes);
    card.appendChild(header);

    // A card can reach this list on our rows alone — Hammerhead unlocks nothing
    // Spellbook has published and 1,889 combos we believe in.
    const split = splitLine(group.unlocks.length, ours, true);
    if (split) card.appendChild(split);

    const links = el('p', 'card-links');
    links.appendChild(cardLinks(first));
    links.appendChild(addButton(first));
    card.appendChild(links);

    if (rest.length) {
      const alt = el('div', 'alternatives');
      // Terse on purpose: this line and the comparison link beside it have to fit one
      // row on a phone, where the label's box is 298px and the link takes 108 of it.
      // "or any one of these 15 instead — same combos:" wrapped to two lines and put
      // the link on a line of its own. The layout test measures the line count.
      const label = el('span', 'alt-label',
        `${rest.length === 1 ? 'or this one' : `or these ${rest.length}`}, `
        + `same ${group.unlocks.length === 1 ? 'combo' : 'combos'}:`);
      // The whole choice, not just the folded-away part: the card in the heading is
      // one of the options being weighed, and a comparison missing the recommended
      // card is the wrong comparison.
      const compare = cardsOnScryfall(
        group.cards,
        `Compare all ${group.cards.length}`,
        `Open all ${group.cards.length} of these cards on Scryfall, side by side`
      );
      if (compare) label.appendChild(compare);
      alt.appendChild(label);
      const shown = rest.slice(0, ALTERNATIVES_SHOWN);
      const list = el('ul', 'alt-list');
      shown.forEach((name) => list.appendChild(alternativeItem(name)));
      alt.appendChild(list);

      if (rest.length > shown.length) {
        const more = el('details', 'alt-more');
        more.appendChild(el('summary', null, `${rest.length - shown.length} more`));
        const tail = el('ul', 'alt-list');
        rest.slice(ALTERNATIVES_SHOWN).forEach((name) => tail.appendChild(alternativeItem(name)));
        more.appendChild(tail);
        alt.appendChild(more);
      }
      card.appendChild(alt);
    }

    const details = el('details');
    details.appendChild(el('summary', null, 'Combos this unlocks'));
    // The card being suggested is the one this deck does not hold. Read per
    // variant rather than taken from the group: a group of interchangeable
    // cards has a different one of them in each of its combos.
    const shortOf = (v) => DeckCombos.variantCardNames(v)
      .find((n) => !deckNames || !deckNames.has(DeckCombos.nameKey(n)));
    group.unlocks.forEach((v) => details.appendChild(comboCard(v, deckNames, shortOf(v))));
    // Ours below the published ones and under their own heading, for the same
    // reason they get their own panel rather than a badge: the difference is not
    // a property of a row, it is whether somebody published it.
    if (ours) {
      details.appendChild(el('p', 'ours-head', ours === 1
        ? 'And one this project believes in, which Spellbook has not published:'
        : 'And ' + ours + ' this project believes in, which Spellbook has not published:'));
      group.unofficial.forEach((v) => details.appendChild(comboCard(v, deckNames, shortOf(v))));
    }
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
    // What cutting the card actually costs, which is both halves: a card holding
    // up two of Spellbook's combos and four of ours costs six. Whose six it is
    // goes on the line below.
    const total = piece.count + piece.unofficial;
    head.appendChild(el('span', 'badge', 'in ' + total + ' combo' + (total === 1 ? '' : 's')));
    // The same breakdown a suggestion carries, for the same reason: "in 9 combos" is
    // one number covering nine different propositions, and a card holding up three
    // two-card lines is a very different card to cut than one holding up nine
    // four-card ones. This panel exists to answer "what does cutting this cost me",
    // which the count alone answers only in the crudest terms.
    const sizes = sizeRow(piece.combos);
    if (sizes) head.appendChild(sizes);
    card.appendChild(head);

    const split = splitLine(piece.count, piece.unofficial);
    if (split) card.appendChild(split);

    const links = el('p', 'card-links');
    links.appendChild(link('https://edhrec.com/cards/' + DeckCombos.edhrecSlug(piece.card), 'EDHREC'));
    links.appendChild(document.createTextNode(' · '));
    links.appendChild(link('https://scryfall.com/search?q=' + encodeURIComponent('!"' + piece.card + '"'), 'Scryfall'));
    card.appendChild(links);

    const details = el('details');
    details.appendChild(el('summary', null, piece.count === 1 ? 'The combo it is part of' : 'The combos it holds together'));
    piece.combos.forEach((v) => details.appendChild(comboCard(v, null, piece.card)));
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
    comboCardNames(variant).forEach((name, i) => {
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

    // Same order again: the slot and its candidates, the way out, then the payoff.
    if (variant.id) {
      const p = el('p', 'combo-link');
      p.appendChild(link(SPELLBOOK_COMBO_URL + encodeURIComponent(variant.id) + '/', 'View on Commander Spellbook →'));
      card.appendChild(p);
    }

    card.appendChild(resultChips(variant));

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

  // The second half of "Combos in your deck". Everything in the panel above comes
  // from Commander Spellbook and is shown on their authority; these are ours, found
  // by substituting cards that Spellbook itself treats as interchangeable elsewhere.
  //
  // A separate panel rather than a badge in the list above, because the difference is
  // not a detail of a row — it is the difference between "somebody published this"
  // and "we worked this out", and a reader deciding whether to trust a line needs
  // that before they read the cards, not after.
  //
  // Absent entirely when there are none, which is the usual case: eight rows against
  // Spellbook's hundred thousand.
  function renderUnofficial(container, rows) {
    if (!rows.length) {
      container.textContent = '';
      return;
    }
    const body = panel(container, 'unofficial', 'Unofficial combos', rows.length);
    body.appendChild(el('p', 'empty',
      'Not published by Commander Spellbook. Each of these was found by swapping a card for '
      + 'one Spellbook treats as interchangeable in other combos, and each says which swap it '
      + 'is and how far the checking went. They are not counted in the totals above, and the '
      + 'bracket check ignores them.'));
    // Already expanded by search.js, like every other list here. Expanding twice
    // reads `c` and `p` off a row that no longer has them and quietly renders a
    // combo with no cards and no results.
    rows.forEach((row) => body.appendChild(comboCard(row, null, null, null, { steps: true })));
  }

  function renderPieces(container, included, unofficial) {
    if (!included.length && !(unofficial || []).length) {
      container.textContent = '';
      return;
    }
    const pieces = DeckCombos.comboPieces(included, unofficial);
    const body = panel(container, 'pieces', 'Cards carrying your combos', pieces.length);
    // The per-card count says this already; a sentence restating it for the
    // top card is just noise above the list.
    pieces.forEach((p, i) => body.appendChild(pieceCard(p, i + 1)));
  }

  // ---- the combo map -------------------------------------------------------
  //
  // The same combos as a picture: a dot per card, a line between two cards a
  // combo needs together. Redrawn from scratch on every search, which is what
  // makes it keep up with "+ Add to deck" — the added card is in the next
  // render's `included`, so it turns up in the map with the rest of them, and
  // ComboGraph places the graph deterministically so the picture around it is
  // the one that was there before rather than a reshuffle.
  //
  // Hand-drawn SVG rather than a charting library: the page's CSP allows scripts
  // from nowhere but itself, so a library would have to be vendored into the
  // repository, and this is ~60 lines.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  // How far outside a dot a press still counts as that card's.
  const HIT_MARGIN = 5;

  function svgEl(tag, className) {
    const node = document.createElementNS(SVG_NS, tag);
    if (className) node.setAttribute('class', className);
    return node;
  }

  // What the lines mean, in the lines themselves. Two kinds of relation on one
  // picture is one more than a reader can be expected to infer, and the dashes
  // are the half that is not guessable: a dashed line between two cards that are
  // never in a combo together looks like a mistake until something says what it
  // is for.
  const LEGEND = [
    { className: 'tier-win', width: 3, text: 'a combo needs both — green ends the game' },
    { className: 'tier-decisive', width: 2, text: 'yellow is value to convert' },
    { className: 'tier-other', width: 1.5, text: 'grey is plumbing' },
    { className: 'swap', width: 2, text: 'either card works — they stand in for each other' },
  ];

  // A knot of 162 lines is two questions drawn on top of each other. This lets
  // either be asked on its own — "what works together" and "what stands in for
  // what" — without moving a single card: the layout is the same picture, and
  // only which lines are drawn changes. Which is the point of laying it out from
  // both relations at once.
  const MAP_VIEWS = [
    { id: 'all', label: 'Both', spoken: 'Show every line' },
    { id: 'combo', label: 'Works together', spoken: 'Show only pairs a combo needs' },
    { id: 'swap', label: 'Interchangeable', spoken: 'Show only cards that stand in for each other' },
  ];

  function mapFilter(svg) {
    const row = el('div', 'map-filter');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Which lines to show');
    const buttons = [];
    const select = (view) => {
      svg.classList.remove('show-all', 'show-combo', 'show-swap');
      svg.classList.add('show-' + view);
      buttons.forEach((b) => {
        const on = b.dataset.view === view;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    };
    MAP_VIEWS.forEach((view) => {
      const button = el('button', 'chip', view.label);
      button.type = 'button';
      button.dataset.view = view.id;
      button.title = view.spoken;
      button.addEventListener('click', () => select(view.id));
      buttons.push(button);
      row.appendChild(button);
    });
    select('all');
    return row;
  }

  // How many of the cards they all combo with to name before the number speaks
  // for itself.
  const SHARED_NAMED = 3;

  // What picking these cards out found, in a sentence. Every number in it is
  // counted rather than estimated — see compare() in graph.js — and the last one
  // is the one worth the feature: what cutting the lot would actually cost, which
  // is not the sum of their combo counts, because a combo whose slot another of
  // your cards can fill survives losing this one.
  function pickedSentence(found) {
    const names = found.cards;
    const list = names.length === 1 ? names[0]
      : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
    const plural = names.length > 2 ? 'all three' : 'both';

    if (names.length === 1) {
      const parts = [list + ' is in ' + found.inAll + ' of your combos'];
      if (found.shared.length) {
        parts.push('with ' + found.shared.length + ' other '
          + (found.shared.length === 1 ? 'card' : 'cards'));
      }
      let text = parts.join(', ') + '. ';
      text += found.lost
        ? 'Cutting it would cost ' + found.lost + ' of them'
          + (found.saved ? '; the other ' + found.saved + ' have a stand-in' : '')
        : 'Cutting it costs nothing — every one of them has a stand-in in your deck';
      return text + '. Pick another card to compare the two.';
    }

    const relation = [];
    if (found.inAll) relation.push(found.inAll + ' need ' + plural);
    if (found.interchangeable) {
      relation.push(found.interchangeable + ' take any one of them in the same slot');
    }
    if (!relation.length) relation.push('no combo of yours needs them together or takes one for another');

    // "3 of your combos need both, 4 take any one of them" — what the numbers
    // count is said once, on the first of them, whichever that turns out to be.
    let text = list + ': ' + relation.join(', ').replace(/^(\d+)/, '$1 of your combos') + '. ';
    if (found.shared.length) {
      const named = found.shared.slice(0, SHARED_NAMED).join(', ');
      const more = found.shared.length - SHARED_NAMED;
      text += (names.length > 2 ? 'All three' : 'Both') + ' combo with ' + named
        + (more > 0 ? ' and ' + more + ' more' : '') + '. ';
    }
    text += found.lost
      ? 'Cut ' + plural + ' and ' + found.lost + ' of the ' + found.atRisk
        + ' combos they appear in would go'
        + (found.saved ? '; the other ' + found.saved + ' have a stand-in' : '')
      : 'Cut ' + plural + ' and none of the ' + found.atRisk
        + ' combos they appear in would go — each has a stand-in in your deck';
    return text + '.';
  }

  function mapLegend() {
    const list = el('ul', 'map-legend');
    LEGEND.forEach((item) => {
      const row = el('li');
      const swatch = svgEl('svg', 'swatch');
      swatch.setAttribute('viewBox', '0 0 28 8');
      swatch.setAttribute('aria-hidden', 'true');
      const line = svgEl('line', 'edge ' + item.className);
      line.setAttribute('x1', '1');
      line.setAttribute('y1', '4');
      line.setAttribute('x2', '27');
      line.setAttribute('y2', '4');
      line.setAttribute('stroke-width', String(item.width));
      swatch.appendChild(line);
      row.appendChild(swatch);
      row.appendChild(el('span', null, item.text));
      list.appendChild(row);
    });
    const numbers = el('li', 'map-legend-note');
    numbers.appendChild(el('span', null,
      'Thicker means more of your combos, and the number on a line says how many.'));
    list.appendChild(numbers);
    return list;
  }

  function renderGraph(container, included) {
    if (!included.length) {
      container.textContent = '';
      return;
    }
    const graph = ComboGraph.build(included);
    const swaps = graph.links.filter((l) => l.kind === 'swap').length;
    // The panel comes first because the canvas depends on it: the SVG is scaled
    // into this column, and everything drawn on it is a fixed size in canvas
    // units, so how wide the column is decides how big a dot ends up. Measured
    // rather than assumed from the window — at 1000px the page is two columns
    // and this one is not the window.
    const body = panel(container, 'graph', 'How your combos connect', graph.nodes.length);
    // The canvas grows with the deck — 28 cards in the box that suits 8 is a knot
    // — and turns portrait on a phone, where a landscape one wastes the screen
    // twice over.
    ComboGraph.layout(graph, ComboGraph.sizeFor(graph.nodes.length, body.clientWidth));
    // The layout hands back the box it actually used, which is the one to draw
    // in: the canvas it was given is working space, and whatever it did not need
    // would otherwise be empty screen around the picture.
    const size = { width: graph.width, height: graph.height };

    body.appendChild(el('p', 'empty',
      'Two cards are joined when a combo needs both of them — a solid line, in the colour of the best '
      + 'result those combos produce — or when they do the same job: a dashed line, meaning one can be '
      + 'swapped for the other and you still have a combo. Both carry the count, so cards that overlap '
      + 'a lot are drawn heavier and say by how much, and cards that stand in for each other end up '
      + 'side by side. Hover a card to name it and pick out what it touches; press two or three to '
      + 'compare them, and the line under the map says what they share and what cutting them costs.'));

    const svg = svgEl('svg', 'combo-map');
    svg.setAttribute('viewBox', '0 0 ' + size.width + ' ' + size.height);
    // The type size the layout reserved room for, handed to the stylesheet so
    // the text drawn is the text that was measured. On a narrow column both are
    // larger — see sizeFor() — and if only one of them were, the names would
    // overlap or the map would waste the space it saved for them.
    svg.style.setProperty('--map-type', graph.fontSize + 'px');
    // A group of controls, not a picture: every card on it can be pressed to pin
    // it, and a press changes what the page says. The label below is what a
    // screen reader hears on the way in; the cards themselves are buttons, and
    // the comparison they produce is announced.
    svg.setAttribute('role', 'group');
    const described = 'Combo map: ' + graph.nodes.length + ' cards, '
      + (graph.links.length - swaps) + ' pairs a combo needs together and '
      + swaps + ' pairs that can stand in for each other.';
    svg.setAttribute('aria-label', described);
    const title = svgEl('title');
    title.textContent = described;
    svg.appendChild(title);

    // Interchangeable lines go in their own layer *above* the combo lines. They
    // are the answer to "which of these do the same job", and underneath a
    // hundred and fourteen green ones they were the hardest thing on the map to
    // see — which is precisely backwards.
    const edgeLayer = svgEl('g', 'edges');
    const swapLayer = svgEl('g', 'edges swaps');
    const countLayer = svgEl('g', 'counts');
    const nodeLayer = svgEl('g', 'nodes');
    svg.appendChild(edgeLayer);
    svg.appendChild(swapLayer);
    svg.appendChild(countLayer);
    svg.appendChild(nodeLayer);

    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    // What each card touches, so picking one out is a lookup rather than a search
    // of the DOM on every pointer move — and every line with both its ends, for
    // the same reason.
    const touching = new Map(graph.nodes.map((n) => [n.id, { nodes: new Set([n.id]) }]));
    const drawn = [];

    graph.links.forEach((linkData) => {
      const a = byId.get(linkData.source);
      const b = byId.get(linkData.target);
      const swap = linkData.kind === 'swap';
      const line = svgEl('line', 'edge ' + (swap ? 'swap' : 'tier-' + linkData.tier));
      line.setAttribute('x1', a.x);
      line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x);
      line.setAttribute('y2', b.y);
      // Heavier the more the two overlap, on both meanings of overlap, and capped
      // so one very busy pair does not draw a bar across the map. Interchangeable
      // counts run much higher than shared-combo ones — six cards that all stand
      // in for each other are interchangeable in every combo the group appears in
      // — so it takes more of them to earn the same width.
      line.setAttribute('stroke-width', String(swap
        ? 1 + Math.min(linkData.swap - 1, 12) * 0.28
        : 1 + Math.min(linkData.together - 1, 4) * 0.7));
      const hint = svgEl('title');
      hint.textContent = swap
        ? a.name + ' or ' + b.name + ' — either one works in ' + linkData.swap
          + ' of your combos'
        : a.name + ' + ' + b.name + ' — ' + linkData.together
          + ' combo' + (linkData.together === 1 ? '' : 's') + ' need both';
      line.appendChild(hint);
      (swap ? swapLayer : edgeLayer).appendChild(line);

      // The number itself. The strongest few stay on screen; the rest are drawn
      // and hidden, and come back when either of their cards is picked out —
      // where they are one card's dozen lines rather than the map's hundred and
      // fifty, and there is room for all of them.
      let count = null;
      if (linkData.countX != null) {
        count = svgEl('text', 'count' + (swap ? ' swap' : '')
          + (linkData.countShown ? '' : ' is-crowded'));
        count.setAttribute('x', linkData.countX);
        count.setAttribute('y', linkData.countY + 3.5);
        count.textContent = String(linkData.count);
        countLayer.appendChild(count);
      }

      // Both ends kept on the line itself, so lighting a comparison can ask "is
      // this line between two of the picked cards" without searching the DOM.
      drawn.push({ a: a.id, b: b.id, parts: count ? [line, count] : [line] });

      [[a, b], [b, a]].forEach(([from, to]) => {
        const near = touching.get(from.id);
        near.nodes.add(to.id);
      });
    });

    const groups = new Map();
    graph.nodes.forEach((node) => {
      const g = svgEl('g', 'node');
      // A card on this map is something you press: pressing it pins the card so
      // two or three can be compared, which is a button whatever it is drawn as.
      // So it is one — focusable, named, and reporting whether it is pinned —
      // rather than a shape a mouse happens to be able to hit.
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-pressed', 'false');
      g.setAttribute('aria-label', node.name + ', in ' + node.combos
        + ' combo' + (node.combos === 1 ? '' : 's') + '. Pick to compare.');
      // An invisible ring of forgiveness around the dot. The smallest card on
      // the map is a 5-unit circle, which on a phone — a 900-unit canvas scaled
      // into a 330px column — is under two physical pixels of target. This does
      // not make it a thumb-sized one, but it makes a near miss count, and it
      // costs nothing: the gap the layout leaves between two dots is wider than
      // this, so no card can steal another's presses.
      const hit = svgEl('circle', 'hit');
      hit.setAttribute('cx', node.x);
      hit.setAttribute('cy', node.y);
      hit.setAttribute('r', String(node.r + HIT_MARGIN));
      const dot = svgEl('circle', 'dot');
      dot.setAttribute('cx', node.x);
      dot.setAttribute('cy', node.y);
      dot.setAttribute('r', String(node.r));
      // Where the label goes — and whether there was room for one at all — is the
      // layout's decision, since it is the half that knows what is next to what.
      // A card whose label was dropped still names itself on hover, which is one
      // label rather than forty.
      const label = svgEl('text', node.labelDy == null ? 'label is-crowded' : 'label');
      label.setAttribute('x', node.x + node.labelDx);
      label.setAttribute('y', node.y + (node.labelDy == null ? node.r + 11 : node.labelDy));
      // Centred is the stylesheet's default; a label placed beside its dot has to
      // grow away from it rather than through it.
      if (node.labelAnchor !== 'middle') label.setAttribute('text-anchor', node.labelAnchor);
      label.textContent = node.label;
      const hint = svgEl('title');
      hint.textContent = node.name + ' — in ' + node.combos
        + ' combo' + (node.combos === 1 ? '' : 's');
      g.appendChild(hint);
      g.appendChild(hit);
      g.appendChild(dot);
      g.appendChild(label);
      nodeLayer.appendChild(g);
      groups.set(node.id, g);
    });

    // ---- picking cards out ----
    //
    // Lighting up one card dims the rest, which is the only way to read a map
    // this dense: "what is Basalt Monolith actually in" is a question the picture
    // cannot answer while every line is drawn at the same weight.
    //
    // Hovering asks that about one card. Pressing cards *pins* two or three, and
    // then the question is a different one — these look like the same effect,
    // which do I keep? — so what lights is what they have in common: the lines
    // between them, and the cards every one of them combos with. Everything else
    // goes quiet, and the line under the map counts it out.
    const picked = [];
    const lit = [];
    const summary = el('p', 'map-picked');
    // The comparison is the answer to a press, and a press has to say what it did
    // to someone who cannot see the map light up.
    summary.setAttribute('role', 'status');

    const clear = () => {
      svg.classList.remove('is-lit');
      lit.forEach((node) => node.classList.remove('is-lit'));
      lit.length = 0;
    };

    // ids: the cards to light. One of them lights everything it touches; several
    // light only what they have in common.
    const light = (ids) => {
      clear();
      if (!ids.length) return;
      const chosen = new Set(ids);
      const near = ids.map((id) => (touching.get(id) || { nodes: new Set() }).nodes);
      const shared = ids.length === 1
        ? [...near[0]]
        : [...near[0]].filter((id) => !chosen.has(id) && near.every((set) => set.has(id)));
      const on = new Set([...ids, ...shared]);
      svg.classList.add('is-lit');
      on.forEach((id) => {
        const g = groups.get(id);
        if (g) { g.classList.add('is-lit'); lit.push(g); }
      });
      // A line counts when it joins two lit cards and at least one of them was
      // picked: between two shared partners is a relation of theirs, not of the
      // comparison.
      drawn.forEach((line) => {
        if (!on.has(line.a) || !on.has(line.b)) return;
        if (!chosen.has(line.a) && !chosen.has(line.b)) return;
        line.parts.forEach((part) => { part.classList.add('is-lit'); lit.push(part); });
      });
    };

    const describe = () => {
      summary.textContent = picked.length ? pickedSentence(ComboGraph.compare(graph, picked)) : '';
      summary.classList.toggle('is-empty', !picked.length);
      groups.forEach((g, id) => g.setAttribute('aria-pressed', String(picked.includes(id))));
    };

    // What is on screen when nothing is being hovered: the pinned cards, or
    // nothing at all.
    const rest = () => light(picked);

    const toggle = (id) => {
      const at = picked.indexOf(id);
      if (at === -1) picked.push(id);
      else picked.splice(at, 1);
      groups.forEach((g, other) => g.classList.toggle('is-picked', picked.includes(other)));
      describe();
      rest();
    };

    groups.forEach((g, id) => {
      // Hovering is a look, pressing is a decision: a hover previews one card and
      // is undone the moment the pointer leaves, and it leaves the pinned
      // selection alone underneath.
      g.addEventListener('pointerenter', () => light([id]));
      g.addEventListener('click', () => toggle(id));
      g.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); // Space scrolls the page otherwise
        toggle(id);
      });
      g.addEventListener('focus', () => light(picked.includes(id) ? picked : [id]));
      g.addEventListener('blur', rest);
    });
    svg.addEventListener('pointerleave', rest);

    const clearPicked = () => {
      if (!picked.length) return;
      picked.length = 0;
      groups.forEach((g) => g.classList.remove('is-picked'));
      describe();
      rest();
    };
    // A press on the background is how every other selection on a screen is
    // undone, and Escape is how a keyboard does it.
    svg.addEventListener('click', (e) => {
      if (!e.target.closest('.node')) clearPicked();
    });
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') clearPicked();
    });

    // Built after the SVG because all three describe it — the filter drives it,
    // the legend is drawn with the same classes the map is so it cannot describe
    // a line the map no longer has, and the summary answers a press. Inserted
    // around it all the same.
    body.appendChild(mapFilter(svg));
    body.appendChild(mapLegend());
    body.appendChild(svg);
    describe();
    body.appendChild(summary);

    if (graph.omitted) {
      body.appendChild(el('p', 'note',
        'Showing the ' + graph.nodes.length + ' cards in the most combos. '
        + graph.omitted + ' more take part in your combos and are listed under '
        + '“Cards carrying your combos”.'));
    }
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

  // ---- what bracket the list is in ----------------------------------------
  //
  // Wizards' own words for each bracket, so a number on the page is followed by
  // the name people actually use for it.
  const BRACKET_NAMES = { 1: 'Exhibition', 2: 'Core', 3: 'Upgraded', 4: 'Optimized', 5: 'cEDH' };

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
  const BRACKET_STEPS = [1, 2, 3, 4, 5];

  function renderBracket(container, bracket) {
    container.textContent = '';
    // No published list means the question cannot be asked at all. Half a bracket
    // check is worse than none, so nothing is drawn.
    if (!bracket) return;

    const changers = bracket.gameChangers || [];
    const wins = bracket.twoCardWins || [];
    const floor = bracket.floor;

    const line = el('p', 'bracket-line');
    line.appendChild(el('span', 'bracket-label', 'Bracket'));

    // The pips and their explanation share a wrapper: the panel is positioned
    // against it, and shown while anything inside it is hovered or focused.
    const wrap = el('span', 'bracket-wrap');

    const headline = floor > 2
      ? `Bracket ${floor}${floor === 4 ? '' : ' at the earliest'}`
      : 'Nothing here rules out bracket 2';
    const named = headline + ' — ' + BRACKET_NAMES[floor];

    const scale = el('button', 'bracket-scale');
    scale.type = 'button';
    scale.setAttribute('aria-expanded', 'false');
    scale.setAttribute('aria-controls', 'bracket-why');
    // Five numbered circles read as "1 2 3 4 5" to a screen reader, which is worse
    // than nothing. The pips are decorative; the button carries the answer.
    scale.setAttribute('aria-label', named + '. Why this bracket?');
    scale.title = named;
    BRACKET_STEPS.forEach((n) => {
      const state = n < floor ? ' out' : n === floor ? ' floor' : ' open';
      const pip = el('span', 'step' + state, String(n));
      pip.setAttribute('aria-hidden', 'true');
      scale.appendChild(pip);
    });
    wrap.appendChild(scale);

    const why = el('div', 'bracket-why');
    why.id = 'bracket-why';
    why.appendChild(el('p', 'why-floor', named));

    const counts = [];
    if (changers.length) {
      counts.push(changers.length + ' Game Changer' + (changers.length === 1 ? '' : 's'));
    }
    if (wins.length) {
      counts.push(wins.length === 1
        ? '1 two-card combo that ends the game'
        : wins.length + ' two-card combos that end the game');
    }
    const reason = floor === 4
      ? `${counts.join(' · ')}. Bracket 3 allows three Game Changers, so a list with more sits at 4.`
      : floor === 3
        ? `${counts.join(' · ')}. Brackets 1 and 2 allow neither, so 3 is the floor.`
        : 'No Game Changers, and no two-card combo that says it ends the game.';
    why.appendChild(el('p', 'why-reason', reason));

    // Named and still linked. These are the cards the answer rests on, and a name
    // you cannot look up is a claim the reader has to take on trust.
    if (changers.length) {
      const list = el('p', 'why-cards');
      list.appendChild(el('span', 'why-label', 'Game Changers you play: '));
      changers.forEach((name, i) => {
        if (i > 0) list.appendChild(document.createTextNode(' · '));
        list.appendChild(el('span', 'card-name', name));
        list.appendChild(cardLinks(name));
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
        list.appendChild(el('span', 'card-name', comboCardNames(v).join(' + ')));
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

  function renderResults(results, deckNames) {
    $('results').hidden = false;

    renderIdentity($('identity'), results.identity);
    renderBracket($('bracket'), results.bracket);

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

    renderUnofficial($('unofficial'), results.unofficial || []);

    // Drawn from the same `included` the list above is — Spellbook's own combos
    // and not the unofficial ones, which is the same line "Cards carrying your
    // combos" draws, so the two panels cannot disagree about what a card is in.
    // Rebuilt on every search, including the one "+ Add to deck" fires, so the
    // picture is never a search behind the list beside it.
    renderGraph($('graph'), included);

    renderSlots($('slots'), results.oneSlotAway || [], results.slotCandidates || {});

    // Both halves, because the question this panel asks — what does cutting this
    // card cost me — has the same answer whoever published the combo. The two
    // numbers stay apart on the row; see ourBadge().
    renderPieces($('pieces'), included, results.unofficial || []);

    renderSuggestions(
      $('suggestions'),
      DeckCombos.groupSuggestions(DeckCombos.computeSuggestions(
        results.almostIncluded, deckNames, results.unofficialAlmost
      ), deckNames),
      DeckCombos.groupSuggestions(DeckCombos.computeSuggestions(
        results.almostIncludedByAddingColors, deckNames, results.unofficialAlmostByAddingColors
      ), deckNames),
      deckNames,
      results.identity
    );
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
    // Claimed by whichever search runs next, whether or not that is the one the
    // add started — a note left over from an earlier add would be a lie on a
    // search someone else asked for.
    const added = addedNote;
    addedNote = null;

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
      setStatus((added ? 'Added ' + added + '. ' : '')
        + 'Searched ' + (main.length + commanders.length) + ' cards against ' + notes.join('; ') + '.');
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
  // What the search cost, in the footer rather than in a devtools trace. The
  // machine worth measuring belongs to somebody who is not going to open one, and
  // "is it slow, and which third of it" has until now been answerable only by
  // inference from a laptop.
  //
  // Only the phases that happened. The second search of a session has no download
  // and no parse — the dataset is already in memory — and printing "download 0ms"
  // would report that as instant rather than as skipped, which is the opposite of
  // what makes the number worth having.
  const secs = (ms) => (ms >= 100 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms');

  function timingSentence(t) {
    if (!t || typeof t.total !== 'number') return '';
    const parts = [];
    if (typeof t.fetch === 'number') parts.push('download ' + secs(t.fetch));
    if (typeof t.parse === 'number') parts.push('parse ' + secs(t.parse));
    if (typeof t.match === 'number') parts.push('match ' + secs(t.match));
    // One phase and a total that agrees with it is the same number twice.
    return parts.length > 1
      ? `ready in ${secs(t.total)} (${parts.join(' · ')})`
      : `ready in ${secs(t.total)}`;
  }

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
    const timing = timingSentence(meta.timing);
    if (timing) line.appendChild(el('span', 'timing', ' · ' + timing));
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
