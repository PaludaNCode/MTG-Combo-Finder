// The three panels that answer "what now": cards to add, the cards already carrying your
// combos, and the unofficial rows. (There were four; see below for the one that went.)
//
// All three are lists of rows built from render-rows.js, and the combos they cite are drawn
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
  // The name gets a line to itself on a phone rather than sharing one with the
  // links, which is what lets it be a card name and not a measurement problem: on a
  // shared line the links fit beside names of up to about twelve characters at 390px
  // and were pushed to the next line by everything longer, so their position went
  // ragged down the list. Measured over eleven real names at four widths.
  //
  // Where the row's column is wide enough they do share the line, and the row loses
  // a line — the stylesheet decides, on the column's width rather than the window's,
  // so this builds the same three children either way. The threshold is much wider
  // than it looks like it should be because the line carries the add button too; the
  // measurement is in style.css beside the rule.
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
    // takes its own line below that, which costs height and nothing else. Above
    // 750px of column that whole line moves up beside the name.
    const links = el('p', 'card-links');
    links.appendChild(RenderRows.cardLinks(first));
    links.appendChild(RenderRows.addButton(first));
    main.appendChild(links);

    // The same set the disclosure below lists, asked for as that set rather than
    // re-assembled here: two places building "both halves" from the parts is two places
    // that can disagree about what the row's breakdown counts.
    const sizes = RenderRows.sizeRow(group.combos);
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
    // One list, ours and Spellbook's together, ordered by groupSuggestions() — the same
    // shape "Cards carrying your combos" below draws. Ours used to sit under a heading of
    // their own beneath the published ones; each row says whose it is now, which leaves
    // the order free to put a row of ours beside the family it belongs to.
    //
    // The card being suggested is the one this deck does not hold. Read per variant
    // rather than taken from the group: a group of interchangeable cards has a different
    // one of them in each of its combos. It must agree with the lead the list was sorted
    // under, which is why both come from the same rule.
    const shortOf = (v) => DeckCombos.variantCardNames(v)
      .find((n) => !deckNames || !deckNames.has(DeckCombos.nameKey(n)));
    // …and the card that varies between these rows goes last, so the list reads as
    // one shape: the card you would add, the cards it works with, then the piece
    // this row swaps. Worked out over the list as drawn, since that is what the
    // reader is comparing — which is now the whole list rather than half of it.
    const trails = DeckCombos.interchangeableIn(group.combos);
    group.combos.forEach((v) => details.appendChild(
      RenderCombos.comboCard(v, deckNames, shortOf(v), trails.get(v))
    ));
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
    // The card whose combos these are leads every row, and what differs between them
    // goes last — the same shape the suggestion above uses, for the same reason.
    const trails = DeckCombos.interchangeableIn(piece.combos);
    piece.combos.forEach((v) => details.appendChild(
      RenderCombos.comboCard(v, null, piece.card, trails.get(v))
    ));
    card.appendChild(details);

    return card;
  }

  // There was a fourth row shape here, and a panel of them: a combo whose every
  // named card the deck held, short only of a slot. It is gone, and the reasoning
  // is in the README under "The panel that could not answer its own question" —
  // a slot 394 cards fill has no card to recommend, so the row could only report
  // the slot, a count and six examples and leave the reader to it.
  //
  // Template slots themselves are untouched: a combo the deck *can* assemble still
  // names the slot it filled and which card of yours filled it, inside its own row
  // in "Combos in your deck", and that slot still counts as a card in the size
  // breakdown. See resolveSlots() in combos.js.

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
    // These rows sit side by side in one panel and several of them are the same swap
    // over a different gainer, so the card that changes goes last here too.
    const trails = DeckCombos.interchangeableIn(rows);
    rows.forEach((row) => body.appendChild(
      RenderCombos.comboCard(row, null, null, trails.get(row), { steps: true })
    ));
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

  const api = { suggestionCard, pieceCard, renderUnofficial, renderPieces, renderSuggestions };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.RenderSuggestions = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
