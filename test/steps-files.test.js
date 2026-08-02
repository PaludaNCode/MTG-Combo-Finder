'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createStepsWriter } = require('../tools/fetch-combos.js');
const Source = require('../steps-source.js');
const Steps = require('../combo-steps.js');

// The seam this project has been bitten by twice: a publisher and a reader that
// each work perfectly and disagree about the shape between them. tiers.html shipped
// stuck on "Loading the combo database…" for exactly that reason, and the fix was
// to make the tests serve what production serves.
//
// So this does not check that the writer wrote plausible files. It writes them,
// then reads them back through the real steps-source.js reader over a fetch that
// only knows how to open a file, and asserts the reader ends up with what the
// panel would have shown had it been handed Spellbook's variant directly.

const VARIANTS = [
  {
    id: '2290-2919',
    notablePrerequisites: 'Spike Feeder has at least two +1/+1 counters on it.',
    description: 'Remove a +1/+1 counter from Spike Feeder to gain 1 life.\nArchangel of Thune triggers.',
    uses: [
      { card: { name: 'Spike Feeder' }, zoneLocations: ['B'], battlefieldCardState: '' },
      { card: { name: 'Archangel of Thune' }, zoneLocations: ['B'] },
    ],
    popularity: 900,
  },
  { id: '1', manaNeeded: '{2}{G}', description: 'Tap it.' },
  { id: '215-579--85--181', description: 'A combo with two template slots.' },
  // Nothing showable: no file, and a 404 is the answer.
  { id: '7-8', produces: [{ feature: { name: 'Infinite mana' } }] },
];

function build(variants) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'steps-files-'));
  const writer = createStepsWriter(dir);
  for (const variant of variants) writer.write(variant);
  return { dir, writer };
}

// Reads the published tree the way the page reads the data branch: by URL, with a
// 404 for a file that is not there.
const fileFetch = (dir) => async (url) => {
  const file = path.join(dir, String(url).replace(/^steps\//, ''));
  try {
    const body = fs.readFileSync(file, 'utf8');
    return { status: 200, ok: true, json: async () => JSON.parse(body) };
  } catch (err) {
    return { status: 404, ok: false };
  }
};

test('the tree the publisher writes is the tree the reader asks for', async () => {
  const { dir } = build(VARIANTS);
  const read = Source.reader({ base: '', fetch: fileFetch(dir) });

  for (const variant of VARIANTS) {
    const got = await read(variant.id);
    assert.deepStrictEqual(
      Steps.normalize(got),
      Steps.normalize(variant),
      variant.id + ' reads back as the same panel'
    );
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a combo with nothing to say has no file, and the 404 is the answer', async () => {
  const { dir, writer } = build(VARIANTS);
  const read = Source.reader({ base: '', fetch: fileFetch(dir) });

  assert.strictEqual(await read('7-8'), null);
  assert.ok(!fs.existsSync(path.join(dir, Source.pathFor('7-8').slice('steps/'.length))));
  assert.strictEqual(writer.state.nothingToSay, 1);
  assert.strictEqual(writer.state.written, 3);
  fs.rmSync(dir, { recursive: true, force: true });
});

// A combo the page has never heard of costs one 404 and no special handling.
test('an unpublished combo is a 404, not an error', async () => {
  const { dir } = build(VARIANTS);
  const read = Source.reader({ base: '', fetch: fileFetch(dir) });
  assert.strictEqual(await read('99999-88888'), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

// Every directory the reader can hash into has to exist before anything is
// written, or a combo lands in a bucket the publisher never made.
test('all 256 buckets are created, and every file lands in the right one', () => {
  const { dir } = build(VARIANTS);
  const buckets = fs.readdirSync(dir).sort();
  assert.strictEqual(buckets.length, Source.BUCKETS);
  assert.strictEqual(buckets[0], '00');
  assert.strictEqual(buckets[buckets.length - 1], 'ff');

  let found = 0;
  for (const bucket of buckets) {
    for (const name of fs.readdirSync(path.join(dir, bucket))) {
      const id = name.replace(/\.json$/, '');
      assert.strictEqual(Source.pathFor(id), 'steps/' + bucket + '/' + name, id);
      found += 1;
    }
  }
  assert.strictEqual(found, 3);
  fs.rmSync(dir, { recursive: true, force: true });
});

// This side turns an id into a filesystem path. An id with a slash in it is not a
// wrong link, it is a write outside the tree — so it is refused rather than
// escaped, and refused loudly enough that nobody has to find it by reading.
test('an id that is not a safe filename is skipped, not sanitised', () => {
  const { dir, writer } = build([
    { id: '../../escaped', description: 'Should never be written.' },
    { id: 'a/b', description: 'Nor this.' },
    { id: '1-2', description: 'This one is fine.' },
  ]);
  assert.deepStrictEqual(writer.state.unsafeId, ['../../escaped', 'a/b']);
  assert.strictEqual(writer.state.written, 1);
  assert.ok(!fs.existsSync(path.join(path.dirname(path.dirname(dir)), 'escaped')));
  fs.rmSync(dir, { recursive: true, force: true });
});

// A stale file is not a harmless leftover. It is an answer, for a combo that was
// in yesterday's snapshot and is not in today's, and nothing downstream would
// ever notice it still being served.
test('a rebuild clears what the last one published', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'steps-files-'));
  const first = createStepsWriter(dir);
  first.write({ id: '1-2', description: 'Yesterday.' });
  first.write({ id: '3-4', description: 'Still here tomorrow.' });

  const second = createStepsWriter(dir);
  second.write({ id: '3-4', description: 'Still here tomorrow.' });

  const read = Source.reader({ base: '', fetch: fileFetch(dir) });
  assert.strictEqual(await read('1-2'), null, 'the retired combo is gone');
  assert.deepStrictEqual(Steps.normalize(await read('3-4')).steps, ['Still here tomorrow.']);
  fs.rmSync(dir, { recursive: true, force: true });
});

// --no-steps has to be a complete no-op rather than a writer pointed at nowhere:
// the local `node tools/fetch-combos.js` should be able to skip 103,737 files.
test('no directory means no writing and no crashing', () => {
  const writer = createStepsWriter(null);
  assert.doesNotThrow(() => writer.write(VARIANTS[0]));
  assert.doesNotThrow(() => writer.report(10));
});
