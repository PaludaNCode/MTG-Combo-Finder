#!/usr/bin/env node
// Measure whether resolving Spellbook's templates into real card lists is
// practical. Manual, from Actions. Reads and reports; publishes nothing.
//
// The idea: 3,860 combos are dropped because they need "a Persist Creature"
// rather than a named card, and 64% of those would show green. Spellbook's API
// gives 135 of its 157 templates a Scryfall query, so each can be turned into
// an actual list of cards — no wording interpreted, no rule invented.
//
// Three things have to be true for it to be worth building, and none of them
// are knowable without trying:
//
//   1. The request volume is sane. Scryfall paginates at 175 cards and asks for
//      50-100ms between calls; a few hundred requests is fine, several thousand
//      is not.
//   2. The result is small enough to ship. Published as card -> template ids
//      rather than template -> cards, because the same card satisfies few
//      templates while a template matches thousands of cards.
//   3. The sets are actually right, which needs eyeballing rather than counting.
'use strict';

const UA = 'MTG-Combo-Finder-Research/1.0 (+https://github.com/PaludaNCode/MTG-Combo-Finder; template resolution study)';
const TEMPLATES_URL = 'https://backend.commanderspellbook.com/templates/?limit=100';

const out = [];
const say = (line = '') => { out.push(line); console.log(line); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Scryfall asks for 50-100ms between requests. 120 leaves headroom, and the
// whole point of this run is to find out how many requests that adds up to.
const GAP_MS = 120;
let requests = 0;

async function getJson(url) {
  requests += 1;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  await wait(GAP_MS);
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
  return res.json();
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

// One template -> every card that satisfies it. Scryfall pages at 175; follow
// next_page until it stops, but refuse to walk forever on a pathological query.
const MAX_PAGES = 40;

async function resolve(template) {
  const start = template.scryfallApi;
  if (!start) return { skipped: 'no query' };

  const names = [];
  let url = start;
  let pages = 0;
  while (url && pages < MAX_PAGES) {
    let page;
    try {
      page = await getJson(url);
    } catch (err) {
      return { error: `HTTP ${err.status || '?'} after ${pages} page(s)` };
    }
    if (page.notFound) return { names: [], pages: pages + 1, empty: true };
    pages += 1;
    for (const card of page.data || []) if (card.name) names.push(card.name);
    url = page.has_more ? page.next_page : null;
  }
  // Scryfall can return the same card across pages for some queries; count what
  // is distinct, or a template looks bigger than it is.
  return { names: [...new Set(names)], pages, truncated: Boolean(url) };
}

async function main() {
  const startedAt = Date.now();
  say('# Can templates be resolved into card lists?');
  say();

  const templates = await allTemplates();
  const withQuery = templates.filter((t) => t.scryfallApi);
  say(`${templates.length} templates, ${withQuery.length} with a Scryfall query, `
    + `${templates.length - withQuery.length} without.`);
  say();

  const byCard = new Map();   // card name -> Set of template ids
  const rows = [];
  let failures = 0;

  for (const template of withQuery) {
    const result = await resolve(template);
    if (result.error) {
      failures += 1;
      rows.push({ name: template.name, note: result.error, count: 0, pages: 0 });
      continue;
    }
    for (const name of result.names) {
      if (!byCard.has(name)) byCard.set(name, new Set());
      byCard.get(name).add(template.id);
    }
    rows.push({
      name: template.name,
      query: template.scryfallQuery,
      count: result.names.length,
      pages: result.pages,
      note: result.truncated ? `stopped at ${MAX_PAGES} pages` : (result.empty ? 'matched nothing' : ''),
    });
  }

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  const totalMatches = rows.reduce((sum, r) => sum + r.count, 0);

  say('## 1. Cost');
  say();
  say(`- **${requests} requests**, ${seconds}s wall time at ${GAP_MS}ms spacing`);
  say(`- ${failures} template(s) failed to resolve`);
  say(`- ${totalMatches.toLocaleString()} card-to-template matches in total`);
  say(`- **${byCard.size.toLocaleString()} distinct cards** satisfy at least one template`);
  say();

  say('## 2. Size, published as card -> template ids');
  say();
  const payload = {};
  for (const [name, ids] of byCard) payload[name] = [...ids].sort((a, b) => a - b);
  const json = JSON.stringify(payload);
  say(`- \`${(json.length / 1024 / 1024).toFixed(2)} MB\` raw JSON`);
  say(`- for comparison, the published combos.json is about 27 MB`);
  const many = [...byCard.values()].filter((s) => s.size > 1).length;
  say(`- ${many.toLocaleString()} cards satisfy more than one template`);
  say();

  say('## 3. Do the sets look right?');
  say();
  say('The biggest templates, and a few cards each — for eyeballing, not counting.');
  say();
  const sorted = rows.filter((r) => r.count).sort((a, b) => b.count - a.count);
  for (const row of sorted.slice(0, 12)) {
    const sample = [...byCard.entries()]
      .filter(([, ids]) => [...ids].some((id) => withQuery.find((t) => t.id === id && t.name === row.name)))
      .slice(0, 5)
      .map(([n]) => n);
    say(`**${row.name}** — ${row.count.toLocaleString()} cards, ${row.pages} page(s)`);
    say(`  \`${row.query}\``);
    say(`  e.g. ${sample.join(', ') || '(none sampled)'}`);
    say();
  }

  say('## Every template, by size');
  say();
  say('| cards | pages | template | note |');
  say('|---:|---:|---|---|');
  for (const row of rows.sort((a, b) => b.count - a.count)) {
    say(`| ${row.count.toLocaleString()} | ${row.pages} | ${row.name} | ${row.note || ''} |`);
  }
  say();

  const noQuery = templates.filter((t) => !t.scryfallApi);
  say(`## The ${noQuery.length} template${noQuery.length === 1 ? '' : 's'} with no query`);
  say();
  say('These cannot be resolved, and combos needing them should stay excluded and say so.');
  say();
  noQuery.forEach((t) => say(`- ${t.name}`));
  say();

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) require('node:fs').appendFileSync(summary, out.join('\n') + '\n');
}

main().catch((err) => { console.error('Template resolution study failed:', err); process.exit(1); });
