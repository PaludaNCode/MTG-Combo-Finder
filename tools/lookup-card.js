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
// Also runs from Actions with a `cards` input, so future questions of this kind
// need no code change. Names there are separated by a semicolon or a newline,
// never a comma: half of Magic's legendary creatures have a comma in the name,
// and "Camellia, the Seedmiser" split into two cards neither of which exists.
//
// ---- when Scryfall is not reachable -----------------------------------------
//
// "a runner with open network" is an assumption, and it fails: an agent sandbox
// behind an egress proxy that allowlists raw.githubusercontent.com answers every
// Scryfall host with a 403 at CONNECT, and so do mtgjson, gatherer and the
// Spellbook API. This tool then prints "HTTP 403 — check the spelling", which is
// the wrong diagnosis honestly given — a blocked host and a typo look identical
// from here, and a typo is the likelier one.
//
// The way out is that Forge ships its card scripts as plain files in a GitHub
// repo, so they come over the host that *is* allowed. Each has an `Oracle:` line
// carrying the card text verbatim:
//
//   https://raw.githubusercontent.com/Card-Forge/forge/master/forge-gui/res/
//     cardsfolder/<first letter of slug>/<slug>.txt
//
// The slug rule was probed, not guessed — 454 of 454 names out of the published
// combo data resolve, and each clause below is a name the obvious rule got wrong:
//
//   strip accents, then lowercase          Éomer, … -> eomer_…
//   apostrophes vanish, every other run    Ashnod's Altar -> ashnods_altar
//     of non-alphanumerics becomes one _   M.O.D.O.K.     -> m_o_d_o_k
//   split cards join BOTH faces            Birgi … // Harnfel … ->
//                                            birgi_…_harnfel_…  (front alone 404s)
//   recent sets sit in cardsfolder/upcoming/ rather than the letter directory
//
// It is a second opinion rather than a replacement: no colour identity, no
// legalities, no printings, and the text is maintained by Forge rather than by
// Wizards. Scryfall stays the first ask. The README section "Reading a card when
// Scryfall is unreachable" has the probe numbers and the XMage cross-check.
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
  const fromEnv = (process.env.CARDS || '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  const names = process.argv.slice(2).length ? process.argv.slice(2) : fromEnv;
  if (!names.length) {
    console.error('Give one or more card names, or set CARDS="A; B".');
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
