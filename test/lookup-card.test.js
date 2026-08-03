'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  forgeSlug, forgePaths, forgeMana, parseForge, fromForge, verdict, forgeBanner,
} = require('../tools/lookup-card.js');

// The Forge fallback exists because Scryfall is not always reachable — an agent
// sandbox whose proxy allowlists raw.githubusercontent.com refuses every Scryfall
// host — and Forge ships its card scripts as files on the host that is allowed.
//
// What is tested here is the half that fails *quietly*. A slug that reaches nothing
// is indistinguishable from a card Forge does not have: the tool says "no card by
// that name", the reader believes it, and the fallback is silently useless. Every
// case below is a real card name that broke the obvious rule.

test('forge slug: the ordinary case is lowercase words joined by underscores', () => {
  assert.strictEqual(forgeSlug('Academy Manufactor'), 'academy_manufactor');
  assert.strictEqual(forgeSlug('Cauldron Familiar'), 'cauldron_familiar');
});

test('forge slug: accents are folded, not dropped with their letter', () => {
  assert.strictEqual(forgeSlug('Éomer, Marshal of Rohan'), 'eomer_marshal_of_rohan');
  assert.strictEqual(forgeSlug('Bartolomé del Presidio'), 'bartolome_del_presidio');
  assert.strictEqual(forgeSlug('Arwen Undómiel'), 'arwen_undomiel');
});

// An apostrophe closes the word up; every other punctuation mark parts it. Getting
// this backwards is the difference between ashnods_altar and ashnod_s_altar, and
// between m_o_d_o_k and modok — both of which 404.
test('forge slug: apostrophes vanish where other punctuation separates', () => {
  assert.strictEqual(forgeSlug("Ashnod's Altar"), 'ashnods_altar');
  assert.strictEqual(forgeSlug('Ashnod’s Altar'), 'ashnods_altar', 'a curly apostrophe too');
  assert.strictEqual(forgeSlug('M.O.D.O.K.'), 'm_o_d_o_k');
  assert.strictEqual(forgeSlug('Captain James T. Kirk'), 'captain_james_t_kirk');
  assert.strictEqual(forgeSlug('Kaya, Geist Hunter'), 'kaya_geist_hunter');
  assert.strictEqual(forgeSlug('Glamdring, Foe-hammer'), 'glamdring_foe_hammer');
  assert.strictEqual(forgeSlug('With Great Power . . .'), 'with_great_power');
});

// The one that cost the most to find. Forge files a split or double-faced card under
// both of its faces joined, so the front face on its own reaches nothing at all.
test('forge slug: a split card is filed under both faces, not the front one', () => {
  assert.strictEqual(
    forgeSlug('Birgi, God of Storytelling // Harnfel, Horn of Bounty'),
    'birgi_god_of_storytelling_harnfel_horn_of_bounty'
  );
  assert.strictEqual(
    forgeSlug('Lunarch Veteran // Luminous Phantom'),
    'lunarch_veteran_luminous_phantom'
  );
});

test('forge slug: a name with nothing usable in it is empty rather than a bad path', () => {
  assert.strictEqual(forgeSlug('  '), '');
  assert.deepStrictEqual(forgePaths('  '), [], 'an empty slug must not become /.txt');
});

// Recent sets are not in the letter directory, so proving a card absent costs two
// requests. Dropping the second one would quietly lose every card from the newest
// sets — which is exactly the half of the database a substitution pass is short of.
test('forge paths: the letter directory first, then upcoming/', () => {
  assert.deepStrictEqual(forgePaths('Smaug the Impenetrable'), [
    'https://raw.githubusercontent.com/Card-Forge/forge/master/forge-gui/res/cardsfolder/'
      + 's/smaug_the_impenetrable.txt',
    'https://raw.githubusercontent.com/Card-Forge/forge/master/forge-gui/res/cardsfolder/'
      + 'upcoming/smaug_the_impenetrable.txt',
  ]);
});

test('forge paths: the directory is the first letter of the slug, not of the name', () => {
  assert.match(forgePaths('Éomer, Marshal of Rohan')[0], /cardsfolder\/e\/eomer_/);
});

// ---- mana ---------------------------------------------------------------------
//
// Forge separates symbols with spaces and writes a hybrid as two letters with no
// space between them, so the space is load-bearing: "G W" is Samwise's {G}{W} and
// "RW" is Figure of Destiny's one {R/W}.

test('forge mana: space-separated symbols each get their own braces', () => {
  assert.strictEqual(forgeMana('3 B B'), '{3}{B}{B}');
  assert.strictEqual(forgeMana('G W'), '{G}{W}');
  assert.strictEqual(forgeMana('X C C'), '{X}{C}{C}');
  assert.strictEqual(forgeMana('3'), '{3}');
});

test('forge mana: two colour letters with no space between them are one hybrid', () => {
  assert.strictEqual(forgeMana('RW'), '{R/W}');
  assert.strictEqual(forgeMana('2W'), '{2/W}');
  assert.strictEqual(forgeMana('WP'), '{W/P}');
});

test('forge mana: a land has no cost rather than an empty pair of braces', () => {
  assert.strictEqual(forgeMana('no cost'), '');
  assert.strictEqual(forgeMana(''), '');
  assert.strictEqual(forgeMana(undefined), '');
});

// Passing an unrecognised symbol through is the deliberate choice: a cost rendered
// oddly is visible, and a cost rendered wrong is not.
test('forge mana: an unrecognised symbol is passed through, not guessed at', () => {
  assert.strictEqual(forgeMana('QQ 4'), '{QQ}{4}');
});

// ---- the card script ------------------------------------------------------------

const MANUFACTOR = [
  'Name:Academy Manufactor',
  'ManaCost:3',
  'Types:Artifact Creature Assembly-Worker',
  'PT:1/3',
  'R:Event$ CreateToken | ValidToken$ Clue,Food,Treasure | ReplaceWith$ TokenReplace',
  'Oracle:If you would create a Clue, Food, or Treasure token, instead create one of each.',
].join('\n');

test('parse: the fields the tool prints come off the script', () => {
  const [face] = parseForge(MANUFACTOR);
  assert.strictEqual(face.name, 'Academy Manufactor');
  assert.strictEqual(face.mana, '{3}');
  assert.strictEqual(face.types, 'Artifact Creature Assembly-Worker');
  assert.strictEqual(face.pt, '1/3');
  assert.strictEqual(
    face.oracle,
    'If you would create a Clue, Food, or Treasure token, instead create one of each.'
  );
});

// Forge escapes the line breaks inside an Oracle: line. Left alone, a card with three
// abilities prints as one run-on sentence — which is how a reader misses that the
// second ability is a sacrifice outlet.
test('parse: an escaped newline in the oracle text becomes a real one', () => {
  const [face] = parseForge([
    'Name:Cauldron Familiar',
    'ManaCost:B',
    'Types:Creature Cat',
    'PT:1/1',
    'Oracle:When Cauldron Familiar enters, each opponent loses 1 life and you gain 1 life.'
      + '\\nSacrifice a Food: Return Cauldron Familiar from your graveyard to the battlefield.',
  ].join('\n'));
  assert.strictEqual(face.oracle.split('\n').length, 2);
  assert.match(face.oracle.split('\n')[1], /^Sacrifice a Food:/);
});

test('parse: ALTERNATE divides a script into its faces', () => {
  const faceList = parseForge([
    'Name:Birgi, God of Storytelling',
    'ManaCost:2 R',
    'Types:Legendary Creature God',
    'PT:3/3',
    'Oracle:Whenever you cast a spell, add {R}.',
    '',
    'ALTERNATE',
    '',
    'Name:Harnfel, Horn of Bounty',
    'ManaCost:4 R',
    'Types:Legendary Artifact',
    'Oracle:Discard a card: Exile the top two cards of your library.',
  ].join('\n'));
  assert.strictEqual(faceList.length, 2);
  assert.deepStrictEqual(faceList.map((f) => f.name),
    ['Birgi, God of Storytelling', 'Harnfel, Horn of Bounty']);
  assert.strictEqual(faceList[1].pt, '', 'the back face is an artifact and has none');
});

test('parse: a body that is not a card script yields no faces', () => {
  assert.deepStrictEqual(parseForge('404: Not Found'), []);
  assert.deepStrictEqual(parseForge(''), []);
});

// A planeswalker's loyalty sits where a creature's PT does, and printing neither
// would lose the only number on the card.
test('parse: loyalty is read as well as power and toughness', () => {
  const [face] = parseForge([
    'Name:Quintorius, History Chaser',
    'ManaCost:2 R W',
    'Types:Legendary Planeswalker Quintorius',
    'Loyalty:3',
    'Oracle:Whenever one or more cards leave your graveyard, create a Spirit.',
  ].join('\n'));
  assert.strictEqual(face.loyalty, '3');
  assert.strictEqual(face.pt, '');
});

// ---- the two requests, without the network ---------------------------------------

const reply = (body) => ({ ok: true, text: async () => body });
const gone = { ok: false, status: 404, text: async () => '404: Not Found' };

test('fromForge: the letter directory answers and upcoming/ is never asked', async () => {
  const asked = [];
  const faceList = await fromForge('Academy Manufactor', async (url) => {
    asked.push(url);
    return reply(MANUFACTOR);
  });
  assert.strictEqual(asked.length, 1);
  assert.match(asked[0], /\/a\/academy_manufactor\.txt$/);
  assert.strictEqual(faceList[0].name, 'Academy Manufactor');
});

test('fromForge: a miss in the letter directory falls through to upcoming/', async () => {
  const asked = [];
  const faceList = await fromForge('Academy Manufactor', async (url) => {
    asked.push(url);
    return asked.length === 1 ? gone : reply(MANUFACTOR);
  });
  assert.strictEqual(asked.length, 2);
  assert.match(asked[1], /\/upcoming\/academy_manufactor\.txt$/);
  assert.ok(faceList, 'the card was there and the fallback did not find it');
});

test('fromForge: absent from both is null, not an empty card', async () => {
  assert.strictEqual(await fromForge('Not A Real Card', async () => gone), null);
});

// A 200 that is not a card script must not read as a hit — GitHub serves a Pages
// 404 page with a 200 on some paths, and half a card is worse than none.
test('fromForge: a 200 carrying no card script keeps looking, then gives up', async () => {
  let calls = 0;
  const faceList = await fromForge('Academy Manufactor', async () => {
    calls += 1;
    return reply('<!doctype html><title>404</title>');
  });
  assert.strictEqual(faceList, null);
  assert.strictEqual(calls, 2, 'it should still have tried upcoming/');
});

// ---- which of the two was wrong ---------------------------------------------
//
// The decision the fallback exists to get right. Both ways of getting it wrong are
// invisible to the reader: Forge's wording passed off as Scryfall's, and a blocked
// host reported as a misspelling. The second is the one that was already happening.

const FACES = [{ name: 'Academy Manufactor', mana: '{3}', types: 'Artifact Creature', pt: '1/3', oracle: 'x' }];

test('verdict: a card from Scryfall is Scryfall’s, with nothing to explain', () => {
  assert.deepStrictEqual(verdict({ card: { name: 'Academy Manufactor' } }, null), { source: 'scryfall' });
});

test('verdict: Scryfall blocked and Forge answering is labelled Forge, and blames the network', () => {
  const v = verdict({ blocked: 'HTTP 403' }, FACES);
  assert.strictEqual(v.source, 'forge');
  assert.match(v.why, /could not be reached \(HTTP 403\)/);
  assert.match(v.why, /says nothing about the name/,
    'a blocked host must not be reported as anything about the spelling');
  assert.doesNotMatch(v.why, /check the spelling/);
});

test('verdict: Scryfall 404 and Forge answering points at the spelling Scryfall wants', () => {
  const v = verdict({ missing: true }, FACES);
  assert.strictEqual(v.source, 'forge');
  assert.match(v.why, /Scryfall has no card by exactly that name and Forge does/);
});

test('verdict: neither having it, with Scryfall answering, is a spelling problem', () => {
  const v = verdict({ missing: true }, null);
  assert.strictEqual(v.source, 'none');
  assert.match(v.why, /check the spelling/);
});

// The failure this whole change is about. Before it, every one of these printed
// "check the spelling" — and the spelling was fine.
test('verdict: neither having it, with Scryfall blocked, does not blame the spelling', () => {
  const v = verdict({ blocked: 'HTTP 403' }, null);
  assert.strictEqual(v.source, 'none');
  assert.doesNotMatch(v.why, /check the spelling/);
  assert.match(v.why, /the same symptom/);
});

test('banner: Forge’s answer says what it is and what it is missing', () => {
  const lines = forgeBanner('because.').join('\n');
  assert.match(lines, /not Scryfall/);
  assert.match(lines, /no colour identity, no legality, no printings/);
  assert.ok(lines.split('\n').every((l) => l.startsWith('>')), 'it has to render as a blockquote');
});
