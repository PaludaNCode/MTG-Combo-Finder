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
const zlib = require('node:zlib');
const { Readable } = require('node:stream');
const TIERS = require('../result-tiers.js');
const { resolveTemplates } = require('./templates.js');

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

// Feature.Status values that mean "internal to variant generation", from
// spellbook/models/feature.py. Everything else is a result worth showing.
const UTILITY_STATUSES = new Set(['HU', 'PU']);
const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Scryfall serves its bulk files as .jsonl.gz — a gzipped *file*, not a
// gzip-Content-Encoded response, so fetch hands back the compressed bytes
// untouched and JSON.parse chokes on the \x1f\x8b header. Sniff the magic
// number rather than trusting the URL or headers, so a body that fetch already
// decompressed is passed straight through.
async function* bodyChunks(res) {
  const iterator = res.body[Symbol.asyncIterator]();

  // Pull until at least two bytes are in hand: a chunk boundary must not be
  // able to hide the magic number and silently skip decompression.
  const parts = [];
  let primed = 0;
  while (primed < 2) {
    const next = await iterator.next();
    if (next.done) break;
    parts.push(Buffer.from(next.value));
    primed += next.value.length;
  }
  if (!parts.length) return;

  const head = parts.length === 1 ? parts[0] : Buffer.concat(parts);
  const rest = async function* () {
    yield head;
    for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
      yield next.value;
    }
  };

  if (!(head.length > 1 && head[0] === 0x1f && head[1] === 0x8b)) {
    yield* rest();
    return;
  }

  const gunzip = zlib.createGunzip();
  const source = Readable.from(rest());
  source.on('error', (err) => gunzip.destroy(err));
  source.pipe(gunzip);
  yield* gunzip;
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

  // Templates ("a Persist Creature") name a property rather than a card. Record
  // *which* templates, not just how many, so the client can ask whether the deck
  // already holds something that fills the slot — see tools/templates.js.
  //
  // A template needed twice means two different cards have to fill it, so the id
  // is repeated: counting occurrences is then all the matching has to do.
  // A requirement with no id is recorded as null rather than skipped. Dropping
  // it would leave the combo looking like it had no slot at all, and the page
  // would show it as complete on the strength of its named cards — the one
  // failure mode worth engineering against here. null matches no template, so
  // the combo stays excluded, which is what an unreadable requirement deserves.
  const templates = [];
  for (const req of pick(variant, 'requires') || []) {
    const template = (req && req.template) || req;
    const id = template && template.id;
    const quantity = Math.max(1, Number(pick(req, 'quantity') || 1));
    for (let i = 0; i < quantity; i += 1) {
      templates.push(id === undefined || id === null ? null : id);
    }
  }

  // Feature.status marks whether a result is player-facing or internal
  // plumbing for variant generation: HU/HIDDEN_UTILITY and PU/PUBLIC_UTILITY
  // are utilities (Feature.is_utility in their models), and listing them turns
  // "Infinite colorless mana" into a wall of scaffolding. Keep everything else.
  const produced = (pick(variant, 'produces') || [])
    .map((p) => ({
      name: (p.feature && p.feature.name) || p.name,
      status: String((p.feature && p.feature.status) || ''),
    }))
    .filter((p) => p.name);
  const meaningful = produced.filter((p) => !UTILITY_STATUSES.has(p.status));
  // If a variant somehow lists nothing but utilities, showing them beats
  // showing a combo with no stated result at all.
  const produces = (meaningful.length ? meaningful : produced).map((p) => p.name);

  return {
    id: String(pick(variant, 'id') || ''),
    c: cards,
    p: produces,
    i: pick(variant, 'identity') || '',
    t: templates.length ? templates : undefined,
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
// `key` names the property holding the array (Commander Spellbook nests the
// variants under "variants"); pass null when the document is a bare array, as
// Scryfall's bulk card file is.
function createVariantScanner(onVariant, key = 'variants') {
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
      // Enter the array that holds the objects.
      let from = 0;
      if (key !== null) {
        const at = buf.indexOf(`"${key}"`);
        if (at === -1) {
          // Keep a tail in case the key straddles a chunk boundary.
          if (buf.length > 4096) buf = buf.slice(-1024);
          return;
        }
        from = at;
      }
      const bracket = buf.indexOf('[', from);
      if (bracket === -1) return;
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

async function streamVariants(url, onVariant, attempt = 1, key = 'variants') {
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
    return streamVariants(url, onVariant, attempt + 1, key);
  }

  const push = createVariantScanner(onVariant, key);
  const decoder = new TextDecoder('utf-8');
  let bytes = 0;
  for await (const chunk of bodyChunks(res)) {
    bytes += chunk.length;
    push(decoder.decode(chunk, { stream: true }));
  }
  push(decoder.decode());
  return bytes;
}

// Colour identity has to come from Scryfall: Commander Spellbook's CardSerializer
// exposes name/images/type_line but not identity, so the combo export alone can't
// tell us whether a suggested card fits the deck's colours. Scryfall's oracle-cards
// bulk file is the canonical source, and is what Commander Spellbook itself uses
// for card data.
// ?format=json is required: without it the endpoint redirects to the data file
// itself, so there is no metadata object to read a download URL out of.
const SCRYFALL_BULK_INDEX = 'https://api.scryfall.com/bulk-data/oracle-cards?format=json';

// JSONL is one card per line, so it needs no brace matching at all.
async function streamJsonLines(url, onObject) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });

  const decoder = new TextDecoder('utf-8');
  let buf = '';
  const flush = (final) => {
    const lines = buf.split('\n');
    buf = final ? '' : lines.pop(); // keep the partial last line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) onObject(JSON.parse(trimmed));
    }
  };
  for await (const chunk of bodyChunks(res)) {
    buf += decoder.decode(chunk, { stream: true });
    flush(false);
  }
  buf += decoder.decode();
  flush(true);
}

// Tokens, emblems and art cards share names with the real cards they come from
// — Scryfall lists a token called "Pippin, Warden of Isengard // Pippin, Warden
// of Isengard" with no colour identity at all. Reducing that to its front face
// lands it on the real card's key and zeroes it, so they are dropped here rather
// than published and worked around later.
const NON_CARD_LAYOUTS = new Set(['token', 'double_faced_token', 'emblem', 'art_series', 'vanguard']);

function isRealCard(card) {
  return Boolean(card) && typeof card.name === 'string' && !NON_CARD_LAYOUTS.has(card.layout);
}

// Whether a card is allowed to be somebody's commander. Needed because the
// commander box is optional: with nothing typed in it, the only way to name a
// deck's commander is to find it among the cards pasted in.
//
// The legality check does most of the work — it rules out tokens, Un-cards and
// anything else in the bulk file that is not a real Commander-legal card — and
// leaves three ways in:
//   * a legendary creature (the ordinary case),
//   * a card whose rules text grants it ("<X> can be your commander"), which is
//     how the Commander-set planeswalkers qualify,
//   * a Background, which is a commander only alongside a "Choose a Background"
//     partner but is one nonetheless.
//
// Only the front face counts for the legendary-creature test. A card like
// Westvale Abbey has "Land // Legendary Creature — Demon" as its combined type
// line, and testing that string as a whole would call the land a commander.
function canBeCommander(card) {
  if (!isRealCard(card)) return false;
  if (!card.legalities || card.legalities.commander !== 'legal') return false;

  const faces = Array.isArray(card.card_faces) ? card.card_faces : [];
  const front = (faces.length ? faces[0].type_line : card.type_line) || '';
  if (/\bLegendary\b/.test(front) && /\bCreature\b/.test(front)) return true;

  const typeLines = [card.type_line].concat(faces.map((f) => f && f.type_line));
  if (typeLines.some((t) => typeof t === 'string' && /\bBackground\b/.test(t))) return true;

  const texts = [card.oracle_text].concat(faces.map((f) => f && f.oracle_text));
  return texts.some((t) => typeof t === 'string' && /can be your commander/i.test(t));
}

async function fetchCardIdentities() {
  console.log('Looking up the Scryfall oracle-cards bulk file…');
  const res = await fetch(SCRYFALL_BULK_INDEX, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw Object.assign(new Error('Scryfall index HTTP ' + res.status), { status: res.status });
  const meta = await res.json();

  const identities = Object.create(null);
  const commanderNames = [];
  let cards = 0;
  const collect = (card) => {
    cards += 1;
    if (!isRealCard(card)) return;
    // color_identity is an array like ["G","U"]; empty means colourless.
    if (Array.isArray(card.color_identity)) {
      identities[card.name] = card.color_identity.join('');
    }
    if (canBeCommander(card)) commanderNames.push(card.name);
  };

  if (meta.jsonl_download_uri) {
    console.log('Streaming card identities (jsonl) from', meta.jsonl_download_uri);
    await streamJsonLines(meta.jsonl_download_uri, collect);
  } else if (meta.download_uri) {
    console.log('Streaming card identities (json array) from', meta.download_uri);
    await streamVariants(meta.download_uri, collect, 1, null); // bare array
  } else {
    throw new Error('Scryfall index had no download URL; keys were: ' + Object.keys(meta).join(', '));
  }

  commanderNames.sort();
  console.log(`  read ${cards} cards, ${Object.keys(identities).length} with a colour identity, ${commanderNames.length} that can be a commander`);
  return { identities, commanderNames };
}

// result-tiers.js is a written-down list, so a result Spellbook adds after it
// was last edited falls to grey without anything going wrong. That is the right
// default, but it should never be a surprise: every data refresh says which
// results are unclassified and how many combos they affect.
function reportUnclassified(combos) {
  const unknown = new Map();
  for (const combo of combos) {
    for (const result of combo.p || []) {
      if (TIERS.tierOf(result).tier === 'other' && !TIERS.OTHER.includes(result)) {
        unknown.set(result, (unknown.get(result) || 0) + 1);
      }
    }
  }
  if (!unknown.size) {
    console.log('All combo results are classified in result-tiers.js.');
    return;
  }
  const rows = [...unknown.entries()].sort((a, b) => b[1] - a[1]);
  const affected = rows.reduce((sum, [, n]) => sum + n, 0);
  console.log(`\n${rows.length} result(s) are not in result-tiers.js and will show as grey (${affected} combos):`);
  for (const [name, n] of rows.slice(0, 40)) console.log(`  ${String(n).padStart(6)}  ${name}`);
  if (rows.length > 40) console.log(`  …and ${rows.length - 40} more`);
  console.log('Add them to result-tiers.js to give them a colour.\n');
}

async function main() {
  console.log('Downloading the combo database from', BULK_URL);

  const combos = [];
  let seen = 0;

  const bytes = await streamVariants(BULK_URL, (variant) => {
    seen += 1;
    const row = compact(variant);
    if (row) combos.push(row);
    if (seen % 25000 === 0) console.log(`  ${seen} variants read…`);
  });
  console.log(`  read ${seen} variants from ${(bytes / 1024 / 1024).toFixed(0)} MB`);

  if (!combos.length) throw new Error('No combos parsed — refusing to write an empty file');

  const { identities: cardIdentity, commanderNames } = await fetchCardIdentities();
  // An empty map silently disables colour filtering in the page, which is how
  // this went unnoticed the first time. Fail loudly instead.
  if (Object.keys(cardIdentity).length < 1000) {
    throw new Error(`Only ${Object.keys(cardIdentity).length} card identities — refusing to publish without colour data`);
  }
  // Same reasoning: too few names would quietly turn commander detection off
  // rather than break, and there are thousands of legal commanders.
  if (commanderNames.length < 500) {
    throw new Error(`Only ${commanderNames.length} possible commanders — refusing to publish, the type data must have moved`);
  }

  reportUnclassified(combos);

  const { templates, templateCards } = await resolveTemplates();
  // Templates come from a separate API, so a change on their side would show up
  // as "no templates" rather than an error — and the only symptom would be
  // combos quietly vanishing again. There are 149 queryable templates; a run
  // that resolves a handful has found a moved endpoint, not a small database.
  const resolvedCount = Object.keys(templates).length;
  if (resolvedCount < 100) {
    throw new Error(`Only ${resolvedCount} templates resolved — refusing to publish, the templates API must have moved`);
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    source: 'https://commanderspellbook.com/',
    count: combos.length,
    cardIdentity,
    commanderNames,
    templates,
    templateCards,
    combos,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload));
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${OUT}: ${combos.length} combos, ${Object.keys(cardIdentity).length} cards, `
    + `${commanderNames.length} commanders, ${resolvedCount} templates over `
    + `${Object.keys(templateCards).length} cards, ${mb} MB`);
}

module.exports = { createVariantScanner, compact, bodyChunks, canBeCommander, isRealCard };

if (require.main === module) {
  main().catch((err) => {
    console.error('Fetch failed:', err.message);
    if (err.status === 404) {
      console.error(`${BULK_URL} is gone — check what commander-spellbook-site fetches now.`);
    }
    process.exit(1);
  });
}
