'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  build, layout, sizeFor, DEFAULT_WIDTH, DEFAULT_HEIGHT,
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
  assert.strictEqual(graph.links[0].weight, 1);
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
  assert.strictEqual(graph.links.length, 3);
});

// The same pair turning up in two combos is one line, drawn heavier — not two
// lines on top of each other, which would look exactly like one.
test('build: a pair sharing two combos is one line of weight two', () => {
  const graph = build([
    combo(['Devoted Druid', 'Vizier of Remedies'], ['Infinite green mana']),
    combo(['Devoted Druid', 'Vizier of Remedies', 'Walking Ballista'], ['Infinite damage']),
  ]);
  assert.strictEqual(edge(graph, 'devoted druid', 'vizier of remedies').weight, 2);
  assert.strictEqual(edge(graph, 'devoted druid', 'walking ballista').weight, 1);
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
  assert.strictEqual(edge(graph, 'rings of brighthearth', 'walking ballista').weight, 1);
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
  assert.strictEqual(graph.links.length, 4);
});

test('build: nothing in, empty graph out', () => {
  assert.deepStrictEqual(build([]), { nodes: [], links: [], omitted: 0 });
  assert.deepStrictEqual(build(), { nodes: [], links: [], omitted: 0 });
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

test('layout: a single card sits in the middle', () => {
  const graph = layout(build([combo(['Rings of Brighthearth'], ['Infinite damage'])]),
    { width: 400, height: 200 });
  assert.deepStrictEqual([graph.nodes[0].x, graph.nodes[0].y], [200, 100]);
});

test('layout: an empty graph is left alone', () => {
  assert.deepStrictEqual(layout(build([])), { nodes: [], links: [], omitted: 0 });
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
  assert.deepStrictEqual(small, { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  assert.ok(mid.width > small.width && mid.height > small.height);
  assert.ok(huge.width <= 900 && huge.height <= 760);
  assert.deepStrictEqual(sizeFor(0), small); // nothing to draw is still a canvas
});

// ---- labels ------------------------------------------------------------------

// The box a placed label occupies, reconstructed the way graph.js reckons it:
// 5.6px a character at 11px, 9px of it above the baseline and 3px below.
const labelBox = (node) => {
  const width = node.label.length * 5.6;
  const x = node.x + node.labelDx;
  const left = node.labelAnchor === 'start' ? x
    : (node.labelAnchor === 'end' ? x - width : x - width / 2);
  return { left, right: left + width, top: node.y + node.labelDy - 9, bottom: node.y + node.labelDy + 3 };
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
  const shown = graph.nodes.filter((n) => n.labelDy != null).map(labelBox);
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
test('layout: with no room the quiet cards lose their labels, not the busy ones', () => {
  const graph = placed(dense(), { width: 400, height: 300 });
  const dropped = graph.nodes.filter((n) => n.labelDy == null);
  assert.ok(dropped.length, 'nothing was dropped on a canvas with no room, so the fallback is untested');
  // The busiest card keeps its name: those are the ones worth reading without
  // being asked for.
  assert.notStrictEqual(graph.nodes[0].labelDy, null, `${graph.nodes[0].name} lost its label`);
  // And every dropped one still carries the text, for the hover to show.
  assert.ok(dropped.every((n) => n.label));
  // Whatever did survive is still placed cleanly.
  const shown = graph.nodes.filter((n) => n.labelDy != null).map(labelBox);
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
