#!/usr/bin/env node
// What each proposed filter chip would do to a deck's results — how many combos survive
// it, and how many *rows* of "Combos in your deck" survive with them.
//
// Those two are not the same number and the gap is the reason this tool exists. The panel
// is a row per card, not per combo, so a filter can take out a quarter of the combos and
// leave every row standing: on the Chatterfang fixture "wins only" goes 233 → 182 combos
// and 40 → 40 rows, because every card that carries a combo carries at least one win. A
// chip whose whole visible effect is that some numbers got smaller is a different design
// problem to one that empties the panel, and you cannot tell which you have without
// measuring both.
//
//   node tools/deck-filters.js [deck.txt] [--json out.json] [combos.json]
//
// --json writes the per-combo metadata the prototype in prototypes/filter-bar.html
// filters live, so the drawing and this table can never disagree about the deck.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const DeckParser = require('../parser.js');
const DeckCombos = require('../combos.js');
const ResultTiers = require('../result-tiers.js');

const COMBOS_URL = 'https://raw.githubusercontent.com/PaludaNCode/MTG-Combo-Finder/data/combos.json';
const UA = 'MTG-Combo-Finder (github.com/PaludaNCode/MTG-Combo-Finder; filter counts)';
const DEFAULT_DECK = path.join(__dirname, '..', 'test', 'fixtures', 'chatterfang-deck.txt');

const say = (line = '') => console.log(line);

// The chips, in the order they would appear. Each is a predicate over the rows built
// below, so adding one is a line here rather than a change to the counting.
//
// `2-card` and not `<= 3 cards`: 169 of the Chatterfang deck's 233 are three-card combos,
// so a three-card chip keeps 178 of 233 and answers nothing. The sharp question a reader
// has is "what can I do with two cards".
const CHIPS = [
  { id: 'commander', label: 'Uses my commander', match: (c) => c.commander },
  { id: 'win', label: 'Wins only', match: (c) => c.tier === 'win' },
  { id: 'two', label: '2-card', match: (c) => c.size <= 2 },
];

// How many combos and how many panel rows survive a set of chips — the pair, always,
// because reporting either alone is what hides the case above.
//
// Exported and pure for the same reason sweepStatus() in deck-cards.js is: it is the
// decision, the CLI only prints it, and `node --test` cannot reach a CLI. `rows` is one
// entry per deck card carrying at least one surviving combo, ranked as the panel ranks
// them — most combos first, then by name so the order is stable rather than incidental.
function filterCounts(combos, active) {
  const on = CHIPS.filter((chip) => (active || []).includes(chip.id));
  const kept = (combos || []).filter((c) => on.every((chip) => chip.match(c)));

  const byCard = new Map();
  for (const combo of kept) {
    for (const card of combo.deckCards || []) {
      byCard.set(card, (byCard.get(card) || 0) + 1);
    }
  }
  const rows = [...byCard.entries()]
    .map(([card, count]) => ({ card, combos: count }))
    .sort((a, b) => b.combos - a.combos || a.card.localeCompare(b.card));

  return { combos: kept.length, rows: rows.length, cards: rows };
}

// The one card-level fact the chips are built on that the payload does not state: which
// result tier a combo is in. Same rule try-deck.js uses — the loudest result the combo
// produces, since a combo that wins and also draws cards is a win.
const RANK = { win: 0, decisive: 1, other: 2 };

function bestTier(variant) {
  let best = null;
  for (const produced of variant.produces || []) {
    const name = (produced.feature && produced.feature.name) || produced.name;
    if (!name) continue;
    const { tier } = ResultTiers.tierOf(name);
    if (!best || RANK[tier] < RANK[best]) best = tier;
  }
  return best || 'other';
}

async function load(local) {
  if (local) return DeckCombos.decode(JSON.parse(fs.readFileSync(local, 'utf8')));
  const res = await fetch(COMBOS_URL, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error('the data branch answered HTTP ' + res.status);
  return DeckCombos.decode(await res.json());
}

async function main() {
  const args = process.argv.slice(2);
  const jsonAt = args.indexOf('--json');
  const jsonOut = jsonAt === -1 ? null : args[jsonAt + 1];
  const files = args.filter((a, i) => !a.startsWith('--') && !(jsonAt !== -1 && i === jsonAt + 1));
  const deckFile = files[0] || DEFAULT_DECK;

  const data = await load(files[1]);
  const parsed = DeckParser.parseDecklist(fs.readFileSync(deckFile, 'utf8'));
  const entries = (parsed.commanders || []).concat(parsed.main || []);
  const deck = DeckCombos.deckNameSet(entries);
  const commanders = new Set((parsed.commanders || []).map((e) => DeckCombos.nameKey(e.card)));
  const matched = DeckCombos.matchDeck(data, deck, entries);

  const combos = matched.included.map((combo) => {
    const cards = DeckCombos.variantCardNames(combo);
    const variant = DeckCombos.expand(combo, data);
    return {
      cards,
      // Only the cards the deck actually holds get a row in the panel — a template slot
      // is filled by a card that is already in this list, and nothing else can be here.
      deckCards: cards.filter((n) => deck.has(DeckCombos.nameKey(n))),
      size: cards.length,
      tier: bestTier(variant),
      commander: cards.some((n) => commanders.has(DeckCombos.nameKey(n))),
      result: ((variant.produces || [])[0] || {}).name
        || (((variant.produces || [])[0] || {}).feature || {}).name
        || 'Unstated',
    };
  });

  const base = filterCounts(combos, []);
  say(`# ${path.basename(deckFile)}`);
  say();
  say(`${entries.length} entries · ${base.combos} combos · ${base.rows} rows in "Combos in your deck"`);
  // Said out loud rather than left to be noticed: with no commander declared the chip
  // this tool was written for reads 0, and 0 is also what a deck whose commander is in
  // no combo reads. Neither fixture deck declares one — see CLAUDE.md, "The two fixture
  // decks" — so the silent case is the one an author meets first.
  say(commanders.size
    ? `Commander: ${[...(parsed.commanders || [])].map((e) => e.card).join(' · ')}`
    : 'No commander declared — the "Uses my commander" chip would be absent, not empty.');
  say();
  say('| chip | combos | of | rows | of | top row |');
  say('|---|---:|---:|---:|---:|---|');
  for (const chip of CHIPS) {
    const r = filterCounts(combos, [chip.id]);
    const top = r.cards[0];
    say(`| ${chip.label} | ${r.combos} | ${base.combos} | ${r.rows} | ${base.rows} | ${top ? `${top.card} (${top.combos}) ` : '—'}|`);
  }

  // The pair that shows what a second chip is for: alone they keep 11 and 9, together 1.
  const both = filterCounts(combos, ['commander', 'two']);
  say();
  say(`Uses my commander + 2-card together: ${both.combos} combo${both.combos === 1 ? '' : 's'}, ${both.rows} rows.`);

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({
      deck: path.basename(deckFile),
      commander: [...(parsed.commanders || [])].map((e) => e.card),
      totals: { combos: base.combos, rows: base.rows },
      combos,
    }));
    say(`\nWrote ${jsonOut} (${fs.statSync(jsonOut).size} bytes).`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = { filterCounts, bestTier, CHIPS };
