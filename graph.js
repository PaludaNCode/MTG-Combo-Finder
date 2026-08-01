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

  // The two ways two cards can be related, and the whole point of the map.
  //
  //   works with       a combo needs both of them
  //   interchangeable  neither combo needs the other, and swapping one for the
  //                    other turns one of your combos into another of your combos
  //
  // The second one is the one a list cannot show at all, and it is what makes the
  // map answer "which of these do the same job". Your four sacrifice outlets are
  // never in a combo together — they are alternatives — so on shared-combos alone
  // they have nothing joining them and the repulsion pushes them to four corners.
  // Counting the swaps puts them in one cluster, which is where they belong.
  //
  // Measured exactly rather than by similarity: two cards are interchangeable in
  // a combo when the rest of that combo is identical, which is the same rule
  // groupVariants() uses to collapse "Scurry Oak + Sadistic Glee + Carrion Feeder"
  // and its Viscera Seer version into one row. A looser measure — how many
  // partners two cards happen to share — was tried on a real deck and produced
  // 302 pairs against this one's 48, most of them saying nothing.
  function swapCounts(comboCards) {
    const bySignature = new Map();
    for (const keys of comboCards) {
      for (const key of keys) {
        // What the combo is besides this card. Two cards under the same signature
        // are the same combo with one card exchanged.
        const signature = keys.filter((other) => other !== key).sort().join('+');
        let sharing = bySignature.get(signature);
        if (!sharing) {
          sharing = new Set();
          bySignature.set(signature, sharing);
        }
        sharing.add(key);
      }
    }
    const counts = new Map();
    for (const sharing of bySignature.values()) {
      const swappable = [...sharing].sort();
      for (let i = 0; i < swappable.length; i++) {
        for (let j = i + 1; j < swappable.length; j++) {
          const id = swappable[i] + '|' + swappable[j];
          counts.set(id, (counts.get(id) || 0) + 1);
        }
      }
    }
    return counts;
  }

  // variants: the combos the deck can already assemble (post-expand()).
  // Returns { nodes, links, omitted }:
  //   nodes  [{ id, name, combos, r }]  id is the comparison key, combos is how
  //                                  many of your combos the card takes part in
  //   links  [{ source, target, together, swap, tier, kind }]
  //                                  together: combos needing both; swap: combos
  //                                  where one can be exchanged for the other;
  //                                  tier: the best result behind a `together`;
  //                                  kind: 'combo' or 'swap', by which one it is
  //   omitted  cards left out by the limit, 0 when everything fitted
  function build(variants, opts) {
    const limit = (opts && opts.limit) || DEFAULT_LIMIT;
    const cards = new Map();
    const edges = new Map();
    const comboCards = [];

    for (const variant of variants || []) {
      // The same set "Cards carrying your combos" counts: the cards a combo
      // names, plus whichever of yours filled each of its template slots. A card
      // holding a combo up through a slot is joined to the rest of it like any
      // other — that is what it is doing.
      const held = Combos.comboCardIndex(variant);
      const keys = [...held.keys()];
      const tier = comboTier(variant);
      comboCards.push(keys);

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
            edge = { source, target, together: 0, swap: 0, tier: 'other', kind: 'combo' };
            edges.set(id, edge);
          }
          edge.together++;
          if (TIER_RANK[tier] < TIER_RANK[edge.tier]) edge.tier = tier;
        }
      }
    }

    // The interchangeable pairs, folded into the same set of edges. A pair can in
    // principle be both — in a combo together *and* swappable in some other combo
    // — so the count lands on the same edge rather than drawing a second line
    // through the first. On a real deck the two turned out to be disjoint.
    for (const [id, count] of swapCounts(comboCards)) {
      const [source, target] = id.split('|');
      let edge = edges.get(id);
      if (!edge) {
        edge = { source, target, together: 0, swap: 0, tier: 'other', kind: 'swap' };
        edges.set(id, edge);
      }
      edge.swap = count;
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
      // Which relation the line is *for*, when a pair has both — a combo needs
      // them together, and elsewhere one replaces the other. The stronger one
      // wins, on the same scale that orders the links, because that is the one
      // worth a line style and a number; the other is still on the pair and the
      // hover text says both. Drawing two lines between the same two dots is one
      // line as far as anyone looking can tell.
      .map((e) => Object.assign(e, {
        kind: e.swap * SWAP_WORTH > e.together ? 'swap' : 'combo',
      }))
      // Strongest first, so the drawing order puts the heaviest lines on top and
      // the numbers on them are the ones offered a place first.
      .sort((a, b) => linkStrength(b) - linkStrength(a)
        || a.source.localeCompare(b.source)
        || a.target.localeCompare(b.target));

    return { nodes, links, omitted };
  }

  // What one interchangeable combo is worth against one shared combo. Under 1
  // because "these two do the same job in six combos" is a weaker claim about a
  // deck than "six combos need both of these" — the first is one decision, the
  // second is six.
  const SWAP_WORTH = 0.75;

  // How much a line means, on one scale, so the two kinds can be ordered against
  // each other.
  function linkStrength(link) {
    return link.together + link.swap * SWAP_WORTH;
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

  // How hard a line pulls its two ends together.
  //
  // Interchangeable pulls harder than works-with, and that asymmetry is the whole
  // reason the map groups anything. Cards that do the same job are exactly the
  // ones a reader wants side by side — "these four are my sacrifice outlets" is a
  // fact about the deck, and it is only a *visible* fact if they end up in one
  // place. Cards that combo together are already tied by the combo itself and do
  // not need the extra help; over-pulling them collapses the engine into a dot.
  //
  // Both are capped. One pair swapping in 23 combos, pulled 23× as hard as the
  // rest, drags the entire graph into it.
  function pull(link) {
    // A swap link earns a flat bonus before its count is counted at all. One
    // combo where either card will do is already the strongest statement the
    // data makes about two cards doing the same job, and without the step the
    // pull of a single swap (1.4) barely beat a single shared combo (1.0) — on a
    // fixture of three outlets around one payoff, the third outlet still settled
    // nearer the payoff than its own alternatives.
    return 1
      + Math.min(link.together - 1, 3) * 0.25
      + (link.swap ? SWAP_BASE + Math.min(link.swap - 1, 8) * 0.35 : 0);
  }

  const SWAP_BASE = 0.6;

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
        const force = ((d * d) / ideal) * pull(link);
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

    // Who gets the free space, in order. The dots are fixed and come first. Then
    // the handful of heaviest numbers — ahead of the card names, deliberately:
    // the heaviest overlaps sit in the middle of the deck's engine, which is
    // exactly where there is no room, so leaving them to last meant the map's
    // biggest number was the one it never printed. A name crowded out comes back
    // on hover; so does a number, but the number is the thing being asked for.
    const taken = nodes.map((node) => ({
      left: node.x - node.r, right: node.x + node.r,
      top: node.y - node.r, bottom: node.y + node.r,
    }));
    const first = placeCounts(links.slice(0, COUNTS_FIRST), index, nodes, taken, COUNTS_FIRST);
    placeLabels(nodes, o, taken);
    placeCounts(links.slice(COUNTS_FIRST), index, nodes, taken, COUNTS_SHOWN - first);

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

  // taken: the space already spoken for — every dot, and the numbers placed
  // before the names. A name drawn across a dot belongs, to the eye, to that dot,
  // which on a dense deck was most of them.
  function placeLabels(nodes, o, taken) {
    const maxChars = o.labelMaxChars || LABEL_MAX_CHARS;
    const charWidth = o.charWidth || CHAR_WIDTH;
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
    return taken;
  }

  // ---- the number on a line -------------------------------------------------
  //
  // Thickness says "more than that one"; it does not say how many, and the
  // difference between an interchangeable pair worth 3 combos and one worth 17 is
  // a deckbuilding decision. So the count is printed on the line as well.
  //
  // Not on every line: a map with 162 numbers on it is a map nobody reads. They
  // are offered a place strongest-first, in the same occupied space the dots and
  // the card names hold, and a number with nowhere to go is dropped — the line is
  // still there, still weighted, and hovering either end still names the pair.
  const COUNT_HEIGHT = 12;
  const COUNT_CHAR = 5.4;
  // Room around a number so two of them side by side read as two numbers and not
  // as one longer one — "16" and "15" touching drew a convincing "1615".
  const COUNT_PAD = 3.5;
  // Below this a number says little the line does not: one shared combo is the
  // thinnest line on the map and there are a great many of them.
  const COUNT_FROM = 2;
  // How many are on screen at rest. Every line still has its number — the rest
  // appear when a card is hovered, where they are that one card's dozen lines
  // rather than the map's hundred and fifty.
  const COUNTS_SHOWN = 14;
  // How many of them are placed before the card names rather than after.
  const COUNTS_FIRST = 8;
  // Where along a line a number may sit, and how far off it. The midpoint is the
  // obvious place and in a knot it is also the busiest, so a number that cannot
  // go there slides along the line instead of being dropped.
  // The further offsets are for the case that beat the first version: two big
  // dots side by side, joined by a short line whose whole length is inside them.
  // There is no room *on* that line at any point along it, and it is exactly the
  // pair with the biggest number — so the number steps off the line instead.
  const COUNT_SPOTS = [
    [0.5, 0], [0.38, 0], [0.62, 0], [0.5, 9], [0.5, -9], [0.28, 0], [0.72, 0],
    [0.5, 17], [0.5, -17], [0.5, 25], [0.5, -25], [0.5, 34], [0.5, -34],
  ];

  // budget: how many of these may stay on screen. Returns how many did.
  function placeCounts(links, index, nodes, taken, budget) {
    let shown = 0;
    for (const link of links) {
      link.count = link.kind === 'swap' ? link.swap : link.together;
      link.countX = null;
      link.countY = null;
      link.countShown = false;
      if (link.count < COUNT_FROM) continue;
      const a = nodes[index.get(link.source)];
      const b = nodes[index.get(link.target)];
      if (!a || !b) continue;

      const halfWidth = (String(link.count).length * COUNT_CHAR) / 2 + COUNT_PAD;
      // The line's own direction, so an offset pushes the number off the line
      // rather than along it.
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;

      let placed = null;
      for (const [t, off] of COUNT_SPOTS) {
        const x = a.x + dx * t + nx * off;
        const y = a.y + dy * t + ny * off;
        const box = {
          left: x - halfWidth, right: x + halfWidth,
          top: y - COUNT_HEIGHT / 2, bottom: y + COUNT_HEIGHT / 2,
        };
        const clash = taken.some((other) => box.left < other.right && box.right > other.left
          && box.top < other.bottom && box.bottom > other.top);
        if (clash) continue;
        placed = { x, y, box };
        break;
      }

      // Nowhere free even sliding along the line: it is a hover-only number, put
      // at the midpoint, where it will be the only thing lit nearby.
      const spot = placed || {
        x: a.x + dx * 0.5, y: a.y + dy * 0.5, box: null,
      };
      link.countX = Math.round(spot.x * 100) / 100;
      link.countY = Math.round(spot.y * 100) / 100;
      // Strongest first — links arrive sorted — so the numbers that stay on
      // screen are the overlaps worth seeing without asking.
      if (placed && shown < budget) {
        link.countShown = true;
        shown++;
        taken.push(spot.box);
      }
    }
    return shown;
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
