#!/usr/bin/env node
// Second research run: the three facts that decide how to improve coverage.
// Manual, from Actions, because none of it is reachable from a restricted
// network. Reads and reports; publishes nothing.
//
//   A. Templates, in full. The first run sampled 400 requirements from the
//      front of the file and saw no sacrifice outlet, which contradicted the
//      assumption that a generic outlet template exists. File order is not a
//      sample, so this scans every variant: every distinct template, how many
//      combos need it, and — the decisive part — whether ANY template carries a
//      non-null scryfallQuery. Without one, "does this card satisfy it?" cannot
//      be answered from the bulk export at all.
//
//   B. Does Spellbook expose templates through their API? If the bulk export
//      drops the query but the API keeps it, template support is a fetch away.
//
//   C. Is there a second combo database, or only one wearing several hats?
//      EDHREC credits Commander Spellbook; if every other site does too, then
//      "cover as many databases as possible" has one member and the honest
//      move is to cover that one completely.
'use strict';

const { createVariantScanner, bodyChunks } = require('./fetch-combos.js');

const UA = 'MTG-Combo-Finder-Research/1.0 (+https://github.com/PaludaNCode/MTG-Combo-Finder; coverage study)';
const BULK_URL = 'https://json.commanderspellbook.com/variants.json';

const out = [];
const say = (line = '') => { out.push(line); console.log(line); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- A. every template in the database -------------------------------------

async function fullTemplateScan() {
  say('## A. Every template in the database');
  say();

  const res = await fetch(BULK_URL, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error('bulk export HTTP ' + res.status);

  const templates = new Map(); // name -> { id, uses, query, api }
  let variants = 0, withTemplates = 0, bytes = 0;
  // How much of the database is out of reach because of a template, split by
  // how close a deck could otherwise get.
  const cardsAlongside = new Map();

  const push = createVariantScanner((v) => {
    variants += 1;
    const requires = v.requires || [];
    if (!Array.isArray(requires) || !requires.length) return;
    withTemplates += 1;
    const n = (v.uses || []).length;
    cardsAlongside.set(n, (cardsAlongside.get(n) || 0) + 1);
    for (const req of requires) {
      const t = (req && req.template) || req;
      const name = t && t.name;
      if (!name) continue;
      if (!templates.has(name)) {
        templates.set(name, {
          id: t.id, uses: 0,
          query: t.scryfallQuery || t.scryfall_query || null,
          api: t.scryfallApi || t.scryfall_api || null,
        });
      }
      templates.get(name).uses += 1;
    }
  });

  const decoder = new TextDecoder('utf-8');
  for await (const chunk of bodyChunks(res)) {
    bytes += chunk.length;
    push(decoder.decode(chunk, { stream: true }));
  }
  push(decoder.decode());

  say(`Scanned **${variants.toLocaleString()} variants** (${(bytes / 1024 / 1024).toFixed(0)} MB). `
    + `${withTemplates.toLocaleString()} require at least one template `
    + `(${(withTemplates / variants * 100).toFixed(1)}%).`);
  say();

  const withQuery = [...templates.values()].filter((t) => t.query);
  say(`**${templates.size} distinct templates.** `
    + `${withQuery.length} carry a non-null \`scryfallQuery\`.`);
  say();
  if (!withQuery.length) {
    say('> No template in the entire export says which cards satisfy it. Deciding whether a given '
      + 'card can stand in for one is therefore impossible from this file alone — it needs their '
      + 'API, or our own reading of the template name.');
  } else {
    say('Examples that do carry a query:');
    withQuery.slice(0, 10).forEach((t) => say(`  - \`${t.query}\``));
  }
  say();

  say('Named cards sitting alongside a template:');
  say();
  say('| named cards | combos |');
  say('|---:|---:|');
  [...cardsAlongside.entries()].sort((a, b) => a[0] - b[0])
    .forEach(([n, c]) => say(`| ${n} | ${c.toLocaleString()} |`));
  say();

  const sorted = [...templates.entries()].sort((a, b) => b[1].uses - a[1].uses);
  say(`### The 60 most-used templates`);
  say();
  say('| combos | query? | template |');
  say('|---:|:-:|---|');
  sorted.slice(0, 60).forEach(([name, t]) =>
    say(`| ${t.uses.toLocaleString()} | ${t.query ? 'yes' : '—'} | ${name} |`));
  say();

  // The question that started this: is a generic sacrifice outlet a template?
  const sacish = sorted.filter(([name]) => /sacrifice|sac outlet|outlet/i.test(name));
  say('### Is a generic sacrifice outlet a template?');
  say();
  if (!sacish.length) {
    say('**No.** Not one of the ' + templates.size + ' template names mentions sacrificing. '
      + 'Spellbook enumerates concrete outlets (Carrion Feeder appears in 1,769 combos by name) '
      + 'rather than templating them — so a new outlet like Hammerhead, Maggia Boss joins nothing '
      + 'automatically, and template support would not have helped it.');
  } else {
    sacish.forEach(([name, t]) => say(`  - ${t.uses.toLocaleString()} combos — ${name}${t.query ? ` — \`${t.query}\`` : ' — no query'}`));
  }
  say();
}

// ---- B. does their API keep what the export drops? -------------------------

const API_CANDIDATES = [
  'https://backend.commanderspellbook.com/templates/',
  'https://backend.commanderspellbook.com/api/templates/',
  'https://backend.commanderspellbook.com/templates/?limit=3',
];

async function probeApi() {
  say('## B. Does Commander Spellbook expose templates through their API?');
  say();
  say('If the export drops `scryfallQuery` but the API keeps it, template support becomes a fetch '
    + 'rather than a guess. Three candidate paths, one request each.');
  say();
  for (const url of API_CANDIDATES) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
      say(`- \`${url}\` → HTTP ${res.status}`);
      if (!res.ok) { await wait(1200); continue; }
      const text = (await res.text()).slice(0, 1200);
      say('  ```json');
      say('  ' + text.replace(/\n/g, '\n  '));
      say('  ```');
    } catch (err) {
      say(`- \`${url}\` → failed: ${err.message}`);
    }
    await wait(1500);
  }
  say();
}

// ---- C. is there a second database at all? ---------------------------------

const SOURCES = [
  { host: 'edhoptimizer.com', path: '/en/commander/hammerhead-maggia-boss/' },
  { host: 'commanderspellbook.com', path: '/search/?q=Hammerhead' },
  { host: 'www.moxfield.com', path: '/' },
  { host: 'archidekt.com', path: '/' },
];

function disallowed(robots, path) {
  const rules = [];
  for (const raw of String(robots).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^Disallow:\s*(\S*)$/i);
    if (m && m[1]) rules.push(m[1]);
  }
  return rules.filter((rule) => path.startsWith(rule.replace(/\*.*$/, '')));
}

async function attribution(target) {
  const base = `https://${target.host}`;
  say(`### ${target.host}`);
  let robots = '';
  try {
    const res = await fetch(base + '/robots.txt', { headers: { 'User-Agent': UA } });
    robots = res.ok ? await res.text() : '';
  } catch (err) {
    say(`  robots.txt unreadable (${err.message}) — skipping this host entirely.`);
    say();
    return;
  }
  const blocked = disallowed(robots, target.path);
  if (blocked.length) {
    say(`  \`${target.path}\` disallowed by \`${blocked.join('`, `')}\` — not fetched.`);
    say();
    return;
  }
  await wait(2000);
  try {
    const res = await fetch(base + target.path, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (!res.ok) { say(`  page → HTTP ${res.status}`); say(); return; }
    const html = await res.text();
    const credits = ['Commander Spellbook', 'commanderspellbook', 'EDHREC', 'Scryfall']
      .filter((n) => html.toLowerCase().includes(n.toLowerCase()));
    say(`  page → HTTP ${res.status}, ${(html.length / 1024).toFixed(0)} KB`);
    say(`  credits found: ${credits.length ? '`' + credits.join('`, `') + '`' : '(none)'}`);
  } catch (err) {
    say(`  page failed: ${err.message}`);
  }
  say();
}

async function main() {
  say('# Coverage research');
  say();
  say(`Run ${new Date().toISOString()}.`);
  say();
  try { await fullTemplateScan(); } catch (err) { say(`Template scan failed: ${err.message}`); say(); }
  try { await probeApi(); } catch (err) { say(`API probe failed: ${err.message}`); say(); }

  say('## C. Is there a second combo database, or one wearing several hats?');
  say();
  for (const s of SOURCES) {
    try { await attribution(s); } catch (err) { say(`### ${s.host}`); say(`  failed: ${err.message}`); say(); }
    await wait(2500);
  }

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) require('node:fs').appendFileSync(summary, out.join('\n') + '\n');
}

main().catch((err) => { console.error('Coverage research failed:', err); process.exit(1); });
