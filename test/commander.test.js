// Working out the commander from the decklist, for the very common case of a
// pasted list and an empty commander box.
const test = require('node:test');
const assert = require('node:assert');
const { detectCommanders, deckIdentity, nameKey } = require('../combos.js');
const { canBeCommander } = require('../tools/fetch-combos.js');

const DATASET = {
  cardIdentity: {
    'Kinnan, Bonder Prodigy': 'GU',
    'Thrasios, Triton Hero': 'GU',
    'Tymna the Weaver': 'WB',
    'Alesha, Who Smiles at Death': 'RWB',
    'Talrand, Sky Summoner': 'U',
    'Basalt Monolith': '',
    'Sol Ring': '',
    'Cyclonic Rift': 'U',
    'Birds of Paradise': 'G',
    'Swords to Plowshares': 'W',
    'Vampiric Tutor': 'B',
    'Lightning Bolt': 'R',
  },
  commanderNames: [
    'Kinnan, Bonder Prodigy', 'Thrasios, Triton Hero', 'Tymna the Weaver',
    'Alesha, Who Smiles at Death', 'Talrand, Sky Summoner',
  ],
};

const cards = (...names) => names.map((card) => ({ card, quantity: 1 }));

test('detectCommanders: the legend matching the deck colours is the commander', () => {
  const found = detectCommanders(
    cards('Basalt Monolith', 'Kinnan, Bonder Prodigy', 'Cyclonic Rift', 'Birds of Paradise'),
    DATASET
  );
  assert.strictEqual(found.confident, true);
  assert.deepStrictEqual(found.commanders.map((c) => c.card), ['Kinnan, Bonder Prodigy']);
});

test('detectCommanders: an off-colour legend is not mistaken for the commander', () => {
  // Talrand is mono-blue in a GU deck: he cannot be leading it.
  const found = detectCommanders(
    cards('Kinnan, Bonder Prodigy', 'Talrand, Sky Summoner', 'Birds of Paradise', 'Cyclonic Rift'),
    DATASET
  );
  assert.deepStrictEqual(found.commanders.map((c) => c.card), ['Kinnan, Bonder Prodigy']);
});

test('detectCommanders: partners splitting the colours between them', () => {
  const found = detectCommanders(
    cards('Thrasios, Triton Hero', 'Tymna the Weaver', 'Cyclonic Rift', 'Birds of Paradise',
      'Swords to Plowshares', 'Vampiric Tutor'),
    DATASET
  );
  assert.strictEqual(found.confident, true);
  assert.deepStrictEqual(found.commanders.map((c) => c.card).sort(),
    ['Thrasios, Triton Hero', 'Tymna the Weaver']);
});

test('detectCommanders: a commander wider than the cards the deck actually plays', () => {
  // Mardu commander, no red cards in the list. Her colours still cover the
  // deck's, and nothing else does, so she is the answer.
  const found = detectCommanders(
    cards('Alesha, Who Smiles at Death', 'Swords to Plowshares', 'Vampiric Tutor', 'Sol Ring'),
    DATASET
  );
  assert.strictEqual(found.confident, true);
  assert.deepStrictEqual(found.commanders.map((c) => c.card), ['Alesha, Who Smiles at Death']);
});

test('detectCommanders: ambiguity is reported, not guessed at', () => {
  // Two GU legends in a GU deck — nothing distinguishes them.
  const found = detectCommanders(
    cards('Kinnan, Bonder Prodigy', 'Thrasios, Triton Hero', 'Cyclonic Rift', 'Birds of Paradise'),
    DATASET
  );
  assert.strictEqual(found.confident, false);
  assert.deepStrictEqual(found.commanders, []);
  assert.deepStrictEqual(found.candidates.sort(), ['Kinnan, Bonder Prodigy', 'Thrasios, Triton Hero']);
});

test('detectCommanders: a deck with no possible commander in it', () => {
  assert.strictEqual(detectCommanders(cards('Sol Ring', 'Cyclonic Rift'), DATASET), null);
});

test('detectCommanders: off when the published data predates commander names', () => {
  const old = { cardIdentity: DATASET.cardIdentity };
  assert.strictEqual(detectCommanders(cards('Kinnan, Bonder Prodigy'), old), null);
});

// The safety property the whole feature rests on: a guess may be wrong about
// *who* is in charge, but it must never claim the deck plays fewer colours
// than its cards prove it plays, because that would hide combos.
test('an inferred commander never narrows the deck colour identity', () => {
  const decks = [
    cards('Kinnan, Bonder Prodigy', 'Cyclonic Rift', 'Birds of Paradise'),
    cards('Thrasios, Triton Hero', 'Tymna the Weaver', 'Cyclonic Rift', 'Birds of Paradise',
      'Swords to Plowshares', 'Vampiric Tutor'),
    cards('Alesha, Who Smiles at Death', 'Swords to Plowshares', 'Vampiric Tutor'),
    cards('Kinnan, Bonder Prodigy', 'Talrand, Sky Summoner', 'Lightning Bolt', 'Birds of Paradise'),
  ];
  for (const deck of decks) {
    const names = new Set(deck.map((c) => nameKey(c.card)));
    const fromDeck = deckIdentity([], DATASET.cardIdentity, names);
    const found = detectCommanders(deck, DATASET);
    if (!found || !found.confident) continue;
    const inferred = deckIdentity(found.commanders, DATASET.cardIdentity, names);
    for (const colour of fromDeck) {
      assert.ok(inferred.has(colour),
        `${[...inferred].join('')} dropped ${colour} from the deck's own ${[...fromDeck].join('')}`);
    }
  }
});

// ---- which cards the fetcher publishes as possible commanders --------------

test('canBeCommander: legendary creatures, and the rules-text exceptions', () => {
  const legal = { commander: 'legal' };
  const yes = (card) => assert.strictEqual(canBeCommander(card), true, card.name);
  const no = (card) => assert.strictEqual(canBeCommander(card), false, card.name);

  yes({ name: 'Kinnan, Bonder Prodigy', legalities: legal, type_line: 'Legendary Creature — Human Druid' });
  yes({ name: 'Rowan, Scion of War', legalities: legal, type_line: 'Legendary Planeswalker — Rowan',
    oracle_text: 'Rowan, Scion of War can be your commander.' });
  yes({ name: 'Cultist of the Absolute', legalities: legal, type_line: 'Legendary Enchantment — Background' });

  no({ name: 'Sol Ring', legalities: legal, type_line: 'Artifact' });
  no({ name: 'Llanowar Elves', legalities: legal, type_line: 'Creature — Elf Druid' });
  // Banned or not a real card: the legality field settles it before types do.
  no({ name: 'Golos, Tireless Pilgrim', legalities: { commander: 'banned' }, type_line: 'Legendary Creature — Scout' });
  no({ name: 'Angel', legalities: { commander: 'not_legal' }, type_line: 'Token Legendary Creature — Angel' });
});

test('canBeCommander: only the front face makes a card a commander', () => {
  // Westvale Abbey is a land that flips into a legendary creature. The combined
  // type line contains both halves, and reading it whole would call the land a
  // commander.
  assert.strictEqual(canBeCommander({
    name: 'Westvale Abbey // Ormendahl, Profane Prince',
    legalities: { commander: 'legal' },
    type_line: 'Land // Legendary Creature — Demon',
    card_faces: [
      { type_line: 'Land', oracle_text: '{T}: Add {C}.' },
      { type_line: 'Legendary Creature — Demon', oracle_text: 'Flying, lifelink, indestructible, haste' },
    ],
  }), false);

  // A double-faced legend is still a commander.
  assert.strictEqual(canBeCommander({
    name: 'Brutal Cathar // Moonrage Brute',
    legalities: { commander: 'legal' },
    type_line: 'Legendary Creature — Human Soldier Werewolf // Legendary Creature — Werewolf',
    card_faces: [
      { type_line: 'Legendary Creature — Human Soldier Werewolf' },
      { type_line: 'Legendary Creature — Werewolf' },
    ],
  }), true);
});
