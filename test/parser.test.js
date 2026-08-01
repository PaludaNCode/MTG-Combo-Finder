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

// ---- when the heading and the card count disagree --------------------------
//
// Every rule above trusts the heading. This one does not, and it is the only place
// in the parser that overrules a section the exporter wrote. The shape is a deck
// pasted under a "Commander" heading with no "Deck" heading after it — common
// enough, because that is what you get by copying a Moxfield export from the
// commander down and dropping the second heading. Believed literally it produces a
// hundred-card command zone, and since colour identity comes from the command zone
// the deck ends up filtered against itself.

const bigZone = (n) => ['Commander']
  .concat(Array.from({ length: n }, (_, i) => '1 Card ' + (i + 1)))
  .join('\n');

test('zone: a command zone larger than a command zone is read as the deck', () => {
  const parsed = parseDecklist(bigZone(20));
  assert.deepStrictEqual(parsed.commanders, []);
  assert.strictEqual(parsed.main.length, 20);
});

test('zone: a real command zone is left alone', () => {
  const parsed = parseDecklist('Commanders\n1 Thrasios, Triton Hero\n1 Tymna the Weaver\n\nDeck\n1 Sol Ring');
  assert.deepStrictEqual(
    parsed.commanders.map((e) => e.card),
    ['Thrasios, Triton Hero', 'Tymna the Weaver']
  );
  assert.deepStrictEqual(parsed.main.map((e) => e.card), ['Sol Ring']);
});

// Pinned either side of the line rather than derived from the constant, so moving
// the threshold has to be a deliberate edit to this test as well.
test('zone: the threshold sits between a plausible zone and an implausible one', () => {
  assert.strictEqual(parseDecklist(bigZone(4)).commanders.length, 4, 'four is a zone, oddly built');
  assert.strictEqual(parseDecklist(bigZone(15)).commanders.length, 15, 'fifteen is still believed');
  assert.strictEqual(parseDecklist(bigZone(16)).commanders.length, 0, 'sixteen is a deck');
  assert.strictEqual(parseDecklist(bigZone(16)).main.length, 16);
});

test('zone: a card added to one lands in the deck, not the command zone', () => {
  const out = addMainDeckCard(bigZone(20), 'Heliod, Sun-Crowned', 1);
  const parsed = parseDecklist(out);
  assert.deepStrictEqual(parsed.commanders, []);
  assert.strictEqual(parsed.main.length, 21);
  // Under the block, where someone would have typed it — not at the top of the box.
  assert.strictEqual(out.split('\n').pop(), '1 Heliod, Sun-Crowned');
});

test('zone: duplicates fold together rather than doubling up', () => {
  const parsed = parseDecklist(bigZone(20) + '\nDeck\n1 Card 1\n1 Sol Ring');
  assert.strictEqual(parsed.main.length, 21);
  assert.strictEqual(parsed.main.find((e) => e.card === 'Card 1').quantity, 2);
});

// MTGO marks its sideboard per line, so the main deck never formally ends and the
// insertion point has to notice the prefix on its own.
test('add: an MTGO list takes the card above its SB: lines', () => {
  const out = addMainDeckCard('1 Arcane Signet\n1 Scurry Oak\nSB: 1 Pithing Needle', 'Heliod, Sun-Crowned', 1);
  assert.deepStrictEqual(mainNames(out), ['Arcane Signet', 'Scurry Oak', 'Heliod, Sun-Crowned']);
  assert.strictEqual(out.split('\n')[2], '1 Heliod, Sun-Crowned');
});

// ---- and where the count is *not* evidence ---------------------------------
//
// The rule above reads a card count against what the rules of the game allow, and it
// is tempting to run the same argument on the sideboard: a constructed sideboard is
// capped at fifteen cards and Commander has none at all, so a sixteenth would mean
// the heading had gone stale and swallowed the deck.
//
// It does not hold, because the sideboard here is not the game's sideboard. On
// Moxfield it is where people park cards they are considering — saved to hand, not
// played — and such a list has no size. Folding a stash of forty into the deck would
// invent combos the deck cannot make: a worse failure than the one it would fix, and
// a much quieter one. These pin that the count buys nothing on this board.

const sideboardOf = (n) => 'Sideboard\n'
  + Array.from({ length: n }, (_, i) => '1 Card ' + (i + 1)).join('\n');

test('board: a sideboard stays out of the deck at any size', () => {
  for (const n of [1, 15, 16, 40, 120]) {
    const parsed = parseDecklist(sideboardOf(n));
    assert.strictEqual(parsed.main.length, 0, n + ' sideboard cards reached the deck');
    assert.strictEqual(parsed.skipped.length, n, n + ' sideboard cards were not reported');
  }
});

test('board: a big sideboard beside a real deck leaves the deck alone', () => {
  const parsed = parseDecklist('Deck\n1 Sol Ring\n\n' + sideboardOf(40).replace(/^Sideboard\n/, 'Sideboard\n'));
  assert.deepStrictEqual(parsed.main.map((e) => e.card), ['Sol Ring']);
  assert.strictEqual(parsed.skipped.length, 40);
});

test('board: a card is never added into a sideboard, however big it is', () => {
  const out = addMainDeckCard(sideboardOf(40), 'Heliod, Sun-Crowned', 1);
  // Above the heading, where it parses as the deck — not onto the end of the stash.
  assert.strictEqual(out.split('\n')[0], '1 Heliod, Sun-Crowned');
  assert.deepStrictEqual(parseDecklist(out).main.map((e) => e.card), ['Heliod, Sun-Crowned']);
});

// The cost of the above, stated rather than left to be discovered: a heading we do
// not know does not end a sideboard, so a deck pasted after one is not recovered. It
// is reported rather than silently dropped, which is the difference that matters —
// `skipped` is what the page shows under "lines we could not use".
test('board: a deck lost behind a stale sideboard heading is reported, not recovered', () => {
  const text = ['Sideboard', '1 Pithing Needle', '', 'Squirrel Tribal']
    .concat(Array.from({ length: 20 }, (_, i) => '1 Card ' + (i + 1))).join('\n');
  const parsed = parseDecklist(text);
  assert.strictEqual(parsed.main.length, 0);
  assert.strictEqual(parsed.skipped.length, 22);
  assert.ok(parsed.skipped.every((s) => s.reason === 'sideboard / ignored section'));
});
