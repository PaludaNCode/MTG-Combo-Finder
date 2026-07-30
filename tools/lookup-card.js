#!/usr/bin/env node
// Print a card's oracle text, straight from Scryfall.
//
// Exists because settling "do these two cards actually do the same thing?"
// otherwise turns into inference from the shape of the combo data — which was
// wrong at least once. A card's own text is the primary source, and a runner
// with open network can just read it.
//
//   node tools/lookup-card.js "Carrion Feeder" "Viscera Seer"
//
// Also runs from Actions with a comma-separated `cards` input, so future
// questions of this kind need no code change.
'use strict';

const UA = 'MTG-Combo-Finder/1.0 (+https://github.com/PaludaNCode/MTG-Combo-Finder; card text lookup)';
const NAMED = 'https://api.scryfall.com/cards/named?exact=';

const out = [];
const say = (line = '') => { out.push(line); console.log(line); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function faces(card) {
  return Array.isArray(card.card_faces) && card.card_faces.length ? card.card_faces : [card];
}

async function lookup(name) {
  const res = await fetch(NAMED + encodeURIComponent(name), {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) {
    say(`### ${name}`);
    say(`Scryfall returned HTTP ${res.status} — check the spelling.`);
    say();
    return;
  }
  const card = await res.json();

  say(`### ${card.name}`);
  say();
  say(`- mana cost: \`${card.mana_cost || faces(card).map((f) => f.mana_cost).filter(Boolean).join(' // ') || '—'}\``);
  say(`- colour identity: \`${(card.color_identity || []).join('') || 'colourless'}\``);
  say(`- commander legal: ${card.legalities && card.legalities.commander === 'legal' ? 'yes' : 'no'}`);
  say();
  for (const face of faces(card)) {
    say(`**${face.type_line || '(no type line)'}**`);
    say();
    say('```');
    say((face.oracle_text || '(no rules text)').trim());
    say('```');
    if (face.power || face.toughness) say(`_${face.power}/${face.toughness}_`);
    say();
  }
}

async function main() {
  const fromEnv = (process.env.CARDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const names = process.argv.slice(2).length ? process.argv.slice(2) : fromEnv;
  if (!names.length) {
    console.error('Give one or more card names, or set CARDS="A,B".');
    process.exit(2);
  }

  say('# Card text');
  say();
  for (const name of names) {
    try {
      await lookup(name);
    } catch (err) {
      say(`### ${name}`);
      say(`Lookup failed: ${err.message}`);
      say();
    }
    // Scryfall asks for 50-100ms between requests; this is well inside that.
    await wait(200);
  }

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) require('node:fs').appendFileSync(summary, out.join('\n') + '\n');
}

main().catch((err) => { console.error('Lookup failed:', err); process.exit(1); });
