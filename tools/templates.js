#!/usr/bin/env node
// Turns Commander Spellbook's templates into real card lists.
//
// A template is a combo slot that names a property instead of a card: "a
// Persist Creature", "a Creature with Haste". Roughly 3,860 combos have one,
// and because our matching works on card names, every one of them used to be
// dropped — your deck contains Kitchen Finks, it does not contain "a Persist
// Creature".
//
// Spellbook attaches a Scryfall query to most templates, so the slot can be
// turned into the actual set of cards that fill it. Nothing here interprets
// wording: Spellbook authors the query, Scryfall evaluates it, and we record
// the answer. Templates with no query stay unresolved on purpose — see
// "Template slots" in the README for why evaluating the queries locally, against
// the Scryfall bulk file we already download, was considered and rejected.
//
// Measured on a full run: 465 requests, ~23 minutes, 21,769 distinct cards,
// 0.62 MB published.
'use strict';

const DeckCombos = require('../combos.js');

const TEMPLATES_URL = 'https://backend.commanderspellbook.com/templates/?limit=100';
const COMBOS_URL = 'https://raw.githubusercontent.com/PaludaNCode/MTG-Combo-Finder/data/combos.json';
const USER_AGENT = 'MTG-Combo-Finder (github.com/PaludaNCode/MTG-Combo-Finder)';

// Scryfall asks for 50-100ms between requests.
const GAP_MS = 120;

// Transient statuses are worth waiting out rather than recording as a fact
// about the template: a single 503 once cost four templates, one of them 34
// pages in. 429 means we are asking too fast, and Scryfall says for how long.
const RETRIES = 4;
const BACKOFF_MS = [1000, 2000, 4000, 8000];
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

// Scryfall pages at 175. There are roughly 35,000 distinct oracle cards, so no
// honest query can page past 200 — a run that reaches it has found a loop
// rather than a large result. The deepest real template uses 83.
const MAX_PAGES = 200;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function createFetcher() {
  const stats = { requests: 0, retries: 0 };

  async function getJson(url) {
    let failure;
    let backoff = 0;

    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      if (attempt) {
        stats.retries += 1;
        await wait(backoff);
      }
      stats.requests += 1;

      let res;
      try {
        res = await fetch(url, {
          headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        });
      } catch (err) {
        // A dropped connection is as transient as a 503.
        failure = err;
        backoff = BACKOFF_MS[attempt];
        continue;
      }
      await wait(GAP_MS);

      if (res.status === 404) return { notFound: true };
      if (res.ok) return res.json();

      failure = Object.assign(new Error('HTTP ' + res.status), { status: res.status });
      if (!TRANSIENT.has(res.status)) break;

      const after = Number(res.headers.get('retry-after'));
      backoff = Number.isFinite(after) && after > 0 ? after * 1000 : BACKOFF_MS[attempt];
    }

    throw failure;
  }

  return { getJson, stats };
}

async function allTemplates(getJson) {
  const templates = [];
  let url = TEMPLATES_URL;
  while (url) {
    const page = await getJson(url);
    templates.push(...(page.results || []));
    url = page.next;
  }
  return templates;
}

// One template -> every card name that satisfies it.
async function resolveOne(getJson, template) {
  const names = [];
  let url = template.scryfallApi;
  let pages = 0;

  while (url && pages < MAX_PAGES) {
    const page = await getJson(url);
    if (page.notFound) return { names: [], pages: pages + 1 };
    pages += 1;
    for (const card of page.data || []) if (card.name) names.push(card.name);
    url = page.has_more ? page.next_page : null;
  }

  // Some queries repeat a card across pages; count what is distinct.
  return { names: [...new Set(names)], pages, truncated: Boolean(url) };
}

// Returns { templates: {id: name}, templateCards: {cardKey: [id, ...]}, stats }.
//
// Published card -> templates rather than template -> cards: the same card
// satisfies a handful of templates, while one template matches thousands of
// cards, so this direction is an order of magnitude smaller and is what the
// page actually asks ("does this card of mine fill that slot?").
// `used`, when given, is the set of template ids some combo actually asks for.
// Spellbook defines templates nothing uses — "Nonartifact creature with MV <= 5"
// is 14,368 cards across 83 pages and no published combo wants it — so resolving
// everything spends about a third of the run on lists that will never be read.
async function resolveTemplates(log = console.log, used = null) {
  const { getJson, stats } = createFetcher();
  const wanted = (t) => !used || used.has(String(t.id));

  log('Looking up Commander Spellbook templates…');
  const all = await allTemplates(getJson);
  const queryable = all.filter((t) => t.scryfallApi);
  const toResolve = queryable.filter(wanted);
  log(`  ${all.length} templates, ${queryable.length} with a Scryfall query, `
    + `${all.length - queryable.length} without`);
  if (used) {
    log(`  ${toResolve.length} of those are asked for by a combo; skipping ${queryable.length - toResolve.length}`);
  }

  const templates = Object.create(null);
  const byCard = new Map();
  const failed = [];
  let resolved = 0;

  // Templates Spellbook gives no query for. Recorded rather than ignored: the
  // daily refresh compares the templates combos ask for against what is known,
  // and without this list all 29 of these would be reported as new every single
  // day. A warning that always fires is one nobody reads.
  const unresolvable = Object.create(null);
  for (const template of all) {
    if (!template.scryfallApi) unresolvable[template.id] = template.name;
  }

  // Queryable, but nothing asked for it. Recorded separately from the
  // unresolvable ones because the difference matters: these *could* be resolved,
  // so if a combo ever starts using one, the refresh has to say "regenerate"
  // rather than treat it as permanently out of reach.
  const skipped = Object.create(null);
  for (const template of queryable) {
    if (!wanted(template)) skipped[template.id] = template.name;
  }

  for (const template of toResolve) {
    let result;
    try {
      result = await resolveOne(getJson, template);
    } catch (err) {
      // One template failing is not worth abandoning the refresh over. It ends
      // up unresolvable for this run, which excludes the combos needing it —
      // the same outcome as a template with no query at all.
      failed.push({ name: template.name, why: 'HTTP ' + (err.status || '?') });
      continue;
    }
    if (result.truncated) {
      // Never silently ship a partial list: a half-resolved template would
      // quietly under-report combos with no sign anything went wrong.
      failed.push({ name: template.name, why: `over ${MAX_PAGES} pages` });
      continue;
    }
    if (!result.names.length) continue; // query returns nothing; not an error

    resolved += 1;
    templates[template.id] = template.name;
    for (const name of result.names) {
      const key = DeckCombos.nameKey(name);
      let ids = byCard.get(key);
      if (!ids) byCard.set(key, (ids = []));
      ids.push(template.id);
    }
  }

  const templateCards = Object.create(null);
  for (const [key, ids] of byCard) templateCards[key] = ids.sort((a, b) => a - b);

  log(`  resolved ${resolved} template(s) into ${byCard.size} distinct cards `
    + `(${stats.requests} requests, ${stats.retries} retried)`);
  if (failed.length) {
    log(`  ${failed.length} template(s) could not be resolved and stay excluded:`);
    for (const f of failed) log(`    ${f.name} — ${f.why}`);
  }

  return { templates, unresolvable, skipped, templateCards, stats: { ...stats, resolved, failed } };
}

// Which template ids any published combo actually asks for. Read from the
// published combos.json rather than Spellbook's 578 MB export: the ids are
// Spellbook's own, carried through untouched, so this is the same answer for a
// fraction of the download. No circularity — the ids come from the combo data,
// never from templates.json.
async function usedTemplateIds(log = console.log) {
  const { getJson } = createFetcher();
  log('Reading which templates the published combos ask for…');
  const data = await getJson(COMBOS_URL);
  const combos = data.combos || [];
  if (combos.length < 1000) {
    throw new Error(`combos.json held ${combos.length} combos — refusing to decide what to skip from that`);
  }

  const used = new Set();
  for (const combo of combos) {
    for (const id of combo.t || []) if (id !== null) used.add(String(id));
  }
  log(`  ${used.size} distinct template(s) are asked for across ${combos.length.toLocaleString()} combos`);
  return used;
}

module.exports = { resolveTemplates, usedTemplateIds, MAX_PAGES };

// Regenerating is a manual job, not part of the daily refresh: templates change
// when a set ships, a few times a year, and re-resolving all 149 every night to
// learn that nothing moved costs 23 minutes and 465 requests for no answer. The
// daily run instead reports templates it has never seen, which is free — the
// combo export already names the ones every combo needs.
if (require.main === module) {
  const args = process.argv.slice(2);
  // --all resolves every queryable template, including the ones no combo asks
  // for. Only useful for measuring; the published file has no use for them.
  const all = args.includes('--all');
  const out = args.find((a) => !a.startsWith('--'))
    || require('node:path').join(__dirname, '..', 'templates.json');

  (all ? Promise.resolve(null) : usedTemplateIds())
    .then((used) => resolveTemplates(console.log, used))
    .then(({ templates, unresolvable, skipped, templateCards, stats }) => {
      // A file written from a run that lost templates to a 503 would look
      // complete and quietly exclude their combos until someone regenerated it
      // again. Write all of it or none of it.
      if (stats.failed.length) {
        console.error(`\n${stats.failed.length} template(s) failed to resolve, so nothing was written:`);
        for (const f of stats.failed) console.error(`  ${f.name} — ${f.why}`);
        console.error('\nRe-run the workflow; these are usually transient.');
        process.exit(1);
      }

      const payload = {
        generatedAt: new Date().toISOString(),
        source: TEMPLATES_URL,
        templates,
        unresolvable,
        skipped,
        cards: templateCards,
      };
      require('node:fs').writeFileSync(out, JSON.stringify(payload, null, 0) + '\n');
      const mb = (require('node:fs').statSync(out).size / 1024 / 1024).toFixed(2);
      console.log(`\nWrote ${out}: ${Object.keys(templates).length} resolved, `
        + `${Object.keys(unresolvable).length} with no query, `
        + `${Object.keys(skipped).length} unused and skipped, `
        + `${Object.keys(templateCards).length} cards, ${mb} MB`);
    })
    .catch((err) => {
      console.error('Template resolution failed:', err.message);
      process.exit(1);
    });
}
