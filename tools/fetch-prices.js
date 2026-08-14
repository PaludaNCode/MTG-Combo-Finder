#!/usr/bin/env node
// What each card in the combo database costs, as a file the page can fetch.
//
//   node tools/fetch-prices.js combos.json prices.json
//   node tools/fetch-prices.js combos.json prices.json --fixture test/fixtures/bulk-prices.jsonl
//
// **Only the cards a combo names**, which is what makes the file small enough to be worth
// having: 7,371 of the 34,422 cards the text cache holds appear in at least one published
// combo, and nothing else can ever be offered as a suggestion — a suggestion *is* the card
// a combo is missing. Measured 14 Aug 2026 against the live snapshot; the number is printed
// on every run rather than trusted from this comment.
//
// **The cheapest printing, not the representative one.** This reads `default_cards`, which
// is one object per printing, and takes the minimum. `oracle_cards` — the file the text
// cache reads — is one object per distinct card and carries the prices of whichever
// printing Scryfall chose, so a card with a $40 first printing and a $2 reprint could be
// published here at $40. That is not a rounding difference, it is the wrong answer to the
// question a reader is asking.
//
// **Non-foil USD only.** A card whose only printing is foil gets no price rather than its
// foil price, because a foil figure beside a non-foil one is not a comparison. Those cards
// are counted and reported: the page's rule is that an absent price sorts last and is never
// read as free, so being absent is safe, and being silently wrong is not.
//
// This cannot run in the sandbox this repository is usually edited in — every Scryfall host
// is 403 at CONNECT (CLAUDE.md, "Network, and this sandbox"). `--fixture` is how the whole
// path is exercised without one; the live run is the nightly data job.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const DeckCombos = require('../combos.js');
const { streamCards, isWanted } = require('./scryfall-bulk.js');

// A short file means a truncated download or a moved field, and either way publishing it
// would throw away a working one — the data branch is a single force-pushed orphan commit
// with nothing to roll back to. Same guard, and the same reasoning, as SWEEP_FLOOR in
// tools/card-text.js: "it worked, 40 cards" reads exactly like "it worked".
//
// Two thirds of the cards a combo names is far below anything a healthy run produces (the
// live figure is printed on every run) and far above what a broken one does.
const PRICED_FLOOR = 0.66;

const say = (line = '') => console.log(line);

// The keys the file is written under: DeckCombos.nameKey, which is what every lookup on the
// page already uses — the deck's own spelling of a card is not normalised, and a suggestion
// row asks for its price by the name the combo gave it. Storing display names instead would
// mean the page normalising on every lookup against a table that had not been.
function comboCardKeys(dataset) {
  const keys = new Map();
  for (const combo of dataset.combos || []) {
    for (const name of combo.c || []) {
      const key = DeckCombos.nameKey(name);
      if (key && !keys.has(key)) keys.set(key, name);
    }
  }
  return keys;
}

// The cheapest non-foil USD price seen for each wanted key, and the two counts that say
// whether the answer is trustworthy.
//
// Exported and pure because the whole decision is here — which price, which printing, which
// cards — and a CLI is not somewhere `node --test` can reach. `cards` is an iterable of
// Scryfall card objects, so the test feeds it an array and the live run feeds it a stream.
function cheapest(cards, wanted) {
  const usd = new Map();
  let printings = 0;
  let skipped = 0;
  for (const card of cards) {
    if (!isWanted(card)) { skipped += 1; continue; }
    printings += 1;
    const key = DeckCombos.nameKey(card.name);
    if (!wanted.has(key)) continue;
    // `prices.usd` is a decimal string or null. Number('') is 0, which would publish a
    // free Mox Diamond, so an empty string has to fail this rather than parse.
    const raw = card.prices && card.prices.usd;
    if (raw === null || raw === undefined || raw === '') continue;
    const price = Number(raw);
    if (!Number.isFinite(price) || price <= 0) continue;
    const held = usd.get(key);
    if (held === undefined || price < held) usd.set(key, price);
  }
  return { usd, printings, skipped };
}

// Two decimals, as a number rather than a string: JSON.stringify(1.5) is "1.5" and the page
// formats for display anyway, so storing "1.50" would be five bytes a card for nothing.
const round = (n) => Math.round(n * 100) / 100;

function publish(keys, found, meta) {
  const usd = {};
  // Sorted, so a nightly diff of this file is readable and two runs over the same data
  // produce byte-identical output — the property that makes "nothing changed" visible.
  for (const key of [...found.usd.keys()].sort()) usd[key] = round(found.usd.get(key));
  return {
    generated: new Date().toISOString().slice(0, 10),
    source: meta && meta.type ? meta.type : 'default_cards',
    // Which Scryfall build this is, because a price is a fact about a day. The page prints
    // it beside the figures.
    updatedAt: (meta && meta.updatedAt) || null,
    currency: 'usd',
    // What the page needs to be honest about coverage: how many cards a combo names, and
    // how many of those it has a price for. A reader whose card is in the 4% gets "no
    // price" rather than a number.
    named: keys.size,
    count: Object.keys(usd).length,
    usd,
  };
}

async function* fromFixture(file) {
  const stream = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of stream) {
    const text = line.trim();
    if (text) yield { card: JSON.parse(text), meta: { type: 'fixture', updatedAt: null } };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf('--fixture');
  const fixture = at === -1 ? null : args[at + 1];
  const files = args.filter((a, i) => !a.startsWith('--') && !(at !== -1 && i === at + 1));
  const combosFile = files[0] || 'combos.json';
  const out = files[1] || 'prices.json';

  const dataset = DeckCombos.decode(JSON.parse(fs.readFileSync(combosFile, 'utf8')));
  const keys = comboCardKeys(dataset);
  say(`${dataset.combos.length} combos name ${keys.size} distinct cards.`);

  // Collected rather than streamed into cheapest() so that function stays pure and
  // testable. One number per printing is ~40 bytes of Map; the alternative is a generator
  // holding the decision, which is the shape this repository keeps getting bitten by.
  const meta = { type: null, updatedAt: null };
  const cards = [];
  const source = fixture ? fromFixture(fixture) : streamCards({ bulk: 'default_cards' });
  for await (const { card, meta: m } of source) {
    if (!meta.type && m) { meta.type = m.type; meta.updatedAt = m.updatedAt; }
    cards.push(card);
  }

  const found = cheapest(cards, keys);
  const payload = publish(keys, found, meta);
  const share = keys.size ? payload.count / keys.size : 0;

  say(`${found.printings} printings read (${found.skipped} skipped as tokens or non-English).`);
  say(`${payload.count} of ${keys.size} named cards have a non-foil USD price `
    + `(${Math.round(share * 100)}%).`);
  const missing = [...keys.entries()].filter(([key]) => !found.usd.has(key)).map(([, name]) => name);
  if (missing.length) {
    say(`No price for ${missing.length}: ${missing.slice(0, 12).join(', ')}`
      + (missing.length > 12 ? `, …and ${missing.length - 12} more.` : ''));
  }

  // Refuse rather than publish. A file that covers a third of the cards is not a smaller
  // answer, it is a broken one, and it would replace a working file irrecoverably.
  if (share < PRICED_FLOOR) {
    throw new Error(`only ${payload.count} of ${keys.size} named cards were priced `
      + `(${Math.round(share * 100)}%, floor ${Math.round(PRICED_FLOOR * 100)}%) — `
      + 'refusing to publish. A moved field or a truncated download looks exactly like this.');
  }

  fs.writeFileSync(out, JSON.stringify(payload));
  say(`\nWrote ${path.basename(out)}: ${(fs.statSync(out).size / 1024).toFixed(0)} KB, `
    + `Scryfall build ${payload.updatedAt || 'unknown'}.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
  });
}

module.exports = { cheapest, publish, comboCardKeys, round, PRICED_FLOOR };
