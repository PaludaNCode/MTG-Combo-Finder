'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Steps = require('../combo-steps.js');

// The steps panel is a prototype, but the parsing under it is the part that will
// survive whichever source wins — Spellbook's own endpoint or a file we publish —
// because both hand over the same payload shape. So it is tested now, before the
// source exists, which is the only reason it can be: nothing here needs a network.

test.beforeEach(() => Steps.reset());

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
    otherPrerequisites: 'A creature to sacrifice.',
    description: 'Do the thing.',
  });
  assert.deepStrictEqual(got.prerequisites, ['Mana available: {2}{G}', 'A creature to sacrifice.']);
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

test('get: the sample data resolves through normalize', async () => {
  const got = await Steps.get('2290-2919');
  assert.ok(got.steps.length >= 3, 'Spike Feeder + Archangel of Thune has its steps');
  assert.ok(got.prerequisites.some((p) => /Spike Feeder/.test(p)));
});

test('get: an id with nothing recorded resolves to null', async () => {
  assert.strictEqual(await Steps.get('no-such-combo'), null);
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

// reset() drops the source entirely, which puts the sample back — the state the
// page loads in.
test('setSource: cleared, the sample answers again', async () => {
  Steps.setSource(() => Promise.resolve({ description: 'from a source' }));
  assert.deepStrictEqual((await Steps.get('2290-2919')).steps, ['from a source']);
  Steps.setSource(null);
  assert.ok((await Steps.get('2290-2919')).steps.length >= 3);
});

// The sample is placeholder text, but it has to be placeholder text of the right
// shape: every entry must survive normalize(), or the prototype demonstrates a
// panel the real data would never produce.
test('the sample entries all normalize to something showable', () => {
  const ids = Object.keys(Steps.SAMPLE);
  assert.ok(ids.length >= 2);
  for (const id of ids) {
    const got = Steps.normalize(Steps.SAMPLE[id]);
    assert.ok(got, id + ' normalizes');
    assert.ok(got.steps.length, id + ' has steps');
    assert.ok(got.prerequisites.length, id + ' has prerequisites');
  }
});
