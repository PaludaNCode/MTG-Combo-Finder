'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Steps = require('../combo-steps.js');

// The parsing under the steps panel, and the pick() that decides what gets
// published for it to parse. Nothing here needs a network: normalize() takes
// Commander Spellbook's own payload shape, and the whole point of pick() is that
// what we publish is a subset of that shape rather than a format of our own.

test.beforeEach(() => Steps.reset());

// Card state is recorded per zone and the fields arrive as empty strings rather
// than absent, so the first non-empty one is the meaningful one.
test('describeUse: state from whichever zone the card has to be in', () => {
  assert.strictEqual(
    Steps.describeUse({
      card: { name: 'Kitchen Finks' },
      zoneLocations: ['G'],
      battlefieldCardState: '',
      graveyardCardState: 'with persist still available',
    }),
    'Kitchen Finks — in your graveyard, with persist still available'
  );
});

test('describeUse: where the card has to be, and what state it is in', () => {
  assert.strictEqual(
    Steps.describeUse({ card: { name: 'Spike Feeder' }, zoneLocations: ['B'], battlefieldCardState: 'with two +1/+1 counters on it' }),
    'Spike Feeder — on the battlefield, with two +1/+1 counters on it'
  );
  assert.strictEqual(
    Steps.describeUse({ card: { name: 'Scurry Oak' }, zoneLocations: ['B'] }),
    'Scurry Oak — on the battlefield'
  );
});

// A card that could be in any of three zones is not a prerequisite — it is a card
// the combo does not care about the position of, and printing every possibility
// would bury the ones that matter.
test('describeUse: says nothing when there is nothing to say', () => {
  assert.strictEqual(Steps.describeUse({ card: { name: 'Sol Ring' }, zoneLocations: ['B', 'G', 'H'] }), null);
  assert.strictEqual(Steps.describeUse({ card: { name: 'Sol Ring' } }), null);
  assert.strictEqual(Steps.describeUse(null), null);
  assert.strictEqual(Steps.describeUse({ zoneLocations: ['B'] }), null, 'no name, no line');
});

test('describeUse: a commander is a prerequisite even with no zone or state', () => {
  assert.strictEqual(
    Steps.describeUse({ card: { name: 'Kinnan, Bonder Prodigy' }, mustBeCommander: true }),
    'Kinnan, Bonder Prodigy — as your commander'
  );
});

// An unknown letter is dropped rather than printed. A row explaining something is
// the worst place to show a reader a raw enum value.
test('describeUse: an unrecognised zone is dropped, not printed', () => {
  assert.strictEqual(Steps.describeUse({ card: { name: 'Sol Ring' }, zoneLocations: ['Z'] }), null);
  assert.strictEqual(
    Steps.describeUse({ card: { name: 'Sol Ring' }, zoneLocations: ['Z'], battlefieldCardState: 'untapped' }),
    'Sol Ring — untapped'
  );
});

test('normalize: steps come back one per line, blank lines dropped', () => {
  const got = Steps.normalize({ description: 'Step one.\n\n  Step two.  \nStep three.\n' });
  assert.deepStrictEqual(got.steps, ['Step one.', 'Step two.', 'Step three.']);
});

test('normalize: mana leads the prerequisites', () => {
  const got = Steps.normalize({
    manaNeeded: '{2}{G}',
    easyPrerequisites: 'A creature to sacrifice.',
    description: 'Do the thing.',
  });
  assert.deepStrictEqual(got.prerequisites, ['Mana available: {2}{G}', 'A creature to sacrifice.']);
});

// The two prerequisite fields Spellbook actually sends, notable first: they split
// the conditions worth stopping on from the ones a player assumes, and printing
// them in that order is the whole value of the split.
test('normalize: notable prerequisites come before easy ones', () => {
  const got = Steps.normalize({
    easyPrerequisites: 'All permanents are untapped.',
    notablePrerequisites: 'Spike Feeder has at least two +1/+1 counters on it.',
    description: 'Do the thing.',
  });
  assert.deepStrictEqual(got.prerequisites, [
    'Spike Feeder has at least two +1/+1 counters on it.',
    'All permanents are untapped.',
  ]);
});

// `otherPrerequisites` was a guessed field name and does not exist in their export.
// Pinned so nobody reinstates it: a payload carrying only that would have looked
// like a combo with no prerequisites at all, which is not the same claim.
test('normalize: the field that never existed is not read', () => {
  const got = Steps.normalize({ otherPrerequisites: 'Invented.', description: 'Do the thing.' });
  assert.deepStrictEqual(got.prerequisites, []);
});

test('normalize: prose prerequisites come before the per-card ones', () => {
  const got = Steps.normalize({
    notablePrerequisites: 'It has to be your turn.',
    uses: [{ card: { name: 'Scurry Oak' }, zoneLocations: ['B'] }],
    description: 'Do the thing.',
  });
  assert.deepStrictEqual(got.prerequisites, ['It has to be your turn.', 'Scurry Oak — on the battlefield']);
});

// A panel with a heading and nothing under it is worse than no panel at all.
test('normalize: nothing to show is null, not an empty panel', () => {
  assert.strictEqual(Steps.normalize({ description: '', uses: [] }), null);
  assert.strictEqual(Steps.normalize({}), null);
  assert.strictEqual(Steps.normalize(null), null);
  assert.strictEqual(Steps.normalize('not an object'), null);
});

// The field names here are read off their API rather than agreed with them, so a
// rename upstream has to cost one line and not the whole panel.
test('normalize: a missing field costs that line only', () => {
  const got = Steps.normalize({ description: 'Do the thing.' });
  assert.deepStrictEqual(got, { prerequisites: [], steps: ['Do the thing.'] });
});

// With no source wired up every combo answers "no steps". Deliberately not sample
// text: a fallback that invented instructions would make a page that had failed to
// wire up its data look exactly like one that had.
test('get: with no source, nothing is recorded and nothing is invented', async () => {
  assert.strictEqual(await Steps.get('2290-2919'), null);
  assert.strictEqual(await Steps.get(''), null);
  assert.strictEqual(await Steps.get(null), null);
});

test('get: asked twice, the source is only asked once', async () => {
  let asked = 0;
  Steps.setSource((id) => {
    asked += 1;
    return Promise.resolve({ description: 'Step for ' + id });
  });
  await Steps.get('x');
  await Steps.get('x');
  assert.strictEqual(asked, 1);
});

// "No steps for this combo" is an answer, and caching it stops a second press
// re-asking a question that has already been settled.
test('get: a null answer is cached too', async () => {
  let asked = 0;
  Steps.setSource(() => {
    asked += 1;
    return Promise.resolve(null);
  });
  assert.strictEqual(await Steps.get('y'), null);
  assert.strictEqual(await Steps.get('y'), null);
  assert.strictEqual(asked, 1);
});

// A failure is not an answer. The network being down when someone pressed the
// button says nothing about whether the combo has steps, so the next press asks
// again rather than being told "no" forever.
test('get: a failure reports rather than throws, and is not cached', async () => {
  let asked = 0;
  Steps.setSource(() => {
    asked += 1;
    return Promise.reject(new Error('Failed to fetch'));
  });
  const first = await Steps.get('z');
  assert.strictEqual(first.error, 'Failed to fetch');
  await Steps.get('z');
  assert.strictEqual(asked, 2, 'asked again on the second press');
});

test('get: a source that throws synchronously is caught the same way', async () => {
  Steps.setSource(() => { throw new Error('boom'); });
  assert.strictEqual((await Steps.get('z')).error, 'boom');
});

test('setSource: a new source clears what the old one answered', async () => {
  Steps.setSource(() => Promise.resolve({ description: 'first' }));
  assert.deepStrictEqual((await Steps.get('a')).steps, ['first']);
  Steps.setSource(() => Promise.resolve({ description: 'second' }));
  assert.deepStrictEqual((await Steps.get('a')).steps, ['second']);
});

test('setSource: cleared, every combo goes back to answering nothing', async () => {
  Steps.setSource(() => Promise.resolve({ description: 'from a source' }));
  assert.deepStrictEqual((await Steps.get('2290-2919')).steps, ['from a source']);
  Steps.setSource(null);
  assert.strictEqual(await Steps.get('2290-2919'), null);
});

// ---- pick(): what the nightly job publishes --------------------------------
//
// The record on the data branch has to be something normalize() could have been
// handed straight from Spellbook's API, because that is the only thing keeping
// the publisher and the panel from drifting apart. So the test is an equality
// rather than a spot check: whatever pick() drops, it must not change a single
// line the reader would have seen.

// A variant as their bulk export really sends one, with every field pick() reads
// and several it must not carry — the export is 512 MB precisely because of these.
const VARIANT = {
  id: '2290-2919',
  manaNeeded: '{2}{G}',
  notablePrerequisites: 'Spike Feeder has at least two +1/+1 counters on it.',
  easyPrerequisites: 'All permanents are untapped.',
  description: 'Remove a +1/+1 counter from Spike Feeder to gain 1 life.\nArchangel of Thune triggers.',
  uses: [
    {
      card: { name: 'Spike Feeder', oracleText: '…', prices: { tcgplayer: '3.14' }, legalities: {} },
      zoneLocations: ['B'],
      battlefieldCardState: 'with two +1/+1 counters on it',
      graveyardCardState: '',
      exileCardState: '',
      libraryCardState: '',
    },
    { card: { name: 'Archangel of Thune' }, zoneLocations: ['B'] },
  ],
  produces: [{ feature: { name: 'Infinite lifegain' } }],
  legalities: { commander: true },
  popularity: 9001,
};

const permutations = () => {
  const out = [VARIANT, {}, { description: '' }, { uses: [] }];
  // Each field on its own, so a rename upstream shows up as one failing case
  // rather than as the whole suite going red at once.
  for (const key of ['manaNeeded', 'notablePrerequisites', 'easyPrerequisites', 'description']) {
    out.push({ [key]: VARIANT[key] });
  }
  for (const zone of ['B', 'G', 'H', 'E', 'L', 'C', 'Z']) {
    out.push({ uses: [{ card: { name: 'A Card' }, zoneLocations: [zone] }] });
  }
  for (const field of ['battlefieldCardState', 'graveyardCardState', 'exileCardState',
    'libraryCardState', 'cardState']) {
    out.push({ uses: [{ card: { name: 'A Card' }, zoneLocations: ['B'], [field]: 'untapped' }] });
  }
  out.push({ uses: [{ card: { name: 'A Card' }, zoneLocations: ['B', 'G', 'H'] }] });
  out.push({ uses: [{ name: 'Flat, no card wrapper' }, { zoneLocations: ['B'] }, null] });
  out.push({ uses: [{ card: { name: 'Kinnan, Bonder Prodigy' }, mustBeCommander: true }] });
  out.push({ steps: 'Only the alternate field.\nSecond line.' });
  return out;
};

test('pick: publishing a variant cannot change a line the reader would see', () => {
  for (const variant of permutations()) {
    const before = Steps.normalize(variant);
    const record = Steps.pick(variant, '1-2');
    const after = record ? Steps.normalize(record) : null;
    assert.deepStrictEqual(after, before, JSON.stringify(variant));
  }
});

// The record is what 103,737 files are made of, so what it leaves out is the
// whole reason publishing them is affordable at all.
test('pick: carries the fields normalize reads and nothing else', () => {
  const record = Steps.pick(VARIANT, '2290-2919');
  assert.deepStrictEqual(Object.keys(record).sort(), [
    'description', 'easyPrerequisites', 'id', 'manaNeeded', 'notablePrerequisites', 'uses',
  ]);
  assert.deepStrictEqual(record.uses[0], {
    name: 'Spike Feeder',
    zoneLocations: ['B'],
    cardState: 'with two +1/+1 counters on it',
  });
  assert.deepStrictEqual(record.uses[1], { name: 'Archangel of Thune', zoneLocations: ['B'] });
  assert.ok(!JSON.stringify(record).includes('tcgplayer'), 'no prices');
  assert.ok(!JSON.stringify(record).includes('Infinite lifegain'), 'results live in combos.json');
});

// The id is carried so the reader can check the file it got is the file it asked
// for. It is fifteen bytes against the page printing another combo's steps.
test('pick: stamps the id it was published under', () => {
  assert.strictEqual(Steps.pick(VARIANT, '2290-2919').id, '2290-2919');
  assert.strictEqual(Steps.pick(VARIANT, 42).id, '42', 'as a string, the way the reader compares it');
});

// No file at all is how "no steps recorded" is published — steps-source.js reads a
// 404 as the answer — so a combo with nothing to say must produce no record.
test('pick: a combo with nothing showable gets no file', () => {
  assert.strictEqual(Steps.pick({}, '1-2'), null);
  assert.strictEqual(Steps.pick({ description: '   \n\n ' }, '1-2'), null);
  assert.strictEqual(Steps.pick({ uses: [{ card: { name: 'Sol Ring' } }] }, '1-2'), null,
    'a card with no zone and no state says nothing');
  assert.strictEqual(Steps.pick(null, '1-2'), null);
  assert.strictEqual(Steps.pick('not an object', '1-2'), null);
});

// Empty strings are what their export sends for an unset field, and there are
// four of them on every card. Published as-is they would be most of the file.
test('pick: empty fields are dropped rather than published blank', () => {
  const record = Steps.pick({
    manaNeeded: '', notablePrerequisites: '', easyPrerequisites: '  ',
    description: 'Do the thing.',
    uses: [{ card: { name: 'A Card' }, zoneLocations: ['B'], battlefieldCardState: '', cardState: '' }],
  }, '1-2');
  assert.deepStrictEqual(Object.keys(record).sort(), ['description', 'id', 'uses']);
  assert.deepStrictEqual(record.uses, [{ name: 'A Card', zoneLocations: ['B'] }]);
});
