#!/usr/bin/env node
// Can a *browser* on paludancode.github.io read a deck from this site?
//
// Why this is a tool and not a guess: the whole reason Moxfield is not supported
// is that somebody assumed it would work, and it does not — their API needs a
// User-Agent a page cannot set, sits behind Cloudflare, and sends no CORS headers.
// Every other deck site is the same question and the same trap, so each one needs
// its CORS behaviour verified before an adapter is written for it, not after.
//
// It cannot be verified from a laptop behind a proxy that blocks these hosts, and
// it must not be verified with a plain curl either: curl does not enforce CORS, so
// a 200 in a terminal says nothing at all about what a page can do. What decides
// it is one header. This asks for it, with a browser's Origin, and prints what
// came back.
//
//   node tools/probe-cors.js            # every candidate
//   node tools/probe-cors.js deckstats  # one
//
// Deliberately a manual run rather than a test: it asks live third parties a
// question, and a check that fails when somebody else is having an outage is a
// check that gets muted. Run it, read it, write the answer into SITES in
// parser.js. .github/workflows/probe-cors.yml runs it on a runner, which is the
// only place here with unrestricted network.
'use strict';

// What the deployed page is. The answer is per-origin, so asking as anything else
// — localhost, no Origin at all — measures a different question.
const ORIGIN = 'https://paludancode.github.io';

// A GET with no custom headers is a CORS "simple request": no preflight, and the
// only thing that decides whether the page may read the body is
// Access-Control-Allow-Origin on the response. So the deck ids below do not have
// to be real — a 404 carries the same CORS headers a 200 would, and using ids
// that certainly exist would mean maintaining them.
const CANDIDATES = [
  // The two controls. Without them a run cannot tell "this site refuses" from
  // "the probe is broken": archidekt must come back allowed, because the live
  // page loads Archidekt decks today, and moxfield must come back refused.
  {
    site: 'archidekt',
    what: 'CONTROL — must be allowed; the live page does this today',
    url: 'https://archidekt.com/api/decks/1/',
  },
  {
    site: 'moxfield',
    what: 'CONTROL — must be refused; this is why parser.js has browserImport:false',
    url: 'https://api2.moxfield.com/v3/decks/all/aaaaaaaaaaaaaaaaaaaaaa',
  },
  {
    site: 'deckstats',
    what: 'candidate',
    url: 'https://deckstats.net/api.php?action=get_deck&id_type=saved&owner_id=1&id=1&response_type=list',
  },
  {
    site: 'tappedout-api',
    what: 'candidate',
    url: 'https://tappedout.net/api/collection/collection:deck/no-such-deck-here/',
  },
  {
    site: 'tappedout-txt',
    what: 'candidate — their plain-text export view',
    url: 'https://tappedout.net/mtg-decks/no-such-deck-here/?fmt=txt',
  },
  {
    // Scryfall has no public deck API that this repo can point at, so what is
    // being measured is their CORS posture in general — they are already the
    // card-data source, and if a deck endpoint ever appears this says whether it
    // would be reachable.
    site: 'scryfall',
    what: 'reference — their CORS posture generally, not a deck endpoint',
    url: 'https://api.scryfall.com/cards/named?exact=Sol+Ring',
  },
  {
    site: 'mtggoldfish',
    what: 'candidate — their text download',
    url: 'https://www.mtggoldfish.com/deck/download/0',
  },
  // Asked as somebody else, on purpose. Archidekt answers our origin with
  // `Access-Control-Allow-Origin: http://localhost:3000` and `Vary: Origin`,
  // which is either an allowlist we are not on or a header pinned to one value
  // for everyone — and those are different problems. Asking as their own site
  // separates them: an echo here means an allowlist, and an allowlist means the
  // refusal above is real rather than an artefact of how this probe asks.
  {
    site: 'archidekt-as-themselves',
    what: 'DIAGNOSTIC — does Archidekt echo any origin, or always name localhost?',
    url: 'https://archidekt.com/api/decks/1/',
    origin: 'https://archidekt.com',
  },
];

// What a browser actually puts on a cross-origin GET, as closely as a server-side
// fetch can manage. This is not decoration: the first run of this probe sent bare
// Node defaults and got a 400 from Scryfall, who require a User-Agent and reject
// requests without one — an answer about our own request, not about their CORS.
//
// The Sec-Fetch-* trio is set by the browser and cannot be forged from a page, so
// a server is entitled to key on them; sending them is the difference between
// asking "what do you send a script" and "what do you send a browser", and only
// the second question is the one being asked here.
//
// The User-Agent is this project's own rather than a copied Chrome string. A site
// that refuses us on that basis is telling us something true, and pretending to be
// a browser to get a nicer answer would be measuring a request we cannot make.
const BROWSER_HEADERS = {
  Origin: ORIGIN,
  Referer: ORIGIN + '/',
  Accept: '*/*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'User-Agent': 'MTG-Combo-Finder (github.com/PaludaNCode/MTG-Combo-Finder)',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-Dest': 'empty',
};

const TIMEOUT_MS = 20000;

async function probe(candidate) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Per-candidate origin, for the diagnostic rows that deliberately ask as
    // somebody else. Everything else asks as the deployed page, which is the
    // only origin whose answer we actually have to live with.
    const asking = candidate.origin || ORIGIN;
    const headers = Object.assign({}, BROWSER_HEADERS, { Origin: asking, Referer: asking + '/' });
    const res = await fetch(candidate.url, { headers, redirect: 'follow', signal: controller.signal });
    const allow = res.headers.get('access-control-allow-origin');
    return {
      status: res.status,
      allow,
      vary: res.headers.get('vary') || '',
      credentials: res.headers.get('access-control-allow-credentials') || '',
      // `*` or an exact echo of our origin both work for a page reading a public
      // deck. Anything else — absent, or some other origin — means the browser
      // discards the response and the page sees a TypeError with no status,
      // which is exactly what describeLoadFailure() in parser.js explains.
      askedAs: asking,
      readable: allow === '*' || (allow || '').toLowerCase() === asking.toLowerCase(),
    };
  } catch (err) {
    return { error: err && err.name === 'AbortError' ? 'timed out' : String(err && err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

async function main(argv) {
  const only = argv.filter((a) => !a.startsWith('-'));
  const list = only.length
    ? CANDIDATES.filter((c) => only.includes(c.site))
    : CANDIDATES;
  if (!list.length) {
    console.error('No such site. Known: ' + CANDIDATES.map((c) => c.site).join(', '));
    return 1;
  }

  console.log(`Asking each site as a browser on ${ORIGIN} would.`);
  console.log('The only thing that decides it is Access-Control-Allow-Origin.\n');

  const rows = [];
  for (const candidate of list) {
    const result = await probe(candidate);
    rows.push({ candidate, result });
    const verdict = result.error ? 'ERROR' : (result.readable ? 'READABLE' : 'refused');
    console.log(`${candidate.site}`);
    console.log(`  ${candidate.what}`);
    console.log(`  ${candidate.url}`);
    if (candidate.origin) console.log(`  asked as ${candidate.origin}, NOT as us`);
    if (result.error) {
      console.log(`  → ERROR: ${result.error}`);
    } else {
      console.log(`  → HTTP ${result.status}, `
        + `Access-Control-Allow-Origin: ${result.allow === null ? '(absent)' : result.allow}`);
      if (result.vary) console.log(`     Vary: ${result.vary}`);
      if (result.credentials) console.log(`     Access-Control-Allow-Credentials: ${result.credentials}`);
    }
    console.log(`  VERDICT: ${verdict}\n`);
  }

  // The controls are the run's own self-check. If Archidekt comes back refused,
  // something about this probe or the network it ran on is wrong, and none of the
  // other answers should be believed — let alone written into parser.js.
  const control = (site) => rows.find((r) => r.candidate.site === site);
  const arch = control('archidekt');
  const mox = control('moxfield');
  let trustworthy = true;
  if (arch && !arch.result.error && !arch.result.readable) {
    console.log('CONTROL FAILED: Archidekt came back refused.');
    console.log(`  it answered HTTP ${arch.result.status} with Access-Control-Allow-Origin: `
      + `${arch.result.allow === null ? '(absent)' : arch.result.allow}`);
    console.log('');
    console.log('Two things can cause that, and they need different responses:');
    console.log('  1. This probe is not asking the way a browser asks, so nothing else here');
    console.log('     can be believed either.');
    console.log('  2. Archidekt has changed, and loading a deck by URL is broken on the live');
    console.log('     page right now — in which case parser.js is telling readers something');
    console.log('     untrue and this run has found a bug rather than failed.');
    console.log('');
    console.log('Settle it by hand: open the site and paste an Archidekt deck URL. That takes');
    console.log('ten seconds and is the only test that is not a proxy for the real thing.');
    trustworthy = false;
  }
  if (mox && !mox.result.error && mox.result.readable) {
    console.log('CONTROL SURPRISE: Moxfield came back readable. That contradicts parser.js.');
    console.log('Worth checking by hand before believing it — and worth acting on if true.');
  }
  if (trustworthy && arch && !arch.result.error) {
    console.log('Controls behaved. The verdicts above can be acted on.');
  }
  console.log('\nA "READABLE" site is one adapter in parser.js plus one connect-src entry in');
  console.log('both pages\' CSP. A "refused" one can only ever be a paste or a dropped file.');
  return 0;
}

module.exports = { CANDIDATES, probe, ORIGIN };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}
