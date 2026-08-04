// The combo map's DOM half: the SVG, the filter chips, the legend, and picking cards
// out of it. The arithmetic — where a dot goes, how heavy a line is, what two cards
// share — is `graph.js`, which has no DOM in it at all and is unit-tested. This is the
// half that draws.
//
// Split out of `app.js` because it was 404 of its 2,147 lines and the largest single
// thing in it: a diff to the map used to land in the same file as the file-drop handler.
// Nothing here changed in the move.
//
// `graph.js` is the DOM-free counterpart and this is deliberately its neighbour rather
// than part of it: keeping `graph.js` free of `document` is what lets `node --test`
// cover the arithmetic, which is where the decisions are.
(function (global) {
  'use strict';

  const Dom = global.PageDom || (typeof require === 'function' ? require('./page-dom.js') : null);
  const { el, panel } = Dom;

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

  // ---- how wide the column is, without asking mid-render -------------------
  //
  // The layout needs this column's width — the SVG is scaled into it, so a dot's
  // size in canvas units depends on it, and it cannot be read off the window
  // because at 1000px the page is two columns and this is not the wider one.
  //
  // The trap is *when* it is read. Reading any geometry property flushes pending
  // style and layout for the whole document, and renderGraph() runs in the middle
  // of a render that has just rebuilt "Combos in your deck" — so the read laid the
  // page out, and the pieces and suggestions panels then added ~78,000 more nodes
  // and it was laid out again before paint. Two full layouts, and the first bought
  // nothing but a number. On a 520-combo deck at 390px with the CPU throttled 4x it
  // was 601ms of a 3,620ms search: the single most expensive line on the page.
  //
  // Moving the read earlier does not fix it and was measured doing the opposite —
  // on a re-search the previous render is still in the document, so an early read
  // flushes a *larger* tree. The fix is not to read synchronously at all: a
  // ResizeObserver's callback runs after layout, where the width is already known
  // and costs nothing, so the render path reads a cached number instead.
  //
  // The fallback matters and is not dead code. The first search on a fresh page has
  // no observation yet — the section was `hidden` until a moment ago, and the
  // observer has not been called — so that one render reads the width the old way
  // and pays for it once. It is also what a browser with no ResizeObserver gets.
  let cachedWidth = 0;
  let observer = null;

  function watchWidth(node) {
    if (typeof ResizeObserver !== 'function') return;
    if (!observer) {
      observer = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1];
        // The border box, and not `contentRect`, because the number this replaces was
        // `clientWidth`: .panel-body carries 1rem of side padding, which contentRect
        // excludes and clientWidth includes, so contentRect would quietly draw every
        // map 32px narrower than it used to be. The two agree here because .panel-body
        // has padding and no border — clientWidth is the padding box, and with no
        // border that is the border box.
        //
        // Taken off the entry rather than by reading `target.clientWidth`, which would
        // also have been correct and free at this point in the frame. The reason is the
        // check in tools/verify-layout.js: it guards this fix by counting reads of
        // clientWidth during a search, and an observer that reads it is two counts of
        // noise in a guard whose whole value is that zero means zero.
        const box = entry.borderBoxSize && entry.borderBoxSize[0];
        const w = box ? box.inlineSize : 0;
        if (w > 0) cachedWidth = w;
        // No usable entry geometry — leave the cache alone rather than guess. The
        // render path's own fallback reads the width directly and is still correct.
      });
    }
    // panel() throws the body away and builds a new one on every search, so the
    // observation has to move with it. The cached number carries over regardless:
    // it describes the column, which has not changed.
    observer.disconnect();
    observer.observe(node);
  }

  // A width to lay the map out in: the cached one when there is one, else the
  // reader's own — which is the read this exists to avoid, taken deliberately.
  function columnWidth(body) {
    watchWidth(body);
    return cachedWidth > 0 ? cachedWidth : body.clientWidth;
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
  // Every chip asks the same kind of question — which *relation* to draw — so the picture
  // always means one thing. A fourth chip once asked something else, "show only the lines
  // whose combo ends the game", and it is gone: a tier is a property of the combo behind a
  // line rather than a relation between two cards, so it could not include interchangeable
  // lines at all and the view had to explain its own absence in its tooltip.
  const MAP_VIEWS = [
    { id: 'all', label: 'Both', spoken: 'Show every line' },
    { id: 'combo', label: 'Works together', spoken: 'Show only pairs a combo needs' },
    { id: 'swap', label: 'Interchangeable', spoken: 'Show only cards that stand in for each other' },
  ];

  // `onChange` re-lights the map, because the highlight follows the view: switching chips
  // while a card is pinned has to re-answer the question, not leave the previous view's
  // answer glowing under the new one's lines.
  function mapFilter(svg, onChange) {
    const row = el('div', 'map-filter');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', 'Which lines to show');
    const buttons = [];
    const select = (view) => {
      svg.classList.remove('show-all', 'show-combo', 'show-swap');
      svg.classList.add('show-' + view);
      if (onChange) onChange(view);
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
    //
    // columnWidth() rather than body.clientWidth: same number, but taken from a
    // ResizeObserver instead of forcing a layout in the middle of the render. See
    // the note above it — this one property read was 601ms of a 3,620ms search.
    ComboGraph.layout(graph, ComboGraph.sizeFor(graph.nodes.length, columnWidth(body)));
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
    // Every line with both its ends, so lighting a comparison is a lookup rather than a
    // search of the DOM on every pointer move. Which cards a card touches is
    // ComboGraph.litFor()'s job now: it has to answer per view, and that is a decision
    // about what the picture claims rather than a drawing detail.
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
        // The tier goes on the number as well as on the line, so anything that filters
        // lines takes their counts with them. A view that hid a line and left its number
        // floating is what this prevents — and it stays now the tier view is gone, because
        // the relation views filter on `.swap` the same way and would do the same thing.
        count = svgEl('text', 'count' + (swap ? ' swap' : ' tier-' + linkData.tier)
          + (linkData.countShown ? '' : ' is-crowded'));
        count.setAttribute('x', linkData.countX);
        count.setAttribute('y', linkData.countY + 3.5);
        count.textContent = String(linkData.count);
        countLayer.appendChild(count);
      }

      // Both ends kept on the line itself, so lighting a comparison can ask "is
      // this line between two of the picked cards" without searching the DOM.
      drawn.push({ a: a.id, b: b.id, swap, parts: count ? [line, count] : [line] });

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

    // Which relation is on screen. The chips own it; light() reads it.
    let view = 'all';

    const clear = () => {
      svg.classList.remove('is-lit');
      lit.forEach((node) => node.classList.remove('is-lit'));
      lit.length = 0;
    };

    // ids: the cards to light. One of them lights everything it touches; several light
    // only what they have in common. **Both readings are scoped to the visible relation** —
    // see ComboGraph.litFor(). Hovering in the Interchangeable view used to light the cards
    // the hovered one combos with, which is a different question from the one the chips say
    // the picture is answering.
    const light = (ids) => {
      clear();
      if (!ids.length) return;
      const chosen = new Set(ids);
      const on = ComboGraph.litFor(graph, ids, view);
      svg.classList.add('is-lit');
      on.forEach((id) => {
        const g = groups.get(id);
        if (g) { g.classList.add('is-lit'); lit.push(g); }
      });
      // A line counts when it joins two lit cards and at least one of them was
      // picked: between two shared partners is a relation of theirs, not of the
      // comparison. And it has to be a line the view is drawing — lighting one the
      // stylesheet has hidden is the same mismatch one layer down.
      drawn.forEach((line) => {
        if (view === 'combo' && line.swap) return;
        if (view === 'swap' && !line.swap) return;
        if (!on.has(line.a) || !on.has(line.b)) return;
        if (!chosen.has(line.a) && !chosen.has(line.b)) return;
        line.parts.forEach((part) => { part.classList.add('is-lit'); lit.push(part); });
      });
    };

    const describe = () => {
      summary.textContent = picked.length ? DeckView.pickedSentence(ComboGraph.compare(graph, picked)) : '';
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
    body.appendChild(mapFilter(svg, (chosen) => { view = chosen; rest(); }));
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

  const api = { renderGraph, MAP_VIEWS, LEGEND };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.RenderMap = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
