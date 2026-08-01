#!/usr/bin/env node
// Checks every row in unofficial.js against the published data.
//
// The rows carry their evidence — the Spellbook combo each was derived from, by
// id — and that is the whole basis on which the panel asks to be believed. An id
// nobody ever checks is decoration. Four of the thirteen were looked up by hand
// while writing them, which is exactly the way a digit gets transposed.
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
// Run against the live data, which is why this is a tool and not a unit test:
//
//   node tools/verify-unofficial.js               # fetches the published data
//   node tools/verify-unofficial.js combos.json   # or reads a local copy
'use strict';

const fs = require('node:fs');
const { COMBOS } = require('../unofficial.js');
const { nameKey } = require('../combos.js');

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

async function load(path) {
  if (path) return JSON.parse(fs.readFileSync(path, 'utf8'));
  const res = await fetch(COMBOS_URL);
  if (!res.ok) throw new Error('the data branch answered HTTP ' + res.status);
  return res.json();
}

async function main() {
  const data = await load(process.argv[2]);
  const { problems, graduated, counted } = check(data, COMBOS);

  say('# Unofficial rows against the published data');
  say();
  say(`Checked ${COMBOS.length} rows against ${counted.toLocaleString()} combos, `
    + `snapshot ${data.updatedAt || 'unknown'}.`);
  say();

  if (graduated.length) {
    say('## Graduated — Spellbook now publishes these');
    say();
    say('Not an error: the page already drops them. They can come out of the file.');
    say();
    graduated.forEach((at) => say(`- ${at}`));
    say();
  }

  if (problems.length) {
    say('## Broken citations');
    say();
    problems.forEach((p) => say(`- ${p}`));
    say();
    say(`**${problems.length} of ${COMBOS.length} rows cite something that is not there.**`);
    process.exitCode = 1;
    return;
  }

  say('Every row cites a combo that exists and names the cards it says it does.');
}

module.exports = { check };

// Only when run, so requiring it for the tests does not go to the network.
if (require.main === module) {
  main().catch((err) => {
    console.error('verify-unofficial failed:', err.message);
    process.exitCode = 1;
  });
}
