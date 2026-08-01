const test = require('node:test');
const assert = require('node:assert');
const {
  parseDecklist, parseLine, fromMoxfield, fromArchidekt, parseDeckUrl, describeLoadFailure,
} = require('../parser.js');

test('parseLine: plain name', () => {
  assert.deepStrictEqual(parseLine('Sol Ring'),
    { name: 'Sol Ring', quantity: 1, sideboardPrefix: false, commander: false });
});

test('parseLine: quantity variants', () => {
  assert.strictEqual(parseLine('1 Sol Ring').quantity, 1);
  assert.strictEqual(parseLine('4x Lightning Bolt').quantity, 4);
  assert.strictEqual(parseLine('4X Lightning Bolt').name, 'Lightning Bolt');
});

test('parseLine: Moxfield/Arena export annotations are stripped', () => {
  assert.strictEqual(parseLine('1 Sol Ring (C21) 263').name, 'Sol Ring');
  assert.strictEqual(parseLine('1 Sol Ring (C21) 263 *F*').name, 'Sol Ring');
  assert.strictEqual(parseLine('1 Fabled Passage [ELD]').name, 'Fabled Passage');
  assert.strictEqual(parseLine('1 Arcane Signet (CMM) 951 #!Commander').name, 'Arcane Signet');
});

test('parseLine: the commander marker is read, then stripped from the name', () => {
  const mox = parseLine('1 Kinnan, Bonder Prodigy (C21) 3 *CMDR*');
  assert.strictEqual(mox.name, 'Kinnan, Bonder Prodigy');
  assert.strictEqual(mox.commander, true);

  const archidekt = parseLine('1x Kinnan, Bonder Prodigy (c21) 3 [Commander{top}]');
  assert.strictEqual(archidekt.name, 'Kinnan, Bonder Prodigy');
  assert.strictEqual(archidekt.commander, true);
});

test('parseLine: Archidekt category tags are not commander markers', () => {
  const ramp = parseLine('1x Sol Ring (c21) 263 [Ramp,Artifact]');
  assert.strictEqual(ramp.name, 'Sol Ring');
  assert.strictEqual(ramp.commander, false);
  // A Moxfield tag that merely says "Commander" is not the commander marker.
  assert.strictEqual(parseLine('1 Arcane Signet (CMM) 951 #!Commander').commander, false);
});

test('parseDecklist: a marked card is the commander wherever it sits', () => {
  // Exactly what Moxfield's export gives you: no headings, commander inline.
  const deck = parseDecklist([
    '1 Kinnan, Bonder Prodigy (C21) 3 *CMDR*',
    '1 Basalt Monolith (C21) 210',
    '1 Sol Ring (C21) 263 *F*',
  ].join('\n'));
  assert.deepStrictEqual(deck.commanders.map((c) => c.card), ['Kinnan, Bonder Prodigy']);
  assert.deepStrictEqual(deck.main.map((c) => c.card), ['Basalt Monolith', 'Sol Ring']);
  assert.deepStrictEqual(deck.skipped, []);
});

test('parseLine: names containing numbers and commas survive', () => {
  assert.strictEqual(parseLine('1 Borrowing 100,000 Arrows').name, 'Borrowing 100,000 Arrows');
  assert.strictEqual(parseLine('Kinnan, Bonder Prodigy').name, 'Kinnan, Bonder Prodigy');
});

test('parseLine: comments and blanks are skipped', () => {
  assert.strictEqual(parseLine('// lands'), null);
  assert.strictEqual(parseLine('# ramp package'), null);
  assert.strictEqual(parseLine('   '), null);
});

test('parseDecklist: commander section is separated from the main deck', () => {
  const deck = parseDecklist([
    'Commander:',
    '1 Kinnan, Bonder Prodigy',
    '',
    'Deck',
    '1 Basalt Monolith',
    '1 Rings of Brighthearth',
  ].join('\n'));
  assert.deepStrictEqual(deck.commanders, [{ card: 'Kinnan, Bonder Prodigy', quantity: 1 }]);
  assert.deepStrictEqual(deck.main, [
    { card: 'Basalt Monolith', quantity: 1 },
    { card: 'Rings of Brighthearth', quantity: 1 },
  ]);
});

test('parseDecklist: decorated section headings still switch board', () => {
  const deck = parseDecklist([
    'Commander (1)',
    '1 Kinnan, Bonder Prodigy',
    'Deck (99):',
    '1 Sol Ring',
    'Sideboard (15)',
    '1 Pithing Needle',
  ].join('\n'));
  assert.deepStrictEqual(deck.commanders, [{ card: 'Kinnan, Bonder Prodigy', quantity: 1 }]);
  assert.deepStrictEqual(deck.main, [{ card: 'Sol Ring', quantity: 1 }]);
});

test('parseDecklist: category headings are skipped, not treated as cards', () => {
  const deck = parseDecklist([
    'Creatures (24)',
    '1 Birds of Paradise',
    'Lands [37]',
    '12 Forest',
  ].join('\n'));
  assert.deepStrictEqual(deck.main, [
    { card: 'Birds of Paradise', quantity: 1 },
    { card: 'Forest', quantity: 12 },
  ]);
  assert.deepStrictEqual(deck.skipped.map((s) => s.line), ['Creatures (24)', 'Lands [37]']);
});

test('parseDecklist: a set code is not mistaken for a category count', () => {
  const deck = parseDecklist('1 Sol Ring (C21) 263\nSol Ring (C21)');
  assert.deepStrictEqual(deck.main, [{ card: 'Sol Ring', quantity: 2 }]);
  assert.deepStrictEqual(deck.skipped, []);
});

test('parseDecklist: any sideboard mention stops collection', () => {
  const deck = parseDecklist([
    '1 Sol Ring',
    'Sideboard cards',
    '1 Pithing Needle',
  ].join('\n'));
  assert.deepStrictEqual(deck.main, [{ card: 'Sol Ring', quantity: 1 }]);
});

test('parseDecklist: blank lines are skipped silently, junk is reported', () => {
  const deck = parseDecklist('\n\n1 Sol Ring\n\n   \n');
  assert.deepStrictEqual(deck.main, [{ card: 'Sol Ring', quantity: 1 }]);
  assert.deepStrictEqual(deck.skipped, []);
});

test('parseDecklist: quantities and digits in names both survive', () => {
  const deck = parseDecklist([
    '10 Island',
    '1 Borrowing 100,000 Arrows',
    '4x Ancestral Vision',
    '2 Fire // Ice',
  ].join('\n'));
  assert.deepStrictEqual(deck.main, [
    { card: 'Island', quantity: 10 },
    { card: 'Borrowing 100,000 Arrows', quantity: 1 },
    { card: 'Ancestral Vision', quantity: 4 },
    { card: 'Fire // Ice', quantity: 2 },
  ]);
});

test('parseDecklist: sideboard and maybeboard are ignored', () => {
  const deck = parseDecklist([
    '1 Sol Ring',
    'Sideboard:',
    '1 Pithing Needle',
    'Maybeboard',
    '1 Mystic Remora',
  ].join('\n'));
  assert.deepStrictEqual(deck.main, [{ card: 'Sol Ring', quantity: 1 }]);
});

test('parseDecklist: SB:-prefixed MTGO lines are ignored', () => {
  const deck = parseDecklist('1 Sol Ring\nSB: 1 Pithing Needle');
  assert.deepStrictEqual(deck.main, [{ card: 'Sol Ring', quantity: 1 }]);
});

test('parseDecklist: duplicate lines merge quantities', () => {
  const deck = parseDecklist('2 Island\n3 Island');
  assert.deepStrictEqual(deck.main, [{ card: 'Island', quantity: 5 }]);
});

test('parseDecklist: empty input', () => {
  assert.deepStrictEqual(parseDecklist(''), { commanders: [], main: [], skipped: [] });
  assert.deepStrictEqual(parseDecklist(null), { commanders: [], main: [], skipped: [] });
});

test('fromMoxfield: v3 board shape', () => {
  const deck = fromMoxfield({
    boards: {
      commanders: { cards: { a: { quantity: 1, card: { name: 'Kinnan, Bonder Prodigy' } } } },
      mainboard: {
        cards: {
          b: { quantity: 1, card: { name: 'Basalt Monolith' } },
          c: { quantity: 1, card: { name: 'Walking Ballista' } },
        },
      },
    },
  });
  assert.deepStrictEqual(deck.commanders, [{ card: 'Kinnan, Bonder Prodigy', quantity: 1 }]);
  assert.strictEqual(deck.main.length, 2);
});

test('fromMoxfield: v2 flat shape', () => {
  const deck = fromMoxfield({
    commanders: { 'Kinnan, Bonder Prodigy': { quantity: 1 } },
    mainboard: { 'Sol Ring': { quantity: 1 } },
  });
  assert.deepStrictEqual(deck.commanders, [{ card: 'Kinnan, Bonder Prodigy', quantity: 1 }]);
  assert.deepStrictEqual(deck.main, [{ card: 'Sol Ring', quantity: 1 }]);
});

test('parseDeckUrl: recognizes Moxfield and Archidekt URLs', () => {
  assert.strictEqual(parseDeckUrl('https://moxfield.com/decks/aBc123_-xyz').id, 'aBc123_-xyz');
  assert.strictEqual(parseDeckUrl('https://www.moxfield.com/decks/aBc123/primer').site, 'moxfield');
  assert.strictEqual(parseDeckUrl('https://archidekt.com/decks/12345/my_deck').id, '12345');
  assert.strictEqual(parseDeckUrl('https://www.archidekt.com/api/decks/9876/').site, 'archidekt');
  assert.strictEqual(parseDeckUrl('https://example.com/nope'), null);
  assert.strictEqual(parseDeckUrl(''), null);
});

test('parseDeckUrl: Moxfield is flagged as un-loadable from a browser', () => {
  const mox = parseDeckUrl('https://moxfield.com/decks/aBc123');
  assert.strictEqual(mox.browserImport, false);
  assert.match(mox.exportHint, /Export/);
  assert.strictEqual(parseDeckUrl('https://archidekt.com/decks/1').browserImport, true);
});

test('describeLoadFailure: a blocked request is not reported as a missing deck', () => {
  // Browsers surface a CORS/network block as a TypeError carrying no status.
  const blocked = describeLoadFailure(new TypeError('Load failed'), 'moxfield');
  assert.match(blocked, /blocked/i);
  assert.doesNotMatch(blocked, /HTTP/);

  const notFound = describeLoadFailure(Object.assign(new Error('HTTP 404'), { status: 404 }), 'archidekt');
  assert.match(notFound, /private|check the URL/i);

  const forbidden = describeLoadFailure(Object.assign(new Error('HTTP 403'), { status: 403 }), 'archidekt');
  assert.match(forbidden, /private/i);

  const odd = describeLoadFailure(Object.assign(new Error('HTTP 500'), { status: 500 }), 'archidekt');
  assert.match(odd, /HTTP 500/);
});

test('fromArchidekt: commander category and excluded boards', () => {
  const deck = fromArchidekt({
    categories: [
      { name: 'Commander', includedInDeck: true },
      { name: 'Cut cards', includedInDeck: false },
    ],
    cards: [
      { quantity: 1, categories: ['Commander'], card: { oracleCard: { name: 'Kinnan, Bonder Prodigy' } } },
      { quantity: 1, categories: ['Ramp'], card: { oracleCard: { name: 'Sol Ring' } } },
      { quantity: 1, categories: ['Maybeboard'], card: { oracleCard: { name: 'Mystic Remora' } } },
      { quantity: 1, categories: ['Cut cards'], card: { oracleCard: { name: 'Pithing Needle' } } },
    ],
  });
  assert.deepStrictEqual(deck.commanders, [{ card: 'Kinnan, Bonder Prodigy', quantity: 1 }]);
  assert.deepStrictEqual(deck.main, [{ card: 'Sol Ring', quantity: 1 }]);
});

test('fromArchidekt: tolerates missing categories and card.name fallback', () => {
  const deck = fromArchidekt({
    cards: [{ quantity: 2, card: { name: 'Island' } }],
  });
  assert.deepStrictEqual(deck.main, [{ card: 'Island', quantity: 2 }]);
});

// ---- writing a card back into a decklist ------------------------------------
//
// "+ Add to deck" appends to the box someone is already holding, and the box does
// not always end where the main deck does. A list ending in "Sideboard:" is how
// several sites export; a card written below that heading parses as a sideboard
// card, never enters the deck, and comes straight back as a suggestion — the button
// appears to do nothing. This is the reported bug.
const { addMainDeckCard, mainDeckInsertIndex } = require('../parser.js');

const mainNames = (text) => parseDecklist(text).main.map((e) => e.card);

test('add: a plain list gets the card at the end', () => {
  assert.deepStrictEqual(
    mainNames(addMainDeckCard('1 Sol Ring\n1 Island', 'Heliod, Sun-Crowned', 1)),
    ['Sol Ring', 'Island', 'Heliod, Sun-Crowned']
  );
});

test('add: a card goes above a trailing Sideboard section, not into it', () => {
  const out = addMainDeckCard('1 Sol Ring\n\nSideboard:\n1 Pithing Needle', 'Heliod, Sun-Crowned', 1);
  const parsed = parseDecklist(out);
  assert.deepStrictEqual(parsed.main.map((e) => e.card), ['Sol Ring', 'Heliod, Sun-Crowned']);
  // And the sideboard is still a sideboard.
  assert.ok(parsed.skipped.some((s) => /Pithing Needle/.test(s.line)));
});

test('add: the same holds for a bare SIDEBOARD heading', () => {
  const out = addMainDeckCard('1 Sol Ring\n\nSIDEBOARD:\n1 Pithing Needle', 'Heliod, Sun-Crowned', 1);
  assert.deepStrictEqual(mainNames(out), ['Sol Ring', 'Heliod, Sun-Crowned']);
});

// Quieter than the sideboard case and worse: the card would have joined the command
// zone without anything on screen saying so.
test('add: a card does not become a commander', () => {
  const out = addMainDeckCard('1 Sol Ring\n\nCommander:\n1 Kinnan, Bonder Prodigy', 'Heliod, Sun-Crowned', 1);
  const parsed = parseDecklist(out);
  assert.deepStrictEqual(parsed.main.map((e) => e.card), ['Sol Ring', 'Heliod, Sun-Crowned']);
  assert.deepStrictEqual(parsed.commanders.map((e) => e.card), ['Kinnan, Bonder Prodigy']);
});

test('add: the first section wins when a list has several', () => {
  const deck = '1 Sol Ring\n\nSideboard:\n1 Pithing Needle\n\nCommander:\n1 Kinnan, Bonder Prodigy';
  const parsed = parseDecklist(addMainDeckCard(deck, 'Heliod, Sun-Crowned', 1));
  assert.deepStrictEqual(parsed.main.map((e) => e.card), ['Sol Ring', 'Heliod, Sun-Crowned']);
  assert.deepStrictEqual(parsed.commanders.map((e) => e.card), ['Kinnan, Bonder Prodigy']);
});

test('add: an empty box gets a list with one card in it', () => {
  assert.strictEqual(addMainDeckCard('', 'Sol Ring', 1), '1 Sol Ring');
  assert.deepStrictEqual(mainNames(addMainDeckCard('', 'Sol Ring', 1)), ['Sol Ring']);
});

test('add: quantity is written through', () => {
  assert.strictEqual(addMainDeckCard('1 Island', 'Forest', 4), '1 Island\n4 Forest');
});

// The insertion point is the parser's own idea of where the main deck stops, so the
// two cannot drift apart when a site invents a new heading.
test('add: the insert index is the first line that leaves the main deck', () => {
  assert.strictEqual(mainDeckInsertIndex('1 Sol Ring\n1 Island'), 2);
  assert.strictEqual(mainDeckInsertIndex('1 Sol Ring\nSideboard:\n1 Needle'), 1);
  assert.strictEqual(mainDeckInsertIndex('Deck:\n1 Sol Ring\nCommander:\n1 Kinnan'), 2);
});
