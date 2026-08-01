// The combo map: your deck's combos as a picture rather than a list.
//
// A node is one of your cards; a line joins two cards whenever a combo needs
// both of them. That is the one thing the panels above cannot show — "Combos in
// your deck" reads a row at a time, and "Cards carrying your combos" counts a
// card at a time, so neither says that six of your combos all hang off the same
// two cards, or that the deck holds two clusters that never touch.
//
// Nothing here draws anything. This file turns combos into a graph and places
// that graph on a canvas; app.js renders the result as SVG. The split is so the
// arithmetic — which is all of the interesting part — can be tested in node,
// where there is no SVG to inspect.
//
// Browser global (window.ComboGraph) + node module, like parser.js and combos.js.
(function (global) {
  'use strict';

  const Combos = (typeof module !== 'undefined' && module.exports)
    ? require('./combos.js')
    : global.DeckCombos;

  // Same three tiers the result chips use, and the same order of preference: an
  // edge belonging to several combos takes the colour of the best of them, because
  // "these two cards win the game together" is the fact worth seeing from across
  // the page.
  const TIER_RANK = { win: 0, decisive: 1, other: 2 };

  // Above this many cards the picture stops being one — labels collide, and the
  // repulsion pass is O(n²) per iteration. The busiest cards are kept and the
  // count of what was dropped is returned, so the panel can say so rather than
  // quietly showing a smaller deck than the one it was given.
  const DEFAULT_LIMIT = 60;

  // How big a dot is: the smallest one, and how fast it grows with the number of
  // combos behind it.
  const MIN_RADIUS = 5;
  const RADIUS_SCALE = 3;

  function comboTier(variant) {
    const names = variant && variant.produces
      ? variant.produces.map((p) => (p.feature && p.feature.name) || p.name)
      : ((variant && variant.p) || []);
    // summarizeResults() already sorts best tier first, so the head of the list
    // is the answer; an empty one means the combo published no results at all.
    const results = Combos.summarizeResults(names);
    return results.length ? results[0].tier : 'other';
  }

  // variants: the combos the deck can already assemble (post-expand()).
  // Returns { nodes, links, omitted }:
  //   nodes  [{ id, name, combos }]  id is the comparison key, combos is how
  //                                  many of your combos the card takes part in
  //   links  [{ source, target, weight, tier }]  weight is how many combos need
  //                                  both ends; tier is the best of those combos
  //   omitted  cards left out by the limit, 0 when everything fitted
  function build(variants, opts) {
    const limit = (opts && opts.limit) || DEFAULT_LIMIT;
    const cards = new Map();
    const edges = new Map();

    for (const variant of variants || []) {
      // The same set "Cards carrying your combos" counts: the cards a combo
      // names, plus whichever of yours filled each of its template slots. A card
      // holding a combo up through a slot is joined to the rest of it like any
      // other — that is what it is doing.
      const held = Combos.comboCardIndex(variant);
      const keys = [...held.keys()];
      const tier = comboTier(variant);

      for (const [key, name] of held) {
        let node = cards.get(key);
        if (!node) {
          node = { id: key, name, combos: 0, r: 0 };
          cards.set(key, node);
        }
        node.combos++;
      }

      // Every pair inside the combo, which is what "these cards go together"
      // means for a combo of more than two. A four-card combo is six lines and
      // draws as a filled square — the shape is the point.
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          // Ordered, so the same pair from two different combos is one edge
          // whichever way round each combo happened to list them.
          const [source, target] = keys[i] < keys[j] ? [keys[i], keys[j]] : [keys[j], keys[i]];
          const id = source + '|' + target;
          let edge = edges.get(id);
          if (!edge) {
            edge = { source, target, weight: 0, tier: 'other' };
            edges.set(id, edge);
          }
          edge.weight++;
          if (TIER_RANK[tier] < TIER_RANK[edge.tier]) edge.tier = tier;
        }
      }
    }

    // How big each card is drawn. Here rather than in the renderer because the
    // layout has to know: two dots whose radii overlap are drawn as one blob,
    // and the run that separates them cannot separate what it cannot measure.
    // By area, not radius, so a card in nine combos is not eighty times the size
    // of one in a single combo.
    for (const node of cards.values()) {
      node.r = Math.round((MIN_RADIUS + RADIUS_SCALE * Math.sqrt(node.combos - 1)) * 10) / 10;
    }

    // Busiest first, so the limit keeps the cards the deck is actually built
    // around, and so the ring the layout starts from is ordered rather than
    // arbitrary. Ties broken by name: the same deck must always draw the same.
    let nodes = [...cards.values()]
      .sort((a, b) => b.combos - a.combos || a.name.localeCompare(b.name));
    const omitted = Math.max(0, nodes.length - limit);
    if (omitted) nodes = nodes.slice(0, limit);

    const kept = new Set(nodes.map((n) => n.id));
    const links = [...edges.values()]
      .filter((e) => kept.has(e.source) && kept.has(e.target))
      .sort((a, b) => b.weight - a.weight
        || a.source.localeCompare(b.source)
        || a.target.localeCompare(b.target));

    return { nodes, links, omitted };
  }

  // ---- placing it ----------------------------------------------------------
  //
  // Fruchterman–Reingold: every node pushes every other away, every edge pulls
  // its two ends together, and the whole thing cools over a fixed number of
  // steps. It is a dozen lines, needs no library — which matters here, because
  // the page's Content-Security-Policy allows scripts from nowhere but itself —
  // and it lays out the graphs this page produces well enough to read.
  //
  // Deterministic, deliberately. The usual implementation seeds positions at
  // random, so the same deck draws differently every search and a card appears
  // to have moved when nothing about it changed. Here the starting ring is the
  // node order, which build() has already fixed, so a deck redrawn after adding
  // a card is recognisably the same picture with one more node in it.

  const DEFAULT_WIDTH = 760;
  const DEFAULT_HEIGHT = 440;
  const DEFAULT_ITERATIONS = 320;
  // Pull toward the middle. Without it the components of a deck whose combos
  // fall into two unconnected clusters simply repel each other off the canvas.
  const GRAVITY = 0.02;

  function layout(graph, opts) {
    const o = opts || {};
    const width = o.width || DEFAULT_WIDTH;
    const height = o.height || DEFAULT_HEIGHT;
    const padding = o.padding == null ? 34 : o.padding;
    const nodes = (graph && graph.nodes) || [];
    const links = (graph && graph.links) || [];
    const n = nodes.length;
    if (!n) return graph;

    const index = new Map(nodes.map((node, i) => [node.id, i]));
    const ring = Math.max(1, Math.min(width, height) / 2 - padding);
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / n;
      node.x = width / 2 + Math.cos(angle) * ring;
      node.y = height / 2 + Math.sin(angle) * ring;
    });

    // The distance an edge would like to be, from how much room each node has.
    const ideal = Math.sqrt((width * height) / n) * 0.55;
    const iterations = o.iterations == null ? DEFAULT_ITERATIONS : o.iterations;
    // The furthest a node may move in one step, shrinking to nothing by the last
    // one. This is what makes the run settle instead of oscillating.
    let temperature = Math.min(width, height) / 8;
    const cooling = temperature / (iterations + 1);

    for (let step = 0; step < iterations; step++) {
      for (const node of nodes) { node.vx = 0; node.vy = 0; }

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let ox = a.x - b.x;
          let oy = a.y - b.y;
          let d = Math.sqrt(ox * ox + oy * oy);
          // Two nodes exactly on top of each other have no direction to push in,
          // and dividing by that distance is an Infinity that never comes back.
          // Nudged apart along a fixed axis rather than a random one, so the run
          // stays reproducible.
          if (d < 0.01) { ox = 0.01; oy = (i % 2 ? 0.01 : -0.01); d = Math.sqrt(ox * ox + oy * oy); }
          const force = (ideal * ideal) / d;
          a.vx += (ox / d) * force;
          a.vy += (oy / d) * force;
          b.vx -= (ox / d) * force;
          b.vy -= (oy / d) * force;
        }
      }

      for (const link of links) {
        const a = nodes[index.get(link.source)];
        const b = nodes[index.get(link.target)];
        if (!a || !b) continue;
        const ox = a.x - b.x;
        const oy = a.y - b.y;
        const d = Math.max(0.01, Math.sqrt(ox * ox + oy * oy));
        // Weighted, mildly: two cards sharing four combos should sit closer than
        // two sharing one, but not so much closer that the rest of the graph is
        // dragged into them.
        const force = ((d * d) / ideal) * (1 + Math.min(link.weight - 1, 3) * 0.25);
        a.vx -= (ox / d) * force;
        a.vy -= (oy / d) * force;
        b.vx += (ox / d) * force;
        b.vy += (oy / d) * force;
      }

      for (const node of nodes) {
        node.vx += (width / 2 - node.x) * GRAVITY * ideal;
        node.vy += (height / 2 - node.y) * GRAVITY * ideal;
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy) || 1;
        const move = Math.min(speed, temperature);
        node.x += (node.vx / speed) * move;
        node.y += (node.vy / speed) * move;
      }

      temperature -= cooling;
    }

    fit(nodes, width, height, padding);
    separate(nodes, width, height, padding);
    // Once more, because pushing overlapping dots apart pulls the picture in from
    // the edges it was just scaled out to — and the second pass can only ever
    // scale *up*: separate() clamps everything inside the box, so what comes back
    // is never bigger than the box, and scaling up cannot make two dots overlap
    // that did not already.
    fit(nodes, width, height, padding);
    placeLabels(nodes, o);
    for (const node of nodes) { delete node.vx; delete node.vy; }
    return graph;
  }

  // What a canvas has to be for this many cards. A real Commander deck produced
  // 28 cards and 114 lines on the first list it was tried against, and 28 nodes
  // in the box that suits 8 is a hairball: the force run settles into a knot in
  // the middle and every label lands on another. Growing the box with the deck
  // costs nothing on screen, because the SVG is scaled to the column either way
  // — a taller viewBox is a taller panel, not a smaller picture.
  // Growing it also buys labels: the dots and the type are a fixed size in these
  // coordinates, so a bigger canvas is a *relatively* smaller dot, and fewer
  // names have to be dropped for want of room. On the deck this was tuned
  // against — 28 cards, 114 lines — going from 760×440 to 888×648 took the
  // labels that could not be placed from 10 to 6. Past about there it stops
  // paying: the picture is bound by its own proportions, not by the box.
  function sizeFor(count) {
    const n = Math.max(1, count || 0);
    const over = Math.max(0, n - 12);
    return {
      width: Math.round(Math.min(900, DEFAULT_WIDTH + over * 8)),
      height: Math.round(Math.min(760, DEFAULT_HEIGHT + over * 13)),
    };
  }

  // Pushes overlapping dots apart. The force run above is about structure — what
  // sits near what — and it has no notion of how big anything is drawn, so on a
  // dense deck it happily settles two 14px dots 6px apart. A few rounds of "if
  // these two are closer than they are wide, move both along the line between
  // them" fixes that without disturbing the shape it worked out.
  const SEPARATION_ROUNDS = 60;
  // Breathing room between two dots, over and above their radii.
  const NODE_GAP = 7;

  function separate(nodes, width, height, padding) {
    const n = nodes.length;
    for (let round = 0; round < SEPARATION_ROUNDS; round++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const want = a.r + b.r + NODE_GAP;
          let ox = a.x - b.x;
          let oy = a.y - b.y;
          let d = Math.sqrt(ox * ox + oy * oy);
          if (d >= want) continue;
          if (d < 0.01) { ox = 0.01; oy = (i % 2 ? 0.01 : -0.01); d = Math.sqrt(ox * ox + oy * oy); }
          // Half the shortfall each, so neither card is privileged over the other.
          const push = ((want - d) / d) * 0.5;
          a.x += ox * push;
          a.y += oy * push;
          b.x -= ox * push;
          b.y -= oy * push;
          moved = true;
        }
      }
      // Back inside the box afterwards rather than during: clamping a node mid-
      // round can push it straight back into the one it was just moved off.
      for (const node of nodes) {
        node.x = Math.min(width - padding, Math.max(padding, node.x));
        node.y = Math.min(height - padding, Math.max(padding, node.y));
      }
      if (!moved) break;
    }
    for (const node of nodes) {
      node.x = Math.round(node.x * 100) / 100;
      node.y = Math.round(node.y * 100) / 100;
    }
  }

  // ---- labels --------------------------------------------------------------
  //
  // A label per dot is unreadable past about a dozen cards: they are wider than
  // the dots they belong to, so on the deck this was tuned against half of them
  // landed on each other and neither could be read. So each is placed if it
  // fits and dropped if it does not, busiest card first — the cards worth naming
  // on sight are the ones the deck is built around, and a dropped label is still
  // there on hover, where it is one card rather than forty.
  const LABEL_MAX_CHARS = 18;
  // 11px system-ui, measured across the card names this draws. Approximate on
  // purpose: the alternative is measuring text, which needs a DOM, which is the
  // one thing this file does not have.
  const CHAR_WIDTH = 5.6;
  // A label's box around its baseline: how far the glyphs reach up, and how far
  // the tails of a "g" reach down.
  const LABEL_ASCENT = 9;
  const LABEL_DESCENT = 3;

  function placeLabels(nodes, o) {
    const maxChars = o.labelMaxChars || LABEL_MAX_CHARS;
    const charWidth = o.charWidth || CHAR_WIDTH;
    // The dots are in the way too, and a name drawn across one belongs to
    // whichever card the eye picks — which on a dense deck was most of them. So
    // every dot is occupied ground before a single label is placed.
    const taken = nodes.map((node) => ({
      left: node.x - node.r, right: node.x + node.r,
      top: node.y - node.r, bottom: node.y + node.r,
    }));
    // Biggest dot first, so a crowd of one-combo cards cannot crowd out the card
    // holding six of them.
    for (const node of [...nodes].sort((a, b) => b.r - a.r || a.name.localeCompare(b.name))) {
      node.label = node.name.length > maxChars
        ? node.name.slice(0, maxChars - 1).trimEnd() + '…'
        : node.name;
      const width = node.label.length * charWidth;
      // Six places to try, in order of preference: under the dot, over it, out
      // to either side, then a line further out top and bottom. Every offset
      // clears the dot itself, or a label would always collide with the card it
      // belongs to and none would ever be placed.
      //
      // Two positions were not enough. A card in the middle of a busy deck is
      // ringed by other dots, so the cards whose names matter most were the ones
      // most likely to lose them — measured on the tuning deck, the labels being
      // dropped had a *larger* average dot than the ones being kept. Sideways is
      // where the room is in a crowd.
      const line = LABEL_ASCENT + LABEL_DESCENT + 2;
      const options = [
        { dx: 0, dy: node.r + LABEL_ASCENT + 2, anchor: 'middle' },
        { dx: 0, dy: -(node.r + LABEL_DESCENT + 2), anchor: 'middle' },
        { dx: node.r + 4, dy: LABEL_DESCENT, anchor: 'start' },
        { dx: -(node.r + 4), dy: LABEL_DESCENT, anchor: 'end' },
        { dx: 0, dy: node.r + LABEL_ASCENT + 2 + line, anchor: 'middle' },
        { dx: 0, dy: -(node.r + LABEL_DESCENT + 2 + line), anchor: 'middle' },
      ];
      node.labelDx = 0;
      node.labelDy = null;
      node.labelAnchor = 'middle';
      for (const at of options) {
        const x = node.x + at.dx;
        const left = at.anchor === 'start' ? x : (at.anchor === 'end' ? x - width : x - width / 2);
        const box = {
          left, right: left + width,
          top: node.y + at.dy - LABEL_ASCENT, bottom: node.y + at.dy + LABEL_DESCENT,
        };
        const clash = taken.some((other) => box.left < other.right && box.right > other.left
          && box.top < other.bottom && box.bottom > other.top);
        if (clash) continue;
        node.labelDx = at.dx;
        node.labelDy = at.dy;
        node.labelAnchor = at.anchor;
        taken.push(box);
        break;
      }
    }
  }

  // Scale and centre whatever the run settled on into the box, so a graph of
  // three cards fills the panel as readably as one of thirty and no node can end
  // up drawn outside it.
  function fit(nodes, width, height, padding) {
    const xs = nodes.map((node) => node.x);
    const ys = nodes.map((node) => node.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const scaleX = spanX > 0.01 ? (width - padding * 2) / spanX : Infinity;
    const scaleY = spanY > 0.01 ? (height - padding * 2) / spanY : Infinity;
    const scale = Math.min(scaleX, scaleY);
    const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
    const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
    for (const node of nodes) {
      // A single node, or a set of them at one point, has no span to scale by.
      const k = Number.isFinite(scale) ? scale : 1;
      // Rounded: the difference between 214.38271 and 214.38 is invisible on
      // screen and the whole of it ends up in the SVG.
      node.x = Math.round((width / 2 + (node.x - midX) * k) * 100) / 100;
      node.y = Math.round((height / 2 + (node.y - midY) * k) * 100) / 100;
    }
  }

  const api = { build, layout, sizeFor, DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_LIMIT };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.ComboGraph = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
