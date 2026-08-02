#!/usr/bin/env node
// Which published combos involve these cards — and, for a deck, what is
// standing between it and each one.
//
// Written to answer "shouldn't X combo with Y?", which is the question that
// finds real gaps. It has two possible answers and they need telling apart:
// Spellbook does not list the combo at all, or Spellbook lists it and we are
// not showing it. The second is our bug; the first is theirs.
//
//   node tools/combos-with.js "Heroic Feast" "Kitchen Finks"
//
// Cards are matched the way a decklist is read — front face, case-insensitive —
// so the spelling that works in the deck box works here.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const DeckParser = require('../parser.js');
const DeckCombos = require('../combos.js');
const TIERS = require('../result-tiers.js');

const COMBOS_URL = 'https://raw.githubusercontent.com/PaludaNCode/MTG-Combo-Finder/data/combos.json';
const UA = 'MTG-Combo-Finder (github.com/PaludaNCode/MTG-Combo-Finder; combo lookup)';
const DEFAULT_DECK = path.join(__dirname, '..', 'test', 'fixtures', 'deck.txt');
const SPELLBOOK = 'https://commanderspellbook.com/combo/';

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

// What a combo needs that the deck has not got. Named cards and template slots
// are reported apart on purpose: a missing named card is a suggestion the page
// can make, a missing slot is not, and that difference is the whole point.
function whatIsMissing(combo, deckNames, byTemplate, data) {
  const missingCards = (combo.c || []).filter((n) => !deckNames.has(DeckCombos.nameKey(n)));
  const slots = Array.isArray(combo.t) ? combo.t : [];
  const filled = slots.length ? DeckCombos.fillTemplates(combo, byTemplate, data.templates || {}) : [];
  const slotNames = slots.map((id) => (data.templates || {})[id]
    || (data.unresolvable || {})[id]
    || (data.skipped || {})[id]
    || `template ${id}`);
  return { missingCards, slots: slotNames, slotsFilled: Boolean(filled), filled: filled || [] };
}

async function main() {
  const names = process.argv.slice(2).length
    ? process.argv.slice(2)
    : (process.env.CARDS || '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  if (!names.length) {
    console.error('Give one or more card names, or set CARDS="A; B".');
    process.exit(2);
  }

  const res = await fetch(COMBOS_URL, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
  const data = DeckCombos.decode(await res.json());

  const wanted = names.map((n) => DeckCombos.nameKey(n));
  const deckFile = process.env.DECK_FILE || DEFAULT_DECK;
  const parsed = DeckParser.parseDecklist(fs.readFileSync(deckFile, 'utf8'));
  const deckEntries = (parsed.commanders || []).concat(parsed.main || []);
  const deckNames = DeckCombos.deckNameSet(deckEntries);
  const byTemplate = DeckCombos.deckTemplateIndex(data, deckNames, deckEntries);

  say(`# Combos with ${names.join(' + ')}`);
  say();
  say(`Against ${data.combos.length.toLocaleString()} combos published ${data.updatedAt}, `
    + `compared with ${path.basename(deckFile)} (${deckNames.size} cards).`);
  say();

  const has = wanted.filter((k) => deckNames.has(k));
  say(`In that deck: ${has.length ? has.length + ' of ' + wanted.length : 'none'} of the named cards.`);
  say();

  const all = (data.combos || []).filter((c) => {
    const keys = (c.c || []).map(DeckCombos.nameKey);
    return wanted.every((k) => keys.includes(k));
  });

  if (!all.length) {
    say(`**No published combo names all of them together.** That is Spellbook's data, not our matching: `
      + 'if the interaction is real it is a gap worth submitting to them.');
  } else {
    say(`**${all.length} combo(s)** name all of them.`);
  }
  say();

  // The interesting bucket: combos naming only *some* of them, where the rest of
  // what is needed may be a template slot. That is how "shouldn't X combo with
  // Y?" usually resolves — Spellbook wrote a slot where a specific card was
  // expected, and a slot cannot be suggested.
  const partial = (data.combos || []).filter((c) => {
    const keys = (c.c || []).map(DeckCombos.nameKey);
    return wanted.some((k) => keys.includes(k)) && !wanted.every((k) => keys.includes(k));
  });

  const show = (list, limit) => {
    say('| combo | slots | missing from the deck | result |');
    say('|---|---|---|---|');
    for (const combo of list.slice(0, limit)) {
      const m = whatIsMissing(combo, deckNames, byTemplate, data);
      const best = bestResult(combo.p);
      const gap = [];
      if (m.missingCards.length) gap.push(m.missingCards.join(', '));
      if (m.slots.length && !m.slotsFilled) gap.push(`_a ${m.slots.join(', a ')}_`);
      say(`| [${(combo.c || []).join(' + ')}](${SPELLBOOK}${combo.id}/) `
        + `| ${m.slots.length ? m.slots.join(', ') : '—'} `
        + `| ${gap.join(' + ') || '**nothing — this one is in the deck**'} `
        + `| ${best ? MARK[best.tier] + ' ' + best.name : '—'} |`);
    }
    if (list.length > limit) say(`| …and ${list.length - limit} more | | | |`);
    say();
  };

  if (all.length) { say('## Naming all of them'); say(); show(all, 30); }

  if (partial.length) {
    say(`## Naming some of them (${partial.length})`);
    say();
    say('A combo here that needs only a *slot* the deck cannot fill is one the page '
      + 'drops silently: a slot has no single card to suggest, so it is not offered.');
    say();
    // Closest first: fewest missing named cards, then fewest unfilled slots.
    const ranked = partial.slice().sort((a, b) => {
      const ma = whatIsMissing(a, deckNames, byTemplate, data);
      const mb = whatIsMissing(b, deckNames, byTemplate, data);
      return (ma.missingCards.length - mb.missingCards.length)
        || ((ma.slotsFilled ? 0 : 1) - (mb.slotsFilled ? 0 : 1))
        || (b.pop || 0) - (a.pop || 0);
    });
    show(ranked, 30);

    // The specific thing worth knowing: combos the deck completes apart from one
    // unfillable slot. Those are reachable — by adding a card that fills it —
    // and today nothing tells you so.
    const slotOnly = partial.filter((c) => {
      const m = whatIsMissing(c, deckNames, byTemplate, data);
      return !m.missingCards.length && m.slots.length && !m.slotsFilled;
    });
    if (slotOnly.length) {
      say(`### ${slotOnly.length} of those need **only** a slot the deck cannot fill`);
      say();
      say('Every named card is already here. Adding one card that fills the slot '
        + 'completes the combo, and the page currently says nothing about it.');
      say();
      for (const combo of slotOnly.slice(0, 20)) {
        const m = whatIsMissing(combo, deckNames, byTemplate, data);
        say(`- [${(combo.c || []).join(' + ')}](${SPELLBOOK}${combo.id}/) — needs a **${m.slots.join('** and a **')}**`);
      }
      say();
    }
  }

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) fs.appendFileSync(summary, out.join('\n') + '\n');
}

main().catch((err) => { console.error('Lookup failed:', err.message); process.exit(1); });
