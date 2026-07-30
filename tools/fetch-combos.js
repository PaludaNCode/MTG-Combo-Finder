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

// The bulk export their own frontend reads (see commander-spellbook-site,
// src/pages/combo-sitemap.xml.ts). One request for the whole database.
//
// Paging /variants instead does not work: it needs ~300 requests and their
// rate limit is a cumulative quota, not a per-second throttle. Walking it at
// 4 req/s died after 120 pages; slowing to 1 req/s died *earlier*, at 78, and
// two full minutes of backoff never cleared it. Don't reintroduce paging.
const BULK_URL = 'https://json.commanderspellbook.com/variants.json';
const OUT = process.argv[2] || path.join(__dirname, '..', 'combos.json');

const USER_AGENT = 'MTG-Combo-Finder (github.com/PaludaNCode/MTG-Combo-Finder)';
const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// The bulk export is over 512 MB, which is past the longest string V8 will
// build — res.json() dies with "Cannot create a string longer than
// 0x1fffffe8 characters". So walk the bytes instead and hand back one variant
// object at a time, keeping only the object currently being read in memory.
//
// Written by hand because this project has no dependencies. It tracks string
// state and escapes, so braces inside card names and rules text don't
// desynchronize the object boundaries.
function createVariantScanner(onVariant) {
  let buf = '';
  let pos = 0; // how far into buf the state machine has already run
  let started = false;
  let finished = false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objStart = -1;

  return function push(chunk) {
    if (finished) return;
    buf += chunk;

    if (!started) {
      // Enter the array that holds the variants.
      const key = buf.indexOf('"variants"');
      const bracket = key === -1 ? -1 : buf.indexOf('[', key);
      if (bracket === -1) {
        // Keep a tail in case the key straddles a chunk boundary, but never
        // discard a key we have already found.
        if (key === -1 && buf.length > 4096) buf = buf.slice(-1024);
        return;
      }
      started = true;
      buf = buf.slice(bracket + 1);
      pos = 0;
    }

    // Resume where the last chunk left off; rescanning already-consumed
    // characters would double-apply the string and depth transitions.
    for (let i = pos; i < buf.length; i++) {
      const ch = buf[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') { if (depth === 0) objStart = i; depth += 1; continue; }
      if (ch === '}') {
        depth -= 1;
        if (depth === 0 && objStart !== -1) {
          onVariant(JSON.parse(buf.slice(objStart, i + 1)));
          buf = buf.slice(i + 1); // everything left is unscanned again
          objStart = -1;
          pos = 0;
          i = -1;
        }
        continue;
      }
      if (ch === ']' && depth === 0) { finished = true; buf = ''; return; }
    }
    pos = buf.length;

    // Between objects there is only whitespace and commas worth discarding;
    // mid-object the buffer must be kept until the closing brace arrives.
    if (depth === 0 && objStart === -1) {
      const trimmed = buf.replace(/^[\s,]+/, '');
      pos = Math.max(0, pos - (buf.length - trimmed.length));
      buf = trimmed;
    }
  };
}

async function streamVariants(url, onVariant, attempt = 1) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX_ATTEMPTS) {
      throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
    }
    const wait = Math.min(MAX_BACKOFF_MS, 2 ** attempt * 1000);
    console.warn(`  HTTP ${res.status} — waiting ${wait / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})`);
    await sleep(wait);
    return streamVariants(url, onVariant, attempt + 1);
  }

  const push = createVariantScanner(onVariant);
  const decoder = new TextDecoder('utf-8');
  let bytes = 0;
  for await (const chunk of res.body) {
    bytes += chunk.length;
    push(decoder.decode(chunk, { stream: true }));
  }
  push(decoder.decode());
  return bytes;
}

async function main() {
  console.log('Downloading the combo database from', BULK_URL);

  const combos = [];
  const cardIdentity = Object.create(null);
  let seen = 0;

  const bytes = await streamVariants(BULK_URL, (variant) => {
    seen += 1;
    const row = compact(variant);
    if (row) combos.push(row);
    for (const u of pick(variant, 'uses') || []) {
      const card = u.card;
      if (card && card.name && card.identity !== undefined) {
        cardIdentity[card.name] = card.identity || '';
      }
    }
    if (seen % 5000 === 0) console.log(`  ${seen} variants read…`);
  });
  console.log(`  read ${seen} variants from ${(bytes / 1024 / 1024).toFixed(0)} MB`);

  if (!combos.length) throw new Error('No combos parsed — refusing to write an empty file');

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

module.exports = { createVariantScanner, compact };

if (require.main === module) {
  main().catch((err) => {
    console.error('Fetch failed:', err.message);
    if (err.status === 404) {
      console.error(`${BULK_URL} is gone — check what commander-spellbook-site fetches now.`);
    }
    process.exit(1);
  });
}
