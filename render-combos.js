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

  // The dot between two offers on the link line, as an element rather than a text node,
  // so the stylesheet can drop it where the offers stack. A bare text run in a flex
  // container becomes an anonymous flex item — unaddressable, and free to be the last
  // thing on a wrapped line, which is how a reader ended up looking at a line ending in
  // "→ ·" with the chip it separated on the line below. Where each offer has its own
  // line the dot separates nothing, so there it goes away entirely.
  const separator = () => el('span', 'sep', ' · ');

  // A heading item that is not a card: the "any of N" fold and a template slot. Two
  // elements, and the nesting is the point — the outer one is the flex item and carries the
  // "+" that joins it to the item before it, the inner one carries the outline. They were a
  // single element, so the outline enclosed the separator and the heading read
  // "Ashnod's Altar + Trudge Garden ( + any of 4 )" with the mark inside the pill. The
  // separator joins the pill to its neighbour; it does not belong to it.
  //
  // The outer element keeps the class, so everything that asks for `.either` or `.slot` —
  // the layout run reads both, by name, including the ::before the mark still lives on —
  // goes on meaning what it meant.
  function pill(kind, text) {
    const outer = el('span', kind);
    outer.appendChild(el('span', 'pill', text));
    return outer;
  }

  // `opts.steps` puts the "How it works" disclosure on the row. Off by default, and
  // deliberately not on every row that draws a combo: the steps are how you execute a
  // line you *have*, so they belong on the panels that answer "what can this deck do" —
  // "Combos in your deck" and the unofficial rows — and nowhere else. A suggestion is a
  // combo the deck cannot assemble yet, so its steps are instructions for a deck the
  // reader has not got.
  //
  // It was off for the pieces panel on the grounds that it relisted combos a panel above
  // had already offered the steps on, once per card in each: left on all four panels of
  // the day, a page carried 429 controls. That panel above is gone — "Combos in your
  // deck" *is* the pieces panel now — so the alternative is not a second way to ask, it
  // is no way to ask. So it is on, and the cost comes back: the control is built once per
  // card in each combo rather than once per combo, and it is built inside a closed
  // disclosure, which is why it delays nothing a reader is looking at. The 429 was
  // measured across four panels and has not been re-measured for one.
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
      const slot = pill('slot', fill.slot);
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
        p.appendChild(separator());
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
        p.appendChild(separator());
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
      // Whose row this is, before how far the checking went. Two panels now list ours and
      // Spellbook's in one order — the suggestions and the pieces — so a reader scanning
      // down either needs the difference on the row rather than in a heading above some
      // of them. It reads "unofficial · verified": not published, and read against the
      // cards. Those are different claims and the second does not imply the first.
      //
      // Drawn on every unofficial row, including the ones in the panel that is entirely
      // unofficial, where it agrees with the heading. That is the cheap redundancy; the
      // alternative is a flag whose two states have to stay right at six call sites, and
      // whose failure mode is a missing badge in a merged list — which is the exact thing
      // this exists to prevent.
      note.appendChild(el('span', 'derived-badge unofficial', 'unofficial'));
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

  // There was a second row shape here: a combo whose interchangeable part was drawn as
  // "+ any of 5" with the versions folded into a disclosure, for the panel that listed
  // every combo the deck could assemble as its own row. That panel is gone — "Combos in
  // your deck" is one row per card, and a card's combos are written out in full inside
  // it — so nothing built a group row any more, and a renderer nothing renders is worse
  // than no renderer. See groupVariants() in combos.js, which still groups for the map.
  //
  // The fold it drew was answering a real measurement: 149 of the Chatterfang deck's 233
  // rows repeated a block of result chips already on screen, because a family's versions
  // produce identical results by construction. That measurement was about 233 rows side
  // by side in one panel, which is exactly the arrangement that no longer exists.

  const api = { stepsList, stepsDisclosure, comboCard };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.RenderCombos = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
