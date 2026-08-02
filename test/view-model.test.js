'use strict';
const test = require('node:test');
const assert = require('node:assert');
const View = require('../view-model.js');

// The decisions that used to live inside app.js, where nothing could reach them.
//
// This is the whole argument for the file existing: every assertion below is a
// sentence or a number that would render perfectly well while being wrong. The
// layout test proves the bracket panel is not empty. It cannot prove it says
// "Bracket 4" rather than "Bracket 3", or that "3 of your combos need both" is not
// actually four.

// ---- pickedSentence ---------------------------------------------------------

const picked = (over) => Object.assign({
  cards: ['Basalt Monolith', 'Rings of Brighthearth'],
  inAll: 3,
  interchangeable: 0,
  shared: [],
  lost: 3,
  saved: 0,
  atRisk: 3,
}, over);

test('one card: what it holds up, and what cutting it costs', () => {
  const text = View.pickedSentence(picked({ cards: ['Scurry Oak'], inAll: 4, lost: 2, saved: 2, atRisk: 4 }));
  assert.match(text, /^Scurry Oak is in 4 of your combos\. /);
  assert.match(text, /Cutting it would cost 2 of them; the other 2 have a stand-in\./);
  assert.match(text, /Pick another card to compare the two\.$/);
});

// "costs nothing" is a different claim from "costs 0", and it is the one worth
// making: a card with a stand-in for every combo is a free cut.
test('one card that costs nothing to cut says so in words', () => {
  const text = View.pickedSentence(picked({ cards: ['Sol Ring'], inAll: 2, lost: 0, saved: 2, atRisk: 2 }));
  assert.match(text, /Cutting it costs nothing — every one of them has a stand-in in your deck\./);
  assert.doesNotMatch(text, /would cost 0/);
});

test('one card: "1 other card", not "1 other cards"', () => {
  const one = View.pickedSentence(picked({ cards: ['Sol Ring'], shared: ['Scurry Oak'] }));
  assert.match(one, /with 1 other card\. /);
  const two = View.pickedSentence(picked({ cards: ['Sol Ring'], shared: ['Scurry Oak', 'Spike Feeder'] }));
  assert.match(two, /with 2 other cards\. /);
});

test('two cards say "both", three say "all three"', () => {
  assert.match(View.pickedSentence(picked()), /need both/);
  assert.match(
    View.pickedSentence(picked({ cards: ['A', 'B', 'C'] })),
    /need all three/
  );
});

test('the list reads as prose: "A and B", "A, B and C"', () => {
  assert.match(View.pickedSentence(picked({ cards: ['A', 'B'] })), /^A and B: /);
  assert.match(View.pickedSentence(picked({ cards: ['A', 'B', 'C'] })), /^A, B and C: /);
});

// "3 of your combos need both, 4 take any one of them" — what the numbers count is
// said once, on the first of them, whichever that turns out to be. When there is no
// overlap at all, the leading clause is words rather than a number, and the regex
// that inserts "of your combos" must not fire on it.
test('"of your combos" lands on the first number, whichever clause leads', () => {
  const both = View.pickedSentence(picked({ inAll: 3, interchangeable: 4 }));
  assert.match(both, /: 3 of your combos need both, 4 take any one of them in the same slot\./);

  const swapOnly = View.pickedSentence(picked({ inAll: 0, interchangeable: 4 }));
  assert.match(swapOnly, /: 4 of your combos take any one of them in the same slot\./);
});

test('two cards with no relation at all say so, with no stray number', () => {
  const text = View.pickedSentence(picked({ inAll: 0, interchangeable: 0, atRisk: 5, lost: 0 }));
  assert.match(text, /no combo of yours needs them together or takes one for another\./);
  assert.doesNotMatch(text, /of your combos need/);
});

test('the shared cards are named up to three, then counted', () => {
  const three = View.pickedSentence(picked({ shared: ['A', 'B', 'C'] }));
  assert.match(three, /Both combo with A, B, C\. /);
  assert.doesNotMatch(three, /and 0 more/);

  const five = View.pickedSentence(picked({ shared: ['A', 'B', 'C', 'D', 'E'] }));
  assert.match(five, /Both combo with A, B, C and 2 more\. /);
});

test('three shared cards say "All three combo with", not "Both"', () => {
  const text = View.pickedSentence(picked({ cards: ['A', 'B', 'C'], shared: ['X'] }));
  assert.match(text, /All three combo with X\./);
});

test('a cut that loses nothing is phrased as a fact, not as zero', () => {
  const text = View.pickedSentence(picked({ lost: 0, saved: 0, atRisk: 6 }));
  assert.match(text, /Cut both and none of the 6 combos they appear in would go — each has a stand-in in your deck\.$/);
});

test('a partial loss names both halves', () => {
  const text = View.pickedSentence(picked({ lost: 2, saved: 3, atRisk: 5 }));
  assert.match(text, /Cut both and 2 of the 5 combos they appear in would go; the other 3 have a stand-in\.$/);
});

// ---- sizePills --------------------------------------------------------------

test('one combo of one size needs no multiplier', () => {
  assert.deepStrictEqual(View.sizePills([{ size: 2, count: 1 }]), [
    { label: '2-card', title: 'One combo needing 2 cards on the table', easiest: true },
  ]);
});

test('more than one combo gets the count', () => {
  const pills = View.sizePills([{ size: 2, count: 3 }, { size: 4, count: 1 }]);
  assert.deepStrictEqual(pills.map((p) => p.label), ['3 × 2-card', '1 × 4-card']);
  assert.strictEqual(pills[1].title, 'One combo needing 4 cards on the table');
});

// Marking whichever pill is smallest on its row would mark "smallest of one size" —
// a card whose seven combos all need three would light up for it.
test('only a two-card pill is the easiest, never merely the smallest present', () => {
  const pills = View.sizePills([{ size: 3, count: 2 }, { size: 5, count: 1 }]);
  assert.deepStrictEqual(pills.map((p) => p.easiest), [false, false]);
  const withTwo = View.sizePills([{ size: 2, count: 1 }, { size: 3, count: 1 }]);
  assert.deepStrictEqual(withTwo.map((p) => p.easiest), [true, false]);
});

test('nothing to show is an empty list, not a row with no pills', () => {
  assert.deepStrictEqual(View.sizePills([]), []);
  assert.deepStrictEqual(View.sizePills(null), []);
});

// ---- splitParts -------------------------------------------------------------

test('no unofficial combos means no split line at all', () => {
  assert.strictEqual(View.splitParts(4, 0), null);
  assert.strictEqual(View.splitParts(0, 0), null);
});

test('both halves are named', () => {
  assert.deepStrictEqual(View.splitParts(4, 1), { official: '4 official', ours: '1 unofficial', none: '' });
});

// A card whose whole case is ours says so, rather than leaving the reader to infer
// it from a missing half.
test('a row with nothing published says "none published"', () => {
  assert.deepStrictEqual(View.splitParts(0, 2), { official: '', ours: '2 unofficial', none: 'none published' });
});

test('the suggestion panel counts with a plus, the pieces panel without', () => {
  assert.strictEqual(View.splitParts(4, 1, true).ours, '+1 unofficial');
  assert.strictEqual(View.splitParts(4, 1, true).official, '+4 official');
  assert.strictEqual(View.splitParts(4, 1).ours, '1 unofficial');
});

// ---- bracketProse -----------------------------------------------------------

const bracket = (over) => Object.assign({ floor: 3, gameChangers: ['Sol Ring'], twoCardWins: [] }, over);

test('no bracket at all draws nothing — half a check is worse than none', () => {
  assert.strictEqual(View.bracketProse(null), null);
  assert.strictEqual(View.bracketProse(undefined), null);
});

test('a floor of 3 is "at the earliest", because 4 and 5 are still open', () => {
  const prose = View.bracketProse(bracket({ floor: 3 }));
  assert.strictEqual(prose.headline, 'Bracket 3 at the earliest');
  assert.strictEqual(prose.named, 'Bracket 3 at the earliest — Upgraded');
});

// 4 is the top this check can reach, so "at the earliest" would be promising a 5
// it has no way to rule in.
test('a floor of 4 drops "at the earliest"', () => {
  const prose = View.bracketProse(bracket({ floor: 4, gameChangers: ['a', 'b', 'c', 'd'] }));
  assert.strictEqual(prose.headline, 'Bracket 4');
  assert.strictEqual(prose.named, 'Bracket 4 — Optimized');
});

test('a floor of 2 is phrased as nothing ruling it out, not as a verdict', () => {
  const prose = View.bracketProse(bracket({ floor: 2, gameChangers: [], twoCardWins: [] }));
  assert.strictEqual(prose.headline, 'Nothing here rules out bracket 2');
  assert.strictEqual(prose.reason, 'No Game Changers, and no two-card combo that says it ends the game.');
});

test('the reasoning counts each criterion, and pluralises both', () => {
  const one = View.bracketProse(bracket({ floor: 3, gameChangers: ['a'], twoCardWins: [{}] }));
  assert.match(one.reason, /^1 Game Changer · 1 two-card combo that ends the game\./);

  const many = View.bracketProse(bracket({ floor: 3, gameChangers: ['a', 'b'], twoCardWins: [{}, {}] }));
  assert.match(many.reason, /^2 Game Changers · 2 two-card combos that end the game\./);
});

test('the reasoning says which rule put the floor where it is', () => {
  assert.match(View.bracketProse(bracket({ floor: 3 })).reason, /Brackets 1 and 2 allow neither, so 3 is the floor\.$/);
  assert.match(
    View.bracketProse(bracket({ floor: 4, gameChangers: ['a', 'b', 'c', 'd'] })).reason,
    /Bracket 3 allows three Game Changers, so a list with more sits at 4\.$/
  );
});

// Struck through below the floor, filled at it, outlined above — so the number
// reads as a position on a scale rather than a score from nowhere.
test('the pips say out, floor, open, in that order around the floor', () => {
  assert.deepStrictEqual(
    View.bracketProse(bracket({ floor: 3 })).steps,
    [
      { n: 1, state: 'out' },
      { n: 2, state: 'out' },
      { n: 3, state: 'floor' },
      { n: 4, state: 'open' },
      { n: 5, state: 'open' },
    ]
  );
});

// ---- timingSentence ---------------------------------------------------------

test('all three phases and a total', () => {
  assert.strictEqual(
    View.timingSentence({ fetch: 900, parse: 400, match: 60, total: 1400 }, 'network'),
    'ready in 1.4s (download 0.9s · parse 0.4s · match 60ms)'
  );
});

// The two readings that exposed this: a first visit at 1.5s and the next at 39ms,
// both labelled "download". search.js times fetchDatabase(), which either downloads
// the database or reads the copy already on disk — and calling both the same thing
// says the network got forty times faster rather than that the cache did its job.
test('the first phase is named for where the bytes came from', () => {
  const t = { fetch: 39, parse: 43, match: 71, total: 153 };
  assert.strictEqual(View.timingSentence(t, 'cache'), 'ready in 0.2s (cache 39ms · parse 43ms · match 71ms)');
  assert.strictEqual(View.timingSentence(t, 'network'), 'ready in 0.2s (download 39ms · parse 43ms · match 71ms)');
});

// "download" is the one word that must never be a guess: it is the claim the reader
// would act on, and the wrong one hides a cache that is working.
test('an unknown source gets the neutral word, not "download"', () => {
  const t = { fetch: 39, parse: 43, match: 71, total: 153 };
  assert.match(View.timingSentence(t, undefined), /^ready in 0\.2s \(read 39ms/);
  assert.match(View.timingSentence(t, 'something-new'), /^ready in 0\.2s \(read 39ms/);
});

// The absence is the measurement, twice over. A second search has no download and
// no parse, so neither is printed — a zero would report a skipped phase as an
// instant one. And with only one phase left, the breakdown would be the total
// again in brackets, so it is dropped too.
test('a second search reports the total alone, with no breakdown of one', () => {
  assert.strictEqual(View.timingSentence({ match: 60, total: 62 }), 'ready in 62ms');
  assert.strictEqual(View.timingSentence({ total: 40 }), 'ready in 40ms');
});

test('two phases are enough for a breakdown', () => {
  assert.strictEqual(
    View.timingSentence({ parse: 400, match: 60, total: 470 }),
    'ready in 0.5s (parse 0.4s · match 60ms)'
  );
});

// `memory` is the second search within one session: no bytes were read at all, so
// there is no phase to label and the source never comes up.
test('a search served from memory has no fetch phase to name', () => {
  assert.strictEqual(View.timingSentence({ match: 64, total: 66 }, 'memory'), 'ready in 66ms');
});

test('milliseconds under a tenth of a second, seconds above it', () => {
  assert.strictEqual(View.secs(99), '99ms');
  assert.strictEqual(View.secs(100), '0.1s');
  assert.strictEqual(View.secs(1449), '1.4s');
});

test('no timing at all is no sentence', () => {
  assert.strictEqual(View.timingSentence(null), '');
  assert.strictEqual(View.timingSentence({}), '');
});

// ---- a deck that arrived as a file -----------------------------------------
//
// Dropping a file is the one way into this page that fails for reasons the reader
// can fix, so each refusal has to name what happened and what to do instead.

test('fileLoaded: counts the cards, and says "card" when it means one', () => {
  assert.strictEqual(
    View.fileLoaded('deck.txt', { main: 99, commanders: 1 }),
    'Loaded 99 cards + 1 commander from “deck.txt”.'
  );
  assert.strictEqual(
    View.fileLoaded('tiny.txt', { main: 1 }),
    'Loaded 1 card from “tiny.txt”.'
  );
  assert.strictEqual(
    View.fileLoaded('duo.txt', { main: 60, commanders: 2 }),
    'Loaded 60 cards + 2 commanders from “duo.txt”.'
  );
});

// The reader chose this file. Silently throwing away a third of it is the sort of
// thing they should hear from us rather than notice in the results.
test('fileLoaded: lines the parser threw away are reported, not swallowed', () => {
  assert.match(View.fileLoaded('deck.txt', { main: 90, skipped: 4 }), /4 lines skipped\.$/);
  assert.match(View.fileLoaded('deck.txt', { main: 90, skipped: 1 }), /1 line skipped\.$/);
  assert.doesNotMatch(View.fileLoaded('deck.txt', { main: 90, skipped: 0 }), /skipped/);
});

test('fileLoaded: a missing count is nothing, not NaN', () => {
  assert.strictEqual(View.fileLoaded('d.txt', {}), 'Loaded 0 cards from “d.txt”.');
  assert.strictEqual(View.fileLoaded('d.txt'), 'Loaded 0 cards from “d.txt”.');
});

// "Invalid file" tells nobody anything. Every refusal names the file, says what
// is wrong with it, and gives the way out — which is always "paste it below".
test('fileRefusal: each reason names the file and what to do instead', () => {
  const cases = {
    'too-big': /is too big to be a decklist \(over 1 MB\)/,
    empty: /is empty/,
    'not-text': /isn’t a text file/,
    unreadable: /could not be read as text/,
    'no-cards': /No card lines found/,
  };
  for (const [reason, shape] of Object.entries(cases)) {
    const said = View.fileRefusal(reason, 'holiday.mov', 1024 * 1024);
    assert.match(said, shape, reason);
    assert.match(said, /holiday\.mov/, reason + ' names the file');
  }
});

// An unknown reason must still produce advice rather than "undefined".
test('fileRefusal: an unrecognised reason still says something useful', () => {
  const said = View.fileRefusal('something-new', 'deck.txt', 1024 * 1024);
  assert.match(said, /could not be read as text/);
  assert.doesNotMatch(said, /undefined/);
});

test('fileRefusal: a file with no name is still a sentence', () => {
  const said = View.fileRefusal('empty', '', 1024 * 1024);
  assert.match(said, /^That file is empty/);
});
