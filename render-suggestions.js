// The four panels that answer "what now": cards to add, the cards already carrying your
// combos, combos one slot short of assembling, and the unofficial rows.
//
// All four are lists of rows built from render-rows.js, and the combos they cite are drawn
// by render-combos.js — so this file is mostly about grouping, ordering and what each
// panel's heading claims, which is why so much of it reads as a call into view-model.js.
(function (global) {
  'use strict';

  const Dom = global.PageDom || (typeof require === 'function' ? require('./page-dom.js') : null);
  const { el, link, panel } = Dom;

  // A card worth adding. Two columns: its numbers in the gutter, and beside them
  // the card, where to read about it, and what its combos cost to assemble — one
  // per line, in that order.
  //
  // The name gets a line to itself rather than sharing one with the links, which
  // is what lets it be a card name and not a measurement problem: on a shared line
  // the links fit beside names of up to about twelve characters at 390px and were
  // pushed to the next line by everything longer, so their position went ragged
  // down the list. Measured over eleven real names at four widths.
  function suggestionCard(group, deckNames) {
    const card = el('article', 'combo suggestion');
    const [first, ...rest] = group.cards;

    // A card can reach this list on our rows alone — Hammerhead unlocks nothing
    // Spellbook has published and 1,889 combos we believe in. The gutter carries
    // the total because that is the size of the decision; what kind of decision
    // it is, is the split underneath.
    const ours = (group.unofficial || []).length;
    card.appendChild(RenderRows.numberGutter(group.unlocks.length, ours, true));

    const main = el('div', 'row-main');
    const header = el('h3', 'row-name');
    header.appendChild(el('span', 'card-name', first));
    main.appendChild(header);

    // The links and the button on one line: everything you can do with this card
    // without leaving the row. They share it down to about 390px and the button
    // takes its own line below that, which costs height and nothing else.
    const links = el('p', 'card-links');
    links.appendChild(RenderRows.cardLinks(first));
    links.appendChild(RenderRows.addButton(first));
    main.appendChild(links);

    const sizes = RenderRows.sizeRow(group.unlocks.concat(group.unofficial || []));
    if (sizes) main.appendChild(sizes);

    card.appendChild(main);

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
      const compare = RenderRows.cardsOnScryfall(
        group.cards,
        `Compare all ${group.cards.length}`,
        `Open all ${group.cards.length} of these cards on Scryfall, side by side`
      );
      if (compare) label.appendChild(compare);
      alt.appendChild(label);
      const shown = rest.slice(0, RenderRows.ALTERNATIVES_SHOWN);
      const list = el('ul', 'alt-list');
      shown.forEach((name) => list.appendChild(RenderRows.alternativeItem(name)));
      alt.appendChild(list);

      if (rest.length > shown.length) {
        const more = el('details', 'alt-more');
        more.appendChild(el('summary', null, `${rest.length - shown.length} more`));
        const tail = el('ul', 'alt-list');
        rest.slice(RenderRows.ALTERNATIVES_SHOWN).forEach((name) => tail.appendChild(RenderRows.alternativeItem(name)));
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
    group.unlocks.forEach((v) => details.appendChild(RenderCombos.comboCard(v, deckNames, shortOf(v))));
    // Ours below the published ones and under their own heading, for the same
    // reason they get their own panel rather than a badge: the difference is not
    // a property of a row, it is whether somebody published it.
    if (ours) {
      details.appendChild(el('p', 'ours-head', ours === 1
        ? 'And one this project believes in, which Spellbook has not published:'
        : 'And ' + ours + ' this project believes in, which Spellbook has not published:'));
      group.unofficial.forEach((v) => details.appendChild(RenderCombos.comboCard(v, deckNames, shortOf(v))));
    }
    card.appendChild(details);

    return card;
  }

  // One of your cards, with the combos it holds together. Same two columns as a
  // suggestion above, and for the same reason: both panels are ranked by the number
  // in the gutter, so both are read down that column.
  function pieceCard(piece) {
    const card = el('article', 'combo suggestion');

    // What cutting the card actually costs, which is both halves: a card holding
    // up two of Spellbook's combos and four of ours costs six. Whose six it is,
    // is the split under the total.
    card.appendChild(RenderRows.numberGutter(piece.count, piece.unofficial));

    const main = el('div', 'row-main');
    const head = el('h3', 'row-name');
    head.appendChild(el('span', 'card-name', piece.card));
    main.appendChild(head);

    const links = el('p', 'card-links');
    links.appendChild(link('https://edhrec.com/cards/' + DeckCombos.edhrecSlug(piece.card), 'EDHREC'));
    links.appendChild(document.createTextNode(' · '));
    links.appendChild(link('https://scryfall.com/search?q=' + encodeURIComponent('!"' + piece.card + '"'), 'Scryfall'));
    main.appendChild(links);

    // The same breakdown a suggestion carries, for the same reason: "in 9 combos" is
    // one number covering nine different propositions, and a card holding up three
    // two-card lines is a very different card to cut than one holding up nine
    // four-card ones. This panel exists to answer "what does cutting this cost me",
    // which the count alone answers only in the crudest terms.
    const sizes = RenderRows.sizeRow(piece.combos);
    if (sizes) main.appendChild(sizes);

    card.appendChild(main);

    const details = el('details');
    details.appendChild(el('summary', null, piece.count === 1 ? 'The combo it is part of' : 'The combos it holds together'));
    piece.combos.forEach((v) => details.appendChild(RenderCombos.comboCard(v, null, piece.card)));
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
    RenderRows.comboCardNames(variant).forEach((name, i) => {
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
          list.appendChild(RenderRows.cardLinks(name));
        });
        card.appendChild(list);
      }
    });

    // Same order again: the slot and its candidates, the way out, then the payoff.
    if (variant.id) {
      const p = el('p', 'combo-link');
      p.appendChild(link(RenderRows.SPELLBOOK_COMBO_URL + encodeURIComponent(variant.id) + '/', 'View on Commander Spellbook →'));
      card.appendChild(p);
    }

    card.appendChild(RenderRows.resultChips(variant));

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
    rows.forEach((row) => body.appendChild(RenderCombos.comboCard(row, null, null, null, { steps: true })));
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
    pieces.forEach((p) => body.appendChild(pieceCard(p)));
  }

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
        tab.items.forEach((s) => pane.appendChild(suggestionCard(s, deckNames)));
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

  const api = { suggestionCard, pieceCard, slotAwayCard, renderSlots, renderUnofficial, renderPieces, renderSuggestions };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.RenderSuggestions = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
