#!/usr/bin/env node
// Pulls the whole Commander Spellbook combo database and writes a compact
// combos.json for the page to match against locally.
//
// Why this exists: their API only accepts browser requests from
// commanderspellbook.com and localhost (CORS_ALLOWED_ORIGIN_REGEXES in their
// production settings), so the deployed page can never call it. A GitHub Action
// has no such restriction — server-to-server requests aren't subject to CORS —
// so we fetch here and publish the result as data, the same way MTG-Pricerunner
// publishes its price data.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const API = 'https://backend.commanderspellbook.com/variants';
const PAGE_SIZE = 100; // CustomPagination.max_limit
const OUT = process.argv[2] || path.join(__dirname, '..', 'combos.json');
const MAX_PAGES = Number(process.env.MAX_PAGES || 0); // 0 = no cap; set for smoke tests

// Commander Spellbook rate-limits, and rightly so — this walks their whole
// database. Pace the requests deliberately rather than going as fast as the
// runner allows, and back off for a long time when asked to.
// The first run sped up to ~4 requests/second once their cache warmed and was
// rate-limited at ~12,000 combos. Hold to roughly one request per second.
const DELAY_MS = Number(process.env.DELAY_MS || 750);
const MAX_ATTEMPTS = 8;
const MAX_BACKOFF_MS = 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, attempt = 1) {
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'MTG-Combo-Finder (github.com/PaludaNCode/MTG-Combo-Finder)' },
    });
  } catch (networkErr) {
    if (attempt >= MAX_ATTEMPTS) throw networkErr;
    const wait = Math.min(MAX_BACKOFF_MS, 2 ** attempt * 1000);
    console.warn(`  network retry ${attempt}/${MAX_ATTEMPTS} in ${wait}ms (${networkErr.message})`);
    await sleep(wait);
    return getJson(url, attempt + 1);
  }

  if (res.ok) return res.json();

  const retryable = res.status === 429 || res.status >= 500;
  if (!retryable || attempt >= MAX_ATTEMPTS) {
    throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
  }

  // Honour Retry-After when the server tells us how long to wait; otherwise
  // exponential backoff, capped high enough to actually outlast a rate limit.
  const retryAfter = Number(res.headers.get('retry-after'));
  const wait = Number.isFinite(retryAfter) && retryAfter > 0
    ? Math.min(MAX_BACKOFF_MS, retryAfter * 1000)
    : Math.min(MAX_BACKOFF_MS, 2 ** attempt * 1000);
  console.warn(`  HTTP ${res.status} — waiting ${(wait / 1000).toFixed(0)}s (attempt ${attempt}/${MAX_ATTEMPTS})`);
  await sleep(wait);
  return getJson(url, attempt + 1);
}

// The API renders camelCase (CamelCaseJSONRenderer), but tolerate snake_case
// too so a change on their side degrades rather than silently empties the file.
const pick = (obj, ...names) => {
  for (const n of names) if (obj && obj[n] !== undefined) return obj[n];
  return undefined;
};

function compact(variant) {
  const uses = pick(variant, 'uses') || [];
  const cards = uses.map((u) => u.card && u.card.name).filter(Boolean);
  if (!cards.length) return null;

  // Templates ("any sacrifice outlet") aren't concrete cards; a combo needing
  // one can't be completed by naming a single card, so record the count and let
  // the client leave those out of suggestions.
  const templates = (pick(variant, 'requires') || []).length;

  const produces = (pick(variant, 'produces') || [])
    .map((p) => (p.feature && p.feature.name) || p.name)
    .filter(Boolean);

  return {
    id: String(pick(variant, 'id') || ''),
    c: cards,
    p: produces,
    i: pick(variant, 'identity') || '',
    t: templates || undefined,
    pop: pick(variant, 'popularity') || undefined,
  };
}

async function main() {
  const combos = [];
  const cardIdentity = Object.create(null);
  let url = `${API}?limit=${PAGE_SIZE}&offset=0`;
  let pages = 0;

  console.log('Fetching combos from Commander Spellbook…');
  while (url) {
    const page = await getJson(url);
    const results = page.results || [];
    for (const variant of results) {
      const row = compact(variant);
      if (row) combos.push(row);
      for (const u of pick(variant, 'uses') || []) {
        const card = u.card;
        if (card && card.name && card.identity !== undefined) {
          cardIdentity[card.name] = card.identity || '';
        }
      }
    }
    pages += 1;
    if (pages % 25 === 0) console.log(`  ${pages} pages, ${combos.length} combos…`);
    if (MAX_PAGES && pages >= MAX_PAGES) {
      console.log(`  stopping early at ${MAX_PAGES} pages (MAX_PAGES set)`);
      break;
    }
    url = page.next || null;
    if (!results.length) break;
    if (url) await sleep(DELAY_MS);
  }

  if (!combos.length) throw new Error('No combos fetched — refusing to write an empty file');

  const payload = {
    updatedAt: new Date().toISOString(),
    source: 'https://commanderspellbook.com/',
    count: combos.length,
    cardIdentity,
    combos,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload));
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${OUT}: ${combos.length} combos, ${Object.keys(cardIdentity).length} cards, ${mb} MB`);
}

main().catch((err) => {
  console.error('Fetch failed:', err.message);
  if (err.status === 429) {
    console.error('Rate limited by Commander Spellbook even after backing off.');
    console.error('Re-run later, or slow the walk down further with DELAY_MS=1500.');
  }
  process.exit(1);
});
