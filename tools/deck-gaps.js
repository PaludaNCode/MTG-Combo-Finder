#!/usr/bin/env node
// Which gaps does *this deck* expose? The third question, and the one nothing
// answered until now.
//
// The other two are already covered and are genuinely different:
//
//   which rows can this deck assemble?     matchUnofficial(), on the page
//   which of its cards are worth sweeping? tools/deck-cards.js --unswept
//   which gaps does the deck expose?       here
//
// `deck-cards.js` picks *subjects* from a deck and then sweeps each one across the
// whole database, so most of what it proposes needs cards the deck has never heard
// of. This bounds the candidate *shapes* as well: a shape only counts if the deck
// already holds every card in it. What comes back is not "a combo that might exist"
// but "a combo you could cast tonight, that Spellbook has not published".
//
// That is how the lifegain pass found 51 candidates nobody had gone looking for —
// it is the same query, run by hand, on one deck.
//
//   node tools/deck-gaps.js [deck.txt] [--jaccard N] [combos.json]
//
// Every hit still has to be read against the cards before it becomes a row. This
// proposes; research-log.js records what reading it decided.
//
// Card sets a pass has already thrown out are dropped, from `sets` on the rule-outs
// in research-log.js — the two files used to have no way to talk, so this re-offered
// "Scurry Oak + Sadistic Glee" every run, a pair the first sweep killed because the
// Squirrel has no sacrifice ability where Basking Broodscale's Eldrazi Spawn does.
//
// **That index is partial, and what survives it has not been cleared.** Most
// rule-outs in the log are categorical — "the loop needs a *token* out of the
// sacrifice" — and cover shapes nobody enumerated, so they have no card set to
// record. A dropped row means somebody decided; a row that is still here means
// nothing at all. The drops are printed rather than silently removed, for the same
// reason: a filter that quietly shrinks a list is indistinguishable from a shorter
// list. Read the log before the table either way.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const DeckParser = require('../parser.js');
const DeckCombos = require('../combos.js');
const { COMBOS, STAND_INS } = require('../unofficial.js');
const { ruledOutSets } = require('../research-log.js');

const COMBOS_URL = 'https://raw.githubusercontent.com/PaludaNCode/MTG-Combo-Finder/data/combos.json';
const UA = 'MTG-Combo-Finder (github.com/PaludaNCode/MTG-Combo-Finder; deck-scoped gaps)';
const DEFAULT_DECK = path.join(__dirname, '..', 'test', 'fixtures', 'chatterfang-deck.txt');

const say = (line = '') => console.log(line);
const keyOf = (names) => names.map(DeckCombos.nameKey).sort().join('|');

async function load(local) {
  if (local) return DeckCombos.decode(JSON.parse(fs.readFileSync(local, 'utf8')));
  const res = await fetch(COMBOS_URL, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error('the data branch answered HTTP ' + res.status);
  return DeckCombos.decode(await res.json());
}

// The shape of a combo with one card removed — what two interchangeable cards have
// in common. Template slots are part of it: a combo needing a slot is not the same
// shape as one that does not.
const shapeKey = (combo, without) => combo.c.filter((n) => n !== without).sort().join('|')
  + (combo.t && combo.t.length ? '|t' + combo.t.slice().sort().join(',') : '');

// The rule-outs a pass wrote down as cards rather than as a sentence, keyed the way
// every other card set here is. Injectable so a test can drive the filter without
// depending on which decisions the live log happens to hold today.
function ruledOutIndex(entries) {
  const out = new Map();
  for (const entry of entries || []) out.set(keyOf(entry.cards), entry);
  return out;
}

// A row the page will draw for this deck, whether somebody wrote it out by hand or a
// stand-in rule produced it. Both halves have to be here: checking only COMBOS is what
// let this tool offer six shapes as unwritten while the browser was rendering them, on a
// deck holding Elas il-Kor, Sadistic Pilgrim — the rule reaches 121 combos and the tool
// could see none of them. That is the worst kind of wrong answer this file can give,
// because it reads as work to do rather than as work already done, and the six were
// carried through a whole reading pass before anyone asked the page.
//
// `allowMissing` is 0 and the rows are filtered to what the deck actually holds, because
// a gap is a combo you can cast tonight; a stand-in row the deck is one card short of is
// a suggestion, and suggestions are not this tool's question.
function drawnFor(data, deck) {
  const rows = DeckCombos.standInRows(data, STAND_INS, deck, undefined, 0);
  return rows.filter((r) => (r.cards || []).every((n) => deck.has(DeckCombos.nameKey(n))));
}

// Returns { gaps, ruledOut } rather than the bare list it used to: what the filter
// removed is part of the answer, not a side effect. A candidate list that silently
// got shorter is a candidate list nobody can audit.
function findGaps(data, deck, minJaccard, ruledOut) {
  const combos = data.combos || [];
  const published = new Set(combos.map((c) => keyOf(c.c)));
  const written = new Set(
    COMBOS.concat(drawnFor(data, deck)).map((r) => keyOf(r.cards))
  );
  const settled = ruledOutIndex(ruledOut === undefined ? ruledOutSets() : ruledOut);
  const dropped = [];

  // Only cards the deck actually holds can be subjects, and only they can fill a shape.
  const inDeck = (name) => deck.has(DeckCombos.nameKey(name));

  const byCard = new Map();
  for (const combo of combos) {
    for (const name of combo.c) {
      if (!byCard.has(name)) byCard.set(name, []);
      byCard.get(name).push(combo);
    }
  }
  const shapesOf = (card) => new Map((byCard.get(card) || []).map((c) => [shapeKey(c, card), c]));

  const out = [];
  for (const [subject, mine] of byCard) {
    if (!inDeck(subject)) continue;
    const subjectShapes = shapesOf(subject);
    const subjectSets = mine.map((c) => new Set(c.c));
    // Peers: cards sitting in the subject's own shapes somewhere else in the data.
    const shared = new Map();
    for (const combo of combos) {
      for (const name of combo.c) {
        if (name === subject) continue;
        const k = shapeKey(combo, name);
        if (subjectShapes.has(k)) shared.set(name, (shared.get(name) || 0) + 1);
      }
    }
    for (const [peer, n] of shared) {
      const peerShapes = shapesOf(peer);
      const jaccard = n / (subjectShapes.size + peerShapes.size - n);
      if (jaccard < minJaccard) continue;
      for (const [k, combo] of peerShapes) {
        if (subjectShapes.has(k)) continue;
        if (combo.t && combo.t.length) continue;          // a slot is not a card the deck can hold
        const rest = combo.c.filter((c) => c !== peer);
        if (rest.includes(subject)) continue;             // both already in this combo
        // THE BOUND: every other card has to be in the deck too.
        if (!rest.every(inDeck)) continue;
        const cand = [...rest, subject];
        if (published.has(keyOf(cand)) || written.has(keyOf(cand))) continue;
        // Subsumed: the subject already has a combo inside this card set.
        const full = new Set(cand.map(DeckCombos.nameKey));
        if (subjectSets.some((s) => [...s].every((c) => full.has(DeckCombos.nameKey(c))))) continue;
        out.push({ subject, peer, rest, jaccard, id: combo.id, pop: combo.pop || 0 });
      }
    }
  }
  // One row per candidate card set, keeping the best-evidenced peer.
  const best = new Map();
  for (const row of out.sort((a, b) => b.jaccard - a.jaccard || b.pop - a.pop)) {
    const k = keyOf([...row.rest, row.subject]);
    if (!best.has(k)) best.set(k, row);
  }
  // Deduplicated first, so a set already thrown out is reported once rather than
  // once per peer that proposed it.
  const gaps = [];
  for (const row of best.values()) {
    const settledAs = settled.get(keyOf([...row.rest, row.subject]));
    if (settledAs) dropped.push(Object.assign({}, row, { settledAs }));
    else gaps.push(row);
  }
  return {
    gaps: gaps.sort((a, b) => b.pop - a.pop),
    ruledOut: dropped.sort((a, b) => b.pop - a.pop),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const jAt = args.indexOf('--jaccard');
  const minJaccard = jAt === -1 ? 0.3 : Number(args[jAt + 1]) || 0.3;
  const files = args.filter((a, i) => !a.startsWith('--') && !(jAt !== -1 && i === jAt + 1));
  const deckFile = files[0] || DEFAULT_DECK;

  const data = await load(files[1]);
  const parsed = DeckParser.parseDecklist(fs.readFileSync(deckFile, 'utf8'));
  const deck = DeckCombos.deckNameSet((parsed.commanders || []).concat(parsed.main || []));
  const { gaps, ruledOut: settled } = findGaps(data, deck, minJaccard);

  say(`# Gaps ${path.basename(deckFile)} exposes`);
  say();
  say(`${deck.size} cards, against ${(data.combos || []).length.toLocaleString()} published `
    + `combos. Peers at jaccard >= ${minJaccard}.`);
  say();
  say('Every card in every shape below is already in the deck — these are combos it '
    + 'could cast tonight and Spellbook has not published.');
  say();
  if (!gaps.length) { say('**None.** Which is a real answer, and the common one.'); return; }
  say('| pop | candidate | swapped for | published as |');
  say('|---:|---|---|---|');
  for (const g of gaps.slice(0, 40)) {
    say(`| ${g.pop} | ${[g.subject, ...g.rest].join(' + ')} | ${g.peer} | `
      + `[${g.id}](https://commanderspellbook.com/combo/${g.id}/) |`);
  }
  if (gaps.length > 40) say(`\n…and ${gaps.length - 40} more.`);
  say();
  say(`**${gaps.length} candidate(s). None of them is a row yet** — each still has to be read `
    + 'against the cards, and research-log.js is where that reading gets recorded.');

  // Said out loud, always. A filter nobody can see is a filter nobody can check,
  // and the point of the index is that a settled decision stops costing a reading.
  say();
  if (!settled.length) {
    say('No candidate matched a rule-out recorded as cards in `research-log.js`. That is not '
      + 'the same as none of them having been ruled out — most rule-outs there are '
      + 'categorical and have no card set to match against.');
    return;
  }
  say(`**${settled.length} more were proposed and dropped**, each matching a rule-out that `
    + 'names its exact cards in `research-log.js`:');
  say();
  for (const row of settled) {
    say(`- ${[row.subject, ...row.rest].join(' + ')} — ruled out by *${row.settledAs.subject}*: `
      + row.settledAs.reason);
  }
  say();
  say('That index is partial by construction, so the table above is "not settled in a form a '
    + 'tool can read", not "still open". Read the log.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = { findGaps, shapeKey, ruledOutIndex, drawnFor };
