#!/usr/bin/env node
// Print a card's oracle text, straight from Scryfall.
//
// Exists because settling "do these two cards actually do the same thing?"
// otherwise turns into inference from the shape of the combo data — which was
// wrong at least once. A card's own text is the primary source, and a runner
// with open network can just read it.
//
//   node tools/lookup-card.js "Carrion Feeder" "Viscera Seer"
//
// Also runs from Actions with a `cards` input, so future questions of this kind
// need no code change. Names there are separated by a semicolon or a newline,
// never a comma: half of Magic's legendary creatures have a comma in the name,
// and "Camellia, the Seedmiser" split into two cards neither of which exists.
//
// ---- when Scryfall is not reachable -----------------------------------------
//
// "a runner with open network" is an assumption, and it fails: an agent sandbox
// behind an egress proxy that allowlists raw.githubusercontent.com answers every
// Scryfall host with a 403 at CONNECT, and so do mtgjson, gatherer and the
// Spellbook API. This tool used to print "HTTP 403 — check the spelling" and stop,
// which is a diagnosis it has no way to make: a blocked host and a typo look
// identical from here, and it named the likelier one as though it knew.
//
// So Scryfall is asked first and Forge second, because Forge ships its card scripts
// as plain files in a GitHub repo and they come over the host that *is* allowed.
// Each has an `Oracle:` line carrying the card text verbatim:
//
//   https://raw.githubusercontent.com/Card-Forge/forge/master/forge-gui/res/
//     cardsfolder/<first letter of slug>/<slug>.txt
//
// The slug rule was probed, not guessed — 454 of 454 names out of the published
// combo data resolve, and each clause below is a name the obvious rule got wrong:
//
//   strip accents, then lowercase          Éomer, … -> eomer_…
//   apostrophes vanish, every other run    Ashnod's Altar -> ashnods_altar
//     of non-alphanumerics becomes one _   M.O.D.O.K.     -> m_o_d_o_k
//   split cards join BOTH faces            Birgi … // Harnfel … ->
//                                            birgi_…_harnfel_…  (front alone 404s)
//   recent sets sit in cardsfolder/upcoming/ rather than the letter directory
//
// It is a second opinion rather than a replacement: no colour identity, no
// legalities, no printings, and the text is maintained by Forge rather than by
// Wizards. Every card it answers is printed under a banner saying so, because the
// output of this tool gets pasted into rows that cite their evidence, and "which
// source said this" has to survive the journey. The README section "Reading a card
// when Scryfall is unreachable" has the probe numbers and the XMage cross-check.
//
// Four outcomes, and verdict() rather than the printing decides which:
//
//   Scryfall answered                 print it, no banner — the usual case
//   Scryfall blocked, Forge has it    print it, banner, blame the network
//   Scryfall 404, Forge has it        print it, banner, and say Scryfall wants
//                                       some other spelling of this name
//   neither has it                    say which of the two it is, and only say
//                                       "check the spelling" when Scryfall was
//                                       actually reachable to say so
'use strict';

const UA = 'MTG-Combo-Finder/1.0 (+https://github.com/PaludaNCode/MTG-Combo-Finder; card text lookup)';
const CardText = require('./card-text.js');

const NAMED = 'https://api.scryfall.com/cards/named?exact=';
const FORGE = 'https://raw.githubusercontent.com/Card-Forge/forge/master/forge-gui/res/cardsfolder/';

const out = [];
const say = (line = '') => { out.push(line); console.log(line); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function faces(card) {
  return Array.isArray(card.card_faces) && card.card_faces.length ? card.card_faces : [card];
}

// ---- the fallback ------------------------------------------------------------

// Forge's file name for a card. Each clause is a name that broke the obvious rule,
// which is why this is four lines rather than a lowercase and a replace.
function forgeSlug(name) {
  return String(name)
    // Éomer is eomer. Decompose first so the accent is its own character to drop.
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Ashnod's Altar is ashnods_altar — the apostrophe closes up rather than parting.
    .replace(/['’"]/g, '')
    // Everything else that is not a letter or a digit is one separator, however much
    // of it there is. This is what makes M.O.D.O.K. m_o_d_o_k rather than modok, and
    // what joins BOTH faces of a split card: the " // " is just another separator,
    // and taking the front face alone reaches nothing.
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Where to look, in order. Recent sets sit in an `upcoming/` directory instead of
// the letter one, so a card that is genuinely absent costs two requests to prove.
function forgePaths(name) {
  const slug = forgeSlug(name);
  if (!slug) return [];
  return [FORGE + slug[0] + '/' + slug + '.txt', FORGE + 'upcoming/' + slug + '.txt'];
}

// Forge writes mana as space-separated symbols — "3 B B" — with a token of two colour
// letters meaning one hybrid symbol ("RW" is Figure of Destiny's {R/W}, where Samwise's
// "G W" is two). Anything this does not recognise is passed through as Forge wrote it
// rather than guessed at: a cost rendered wrong is worse than one rendered oddly.
function forgeMana(cost) {
  const raw = String(cost || '').trim();
  if (!raw || raw === 'no cost') return '';
  return raw.split(/\s+/).map((sym) => {
    if (/^[0-9]+$/.test(sym) || /^[WUBRGCSXYZ]$/.test(sym)) return '{' + sym + '}';
    if (/^[WUBRG]{2}$/.test(sym)) return '{' + sym[0] + '/' + sym[1] + '}';
    if (/^2[WUBRG]$/.test(sym)) return '{2/' + sym[1] + '}';
    if (/^[WUBRG]P$/.test(sym)) return '{' + sym[0] + '/P}';
    return '{' + sym + '}';
  }).join('');
}

// One card script into the faces it describes. A split or double-faced card is one
// file with the faces divided by a line reading ALTERNATE, and Forge escapes the line
// breaks inside an Oracle: line as a literal backslash-n.
function parseForge(text) {
  return String(text).split(/^ALTERNATE$/m).map((chunk) => {
    const field = (key) => {
      const line = chunk.split('\n').find((l) => l.startsWith(key + ':'));
      return line ? line.slice(key.length + 1).trim() : '';
    };
    return {
      name: field('Name'),
      mana: forgeMana(field('ManaCost')),
      types: field('Types'),
      pt: field('PT'),
      loyalty: field('Loyalty'),
      oracle: field('Oracle').replace(/\\n/g, '\n'),
    };
  }).filter((face) => face.name);
}

// Ask Forge. Resolves to the parsed faces, or null when the card is not there —
// which, unlike the Scryfall call, cannot be confused with the network refusing,
// because a reachable raw.githubusercontent.com is the premise of trying at all.
async function fromForge(name, get = fetch) {
  for (const url of forgePaths(name)) {
    const res = await get(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) continue;
    const parsed = parseForge(await res.text());
    if (parsed.length) return parsed;
  }
  return null;
}

// Scryfall's three outcomes, kept apart because the fallback's wording depends on
// which one it is. A 404 is Scryfall answering — the name is wrong. Anything else,
// including a throw, is Scryfall not answering, and says nothing about the name.
async function fromScryfall(name) {
  let res;
  try {
    res = await fetch(NAMED + encodeURIComponent(name), {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    });
  } catch (err) {
    return { blocked: err.message };
  }
  if (res.status === 404) return { missing: true };
  if (!res.ok) return { blocked: 'HTTP ' + res.status };
  return { card: await res.json() };
}

// Which of the four outcomes this is, and what to say about it. Kept as a function
// of the two answers rather than as branches inside the printing, because this is
// the decision the whole fallback exists to get right: a card that came from Forge
// must never read as Scryfall's word, and a name that failed because the network
// was refused must never be reported as a misspelling. Both of those are wrong in
// the direction a reader cannot detect.
function verdict(scry, faceList, cached) {
  // The cache first, and it outranks a live fetch rather than backing it up. What is in
  // it *is* Scryfall's wording — a runner read it and committed it — so asking again buys
  // a fresher date and nothing else, at the cost of a request that this sandbox cannot
  // make anyway. The age is printed instead, which is the honest version of the same
  // information.
  if (cached) return { source: 'cache', age: CardText.ageNote(cached.fetched) };
  if (scry.card) return { source: 'scryfall' };
  if (faceList) {
    return {
      source: 'forge',
      why: scry.missing
        ? 'Scryfall has no card by exactly that name and Forge does — so the name is '
          + 'probably right and Scryfall wants a different spelling of it.'
        : `Scryfall could not be reached (${scry.blocked}), which says nothing about the name.`,
    };
  }
  return {
    source: 'none',
    why: scry.missing
      ? 'Neither Scryfall nor Forge has a card by that name — check the spelling.'
      : `Scryfall could not be reached (${scry.blocked}) and Forge has no card by that `
        + 'name. If the network is the problem, both of those are the same symptom.',
  };
}

// What Forge's answer is worth, said every time it is used rather than once in a
// header nobody scrolls to.
function forgeBanner(why) {
  return [
    `> **From Forge's card script, not Scryfall.** ${why}`,
    '>',
    '> Oracle text only — no colour identity, no legality, no printings. Forge maintains',
    '> this wording rather than Wizards, so cross-check anything a reading turns on',
    '> (XMage is the usual second opinion). See the README, *Reading a card when',
    '> Scryfall is unreachable*.',
  ];
}

function sayForge(faceList, why) {
  say(`### ${faceList.map((f) => f.name).join(' // ')}`);
  say();
  forgeBanner(why).forEach(say);
  say();
  const mana = faceList.map((f) => f.mana).filter(Boolean).join(' // ');
  say(`- mana cost: \`${mana || '—'}\``);
  say();
  for (const face of faceList) {
    say(`**${face.types || '(no type line)'}**`);
    say();
    say('```');
    say(face.oracle || '(no rules text)');
    say('```');
    if (face.pt) say(`_${face.pt}_`);
    if (face.loyalty) say(`_loyalty ${face.loyalty}_`);
    say();
  }
}

// A cached entry, printed the way a live one is. It came from Scryfall, so it gets
// Scryfall's fields and no banner — the only difference is a line saying when it was read.
// Deliberately not shaped like forgeBanner(): a warning that appears on every card is a
// warning nobody reads, and this one is only ever a prompt to re-fetch.
function sayCached(entry, age) {
  say(`### ${entry.name}`);
  say();
  if (age) say(`_${age}_`);
  if (age) say();
  say(`- mana cost: \`${entry.mana || '—'}\``);
  say(`- colour identity: \`${entry.identity || 'colourless'}\``);
  say(`- commander legal: ${entry.commanderLegal ? 'yes' : 'no'}`);
  say();
  for (const face of entry.faces || []) {
    say(`**${face.types || '(no type line)'}**`);
    say();
    say('```');
    say(face.oracle || '(no rules text)');
    say('```');
    if (face.pt) say(`_${face.pt}_`);
    if (face.loyalty) say(`_loyalty ${face.loyalty}_`);
    say();
  }
}

async function lookup(name, cache) {
  const cached = cache ? CardText.lookup(cache, name) : null;
  // No request at all when the cache has it. That is the point of the cache: a research
  // pass reading forty cards makes no network calls, and works in a sandbox where every
  // Scryfall host is refused at CONNECT.
  if (cached) {
    sayCached(cached, CardText.ageNote(cached.fetched));
    return;
  }
  const scry = await fromScryfall(name);
  // Forge is asked whenever Scryfall did not hand back a card. When Scryfall is
  // blocked that is the whole point; when it 404s it is still worth asking, because
  // a card Forge has under this name and Scryfall does not is a spelling this tool
  // can then show you rather than leave you to find.
  const faceList = scry.card ? null : await fromForge(name).catch(() => null);
  const answer = verdict(scry, faceList, null);

  if (answer.source === 'forge') return sayForge(faceList, answer.why);
  if (answer.source === 'none') {
    say(`### ${name}`);
    say(answer.why);
    say();
    return;
  }

  const card = scry.card;

  say(`### ${card.name}`);
  say();
  say(`- mana cost: \`${card.mana_cost || faces(card).map((f) => f.mana_cost).filter(Boolean).join(' // ') || '—'}\``);
  say(`- colour identity: \`${(card.color_identity || []).join('') || 'colourless'}\``);
  say(`- commander legal: ${card.legalities && card.legalities.commander === 'legal' ? 'yes' : 'no'}`);
  say();
  for (const face of faces(card)) {
    say(`**${face.type_line || '(no type line)'}**`);
    say();
    say('```');
    say((face.oracle_text || '(no rules text)').trim());
    say('```');
    if (face.power || face.toughness) say(`_${face.power}/${face.toughness}_`);
    say();
  }
}

async function main() {
  const fromEnv = (process.env.CARDS || '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  const names = process.argv.slice(2).length ? process.argv.slice(2) : fromEnv;
  if (!names.length) {
    console.error('Give one or more card names, or set CARDS="A; B".');
    process.exit(2);
  }

  // Read once, not per card. Also worth reporting: "the cache answered" and "the cache is
  // empty" look identical from the output of a single lookup, and the difference is whether
  // the workflow has ever been run.
  const cache = CardText.read();

  say('# Card text');
  say();
  if (cache.count) say(`_${cache.count} card(s) in \`card-text.json\`; anything in there is answered without a request._`);
  else say('_No `card-text.json` yet — run the "Cache card text" workflow to fill it. Falling back to Scryfall, then Forge._');
  say();
  for (const name of names) {
    try {
      await lookup(name, cache);
    } catch (err) {
      say(`### ${name}`);
      say(`Lookup failed: ${err.message}`);
      say();
    }
    // Scryfall asks for 50-100ms between requests; this is well inside that. Skipped
    // entirely when the cache answered, because there was no request to be polite about —
    // which is what makes a forty-card pass instant rather than eight seconds.
    if (!CardText.lookup(cache, name)) await wait(200);
  }

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) require('node:fs').appendFileSync(summary, out.join('\n') + '\n');
}

// The fetching and the printing stay here; the parts that can be wrong without
// anybody noticing go out, because a slug that reaches nothing looks exactly like
// a card Forge does not have. test/lookup-card.test.js holds them.
module.exports = { forgeSlug, forgePaths, forgeMana, parseForge, fromForge, verdict, forgeBanner };

if (require.main === module) {
  main().catch((err) => { console.error('Lookup failed:', err); process.exit(1); });
}
