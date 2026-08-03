// A combo, as a row: its cards, what it produces, and — folded away until asked for — the
// prerequisites and steps for actually doing it.
//
// The steps arrive one combo at a time from the tree published beside combos.json, which
// is why this is the only renderer that fetches anything. combo-steps.js decides what a
// step record means and steps-source.js decides where it lives; this draws the answer.
(function (global) {
  'use strict';

  const Dom = global.PageDom || (typeof require === 'function' ? require('./page-dom.js') : null);
  const { el, link } = Dom;

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
    RenderRows.comboCardNames(variant, lead, trail).forEach((name, i) => {
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
        RenderRows.SPELLBOOK_COMBO_URL + encodeURIComponent(linkId) + '/',
        derived ? 'View the published combo this came from →' : 'View on Commander Spellbook →'
      ));
      // Every card in the combo on one Scryfall page. One link rather than a link per
      // name: a four-card combo would carry four, and the heading is the combo, not a
      // list of links — and reading the cards is one action, so it is one press.
      //
      // Named cards only. A template slot has no card to open, and the row already
      // names what fills it.
      const cards = DeckCombos.variantCardNames(variant);
      const compare = RenderRows.cardsOnScryfall(
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

    card.appendChild(RenderRows.resultChips(variant));

    return card;
  }

  // A combo you can already assemble, with the parts that are interchangeable
  // shown as a choice rather than as separate combos. The variants are real and
  // still reachable — each keeps its own link to Spellbook.
  function comboGroupCard(group) {
    if (group.choices.length < 2) return comboCard(group.variants[0], null, null, null, { steps: true });

    const card = el('article', 'combo');

    const header = el('h3');
    RenderRows.alphabetical(group.shared).forEach((name, i) => {
      if (i > 0) header.appendChild(el('span', 'plus', ' + '));
      header.appendChild(el('span', 'card-name', name));
    });
    header.appendChild(el('span', 'plus', ' + '));
    header.appendChild(el('span', 'either', 'any of ' + group.choices.length));
    card.appendChild(header);

    const choices = el('p', 'choices');
    RenderRows.alphabetical(group.choices).forEach((name, i) => {
      if (i > 0) choices.appendChild(document.createTextNode(' · '));
      choices.appendChild(el('span', 'card-name', name));
    });
    card.appendChild(choices);

    // Same order as the rows above: what it needs, then what it does.
    // The same one-press look at the cards the other rows get. A collapsed row asks
    // for its shared cards plus one of the interchangeable ones, so the comparison
    // covers the whole set — that is what the reader is choosing between.
    const groupCards = RenderRows.alphabetical(group.shared).concat(RenderRows.alphabetical(group.choices));
    const groupCompare = RenderRows.cardsOnScryfall(
      groupCards,
      `See all ${groupCards.length} cards`,
      `Open all ${groupCards.length} cards this row involves on Scryfall`
    );
    if (groupCompare) {
      const p = el('p', 'combo-link');
      p.appendChild(groupCompare);
      card.appendChild(p);
    }

    card.appendChild(RenderRows.resultChips(group.variants[0]));

    const details = el('details');
    details.appendChild(el('summary', null, `All ${group.variants.length} versions`));
    // The interchangeable cards go last in every version, so each row reads in the
    // same shape as the heading above them — the shared cards, then the one that
    // makes this version this version.
    group.variants.forEach((v) => details.appendChild(comboCard(v, null, null, group.choices, { steps: true })));
    card.appendChild(details);

    return card;
  }

  const api = { stepsList, stepsDisclosure, comboCard, comboGroupCard };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.RenderCombos = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
