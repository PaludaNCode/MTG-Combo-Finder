const test = require('node:test');
const assert = require('node:assert');
const { computeSuggestions, deckNameSet, nameKey, edhrecSlug } = require('../combos.js');

function variant(id, ...cardNames) {
  return { id, uses: cardNames.map((name) => ({ card: { name } })) };
}

test('computeSuggestions: ranks cards by combos unlocked', () => {
  const deck = deckNameSet([{ card: 'Basalt Monolith' }, { card: 'Kinnan, Bonder Prodigy' }]);
  const variants = [
    variant('1', 'Basalt Monolith', 'Rings of Brighthearth'),
    variant('2', 'Basalt Monolith', 'Rings of Brighthearth'), // Rings again -> 2 unlocks
    variant('3', 'Kinnan, Bonder Prodigy', 'Basalt Monolith', 'Zealous Conscripts'),
  ];
  const suggestions = computeSuggestions(variants, deck);
  assert.strictEqual(suggestions.length, 2);
  assert.strictEqual(suggestions[0].card, 'Rings of Brighthearth');
  assert.strictEqual(suggestions[0].unlocks.length, 2);
  assert.strictEqual(suggestions[1].card, 'Zealous Conscripts');
  assert.strictEqual(suggestions[1].unlocks.length, 1);
});

test('computeSuggestions: combos missing 2+ cards are not suggestions', () => {
  const deck = deckNameSet([{ card: 'Sol Ring' }]);
  const variants = [variant('1', 'Sol Ring', 'Basalt Monolith', 'Rings of Brighthearth')];
  assert.deepStrictEqual(computeSuggestions(variants, deck), []);
});

test('computeSuggestions: ties broken alphabetically', () => {
  const deck = deckNameSet([{ card: 'Sol Ring' }]);
  const variants = [
    variant('1', 'Sol Ring', 'Zealous Conscripts'),
    variant('2', 'Sol Ring', 'Aetherflux Reservoir'),
  ];
  const suggestions = computeSuggestions(variants, deck);
  assert.deepStrictEqual(suggestions.map((s) => s.card), ['Aetherflux Reservoir', 'Zealous Conscripts']);
});

test('computeSuggestions: double-faced Spellbook names match front-face deck entries', () => {
  const deck = deckNameSet([{ card: 'Valki, God of Lies' }, { card: 'Sol Ring' }]);
  const variants = [
    variant('1', 'Valki, God of Lies // Tibalt, Cosmic Impostor', 'Sol Ring', 'Maskwood Nexus'),
  ];
  const suggestions = computeSuggestions(variants, deck);
  assert.strictEqual(suggestions.length, 1);
  assert.strictEqual(suggestions[0].card, 'Maskwood Nexus');
});

test('nameKey: case-insensitive, front face only', () => {
  assert.strictEqual(nameKey('Valki, God of Lies // Tibalt, Cosmic Impostor'), 'valki, god of lies');
  assert.strictEqual(nameKey('SOL RING'), 'sol ring');
});

// An apostrophe is an apostrophe however it was typed, and this one reached users.
// Spellbook and Scryfall spell names with an ASCII quote; a curly one arrives from a word
// processor, from copying a list out of an article, and from Scryfall's own oracle text.
// Keyed literally they are different cards, so a deck holding Ashnod's Altar found none of
// its combos and the page called the card unrecognized.
test('nameKey: a curly apostrophe is the same card as a straight one', () => {
  assert.strictEqual(nameKey('Ashnod\u2019s Altar'), nameKey("Ashnod's Altar"));
  assert.strictEqual(nameKey('Ashnod\u2019s Altar'), "ashnod's altar");
  // The whole family, because exports do not agree on which one they use.
  for (const mark of ['\u2018', '\u2019', '\u201A', '\u201B', '\u02BC', '\u00B4', '`']) {
    assert.strictEqual(nameKey('Ashnod' + mark + 's Altar'), "ashnod's altar", 'mark ' + escape(mark));
  }
});

// The end of that: a pasted decklist matches the published combo either way. This is the
// assertion that would have caught it — nameKey alone looks fine in isolation.
test('nameKey: a decklist typed with curly apostrophes still matches the data', () => {
  const deck = deckNameSet([{ card: 'Ashnod\u2019s Altar' }, { card: 'Yawgmoth\u2019s Will' }]);
  assert.ok(deck.has(nameKey("Ashnod's Altar")), 'the deck holds the card Spellbook published');
  assert.ok(deck.has(nameKey("Yawgmoth's Will")));
});

test('edhrecSlug: strips punctuation and accents', () => {
  assert.strictEqual(edhrecSlug('Kinnan, Bonder Prodigy'), 'kinnan-bonder-prodigy');
  assert.strictEqual(edhrecSlug("Jötun Grunt"), 'jotun-grunt');
  assert.strictEqual(edhrecSlug('Valki, God of Lies // Tibalt, Cosmic Impostor'), 'valki-god-of-lies');
});

// ---- the second count ------------------------------------------------------
//
// Both panels used to speak only for Spellbook, which answered their own question
// wrong: a card holding up four combos nobody published was shown as holding up
// none, and a card that would unlock four could not be suggested at all. The two
// numbers now sit side by side and never merge — one is Spellbook's word and one
// is ours, and adding them would be a claim neither of them makes.

const { comboPieces } = require('../combos.js');

const ours = (id, needs, ...cardNames) => Object.assign(
  variant(id, ...cardNames),
  { needs, unofficial: { confidence: 'verified' } }
);

test('comboPieces: unofficial combos are counted beside the published ones', () => {
  const published = [variant('1', 'Scurry Oak', 'Sadistic Glee')];
  const unofficial = [
    ours('u1', undefined, 'Scurry Oak', 'Necrosynthesis'),
    ours('u2', undefined, 'Scurry Oak', 'Hammerhead, Maggia Boss'),
  ];
  const pieces = comboPieces(published, unofficial);
  const oak = pieces.find((p) => p.card === 'Scurry Oak');
  assert.strictEqual(oak.count, 1, 'the published count absorbed ours');
  assert.strictEqual(oak.unofficial, 2);
  // Both lists are behind the row, because cutting the card costs all three.
  assert.strictEqual(oak.combos.length, 3);
});

// The case the old panel could not express: the card is not in it at all.
test('comboPieces: a card carrying only unofficial combos is still listed', () => {
  const pieces = comboPieces([], [ours('u1', undefined, 'Hammerhead, Maggia Boss', 'Scurry Oak')]);
  const hammerhead = pieces.find((p) => p.card === 'Hammerhead, Maggia Boss');
  assert.ok(hammerhead, 'the card is missing from the panel');
  assert.strictEqual(hammerhead.count, 0);
  assert.strictEqual(hammerhead.unofficial, 1);
});

test('comboPieces: ranking is by the two together, published breaking the tie', () => {
  const published = [
    variant('1', 'Two Published', 'x'),
    variant('2', 'Two Published', 'y'),
    variant('3', 'One Each', 'z'),
  ];
  const unofficial = [
    ours('u1', undefined, 'One Each', 'q'),
    ours('u2', undefined, 'Three Ours', 'q'),
    ours('u3', undefined, 'Three Ours', 'r'),
    ours('u4', undefined, 'Three Ours', 's'),
  ];
  const order = comboPieces(published, unofficial).map((p) => p.card);
  assert.deepStrictEqual(order.slice(0, 3), ['Three Ours', 'Two Published', 'One Each']);
});

test('computeSuggestions: an unofficial near miss is its own count on the row', () => {
  const deck = deckNameSet([{ card: 'Scurry Oak' }, { card: 'Necrosynthesis' }]);
  const published = [variant('1', 'Scurry Oak', 'Sadistic Glee')];
  const unofficial = [
    ours('u1', ['Viscera Seer'], 'Scurry Oak', 'Necrosynthesis', 'Viscera Seer'),
    ours('u2', ['Viscera Seer'], 'Scurry Oak', 'Viscera Seer', 'Sadistic Glee'),
  ];
  const suggestions = computeSuggestions(published, deck, unofficial);
  const seer = suggestions.find((s) => s.card === 'Viscera Seer');
  assert.ok(seer, 'a card only our rows want was not suggested');
  assert.strictEqual(seer.unlocks.length, 0);
  assert.strictEqual(seer.unofficial.length, 2);
  // Ranked above a card with one published unlock, because two beats one.
  assert.strictEqual(suggestions[0].card, 'Viscera Seer');
});

test('computeSuggestions: a row the deck can already assemble is not a suggestion', () => {
  const deck = deckNameSet([{ card: 'Scurry Oak' }, { card: 'Necrosynthesis' }]);
  // No `needs`, so it is a combo the deck has rather than a reason to add a card.
  const held = [ours('u1', undefined, 'Scurry Oak', 'Necrosynthesis')];
  assert.deepStrictEqual(computeSuggestions([], deck, held), []);
});

test('computeSuggestions: equal reach puts the published unlocks first', () => {
  const deck = deckNameSet([{ card: 'Held' }]);
  const published = [variant('1', 'Held', 'Theirs'), variant('2', 'Held', 'Theirs')];
  const unofficial = [
    ours('u1', ['Ours'], 'Held', 'Ours'),
    ours('u2', ['Ours'], 'Held', 'Ours', 'x'),
  ];
  const order = computeSuggestions(published, deck, unofficial).map((s) => s.card);
  assert.deepStrictEqual(order, ['Theirs', 'Ours']);
});

// ---- the order a drawn list reads in ----------------------------------------
//
// Aligning each row inside itself is only half of it. The rows are sorted too, and
// sorting them on their alphabetical names put a family's members at positions 2, 4
// and 7 of Carrion Feeder's real list, split by a Cauldron Familiar row and two Herd
// Baloth rows — so the difference sat in one column and the eye still had to hunt for
// which rows to compare. Sorted on the drawn name they sort by what they share first.

test('comboPieces: rows that share their cards sit together, not wherever they sort', () => {
  // The shape from the live list. "Archangel of Thune" and "Animation Module" sort
  // above the shared cards, which is exactly what used to scatter these.
  const published = [
    variant('1', 'Carrion Feeder', 'Kitchen Finks', 'Archangel of Thune'),
    variant('2', 'Carrion Feeder', 'Cauldron Familiar', 'Samwise Gamgee'),
    variant('3', 'Carrion Feeder', 'Kitchen Finks', 'Heliod, Sun-Crowned'),
    variant('4', 'Carrion Feeder', 'Herd Baloth', 'Necrosynthesis'),
    variant('5', 'Carrion Feeder', 'Pitiless Plunderer', 'Animation Module'),
    variant('6', 'Carrion Feeder', 'Kitchen Finks', 'Heroic Feast'),
    variant('7', 'Carrion Feeder', 'Herd Baloth', 'Sadistic Glee'),
  ];
  const piece = comboPieces(published, []).find((p) => p.card === 'Carrion Feeder');
  const ids = piece.combos.map((v) => v.id);

  const at = (id) => ids.indexOf(id);
  const adjacent = (...family) => {
    const seats = family.map(at).sort((a, b) => a - b);
    return seats[seats.length - 1] - seats[0] === family.length - 1;
  };
  assert.ok(adjacent('1', '3', '6'), `the Kitchen Finks rows are split: ${ids.join(', ')}`);
  assert.ok(adjacent('4', '7'), `the Herd Baloth rows are split: ${ids.join(', ')}`);
});

test('comboPieces: a family stays together across the official / unofficial split', () => {
  // The Heroic Feast row in the live list is one of ours, and it belongs beside the
  // published Kitchen Finks rows rather than wherever a second sort would put it.
  const published = [
    variant('1', 'Carrion Feeder', 'Kitchen Finks', 'Archangel of Thune'),
    variant('2', 'Carrion Feeder', 'Cauldron Familiar', 'Samwise Gamgee'),
  ];
  const unofficial = [ours('u1', undefined, 'Carrion Feeder', 'Kitchen Finks', 'Heroic Feast')];
  const ids = comboPieces(published, unofficial)
    .find((p) => p.card === 'Carrion Feeder').combos.map((v) => v.id);
  assert.strictEqual(Math.abs(ids.indexOf('1') - ids.indexOf('u1')), 1,
    `ours was separated from the family it belongs to: ${ids.join(', ')}`);
});

// Smallest first still outranks it: a 4-card row never sorts up among the 3-card rows
// it happens to share cards with, because the size breakdown on the row above says the
// same thing and a 4-card line at the top reads as a recommendation to build it.
test('comboPieces: size still leads, whatever the names do', () => {
  const published = [
    variant('1', 'Carrion Feeder', 'Kitchen Finks', 'Archangel of Thune', 'Sol Ring'),
    variant('2', 'Carrion Feeder', 'Kitchen Finks', 'Archangel of Thune'),
  ];
  const ids = comboPieces(published, []).find((p) => p.card === 'Carrion Feeder').combos.map((v) => v.id);
  assert.deepStrictEqual(ids, ['2', '1']);
});

// The list-order half of the same case: once the axis is settled, the four rows of a 2×2
// sort into two adjacent pairs rather than into two blocks with other rows between them.
test('comboPieces: a 2x2 of interchangeable groups sorts into two adjacent pairs', () => {
  const published = [
    variant('1', 'Carrion Feeder', 'Herd Baloth', 'Necrosynthesis'),
    variant('2', 'Carrion Feeder', 'Kitchen Finks', 'Archangel of Thune'),
    variant('3', 'Carrion Feeder', 'Scurry Oak', 'Necrosynthesis'),
    variant('4', 'Carrion Feeder', 'Herd Baloth', 'Sadistic Glee'),
    variant('5', 'Carrion Feeder', 'Kitchen Finks', 'Heliod, Sun-Crowned'),
    variant('6', 'Carrion Feeder', 'Scurry Oak', 'Sadistic Glee'),
  ];
  const ids = comboPieces(published, []).find((p) => p.card === 'Carrion Feeder').combos.map((v) => v.id);
  const pair = (a, b) => Math.abs(ids.indexOf(a) - ids.indexOf(b)) === 1;
  assert.ok(pair('1', '4'), `the Herd Baloth pair is split: ${ids.join(', ')}`);
  assert.ok(pair('3', '6'), `the Scurry Oak pair is split: ${ids.join(', ')}`);
  assert.ok(pair('2', '5'), `the Kitchen Finks pair is split: ${ids.join(', ')}`);
});

// ---- rows move, cards do not -------------------------------------------------
//
// The row order is a choice about which rows to read first; the card order inside a row is
// a separate choice, made by orderComboNames(). Sorting must never reach into the second
// one, and "must never" is worth a test rather than an argument: the comparator reads the
// drawn name, and reading it is one keystroke from rewriting it.

const { interchangeableIn, orderComboNames, variantCardNames } = require('../combos.js');

const drawnBy = (list, lead) => {
  const trails = interchangeableIn(list);
  return list.map((v) => [v.id, orderComboNames(variantCardNames(v), {
    lead, trail: trails.get(v),
  }).join(' + ')]);
};

test('comboPieces: sorting the rows leaves every row\'s cards exactly as they were', () => {
  const lead = 'Carrion Feeder';
  const rows = [
    variant('1', lead, 'Kitchen Finks', 'Archangel of Thune'),
    variant('2', lead, 'Cauldron Familiar', 'Samwise Gamgee'),
    variant('3', lead, 'Kitchen Finks', 'Heliod, Sun-Crowned'),
    variant('4', lead, 'Herd Baloth', 'Necrosynthesis'),
    variant('5', lead, 'Kitchen Finks', 'Heroic Feast'),
    variant('6', lead, 'Herd Baloth', 'Sadistic Glee'),
  ];
  const before = drawnBy(rows, lead).sort();
  const after = drawnBy(
    comboPieces(rows, []).find((p) => p.card === lead).combos, lead
  ).sort();
  assert.deepStrictEqual(after, before, 'a row was redrawn, not just moved');
});

// The same invariant from the other side: the answer cannot depend on the order the rows
// arrived in, or "we only moved rows" would be true of one input and false of another.
test('comboPieces: the cards a row draws do not depend on the order the rows arrived in', () => {
  const lead = 'Carrion Feeder';
  const rows = [
    variant('1', lead, 'Herd Baloth', 'Necrosynthesis'),
    variant('2', lead, 'Scurry Oak', 'Necrosynthesis'),
    variant('3', lead, 'Herd Baloth', 'Sadistic Glee'),
    variant('4', lead, 'Scurry Oak', 'Sadistic Glee'),
  ];
  const one = drawnBy(comboPieces(rows, []).find((p) => p.card === lead).combos, lead).sort();
  const other = drawnBy(
    comboPieces(rows.slice().reverse(), []).find((p) => p.card === lead).combos, lead
  ).sort();
  assert.deepStrictEqual(other, one);
});

// ---- which rows come first ---------------------------------------------------

// Alphabetical alone opens a list on whichever block starts with an A — Carrion Feeder's
// real list opened on a Cauldron Familiar row that is the only one of its kind, above
// three Kitchen Finks rows that are one decision between three cards. The blocks come
// first now, biggest down to smallest, and the rows that stand alone follow.
test('comboPieces: the biggest block of versions leads, then smaller ones, then singles', () => {
  const lead = 'Carrion Feeder';
  const rows = [
    // One row of its own that sorts alphabetically above everything else.
    variant('single', lead, 'Cauldron Familiar', 'Samwise Gamgee'),
    // A block of two.
    variant('two-a', lead, 'Herd Baloth', 'Necrosynthesis'),
    variant('two-b', lead, 'Herd Baloth', 'Sadistic Glee'),
    // A block of three.
    variant('three-a', lead, 'Kitchen Finks', 'Archangel of Thune'),
    variant('three-b', lead, 'Kitchen Finks', 'Heliod, Sun-Crowned'),
    variant('three-c', lead, 'Kitchen Finks', 'Heroic Feast'),
  ];
  const ids = comboPieces(rows, []).find((p) => p.card === lead).combos.map((v) => v.id);
  assert.deepStrictEqual(ids,
    ['three-a', 'three-b', 'three-c', 'two-a', 'two-b', 'single']);
});

// Combo size still outranks the block size, and nothing is lost to it: a family's rows all
// hold the same number of cards, since they share every card but one.
test('comboPieces: a small combo still leads a bigger block of bigger combos', () => {
  const lead = 'Carrion Feeder';
  const rows = [
    variant('big-a', lead, 'Kitchen Finks', 'Archangel of Thune', 'Sol Ring'),
    variant('big-b', lead, 'Kitchen Finks', 'Heliod, Sun-Crowned', 'Sol Ring'),
    variant('big-c', lead, 'Kitchen Finks', 'Heroic Feast', 'Sol Ring'),
    variant('small', lead, 'Pitiless Plunderer'),
  ];
  const ids = comboPieces(rows, []).find((p) => p.card === lead).combos.map((v) => v.id);
  assert.strictEqual(ids[0], 'small', `a 2-card combo must lead: ${ids.join(', ')}`);
});
