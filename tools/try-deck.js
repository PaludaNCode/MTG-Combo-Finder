#!/usr/bin/env node
// Run a real decklist through the real code against the real published data,
// and print what the page would show.
//
// The layout test proves the page renders; the unit tests prove each function
// behaves. Neither answers "is the output any good?" — whether the combos found
// are worth knowing, whether a template slot reads as sensible or invented.
// That needs a real deck and real data, which is what this is for.
//
//   node tools/try-deck.js                    # the checked-in deck
//   node tools/try-deck.js path/to/deck.txt
//
// Also runs from Actions, so the answer does not depend on having network here.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const DeckParser = require('../parser.js');
const DeckCombos = require('../combos.js');
const TIERS = require('../result-tiers.js');

const COMBOS_URL = 'https://raw.githubusercontent.com/PaludaNCode/MTG-Combo-Finder/data/combos.json';
const UA = 'MTG-Combo-Finder (github.com/PaludaNCode/MTG-Combo-Finder; deck check)';
const DEFAULT_DECK = path.join(__dirname, '..', 'test', 'fixtures', 'deck.txt');

const out = [];
const say = (line = '') => { out.push(line); console.log(line); };

const MARK = { win: '🟢', decisive: '🟡', other: '⚪' };

function bestResult(names) {
  const rank = { win: 0, decisive: 1, other: 2 };
  let best = null;
  for (const name of names || []) {
    const { tier } = TIERS.tierOf(name);
    if (!best || rank[tier] < rank[best.tier]) best = { name, tier };
  }
  return best;
}

const resultNames = (variant) => (variant.produces || [])
  .map((p) => (p.feature && p.feature.name) || p.name)
  .filter(Boolean);

function tierCounts(variants) {
  const counts = { win: 0, decisive: 0, other: 0 };
  for (const v of variants) {
    const best = bestResult(resultNames(v));
    if (best) counts[best.tier] += 1;
  }
  return counts;
}

async function main() {
  const file = process.argv[2] || process.env.DECK_FILE || DEFAULT_DECK;
  const text = fs.readFileSync(file, 'utf8');

  const parsed = DeckParser.parseDecklist(text);
  const main_ = parsed.main || [];
  const typedCommanders = parsed.commanders || [];

  say(`# ${path.basename(file)}`);
  say();
  say(`${main_.length} cards parsed`
    + (parsed.skipped && parsed.skipped.length ? `, ${parsed.skipped.length} line(s) not understood` : '')
    + (typedCommanders.length ? `, ${typedCommanders.length} marked as commander` : ''));
  if (parsed.skipped && parsed.skipped.length) {
    say();
    for (const line of parsed.skipped.slice(0, 10)) say(`  ! ${line}`);
  }
  say();

  const res = await fetch(COMBOS_URL, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
  const data = DeckCombos.decode(await res.json());
  say(`Matched against ${data.combos.length.toLocaleString()} combos published ${data.updatedAt}.`);
  say(`${Object.keys(data.templates || {}).length} template card lists, `
    + `${Object.keys(data.templateCards || {}).length} cards fill at least one.`);
  say();

  const allEntries = typedCommanders.concat(main_);
  const deckNames = DeckCombos.deckNameSet(allEntries);

  // ---- combos --------------------------------------------------------------
  const matched = DeckCombos.matchDeck(data, deckNames, allEntries);
  const included = matched.included.map(DeckCombos.expand);
  const groups = DeckCombos.groupVariants(included);
  const counts = tierCounts(included);

  const identity = matched.identity ? [...matched.identity].join('') : '';
  say(`Colour identity: \`${identity || '(none)'}\``);
  say();
  say('## Combos in the deck');
  say();
  say(`**${included.length} combos** in ${groups.length} rows `
    + `— ${MARK.win} ${counts.win} win · ${MARK.decisive} ${counts.decisive} decisive · ${MARK.other} ${counts.other} other`);
  say();

  const withSlots = included.filter((c) => (c.fills || []).length);
  say(`${withSlots.length} of them are found only because the deck fills a template slot.`);
  say();

  // Zero of those is a perfectly possible answer — a deck simply may not play
  // the combos that need a slot — but it is indistinguishable from the feature
  // being broken unless the reason is shown. So show the reason: what the deck
  // can fill, and which combos came close and why they did not land.
  say('### Template slots, in detail');
  say();
  const byTemplate = DeckCombos.deckTemplateIndex(data, deckNames, allEntries);
  const fillable = [...byTemplate.entries()]
    .map(([id, cards]) => ({ name: (data.templates || {})[id] || `id ${id}`, cards: cards.map((c) => c.name) }))
    .sort((a, b) => b.cards.length - a.cards.length);
  say(`The deck can fill **${fillable.length}** of the ${Object.keys(data.templates || {}).length} known templates:`);
  say();
  for (const t of fillable.slice(0, 15)) say(`- **${t.name}** → ${t.cards.join(', ')}`);
  if (fillable.length > 15) say(`- …and ${fillable.length - 15} more`);
  say();

  // Combos holding every named card they ask for, and failing only on a slot.
  // These are the ones the whole feature exists to rescue, so if the count is
  // high and the rescued count is zero, something is wrong rather than absent.
  const blocked = new Map();
  for (const combo of data.combos) {
    if (!Array.isArray(combo.t) || !combo.t.length) continue;
    if ((combo.c || []).some((n) => !deckNames.has(DeckCombos.nameKey(n)))) continue;
    if (DeckCombos.fillTemplates(combo, byTemplate, data.templates || {})) continue;
    for (const id of combo.t) {
      const key = String(id);
      if (!blocked.has(key)) blocked.set(key, 0);
      blocked.set(key, blocked.get(key) + 1);
    }
  }
  if (!blocked.size) {
    say('No combo has all its named cards here and fails only on a slot, so nothing is being missed.');
  } else {
    const rows = [...blocked.entries()].sort((a, b) => b[1] - a[1]);
    say(`${rows.length} template(s) block a combo whose named cards are all present:`);
    say();
    for (const [id, n] of rows.slice(0, 15)) {
      const name = (data.templates || {})[id] || (data.unresolvable || {})[id] || `id ${id}`;
      const why = (data.templates || {})[id] ? 'nothing in the deck fills it' : 'no Scryfall query, so it can never be filled';
      say(`- **${name}** — ${n} combo(s), ${why}`);
    }
  }
  say();

  // The templates above block combos and the page says nothing about any of them:
  // the "One slot away" panel that used to report the narrow case — one slot short,
  // every named card present, in colour — was removed. `tools/deck-gaps.js` is where
  // that question is answered now. This tool reports what the page shows, so it stops
  // here too.

  say('| # | combo | slot filled by | best result |');
  say('|---:|---|---|---|');
  groups.forEach((g, i) => {
    const v = g.variants[0];
    const names = DeckCombos.variantCardNames(v);
    const label = g.choices && g.choices.length > 1
      ? g.shared.join(' + ') + ` + any of ${g.choices.length}`
      : names.join(' + ');
    const fills = (v.fills || []).map((f) => `${f.card} _(${f.slot})_`).join(', ');
    const best = bestResult(resultNames(v));
    say(`| ${i + 1} | ${label} | ${fills || '—'} | ${best ? MARK[best.tier] + ' ' + best.name : '—'} |`);
  });
  say();

  if (withSlots.length) {
    say('### Every slot the deck filled');
    say();
    for (const combo of withSlots) {
      for (const fill of combo.fills) {
        say(`- **${fill.slot}** → ${fill.card}  \`(${DeckCombos.variantCardNames(combo).join(' + ')})\``);
      }
    }
    say();
  }

  // ---- suggestions ---------------------------------------------------------
  const suggestions = DeckCombos.groupSuggestions(
    DeckCombos.computeSuggestions(matched.almostIncluded.map(DeckCombos.expand), deckNames), deckNames
  );
  say('## Top suggestions, in colour');
  say();
  say(`${suggestions.length} suggestion(s).`);
  say();
  say('| unlocks | add | or instead |');
  say('|---:|---|---|');
  for (const s of suggestions.slice(0, 15)) {
    const [first, ...rest] = s.cards;
    say(`| +${s.unlocks.length} | ${first} | ${rest.slice(0, 4).join(' · ') || '—'}${rest.length > 4 ? ` +${rest.length - 4}` : ''} |`);
  }
  say();

  const pieces = DeckCombos.comboPieces(included);
  say('## Cards carrying the most combos');
  say();
  for (const p of pieces.slice(0, 10)) say(`- ${p.card} — ${p.count}`);
  say();

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) fs.appendFileSync(summary, out.join('\n') + '\n');
}

main().catch((err) => { console.error('Deck check failed:', err.message); process.exit(1); });
