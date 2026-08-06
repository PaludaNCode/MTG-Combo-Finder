'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const DeckCombos = require('../combos.js');
const StepsSource = require('../steps-source.js');
const { takeFixtureFlag } = require('../tools/fetch-combos.js');

// The whole publisher, end to end, over a canned export.
//
// `tools/fetch-combos.js` was by a wide margin the least-covered code in this
// repository, and it is the only code here that force-pushes a branch, unattended, at
// 04:17. Everything *downstream* of it was well guarded — check-snapshot.js has its own
// suite, the publish gate checks four counts and every row's shape, `--steps` walks
// every file against StepsSource.pathFor() — and none of that watched the code that
// produces the thing the gate inspects. A payload can satisfy every gate and still be
// wrong in the one way that matters, which is a permalink that resolves and shows a
// different combo.
//
// So this runs the real CLI, the way CI runs it, and asserts on what comes out the far
// side of DeckCombos.decode() — not on the raw file. Decoding is the reader's view, and
// a payload that parses but decodes wrong is exactly the failure this is for.
//
// No network: `--fixture` replaces both third parties. See test/fixtures/export.json for
// what each variant in it is there to prove, and .github/workflows/peek-variant.yml for
// what re-checks that the shape is still Spellbook's.

const FIXTURE = path.join(__dirname, 'fixtures', 'export.json');
const TOOL = path.join(__dirname, '..', 'tools', 'fetch-combos.js');

// One run, shared by every assertion below. The tool reads templates.json and the tier
// inventory on the way through, so this is the slowest thing in the unit suite by some
// margin — a second of it is fine, nine seconds of it is not.
let out = null;
let published = null;
let decoded = null;
let stepsDir = null;
let log = '';

test.before(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'combo-fixture-'));
  out = path.join(dir, 'combos.json');
  stepsDir = path.join(dir, 'steps');
  log = execFileSync(process.execPath, [TOOL, out, stepsDir, '--fixture', FIXTURE], {
    encoding: 'utf8',
    // Their own stderr is where the interesting refusals go, and a fixture run should
    // produce none — a non-zero exit throws out of execFileSync and fails the test.
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  published = JSON.parse(fs.readFileSync(out, 'utf8'));
  decoded = DeckCombos.decode(JSON.parse(fs.readFileSync(out, 'utf8')));
});

// ---- the payload ------------------------------------------------------------

test('fixture: the run says it read no network', () => {
  assert.match(log, /Reading a fixture export from .*export\.json — no network/);
});

test('fixture: a variant with no cards is dropped, not published empty', () => {
  // Nine variants in, eight rows out. compact() returns null for the one with no
  // `uses`, and a row with no cards would be a combo nobody can assemble.
  assert.match(log, /read 9 variants from the fixture/);
  assert.strictEqual(published.count, 8);
  assert.strictEqual(decoded.combos.length, 8);
});

test('fixture: every published row carries cards and a result', () => {
  for (const combo of decoded.combos) {
    assert.ok(combo.c.length, `${combo.id} has no cards`);
    assert.ok(combo.p.length, `${combo.id} has no result`);
  }
});

// ---- the ids, which is the part worth engineering against -------------------
//
// A wrong permalink is the one failure this project has decided is worth real effort:
// a link that works and shows a different combo is invisible to every other check.
// So the fetcher only drops a row's id after rebuilding it and confirming it matches,
// and anything it cannot rebuild keeps the literal one.

test('fixture: every id survives the round trip byte-identical', () => {
  assert.deepStrictEqual(decoded.combos.map((c) => c.id), [
    '101-202', '101-303', '202-303', '101-202--7', '101-303--9', '606-707',
    '101-404', '303-404',
  ]);
});

test('fixture: the rebuildable ids are actually dropped from the file', () => {
  // The point of the exercise. If these were still in the payload the round trip
  // above would pass while the wire cost stayed where it was.
  const carried = published.combos.filter((c) => c.id !== undefined).length;
  assert.strictEqual(carried, 2, 'only the two unrebuildable rows should carry an id');
  assert.match(log, /derived 4 card ids; 2 combo\(s\) kept a literal id/);
});

test('fixture: a row whose template id is missing keeps its literal id', () => {
  // compact() records an unreadable requirement as null on purpose, and null must
  // never become a 0 in a URL — so the row cannot be rebuilt and keeps what it came
  // with. This is the case that makes "rebuild, then check" worth the code.
  const row = published.combos.find((c) => c.id === '101-303--9');
  assert.ok(row, 'the row with a null template must still carry its id');
  assert.deepStrictEqual(decoded.combos.find((c) => c.id === '101-303--9').t, [null]);
});

test('fixture: a row with an unsolvable card keeps its literal id', () => {
  // Two cards that appear in no other combo, so the intersection never narrows to
  // one candidate. Their ids are published as null rather than guessed at.
  const row = published.combos.find((c) => c.id === '606-707');
  assert.ok(row, 'the row with unsolved cards must still carry its id');
  const alpha = published.names.indexOf('Fixture Only Alpha');
  assert.strictEqual(published.cardIds[alpha], null);
});

test('fixture: a solved card id is published, aligned to the names table', () => {
  const at = published.names.indexOf('Rings of Brighthearth');
  assert.strictEqual(published.cardIds[at], 202);
  assert.strictEqual(published.cardIds.length, published.names.length,
    'cardIds is indexed by card index, so it has to be the same length as names');
});

// ---- interning --------------------------------------------------------------

test('fixture: a card in several combos is one entry in the names table', () => {
  const uses = published.names.filter((n) => n === 'Basalt Monolith');
  assert.strictEqual(uses.length, 1);
  // And it really is stored as an index, not written out per row.
  const raw = published.combos.find((c, i) => i === 0);
  assert.ok(raw.c.every((v) => typeof v === 'number'), 'c should hold indices');
});

test('fixture: a repeated result is one entry in the results table', () => {
  assert.strictEqual(published.results.filter((r) => r === 'Infinite colorless mana').length, 1);
  assert.match(log, /interned 6 card names and 6 results/);
});

test('fixture: decode resolves both tables and leaves them behind', () => {
  assert.strictEqual(decoded.names, undefined);
  assert.strictEqual(decoded.results, undefined);
  assert.ok(decoded.combos.every((c) => c.c.every((n) => typeof n === 'string')));
});

// ---- what compact() keeps and throws away ----------------------------------

test('fixture: utility-only results are shown rather than leaving a row blank', () => {
  const row = decoded.combos.find((c) => c.id === '101-404');
  assert.deepStrictEqual(row.p, ['Mana to spend on nothing', 'Internal scaffolding']);
});

test('fixture: a utility alongside a real result is dropped', () => {
  const row = decoded.combos.find((c) => c.id === '303-404');
  assert.deepStrictEqual(row.p, ['Infinite creature tokens']);
});

test('fixture: a template slot survives to the payload', () => {
  assert.deepStrictEqual(decoded.combos.find((c) => c.id === '101-202--7').t, [7]);
});

test('fixture: popularity is carried when present and absent when not', () => {
  assert.strictEqual(decoded.combos.find((c) => c.id === '101-202').pop, 412);
  assert.strictEqual(decoded.combos.find((c) => c.id === '202-303').pop, undefined);
});

// ---- the steps tree, published in the same pass ----------------------------

test('fixture: steps land at the path the reader will ask for', () => {
  // The tree has no manifest by design — the id *is* the URL — so the only thing
  // that can keep both ends in step is computing the path from the same module.
  for (const id of ['101-202', '101-303']) {
    const rel = StepsSource.pathFor(id).slice('steps/'.length);
    const file = path.join(stepsDir, rel);
    assert.ok(fs.existsSync(file), `${id}: expected steps at ${rel}`);
    assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).id, id);
  }
});

test('fixture: a combo with nothing to say gets no file, and the log says how many', () => {
  // A 404 is how "no steps recorded" is published, so the absence is the answer.
  const rel = StepsSource.pathFor('202-303').slice('steps/'.length);
  assert.ok(!fs.existsSync(path.join(stepsDir, rel)));
  assert.match(log, /6 combo\(s\) had no prerequisites and no steps/);
});

test('fixture: no id in the fixture is rejected as an unsafe filename', () => {
  // If this fires, the fixture has an id that Spellbook would never send — which is
  // worth knowing, because deriveCardIds() reads an id as the card ids in it and a
  // made-up one silently unsolves every card in its row.
  assert.doesNotMatch(log, /not safe as filenames/);
});

// ---- the gates that did and did not run ------------------------------------

test('fixture: the card-identity floor is skipped, and says so', () => {
  // The floor is about a Scryfall stream coming back thin. A fixture never made that
  // request, so requiring a thousand identities in one would be 990 rows of noise for
  // a check on something that did not happen — but a reader of the log has to be able
  // to tell which gates ran.
  assert.match(log, /the 1,000 floor is not applied/);
  assert.ok(Object.keys(published.cardIdentity).length < 1000);
});

test('fixture: colour identities and Game Changers come through', () => {
  assert.strictEqual(published.cardIdentity['Scurry Oak'], 'G');
  assert.strictEqual(published.cardIdentity['Basalt Monolith'], '');
  // Sorted the same way the live path sorts, or a fixture would pin an order the
  // real thing does not produce.
  assert.deepStrictEqual(published.gameChangers, ['Basalt Monolith', 'Rings of Brighthearth']);
});

// The ban list travels the same path as the Game Changers above — published as its own
// field, empty published as empty — and the page reads a missing one as "cannot say".
// Scurry Oak is not banned in Commander; which cards are is Scryfall's business, and a
// fixture that pinned the real list would be a second copy of it going stale here.
test('fixture: the ban list comes through as its own field', () => {
  assert.deepStrictEqual(published.banned, ['Scurry Oak']);
  assert.match(log, /banned/i);
});

// The two land lists travel the same path, and the page reads a missing one as "cannot
// say" rather than as a deck with no lands in it. Two lists rather than a flag per card
// because a deck with no basics and a payload with no basic list both come out as 0,
// and the strip has to be able to tell them apart — so the fixture holds a land that is
// not a basic, which one list could never express.
test('fixture: the land lists come through as their own fields', () => {
  assert.deepStrictEqual(published.lands, ['Island', 'Snow-Covered Island']);
  assert.deepStrictEqual(published.basicLands, ['Island']);
  // Not a subset of the lands but the complement of them: a card whose front face is
  // something you cast and whose back is a land is published here and nowhere else.
  assert.deepStrictEqual(published.mdfc, ['Bala Ged Recovery // Bala Ged Sanctuary']);
  assert.ok(!published.lands.includes('Bala Ged Recovery // Bala Ged Sanctuary'),
    'an MDFC is not a land — counting it as one would put the number above what a deck site shows');
  assert.match(log, /2 lands \(1 basic\), 1 MDFC/);
});

test('fixture: a result missing from the tier inventory is reported, not hidden', () => {
  assert.match(log, /result\(s\) are not in result-tiers\.js/);
});

// ---- the flag itself -------------------------------------------------------

test('--fixture is taken out of the positional arguments', () => {
  assert.deepStrictEqual(takeFixtureFlag(['out.json', '--fixture', 'f.json']),
    { fixture: 'f.json', rest: ['out.json'] });
  assert.deepStrictEqual(takeFixtureFlag(['--fixture', 'f.json', 'out.json', 'steps']),
    { fixture: 'f.json', rest: ['out.json', 'steps'] });
});

test('--fixture with no file is an error, not a silently live run', () => {
  // The bad outcome is not a crash, it is treating `--fixture` as the output path and
  // then streaming 512 MB from Spellbook because nobody said not to.
  assert.deepStrictEqual(takeFixtureFlag(['out.json']), { fixture: null, rest: ['out.json'] });
  assert.throws(() => takeFixtureFlag(['--fixture']), /--fixture needs a file/);
  assert.throws(() => takeFixtureFlag(['--fixture', '--no-steps']), /--fixture needs a file/);
});
