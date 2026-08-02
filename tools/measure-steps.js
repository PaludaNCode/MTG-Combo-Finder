#!/usr/bin/env node
// How big are the combo steps really, and what is the right way to publish them?
//
// F7 wants to show a combo's prerequisites and steps. Those live in Spellbook's
// bulk export and `compact()` throws them away, so the only figure this project
// has ever had for them is an extrapolation from a single combo: ~320 characters
// times 103,737, call it 30 MB. Every design question downstream — how many
// shards, how big a shard, whether SQLite-over-HTTP earns its keep — turns on a
// number nobody has measured.
//
// So: one pass over the export, then every scenario measured off it. Streaming
// 578 MB is the expensive part and it happens once; the analysis afterwards is
// arithmetic over a temp file.
//
//   node tools/measure-steps.js [--keep]
//
// Runs in CI, because their hosts are unreachable from a developer machine and a
// runner streams this same export nightly. On demand rather than scheduled: it
// asks a live third party a large question, and nothing here should depend on
// their uptime.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { streamVariants, BULK_URL } = require('./fetch-combos.js');

// What the panel would actually publish per combo. Deliberately not the whole
// variant: measuring fields we would never ship would answer a question nobody
// asked.
function stepsOf(variant) {
  const steps = String(variant.description || '').trim();
  const notable = String(variant.notablePrerequisites || '').trim();
  const easy = String(variant.easyPrerequisites || '').trim();
  const mana = String(variant.manaNeeded || '').trim();
  if (!steps && !notable && !easy) return null;
  const row = { s: steps };
  if (notable) row.n = notable;
  if (easy) row.e = easy;
  if (mana) row.m = mana;
  return row;
}

const mb = (bytes) => (bytes / 1048576).toFixed(2) + ' MB';
const kb = (bytes) => (bytes / 1024).toFixed(1) + ' KB';

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const at = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[at];
}

// Two candidate ways to decide which file a combo's steps live in. Both have to
// be computable by the reader from the combo id alone — the whole reason sharding
// beats an index is that no lookup table has to be downloaded first.
const byHash = (id, buckets) => (
  crypto.createHash('sha1').update(String(id)).digest()[0]
  + crypto.createHash('sha1').update(String(id)).digest()[1] * 256
) % buckets;
// The cheaper one: combo ids start with a card id, so their leading digits are
// not uniform. Measured rather than assumed — an uneven split wastes the idea.
const byPrefix = (id, buckets) => {
  let sum = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i += 1) sum = (sum * 31 + s.charCodeAt(i)) >>> 0;
  return sum % buckets;
};

function shardReport(rows, buckets, pick, label) {
  const files = new Map();
  for (const row of rows) {
    const at = pick(row.id, buckets);
    if (!files.has(at)) files.set(at, []);
    files.get(at).push(row);
  }
  const sizes = [];
  let raw = 0;
  let gz = 0;
  for (const [, group] of files) {
    const text = JSON.stringify(Object.fromEntries(group.map((r) => [r.id, r.body])));
    const g = zlib.gzipSync(Buffer.from(text)).length;
    sizes.push(g);
    raw += text.length;
    gz += g;
  }
  sizes.sort((a, b) => a - b);
  return {
    label,
    buckets,
    files: files.size,
    raw,
    gz,
    min: sizes[0] || 0,
    median: quantile(sizes, 0.5),
    max: sizes[sizes.length - 1] || 0,
    // How lumpy the split is. 1.0 would be perfectly even; a big number means some
    // readers pay several times what others do for the same action.
    spread: sizes.length ? (sizes[sizes.length - 1] / (quantile(sizes, 0.5) || 1)) : 0,
  };
}

// ---- G: what SQLite would actually cost --------------------------------------
//
// Not a strawman. The claim being tested is that a range-queried SQLite file needs
// several round trips where a shard needs one, so this builds the real database
// and reads its real page geometry rather than asserting anything.
function sqliteReport(rows, dir) {
  let version;
  try {
    version = execFileSync('sqlite3', ['--version'], { encoding: 'utf8' }).trim().split(' ')[0];
  } catch (err) {
    return { skipped: 'sqlite3 is not on this machine' };
  }

  const dbPath = path.join(dir, 'steps.sqlite');
  const sqlPath = path.join(dir, 'steps.sql');
  fs.rmSync(dbPath, { force: true });

  // Written as a script rather than piped row by row: 100k inserts through the CLI
  // one at a time is minutes, and this is measuring the file, not the import.
  const esc = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  const out = fs.createWriteStream(sqlPath);
  out.write('PRAGMA journal_mode=OFF;\nBEGIN;\nCREATE TABLE steps (id TEXT PRIMARY KEY, body TEXT);\n');
  for (const row of rows) out.write(`INSERT INTO steps VALUES(${esc(row.id)},${esc(JSON.stringify(row.body))});\n`);
  out.write('COMMIT;\nVACUUM;\n');
  out.end();

  execFileSync('sqlite3', [dbPath], { input: fs.readFileSync(sqlPath), stdio: ['pipe', 'ignore', 'ignore'] });
  const ask = (sql) => execFileSync('sqlite3', [dbPath, sql], { encoding: 'utf8' }).trim();

  const pageSize = Number(ask('PRAGMA page_size;'));
  const pageCount = Number(ask('PRAGMA page_count;'));
  const size = fs.statSync(dbPath).size;

  // An indexed lookup walks the primary-key B-tree from root to leaf, then reads
  // the row. Depth comes from how many index entries fit on a page: a page holds
  // pageSize/entry cells, so a tree over N rows is log(N) deep at that fanout.
  const idBytes = rows.length
    ? Math.round(rows.reduce((n, r) => n + String(r.id).length, 0) / rows.length)
    : 8;
  const perCell = idBytes + 12; // key + rowid + cell overhead, near enough
  const fanout = Math.max(2, Math.floor(pageSize / perCell));
  const depth = Math.max(1, Math.ceil(Math.log(rows.length || 1) / Math.log(fanout)));
  // Plus the leaf page holding the row itself, plus any overflow pages its text
  // spills onto — a step description is regularly longer than a page.
  const avgBody = rows.length
    ? Math.round(rows.reduce((n, r) => n + JSON.stringify(r.body).length, 0) / rows.length)
    : 0;
  const overflow = Math.max(0, Math.ceil((avgBody - pageSize) / pageSize));
  const trips = depth + 1 + overflow;

  fs.rmSync(sqlPath, { force: true });
  return {
    version, size, pageSize, pageCount, fanout, depth, avgBody, overflow, trips,
    bytesPerLookup: trips * pageSize,
    gz: zlib.gzipSync(fs.readFileSync(dbPath)).length,
  };
}

async function main(argv) {
  const keep = argv.includes('--keep');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'steps-'));
  const jsonl = path.join(dir, 'steps.jsonl');
  const sink = fs.createWriteStream(jsonl);

  console.log(`Streaming ${BULK_URL}`);
  console.log('This reads their whole export once; everything after is arithmetic.\n');

  let seen = 0;
  let withSteps = 0;
  const lengths = [];
  const bytes = await streamVariants(BULK_URL, (variant) => {
    seen += 1;
    const body = stepsOf(variant);
    if (!body) return;
    withSteps += 1;
    const id = String(variant.id || '');
    const line = JSON.stringify({ id, body });
    lengths.push(JSON.stringify(body).length);
    sink.write(line + '\n');
    if (withSteps % 25000 === 0) console.log(`  ${seen} read, ${withSteps} with steps…`);
  });
  await new Promise((r) => sink.end(r));

  const rows = fs.readFileSync(jsonl, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  lengths.sort((a, b) => a - b);
  const total = lengths.reduce((n, v) => n + v, 0);

  const whole = JSON.stringify(Object.fromEntries(rows.map((r) => [r.id, r.body])));
  const wholeGz = zlib.gzipSync(Buffer.from(whole)).length;

  console.log(`\nRead ${seen.toLocaleString()} variants from ${mb(bytes)} of export.\n`);

  console.log('=== A. Coverage ===');
  console.log(`  combos with any steps text   ${withSteps.toLocaleString()} of ${seen.toLocaleString()} (${((withSteps / seen) * 100).toFixed(1)}%)`);
  console.log(`  combos with none             ${(seen - withSteps).toLocaleString()}`);

  console.log('\n=== B. Volume, if published as one file ===');
  console.log(`  steps text, total            ${mb(total)}`);
  console.log(`  as one JSON file             ${mb(whole.length)}`);
  console.log(`  gzipped                      ${mb(wholeGz)}   (${(whole.length / wholeGz).toFixed(1)}:1)`);
  console.log(`  for comparison, combos.json  1.28 MB on the wire`);

  console.log('\n=== C. Distribution, characters per combo ===');
  console.log(`  min ${quantile(lengths, 0)}  median ${quantile(lengths, 0.5)}  p90 ${quantile(lengths, 0.9)}`
    + `  p99 ${quantile(lengths, 0.99)}  max ${lengths[lengths.length - 1]}`);
  console.log(`  mean ${Math.round(total / (withSteps || 1))}`);

  console.log('\n=== D/E. Sharding: how big a file a reader fetches ===');
  console.log('  buckets  strategy  files   median    max     spread   total gz');
  for (const buckets of [64, 128, 256, 512, 1024]) {
    for (const [pick, label] of [[byHash, 'hash  '], [byPrefix, 'prefix']]) {
      const r = shardReport(rows, buckets, pick, label);
      console.log(`  ${String(buckets).padStart(7)}  ${label}  ${String(r.files).padStart(5)}`
        + `  ${kb(r.median).padStart(8)}  ${kb(r.max).padStart(8)}`
        + `  ${r.spread.toFixed(2).padStart(6)}   ${mb(r.gz)}`);
    }
  }

  console.log('\n=== F. What a reader actually pays ===');
  console.log('  Opening one combo fetches one shard. The panel is collapsed by');
  console.log('  default, so a reader who never presses it fetches nothing.');
  for (const buckets of [256, 512]) {
    const r = shardReport(rows, buckets, byHash, 'hash');
    console.log(`  ${buckets} buckets: 1 combo ≈ ${kb(r.median)}, 3 combos ≈ ${kb(r.median * 3)}`
      + ` (worst shard ${kb(r.max)})`);
  }

  console.log('\n=== G. SQLite over HTTP range requests ===');
  const s = sqliteReport(rows, dir);
  if (s.skipped) {
    console.log('  skipped: ' + s.skipped);
  } else {
    console.log(`  sqlite ${s.version}`);
    console.log(`  database file                ${mb(s.size)}  (gzip ${mb(s.gz)}, but range requests read it raw)`);
    console.log(`  page size / count            ${s.pageSize} bytes / ${s.pageCount.toLocaleString()} pages`);
    console.log(`  index fanout                 ${s.fanout} keys per page`);
    console.log(`  B-tree depth over ${rows.length.toLocaleString()} rows  ${s.depth}`);
    console.log(`  average row body             ${s.avgBody} bytes (${s.overflow} overflow page(s))`);
    console.log(`  round trips per lookup       ${s.trips}  →  ${kb(s.bytesPerLookup)} read`);
  }

  console.log('\n=== The comparison ===');
  const best = shardReport(rows, 256, byHash, 'hash');
  console.log(`  sharded JSON   1 request,  ${kb(best.median)} typical`);
  if (!s.skipped) {
    console.log(`  SQLite/range   ${s.trips} requests, ${kb(s.bytesPerLookup)} typical`);
  }

  if (keep) console.log(`\nWorking files kept in ${dir}`);
  else fs.rmSync(dir, { recursive: true, force: true });
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

module.exports = { stepsOf, shardReport, byHash, byPrefix, quantile };
