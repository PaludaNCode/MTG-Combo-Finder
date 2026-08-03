'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { compare, checkShape } = require('../tools/check-snapshot.js');

// The publish gate on the nightly refresh. Worth testing carefully for a reason
// that has nothing to do with how complicated it is: the `data` branch is one
// orphan commit, force-pushed, so a bad snapshot getting through does not leave a
// previous version to go back to. This is the only thing standing between a bad
// morning upstream and the published database.

const row = (id) => ({ id, c: ['Basalt Monolith'], p: ['Infinite colorless mana'], i: 'C' });

function snapshot(n, extra) {
  return Object.assign({
    updatedAt: '2026-08-02T06:48:06.618Z',
    combos: Array.from({ length: n }, (_, i) => row('id-' + i)),
    cardIdentity: Object.fromEntries(Array.from({ length: n }, (_, i) => ['Card ' + i, 'C'])),
    gameChangers: ['Sol Ring'],
    templateCards: { 'Basalt Monolith': [1] },
  }, extra);
}

const fails = (result) => result.failures.join(' | ');

test('an ordinary day passes', () => {
  const { failures } = compare(snapshot(1000), snapshot(995));
  assert.deepStrictEqual(failures, []);
});

test('growth is never a failure', () => {
  const { failures } = compare(snapshot(5000), snapshot(1000));
  assert.deepStrictEqual(failures, []);
});

// 10% of 103,737 is ten thousand combos vanishing overnight. That is not churn.
test('a big drop is refused, and says which count and by how much', () => {
  const { failures } = compare(snapshot(800), snapshot(1000));
  assert.match(fails({ failures }), /combos fell 20\.0%/);
});

test('a drop just inside the limit is allowed', () => {
  const { failures } = compare(snapshot(910), snapshot(1000));
  assert.deepStrictEqual(failures, []);
});

test('the limit is adjustable, because the right number is a judgement', () => {
  assert.deepStrictEqual(compare(snapshot(910), snapshot(1000), { maxDrop: 0.5 }).failures, []);
  assert.match(fails(compare(snapshot(990), snapshot(1000), { maxDrop: 0.005 })), /combos fell/);
});

// Each of these is a whole subsystem going quietly dark rather than loudly wrong:
// no identities means no colour filtering, no Game Changers means every bracket
// check silently downgrades, no template cards means every slot stops resolving.
test('the other three counts are guarded too', () => {
  const previous = snapshot(1000);

  const noIdentity = snapshot(1000, { cardIdentity: {} });
  assert.match(fails(compare(noIdentity, previous)), /card identities fell 100/);

  const noChangers = snapshot(1000, { gameChangers: [] });
  assert.match(fails(compare(noChangers, previous)), /Game Changers fell 100/);

  const noTemplates = snapshot(1000, { templateCards: {} });
  assert.match(fails(compare(noTemplates, previous)), /template cards fell 100/);
});

// The first run on a fresh repository is the one run that must not be blocked by a
// comparison it cannot make.
test('with nothing published yet, it reports and passes', () => {
  const { lines, failures } = compare(snapshot(1000), null);
  assert.deepStrictEqual(failures, []);
  assert.ok(lines.some((l) => /nothing published yet/.test(l)));
});

test('the report names the before, the after and the change', () => {
  const { lines } = compare(snapshot(1200), snapshot(1000));
  assert.ok(lines.some((l) => /combos: 1,000 → 1,200 \(\+200, 20\.0%\)/.test(l)), lines.join('\n'));
});

// ---- shape -----------------------------------------------------------------
//
// A renamed field upstream does not error. It produces rows the page renders as
// blank, and the first report of it is somebody looking at an empty combo.

test('a sound snapshot has nothing to say about its shape', () => {
  assert.deepStrictEqual(checkShape(snapshot(10)), []);
});

test('rows missing what the page reads are counted, by field', () => {
  const data = snapshot(3);
  delete data.combos[0].id;
  data.combos[1].c = [];
  data.combos[2].i = undefined;
  delete data.combos[2].p;
  const problems = checkShape(data).join(' | ');
  assert.match(problems, /1 row\(s\) with no usable `id`/);
  assert.match(problems, /1 row\(s\) with no usable `c`/);
  assert.match(problems, /1 row\(s\) with no usable `i`/);
  assert.match(problems, /1 row\(s\) with no usable `p`/);
});

test('an empty or absent combos array is a shape problem, not a small one', () => {
  assert.match(checkShape({ updatedAt: 'x', combos: [] }).join(' '), /no combos array/);
  assert.match(checkShape({ updatedAt: 'x' }).join(' '), /no combos array/);
});

test('a snapshot with no updatedAt is refused — the footer reads that field', () => {
  const data = snapshot(5);
  delete data.updatedAt;
  assert.match(checkShape(data).join(' '), /no updatedAt/);
});

// The shape check runs as part of compare(), so a well-sized file full of unusable
// rows is caught by the same gate as a small one.
test('shape problems fail the comparison even when every count grew', () => {
  const broken = snapshot(2000);
  for (const r of broken.combos) delete r.p;
  assert.match(fails(compare(broken, snapshot(1000))), /no usable `p`/);
});

// ---- the interned payload --------------------------------------------------
//
// This gate runs on the file as published, where `c` and `p` hold indices into two
// string tables. Refusing to read that shape would mean the check stops working on
// the day the payload changes, which is the day it matters most.

const internedSnapshot = (n, extra) => Object.assign({
  updatedAt: '2026-08-02T06:48:06.618Z',
  names: ['Basalt Monolith'],
  results: ['Infinite colorless mana'],
  combos: Array.from({ length: n }, (_, i) => ({ id: 'id-' + i, c: [0], p: [0], i: 'C' })),
  cardIdentity: Object.fromEntries(Array.from({ length: n }, (_, i) => ['Card ' + i, 'C'])),
  gameChangers: ['Sol Ring'],
  templateCards: { 'Basalt Monolith': [1] },
}, extra);

test('the interned shape passes on its own terms', () => {
  assert.deepStrictEqual(checkShape(internedSnapshot(100)), []);
});

// The failure this is really for. Indices that point past the end of the table
// parse fine, pass a length check, and render as nothing at all.
test('an index that lands nowhere is caught', () => {
  const data = internedSnapshot(3);
  data.combos[0].c = [7];
  data.combos[1].p = [9];
  const problems = checkShape(data).join(' | ');
  assert.match(problems, /1 row\(s\) with no usable `c`/);
  assert.match(problems, /1 row\(s\) with no usable `p`/);
});

// One line, not 103,737 of them: a table going missing takes every row with it.
test('a missing table is reported once', () => {
  const data = internedSnapshot(50);
  delete data.names;
  const problems = checkShape(data).join(' | ');
  assert.match(problems, /rows index a `names` table that is not in the payload/);
});

test('the tables are counted, so one shrinking is noticed', () => {
  const previous = internedSnapshot(1000);
  const next = internedSnapshot(1000, { names: [] });
  assert.match(fails(compare(next, previous)), /interned card names fell 100/);
});

// The first publish of the new shape compares against a payload that has no tables
// at all. Gaining a count is not a regression.
test('gaining the tables is growth, not a drop', () => {
  const previous = snapshot(1000); // plain strings, no tables
  const { failures } = compare(internedSnapshot(1000), previous);
  assert.deepStrictEqual(failures, []);
});

// ---- rows whose id is rebuilt rather than published -------------------------
//
// Most rows now arrive with no `id`: theirs is rebuilt from the `cardIds` table.
// The gate has to tell that apart from a row that genuinely has no link, because
// the second renders as a missing link rather than as an error.

const derivedSnapshot = (n, extra) => Object.assign({
  updatedAt: '2026-08-02T12:50:01.908Z',
  names: ['Basalt Monolith', 'Rings of Brighthearth'],
  results: ['Infinite colorless mana'],
  cardIds: [413, 4559],
  combos: Array.from({ length: n }, () => ({ c: [0, 1], p: [0], i: 'C' })),
  cardIdentity: { 'Basalt Monolith': '' },
  gameChangers: ['Sol Ring'],
  templateCards: { 'Basalt Monolith': [1] },
}, extra);

test('a row with no id is fine when the table can rebuild it', () => {
  assert.deepStrictEqual(checkShape(derivedSnapshot(100)), []);
});

// The failure that matters. No id and no way to build one is a combo whose
// "View on Commander Spellbook" link has nowhere to go.
test('a row with no id and no way to build one is refused', () => {
  const data = derivedSnapshot(3, { cardIds: [413, null] });
  assert.match(checkShape(data).join(' | '), /3 row\(s\) with no usable `id`/);
});

test('the cardIds table going missing is caught, not shrugged at', () => {
  const data = derivedSnapshot(5);
  delete data.cardIds;
  assert.match(checkShape(data).join(' | '), /5 row\(s\) with no usable `id`/);
});

// A row that could not be rebuilt keeps its literal id, and that is the expected
// state for a handful of rows — it must not read as a problem.
test('a literal id still satisfies the check', () => {
  const data = derivedSnapshot(2, { cardIds: [413, null] });
  data.combos.forEach((r, i) => { r.id = 'kept-' + i; });
  assert.deepStrictEqual(checkShape(data), []);
});

test('the derived card ids are counted, so the table shrinking is noticed', () => {
  const previous = derivedSnapshot(1000);
  const next = derivedSnapshot(1000, { cardIds: [413, null] });
  next.combos.forEach((r, i) => { r.id = 'kept-' + i; });
  assert.match(fails(compare(next, previous)), /derived card ids fell 50/);
});

// ---- the steps tree --------------------------------------------------------
//
// The one published thing with no manifest: steps-source.js turns a combo id
// straight into a URL and reads a 404 as "no steps recorded". That is what makes
// the tree cheap, and it is also why nothing downstream can notice it being wrong
// — a reader would press the button, be told there are none, and believe it. This
// gate is the manifest, computed once a night instead of published.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkSteps } = require('../tools/check-snapshot.js');
const StepsSource = require('../steps-source.js');

// A snapshot and a matching tree, built the way the nightly job builds them.
function withSteps(ids, tweak) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-steps-'));
  for (let i = 0; i < StepsSource.BUCKETS; i += 1) {
    fs.mkdirSync(path.join(dir, i.toString(16).padStart(2, '0')), { recursive: true });
  }
  for (const id of ids) {
    fs.writeFileSync(path.join(dir, StepsSource.pathFor(id).slice('steps/'.length)),
      JSON.stringify({ id, description: 'Do the thing.' }));
  }
  const data = { combos: ids.map((id) => ({ id, c: [0], p: [0], i: '' })) };
  if (tweak) tweak(dir, data);
  return { dir, data };
}

const ID_SET = ['1-2', '3-4', '5-6', '7-8', '9-10', '11-12', '13-14', '15-16', '17-18', '19-20'];
const drop = (dir) => fs.rmSync(dir, { recursive: true, force: true });

test('steps: a tree built from the same run passes and reports its coverage', () => {
  const { dir, data } = withSteps(ID_SET);
  const got = checkSteps(dir, data);
  assert.deepStrictEqual(got.failures, []);
  assert.match(got.lines[0], /steps files: 10 for 10 combos \(100\.0%/);
  drop(dir);
});

// Combos with nothing recorded legitimately have no file, so partial coverage is
// normal — right up until it is not.
test('steps: some combos without files is fine, most of them is not', () => {
  const { dir, data } = withSteps(ID_SET, (d, snapshot) => {
    snapshot.combos.push({ id: '99-99', c: [0], p: [0], i: '' });
  });
  assert.deepStrictEqual(checkSteps(dir, data).failures, [], '10 of 11 is a normal day');
  drop(dir);

  const sparse = withSteps(['1-2'], (d, snapshot) => {
    for (let i = 0; i < 20; i += 1) snapshot.combos.push({ id: 'x' + i, c: [0], p: [0], i: '' });
  });
  assert.match(checkSteps(sparse.dir, sparse.data).failures.join(' | '),
    /only 4\.8% of combos have steps.*renamed `description`/);
  drop(sparse.dir);
});

// The failure this is really for: Spellbook renames the field pick() reads, every
// record comes back empty, no file is written, and nothing throws anywhere.
test('steps: an empty tree is caught rather than read as "no combos have steps"', () => {
  const { dir, data } = withSteps([], (d, snapshot) => {
    snapshot.combos = ID_SET.map((id) => ({ id, c: [0], p: [0], i: '' }));
  });
  assert.match(checkSteps(dir, data).failures.join(' | '), /only 0\.0% of combos have steps/);
  drop(dir);
});

test('steps: no tree at all is a refusal, not a pass', () => {
  assert.match(checkSteps('/nonexistent/steps', { combos: [] }).failures.join(' | '),
    /no steps tree at/);
});

// A file in the wrong bucket is a file no reader will ever look in. It is not
// corrupt, it is not missing, and it is unreachable — which is why the check is
// against pathFor() rather than against the file merely existing somewhere.
test('steps: a file in a bucket the reader will not look in is caught', () => {
  const { dir, data } = withSteps(ID_SET, (d) => {
    const from = path.join(d, StepsSource.pathFor('1-2').slice('steps/'.length));
    const wrong = StepsSource.bucketOf('1-2') === 0 ? '01' : '00';
    fs.renameSync(from, path.join(d, wrong, '1-2.json'));
  });
  assert.match(checkSteps(dir, data).failures.join(' | '), /bucket no reader will look in/);
  drop(dir);
});

test('steps: a truncated file is caught rather than published', () => {
  const { dir, data } = withSteps(ID_SET, (d) => {
    fs.writeFileSync(path.join(d, StepsSource.pathFor('1-2').slice('steps/'.length)), '{"id":"1-2","des');
  });
  assert.match(checkSteps(dir, data).failures.join(' | '), /could not be read as JSON/);
  drop(dir);
});

// The reader refuses a record whose id disagrees with its URL, so this does not
// show anyone the wrong combo — it shows them nothing, permanently and silently.
test('steps: a record stamped with the wrong id is caught', () => {
  const { dir, data } = withSteps(ID_SET, (d) => {
    fs.writeFileSync(path.join(d, StepsSource.pathFor('1-2').slice('steps/'.length)),
      JSON.stringify({ id: '3-4', description: 'Someone else\'s.' }));
  });
  assert.match(checkSteps(dir, data).failures.join(' | '), /id that is not their filename/);
  drop(dir);
});

// Two published things from one run. A file for a combo today's snapshot does not
// have means the tree was not rebuilt beside it, and that is the only way these
// two can drift apart.
test('steps: a file for a combo not in this snapshot means the two are out of step', () => {
  const { dir, data } = withSteps(ID_SET, (d, snapshot) => {
    snapshot.combos = snapshot.combos.filter((row) => row.id !== '19-20');
  });
  assert.match(checkSteps(dir, data).failures.join(' | '), /not in this snapshot: steps\/\w\w\/19-20\.json/);
  drop(dir);
});

// Rows normally carry no id — theirs is rebuilt from the card-id table — so the
// gate has to look for the same id the page will, or every file reads as an orphan.
test('steps: ids are rebuilt the way the page rebuilds them', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-steps-'));
  for (let i = 0; i < StepsSource.BUCKETS; i += 1) {
    fs.mkdirSync(path.join(dir, i.toString(16).padStart(2, '0')), { recursive: true });
  }
  fs.writeFileSync(path.join(dir, StepsSource.pathFor('11-22').slice('steps/'.length)),
    JSON.stringify({ id: '11-22', description: 'Do the thing.' }));
  // No `id` on the row: 11 and 22 are the card ids, ascending, joined.
  const data = { combos: [{ c: [0, 1], p: [0], i: '' }], cardIds: [22, 11] };
  assert.deepStrictEqual(checkSteps(dir, data).failures, []);
  drop(dir);
});

// ---- the wire size ----------------------------------------------------------
//
// The gate checked counts and row shapes and not the one number this project has spent
// the most effort on. Interning and dropping the derivable combo id took the payload
// from 2.73 MB to 1.28 MB on the wire, the download is still 94% of a cold search on a
// phone, and one field creeping back into compact() would undo all of it with every
// other check green — the only symptom being on somebody else's phone.

const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { checkWireSize, WIRE_CEILING_BYTES } = require('../tools/check-snapshot.js');

// A file that will not compress, so its size on the wire is about its size on disk and
// the assertions below are about the ceiling rather than about gzip. Genuinely random
// bytes, because a *pattern* is not enough: the first version of this helper used
// `(i * 2654435761) % 256`, which reduces to `(i * 177) % 256` — period 256, and gzip
// took 200 KB of it under 50 KB and failed the test that was meant to fail.
function fileOf(bytes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wire-'));
  const file = path.join(dir, 'combos.json');
  fs.writeFileSync(file, crypto.randomBytes(bytes));
  return file;
}

test('a payload under the ceiling passes and reports its size', () => {
  const out = checkWireSize(fileOf(1024), 50_000);
  assert.deepStrictEqual(out.failures, []);
  assert.match(out.lines[0], /MB gzipped on the wire \(ceiling 0\.05 MB\)/);
});

test('a payload over the ceiling is refused, and named as a shape change', () => {
  const out = checkWireSize(fileOf(200_000), 50_000);
  assert.strictEqual(out.failures.length, 1);
  // The message has to point at the likely cause. "Too big" is not actionable; "a
  // field came back into compact()" is where somebody should actually look.
  assert.match(out.failures[0], /past the 0\.05 MB ceiling/);
  assert.match(out.failures[0], /field creeping back into compact\(\)/);
  assert.match(out.failures[0], /raise WIRE_CEILING_BYTES deliberately/);
});

// The distinction that makes this safe to run unattended. A compressed length depends
// on the encoder, so pinning today's figure would be a gate that goes red on a Node
// upgrade. A ceiling with headroom cannot.
test('the ceiling is a ceiling, not an equality, and has real headroom', () => {
  const file = fileOf(64);
  const measured = checkWireSize(file, WIRE_CEILING_BYTES).wire;
  assert.ok(measured < WIRE_CEILING_BYTES);
  // Against the live payload's ~1.28 MB on the wire. Enough room for a different zlib
  // and a normal day's growth, not enough for a field coming back.
  assert.ok(WIRE_CEILING_BYTES > 1_300_000, 'no headroom over the live payload');
  assert.ok(WIRE_CEILING_BYTES < 2_000_000, 'so much headroom it would never fire');
});

test('what it measures is the bytes on the wire, not the file on disk', () => {
  const file = fileOf(120_000);
  const raw = fs.statSync(file).size;
  const out = checkWireSize(file, WIRE_CEILING_BYTES);
  assert.notStrictEqual(out.wire, raw, 'gzip has to have been applied');
  assert.strictEqual(out.wire, zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length);
});
