#!/usr/bin/env node
// Which combos need a given template, and what they pair it with.
//
// Exists because "a Nonartifact creature with MV <= 5" is 14,368 cards, and the
// only way to judge whether a slot that wide is useful or noise is to see the
// combos actually asking for it — which card demands it, and what the payoff is.
// Answering that from the shape of the data rather than by reading it has been
// wrong before, so this reads it.
//
//   node tools/template-users.js "Nonartifact creature with MV <= 5"
//
// Reads the published combos.json (27 MB, already carries template ids) rather
// than Spellbook's 578 MB export: same answer, a fraction of the download.
'use strict';

const COMBOS_URL = 'https://raw.githubusercontent.com/PaludaNCode/MTG-Combo-Finder/data/combos.json';
const TEMPLATES_URL = 'https://backend.commanderspellbook.com/templates/?limit=100';
const UA = 'MTG-Combo-Finder (github.com/PaludaNCode/MTG-Combo-Finder; template usage)';

const TIERS = require('../result-tiers.js');
const { decode } = require('../combos.js');

const out = [];
const say = (line = '') => { out.push(line); console.log(line); };

// decode() resolves the payload's interned card names back into strings — this
// file prints them. A no-op on anything without the tables, including the
// templates.json this also fetches.
async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
  return decode(await res.json());
}

async function allTemplates() {
  const templates = [];
  let url = TEMPLATES_URL;
  while (url) {
    const page = await getJson(url);
    templates.push(...(page.results || []));
    url = page.next;
  }
  return templates;
}

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// The best result a combo produces, so a wall of combos can be read at a glance.
function bestResult(produces) {
  const rank = { win: 0, decisive: 1, other: 2 };
  let best = null;
  for (const name of produces || []) {
    const { tier } = TIERS.tierOf(name);
    if (!best || rank[tier] < rank[best.tier]) best = { name, tier };
  }
  return best;
}

async function main() {
  const wanted = process.argv.slice(2).join(' ').trim() || process.env.TEMPLATE || '';
  const templates = await allTemplates();

  // With no name, rank every template by how many combos ask for it. This is
  // also the check that the ids in combos.json and the ids from the templates
  // API are the same numbers: if they were not, no slot would ever be filled
  // and nothing would say so — the combos would just quietly stay missing.
  if (!wanted || wanted === '*') {
    const data = await getJson(COMBOS_URL);
    const byId = new Map();
    let withTemplates = 0;
    for (const combo of data.combos || []) {
      if (!(combo.t || []).length) continue;
      withTemplates += 1;
      for (const id of combo.t) byId.set(String(id), (byId.get(String(id)) || 0) + 1);
    }
    const names = new Map(templates.map((t) => [String(t.id), t.name]));
    const rows = [...byId.entries()].sort((a, b) => b[1] - a[1]);
    const unknown = rows.filter(([id]) => id !== 'null' && !names.has(id));
    const total = (data.combos || []).length;

    say('# Templates by how many combos need them');
    say();
    say(`${withTemplates.toLocaleString()} of ${total.toLocaleString()} combos need at least one template.`);
    say(`${rows.length} distinct ids in the data, ${names.size} templates in the API, `
      + `**${rows.filter(([id]) => names.has(id)).length} line up**.`);
    if (unknown.length) {
      say();
      say(`⚠️ ${unknown.length} id(s) in the data match no template in the API: `
        + unknown.slice(0, 15).map(([id, n]) => `\`${id}\` (${n} combos)`).join(', '));
    }
    say();
    say('| combos | id | template |');
    say('|---:|---:|---|');
    for (const [id, n] of rows.slice(0, 40)) {
      say(`| ${n} | ${id} | ${names.get(id) || (id === 'null' ? '_(no id in the export)_' : '**unknown**')} |`);
    }
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) require('node:fs').appendFileSync(summary, out.join('\n') + '\n');
    return;
  }
  const match = templates.find((t) => norm(t.name) === norm(wanted))
    || templates.find((t) => norm(t.name).includes(norm(wanted)));
  if (!match) {
    console.error(`No template matches "${wanted}". Names are listed by the regenerate workflow.`);
    process.exit(1);
  }

  say(`# ${match.name}`);
  say();
  say(`Template id \`${match.id}\`${match.scryfallQuery ? ` — \`${match.scryfallQuery}\`` : ' — no Scryfall query'}`);
  say();

  const data = await getJson(COMBOS_URL);
  const combos = (data.combos || []).filter((c) => (c.t || []).some((id) => String(id) === String(match.id)));

  if (!combos.length) {
    say('No published combo requires it.');
    return;
  }

  // Which named cards demand this slot. That is the real question: a template is
  // only ever asked for by a specific card's ability.
  const byCard = new Map();
  for (const combo of combos) {
    for (const name of combo.c || []) {
      if (!byCard.has(name)) byCard.set(name, []);
      byCard.get(name).push(combo);
    }
  }
  const cards = [...byCard.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  say(`**${combos.length} combo(s)** require it, across **${cards.length} distinct card(s)**.`);
  say();
  say('## The cards asking for it');
  say();
  say('| combos | card |');
  say('|---:|---|');
  for (const [name, list] of cards.slice(0, 30)) say(`| ${list.length} | ${name} |`);
  if (cards.length > 30) say(`| | …and ${cards.length - 30} more |`);
  say();

  say('## The combos themselves');
  say();
  say('| cards | slots | best result |');
  say('|---|---:|---|');
  const sorted = combos.slice().sort((a, b) => (b.pop || 0) - (a.pop || 0));
  for (const combo of sorted.slice(0, 40)) {
    const best = bestResult(combo.p);
    const mark = best ? ({ win: '🟢', decisive: '🟡', other: '⚪' })[best.tier] : '';
    say(`| ${(combo.c || []).join(' + ')} | ${(combo.t || []).length} | ${mark} ${best ? best.name : '—'} |`);
  }
  if (sorted.length > 40) say(`| …and ${sorted.length - 40} more | | |`);
  say();

  const greens = combos.filter((c) => (c.p || []).some((n) => TIERS.tierOf(n).tier === 'win')).length;
  say(`${greens} of the ${combos.length} produce something in the green tier.`);

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) require('node:fs').appendFileSync(summary, out.join('\n') + '\n');
}

main().catch((err) => { console.error('Lookup failed:', err.message); process.exit(1); });
