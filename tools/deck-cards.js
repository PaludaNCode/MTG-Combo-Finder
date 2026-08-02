#!/usr/bin/env node
// Which cards in a deck carry its combos — and which of those nobody has swept.
//
// "The most used cards" has three possible meanings and they disagree, so this
// picks one and says so rather than leaving it to be guessed:
//
//   combos    how many published combos name the card. This is the one that
//             matters for research: a card in 440 combos has 440 chances to be
//             missing from one, and a card in 3 has three.
//   played    those combos' popularity added up — how much of the world actually
//             registers them. A card can be in many combos nobody plays.
//   swept     whether any pass in research-log.js has covered it. This is the
//             column that turns the list into a queue.
//
// Ranked on `combos`, because that is what the substitution method consumes.
// `played` is printed beside it because the two come apart often enough to matter,
// and a card high on one and low on the other is a judgement call rather than an
// oversight.
//
//   node tools/deck-cards.js [deck.txt] [--unswept] [--top N] [combos.json]
//
// --unswept drops everything research-log.js already covers, which is the form
// you want when picking the next deep dive.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const DeckParser = require('../parser.js');
const DeckCombos = require('../combos.js');
const { sweptCards } = require('../research-log.js');

const COMBOS_URL = 'https://raw.githubusercontent.com/PaludaNCode/MTG-Combo-Finder/data/combos.json';
const UA = 'MTG-Combo-Finder (github.com/PaludaNCode/MTG-Combo-Finder; deck card ranking)';
const DEFAULT_DECK = path.join(__dirname, '..', 'test', 'fixtures', 'chatterfang-deck.txt');

const say = (line = '') => console.log(line);

async function load(local) {
  if (local) return DeckCombos.decode(JSON.parse(fs.readFileSync(local, 'utf8')));
  const res = await fetch(COMBOS_URL, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error('the data branch answered HTTP ' + res.status);
  return DeckCombos.decode(await res.json());
}

async function main() {
  const args = process.argv.slice(2);
  const unsweptOnly = args.includes('--unswept');
  const topAt = args.indexOf('--top');
  const top = topAt === -1 ? 25 : Number(args[topAt + 1]) || 25;
  const files = args.filter((a, i) => !a.startsWith('--') && !(topAt !== -1 && i === topAt + 1));
  const deckFile = files[0] || DEFAULT_DECK;
  const local = files[1];

  const data = await load(local);
  const parsed = DeckParser.parseDecklist(fs.readFileSync(deckFile, 'utf8'));
  const entries = (parsed.commanders || []).concat(parsed.main || []);
  const deck = DeckCombos.deckNameSet(entries);

  // One pass over the database: for each deck card, the combos naming it.
  const stats = new Map();
  for (const combo of (data.combos || [])) {
    for (const name of (combo.c || [])) {
      const key = DeckCombos.nameKey(name);
      if (!deck.has(key)) continue;
      if (!stats.has(key)) stats.set(key, { name, combos: 0, played: 0 });
      const s = stats.get(key);
      s.combos += 1;
      s.played += Number(combo.pop || 0);
    }
  }

  const swept = sweptCards();
  const rows = [...stats.values()]
    .map((s) => ({ ...s, swept: swept.has(DeckCombos.nameKey(s.name)) }))
    .filter((s) => (unsweptOnly ? !s.swept : true))
    .sort((a, b) => b.combos - a.combos || b.played - a.played);

  say(`# The cards carrying ${path.basename(deckFile)}`);
  say();
  say(`${deck.size} cards in the deck, ${stats.size} of them named in at least one of `
    + `${(data.combos || []).length.toLocaleString()} published combos.`);
  say(`${rows.filter((r) => r.swept).length} of those have been swept; `
    + `${rows.filter((r) => !r.swept).length} have not.`);
  say();
  say('| combos | played | swept | card |');
  say('|---:|---:|:---:|---|');
  for (const r of rows.slice(0, top)) {
    say(`| ${r.combos.toLocaleString()} | ${r.played.toLocaleString()} | `
      + `${r.swept ? '✓' : ''} | ${r.name} |`);
  }
  if (rows.length > top) say(`\n…and ${rows.length - top} more.`);

  // The cards a deck holds that no published combo names at all. Not noise: it is
  // where a gap would look exactly like a card nobody plays, which is the failure
  // unofficial.js exists for.
  const unnamed = [...deck].filter((k) => !stats.has(k));
  if (unnamed.length) {
    say();
    say(`## In the deck, in no published combo (${unnamed.length})`);
    say();
    say('Nothing to substitute against, so the method above cannot propose them. '
      + 'A gap here only ever surfaces by somebody reading the card.');
    say();
    const byKey = new Map(entries.map((e) => [DeckCombos.nameKey(e.card || e.name || e), e.card || e.name || e]));
    say(unnamed.map((k) => byKey.get(k) || k).sort().join(', '));
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
