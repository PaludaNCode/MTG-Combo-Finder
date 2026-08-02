#!/usr/bin/env node
// Checks every row in unofficial.js against the published data.
//
// The rows carry their evidence — the Spellbook combo each was derived from, by
// id — and that is the whole basis on which the panel asks to be believed. An id
// nobody ever checks is decoration. Every one of them was looked up by hand while
// the row was written, which is exactly the way a digit gets transposed.
//
// Three things are asserted per row, and each of them is a different failure:
//
//   cited combo exists          a typo in an id, or Spellbook retiring a variant
//   cited cards match it        the id is real but names a different combo, so
//                               the evidence on screen is for something else
//   our own card set is not     the row graduated: Spellbook published it, and
//   published                   the page would be showing a duplicate as ours
//
// The third is not an error. It is the outcome these rows are supposed to reach,
// and matchUnofficial() already drops a graduated row at run time — this reports
// it so the file can be tidied rather than quietly carrying a dead entry.
//
// The stand-in rules are checked too, differently: they read their citations off
// the data as they run and so cannot cite something absent, but a source card
// misspelled by one accent quietly reaches nothing at all. checkStandIns() counts
// what each rule actually reached, and says so out loud.
//
// Run against the live data, which is why this is a tool and not a unit test:
//
//   node tools/verify-unofficial.js               # fetches the published data
//   node tools/verify-unofficial.js combos.json   # or reads a local copy
'use strict';

const fs = require('node:fs');
const { COMBOS, STAND_INS } = require('../unofficial.js');
const { nameKey, decode } = require('../combos.js');

const COMBOS_URL = 'https://raw.githubusercontent.com/PaludaNCode/MTG-Combo-Finder/data/combos.json';

const say = (line = '') => console.log(line);
const key = (names) => names.map(nameKey).sort().join('|');

// The check itself, kept apart from the fetching and the printing so it can be
// tested against a made-up dataset — which is the only way to prove that a
// broken citation is actually *caught*, rather than that today's data happens to
// be fine.
function check(data, rows) {
  const combos = (data && data.combos) || [];
  const byId = new Map(combos.map((c) => [String(c.id), c]));
  const published = new Set(combos.map((c) => key(c.c || [])));
  const problems = [];
  const graduated = [];

  for (const row of rows || []) {
    const at = row.cards.join(' + ');
    const source = byId.get(String(row.from.id));

    if (!source) {
      problems.push(`${at}: cites ${row.from.id}, which is not in the published data`);
    } else if (key(source.c || []) !== key(row.from.cards)) {
      problems.push(`${at}: cites ${row.from.id}, which is `
        + `"${(source.c || []).join(' + ')}" and not "${row.from.cards.join(' + ')}"`);
    }

    if (published.has(key(row.cards))) graduated.push(at);
  }

  return { problems, graduated, counted: combos.length };
}

// The stand-in rules cannot cite a combo that does not exist — they read the ids
// off the data as they go — so there is nothing to check there. What can go wrong
// is quieter and worse: a source card misspelled by one accent produces no rows at
// all, silently, and the page simply shows less than it did. So this counts what
// each rule actually reaches and says which source every row leaned on.
//
// It also watches for the day the rule stops being needed. Hammerhead is here
// because Spellbook has never used him; when that changes, the rows start
// graduating one by one, and the count below is how anybody notices.
function checkStandIns(data, rules) {
  const combos = (data && data.combos) || [];
  const problems = [];
  const summaries = [];

  for (const rule of rules || []) {
    const inKey = nameKey(rule.card);
    const sources = new Map((rule.for || []).map((src, rank) => [nameKey(src.card), { rank, src }]));
    const counts = new Map([...sources.keys()].map((k) => [k, 0]));
    const best = new Map();
    let templated = 0;
    let alreadyPublished = 0;

    for (const combo of combos) {
      const keys = (combo.c || []).map(nameKey);
      if (keys.includes(inKey)) { alreadyPublished += 1; continue; }
      const hits = keys.filter((k) => sources.has(k));
      if (hits.length !== 1) continue;
      counts.set(hits[0], counts.get(hits[0]) + 1);
      const key = keys.filter((k) => k !== hits[0]).concat(inKey).sort().join('|');
      const rank = sources.get(hits[0]).rank;
      const held = best.get(key);
      if (!held || rank < held.rank) best.set(key, { rank, from: hits[0], t: !!(combo.t && combo.t.length) });
      if (combo.t && combo.t.length) templated += 1;
    }

    for (const [key, seen] of counts) {
      if (!seen) problems.push(`${rule.card}: stands in for "${key}", which no published combo names`);
    }

    const cited = new Map();
    let slotted = 0;
    for (const { from, t } of best.values()) {
      cited.set(from, (cited.get(from) || 0) + 1);
      if (t) slotted += 1;
    }
    summaries.push({
      card: rule.card,
      rows: best.size,
      slotted,
      templated,
      alreadyPublished,
      cited: [...sources.keys()].map((k) => ({ card: k, rows: cited.get(k) || 0, combos: counts.get(k) })),
    });
  }

  return { problems, summaries };
}

// The card a row swaps *in* is the one name in the file that nothing else can
// check. `from.cards` is checked against the cited combo, and `cards` is that list
// with the swaps applied — so both are anchored to real data. The swapped-in card
// is anchored to nothing, and a name misspelled there produces a row that is shown
// to a reader, matches no deck ever, and says nothing about it.
//
// So every swap records the card's Spellbook id beside the name, and this reads
// the two against each other. Both directions are a finding:
//
//   inId: <number>   the id must exist and must still carry that name. If Spellbook
//                    renames the card, the id resolves to the new one and says so,
//                    where the name alone would just quietly stop being a card.
//   inId: null       a claim that the published data has no such card. Hammerhead
//                    makes it — being in no combo at all is the entire reason he
//                    needs a stand-in rule — and the day it stops being true is the
//                    day the rule can go.
function checkCardIds(cards, rows, rules) {
  if (!cards) return [];
  const problems = [];
  const look = (where, name, id) => {
    const known = cards.byKey.get(nameKey(name));
    if (id === null || id === undefined) {
      if (known) {
        problems.push(`${where}: records no card id for ${name}, but the published data `
          + `now names it (id ${known.id}) — the citation can be direct.`);
      }
      return;
    }
    const current = cards.byId.get(String(id));
    if (current === undefined) {
      problems.push(`${where}: ${name} is recorded as card id ${id}, which the published data does not have`);
    } else if (nameKey(current) !== nameKey(name)) {
      problems.push(`${where}: ${name} is recorded as card id ${id}, which is now "${current}"`);
    }
  };

  for (const row of rows || []) {
    const at = row.cards.join(' + ');
    for (const step of (row.swaps || [row.swap])) {
      if (!step) continue;
      look(at, step.in, step.inId);
    }
  }
  for (const rule of rules || []) {
    look(`stand-in ${rule.card}`, rule.card, rule.cardId);
    for (const src of (rule.for || [])) look(`stand-in ${rule.card}`, src.card, src.cardId);
  }
  return problems;
}

// The name/id tables are read off the payload *before* decode(), which deletes
// them once it has resolved the combos — so this has to happen on the way in.
function cardIndex(raw) {
  if (!raw || !Array.isArray(raw.names) || !Array.isArray(raw.cardIds)) return null;
  const byKey = new Map(), byId = new Map();
  raw.names.forEach((name, i) => {
    const id = raw.cardIds[i];
    byKey.set(nameKey(name), { name, id });
    if (typeof id === 'number') byId.set(String(id), name);
  });
  return { byKey, byId };
}

// decode() turns the payload's interned card names and result strings back into
// strings; it is a no-op on a payload that has no tables, so a local copy in
// either shape reads the same.
async function load(path) {
  const raw = path
    ? JSON.parse(fs.readFileSync(path, 'utf8'))
    : await (async () => {
      const res = await fetch(COMBOS_URL);
      if (!res.ok) throw new Error('the data branch answered HTTP ' + res.status);
      return res.json();
    })();
  const cards = cardIndex(raw);
  return { data: decode(raw), cards };
}

async function main() {
  const { data, cards } = await load(process.argv[2]);
  const { problems, graduated, counted } = check(data, COMBOS);
  const rules = checkStandIns(data, STAND_INS);
  problems.push(...checkCardIds(cards, COMBOS, STAND_INS));

  say('# Unofficial rows against the published data');
  say();
  say(`Checked ${COMBOS.length} rows against ${counted.toLocaleString()} combos, `
    + `snapshot ${data.updatedAt || 'unknown'}.`);
  say();

  for (const s of rules.summaries) {
    say(`## ${s.card} stands in for ${s.cited.length} card(s)`);
    say();
    say(`Reaches **${s.rows.toLocaleString()} combos**, from:`);
    say();
    s.cited.forEach((c) => say(`- ${c.card}: ${c.combos.toLocaleString()} published combos, `
      + `${c.rows.toLocaleString()} rows cited to it`));
    say();
    if (s.slotted) {
      say(`${s.slotted.toLocaleString()} of those have a template slot — "any Persist `
        + 'Creature" — and reach a deck only once that deck fills it, exactly as a '
        + 'published combo with a slot does.');
      say();
    }
    if (s.alreadyPublished) {
      say(`Spellbook now names ${s.card} in ${s.alreadyPublished.toLocaleString()} combos of `
        + 'its own — the rule may be on its way to being unnecessary.');
      say();
    }
  }

  problems.push(...rules.problems);

  if (graduated.length) {
    say('## Graduated — Spellbook now publishes these');
    say();
    say('Not an error: the page already drops them. They can come out of the file.');
    say();
    graduated.forEach((at) => say(`- ${at}`));
    say();
  }

  if (problems.length) {
    say('## Broken evidence');
    say();
    problems.forEach((p) => say(`- ${p}`));
    say();
    say(`**${problems.length} problem(s) found.**`);
    process.exitCode = 1;
    return;
  }

  say('Every row cites a combo that exists and names the cards it says it does, and every '
    + 'card swapped in still answers to the id recorded beside it.');
}

module.exports = { check, checkStandIns, checkCardIds, cardIndex };

// Only when run, so requiring it for the tests does not go to the network.
if (require.main === module) {
  main().catch((err) => {
    console.error('verify-unofficial failed:', err.message);
    process.exitCode = 1;
  });
}
