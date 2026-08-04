// The fixture deck and dataset the browser tests run against — the layout smoke
// test in tools/verify-layout.js and the Playwright suite in e2e/ both drive the
// real pages against this, and neither may drift from the other. It is here
// rather than in either of them because two copies of a fixture is two fixtures:
// a case added to one and not the other is a claim only half the tests make.
//
// Kept out of the published data on purpose. Everything below is made up to
// produce a page with every section on it — combos the deck can assemble, some
// it is one card away from, one it is one *slot* away from, on-colour
// suggestions and off-colour ones — so a rendering test never depends on what
// Commander Spellbook happened to publish this morning.
'use strict';

// A deck that produces every section: complete combos, on-colour suggestions
// and off-colour ones. Kept here so the test doesn't depend on published data.
const FIXTURE = {
  updatedAt: '2026-01-01T00:00:00Z',
  cardIdentity: {
    'Kinnan, Bonder Prodigy': 'GU', 'Basalt Monolith': '', 'Rings of Brighthearth': '',
    'Palinchron': 'U', 'Deadeye Navigator': 'U', 'Great Whale': 'U',
    'Walking Ballista': '', 'Heliod, Sun-Crowned': 'W', 'Island': 'U',
    'Sword of the Meek': '', 'Bloom Tender': 'G', 'Devoted Druid': 'G',
    'The Destined White Mage': 'G',
    'Murderous Redcap': 'BR',
  },
  commanderNames: ['Kinnan, Bonder Prodigy', 'Heliod, Sun-Crowned'],
  // Wizards' Game Changer list, as the fetcher publishes it. Which real cards are
  // on it is not this test's business — it comes from Scryfall's own flag — so
  // these are the fixture's own cards, chosen to make the page say something:
  // two are in the deck (floor 3), and Bloom Tender is not, so a list of three
  // must still report two.
  gameChangers: ['Bloom Tender', 'Palinchron', 'Rings of Brighthearth'],
  // The Commander ban list, as the fetcher publishes it. Which cards are really on
  // it is Scryfall's business and not this test's — a fixture pinning the real list
  // would be a second copy of it, going stale here. Murderous Redcap is not banned
  // in Commander; it is a card this fixture already knows, off the tuning deck's
  // colours, which is what makes it usable for both halves of the legality check.
  banned: ['Murderous Redcap'],
  // A combo slot that names a property rather than a card, and the deck's
  // Walking Ballista filling it. The rendered row has to say so — a combo that
  // appears because of a slot but cannot show which card filled it reads as
  // invented, which is the whole risk this feature carries.
  templates: { 42: 'Creature with a Free Sacrifice Ability', 55: 'Persist Creature' },
  // 84 is a template Spellbook publishes no Scryfall query for, so it has a name
  // and can never have a card list — the "one slot away, and nothing to offer
  // for it" case.
  unresolvable: { 84: 'Haste Enabler' },
  templateCards: {
    'walking ballista': [42], 'devoted druid': [42],
    // Neither is in the deck, so both are candidates for the slot combo 13 is
    // short of. Bloom Tender is green, which the deck is; Murderous Redcap is
    // not, and must be counted but not named.
    'bloom tender': [55], 'murderous redcap': [55],
  },
  combos: [
    { id: '1', c: ['Kinnan, Bonder Prodigy', 'Basalt Monolith'],
      p: ['Infinite ETB', 'Win the game', 'Infinite lifegain', 'Infinite colorless mana', 'Infinite LTB',
          'Infinite death triggers', 'Infinite storm count', 'Infinite sacrifice triggers',
          'Infinite creature tokens', 'Lock'],
      i: 'GU', pop: 999 },
    { id: '2', c: ['Basalt Monolith', 'Rings of Brighthearth'], p: ['Infinite colorless mana'], i: 'C', pop: 90 },
    { id: '6', c: ['Basalt Monolith', 'Kinnan, Bonder Prodigy', 'Walking Ballista'], p: ['Infinite damage'], i: 'GU', pop: 10 },
    { id: '3', c: ['Palinchron', 'Deadeye Navigator'], p: ['Infinite mana'], i: 'U' },
    { id: '4', c: ['Great Whale', 'Deadeye Navigator'], p: ['Infinite mana'], i: 'U' },
    // A third combo Deadeye Navigator would unlock, needing one more card than
    // the two above. Without a suggestion whose combos differ in size, the
    // per-card breakdown renders one pill and proves nothing.
    // Deliberately the most-played of Deadeye Navigator's three, and the largest.
    // Sorting a suggestion's combos on popularity alone floats this above the two
    // 2-card lines, so this `pop` is what makes "smallest first" a claim the run can
    // actually falsify rather than one the fixture satisfies by accident.
    { id: '14', c: ['Palinchron', 'Deadeye Navigator', 'Basalt Monolith'], p: ['Infinite mana'], i: 'U', pop: 95 },
    // Interchangeable with combo 2: same partner, same result, one card swapped.
    // Both are already in the deck.
    { id: '8', c: ['Basalt Monolith', 'Sword of the Meek'], p: ['Infinite colorless mana'], i: 'C', pop: 80 },
    // And a third off the same partner, which is what makes this group *fold*. A pair is
    // written out as two rows now — see COLLAPSE_FROM in combos.js — so a fixture whose
    // only families are pairs draws no collapsed row at all, and every assertion about
    // the shape (the "any of N" heading, the line of choices under it, the "All N
    // versions" disclosure, the compare link covering the whole choice) goes quietly
    // vacuous. The run says so out loud rather than passing: it failed with "no combo row
    // collapsed its interchangeable part" the moment the threshold moved.
    //
    // Great Whale rather than a new card on purpose. It is already on the map through
    // combo 15, so the map's card count does not move and the geometry assertions stay
    // about geometry. It does add two interchangeable relations — Great Whale now stands
    // in for Rings of Brighthearth and for Sword of the Meek — which is why the map's
    // count of those goes from 5 to 7.
    { id: '18', c: ['Basalt Monolith', 'Great Whale'], p: ['Infinite colorless mana'], i: 'U', pop: 79 },
    // The same two cards standing in for each other a *second* time, off a
    // different partner. One swap is the thinnest line the map draws and carries
    // no number; two is what makes the map's second relation — and the number on
    // it — something this run can actually check.
    { id: '16', c: ['Palinchron', 'Rings of Brighthearth'], p: ['Infinite mana'], i: 'U', pop: 40 },
    { id: '17', c: ['Palinchron', 'Sword of the Meek'], p: ['Infinite mana'], i: 'U', pop: 39 },
    // And two more that only differ in the card you'd have to add, so the
    // suggestion for them has to read as one choice, not two recommendations.
    { id: '9', c: ['Walking Ballista', 'Bloom Tender'], p: ['Infinite damage'], i: 'G' },
    { id: '10', c: ['Walking Ballista', 'Devoted Druid'], p: ['Infinite damage'], i: 'G' },
    // A third interchangeable option, deliberately long-named. With one alternative
    // row the claim "every + Add lines up" is true whatever the CSS does; with two of
    // very different widths it is a claim about the layout. The name is real, and it
    // is the one from the report that pushed its button onto a second line.
    { id: '15', c: ['Walking Ballista', 'The Destined White Mage'], p: ['Infinite damage'], i: 'G' },
    { id: '5', c: ['Walking Ballista', 'Heliod, Sun-Crowned'], p: ['Infinite damage'], i: 'W' },
    // Complete only because the deck fills the slot.
    { id: '11', c: ['Rings of Brighthearth'], t: [42], p: ['Infinite damage'], i: 'C', pop: 70 },
    // Every named card present, one slot short — the deck cannot pull it off, so it
    // must appear nowhere at all. It used to have a panel of its own; the layout test
    // now asserts this id is absent from every combo link on the page, which is what
    // keeps the removal honest. Bloom Tender and Murderous Redcap both fill the slot
    // and neither is in the deck.
    { id: '13', c: ['Basalt Monolith'], t: [55], p: ['Infinite damage'], i: 'G', pop: 60 },
    // Short of a slot Spellbook publishes no query for: nameable, never
    // fillable, so the row has to admit there is nothing to offer.
    { id: '12', c: ['Rings of Brighthearth'], t: [84], p: ['Infinite damage'], i: 'C', pop: 71 },
    // Big and popular, and every card in the deck. Under the old popularity-only
    // sort this came second; it now has to come last, after every smaller combo.
    // Without it the fixture's biggest combo is also its least played, and the
    // ordering would pass whichever rule were in force.
    { id: '15', c: ['Palinchron', 'Basalt Monolith', 'Great Whale', 'Kinnan, Bonder Prodigy'],
      p: ['Infinite mana'], i: 'GU', pop: 500 },
  ],
};

// Written the way Moxfield exports it, commander marked inline and nothing
// typed into the commander box — the path most people actually take.
const REST = [
  '1 Basalt Monolith', '1 Rings of Brighthearth', '1 Palinchron',
  '1 Great Whale', '1 Walking Ballista', '1 Sword of the Meek', '10 Island',
];
// tiers.html is checked against data carrying a result result-tiers.js does not
// list — the "Spellbook shipped a new set" case. Catching that is the entire
// reason the page is in the repository, so it is worth a test rather than trust.
const UNKNOWN_RESULT = 'Infinite eldrazi spawn from the Blind Eternities';
const TIERS_FIXTURE = {
  updatedAt: '2026-01-01T00:00:00Z',
  count: 3,
  combos: [
    { id: 't1', c: ['Kinnan, Bonder Prodigy', 'Basalt Monolith'], p: ['Win the game', 'Infinite colorless mana', 'Infinite ETB'], i: 'GU' },
    { id: 't2', c: ['A', 'B'], p: ['Infinite lifegain', 'Infinite LTB'], i: 'C' },
    { id: 't3', c: ['A', 'C'], p: [UNKNOWN_RESULT], i: 'C' },
  ],
};

const DECKS = {
  marked: ['1 Kinnan, Bonder Prodigy (C21) 3 *CMDR*'].concat(REST).join('\n'),
  plain: ['1 Kinnan, Bonder Prodigy'].concat(REST).join('\n'),
  // Ends in a sideboard, which is how several sites export a list — and the shape
  // that broke "+ Add to deck": a card appended to the end of the box landed under
  // the heading, parsed as a sideboard card, never entered the deck, and came back
  // as a suggestion on the next search. The button appeared to do nothing.
  sideboarded: ['1 Kinnan, Bonder Prodigy (C21) 3 *CMDR*']
    .concat(REST, ['', 'Sideboard:', '1 Pithing Needle']).join('\n'),
  // Exactly one unofficial row's cards and nothing else, so the page has no
  // published combo to find and precisely one of ours. Real card names, because
  // the row being matched is the real one out of unofficial.js.
  unofficial: ['1 Scurry Oak', '1 Necrosynthesis', '1 Viscera Seer'].join('\n'),
  // The same, for the one row that is two swaps from a published combo rather
  // than one. A chained row makes a weaker claim than a single swap, so the page
  // has to spell out both steps rather than quietly showing the last one.
  chained: ['1 Kitchen Finks', '1 Heroic Feast', '1 Hammerhead, Maggia Boss'].join('\n'),
  // One card short of an unofficial row and of nothing else, so the suggestion
  // for that card is carried entirely by combos nobody published — the case the
  // page could not express at all until the second count existed.
  unofficialAlmost: ['1 Scurry Oak', '1 Necrosynthesis'].join('\n'),
  // The tuning deck with a misspelling in it, and a token line of the kind deck
  // sites export. Both parse as perfectly good card lines — quantity, name, no set
  // code — so both reach the search and match nothing, which is exactly the failure
  // the page has to say something about. Every other card here is in the fixture's
  // `cardIdentity`, so the unknown fraction stays low enough for the page to speak;
  // that is the point of the deck, and `marked` is the other branch of the same
  // rule, where nothing is unknown and nothing is said.
  misspelled: ['1 Kinnan, Bonder Prodigy (C21) 3 *CMDR*']
    .concat(REST, ['1 Sol Rimg', '1 Treasure']).join('\n'),
  // The tuning deck made illegal two different ways, which is one deck because the
  // two findings have to be shown together to be shown apart: Heliod is white and
  // the commander is {G}{U}, so it is off-identity, and Murderous Redcap is on this
  // fixture's ban list. Both are in `cardIdentity`, so neither is an unrecognized
  // card as well — one card must not collect two accusations.
  illegal: ['1 Kinnan, Bonder Prodigy (C21) 3 *CMDR*']
    .concat(REST, ['1 Heliod, Sun-Crowned', '1 Murderous Redcap']).join('\n'),
  // The same cards with no commander named, which is the case the identity half
  // cannot answer at all: a Commander deck's identity is its commander's, and there
  // is no commander to read. It has to say that rather than fall back on the deck's
  // own colours, which would make every list legal by construction.
  illegalNoCommander: ['1 Kinnan, Bonder Prodigy']
    .concat(REST, ['1 Heliod, Sun-Crowned', '1 Murderous Redcap']).join('\n'),
};

// ---- the shape the deploy actually publishes --------------------------------
//
// Everything above is authored the readable way: card names and result strings,
// spelled out. The published payload is not that. It interns both into tables and
// leaves most rows with no `id` at all, because theirs is rebuilt from `cardIds` —
// and `DeckCombos.decode()` is what turns one into the other.
//
// Serving the readable shape to the browser tests meant nothing ever exercised the
// shape the pages actually receive. That is not a theoretical gap: tiers.html reads
// combos.json directly, never called decode(), and went to production stuck on
// "Loading the combo database…" while every test here passed. The layout test even
// has two runs dedicated to that page.
//
// So the fixture is authored readably and *served* published. A page that forgets
// to decode now fails in CI instead of in front of a reader.
function asPublished(fixture) {
  const data = JSON.parse(JSON.stringify(fixture));
  const names = [];
  const results = [];
  const indexOf = (value, table) => {
    const at = table.indexOf(value);
    return at === -1 ? table.push(value) - 1 : at;
  };

  for (const combo of data.combos || []) {
    if (Array.isArray(combo.c)) combo.c = combo.c.map((n) => indexOf(n, names));
    if (Array.isArray(combo.p)) combo.p = combo.p.map((p) => indexOf(p, results));
  }

  // Every row keeps its literal id, which is a real published shape — it is what
  // happens to a row whose card ids the derivation could not settle, and 162 of
  // them look exactly like this in the live snapshot.
  //
  // Not dropped here, deliberately. The harnesses identify particular combos by id
  // (`/\/13\//` on the one-slot-away row, for instance), so deriving them would
  // couple those assertions to synthetic numbers and say nothing extra about the
  // page. The rebuild path is covered where it belongs: test/decode.test.js drives
  // rebuildId() directly, and the encoding was checked against all 103,737 rows of
  // the published snapshot before it shipped.
  data.names = names;
  data.results = results;
  return data;
}

// ---- the steps tree, as the data branch carries it -------------------------
//
// Written in Commander Spellbook's variant shape rather than in the shape of the
// published file, and put through the real ComboSteps.pick() on the way out — so
// the browser tests are served what tools/fetch-combos.js would have written,
// down to the path. The same reasoning as asPublished() above, and the same
// incident behind it: a harness that serves a friendlier shape than production
// tests a page that does not exist.
//
// Combos 6 and 15 are deliberately absent. "No steps recorded for this combo yet"
// is a state the panel has to be able to draw, and a fixture where every row had
// steps would never draw it — nor would it ever exercise the 404 that is how the
// absence of steps is published.
const STEPS = {
  1: {
    manaNeeded: '{2}',
    notablePrerequisites: 'Basalt Monolith is untapped.',
    uses: [
      { card: { name: 'Kinnan, Bonder Prodigy' }, zoneLocations: ['B'], mustBeCommander: true },
      { card: { name: 'Basalt Monolith' }, zoneLocations: ['B'], battlefieldCardState: 'untapped' },
    ],
    description: 'Tap Basalt Monolith for three colourless mana.\n'
      + 'Kinnan triggers and adds one more.\nUntap Basalt Monolith for three and repeat.',
  },
  2: {
    uses: [{ card: { name: 'Rings of Brighthearth' }, zoneLocations: ['B'] }],
    description: 'Copy the untap ability with Rings of Brighthearth.\nRepeat.',
  },
};

// { '/steps/xx/1.json': '{"id":"1",…}' } — keyed by the URL the page will ask
// for, because that is the only thing a server needs to know and the only thing
// that can be wrong.
function stepsFiles() {
  const ComboSteps = require('../../combo-steps.js');
  const StepsSource = require('../../steps-source.js');
  const out = {};
  for (const [id, variant] of Object.entries(STEPS)) {
    const record = ComboSteps.pick(variant, id);
    if (record) out['/' + StepsSource.pathFor(id)] = JSON.stringify(record);
  }
  return out;
}

module.exports = { FIXTURE, DECKS, TIERS_FIXTURE, UNKNOWN_RESULT, asPublished, STEPS, stepsFiles };
