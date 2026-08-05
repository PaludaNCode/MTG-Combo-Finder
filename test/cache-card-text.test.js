'use strict';
// The sweep, its floor, and the two decisions the workflow used to make in bash.
//
// None of this can be tested against Scryfall — every Scryfall host answers 403 at CONNECT
// from the sandbox this repository is edited in — so the bulk module is injected. That is
// not a convenience: proving the live path costs a workflow dispatch, and a dispatch per
// attempt is what made one wrong `if` in this same workflow survive as long as it did.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const CardText = require('../tools/card-text.js');
const {
  sweep, SWEEP_FLOOR, sweepRequested, commitSubject,
} = require('../tools/cache-card-text.js');

// ---- which mode, and what the commit says ------------------------------------

test('SWEEP=true is the only thing that asks for a sweep', () => {
  assert.ok(sweepRequested({ SWEEP: 'true' }));
  assert.ok(sweepRequested({ SWEEP: ' true ' }));
  // A GitHub boolean input arrives as the string "false", which is truthy in JS — the
  // mistake this assertion exists to catch, because it would turn every one-card dispatch
  // into a full sweep and still look like it worked.
  assert.ok(!sweepRequested({ SWEEP: 'false' }));
  assert.ok(!sweepRequested({ SWEEP: '' }));
  assert.ok(!sweepRequested({}));
});

test('the commit subject names the cards, or says it was a sweep', () => {
  assert.strictEqual(
    commitSubject({ CARDS: 'Woe Strider; Ashnod’s Altar' }),
    'Cache oracle text for: Woe Strider; Ashnod’s Altar',
  );
  assert.match(commitSubject({ SWEEP: 'true', CARDS: 'ignored' }), /^Sweep oracle text/);
});

// ---- the sweep ---------------------------------------------------------------

const card = (name, oracle, extra = {}) => Object.assign({
  name,
  layout: 'normal',
  lang: 'en',
  mana_cost: '{1}{G}',
  color_identity: ['G'],
  legalities: { commander: 'legal' },
  type_line: 'Creature — Test',
  oracle_text: oracle,
}, extra);

// Enough cards to clear the floor, plus whatever the test wants to say something about.
const bulkOf = (extra = []) => {
  const filler = [];
  for (let i = 0; i < SWEEP_FLOOR; i++) filler.push(card(`Filler ${i}`, `text ${i}`));
  return filler.concat(extra);
};

function fakeBulk(cards) {
  return {
    isWanted: require('../tools/scryfall-bulk.js').isWanted,
    async* streamCards() {
      for (const c of cards) yield { card: c, meta: { type: 'oracle_cards', updatedAt: '2026-08-05' } };
    },
  };
}

// The sweep is handed the path it should write, and nothing here patches the cache module.
//
// **The first version of this helper did patch it, and it damaged the repository.** It
// redirected `CardText.read`/`write` and restored them in a `finally` — but it was not async,
// so `try { return run() } finally { restore() }` restored in the same tick that `run`
// returned its *promise*, before the sweep had done anything. The sweep then called the real
// `write` and put ten thousand cards named "Filler 0" into the committed `card-text.json`.
// Nothing failed. It was noticed in a diffstat.
//
// So `sweep()` takes `deps.file` now and this passes a temporary one. A test that cannot
// reach the real file cannot corrupt it, which is a stronger guarantee than a test that
// restores carefully.
async function inSandbox(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-'));
  const file = path.join(dir, 'card-text.json');
  const quiet = console.log;
  const loud = [];
  console.log = (...a) => loud.push(a.join(' '));
  try {
    return await run({ file, output: () => loud.join('\n') });
  } finally {
    console.log = quiet;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('a sweep writes every card it was given', async () => {
  await inSandbox(async ({ file }) => {
    const code = await sweep({ file, bulk: fakeBulk(bulkOf([card('Chatterfang', 'Make a Squirrel.')])) });
    assert.strictEqual(code, 0);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(doc.count, SWEEP_FLOOR + 1);
    assert.strictEqual(doc.cards.Chatterfang.faces[0].oracle, 'Make a Squirrel.');
  });
});

// The guard that matters most. A truncated download, a moved `name` field, or a layout
// filter that suddenly matches everything all produce a run that would otherwise exit 0
// having thrown the file away — and "it worked, 40 cards" is indistinguishable from "it
// worked" in a log.
test('a sweep under the floor writes NOTHING and fails, rather than shrinking the cache', async () => {
  await inSandbox(async ({ file }) => {
    // Seed a real cache first, so the failure has something to destroy.
    const seeded = CardText.merge({}, [CardText.normalize(card('Keep Me', 'text'))]);
    CardText.write(seeded.cards, file);
    const before = fs.readFileSync(file, 'utf8');

    const code = await sweep({ file, bulk: fakeBulk([card('Only One', 'text')]) });
    assert.strictEqual(code, 1, 'a short sweep must fail');
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'the cache must be untouched');
  });
});

test('the floor counts cards kept, not objects read — a file of tokens fails', async () => {
  await inSandbox(async ({ file }) => {
    const tokens = [];
    for (let i = 0; i < SWEEP_FLOOR * 2; i++) tokens.push(card(`Squirrel ${i}`, 'x', { layout: 'token' }));
    assert.strictEqual(await sweep({ file, bulk: fakeBulk(tokens) }), 1);
  });
});

test('a sweep names the cards whose wording changed, because each may sit under a row', async () => {
  await inSandbox(async ({ file, output }) => {
    await sweep({ file, bulk: fakeBulk(bulkOf([card('Chatterfang', 'old text')])) });
    await sweep({ file, bulk: fakeBulk(bulkOf([card('Chatterfang', 'NEW text')])) });
    const said = output();
    assert.match(said, /1 with changed wording/);
    assert.match(said, /~ Chatterfang/);
    assert.match(said, /worth checking against anything that cited it/);
  });
});

test('a re-sweep of identical data changes the file only where the sweep date is', async () => {
  await inSandbox(async ({ file }) => {
    const bulk = fakeBulk(bulkOf([card('Chatterfang', 'Make a Squirrel.')]));
    await sweep({ file, bulk });
    const first = JSON.parse(fs.readFileSync(file, 'utf8'));
    await sweep({ file, bulk });
    const second = JSON.parse(fs.readFileSync(file, 'utf8'));
    // Every entry byte-identical. This is the property the whole date split exists for: a
    // second sweep must not be a whole-file diff.
    assert.deepStrictEqual(second.cards, first.cards);
  });
});

test('a card the sweep did not see is kept and reported, never dropped', async () => {
  await inSandbox(async ({ file, output }) => {
    await sweep({ file, bulk: fakeBulk(bulkOf([card('Retired Card', 'text')])) });
    await sweep({ file, bulk: fakeBulk(bulkOf()) });
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.ok(doc.cards['Retired Card'], 'a card absent from a sweep must survive it');
    assert.match(output(), /\? Retired Card/);
  });
});

test('a sweep records how many objects it skipped rather than absorbing them', async () => {
  await inSandbox(async ({ file, output }) => {
    await sweep({ file, bulk: fakeBulk(bulkOf([card('Squirrel', 'x', { layout: 'token' })])) });
    assert.match(output(), /1 skipped as not a playable English card/);
  });
});

// A rename is reported apart from a change, because what broke is not the card — it is every
// citation of the old name in unofficial.js and research-log.js.
test('a sweep reports a renamed card as a rename, not as an add plus a disappearance', async () => {
  await inSandbox(async ({ file, output }) => {
    const before = card('Old Name', 'text');
    before.oracle_id = 'abc-123';
    await sweep({ file, bulk: fakeBulk(bulkOf([before])) });

    const after = card('New Name', 'text');
    after.oracle_id = 'abc-123';
    await sweep({ file, bulk: fakeBulk(bulkOf([after])) });

    const said = output();
    assert.match(said, /1 card\(s\) RENAMED/);
    assert.match(said, /Old Name.*⇒.*New Name/);
    assert.match(said, /citing the old name needs looking at/);

    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.ok(doc.cards['New Name'], 'the card is filed under the new name');
    assert.ok(!doc.cards['Old Name'], 'and not left beside it under the old one');
  });
});

// There is no scheduled run any more, so nothing but the box decides. Pinned because the clause
// that read EVENT_NAME was removed with the cron, and a leftover would silently turn a
// dispatch-only workflow back into one that sweeps on an event it no longer receives.
test('nothing but the sweep box asks for a sweep', () => {
  assert.ok(!sweepRequested({ EVENT_NAME: 'schedule' }));
  assert.ok(!sweepRequested({ EVENT_NAME: 'schedule', SWEEP: 'false' }));
  assert.ok(sweepRequested({ EVENT_NAME: 'schedule', SWEEP: 'true' }), 'the box still works');
});
