'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  build, layout, litFor, sizeFor, DEFAULT_WIDTH, DEFAULT_HEIGHT,
} = require('../graph.js');
const { comboPieces } = require('../combos.js');

// The combo map. Two halves worth pinning separately: what the graph *says* —
// which cards are joined, how heavily and in what colour — and where the layout
// puts them, which is the part with no visible failure mode. A node placed off
// the canvas is invisible rather than wrong-looking, and a layout that moves
// between two identical searches looks like the deck changed when it did not.

const combo = (cards, results, extra) => Object.assign({
  uses: cards.map((name) => ({ card: { name } })),
  produces: (results || ['Infinite colorless mana']).map((name) => ({ feature: { name } })),
}, extra);

const edge = (graph, a, b) => graph.links.find(
  (l) => (l.source === a && l.target === b) || (l.source === b && l.target === a)
);

// ---- what the graph says ---------------------------------------------------

test('build: a two-card combo is two nodes and the line between them', () => {
  const graph = build([combo(['Basalt Monolith', 'Rings of Brighthearth'])]);
  assert.deepStrictEqual(graph.nodes.map((n) => n.name), ['Basalt Monolith', 'Rings of Brighthearth']);
  assert.strictEqual(graph.links.length, 1);
  assert.strictEqual(graph.links[0].together, 1);
  assert.strictEqual(graph.links[0].kind, 'combo');
  assert.strictEqual(graph.omitted, 0);
});

// Three cards that only work together are a triangle, not a chain: every pair of
// them is a pair the combo needs, and drawing two of the three lines would say
// two of the cards were unrelated.
test('build: a combo of more than two joins every pair inside it', () => {
  const graph = build([combo(['A', 'B', 'C'])]);
  assert.strictEqual(graph.nodes.length, 3);
  assert.strictEqual(graph.links.length, 3);
});

test('build: a card in several combos is one node, counted once per combo', () => {
  const graph = build([
    combo(['Basalt Monolith', 'Rings of Brighthearth']),
    combo(['Basalt Monolith', 'Kinnan, Bonder Prodigy']),
    combo(['Basalt Monolith', 'Power Artifact']),
  ]);
  assert.strictEqual(graph.nodes.length, 4);
  assert.strictEqual(graph.nodes[0].name, 'Basalt Monolith'); // busiest first
  assert.strictEqual(graph.nodes[0].combos, 3);
  // Three lines to Basalt Monolith, and three more between its three partners:
  // each of them is "Basalt Monolith + one other card", so any one stands in for
  // any other. That is the second relation, and this fixture is the smallest
  // thing that has one.
  assert.strictEqual(graph.links.filter((l) => l.kind === 'combo').length, 3);
  assert.strictEqual(graph.links.filter((l) => l.kind === 'swap').length, 3);
});

// The same pair turning up in two combos is one line, drawn heavier — not two
// lines on top of each other, which would look exactly like one.
test('build: a pair sharing two combos is one line of weight two', () => {
  const graph = build([
    combo(['Devoted Druid', 'Vizier of Remedies'], ['Infinite green mana']),
    combo(['Devoted Druid', 'Vizier of Remedies', 'Walking Ballista'], ['Infinite damage']),
  ]);
  assert.strictEqual(edge(graph, 'devoted druid', 'vizier of remedies').together, 2);
  assert.strictEqual(edge(graph, 'devoted druid', 'walking ballista').together, 1);
});

// Card names are compared the way they are everywhere else on the page: front
// face only, case-insensitively. Otherwise a deck holding a modal double-faced
// card draws it as two unconnected dots.
test('build: the two spellings of one card are one node', () => {
  const graph = build([
    combo(['Valki, God of Lies // Tibalt, Cosmic Impostor', 'Sol Ring']),
    combo(['valki, god of lies', 'Basalt Monolith']),
  ]);
  const valki = graph.nodes.find((n) => n.id === 'valki, god of lies');
  assert.strictEqual(valki.combos, 2);
  assert.strictEqual(valki.name, 'Valki, God of Lies');
  assert.strictEqual(graph.nodes.length, 3);
});

// A card credited with a template slot holds the combo up like any card the
// combo names, so it is joined to the rest of it — the same rule "Cards carrying
// your combos" already applies, and the two panels must not disagree.
test('build: a card filling a template slot is in the graph too', () => {
  const graph = build([
    combo(['Rings of Brighthearth'], ['Infinite damage'], { fills: [{ card: 'Walking Ballista' }] }),
  ]);
  assert.deepStrictEqual(graph.nodes.map((n) => n.name).sort(), ['Rings of Brighthearth', 'Walking Ballista']);
  assert.strictEqual(edge(graph, 'rings of brighthearth', 'walking ballista').together, 1);
});

test('build: the map holds exactly the cards the pieces panel lists', () => {
  const variants = [
    combo(['Basalt Monolith', 'Rings of Brighthearth']),
    combo(['Scurry Oak', 'Heliod, Sun-Crowned'], ['Win the game']),
    combo(['Rings of Brighthearth'], ['Infinite damage'], { fills: [{ card: 'Walking Ballista' }] }),
  ];
  assert.deepStrictEqual(
    build(variants).nodes.map((n) => n.name).sort(),
    comboPieces(variants).map((p) => p.card).sort()
  );
});

// ---- what colour a line is -------------------------------------------------

test('build: a line takes the tier of the combo behind it', () => {
  const graph = build([
    combo(['A', 'B'], ['Win the game']),
    combo(['C', 'D'], ['Infinite colorless mana']),
    combo(['E', 'F'], ['Infinite ETB']),
  ]);
  assert.strictEqual(edge(graph, 'a', 'b').tier, 'win');
  assert.strictEqual(edge(graph, 'c', 'd').tier, 'decisive');
  assert.strictEqual(edge(graph, 'e', 'f').tier, 'other');
});

// Two cards in a plumbing combo and a game-winning one are a pair that wins the
// game. Taking the best of them is the whole reason the colour is worth drawing.
test('build: a line shared by two combos takes the better tier', () => {
  const graph = build([
    combo(['A', 'B'], ['Infinite ETB']),
    combo(['A', 'B'], ['Win the game']),
  ]);
  assert.strictEqual(edge(graph, 'a', 'b').tier, 'win');
});

test('build: a combo publishing no results at all is grey rather than undefined', () => {
  const graph = build([combo(['A', 'B'], [])]);
  assert.strictEqual(edge(graph, 'a', 'b').tier, 'other');
});

// The dataset's own shape, not the expanded one: the tier has to be readable off
// a combo either side of expand(), like every other read of `produces`/`p`.
test('build: an unexpanded combo still gets its tier', () => {
  const graph = build([{ uses: [{ card: { name: 'A' } }, { card: { name: 'B' } }], p: ['Win the game'] }]);
  assert.strictEqual(edge(graph, 'a', 'b').tier, 'win');
});

// ---- the limit -------------------------------------------------------------

test('build: past the limit the busiest cards are kept and the rest reported', () => {
  const variants = [];
  for (let i = 0; i < 20; i++) variants.push(combo(['Hub', 'Spoke ' + i]));
  const graph = build(variants, { limit: 5 });
  assert.strictEqual(graph.nodes.length, 5);
  assert.strictEqual(graph.nodes[0].name, 'Hub');
  assert.strictEqual(graph.omitted, 16);
  // And nothing is left pointing at a card that was dropped, which would draw a
  // line to a corner of the canvas with nothing in it.
  const kept = new Set(graph.nodes.map((n) => n.id));
  assert.ok(graph.links.every((l) => kept.has(l.source) && kept.has(l.target)));
  // Four spokes left, so four lines to the hub — and the six between the spokes,
  // which are all "Hub + one spoke" and so all stand in for each other.
  assert.strictEqual(graph.links.filter((l) => l.kind === 'combo').length, 4);
  assert.strictEqual(graph.links.filter((l) => l.kind === 'swap').length, 6);
});

test('build: nothing in, empty graph out', () => {
  for (const graph of [build([]), build()]) {
    assert.deepStrictEqual(graph.nodes, []);
    assert.deepStrictEqual(graph.links, []);
    assert.strictEqual(graph.omitted, 0);
    assert.deepStrictEqual(graph.combos, []);
    assert.strictEqual(graph.names.size, 0);
  }
});

// ---- where the layout puts it ----------------------------------------------

const grid = () => {
  const variants = [];
  for (let i = 0; i < 6; i++) variants.push(combo(['Hub', 'Spoke ' + i]));
  variants.push(combo(['Far A', 'Far B'])); // a second, unconnected cluster
  return build(variants);
};

// A knot, in the shape a real Commander deck produces: a core of cards that all
// combo with each other, a fringe hanging off it, and far more lines than cards.
// The first real list this was tried against drew 28 cards and 114 lines, and
// everything about crowding — dots on dots, labels on labels — only shows up at
// that density.
const dense = () => {
  const core = ['Scurry Oak', 'Heliod, Sun-Crowned', 'Archangel of Thune', 'Basking Broodscale',
    'Ashnod\'s Altar', 'Herd Baloth', 'Essence Warden', 'Soul Warden'];
  const variants = [];
  for (let i = 0; i < core.length; i++) {
    for (let j = i + 1; j < core.length; j++) {
      variants.push(combo([core[i], core[j]], i % 3 ? ['Infinite damage'] : ['Win the game']));
    }
  }
  // Named the length real cards are named: a label is much wider than the dot it
  // belongs to, so "Fringe 3" would prove nothing about crowding.
  for (let i = 0; i < 12; i++) variants.push(combo([core[i % core.length], 'Prosperous Innkeeper ' + i]));
  return build(variants);
};

const placed = (graph, size) => layout(graph, size || { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
// The dense fixture on the canvas the page would give it.
const placedDense = () => {
  const graph = dense();
  return placed(graph, sizeFor(graph.nodes.length));
};

test('layout: every node lands inside the canvas', () => {
  const graph = placed(grid());
  for (const node of graph.nodes) {
    assert.ok(node.x >= 0 && node.x <= DEFAULT_WIDTH, `${node.name} at x=${node.x}`);
    assert.ok(node.y >= 0 && node.y <= DEFAULT_HEIGHT, `${node.name} at y=${node.y}`);
  }
});

// A component with nothing tying it to the rest is pushed away by every node in
// it, and without a pull toward the middle it simply leaves.
test('layout: an unconnected cluster is still on the canvas', () => {
  const graph = placed(grid());
  const far = graph.nodes.filter((n) => n.name.startsWith('Far'));
  assert.strictEqual(far.length, 2);
  for (const node of far) {
    assert.ok(node.x > 0 && node.x < DEFAULT_WIDTH && node.y > 0 && node.y < DEFAULT_HEIGHT);
  }
});

// Measured against how big the dots actually are, not against a flat distance:
// the force run knows about structure and nothing about size, so on a dense deck
// it will happily settle two 20px dots 6px apart and draw them as one blob.
test('layout: no two dots overlap, however dense the deck', () => {
  const graph = placedDense();
  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = i + 1; j < graph.nodes.length; j++) {
      const a = graph.nodes[i];
      const b = graph.nodes[j];
      const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
      assert.ok(gap > 0, `${a.name} and ${b.name} overlap by ${(-gap).toFixed(1)}px`);
    }
  }
});

// The deck is searched again after every "+ Add to deck", and the map is thrown
// away and rebuilt each time. If the placement were seeded at random — as the
// usual implementation is — the same deck would draw a different picture every
// time, and a card that had not moved would appear to have.
test('layout: the same deck draws the same picture twice', () => {
  const a = placed(grid()).nodes.map((n) => [n.name, n.x, n.y]);
  const b = placed(grid()).nodes.map((n) => [n.name, n.x, n.y]);
  assert.deepStrictEqual(a, b);
});

// What the picture is for: cards that combo together sit together. Asserted per
// card rather than as one distance — two clusters can be well apart and still
// have their facing corners closer to each other than a cluster is wide, so
// "every intra-cluster gap beats every inter-cluster one" is a stronger claim
// than the layout makes or needs to. What has to hold is that reading a card's
// neighbours off the picture reads its combos.
test('layout: the card nearest each one is a card it combos with', () => {
  const graph = placed(build([
    combo(['A', 'B']), combo(['B', 'C']), combo(['A', 'C']),
    combo(['X', 'Y']), combo(['Y', 'Z']), combo(['X', 'Z']),
  ]));
  const cluster = (name) => ('ABC'.includes(name) ? 'ABC' : 'XYZ');
  for (const node of graph.nodes) {
    const nearest = graph.nodes
      .filter((other) => other !== node)
      .sort((p, q) => Math.hypot(p.x - node.x, p.y - node.y) - Math.hypot(q.x - node.x, q.y - node.y))[0];
    assert.strictEqual(cluster(nearest.name), cluster(node.name),
      `${node.name} is drawn nearest ${nearest.name}, which it shares no combo with`);
  }
});

// One card is placed in the middle of the canvas it was given — and then the
// canvas is trimmed to it, so what comes back is a small box with the card in
// the middle of *that*. Both halves matter: the second is what stops a one-card
// map being a dot in an acre of empty panel.
test('layout: a single card sits in the middle of what is drawn', () => {
  const graph = layout(build([combo(['Rings of Brighthearth'], ['Infinite damage'])]),
    { width: 400, height: 200 });
  assert.ok(Math.abs(graph.nodes[0].x - graph.width / 2) < 1,
    `the card is at ${graph.nodes[0].x} on a ${graph.width}-wide canvas`);
  assert.ok(graph.width < 400 && graph.height < 200, 'the canvas was not trimmed to the card');
});

test('layout: an empty graph is left alone', () => {
  const graph = layout(build([]));
  assert.deepStrictEqual(graph.nodes, []);
  assert.deepStrictEqual(graph.links, []);
});

// The working values the run needs are not part of the answer, and an SVG
// renderer reading them back would be reading someone else's scratch paper.
test('layout: no working state is left on the nodes', () => {
  for (const node of placed(grid()).nodes) {
    assert.deepStrictEqual(Object.keys(node).sort(),
      ['combos', 'id', 'label', 'labelAnchor', 'labelDx', 'labelDy', 'name', 'r', 'x', 'y']);
  }
});

// ---- how big a card is drawn ------------------------------------------------

test('build: a card in more combos is drawn bigger, by area', () => {
  const graph = build([
    combo(['Hub', 'A']), combo(['Hub', 'B']), combo(['Hub', 'C']), combo(['Hub', 'D']),
  ]);
  const hub = graph.nodes[0];
  const spoke = graph.nodes[1];
  assert.strictEqual(hub.combos, 4);
  assert.ok(hub.r > spoke.r, 'the busiest card is not drawn bigger');
  // Four combos against one is twice the radius at most, not four times: the
  // count is an area, or one card swamps the picture.
  assert.ok(hub.r < spoke.r * 2.5, `a 4-combo dot is ${(hub.r / spoke.r).toFixed(1)}× a 1-combo one`);
});

test('sizeFor: the canvas grows with the deck and then stops', () => {
  const small = sizeFor(8);
  const mid = sizeFor(28);
  const huge = sizeFor(200);
  assert.strictEqual(small.width, DEFAULT_WIDTH);
  assert.strictEqual(small.height, DEFAULT_HEIGHT);
  assert.ok(mid.width > small.width && mid.height > small.height);
  assert.ok(huge.width <= 900 && huge.height <= 760);
  assert.deepStrictEqual(sizeFor(0), small); // nothing to draw is still a canvas
});

// What a phone gets, and why it is not simply the same map smaller. Every length
// on this canvas is in canvas units and the whole thing is scaled into the
// column, so the only way to make anything bigger is to make the canvas smaller
// relative to what is drawn on it.
test('sizeFor: a narrow column gets a smaller canvas and bigger type', () => {
  const wide = sizeFor(20, 900);
  const narrow = sizeFor(20, 370);
  assert.ok(narrow.width < wide.width * 0.6,
    `narrow canvas is ${narrow.width} against ${wide.width}`);
  assert.ok(narrow.fontSize > wide.fontSize, 'the type did not grow');
  // Names are cut shorter to pay for the type: a label is much wider than its
  // dot, and at this size two long ones at opposite edges would set the width of
  // the whole picture — which is the scale.
  assert.ok(narrow.labelMaxChars < wide.labelMaxChars, 'the names did not get shorter');
});

test('sizeFor: the column only matters when it is narrow', () => {
  assert.deepStrictEqual(sizeFor(20, 1200), sizeFor(20));
});

// ---- labels ------------------------------------------------------------------

// The box a placed label occupies, reconstructed the way graph.js reckons it:
// 5.6px a character at 11px, 9px of it above the baseline and 3px below.
// The same reckoning graph.js does, at its default type size: 0.51 of the size
// per character, 0.82 above the baseline and 0.27 below.
const labelBox = (node, fontSize) => {
  const size = fontSize || 11;
  const width = node.label.length * size * 0.51;
  const x = node.x + node.labelDx;
  const left = node.labelAnchor === 'start' ? x
    : (node.labelAnchor === 'end' ? x - width : x - width / 2);
  return {
    left,
    right: left + width,
    top: node.y + node.labelDy - Math.round(size * 0.82 * 10) / 10,
    bottom: node.y + node.labelDy + Math.round(size * 0.27 * 10) / 10,
  };
};
const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

test('layout: a long card name is clipped, and keeps its full name to hand', () => {
  const graph = placed(build([combo(['Chatterfang, Squirrel General', 'Ashnod\'s Altar'])]));
  const long = graph.nodes.find((n) => n.name.startsWith('Chatterfang'));
  assert.ok(long.label.length <= 18, `label is ${long.label.length} characters`);
  assert.ok(long.label.endsWith('…'));
  assert.strictEqual(long.name, 'Chatterfang, Squirrel General');
});

// The failure this was written against: names drawn across dots that are not
// theirs. A label over another card's dot belongs, to the eye, to that card.
test('layout: no label is drawn over a dot', () => {
  const graph = placedDense();
  const shown = graph.nodes.filter((n) => n.labelDy != null);
  for (const node of shown) {
    const box = labelBox(node);
    for (const other of graph.nodes) {
      const dot = {
        left: other.x - other.r, right: other.x + other.r,
        top: other.y - other.r, bottom: other.y + other.r,
      };
      assert.ok(!hits(box, dot), `"${node.label}" is drawn across ${other.name}'s dot`);
    }
  }
});

test('layout: no two labels are drawn on top of each other', () => {
  const graph = placedDense();
  const shown = graph.nodes.filter((n) => n.labelDy != null).map((n) => labelBox(n));
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      assert.ok(!hits(shown[i], shown[j]), 'two labels overlap');
    }
  }
});

// The trade that makes the two assertions above possible: where there is
// genuinely no room a name is dropped rather than drawn somewhere it would be
// read as another card's. Forced with a canvas far too small for the graph,
// which is the same crowding a real 28-card map produces at full size — and
// deterministic, where waiting for a fixture to happen to collide is not.
test('layout: with no room, names are dropped rather than piled up', () => {
  const graph = placed(dense(), { width: 400, height: 300 });
  const dropped = graph.nodes.filter((n) => n.labelDy == null);
  assert.ok(dropped.length, 'nothing was dropped on a canvas with no room, so the fallback is untested');
  // Every dropped one still carries its text, for the hover to show.
  assert.ok(dropped.every((n) => n.label));
  // And whatever did survive is still placed cleanly.
  const shown = graph.nodes.filter((n) => n.labelDy != null).map((n) => labelBox(n));
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      assert.ok(!hits(shown[i], shown[j]), 'two labels overlap on the crowded canvas');
    }
  }
});

test('layout: a card with room keeps its label centred below the dot', () => {
  const graph = placed(build([combo(['A', 'B'])]));
  assert.ok(graph.nodes.every((n) => n.labelDy > 0), 'a label went above a dot with room below it');
  assert.ok(graph.nodes.every((n) => n.labelDx === 0 && n.labelAnchor === 'middle'));
});

// Sideways is where the room is in a crowd, and it is the placement that keeps
// the cards in the middle of a busy deck named — those being the ones a reader
// most wants named.
test('layout: a crowded label goes beside its dot rather than being dropped', () => {
  const graph = placed(dense(), { width: 400, height: 300 });
  const beside = graph.nodes.filter((n) => n.labelAnchor !== 'middle');
  assert.ok(beside.length, 'nothing was placed beside a dot, so the sideways options are untested');
  for (const node of beside) {
    // Growing away from the dot, not back through it.
    if (node.labelAnchor === 'start') assert.ok(node.labelDx > 0);
    else assert.ok(node.labelDx < 0);
  }
});

// ---- the second relation: cards that stand in for each other ----------------
//
// The reason the map exists in this shape. Two sacrifice outlets are never in a
// combo together — they are alternatives — so on shared combos alone there is
// nothing joining them at all, and the repulsion puts them in opposite corners.
// That was the first version's real failure: a reader looking for "which of
// these do the same job" was looking at the one question the picture could not
// answer.

// Two payoffs and three outlets, each outlet completing the same combos: the
// shape a real aristocrats deck makes, and the smallest one that has it.
const outlets = () => build([
  combo(['Scurry Oak', 'Carrion Feeder'], ['Win the game']),
  combo(['Scurry Oak', 'Viscera Seer'], ['Win the game']),
  combo(['Scurry Oak', 'Ashnod\'s Altar'], ['Win the game']),
  combo(['Heliod, Sun-Crowned', 'Carrion Feeder'], ['Infinite damage']),
  combo(['Heliod, Sun-Crowned', 'Viscera Seer'], ['Infinite damage']),
  combo(['Heliod, Sun-Crowned', 'Ashnod\'s Altar'], ['Infinite damage']),
]);

test('build: cards that fill the same role in a combo are joined', () => {
  const graph = outlets();
  const link = edge(graph, 'carrion feeder', 'viscera seer');
  assert.ok(link, 'two interchangeable outlets have no line between them');
  assert.strictEqual(link.kind, 'swap');
  // Both payoffs: either outlet works in the Scurry Oak combo and in the Heliod
  // one, so the pair stands in for each other twice.
  assert.strictEqual(link.swap, 2);
  assert.strictEqual(link.together, 0);
});

test('build: being in a combo together is not the same as standing in for each other', () => {
  const graph = outlets();
  const worksWith = edge(graph, 'scurry oak', 'carrion feeder');
  assert.strictEqual(worksWith.kind, 'combo');
  assert.strictEqual(worksWith.together, 1);
  assert.strictEqual(worksWith.swap, 0);
});

// A pair can be both — a combo needs them together, and somewhere else one
// replaces the other. One line carries both counts; two lines drawn between the
// same two dots is one line as far as anyone looking can tell.
test('build: a pair that is both ways round is still one line', () => {
  const graph = build([
    combo(['A', 'B']),
    combo(['A', 'C']),
    combo(['B', 'C']),
  ]);
  const link = edge(graph, 'a', 'b');
  assert.strictEqual(link.together, 1);
  assert.strictEqual(link.swap, 1); // both are "C + one other card"
  assert.strictEqual(graph.links.length, 3);
});

test('build: a card that stands in for nothing has no swap line', () => {
  const graph = build([combo(['Basalt Monolith', 'Rings of Brighthearth'])]);
  assert.ok(graph.links.every((l) => l.swap === 0));
});

// What the user actually asked for, as geometry: the interchangeable cards end
// up together. Compared against the payoffs they all combo with — the outlets
// are joined to those by real combos, so with no pull on the swap lines the
// outlets would be spread evenly around the payoffs instead of grouped.
//
// On the average rather than the worst case: this fixture is a complete graph —
// every one of its five cards is related to every other — so a layout that
// separated the two groups perfectly would have to be a line, not a picture.
test('layout: cards that do the same job are drawn closer than cards that merely combo', () => {
  const graph = placed(outlets());
  const at = (name) => graph.nodes.find((n) => n.name.startsWith(name));
  const gap = (a, b) => Math.hypot(at(a).x - at(b).x, at(a).y - at(b).y);
  const mean = (xs) => xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const amongOutlets = mean([
    gap('Carrion', 'Viscera'), gap('Carrion', 'Ashnod'), gap('Viscera', 'Ashnod'),
  ]);
  const toPayoffs = mean([
    gap('Carrion', 'Scurry'), gap('Viscera', 'Scurry'), gap('Ashnod', 'Scurry'),
    gap('Carrion', 'Heliod'), gap('Viscera', 'Heliod'), gap('Ashnod', 'Heliod'),
  ]);
  assert.ok(amongOutlets < toPayoffs,
    `outlets average ${amongOutlets.toFixed(0)}px apart, ${toPayoffs.toFixed(0)}px from a payoff`);
});

// And two groups that share nothing stay two groups. Measured the way cluster
// separation is measured — how far apart the two sets sit against how spread
// each one is — rather than by each card's single nearest neighbour: with four
// cards mutually related, a hub can legitimately end up nearer one alternative
// than the alternatives are to each other, and that is geometry in two
// dimensions, not a layout that failed to group anything.
test('layout: two sets of interchangeable cards make two clusters', () => {
  const graph = placed(build([
    combo(['Payoff', 'Sac A'], ['Win the game']),
    combo(['Payoff', 'Sac B'], ['Win the game']),
    combo(['Payoff', 'Sac C'], ['Win the game']),
    combo(['Engine', 'Draw A'], ['Infinite card draw']),
    combo(['Engine', 'Draw B'], ['Infinite card draw']),
    combo(['Engine', 'Draw C'], ['Infinite card draw']),
  ]));
  const pick = (prefix) => graph.nodes.filter((n) => n.name.startsWith(prefix));
  const spread = (group) => {
    const gaps = [];
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        gaps.push(Math.hypot(group[i].x - group[j].x, group[i].y - group[j].y));
      }
    }
    return Math.max(...gaps);
  };
  const centre = (group) => ({
    x: group.reduce((s, n) => s + n.x, 0) / group.length,
    y: group.reduce((s, n) => s + n.y, 0) / group.length,
  });
  const sacs = pick('Sac');
  const draws = pick('Draw');
  const a = centre(sacs);
  const b = centre(draws);
  const between = Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(between > spread(sacs) && between > spread(draws),
    `the groups are ${between.toFixed(0)}px apart but ${spread(sacs).toFixed(0)}px `
    + `and ${spread(draws).toFixed(0)}px wide`);
});

// ---- the number on a line ---------------------------------------------------

test('layout: every line worth a number gets one, shown or on hover', () => {
  const graph = placed(outlets());
  for (const link of graph.links) {
    if (link.count >= 2) {
      assert.ok(link.countX != null, 'a line worth a number was given nowhere to put it');
    }
  }
  // One shared combo is the thinnest line on the map and there are a great many
  // of them; a "1" on each says nothing the line does not.
  assert.ok(graph.links.filter((l) => l.count === 1).every((l) => l.countX == null));
});

test('layout: the number counts the relation its line is for', () => {
  const graph = placed(outlets());
  const swap = edge(graph, 'carrion feeder', 'viscera seer');
  const worksWith = edge(graph, 'scurry oak', 'carrion feeder');
  assert.strictEqual(swap.count, swap.swap);
  assert.strictEqual(worksWith.count, worksWith.together);
});

// The failure this ordering was written against: the heaviest overlaps sit in
// the middle of the deck's engine, which is exactly where there is no room, so
// leaving the numbers until after the card names meant the map's biggest number
// was the one it never printed.
test('layout: the biggest overlap keeps its number even in a knot', () => {
  const graph = placedDense();
  const strongest = graph.links[0];
  assert.ok(strongest.count >= 2, 'the dense fixture has no overlap worth a number');
  assert.ok(strongest.countShown, `the strongest line (${strongest.count}) printed no number`);
});

test('layout: only a handful of numbers are on screen at rest', () => {
  const graph = placedDense();
  const shown = graph.links.filter((l) => l.countShown);
  const hidden = graph.links.filter((l) => l.countX != null && !l.countShown);
  assert.ok(shown.length && shown.length <= 14, `${shown.length} numbers drawn at rest`);
  assert.ok(hidden.length, 'nothing was left for the hover, so the crowding is untested');
  // Shown strongest-first: nothing on screen may be weaker than something hidden
  // that could have taken its place.
  const weakestShown = Math.min(...shown.map((l) => l.count));
  const strongestHidden = Math.max(...hidden.map((l) => l.count));
  assert.ok(weakestShown >= strongestHidden - 0.001
    || shown.length === 14, 'a weaker number was drawn over a stronger one');
});

test('layout: a number never lands on a dot or a name', () => {
  const graph = placedDense();
  const boxes = graph.nodes.map((n) => ({
    left: n.x - n.r, right: n.x + n.r, top: n.y - n.r, bottom: n.y + n.r,
  })).concat(graph.nodes.filter((n) => n.labelDy != null).map((n) => labelBox(n)));
  for (const link of graph.links.filter((l) => l.countShown)) {
    const half = (String(link.count).length * 11 * 0.9 * 0.51) / 2 + 3.5;
    const box = {
      left: link.countX - half, right: link.countX + half,
      top: link.countY - 6, bottom: link.countY + 6,
    };
    for (const other of boxes) {
      assert.ok(!hits(box, other), `the number ${link.count} is drawn over something else`);
    }
  }
});

// ---- comparing two or three cards -------------------------------------------
//
// Picking one card out answers "what is this tangled up with". Picking two or
// three answers the question after it — these look like the same effect, which
// do I keep? — and that one is not about any line on the map. It is about the
// combos behind them, and every number in the answer is counted.

const { compare } = require('../graph.js');

test('compare: two cards that stand in for each other', () => {
  const found = compare(outlets(), ['carrion feeder', 'viscera seer']);
  assert.deepStrictEqual(found.cards, ['Carrion Feeder', 'Viscera Seer']);
  assert.strictEqual(found.inAll, 0); // no combo needs both
  assert.strictEqual(found.interchangeable, 2); // either fills the same slot twice
  assert.deepStrictEqual(found.shared, ['Heliod, Sun-Crowned', 'Scurry Oak']);
});

test('compare: two cards a combo needs together', () => {
  const found = compare(build([
    combo(['Basalt Monolith', 'Rings of Brighthearth']),
    combo(['Basalt Monolith', 'Rings of Brighthearth', 'Walking Ballista'], ['Infinite damage']),
  ]), ['basalt monolith', 'rings of brighthearth']);
  assert.strictEqual(found.inAll, 2);
  assert.strictEqual(found.interchangeable, 0);
  assert.deepStrictEqual(found.shared, ['Walking Ballista']);
});

// The number the whole feature is for. Cutting a card does not cost you its
// combos when another card in your deck fills the same slot — which is exactly
// what the interchangeable relation knows and a combo count does not.
test('compare: cutting a card with a stand-in costs nothing', () => {
  const found = compare(outlets(), ['carrion feeder']);
  assert.strictEqual(found.atRisk, 2, 'Carrion Feeder is in two combos');
  assert.strictEqual(found.lost, 0, 'but either other outlet covers both');
  assert.strictEqual(found.saved, 2);
});

test('compare: cutting two of three alternatives still costs nothing', () => {
  const found = compare(outlets(), ['carrion feeder', 'viscera seer']);
  assert.strictEqual(found.atRisk, 4);
  assert.strictEqual(found.lost, 0, "Ashnod's Altar is still there for both combos");
});

// ...and cutting the whole group costs all of it, which is the answer that makes
// the previous two worth printing.
test('compare: cutting every alternative costs every combo', () => {
  const found = compare(outlets(), ['carrion feeder', 'viscera seer', "ashnod's altar"]);
  assert.strictEqual(found.atRisk, 6);
  assert.strictEqual(found.lost, 6);
  assert.strictEqual(found.saved, 0);
  assert.strictEqual(found.interchangeable, 2, 'all three fill the same slot in both combos');
});

test('compare: a card with no stand-in takes its combos with it', () => {
  const found = compare(outlets(), ['scurry oak']);
  assert.strictEqual(found.atRisk, 3);
  // Heliod fills the same role as Scurry Oak in each of the three combos, so
  // this fixture's payoffs cover for each other too.
  assert.strictEqual(found.lost, 0);
  const alone = compare(build([combo(['Basalt Monolith', 'Rings of Brighthearth'])]), ['basalt monolith']);
  assert.strictEqual(alone.atRisk, 1);
  assert.strictEqual(alone.lost, 1, 'nothing else in the deck can be Basalt Monolith');
});

test('compare: three cards that all fill one slot', () => {
  const found = compare(outlets(), ['carrion feeder', 'viscera seer', "ashnod's altar"]);
  assert.strictEqual(found.cards.length, 3);
  assert.strictEqual(found.inAll, 0);
  assert.deepStrictEqual(found.shared, ['Heliod, Sun-Crowned', 'Scurry Oak']);
});

test('compare: nothing picked, nothing claimed', () => {
  const found = compare(outlets(), []);
  assert.deepStrictEqual(found.cards, []);
  assert.strictEqual(found.atRisk, 0);
  assert.strictEqual(found.lost, 0);
  // A card that is not on the map cannot be compared with one that is.
  assert.deepStrictEqual(compare(outlets(), ['sol ring']).cards, []);
});

// A card credited with a template slot is a card on the map, so it has to be
// comparable like any other — the two panels must not disagree about what is in
// a combo.
test('compare: a card filling a template slot counts like any other', () => {
  const graph = build([
    combo(['Rings of Brighthearth'], ['Infinite damage'], { fills: [{ card: 'Walking Ballista' }] }),
    combo(['Rings of Brighthearth', 'Basalt Monolith']),
  ]);
  const found = compare(graph, ['walking ballista', 'basalt monolith']);
  assert.strictEqual(found.interchangeable, 1, 'either completes a Rings combo');
  assert.deepStrictEqual(found.shared, ['Rings of Brighthearth']);
});

// ---- the canvas the map is actually drawn in --------------------------------
//
// A graph is rarely the shape of the box it is fitted into, and the difference
// is empty canvas: the fit scales to whichever axis binds and leaves the other
// short. On a phone that was 40% of the panel, so the box comes back trimmed to
// what was drawn on it.

const spanOf = (graph) => {
  const xs = graph.nodes.flatMap((n) => [n.x - n.r, n.x + n.r]);
  const ys = graph.nodes.flatMap((n) => [n.y - n.r, n.y + n.r]);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
};

test('layout: the canvas comes back trimmed to the drawing', () => {
  const graph = placed(dense(), { width: 900, height: 900, padding: 30 });
  const span = spanOf(graph);
  // Labels stick out past the dots, so the margin is measured against the dots
  // and only has to be *bounded* — what matters is that there is no band of
  // empty canvas, not that the fit is to the pixel.
  assert.ok(span.left >= 0 && span.top >= 0, 'the drawing starts outside its own canvas');
  assert.ok(graph.width - span.right < 140, `${graph.width - span.right}px of empty canvas on the right`);
  assert.ok(graph.height - span.bottom < 140, `${graph.height - span.bottom}px of empty canvas below`);
  // It can come back a little *wider* than the box it was given: the fit sizes
  // the dots, and the names hang off them. That is the trade — a canvas that
  // stayed exactly the size asked for would be one that clipped the names, which
  // is what a phone used to do.
  assert.ok(graph.width < 900 + 250 && graph.height < 900 + 250,
    `the canvas came back at ${graph.width}x${graph.height}`);
});

test('layout: everything drawn is inside the canvas it reports', () => {
  const graph = placed(dense(), sizeFor(20, 370));
  for (const node of graph.nodes) {
    assert.ok(node.x - node.r >= 0 && node.x + node.r <= graph.width, `${node.name} is off the side`);
    assert.ok(node.y - node.r >= 0 && node.y + node.r <= graph.height, `${node.name} is off the end`);
  }
  // Including the names, which the old fit did not account for at all — they
  // overhang the dots, and on a phone they were being clipped by the viewBox.
  for (const node of graph.nodes.filter((n) => n.labelDy != null)) {
    const box = labelBox(node, graph.fontSize);
    assert.ok(box.left >= -1 && box.right <= graph.width + 1, `${node.name}'s name is clipped`);
  }
});

// The layout reserves room for text by measuring a box; the page draws that text
// at whatever the stylesheet says. If the two numbers disagree the names overlap,
// which is exactly what a media query bumping mobile type to 13 units did while
// this file went on reserving room for 11.
test('layout: the type size it reserved for is the one it reports', () => {
  const wide = placed(dense(), sizeFor(20, 900));
  const narrow = placed(dense(), sizeFor(20, 370));
  assert.strictEqual(wide.fontSize, 11);
  assert.strictEqual(narrow.fontSize, sizeFor(20, 370).fontSize);
  assert.ok(narrow.fontSize > wide.fontSize);
});

test('layout: bigger type reserves a bigger box', () => {
  const one = placed(build([combo(['Basalt Monolith', 'Rings of Brighthearth'])]),
    { width: 400, height: 300, fontSize: 11 });
  const two = placed(build([combo(['Basalt Monolith', 'Rings of Brighthearth'])]),
    { width: 400, height: 300, fontSize: 22 });
  const widthOf = (g) => labelBox(g.nodes[0], g.fontSize).right - labelBox(g.nodes[0], g.fontSize).left;
  assert.ok(widthOf(two) > widthOf(one) * 1.8, 'doubling the type did not double the box');
});

// The whole point of the narrow preset: a phone reads the map at something near
// the size a desktop does. Measured as the ratio the browser will apply — the
// column divided by the canvas — times the type size in canvas units.
test('layout: a phone renders type at a legible size', () => {
  const column = 370;
  const graph = placed(dense(), sizeFor(20, column));
  const onScreen = (column / graph.width) * graph.fontSize;
  assert.ok(onScreen >= 10, `card names would render at ${onScreen.toFixed(1)}px on a phone`);
});

// ---- what lights up, and in which view --------------------------------------
//
// The map draws two relations and its chips show one at a time. Highlighting used to walk
// every link whatever was on screen, so hovering in the Interchangeable view lit the cards
// the hovered one *combos with* — dashed lines on screen, a works-together answer glowing
// underneath. Several lit cards had no dashed line to the hovered one at all, and a card
// that did was left dim.
//
// A synthetic graph rather than a real deck, because the point is the relation and not the
// data: A combos with C, and A is interchangeable with S.

const litGraph = () => ({
  links: [
    { source: 'a', target: 'c', kind: 'combo' },
    { source: 'a', target: 's', kind: 'swap' },
  ],
});

test('litFor: the swap view lights what stands in, not what combos', () => {
  const on = litFor(litGraph(), ['a'], 'swap');
  assert.ok(on.has('s'), 'the card joined by a dashed line is dim');
  assert.ok(!on.has('c'), 'a combo partner lit in the interchangeable view');
  assert.ok(on.has('a'), 'the hovered card is always lit');
});

test('litFor: the combo view lights partners, not stand-ins', () => {
  const on = litFor(litGraph(), ['a'], 'combo');
  assert.ok(on.has('c'));
  assert.ok(!on.has('s'), 'a stand-in lit in the works-together view');
});

test('litFor: both views together light everything the card touches', () => {
  const on = litFor(litGraph(), ['a'], 'all');
  assert.deepStrictEqual([...on].sort(), ['a', 'c', 's']);
});

// Several picked cards light only what they have in common — that is what makes a
// comparison mean "these are the cards you would lose" — and the scoping applies there too.
test('litFor: a comparison narrows to the visible relation as well', () => {
  const graph = {
    links: [
      { source: 'a', target: 'shared', kind: 'combo' },
      { source: 'b', target: 'shared', kind: 'combo' },
      { source: 'a', target: 'swapOnly', kind: 'swap' },
      { source: 'b', target: 'swapOnly', kind: 'swap' },
    ],
  };
  assert.deepStrictEqual([...litFor(graph, ['a', 'b'], 'combo')].sort(), ['a', 'b', 'shared']);
  assert.deepStrictEqual([...litFor(graph, ['a', 'b'], 'swap')].sort(), ['a', 'b', 'swapOnly']);
  // The picked cards themselves stay lit even when they share nothing in this view.
  assert.deepStrictEqual([...litFor({ links: [] }, ['a', 'b'], 'combo')].sort(), ['a', 'b']);
});

test('litFor: nothing picked, nothing lit', () => {
  assert.strictEqual(litFor(litGraph(), [], 'all').size, 0);
  assert.strictEqual(litFor(litGraph(), null, 'all').size, 0);
  assert.strictEqual(litFor({}, ['a'], 'all').size, 1);
});
