#!/usr/bin/env node
// Fetch oracle text from Scryfall and commit it, so a sandbox that cannot reach Scryfall
// still gets Scryfall's wording.
//
//   node tools/cache-card-text.js "Card A" "Card B"
//   CARDS="Card A; Card B" node tools/cache-card-text.js
//   node tools/cache-card-text.js --all          # every card, from Scryfall's bulk data
//
// **`--all` is the one that matters and the named path is the exception now.** The named
// path is one request per card, and it was the only path for as long as the cache held a
// few hundred cards. It does not reach the whole card space: at 120ms a request that is
// ~40 minutes against a workflow that times out at 15, so it would die a third of the way
// through and look like it had worked. `--all` is a single request to `/bulk-data` plus one
// streamed download — see `tools/scryfall-bulk.js`.
//
// Keep using names for two or three cards. It is faster than a 30,000-card sweep for a
// question about one card, and it is the only path when the answer is needed now.
//
// **A sweep only writes what moved**, so running it twice in a day is not a 13MB diff. That
// lives in `CardText.merge()` and the reasoning is in the header of `tools/card-text.js`;
// the short version is that the per-entry date says when a wording last *changed* and the
// file-level `generated` says when everything was last confirmed.
//
// **Runs on a runner, not here.** That is the whole point — see
// .github/workflows/cache-card-text.yml. Every Scryfall host is refused at CONNECT from
// the usual sandbox, which is why `tools/lookup-card.js` has a Forge fallback and why
// anything Forge answers is banner-marked as Forge's wording rather than Wizards'.
//
// It only ever adds and refreshes. A card in the cache that this run did not ask about is
// left exactly as it was, so a partial run is not a partial cache — which matters because
// this talks to a third party and a run can die halfway.
'use strict';

const CardText = require('./card-text.js');

const NAMED = 'https://api.scryfall.com/cards/named?exact=';
const UA = 'MTG-Combo-Finder (github.com/PaludaNCode/MTG-Combo-Finder)';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Scryfall asks for 50-100ms between requests. 120 is inside that with room, and this job
// is never in a hurry — it runs by hand and its whole output is a small diff.
const GAP_MS = 120;

// **Being inside Scryfall's rate limit is not enough, because the runner does not have the
// IP to itself.** A 42-card run from GitHub Actions was refused at card 22 with a 429,
// eight seconds in and nowhere near 10 requests a second: the quota belongs to the shared
// runner address, so how much of it is left depends on who else is on that box. Nothing
// this tool can do to its own pacing prevents that.
//
// So it backs off and asks again. The delays are long on purpose — a rate limit is asking
// for time, and this job runs by hand with nothing waiting on it, so the cheap fix is to
// wait longer than seems necessary rather than to burn a retry arriving early.
const RETRY_BACKOFF_MS = [2000, 5000, 15000, 30000];

// A 429 with a Retry-After is Scryfall naming its own number, which beats guessing. Only
// the delta-seconds form is read: the HTTP-date form is legal and Scryfall does not send
// it, and a parser for a case that never arrives is a parser nobody would notice breaking.
function retryAfterMs(res) {
  const header = res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

// Names, from arguments or from CARDS. Semicolons as well as newlines, matching
// lookup-card.js and the two workflows that already take a card list — "Camellia, the
// Seedmiser" is one card and a comma-separated list would cut it in half.
function parseArgs(argv) {
  return { names: argv.map((s) => String(s).trim()).filter(Boolean) };
}

// `deps` is how the retry gets tested without a real clock or a real Scryfall. It is the
// only injection point in this file, and it exists because the thing worth testing here is
// the behaviour on a status code, which is unreachable otherwise.
async function fromScryfall(name, deps = {}) {
  const get = deps.fetch || fetch;
  const sleep = deps.wait || wait;
  const backoff = deps.backoff || RETRY_BACKOFF_MS;

  for (let attempt = 0; ; attempt++) {
    const res = await get(NAMED + encodeURIComponent(name), {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    });
    if (res.status === 404) return { missing: true };
    if (res.ok) return { card: await res.json() };
    if (res.status !== 429 || attempt >= backoff.length) {
      throw Object.assign(new Error(`Scryfall HTTP ${res.status} for ${name}`), { status: res.status });
    }
    const ms = retryAfterMs(res) || backoff[attempt];
    // Said out loud, and to stdout with the rest of the run, because it is the summary's
    // only evidence that a run took four minutes for a reason. A silent retry turns a
    // rate limit into an unexplained pause.
    console.log(`  … 429 on ${name}, waiting ${Math.round(ms / 1000)}s (attempt ${attempt + 1} of ${backoff.length})`);
    await sleep(ms);
  }
}

// Below this, a sweep is treated as a failure rather than as a small cache.
//
// **The number exists because "it worked and found 40 cards" is indistinguishable from "it
// worked" in a log.** A truncated download, a schema change that moves `name`, or a layout
// filter that suddenly matches everything all produce a run that exits 0 having quietly
// thrown away most of the file. There is no upper bound to check against — the card space
// only grows — so the floor is set well under the ~30,000 an oracle-cards sweep should see
// and only catches the catastrophic case, which is the one that would otherwise ship.
const SWEEP_FLOOR = 10000;

// How many changed names to print in full before summarising. Every one is a card whose
// wording moved, and any of them may sit under a published row's reasoning, so the default
// is to name them; a schema-wide change that touches thousands should not bury the summary.
const NAME_CHANGES_UP_TO = 60;

// `deps.file` is not a convenience, it is a guard. The test for this function used to
// redirect writes by monkey-patching CardText.read/write, and a scaffolding bug restored the
// patches before the async sweep had run — so a test wrote ten thousand cards named
// "Filler 0" into the real committed cache, and it was caught by a diffstat rather than by
// anything that would have failed. Nothing testing this should be able to reach the real
// file at all, so the path is a parameter and the test passes its own.
async function sweep(deps = {}) {
  const Bulk = deps.bulk || require('./scryfall-bulk.js');
  const file = deps.file || CardText.CACHE_FILE;
  const cache = CardText.read(file);
  console.log(`Sweeping every card from Scryfall's bulk data. ${cache.count} cached now.`);

  const readings = [];
  let seen = 0;
  let skipped = 0;
  let meta = null;
  for await (const { card, meta: m } of Bulk.streamCards(deps)) {
    seen += 1;
    if (!meta) {
      meta = m;
      console.log(`  reading ${m.type}, built ${m.updatedAt}`);
    }
    if (!Bulk.isWanted(card)) { skipped += 1; continue; }
    const entry = CardText.normalize(card);
    if (entry) readings.push(entry);
  }

  console.log(`  ${seen} objects read, ${skipped} skipped as not a playable English card.`);
  if (readings.length < SWEEP_FLOOR) {
    console.error(
      `\nOnly ${readings.length} cards came back, under the ${SWEEP_FLOOR} floor. Nothing has `
      + 'been written.\nA truncated download or a moved field looks exactly like this — check '
      + `the ${seen} objects read above against what Scryfall says the file holds.`,
    );
    return 1;
  }

  const merged = CardText.merge(cache.cards, readings);
  const doc = CardText.write(merged.cards, file);
  console.log(
    `\n${doc.count} card(s) in card-text.json: ${merged.added.length} added, `
    + `${merged.changed.length} with changed wording, ${merged.unchanged} unchanged.`,
  );

  // The interesting half. An added card is routine; a *changed* one may have moved under a
  // row in unofficial.js or a rule-out in research-log.js, and nothing else in this
  // repository would notice.
  if (merged.changed.length) {
    console.log(`\n${merged.changed.length} card(s) whose oracle text CHANGED since the last sweep:`);
    const shown = merged.changed.slice(0, NAME_CHANGES_UP_TO);
    for (const name of shown) console.log(`  ~ ${name}`);
    if (merged.changed.length > shown.length) {
      console.log(`  … and ${merged.changed.length - shown.length} more`);
    }
    console.log('Each one is worth checking against anything that cited it.');
  }

  // A rename is now recognised as one rather than left as an add-plus-absent for a reader to
  // pair up. It is reported louder than a change, because the card is fine and the *citations*
  // are what broke: every row in unofficial.js and rule-out in research-log.js naming the old
  // spelling now names a card this cache answers for under a different key.
  if (merged.renamed && merged.renamed.length) {
    console.log(`\n${merged.renamed.length} card(s) RENAMED — anything citing the old name needs looking at:`);
    for (const r of merged.renamed.slice(0, NAME_CHANGES_UP_TO)) console.log(`  → ${r.from}  ⇒  ${r.to}`);
  }

  // Kept, not deleted — see CardText.merge(). Now that a rename is caught by identity, an
  // entry here is a card Scryfall's bulk file genuinely stopped listing, which wants a person.
  if (merged.absent.length) {
    console.log(
      `\n${merged.absent.length} cached card(s) this sweep did not see, kept as they were:`,
    );
    for (const name of merged.absent.slice(0, NAME_CHANGES_UP_TO)) console.log(`  ? ${name}`);
  }
  return 0;
}

// Which mode a run is in, and what its commit says. Both are decisions, and neither lives in
// the workflow's `run:` block — shell inside a workflow is the one kind of code in this
// repository nothing can test, and exercising a path that only fires on the default branch
// costs a merge per attempt. `tools/cache-target-branch.js` exists for exactly this reason
// and one wrong `if` in this same workflow survived for as long as it did because of it.
//
// So the workflow calls `node tools/cache-card-text.js` unconditionally and this decides,
// and asks `--subject` for the commit line rather than composing one in bash.
// A scheduled run is always a sweep. There is no name list to give it, and the question a
// schedule asks is not "does this card still say that" — it is "did anything this repository
// cites change", which nobody would ever ask by hand.
//
// In the workflow expression rather than here, this would be
// `${{ inputs.sweep || github.event_name == 'schedule' }}`, which is a decision in YAML that
// nothing can test. The GitHub boolean arrives as the *string* "false", truthy in JS, so the
// obvious version of that expression turns every one-card dispatch into a full sweep.
const sweepRequested = (env = process.env) => String(env.SWEEP || '').trim() === 'true'
  || String(env.EVENT_NAME || '').trim() === 'schedule';

function commitSubject(env = process.env) {
  if (sweepRequested(env)) return "Sweep oracle text from Scryfall's bulk data";
  const names = String(env.CARDS || '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  // The names, because that subject is how somebody finds the run that cached a card. The
  // sweep case cannot do this — 30,000 names is not a commit subject — which is the other
  // reason the two are not one string.
  return `Cache oracle text for: ${names.join('; ')}`;
}

async function main(argv) {
  if (argv.includes('--subject')) {
    console.log(commitSubject());
    return 0;
  }
  const fromEnv = (process.env.CARDS || '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  const args = argv.length ? argv : fromEnv;
  if (sweepRequested() || args.some((a) => a === '--all')) {
    try {
      return await sweep();
    } catch (err) {
      // Same rule as the named path: loud and fatal, nothing written. A half-swept cache
      // would be a file whose `generated` date claims a confirmation that did not happen.
      console.error(`\n${err.message}`);
      console.error('Nothing has been written. Re-run when Scryfall is reachable.');
      return 1;
    }
  }

  const { names } = parseArgs(args);
  if (!names.length) {
    console.error('Give one or more card names, set CARDS="A; B", or pass --all.');
    return 2;
  }

  const cache = CardText.read();
  // Keyed by the name Scryfall returns rather than the name asked for, so a query that
  // resolves to a different spelling lands under the real one and is found next time.
  const cards = Object.assign({}, cache.cards);

  let added = 0;
  let refreshed = 0;
  const missing = [];

  for (const name of names) {
    const had = CardText.lookup(cache, name);
    let answer;
    try {
      answer = await fromScryfall(name);
    } catch (err) {
      // Loud and fatal. A half-written cache is fine (see the header) but a *silent* gap
      // is not: the whole value of this file is that a pass can trust what is in it.
      console.error(`\n${err.message}`);
      console.error('Nothing has been written. Re-run when Scryfall is reachable.');
      return 1;
    }
    if (answer.missing) {
      missing.push(name);
      console.log(`  ? ${name} — Scryfall has no card by exactly that name`);
      await wait(GAP_MS);
      continue;
    }
    const entry = CardText.normalize(answer.card);
    cards[entry.name] = entry;
    if (had) refreshed += 1; else added += 1;
    console.log(`  ${had ? '~' : '+'} ${entry.name}`);
    await wait(GAP_MS);
  }

  const doc = CardText.write(cards);
  console.log(`\n${doc.count} card(s) in card-text.json: ${added} added, ${refreshed} refreshed.`);
  if (missing.length) {
    console.log(`\n${missing.length} name(s) Scryfall did not recognise — check the spelling:`);
    for (const name of missing) console.log(`  ${name}`);
  }
  // Not an error. A misspelling in a hand-typed list should not throw away the twenty
  // cards that did resolve, and the list above is how somebody fixes it.
  return 0;
}

module.exports = {
  parseArgs, fromScryfall, sweep, main, SWEEP_FLOOR, sweepRequested, commitSubject,
};

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}
