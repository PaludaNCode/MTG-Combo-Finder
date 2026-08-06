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

// ---- deckCombosNote ----------------------------------------------------------
//
// The panel is headed "Combos in your deck" and its rows are cards, so its badge and its
// row count disagree by design — a real deck's 233 combos are carried by some smaller set
// of its cards. This sentence is the only thing on the page that reconciles the two, which
// makes every number in it a claim a reader will check. The numbers below are this test's
// own; the deck's real ones need combos.json, which is a build artifact.

test('the note says how many combos and how many cards carry them', () => {
  const note = View.deckCombosNote(233, 0, 63);
  assert.strictEqual(note.count, 233, 'the badge is the published total');
  assert.match(note.sentence, /^233 combos published by Commander Spellbook, carried by 63 of your cards\./);
});

// Ours are never counted as published data, here as everywhere else — a badge of 241
// would credit Spellbook with eight rows it has not published.
test('our own rows are counted apart from the published ones', () => {
  const note = View.deckCombosNote(233, 8, 64);
  assert.strictEqual(note.count, 233);
  assert.match(note.sentence, /233 combos published by Commander Spellbook and 8 of ours, carried by 64 of your cards/);
});

// A card can carry nothing but combos of ours, which used to leave it out of this panel
// altogether. The badge has nothing to show, and the sentence has to say why rather than
// leaving a reader with rows and no number.
test('a deck with nothing published still says what it has', () => {
  const note = View.deckCombosNote(0, 3, 4);
  assert.strictEqual(note.count, null, 'no badge, rather than a badge reading 0');
  assert.match(note.sentence, /^3 combos of ours, none published by Commander Spellbook, carried by 4 of your cards\./);
});

test('one of anything is singular', () => {
  assert.match(View.deckCombosNote(1, 0, 1).sentence, /^1 combo published .* carried by 1 of your card\./);
});

// Nothing at all is the panel's empty line, not a sentence about zero.
test('no combos means no sentence', () => {
  assert.strictEqual(View.deckCombosNote(0, 0, 0), null);
});

// The second half is what stops the row count reading as a miscount, so it is pinned
// rather than left to the wording.
test('the note explains what a row is and what its number means', () => {
  const sentence = View.deckCombosNote(233, 0, 63).sentence;
  assert.match(sentence, /Each row is one card/);
  assert.match(sentence, /cutting that card would cost/);
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

// ---- rowNumbers -------------------------------------------------------------

test('the total is both halves, and the halves are printed under it', () => {
  const n = View.rowNumbers(17, 7);
  assert.strictEqual(n.count, '24');
  assert.strictEqual(n.label, 'combos');
  assert.deepStrictEqual([n.split.official, n.split.ours], ['17', '7']);
});

test('no unofficial combos means no split at all', () => {
  assert.strictEqual(View.rowNumbers(4, 0).split, null);
  assert.strictEqual(View.rowNumbers(0, 0).split, null);
  // The total is still the total, and still says what it counts.
  assert.strictEqual(View.rowNumbers(4, 0).count, '4');
});

// The whole reason the words could leave the row. If this ever returns numerals,
// the split is a pair of colours and nothing else — which is the failure the words
// were there to prevent.
test('the split says in words what the numerals mean', () => {
  assert.strictEqual(View.rowNumbers(17, 7).split.spoken,
    '17 published by Commander Spellbook, 7 unofficial');
});

// A card whose whole case is ours says so. "none published" is the interesting
// half of that row, so it must not read as a missing number.
test('a row with nothing published says so rather than showing a gap', () => {
  const n = View.rowNumbers(0, 2);
  assert.strictEqual(n.split.official, '0');
  assert.match(n.split.spoken, /^none published by Commander Spellbook, 2 unofficial$/);
});

test('the suggestion panel signs the total, and never the split', () => {
  const suggestion = View.rowNumbers(20, 4, true);
  assert.strictEqual(suggestion.sign, '+');
  assert.strictEqual(suggestion.count, '24');
  // "+20+4" reads as arithmetic; the + between the halves is the only real one.
  assert.deepStrictEqual([suggestion.split.official, suggestion.split.ours], ['20', '4']);
  assert.strictEqual(View.rowNumbers(20, 4).sign, '');
});

test('what the total means reaches a screen reader either way round', () => {
  assert.strictEqual(View.rowNumbers(17, 7).spoken, 'in 24 combos');
  assert.strictEqual(View.rowNumbers(20, 4, true).spoken, 'unlocks 24 combos');
  assert.strictEqual(View.rowNumbers(1, 0).spoken, 'in 1 combo');
  assert.strictEqual(View.rowNumbers(1, 0).label, 'combo');
});

// Four-digit totals are real: one card unlocks 1,889 combos of ours. The column is
// one fixed width, so the rare long numbers step down a size instead of widening
// it for every row.
test('long totals ask for a smaller size rather than a wider column', () => {
  assert.strictEqual(View.rowNumbers(17, 7).scale, null);
  assert.strictEqual(View.rowNumbers(99, 0).scale, null);
  assert.strictEqual(View.rowNumbers(100, 8).scale, 'mid');
  assert.strictEqual(View.rowNumbers(0, 1889, true).scale, 'wide');
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

// ---- cards the snapshot has never heard of ---------------------------------
//
// The wording is a count and a pluralisation, and the decision to say anything at
// all is a judgement about whether the data can support the claim. Both render
// exactly as happily when wrong, which is why they are here and not in app.js.

const found = (names, checked, mapped) => ({ names, checked, mapped: mapped === undefined ? 30000 : mapped });

test('unrecognizedNote: a misspelled card is named', () => {
  const note = View.unrecognizedNote(found(['Sol Rimg'], 100));
  assert.match(note.sentence, /^One card in your list isn’t in this snapshot/);
  assert.deepStrictEqual(note.names, ['Sol Rimg']);
  assert.equal(note.count, 1);
  assert.equal(note.more, 0);
});

test('unrecognizedNote: several are counted and pluralised', () => {
  const note = View.unrecognizedNote(found(['Sol Rimg', 'Treasure', 'Lightning Bolt?'], 100));
  assert.match(note.sentence, /^3 cards in your list aren’t/);
  assert.equal(note.names.length, 3);
});

// A deck with nothing wrong says nothing at all — no empty box, no "0 unrecognized".
test('unrecognizedNote: a clean deck says nothing', () => {
  assert.equal(View.unrecognizedNote(found([], 100)), null);
});

test('unrecognizedNote: nothing to compare against says nothing', () => {
  assert.equal(View.unrecognizedNote(found(['Sol Rimg'], 0)), null);
  assert.equal(View.unrecognizedNote(null), null);
  assert.equal(View.unrecognizedNote({}), null);
});

// The rule the whole feature rests on, pinned here rather than left to the fixtures
// happening to be small. `cardIdentity: {}` has shipped once already — it made colour
// filtering silently inert — and that payload reports every card in the deck as
// unknown. So: an absent or empty map says nothing, whatever the deck.
test('unrecognizedNote: an absent identity map says nothing', () => {
  const everything = Array.from({ length: 100 }, (_, i) => 'Card ' + i);
  assert.equal(View.unrecognizedNote(found(everything, 100, 0)), null);
});

// And a map too thin to answer, which is the test fixtures' own case: 14 entries
// against a deck of 85. The answer there is about the data, not the deck.
test('unrecognizedNote: a thin identity map says nothing', () => {
  const most = Array.from({ length: 71 }, (_, i) => 'Card ' + i);
  assert.equal(View.unrecognizedNote(found(most, 85, 14)), null);
  // Exactly at the limit still speaks: half a deck is the line, and being at it is
  // not being over it.
  assert.ok(View.unrecognizedNote(found(most.slice(0, 42), 84)));
  assert.equal(View.unrecognizedNote(found(most.slice(0, 43), 84)), null);
});

// A small paste is the case a fraction rule can get wrong: three cards with one
// typo is 33% unknown and still worth saying.
test('unrecognizedNote: one typo in a three-card paste still speaks', () => {
  const note = View.unrecognizedNote(found(['Sol Rimg'], 3));
  assert.ok(note);
  assert.match(note.sentence, /^One card/);
});

test('unrecognizedNote: a wall of names is capped, and says how many are left', () => {
  const many = Array.from({ length: 26 }, (_, i) => 'Card ' + i);
  const note = View.unrecognizedNote(found(many, 200));
  assert.equal(note.names.length, View.UNKNOWN_NAMED);
  assert.equal(note.more, 26 - View.UNKNOWN_NAMED);
  assert.match(note.sentence, /^26 cards/, 'the count is of all of them, not of the ones shown');
});

// The data is a nightly snapshot, so the honest claim is about the snapshot and not
// about the card. "Sol Rimg is not a real card" is wrong the day a set is released.
test('unrecognizedNote: the claim is about the snapshot, not about the card', () => {
  const note = View.unrecognizedNote(found(['Sol Rimg'], 100));
  assert.match(note.sentence, /this snapshot/);
  assert.doesNotMatch(note.sentence, /does not exist|not a (real|valid) card/i);
  // And it does not blame the reader: a token line and a card newer than the
  // snapshot both land here too.
  assert.match(note.why, /token/);
  assert.match(note.why, /since the snapshot/);
});

// ---- how many cards, and how many of them are lands -------------------------
//
// Which of the numbers can be said at all is the decision here, and each of the three
// silences below is a number that would have been confidently wrong: a landless deck
// invented out of an empty list, a basic count invented out of a missing one, and a
// type split read off a map too thin to answer.

const counted = (over) => Object.assign(
  { cards: 98, spells: 62, lands: 36, basic: 16, nonbasic: 20, unread: 0, mapped: 1191, basicsKnown: true },
  over
);
const said = (note) => note.parts.map((p) => p.text + (p.sub ? ' (' + p.sub + ')' : '')).join(' · ');

// The order is the design: the total, then the deck's body, then the number somebody
// came to check.
test('deckCountsNote: the total, then spells, then lands', () => {
  assert.equal(said(View.deckCountsNote(counted())),
    '98 cards · 62 spells · 36 lands (16 basic · 20 nonbasic)');
});

test('deckCountsNote: one card is not one cards', () => {
  const note = View.deckCountsNote(counted({ cards: 1, spells: 1, lands: 0, basic: 0, nonbasic: 0 }));
  assert.match(note.parts[0].text, /^1 card$/);
});

// The unread bucket is what keeps the sum checkable, so it is said whenever it is not
// zero — quietly, because the names are named in the box above and this is a note about
// the data rather than a finding about the deck.
test('deckCountsNote: cards with no type line are said, and said quietly', () => {
  const note = View.deckCountsNote(counted({ spells: 58, unread: 4 }));
  assert.equal(said(note), '98 cards · 58 spells · 36 lands (16 basic · 20 nonbasic) · 4 cards unread');
  assert.equal(note.parts[3].quiet, true);
});

test('deckCountsNote: nothing unread is not mentioned', () => {
  assert.equal(View.deckCountsNote(counted()).parts.length, 3);
});

// An empty land list is what a broken publish looks like, and reading it as "this deck
// plays no lands" would put a confident 0 on screen for every deck at once. The card
// count survives it, because it never depended on the data.
test('deckCountsNote: no land list drops the types and keeps the count', () => {
  const note = View.deckCountsNote(counted({ mapped: 0, lands: 0, spells: 0, unread: 98 }));
  assert.equal(said(note), '98 cards');
  assert.equal(note.typed, false);
});

test('deckCountsNote: no basic list drops the split, not the land count', () => {
  const note = View.deckCountsNote(counted({ basicsKnown: false, basic: 0, nonbasic: 36 }));
  assert.equal(said(note), '98 cards · 62 spells · 36 lands');
});

// A zero half is not information. "10 basic · 0 nonbasic" is a number nobody asked
// about, and a deck of nothing but duals reads better as "36 nonbasic" than as an
// apology for having no Forests. The fixture deck is the first of these: 10 Island.
test('deckCountsNote: the aside names only the halves that are there', () => {
  assert.equal(said(View.deckCountsNote(counted({ cards: 17, spells: 7, lands: 10, basic: 10, nonbasic: 0 }))),
    '17 cards · 7 spells · 10 lands (10 basic)');
  assert.equal(said(View.deckCountsNote(counted({ basic: 0, nonbasic: 36 }))),
    '98 cards · 62 spells · 36 lands (36 nonbasic)');
});

// No lands at all is a real answer — the data said so — but it has nothing to break down.
test('deckCountsNote: a landless deck gets no aside', () => {
  assert.equal(said(View.deckCountsNote(counted({ spells: 98, lands: 0, basic: 0, nonbasic: 0 }))),
    '98 cards · 98 spells · 0 lands');
});

// The rule shared with unrecognizedNote() and legalityProse(): past half the deck, the
// answer is about the data. The fixtures live in exactly that state — 14 identities
// against a deck of 85 — so without this the strip would report a deck of spells.
test('deckCountsNote: a deck the data cannot read says only how big it is', () => {
  const note = View.deckCountsNote(counted({ cards: 85, spells: 14, lands: 0, unread: 71 }));
  assert.equal(said(note), '85 cards');
  // Half is the line, and being at it is not being over it — the same boundary the
  // unrecognized box is pinned to above.
  assert.ok(View.deckCountsNote(counted({ cards: 84, spells: 42, lands: 0, unread: 42 })).typed);
  assert.equal(View.deckCountsNote(counted({ cards: 84, spells: 41, lands: 0, unread: 43 })).typed, false);
});

test('deckCountsNote: no deck says nothing at all', () => {
  assert.equal(View.deckCountsNote(null), null);
  assert.equal(View.deckCountsNote({}), null);
  assert.equal(View.deckCountsNote(counted({ cards: 0 })), null);
});

// ---- whether the decklist is allowed ---------------------------------------
//
// Two accusations that must stay apart, a claim that must not become a green tick,
// and the same thin-map rule the unrecognized note uses. Every one of them renders
// perfectly while being wrong, which is what puts them here.

const check = (over) => Object.assign({
  offIdentity: [],
  banned: [],
  commanders: ['Kinnan, Bonder Prodigy'],
  allowed: ['G', 'U'],
  canCheckIdentity: true,
  hasBanList: true,
  checked: 99,
  mapped: 30000,
}, over);

test('legalityProse: a legal deck says nothing at all', () => {
  assert.equal(View.legalityProse(check()), null);
  assert.equal(View.legalityProse(null), null);
});

test('legalityProse: a banned card is named and called a ban', () => {
  const said = View.legalityProse(check({ banned: ['Golos, Tireless Pilgrim'] }));
  assert.match(said.bannedSentence, /^One card in your list is banned in Commander:/);
  assert.deepStrictEqual(said.banned, ['Golos, Tireless Pilgrim']);
  assert.equal(said.offIdentity.length, 0, 'and it is not also called a colour problem');
});

test('legalityProse: an off-identity card names the identity it is outside, in pips', () => {
  const said = View.legalityProse(check({ offIdentity: [{ card: 'Heliod, Sun-Crowned', colours: 'W' }] }));
  // WUBRG is the printed order, so Simic reads {U}{G} — the same order the mana pips
  // and identityString() put it in.
  assert.match(said.identitySentence, /^One card is outside your commander’s colour identity \(\{U\}\{G\}\):/);
  assert.deepStrictEqual(said.offIdentity, [{ card: 'Heliod, Sun-Crowned', colours: '{W}' }]);
  assert.equal(said.banned.length, 0);
});

test('legalityProse: pips are in WUBRG order whatever order the colours arrive in', () => {
  const said = View.legalityProse(check({
    allowed: ['U', 'G'],
    offIdentity: [{ card: 'Murderous Redcap', colours: 'RB' }],
  }));
  assert.match(said.identitySentence, /\(\{U\}\{G\}\)/);
  assert.equal(said.offIdentity[0].colours, '{B}{R}');
});

test('legalityProse: both findings are reported, and stay separate', () => {
  const said = View.legalityProse(check({
    banned: ['Golos, Tireless Pilgrim'],
    offIdentity: [{ card: 'Heliod, Sun-Crowned', colours: 'W' }],
  }));
  assert.equal(said.banned.length, 1);
  assert.equal(said.offIdentity.length, 1);
  assert.match(said.bannedSentence, /banned/);
  assert.doesNotMatch(said.identitySentence, /banned/);
});

test('legalityProse: plural counts agree with the lists', () => {
  const said = View.legalityProse(check({
    banned: ['A', 'B'],
    offIdentity: [{ card: 'C', colours: 'W' }, { card: 'D', colours: 'B' }, { card: 'E', colours: 'R' }],
  }));
  assert.match(said.bannedSentence, /^2 cards in your list are banned/);
  assert.match(said.identitySentence, /^3 cards are outside/);
});

// What went unanswered rides along with a finding. It is not worth a panel of its
// own on a legal deck — that is an empty panel with a caveat in it — but a reader
// looking at one banned card should know the other half went unchecked.
test('legalityProse: no commander says the colour half was not checked', () => {
  const said = View.legalityProse(check({
    banned: ['Golos, Tireless Pilgrim'],
    commanders: [],
    canCheckIdentity: false,
  }));
  assert.ok(said.unchecked.some((s) => /No commander was named/.test(s)));
});

test('legalityProse: a commander the snapshot does not know says which reason it is', () => {
  const said = View.legalityProse(check({
    banned: ['Golos, Tireless Pilgrim'],
    commanders: ['Sol Rimg'],
    canCheckIdentity: false,
  }));
  assert.ok(said.unchecked.some((s) => /does not know your commander/.test(s)));
});

test('legalityProse: no ban list says nothing was checked against one', () => {
  const said = View.legalityProse(check({
    offIdentity: [{ card: 'Heliod, Sun-Crowned', colours: 'W' }],
    hasBanList: false,
  }));
  assert.ok(said.unchecked.some((s) => /no ban list/.test(s)));
});

// The same rule the unrecognized note uses, and the reason it exists: the published
// data has zeroed real cards' colour identities once already, and a commander whose
// identity came back empty makes every coloured card in the deck read as illegal.
test('legalityProse: half a deck reading as off-identity is about the data', () => {
  const many = Array.from({ length: 60 }, (_, i) => ({ card: 'Card ' + i, colours: 'W' }));
  assert.equal(View.legalityProse(check({ offIdentity: many, checked: 99 })), null);
  // A banned card alongside it still gets reported; the identity half is what is
  // being disbelieved, not the whole panel.
  const said = View.legalityProse(check({ offIdentity: many, checked: 99, banned: ['Golos, Tireless Pilgrim'] }));
  assert.equal(said.offIdentity.length, 0);
  assert.deepStrictEqual(said.banned, ['Golos, Tireless Pilgrim']);
});

// Only two of the format's rules are readable off a card list. A tick would be read
// as covering singleton and deck size, which nothing here looks at.
test('legalityProse: it says what it did not check', () => {
  const said = View.legalityProse(check({ banned: ['Golos, Tireless Pilgrim'] }));
  assert.match(said.note, /Singleton, deck size/);
  assert.match(said.note, /two legality rules/);
});

// One card must not collect two accusations. A banned card in the wrong colours is
// on both lists — the ban list is not filtered by colour — and two lines about one
// card read as two problems where there is one card to cut.
test('legalityProse: a banned card is not also accused of its colours', () => {
  const said = View.legalityProse(check({
    banned: ['Murderous Redcap'],
    offIdentity: [{ card: 'Murderous Redcap', colours: 'BR' }, { card: 'Heliod, Sun-Crowned', colours: 'W' }],
  }));
  assert.deepStrictEqual(said.banned, ['Murderous Redcap']);
  assert.deepStrictEqual(said.offIdentity, [{ card: 'Heliod, Sun-Crowned', colours: '{W}' }]);
  assert.match(said.identitySentence, /^One card is outside/, 'and the count follows the shorter list');
});

// A card whose only problem is the ban still leaves nothing on the colour line, and
// the panel does not render an empty one.
test('legalityProse: nothing survives the filter means no colour line at all', () => {
  const said = View.legalityProse(check({
    banned: ['Murderous Redcap'],
    offIdentity: [{ card: 'Murderous Redcap', colours: 'BR' }],
  }));
  assert.equal(said.offIdentity.length, 0);
});
