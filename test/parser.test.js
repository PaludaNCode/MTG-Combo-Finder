const test = require('node:test');
const assert = require('node:assert');
const {
  parseDecklist, parseLine, fromMoxfield, fromArchidekt, parseDeckUrl, describeLoadFailure,
  acceptDeckFile, looksLikeText,
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

// When a section splits the deck in two, the bigger half is the deck. This is the
// only place "we do not know where the deck is" has an answer worth acting on: the
// button that adds a card only exists once a search has found combos, which needs a
// deck, so the deck is always in the box somewhere — sometimes in more than one run.
test('add: the card goes into the biggest deck block, not the last one', () => {
  const text = ['Deck']
    .concat(Array.from({ length: 20 }, (_, i) => '1 Card ' + (i + 1)))
    .concat(['', 'Sideboard', '1 Pithing Needle', '', 'Deck', '1 Sol Ring'])
    .join('\n');
  const out = addMainDeckCard(text, 'Heliod, Sun-Crowned', 1);
  const lines = out.split('\n');
  assert.strictEqual(lines[21], '1 Heliod, Sun-Crowned', 'not at the end of the 20-card block');
  assert.ok(lines.indexOf('1 Heliod, Sun-Crowned') < lines.indexOf('Sideboard'));
  const parsed = parseDecklist(out);
  assert.strictEqual(parsed.main.length, 22);
});

// ...but an ordinary list, where every block is the same size, keeps taking the last
// one, so the common case is not reshuffled by the rule above.
test('add: equal-sized blocks still take the last', () => {
  const text = 'Deck\n1 Sol Ring\n\nSideboard\n1 Pithing Needle\n\nDeck\n1 Arcane Signet';
  const out = addMainDeckCard(text, 'Heliod, Sun-Crowned', 1);
  assert.strictEqual(out.split('\n').pop(), '1 Heliod, Sun-Crowned');
});

// ---- decks that arrive as a file -------------------------------------------
//
// A file is the one import path that works for every deck site, Moxfield
// included, because it needs no CORS and no API. Two decisions decide whether it
// behaves: what to refuse before reading, and how to tell text from bytes after.

test('acceptDeckFile: an ordinary text export is read', () => {
  for (const name of ['deck.txt', 'Deck.TXT', 'list.dec', 'old.mwdeck', 'export.csv']) {
    assert.deepStrictEqual(acceptDeckFile({ name, size: 2048, type: 'text/plain' }),
      { ok: true, name }, name);
  }
});

// Browsers report an empty `type` for plenty of legitimate .txt files, so a
// missing type must never be the thing that refuses one.
test('acceptDeckFile: no type reported is not a refusal', () => {
  assert.strictEqual(acceptDeckFile({ name: 'deck.txt', size: 900, type: '' }).ok, true);
  assert.strictEqual(acceptDeckFile({ name: 'deck', size: 900, type: '' }).ok, true,
    'no extension either — read it and judge the contents');
});

test('acceptDeckFile: a type the browser is sure about, and is not text, settles it', () => {
  for (const type of ['image/png', 'application/pdf', 'application/zip', 'video/mp4']) {
    const got = acceptDeckFile({ name: 'deck.txt', size: 900, type });
    assert.strictEqual(got.ok, false, type);
    assert.strictEqual(got.reason, 'not-text');
  }
});

// Not about our limits: it is so dropping a photo fails as a sentence rather
// than as a browser reading 40 MB into a textarea and locking up the tab.
test('acceptDeckFile: a file far too big to be a decklist is refused unread', () => {
  const got = acceptDeckFile({ name: 'holiday.mov', size: 40 * 1024 * 1024, type: '' });
  assert.strictEqual(got.reason, 'too-big');
  assert.strictEqual(acceptDeckFile({ name: 'deck.txt', size: 2048, type: '' }).ok, true);
});

test('acceptDeckFile: an empty file says so rather than loading nothing', () => {
  assert.strictEqual(acceptDeckFile({ name: 'deck.txt', size: 0, type: 'text/plain' }).reason, 'empty');
  assert.strictEqual(acceptDeckFile(null).reason, 'empty');
  assert.strictEqual(acceptDeckFile('not a file').reason, 'empty');
});

// The honest test, and the one that actually protects the box: an extension is a
// claim, this is the evidence.
test('looksLikeText: a decklist is text and a decoded binary is not', () => {
  assert.strictEqual(looksLikeText('1 Sol Ring\n1 Basalt Monolith\n'), true);
  assert.strictEqual(looksLikeText('1 Æther Vial\n1 Jötun Grunt\t// note\r\n'), true,
    'accents, tabs and CRLF are all normal');
  // What a PNG looks like once a FileReader has decoded it as UTF-8.
  const decodedBinary = '\x89PNG\r\n\x1a\n' + '�\x00\x01\x02'.repeat(200);
  assert.strictEqual(looksLikeText(decodedBinary), false);
  assert.strictEqual(looksLikeText(''), false);
  assert.strictEqual(looksLikeText(null), false);
});

// One stray control character in a long list is a quirk of an exporter, not a
// reason to refuse a deck somebody is waiting on.
test('looksLikeText: a mostly-text file is still text', () => {
  const deck = Array.from({ length: 100 }, (_, i) => (i + 1) + ' Card Name ' + i).join('\n');
  assert.strictEqual(looksLikeText(deck + '\x00'), true);
});

// The whole point of accepting files: a real export from a site whose API a
// browser can never read has to come out the other side as a deck.
test('a Moxfield text export dropped as a file parses like a paste', () => {
  const exported = [
    '1 Kinnan, Bonder Prodigy (C21) 3 *CMDR*',
    '1 Basalt Monolith (MH2) 220',
    '1 Rings of Brighthearth (LRW) 258',
    '10 Island (UNF) 240',
  ].join('\r\n');
  assert.strictEqual(looksLikeText(exported), true);
  const parsed = parseDecklist(exported);
  assert.deepStrictEqual(parsed.commanders.map((c) => c.card), ['Kinnan, Bonder Prodigy']);
  assert.strictEqual(parsed.main.length, 3);
});

// ---- taking a card back out --------------------------------------------------
//
// "− Remove" on a row of "Combos in your deck". The row is there because the card
// carries combos, so the promise is that pressing it takes those combos with it —
// which means the line has to actually leave the deck, and the sideboard line naming
// the same card has to stay where it is.
const { removeDeckCard } = require('../parser.js');

// The page's rule, passed in rather than defaulted: the name on the button is
// Commander Spellbook's spelling and the line is whatever was pasted. This is
// DeckCombos.nameKey, required so the two can never drift apart unnoticed.
const { nameKey } = require('../combos.js');
const removed = (text, name) => removeDeckCard(text, name, nameKey);

test('remove: the line goes, quantity and all', () => {
  const out = removed('1 Sol Ring\n2 Basalt Monolith\n1 Island', 'Basalt Monolith');
  assert.strictEqual(out.removed, 1);
  assert.deepStrictEqual(mainNames(out.text), ['Sol Ring', 'Island']);
});

// Set codes, collector numbers and foil markers are what a real export carries, and
// none of them are part of the name — so a button that only matched a bare line would
// do nothing on every Moxfield paste.
test('remove: an annotated export line matches too', () => {
  const out = removed('1 Sol Ring (C21) 263 *F*\n1 Island', 'Sol Ring');
  assert.strictEqual(out.removed, 1);
  assert.deepStrictEqual(mainNames(out.text), ['Island']);
});

// A commander is a card in the deck and the panel lists it as one, so the button on
// its row has to be able to reach it.
test('remove: a card in the command zone comes out', () => {
  const out = removed('Commander:\n1 Kinnan, Bonder Prodigy\n\nDeck:\n1 Sol Ring', 'Kinnan, Bonder Prodigy');
  assert.strictEqual(out.removed, 1);
  const parsed = parseDecklist(out.text);
  assert.deepStrictEqual(parsed.commanders.map((e) => e.card), []);
  assert.deepStrictEqual(parsed.main.map((e) => e.card), ['Sol Ring']);
});

// The sideboard is not in the deck, so nothing on the page rests on it and removing
// it would be an edit nobody asked for. Both ways of marking one.
test('remove: a sideboard copy is left alone', () => {
  const out = removed('1 Sol Ring\n\nSideboard:\n1 Sol Ring', 'Sol Ring');
  assert.strictEqual(out.removed, 1);
  assert.deepStrictEqual(mainNames(out.text), []);
  assert.ok(/Sideboard:\n1 Sol Ring/.test(out.text), 'the sideboard line survived');
});

test('remove: an MTGO SB: line is left alone as well', () => {
  const out = removed('1 Sol Ring\nSB: 1 Sol Ring', 'Sol Ring');
  assert.strictEqual(out.removed, 1);
  assert.ok(/SB: 1 Sol Ring/.test(out.text));
});

// Nothing matched is a real answer and the caller shows it as one, so it must be
// distinguishable from a removal — a silent 0 would read as "done".
test('remove: a card that is not there removes nothing and says so', () => {
  const out = removed('1 Sol Ring', 'Walking Ballista');
  assert.strictEqual(out.removed, 0);
  assert.strictEqual(out.text, '1 Sol Ring');
});

// Every copy, not the first one: a list with a duplicated line would otherwise keep
// the card in the deck while the row disappeared from the panel.
test('remove: every copy of the line goes', () => {
  const out = removed('1 Sol Ring\n1 Island\n1 Sol Ring', 'Sol Ring');
  assert.strictEqual(out.removed, 2);
  assert.deepStrictEqual(mainNames(out.text), ['Island']);
});

// The headings and the blank lines that shape someone's list are theirs, and a button
// that tidied them would be editing more than it said.
test('remove: the list keeps its shape', () => {
  const out = removed('Commander:\n1 Kinnan, Bonder Prodigy\n\nDeck:\n1 Sol Ring\n1 Island', 'Sol Ring');
  assert.strictEqual(out.text, 'Commander:\n1 Kinnan, Bonder Prodigy\n\nDeck:\n1 Island');
});

// The rule is required, not defaulted: a second copy of nameKey living in parser.js is
// how the two silently stop agreeing, and the failure is a button that removes nothing.
test('remove: the name-matching rule has to be given', () => {
  assert.throws(() => removeDeckCard('1 Sol Ring', 'Sol Ring'), /name-matching rule/);
});
