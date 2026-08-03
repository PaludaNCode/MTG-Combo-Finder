#!/usr/bin/env node
// Fetch oracle text from Scryfall and commit it, so a sandbox that cannot reach Scryfall
// still gets Scryfall's wording.
//
//   node tools/cache-card-text.js "Card A" "Card B"
//   CARDS="Card A; Card B" node tools/cache-card-text.js
//
// **It takes names, not the work queue, and that is a deliberate stopping point.** Feeding
// it the top N unswept cards directly would be better, and it needs
// `tools/substitution-scope.js` to become a module first: that file has no exports at all
// today, its ranking is computed inside `main()` on the way to printing a table, and
// scraping a tool's own markdown output is exactly the coupling this repository avoids
// elsewhere. So for now: run the scope tool, read its bottom table, paste the names here.
// Two steps, the same way peek-variant.yml is read and written down by a person.
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

async function main(argv) {
  const fromEnv = (process.env.CARDS || '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  const { names } = parseArgs(argv.length ? argv : fromEnv);
  if (!names.length) {
    console.error('Give one or more card names, or set CARDS="A; B".');
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

module.exports = { parseArgs, fromScryfall, main };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}
