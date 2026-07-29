const test = require('node:test');
const assert = require('node:assert');
const {
  parseDecklist, parseLine, fromMoxfield, fromArchidekt, parseDeckUrl, describeLoadFailure,
} = require('../parser.js');

test('parseLine: plain name', () => {
  assert.deepStrictEqual(parseLine('Sol Ring'), { name: 'Sol Ring', quantity: 1, sideboardPrefix: false });
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
  assert.deepStrictEqual(parseDecklist(''), { commanders: [], main: [] });
  assert.deepStrictEqual(parseDecklist(null), { commanders: [], main: [] });
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
