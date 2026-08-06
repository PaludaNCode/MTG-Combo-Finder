// Which cards have actually been looked at, and what looking found.
//
// `unofficial.js` records what a sweep *kept*. Until this file existed nothing
// recorded what a sweep *covered*, so "nothing remains open" could be written
// under an audit of 44 candidates and read as a statement about 103,737 combos.
// That is the failure this file exists to make impossible: a reader asking "has
// anybody checked Chatterfang?" gets an answer, and a reader asking "what has
// nobody checked?" gets one too, from tools/substitution-scope.js --unread.
//
// It is not page data. The browser never loads it — it answers a question about
// the project rather than about a deck — so it is a plain Node module rather than
// the dual-export IIFE the shipped files use.
//
// ---- what an entry means ----------------------------------------------------
//
//   subject     what the pass was about, in the words somebody would ask it in
//   cards       the cards it covered. THIS is the index: a card named here has
//               been swept, a card absent from every entry has not.
//   cardIds     their Spellbook ids, on the same reasoning as unofficial.js —
//               null where the published data has no such card
//   read        THE ORACLE TEXT, VERBATIM, for every card in `cards`. Not a
//               formality: a pass reasons about what cards do, and the cheapest
//               mistake available here is recalling a card instead of reading it.
//               It produces a rule-out that is invisible — no row, no test
//               failure, no complaint, just a card that looks covered. The Camellia
//               entry below threw away 35 candidates that way, on a text nobody had
//               opened. Entries predating the rule carried an UNREAD marker under a
//               ratchet that could only fall; it reached zero on 2026-08-03 and the
//               ratchet is gone. There is no allowance left — a pass records the text
//               or it fails.
//   method      how candidates were generated, because a pass is only as wide as
//               the net it threw
//   proposed    what the method produced before any judgement
//   examined    how many a human actually read. Lower than `proposed` whenever a
//               rule-out is mechanical — Chatterfang's 1,197 died to one fact
//               about artifact tokens, not to 1,197 readings
//   kept        how many became rows
//   ruledOut    why the rest did not, which is the part worth keeping. Counts are
//               given where the pass counted them and omitted where it did not;
//               an invented count would be worse than none. A rule-out may also
//               carry `sets`: the specific card combinations that reason killed,
//               so a tool can stop proposing them. See the note below — `sets` is
//               a subset of what the reason covers, always, and by construction.
//
// The arithmetic is not asserted — examined and kept are what somebody did, and
// proposed is what a tool said, and forcing them to reconcile would only invite
// tidying the numbers. test/research-log.test.js checks the shape, that every card
// set under `kept` is really in unofficial.js, and the thing that actually rots:
// that no unofficial row exists which no entry here claims to have found.
//
// ---- `sets`, and the one thing it must never be read as -----------------------
//
// tools/deck-gaps.js used to re-propose Scurry Oak + Sadistic Glee every run. The
// first sweep threw that pair out — the Squirrel has no sacrifice ability where
// Basking Broodscale's Eldrazi Spawn does — and the tool could not know, because
// the decision lived here as a sentence. `sets` is the machine-readable half: the
// specific card combinations a reason killed, so a tool can drop them.
//
// **It is a subset of its reason, always.** Most rule-outs here are categorical —
// "the loop needs a *token* out of the sacrifice, not just a sacrifice" — and cover
// shapes nobody ever enumerated, so they cannot be written as card sets at all.
// Some that could be were never written down at the time; the first sweep's
// "no token that can sacrifice itself" counted four and names two, because two is
// what the entry recorded and inventing the others would be the same failure as
// inventing a count.
//
// So ruledOutSets() answers exactly one question — *has this card set been ruled
// out?* — and only ever with **yes** or **nothing recorded**. It can never be asked
// whether something is still open, and no consumer may treat its silence as an
// answer. A partial index read as a complete one is worse than no index.
'use strict';

const { nameKey } = require('./combos.js');

const PASSES = [
  {
    subject: 'The first substitution sweep',
    cards: [
      'Quina, Qu Gourmet', 'Basking Broodscale', 'Trudge Garden', 'Camellia, the Seedmiser',
      'Cauldron Familiar', 'Warren Soultrader', 'Chatterfang, Squirrel General',
    ],
    cardIds: [6705, 5641, 2308, 5777, 856, 5670, 3000],
    read: {
      'Quina, Qu Gourmet': 'If one or more tokens would be created under your control, those tokens plus A 1/1 green Frog creature token are created instead. {2}, Sacrifice a Frog: Put a +1/+1 counter on Quina. Legendary Creature — Qu 2/3 for {2}{G}.',
      'Basking Broodscale': 'Devoid. {1}{G}: Adapt 1. Whenever one or more +1/+1 counters are put on this creature, you may create a 0/1 COLORLESS Eldrazi Spawn creature token with \u201cSacrifice this token: Add {C}.\u201d 2/2 for {1}{G}.',
      'Trudge Garden': 'Whenever you GAIN LIFE, you may PAY {2}. If you do, create a 4/4 green Fungus Beast creature token with trample. Enchantment for {2}{G}.',
      'Camellia, the Seedmiser': 'Menace. Other Squirrels you control have menace. Whenever you sacrifice one or more Foods, create a 1/1 green Squirrel creature token. {2}, Forage: Put a +1/+1 counter on each other Squirrel you control.',
      'Cauldron Familiar': 'When Cauldron Familiar enters, each opponent loses 1 life and you gain 1 life. Sacrifice a FOOD: Return Cauldron Familiar from your graveyard to the battlefield. Creature — Cat 1/1 for {B}.',
      'Warren Soultrader': 'Pay 1 life, Sacrifice another creature: Create a Treasure token.',
      'Chatterfang, Squirrel General': 'Forestwalk. If one or more tokens would be created under your control, those tokens plus that many 1/1 green Squirrel creature tokens are created instead. {B}, Sacrifice X Squirrels: Target creature gets +X/-X until end of turn.',
      'Scurry Oak': 'Evolve. Whenever one or more +1/+1 counters are put on this creature, you may create a 1/1 GREEN Squirrel creature token. 1/2 for {2}{G}.',
      'Herd Baloth': 'Whenever one or more +1/+1 counters are put on this creature, you may create a 4/4 GREEN Beast creature token. 4/4 for {3}{G}{G}.',
    },
    date: '2026-07',
    method: 'pairs of cards Spellbook itself puts in the same combo shape elsewhere',
    proposed: 44,
    examined: 44,
    kept: 9,
    ruledOut: [
      { reason: 'Trudge Garden needs {2} every cycle, not just a sacrifice — all 187 of its '
        + 'published combos use a mana-producing outlet. (Reading the card corrected why: it '
        + 'triggers on GAINING LIFE, not on a sacrifice, and the mana is the "you may pay {2}" '
        + 'in its own text. The outlet still has to make mana; it does not have to be what '
        + 'triggers it.)', count: 18 },
      { reason: 'supersets of a two-card combo, which Spellbook never publishes', count: 5 },
      { reason: 'the opposite reading of the same card — Scurry Oak and Herd Baloth make no '
        + 'token that can sacrifice itself, so they need the third card', count: 4,
      // Two of the four, which is what the pass wrote down. The other two are not
      // guessed at here: an invented card set would be the same failure as an
      // invented count, and `sets` is documented as a subset for exactly this case.
      sets: [
        ['Scurry Oak', 'Sadistic Glee'],
        ['Herd Baloth', 'Sadistic Glee'],
      ] },
      { reason: 'the loop needs a *token* out of the sacrifice, not just a sacrifice', count: 4 },
      { reason: 'Camellia’s loop eats artifacts, and those outlets take creatures only', count: 2 },
      { reason: 'Chatterfang adds Squirrels equal to the tokens created; he does not double '
        + 'what the loop spends', count: 1 },
      { reason: 'Quina adds one Frog however many tokens were made — she is not a doubler', count: 1 },
    ],
    notes: 'The pass the README’s "nothing remains open" was written under. True of these '
      + '44; it read as a claim about the database, which is what later had to be corrected. '
      + 'Its three unread cards were fetched on 2026-08-03. Quina and Cauldron Familiar came '
      + 'back exactly as the rule-outs assumed — Quina adds *a* Frog, singular, and the Cat '
      + 'returns for a Food. Trudge Garden did not: the pass had it wanting mana *out of the '
      + 'sacrifice*, and it has no sacrifice clause at all. The count survives because the '
      + 'requirement it stands on is real, but the sentence was describing a card nobody had '
      + 'opened, which is the third time this file has caught that and the first where the '
      + 'conclusion happened to hold.',
  },
  {
    subject: 'The lifegain loops of one deck',
    cards: [
      'Heroic Feast', 'Archangel of Thune', 'Heliod, Sun-Crowned', 'Kitchen Finks',
      'Scurry Oak', 'Herd Baloth', 'Basking Broodscale', 'Animation Module',
    ],
    cardIds: [7743, 2919, 1274, 2086, 4186, 3197, 5641, 3490],
    read: {
      'Heroic Feast': 'When this enchantment enters, create a Food token. Whenever you GAIN LIFE, choose up to THAT MANY target creatures you control. Put a +1/+1 counter on each of them. Enchantment for {2}{G}.',
      'Archangel of Thune': 'Flying. Lifelink. Whenever you GAIN LIFE, put a +1/+1 counter on EACH creature you control. 3/4 for {3}{W}{W}.',
      'Heliod, Sun-Crowned': 'Indestructible. As long as your devotion to white is less than five, Heliod isn’t a creature. Whenever you GAIN LIFE, put a +1/+1 counter on TARGET creature or enchantment you control. {1}{W}: Another target creature gains lifelink until end of turn. Legendary Enchantment Creature — God 5/5 for {2}{W}.',
      'Kitchen Finks': 'When Kitchen Finks enters, you GAIN 2 LIFE. Persist. Creature — Ouphe 3/2 for {1}{G/W}{G/W}.',
      'Scurry Oak': 'Evolve. Whenever one or more +1/+1 counters are put on this creature, you may create a 1/1 GREEN Squirrel creature token. 1/2 for {2}{G}.',
      'Herd Baloth': 'Whenever one or more +1/+1 counters are put on this creature, you may create a 4/4 GREEN Beast creature token. 4/4 for {3}{G}{G}.',
      'Basking Broodscale': 'Devoid. {1}{G}: Adapt 1. Whenever one or more +1/+1 counters are put on this creature, you may create a 0/1 COLORLESS Eldrazi Spawn creature token with \u201cSacrifice this token: Add {C}.\u201d 2/2 for {1}{G}.',
      'Animation Module': 'Whenever one or more +1/+1 counters are put on a PERMANENT you control, you may PAY {1}. If you do, create a 1/1 colorless Servo artifact creature token. {3}, {T}: Choose a counter on target permanent or player. Give that permanent or player another counter of that kind. Artifact for {1}.',
    },
    date: '2026-07',
    method: 'the same method, pointed at the lifegain-to-counter engines a single deck could build',
    proposed: 51,
    examined: 51,
    kept: 36,
    ruledOut: [
      { reason: 'the fifteen written up under *The lifegain families* — mostly a gainer that '
        + 'triggers on the wrong half of the loop', count: 15 },
    ],
    notes: 'The pass that shows the method does not change, only which loops it is asked about.',
  },
  {
    subject: 'Rosie Cotton of South Lane',
    cards: ['Rosie Cotton of South Lane'],
    cardIds: [2433],
    read: {
      'Rosie Cotton of South Lane': 'When Rosie Cotton enters, create a Food token. Whenever you create a token, put a +1/+1 counter on target creature you control other than Rosie Cotton.',
    },
    date: '2026-08-02',
    method: 'every shape where two or more of her token-creation peers are published and she is not',
    proposed: 91,
    examined: 25,
    kept: 20,
    ruledOut: [
      { reason: 'persist and undying loops — a creature returning from the graveyard is a '
        + 'creature entering but it is not a token, so she never triggers', count: 35 },
      { reason: 'subsumed: she already has a smaller combo inside the same card set', count: 31 },
      { reason: 'already published with her', count: 5 },
    ],
    notes: 'She was absent from every loop where the token arrives off a -1/-1 counter, while '
      + 'four peers were published in all nine. The nine cite Mighty Mutanimals rather than the '
      + 'more popular Cathars’ Crusade because Mutanimals puts one counter on one target '
      + 'creature, which is her sentence; Cathars’ Crusade counters the board.',
  },
  {
    subject: 'Necrosynthesis against Sadistic Glee',
    cards: ['Necrosynthesis', 'Sadistic Glee'],
    cardIds: [1628, 2082],
    read: {
      'Necrosynthesis': 'Enchant creature. Enchanted creature has \\u201cWhenever another creature dies, put a +1/+1 counter on this creature.\\u201d When enchanted creature dies, look at the top X cards of your library, where X is its power. Put one of them into your hand and the rest on the bottom of your library in a random order.',
      'Sadistic Glee': 'Enchant creature. Whenever A creature dies, put a +1/+1 counter on enchanted creature. Enchantment — Aura for {B}.',
    },
    date: '2026-08-02',
    method: 'every published Sadistic Glee combo with no Necrosynthesis twin',
    proposed: 30,
    examined: 24,
    kept: 24,
    ruledOut: [
      { reason: 'already hand-written — the six rows the first sweep kept', count: 6 },
    ],
    notes: 'Necrosynthesis wants "another creature" to die where Glee will take any, so each '
      + 'was read against the one case that breaks — the enchanted creature being the one '
      + 'sacrificed. In all 24 the thing dying is the token.',
  },
  {
    subject: 'Chatterfang, Squirrel General',
    cards: ['Chatterfang, Squirrel General', 'Stridehangar Automaton'],
    cardIds: [3000, 6291],
    read: {
      'Chatterfang, Squirrel General': 'Forestwalk. If one or more tokens would be created under your control, those tokens plus that many 1/1 green Squirrel creature tokens are created instead. {B}, Sacrifice X Squirrels: Target creature gets +X/-X until end of turn.',
      'Stridehangar Automaton': 'Thopters you control get +1/+1. If one or more artifact tokens would be created under your control, those tokens plus an additional 1/1 colorless Thopter artifact creature token with flying are created instead.',
      'Krark-Clan Ironworks': 'Sacrifice an artifact: Add {C}{C}.',
      'Arcbound Ravager': 'Sacrifice an ARTIFACT: Put a +1/+1 counter on Arcbound Ravager. Modular 1. Artifact Creature — Beast 0/0 for {2}.',
      'Pitiless Plunderer': '{3}{B} Creature — Human Pirate 1/4. Whenever another creature you control dies, create a Treasure token. NOT a sacrifice outlet.',
      'Clock of Omens': 'Tap two untapped ARTIFACTS you control: Untap target ARTIFACT. Artifact for {4}.',
    },
    date: '2026-08-02',
    method: 'the three cards that hand a creature back inside a token creation, compared against each other',
    proposed: 1202,
    examined: 39,
    kept: 5,
    ruledOut: [
      { reason: 'Stridehangar Automaton reads only *artifact* tokens and adds a Thopter, so its '
        + 'Clock of Omens, Krark-Clan Ironworks and Arcbound Ravager families turn on the added '
        + 'token being an artifact — and a Squirrel is not one' },
      { reason: 'subsumed by Chatterfang + Pitiless Plunderer, a published two-card combo, which '
        + 'makes every "Pitiless Plunderer and an outlet" shape a strict superset' },
      { reason: 'the peer and Chatterfang already appear in the same published combo, so the '
        + 'swap would name him twice', count: 3 },
    ],
    notes: 'What a well-covered card looks like: 1,202 proposed, 1,197 dead on the card text, '
      + 'five kept. Worth keeping beside Rosie, who was not well covered, so the next reader '
      + 'knows both outcomes are normal.',
  },
  {
    subject: 'Academy Manufactor against Peregrin Took',
    cards: ['Academy Manufactor', 'Peregrin Took', 'Chalk Outline', 'Kheru Goldkeeper'],
    cardIds: [4231, 4321, 5632, 6462],
    // Read from Forge's card scripts, which tools/lookup-card.js now falls back to
    // when Scryfall is refused by the network policy — and cross-checked against
    // XMage for the two the whole pass turns on, Peregrin Took and Academy
    // Manufactor. The peers below are not in `cards` because the pass did not sweep
    // them; they are here because it reasoned about them, which is the half that
    // went wrong the last time somebody worked from memory.
    read: {
      'Academy Manufactor': 'If you would create a Clue, Food, or Treasure token, instead create one of each. Artifact Creature — Assembly-Worker 1/3 for {3}.',
      'Peregrin Took': 'If one or more tokens would be created under your control, those tokens plus an additional Food token are created instead. Sacrifice three Foods: Draw a card. Legendary Creature — Halfling Citizen 2/3 for {2}{G}.',
      'Chalk Outline': 'Whenever one or more creature cards leave your graveyard, create a 2/2 white and blue Detective creature token, then investigate. (Create a Clue token.) Enchantment for {3}{G}.',
      'Kheru Goldkeeper': 'Flying. Whenever one or more cards leave your graveyard DURING YOUR TURN, create a Treasure token. Renew — {2}{B}{G}{U}, Exile this card from your graveyard: Put two +1/+1 counters and a flying counter on target creature. Creature — Dragon 3/3 for {1}{B}{G}{U}.',
      // The peers the rule-outs turn on.
      'Samwise Gamgee': 'Whenever another NONTOKEN creature you control enters, create a Food token. Sacrifice three Foods: Return target historic card from your graveyard to your hand. Legendary Creature — Halfling Citizen 2/2 for {G}{W}.',
      'Nuka-Cola Vending Machine': '{1}, {T}: Create a Food token. Whenever you sacrifice a Food, create a tapped Treasure token. Artifact for {3}.',
      'Experimental Confectioner': 'When Experimental Confectioner enters, create a Food token. Whenever you sacrifice a Food, create a 1/1 black Rat creature token with "This creature can’t block." Creature — Human Peasant 2/3 for {2}{B}.',
      'Lonis, Genetics Expert': 'Evolve. Whenever one or more +1/+1 counters are put on Lonis, investigate that many times. Whenever you sacrifice a Clue, put a +1/+1 counter on another target creature you control. Legendary Creature — Snake Elf Detective 1/2.',
      'Ant Queen': '{1}{G}: Create a 1/1 green Insect creature token. Creature — Insect 5/5 for {3}{G}{G}.',
      'Camellia, the Seedmiser': 'Menace. Other Squirrels you control have menace. Whenever you sacrifice one or more Foods, create a 1/1 green Squirrel creature token. {2}, Forage: Put a +1/+1 counter on each other Squirrel you control.',
      'Stridehangar Automaton': 'Thopters you control get +1/+1. If one or more ARTIFACT tokens would be created under your control, those tokens plus an additional 1/1 colorless Thopter artifact creature token with flying are created instead. Artifact Creature — Construct 1/4 for {3}.',
      'Warren Soultrader': 'Pay 1 life, Sacrifice another creature: Create a Treasure token. Creature — Zombie Goblin Wizard 3/3 for {2}{B}.',
      'Urza, Prince of Kroog': 'Artifact creatures you control get +2/+2. {6}: Create a token that’s a copy of target artifact you control, except it’s a 1/1 Soldier creature in addition to its other types. Legendary Creature — Human Artificer 2/3.',
      'Magic Pot': 'When this creature dies, create a Treasure token. {2}, {T}: Exile target card from a graveyard. Artifact Creature — Goblin Construct 1/4 for {3}.',
      'Krark-Clan Ironworks': 'Sacrifice an artifact: Add {C}{C}. Artifact for {4}.',
      'Bootleggers’ Stash': 'Lands you control have "{T}: Create a Treasure token." Artifact for {5}{G}.',
      'Clock of Omens': 'Tap two untapped artifacts you control: Untap target artifact. Artifact for {4}.',
      'Toph, the First Metalbender': 'Nontoken artifacts you control are lands in addition to their other types. (They don’t gain the ability to {T} for mana.) At the beginning of your end step, earthbend 2. Legendary Creature — Human Warrior Ally 3/3 for {1}{R}{G}{W}.',
      'Doubling Season': 'If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead. If an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead.',
      'Darksteel Citadel': 'Indestructible. {T}: Add {C}. Artifact Land.',
    },
    date: '2026-08-03',
    method: 'every shape Academy Manufactor’s one substitution peer is published in and she is not',
    proposed: 338,
    examined: 58,
    kept: 32,
    ruledOut: [
      { reason: 'the loop’s token is a Squirrel, a Zombie, a Spirit, a Thopter, a Blood, a Myr — '
        + 'anything that is not a Clue, a Food or a Treasure. Peregrin Took reads *any* token and '
        + 'adds a Food; Academy Manufactor reads three types and is not looking at the rest',
      count: 296 },
      { reason: 'the loop needs two Foods a cycle. Peregrin Took *adds* a Food to a creation where '
        + 'Academy Manufactor only *converts* one — a Samwise Gamgee trigger is two Foods behind '
        + 'him and one behind her', count: 6 },
      { reason: 'the outlet is Peregrin Took’s own second ability, "Sacrifice three Foods: Draw a '
        + 'card", which is not a replacement effect at all and which she has no equivalent of — '
        + 'the Nuka-Cola Vending Machine, Experimental Confectioner and Lonis lines are all this',
      count: 4 },
    ],
    notes: 'Academy Manufactor has exactly one peer in 103,737 combos and it is Peregrin Took, at '
      + 'a jaccard of 0.05 — far under the 0.90 bar tools/substitution-scope.js reports at, which '
      + 'is why no scope run has ever named her. The bar is a ratio and she is in 661 combos; a '
      + 'peer sharing 54 shapes with her can never clear it. Read the pair count, not the score, '
      + 'for a card this widely published. `examined` is the 32 kept plus 26 read one at a time; '
      + 'the other 280 died to a fact about their engine card rather than to a reading.',
  },
  {
    subject: 'The sacrifice outlet slot of the Cauldron Familiar loop',
    cards: [
      'Cauldron Familiar', 'Samwise Gamgee', 'Eloise, Nephalia Sleuth', 'Ulvenwald Mysteries',
      'Pitiless Plunderer', 'Spawning Pit',
    ],
    // Cauldron Familiar's first entry in this file, at the top, says UNREAD. It is
    // read now, and the sentence that matters to every row below is the second one:
    // the return cost is a *Food*, which is why an engine making a Clue or a Treasure
    // needs Academy Manufactor between it and the Cat, and why Peregrin Took does not.
    read: {
      'Cauldron Familiar': 'When Cauldron Familiar enters, each opponent loses 1 life and you gain 1 life. Sacrifice a FOOD: Return Cauldron Familiar from your graveyard to the battlefield. Creature — Cat 1/1 for {B}.',
      'Samwise Gamgee': 'Whenever another NONTOKEN creature you control enters, create a Food token. Sacrifice three Foods: Return target historic card from your graveyard to your hand. Legendary Creature — Halfling Citizen 2/2 for {G}{W}.',
      'Eloise, Nephalia Sleuth': 'Whenever ANOTHER creature you control dies, investigate. Whenever you sacrifice a token, surveil 1. Legendary Creature — Human Rogue 4/4 for {3}{U}{B}.',
      'Ulvenwald Mysteries': 'Whenever a NONTOKEN creature you control dies, investigate. Whenever you sacrifice a Clue, create a 1/1 white Human Soldier creature token. Enchantment for {2}{G}.',
      'Pitiless Plunderer': 'Whenever another creature you control dies, create a Treasure token. Creature — Human Pirate 1/4 for {3}{B}.',
      'Spawning Pit': 'Sacrifice a creature: Put a charge counter on Spawning Pit. {1}, Remove two charge counters from Spawning Pit: Create a 2/2 colorless Spawn artifact creature token. Artifact for {2}.',
      // The outlet slot itself: every card the diff put in it, because "is this a free
      // repeatable outlet that will eat the Cat" is a question about each one's text.
      'Viscera Seer': 'Sacrifice a creature: Scry 1. Creature — Vampire Wizard 1/1 for {B}.',
      'Carrion Feeder': 'This creature can’t block. Sacrifice a creature: Put a +1/+1 counter on this creature. Creature — Zombie 1/1 for {B}.',
      // Corrected 2026-08-03 against card-text.json: this said 'Creature — Human Soldier',
      // which Scryfall contradicts. The ability text and mana were right, so nothing this
      // pass concluded turned on it — but a type line from recollection sitting in the file
      // whose whole job is verbatim text is the Chatterfang mistake happening again.
      'Bartolomé del Presidio': 'Sacrifice another creature or artifact: Put a +1/+1 counter on Bartolomé del Presidio. Legendary Creature — Vampire Knight 2/1 for {W}{B}.',
      'Bloodflow Connoisseur': 'Sacrifice a creature: Put a +1/+1 counter on Bloodflow Connoisseur. Creature — Vampire 1/1 for {2}{B}.',
      'Yahenni, Undying Partisan': 'Haste. Whenever a creature an opponent controls dies, put a +1/+1 counter on Yahenni. Sacrifice another creature: Yahenni gains indestructible until end of turn. Legendary Creature — Aetherborn Vampire 2/2 for {2}{B}.',
      'Woe Strider': 'When Woe Strider enters, create a 0/1 white Goat creature token. Sacrifice another creature: Scry 1. Escape—{3}{B}{B}, Exile four other cards from your graveyard. Creature — Horror 3/2 for {2}{B}.',
      'Blasting Station': '{T}, Sacrifice a creature: Blasting Station deals 1 damage to any target. Whenever a creature enters, you may untap Blasting Station. Artifact for {3}.',
      'Goblin Bombardment': 'Sacrifice a creature: Goblin Bombardment deals 1 damage to any target. Enchantment for {1}{R}.',
      'Altar of Dementia': 'Sacrifice a creature: Target player mills cards equal to the sacrificed creature’s power. Artifact for {2}.',
      'Ashnod’s Altar': 'Sacrifice a creature: Add {C}{C}. Artifact for {3}.',
      'Phyrexian Altar': 'Sacrifice a creature: Add one mana of any color. Artifact for {3}.',
      'Thermopod': '{S}: Thermopod gains haste until end of turn. Sacrifice a creature: Add {R}. Snow Creature — Slug 4/3 for {4}{R}.',
      'Phantom Train': 'Trample. Sacrifice another artifact or creature: Put a +1/+1 counter on this Vehicle. It becomes a Spirit artifact creature in addition to its other types until end of turn. Artifact — Vehicle 4/4 for {3}{B}.',
      'Umbral Collar Zealot': 'Sacrifice another creature or artifact: Surveil 1. Creature — Human Cleric 3/2 for {1}{B}.',
      'Shilgengar, Sire of Famine': 'Flying. Sacrifice another creature: Create a Blood token. If you sacrificed an Angel this way, create a number of Blood tokens equal to its toughness instead. {W/B}{W/B}{W/B}, Sacrifice six Blood tokens: Return each creature card from your graveyard to the battlefield with a finality counter on it. Legendary Creature — Elder Demon 6/6.',
      'Warren Soultrader': 'Pay 1 life, Sacrifice another creature: Create a Treasure token. Creature — Zombie Goblin Wizard 3/3 for {2}{B}.',
    },
    cardIds: [856, 5270, 1808, 5267, 4871, 3899],
    date: '2026-08-03',
    method: 'the outlet slot Spellbook fills by name, compared across the engines that fill the same shape',
    proposed: 16,
    examined: 16,
    kept: 13,
    ruledOut: [
      { reason: 'Warren Soultrader is an outlet that makes its own Treasure, so Cauldron Familiar '
        + '+ Warren Soultrader + Academy Manufactor is a published *three*-card combo and every '
        + 'four-card row naming him is a strict superset of it', count: 3 },
    ],
    notes: 'Neither Cauldron Familiar nor Samwise Gamgee has a substitution peer at all — no card '
      + 'shares three combo shapes with either of them — so the method the rest of this file runs '
      + 'on proposes nothing for them, and the hole had to be found from the other side. Spellbook '
      + 'enumerates the free-sacrifice slot of the Cat loop engine by engine: sixteen outlets '
      + 'behind Peregrin Took, sixteen behind Samwise Gamgee but not the same sixteen, fifteen '
      + 'behind Eloise, Nephalia Sleuth, fifteen behind Pitiless Plunderer and six behind '
      + 'Ulvenwald Mysteries. Diffing the lists is what the pass is.',
  },
  {
    subject: 'Ashnod’s Altar',
    cards: ["Ashnod's Altar"],
    read: {
      "Ashnod's Altar": 'Sacrifice a creature: Add {C}{C}.',
      'Phyrexian Altar': 'Sacrifice a creature: Add one mana of any color.',
      'Gravecrawler': '{B} Creature — Zombie 2/1. Gravecrawler cannot block. You may cast Gravecrawler from your graveyard as long as you control a Zombie.',
      'Reassembling Skeleton': '{1}{B} Creature — Skeleton Warrior 1/1. {1}{B}: Return Reassembling Skeleton from your graveyard to the battlefield tapped.',
      'Forsaken Miner': 'Forsaken Miner cannot block. Whenever you commit a crime, you may pay {B}. If you do, return Forsaken Miner from your graveyard to the battlefield.',
      'Nether Traitor': 'Haste. Shadow. Whenever another creature is put into your graveyard from the battlefield, you may pay {B}. If you do, return Nether Traitor from your graveyard to the battlefield.',
      'Krark-Clan Ironworks': 'Sacrifice an artifact: Add {C}{C}.',
      'Scrap Trawler': 'Whenever Scrap Trawler or another ARTIFACT you control is put into a graveyard from the battlefield, return to your hand target ARTIFACT card in your graveyard with lesser mana value. Artifact Creature — Construct 3/2 for {3}.',
      'Nuka-Cola Vending Machine': '{3} Artifact. {1}, {T}: Create a Food token. Whenever you sacrifice a Food, create a tapped Treasure token.',
      'Pitiless Plunderer': '{3}{B} Creature — Human Pirate 1/4. Whenever another creature you control dies, create a Treasure token. NOT a sacrifice outlet.',
      'Goblin Bombardment': '{1}{R} Enchantment. Sacrifice a creature: This enchantment deals 1 damage to any target.',
      'Polyraptor': 'Green creature. Enrage — Whenever Polyraptor is dealt damage, create a token that is a copy of Polyraptor.',
      'Broodhatch Nantuko': '{1}{G} Creature — Insect Druid 1/1. Whenever this creature is dealt damage, you may create that many 1/1 green Insect creature tokens. Morph {2}{G}.',
      'Altar of Dementia': '{2} Artifact. Sacrifice a creature: Target player mills cards equal to the sacrificed creature power.',
    },
    cardIds: [2034],
    date: '2026-08-02',
    method: 'every shape a scored peer is published in and it is not, split by what the peer actually is',
    proposed: 3316,
    examined: 28,
    kept: 0,
    ruledOut: [
      { reason: 'the loop recasts a coloured card and Ashnod’s Altar makes {C}{C}. Phyrexian '
        + 'Altar makes one mana of any colour, which is the whole of the difference — '
        + 'Gravecrawler, Reassembling Skeleton, Forsaken Miner and Nether Traitor all need {B} '
        + 'to come back. This is the same distinction the README already draws in the other '
        + 'direction, where Ashnod’s two mana carry a loop Phyrexian’s one cannot' },
      { reason: 'Krark-Clan Ironworks eats *artifacts* and Ashnod’s Altar eats creatures, so the '
        + 'Scrap Trawler and Nuka-Cola Vending Machine families have nothing for it to sacrifice' },
      { reason: 'Pitiless Plunderer is not a sacrifice outlet at all — it makes a Treasure when '
        + 'a creature dies. It scores as a peer because the two co-occur constantly, which is '
        + 'exactly what a score cannot tell you' },
      { reason: 'the peer’s rider is load-bearing rather than incidental: Goblin Bombardment’s '
        + 'damage is what Polyraptor and Broodhatch Nantuko enrage off, and Altar of Dementia’s '
        + 'mill is the win condition, not a side effect. Ashnod’s Altar deals no damage and mills '
        + 'nothing' },
    ],
    notes: '**kept: 0 IS SETTLED.** All twelve rule-out cards are read; Scrap Trawler was the '
      + 'last and it closes the family it was named for — "whenever Scrap Trawler or another '
      + 'ARTIFACT you control is put into a graveyard", returning an ARTIFACT card, where '
      + 'Ashnod’s Altar sacrifices a creature. Nothing in that loop is a creature for the Altar '
      + 'to eat, exactly as the rule-out assumed. The rest were already end to end: the colour '
      + 'argument holds for all four recursion pieces — Gravecrawler must be CAST for {B}, and '
      + 'Reassembling Skeleton, Forsaken Miner and Nether Traitor each pay {B} to return, none '
      + 'of which {C}{C} can do; Goblin Bombardment deals damage and both Polyraptor and '
      + 'Broodhatch Nantuko enrage off damage; Altar of Dementia mills; Pitiless Plunderer is '
      + 'not a sacrifice outlet at all. So this zero is a well-covered card rather than an '
      + 'unfinished pass — the distinction the Basking Broodscale entry below turned out to be '
      + 'on the wrong side of. The largest card in the deck by combo count, 6,063, and it kept '
      + 'nothing. Its top scored peers are four different kinds of card and only the free '
      + 'outlets are substitutable at all, which is the clearest case yet for taking peers off '
      + 'the card text.',
  },
  {
    subject: 'Camellia, the Seedmiser',
    cards: ['Camellia, the Seedmiser', 'Experimental Confectioner'],
    cardIds: [5777, 2590],
    read: {
      'Camellia, the Seedmiser': 'Menace. Other Squirrels you control have menace. Whenever you sacrifice one or more Foods, create a 1/1 green Squirrel creature token. {2}, Forage: Put a +1/+1 counter on each other Squirrel you control.',
      'Experimental Confectioner': 'When this creature enters, create a Food token. Whenever you sacrifice a Food, create a 1/1 black Rat creature token with \\u201cThis token can\\u2019t block.\\u201d',
      'Peregrin Took': '{2}{G} Legendary Creature — Halfling Citizen 2/3. If one or more tokens would be created under your control, those tokens plus an additional Food token are created instead. Sacrifice three Foods: Draw a card.',
      'Savvy Hunter': 'Whenever Savvy Hunter attacks or blocks, create a Food token. Sacrifice TWO Foods: Draw a card. Creature — Human Warrior 3/3 for {1}{B}{G}.',
      // The two shapes the 35 survivors are in, read when the rows were finally
      // written. Both spend exactly one Food a cycle, which is the whole question.
      'Ygra, Eater of All': 'Ward—Sacrifice a Food. OTHER CREATURES ARE FOOD ARTIFACTS in addition to their other types and have “{2}, {T}, Sacrifice this permanent: You gain 3 life.” Whenever a Food is put into a graveyard from the battlefield, put two +1/+1 counters on Ygra. Legendary Creature — Elemental Cat 6/6 for {3}{B}{G}.',
      'Ninja Pizza': 'FOODS YOU CONTROL HAVE “{T}, Sacrifice this artifact: Add one mana of any color.” At the beginning of your second main phase, create a Food token. Enchantment for {2}{G}.',
      'Sam, Loyal Attendant': 'Partner with Frodo, Adventurous Hobbit. At the beginning of combat on your turn, create a Food token. ACTIVATED ABILITIES OF FOODS you control COST {1} LESS to activate. Legendary Creature — Halfling Peasant 2/4 for {1}{G}{W}.',
      'Warren Soultrader': 'Pay 1 life, Sacrifice another creature: Create a Treasure token. Creature — Zombie Goblin Wizard 3/3 for {2}{B}.',
      'Academy Manufactor': 'If you would create a Clue, Food, or Treasure token, instead create one of each. Artifact Creature — Assembly-Worker 1/3 for {3}.',
    },
    date: '2026-08-03',
    method: 'her one scored peer, Experimental Confectioner, and every shape it has that she lacks',
    proposed: 37,
    examined: 37,
    kept: 35,
    ruledOut: [
      { reason: 'the loop spends more than one Food per cycle and needs that many creatures back. '
        + 'Camellia reads "whenever you sacrifice ONE OR MORE Foods" — one trigger per event, one '
        + 'Squirrel however many were spent — where Confectioner reads "whenever you sacrifice A '
        + 'Food" and triggers per Food. Peregrin Took spends three and Savvy Hunter spends two; '
        + 'both published step lists say so, and one Squirrel does not sustain either', count: 2,
      // Both of the two, so this one happens to be complete — which changes nothing
      // about how ruledOutSets() may be read. Completeness is not modelled, because
      // a consumer able to see it would start treating absence as an answer.
      sets: [
        ['Camellia, the Seedmiser', 'Peregrin Took'],
        ['Camellia, the Seedmiser', 'Ygra, Eater of All', 'Savvy Hunter'],
      ] },
    ],
    notes: 'THE FIRST VERSION OF THIS ENTRY WAS WRONG, and the way it was wrong is the reason the '
      + 'log records reasons rather than verdicts. It said the two cards answer "a nontoken '
      + 'creature died" with different tokens — Food against Squirrel — and ruled out all 37 on '
      + 'that. Neither half was true: both trigger on *sacrificing a Food*, and Confectioner '
      + 'creates a Rat, not a Food. The text was asserted from memory instead of read, which is '
      + 'exactly the step the process says not to skip. Read properly, the difference is batching '
      + 'and only 2 of the 37 die to it. The 35 survivors then sat here for a day with kept: 0 '
      + 'beside them and a note saying they had survived — a second way for a pass to be wrong, '
      + 'and a quieter one, because the number said "found nothing" while the prose said the '
      + 'opposite. **All 35 are rows now.** Two shapes: Ygra, Eater of All + Ninja Pizza behind '
      + '34 haste enablers, and Sam, Loyal Attendant + Warren Soultrader + Academy Manufactor '
      + '(pop 1,278). The published step lists for both spend exactly one Food a cycle, which is '
      + 'the only thing the swap turns on. They are written as 35 rows rather than as a STAND_INS '
      + 'rule on purpose: a stand-in rule is unconditional, and Peregrin Took and Savvy Hunter '
      + 'are two published shapes where this swap fails — so the two rule-outs this pass found '
      + 'are themselves the argument against expressing it as a rule.',
  },
  {
    subject: 'Experimental Confectioner',
    cards: ['Experimental Confectioner', 'Camellia, the Seedmiser'],
    cardIds: [2590, 5777],
    read: {
      'Experimental Confectioner': '{2}{B} Creature — Human Peasant 2/3. When this creature '
        + 'enters, create a Food token. Whenever you sacrifice a Food, create a 1/1 black Rat '
        + 'creature token with “This token can’t block.”',
      'Camellia, the Seedmiser': 'Menace. Other Squirrels you control have menace. Whenever you '
        + 'sacrifice one or more Foods, create a 1/1 green Squirrel creature token. {2}, Forage: '
        + 'Put a +1/+1 counter on each other Squirrel you control.',
      'Ygra, Eater of All': '{3}{B}{G} Legendary Creature — Elemental Cat 6/6. Ward—Sacrifice a '
        + 'Food. Other creatures are Food artifacts in addition to their other types and have '
        + '“{2}, {T}, Sacrifice this permanent: You gain 3 life.” Whenever a Food is put into a '
        + 'graveyard from the battlefield, put two +1/+1 counters on Ygra.',
      'Wicked Wolf': 'When this creature enters, it fights up to one target creature you don’t '
        + 'control. Sacrifice a Food: Put a +1/+1 counter on this creature. It gains '
        + 'indestructible until end of turn. Tap it.',
      'Mushroom Watchdogs': 'Sacrifice a Food: Put a +1/+1 counter on this creature. It gains '
        + 'vigilance until end of turn. Activate only as a sorcery.',
      'Bill the Pony': '{3}{W} Legendary Creature — Horse 1/4. When Bill the Pony enters, create '
        + 'two Food tokens. Sacrifice a Food: Until end of turn, target creature you control '
        + 'assigns combat damage equal to its toughness rather than its power.',
      'Glimmer Bairn': 'Sacrifice a token: This creature gets +2/+2 until end of turn.',
    },
    date: '2026-08-02',
    method: 'the reverse of the Camellia pass — every shape she is published in and he is not',
    proposed: 4,
    examined: 4,
    kept: 4,
    ruledOut: [],
    notes: 'The other direction, and the asymmetry is real: he triggers per Food where she '
      + 'triggers per sacrifice event, so he is the strictly larger effect and closes anything '
      + 'she closes. All four survived reading and are rows. The loop is the same in each — Ygra '
      + 'makes every other creature a Food, the outlet eats one for free, the Confectioner '
      + 'answers with a Rat, and the Rat is itself a Food to eat next. Glimmer Bairn is the one '
      + 'worth a second look: it sacrifices a *token* rather than a Food, and only works here '
      + 'because Ygra makes the Rat token a Food as well, which is what the Confectioner reads. '
      + 'Logged first as proposed-but-undecided, then finished once the five card texts were '
      + 'actually fetched — which is the shape this file is meant to make normal.'
  },
  {
    subject: 'Cauldron Familiar, Samwise Gamgee and Academy Manufactor',
    cards: ['Cauldron Familiar', 'Samwise Gamgee', 'Academy Manufactor'],
    cardIds: [856, 5270, 4231],
    read: {
      'Cauldron Familiar': 'When Cauldron Familiar enters, each opponent loses 1 life and you gain 1 life. Sacrifice a FOOD: Return Cauldron Familiar from your graveyard to the battlefield. Creature — Cat 1/1 for {B}.',
      'Samwise Gamgee': 'Whenever another NONTOKEN creature you control enters, create a Food token. Sacrifice three Foods: Return target historic card from your graveyard to your hand. Legendary Creature — Halfling Citizen 2/2 for {G}{W}.',
      'Academy Manufactor': 'If you would create a Clue, Food, or Treasure token, instead create one of each. Artifact Creature — Assembly-Worker 1/3 for {3}.',
    },
    date: '2026-08-02',
    method: 'the same peer search, which returned nothing at any threshold down to 0.12',
    proposed: 0,
    examined: 0,
    kept: 0,
    ruledOut: [
      { reason: 'no card shares enough combo shapes with any of the three for the substitution '
        + 'method to propose a single candidate. That is the method being silent, not the cards '
        + 'being covered — and the distinction matters, because a gap in one of these could only '
        + 'ever surface by somebody reading the card' },
    ],
    notes: 'Logged precisely because it found nothing. Without the entry the next person spends '
      + 'the same afternoon discovering the same silence, which is the cost this file exists to '
      + 'stop paying twice. Academy Manufactor sits in 661 combos and Cauldron Familiar in 624, '
      + 'so this is not obscurity — they simply have no near-twin.',
  },
  {
    subject: 'Basking Broodscale and Spike Feeder',
    cards: ['Basking Broodscale', 'Spike Feeder'],
    cardIds: [5641, 2290],
    read: {
      'Basking Broodscale': 'Devoid. {1}{G}: Adapt 1. Whenever one or more +1/+1 counters are put on this creature, you may create a 0/1 COLORLESS Eldrazi Spawn creature token with “Sacrifice this token: Add {C}.” 2/2 for {1}{G}.',
      'Spike Feeder': 'Enters with two +1/+1 counters on it. {2}, Remove a +1/+1 counter from this creature: Put a +1/+1 counter on target creature. Remove a +1/+1 counter from this creature: You gain 2 life. 0/0 for {1}{G}{G}.',
      'Scurry Oak': 'Evolve. Whenever one or more +1/+1 counters are put on this creature, you may create a 1/1 GREEN Squirrel creature token. 1/2 for {2}{G}.',
      'Herd Baloth': 'Whenever one or more +1/+1 counters are put on this creature, you may create a 4/4 GREEN Beast creature token. 4/4 for {3}{G}{G}.',
      'Ivy Lane Denizen': 'Whenever another GREEN creature you control enters, put a +1/+1 counter on target creature. 2/3 for {3}{G}.',
      // The engines the 148 are actually decided on. One fact about each kills its
      // whole family, which is why `examined` is 148 and the reading was nowhere
      // near 148 separate judgements.
      'Yawgmoth, Thran Physician': 'Protection from Humans. Pay 1 life, Sacrifice another creature: Put a -1/-1 COUNTER on up to one target creature and draw a card. {B}{B}, Discard a card: Proliferate. Legendary Creature — Human Cleric 2/4 for {2}{B}{B}.',
      'Treebeard, Gracious Host': 'Trample, ward {2}. When Treebeard enters, create two Food tokens. Whenever you gain life, put that many +1/+1 counters on TARGET HALFLING OR TREEFOLK. Legendary Creature — Treefolk 0/5 for {2}{G}{W}.',
      'Railway Brawler': 'Reach, trample. Whenever another creature you control enters, put X +1/+1 counters on it, where X IS ITS POWER. Plot {3}{G}. Creature — Rhino Warrior 5/5 for {3}{G}{G}.',
      'Sword of the Meek': 'Equipped creature gets +1/+2. Equip {2}. Whenever A 1/1 CREATURE you control enters, you may return Sword of the Meek from your graveyard to the battlefield, then attach it to that creature. Artifact — Equipment for {2}.',
      'Reyhan, Last of the Abzan': 'Reyhan enters with three +1/+1 counters on it. Whenever a creature you control dies or is put into the command zone, IF IT HAD ONE OR MORE +1/+1 COUNTERS on it, you may put that many +1/+1 counters on target creature. Partner. Legendary Creature — Human Warrior 0/0 for {1}{B}{G}.',
      'Death’s Presence': 'Whenever a creature you control dies, put X +1/+1 counters on target creature you control, where X IS THE POWER of the creature that died. Enchantment for {5}{G}.',
      'Warstorm Surge': 'Whenever a creature you control enters, it deals damage equal to ITS POWER to any target. Enchantment for {5}{R}.',
      'Altar of Dementia': 'Sacrifice a creature: Target player mills cards equal to the sacrificed creature’s POWER. Artifact for {2}.',
      'Sylvan Anthem': 'GREEN creatures you control get +1/+1. Whenever a GREEN creature you control enters, scry 1. Enchantment for {G}{G}.',
      'Ravenous Baloth': 'Sacrifice a BEAST: You gain 4 life. Creature — Beast 4/4 for {2}{G}{G}.',
      'Divine Visitation': 'If one or more creature tokens would be created under your control, that many 4/4 white Angel creature tokens with flying and vigilance are created instead. Enchantment for {3}{W}{W}.',
      'Season of Growth': 'Whenever A CREATURE you control enters, scry 1. Whenever you cast a spell that targets a creature you control, draw a card. Enchantment for {1}{G}.',
      'Arbaaz Mir': 'Whenever Arbaaz Mir or another NONTOKEN historic permanent you control enters, Arbaaz Mir deals 1 damage to each opponent and you gain 1 life. Legendary Creature — Human Assassin 2/2 for {R}{W}. (Forge and XMage agree on "nontoken"; Spellbook’s own step list for 549-2919-4186-6890 has a TOKEN triggering him, which is why the two rows behind him are held back rather than written.)',
    },
    date: '2026-08-03',
    method: 'shapes the two counter-to-token peers are published in and Broodscale is not; the same search for Spike Feeder returned no peer at all',
    proposed: 148,
    examined: 148,
    kept: 38,
    ruledOut: [
      { reason: 'the Eldrazi Spawn is 0/1 where the Squirrel is 1/1, and these loops read the '
        + 'token’s stats. Railway Brawler puts on X counters "where X is its power" and Reyhan '
        + 'only moves them "if it had one or more"; Death’s Presence, Warstorm Surge, Terror of '
        + 'the Peaks and Pandemonium all scale off power; Altar of Dementia mills by power; and '
        + 'Sword of the Meek returns only for "a 1/1 creature". Zero power, zero of everything',
      count: 38 },
      { reason: 'Scurry Oak has EVOLVE and Broodscale does not, so a loop whose only source of '
        + '+1/+1 counters is the Oak noticing a bigger creature has nothing to give Broodscale. '
        + 'Yawgmoth is the whole of this family: he puts on -1/-1 counters, so the published '
        + 'steps put the +1/+1 counter on with evolve and nothing else. Coat of Arms (pop 3,912) '
        + 'and Giada + Divine Visitation are the same shape', count: 38 },
      { reason: 'Treebeard, Gracious Host puts its counters on "target Halfling or Treefolk". '
        + 'Scurry Oak is a Treefolk; Basking Broodscale is an Eldrazi Lizard, and neither '
        + 'Peregrin Took nor Sam, Loyal Attendant being Halflings helps — a counter on them does '
        + 'not trigger the engine', count: 27 },
      { reason: 'the Eldrazi Spawn is COLOURLESS where the Squirrel and the Beast are green. '
        + 'Ivy Lane Denizen reads "whenever another GREEN creature you control enters" and '
        + 'Sylvan Anthem scries only on a GREEN creature entering, so neither ever sees the '
        + 'Spawn — and Scurry Oak + Ivy Lane Denizen is the biggest candidate here at pop 28,108',
      count: 3 },
      { reason: 'Ravenous Baloth reads "Sacrifice a BEAST", which is Herd Baloth’s own token and '
        + 'not an Eldrazi Spawn. The only two candidates where the lifegain comes from eating '
        + 'the token by type rather than by its being a creature at all', count: 2 },
      { reason: 'held back rather than ruled out: the two Arbaaz Mir shapes. He reads "another '
        + 'NONTOKEN historic permanent" in both Forge and XMage, and Spellbook’s published step '
        + 'list has a token triggering him. Broodscale and Scurry Oak both make tokens, so the '
        + 'swap is sound whichever way that resolves — but the loop cannot be traced, and a row '
        + 'this file cannot trace is not a row it writes', count: 2 },
    ],
    notes: 'THIS PASS SAT AT kept: 0 AND THE ZERO WAS WRONG. It had read 12 of 148 and said so '
      + 'honestly — "kept: 0 is provisional on the 136 nobody read" — and reading the other 136 '
      + 'found 38 rows. Worth keeping beside the Chatterfang entry, where 1,202 proposed and '
      + 'five kept was a genuinely well-covered card: the two look identical from the outside, '
      + 'and only the examined count tells them apart. A provisional zero is the most dangerous '
      + 'entry this file can hold, because "found nothing" reads as diligence and nobody audits '
      + 'it. What made the difference was reading the engines rather than the candidates: 108 '
      + 'of the 136 died to five facts, and the biggest family of all — Yawgmoth’s 36 — died to '
      + 'a word in the PUBLISHED STEPS, "Scurry Oak’s evolve ability triggers", which is the '
      + 'peer doing something Broodscale cannot. Spike Feeder is untouched by any of this: 83 '
      + 'published combos and NO peer at any threshold, the fourth card in this deck the method '
      + 'is simply silent about.',
  },
  {
    subject: 'Bogwater Lumaret and Elas il-Kor, Sadistic Pilgrim',
    cards: ['Bogwater Lumaret', 'Elas il-Kor, Sadistic Pilgrim'],
    cardIds: [7399, 2811],
    read: {
      'Bogwater Lumaret': 'Creature — Spirit Frog 2/2 for {B}{G}. Whenever this creature or another creature you control enters, you gain 1 life.',
      'Elas il-Kor, Sadistic Pilgrim': 'Legendary Creature — Phyrexian Kor Cleric 2/2 for {W}{B}. Deathtouch. Whenever another creature you control enters, you gain 1 life. Whenever another creature you control dies, each opponent loses 1 life.',
      // The nine cards Spellbook puts in this slot. Which of them carries a shape is
      // the whole of the pass, so all nine are here rather than only the two subjects.
      'Kor Celebrant': 'Creature — Kor Cleric 1/4 for {2}{W}. Whenever this creature or another creature you control enters, you gain 1 life.',
      'Impassioned Orator': 'Creature — Human Cleric 2/2 for {1}{W}. Whenever another creature you control enters, you gain 1 life.',
      'Hinterland Sanctifier': 'Creature — Rabbit Cleric 1/2 for {W}. Whenever another creature you control enters, you gain 1 life.',
      'Social Climber': 'Creature — Human Druid 3/2 for {2}{G}. Alliance — Whenever another creature you control enters, you gain 1 life.',
      'Soul Warden': 'Creature — Human Cleric 1/1 for {W}. Whenever ANOTHER CREATURE enters, you gain 1 life.',
      'Soul’s Attendant': 'Creature — Human Cleric 1/1 for {W}. Whenever ANOTHER CREATURE enters, you may gain 1 life.',
      'Essence Warden': 'Creature — Elf Shaman 1/1 for {G}. Whenever ANOTHER CREATURE enters, you gain 1 life.',
      'Ajani’s Welcome': 'ENCHANTMENT for {W}. Whenever a creature you control enters, you gain 1 life.',
      'Prosperous Innkeeper': 'Creature — Halfling Citizen 1/1 for {1}{G}. WHEN THIS CREATURE ENTERS, CREATE A TREASURE TOKEN. Whenever another creature you control enters, you gain 1 life.',
      'Distinguished Conjurer': 'Creature — Human Wizard 1/2 for {1}{W}. Whenever another creature you control enters, you gain 1 life. {4}{W}, {T}: EXILE ANOTHER TARGET CREATURE YOU CONTROL, THEN RETURN IT to the battlefield under its owner’s control.',
      'Suture Priest': 'Creature — Phyrexian Cleric 1/1 for {1}{W}. Whenever another creature you control enters, you may gain 1 life. WHENEVER A CREATURE AN OPPONENT CONTROLS ENTERS, you may have that player lose 1 life.',
      'Haliya, Guided by Light': 'Legendary Creature — Human Soldier 3/3 for {2}{W}. Whenever Haliya or another creature OR ARTIFACT you control enters, you gain 1 life. At the beginning of your end step, draw a card if you’ve gained 3 or more life this turn. Warp {W}.',
      // The engines behind the shapes only the wide peers carry — read because a
      // wide peer sees an opponent's creature and neither subject does, so "whose
      // creature enters?" is a question about each of these and not about the peer.
      'Darien, King of Kjeldor': 'Legendary Creature — Human Soldier 3/3 for {4}{W}{W}. Whenever you’re dealt damage, you may create that many 1/1 white Soldier creature tokens.',
      'Hapatra, Vizier of Poisons': 'Legendary Creature — Human Cleric 2/2 for {B}{G}. Whenever Hapatra deals combat damage to a player, you may put a -1/-1 counter on target creature. Whenever you put one or more -1/-1 counters on a creature, create a 1/1 green Snake creature token with deathtouch.',
      'Carnival of Souls': 'Enchantment for {1}{B}. Whenever a creature enters, you lose 1 life and add {B}.',
      'Nim Deathmantle': 'Artifact — Equipment for {2}. Equipped creature gets +2/+2, has intimidate, and is a black Zombie. Whenever a NONTOKEN creature is put into your graveyard from the battlefield, you may pay {4}. If you do, return that card to the battlefield and attach this Equipment to it. Equip {4}.',
      'Deadeye Navigator': 'Creature — Spirit 5/5 for {4}{U}{U}. Soulbond. As long as Deadeye Navigator is paired with another creature, each of those creatures has “{1}{U}: Exile this creature, then return it to the battlefield under your control.”',
      'Famished Paladin': 'Creature — Vampire Knight 3/3 for {1}{W}. This creature doesn’t untap during your untap step. Whenever you gain life, untap this creature.',
      'Scurry Oak': 'Evolve. Whenever one or more +1/+1 counters are put on this creature, you may create a 1/1 green Squirrel creature token. Creature — Treefolk 1/2 for {2}{G}.',
      'Heliod, Sun-Crowned': 'Indestructible. As long as your devotion to white is less than five, Heliod isn’t a creature. Whenever you gain life, put a +1/+1 counter on target creature or enchantment you control. {1}{W}: Another target creature gains lifelink until end of turn.',
    },
    date: '2026-08-03',
    method: 'the nine cards Spellbook fills the “creature enters, gain 1 life” slot with, diffed against each other and read one at a time',
    proposed: 268,
    examined: 175,
    // Rows, which is what `kept` counts — the other 99 shapes this pass settled are a
    // STAND_INS rule instead, and a rule is not a row. See the notes.
    kept: 76,
    ruledOut: [
      { reason: 'Prosperous Innkeeper’s ETB Treasure is the loop, not its lifegain trigger. '
        + 'Deadeye Navigator and Emiel the Blessed blink it to re-trigger “when this creature '
        + 'enters, create a Treasure token”, and Nim Deathmantle reanimates it for the same '
        + 'reason — which is also why Nim Deathmantle reads NONTOKEN. Neither subject has an '
        + 'ETB at all', count: 64 },
      { reason: 'Suture Priest’s second half — “whenever a creature AN OPPONENT CONTROLS '
        + 'enters, you may have that player lose 1 life”. Questing Phelddagrif, Phelddagrif and '
        + 'Hive Mind + Storm Herd all hand an opponent creatures, and neither subject sees an '
        + 'opponent’s board on any line of text', count: 18 },
      { reason: 'Distinguished Conjurer’s second ability, “{4}{W}, {T}: Exile another target '
        + 'creature you control, then return it”. Intruder Alarm untaps him to run it again; '
        + 'neither subject has an activated ability', count: 4 },
      { reason: 'Haliya, Guided by Light triggers on “another creature OR ARTIFACT you control” '
        + 'and both of her shapes turn on Sensei’s Divining Top, which is an artifact', count: 4 },
    ],
    notes: 'The clearest stand-in case since Hammerhead: Bogwater Lumaret has ONE ability and it '
      + 'is Kor Celebrant’s, word for word, on a card that is otherwise a 2/2 for {B}{G} instead '
      + 'of a 1/4 for {2}{W} — 60 published combos against Kor Celebrant’s 115 because he is '
      + 'Spellbook card 7399 and nobody has caught up. So 99 of the 175 settled here are a '
      + 'STAND_INS rule rather than rows (61 for Bogwater, 38 for Elas) — which is why `kept` '
      + 'reads 76 and not 175: it counts rows, and a rule is not a row. The four sources are '
      + 'the peers whose whole text '
      + 'is the trigger and which read only creatures YOU control. **The other 76 are rows on '
      + 'purpose, and the reason is the same one the Camellia entry gives.** Soul Warden, '
      + 'Soul’s Attendant and Essence Warden read “whenever ANOTHER creature enters”, an '
      + 'opponent’s included; a rule would claim their every future combo, and the loops that '
      + 'do hand an opponent a creature are exactly the ones Spellbook publishes with Suture '
      + 'Priest instead. Ajani’s Welcome is one line and it is the same line, but it is an '
      + 'enchantment where both subjects are creatures. Those 38 shapes each were read against '
      + 'the published steps: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, '
      + 'Ghave’s Saproling, Fiend Hunter and Karmic Guide — every creature that enters is '
      + 'yours. `examined` counts the kept; the 90 rule-outs died to four card readings, not '
      + 'to 90 judgements, and twelve published step lists decided the rest by family.',
  },
  {
    subject: 'Ghave, Guru of Spores',
    cards: ['Ghave, Guru of Spores'],
    cardIds: [5189],
    read: {
      'Ghave, Guru of Spores': 'Legendary Creature — Fungus Shaman 0/0 for {2}{W}{B}{G}. Ghave enters with five +1/+1 counters on it. {1}, Remove a +1/+1 counter from A CREATURE YOU CONTROL: Create a 1/1 green Saproling creature token. {1}, Sacrifice a creature: Put a +1/+1 counter on target creature.',
      'Ulasht, the Hate Seed': 'Legendary Creature — Hellion Hydra 0/0 for {2}{R}{G}. Ulasht enters with a +1/+1 counter on it for each other red creature you control and a +1/+1 counter on it for each other green creature you control. {1}, Remove a +1/+1 counter from ULASHT: Choose one — • Ulasht deals 1 damage to target creature. • Create a 1/1 green Saproling creature token.',
      'Pentavus': 'ARTIFACT Creature — Construct 0/0 for {7}. This creature enters with five +1/+1 counters on it. {1}, Remove a +1/+1 counter from THIS CREATURE: Create a 1/1 colorless Pentavite ARTIFACT creature token with flying. {1}, Sacrifice A PENTAVITE: Put a +1/+1 counter on this creature.',
      'Thopter Squadron': 'ARTIFACT Creature — Thopter 0/0 for {5}. Flying. This creature enters with three +1/+1 counters on it. {1}, Remove a +1/+1 counter from THIS CREATURE: Create a 1/1 colorless Thopter ARTIFACT creature token with flying. ACTIVATE ONLY AS A SORCERY. {1}, Sacrifice another Thopter: Put a +1/+1 counter on this creature. Activate only as a sorcery.',
      'Triskelavus': 'ARTIFACT Creature — Construct 1/1 for {7}. Flying. This creature enters with three +1/+1 counters on it. {1}, Remove a +1/+1 counter from this creature: Create a 1/1 colorless Triskelavite ARTIFACT creature token with flying. IT HAS “SACRIFICE THIS TOKEN: THIS TOKEN DEALS 1 DAMAGE TO ANY TARGET.”',
      // The engines. One fact about each decides its whole family, which is why
      // `examined` is nowhere near `proposed`.
      'Dross Scorpion': 'ARTIFACT Creature — Scorpion 3/1 for {4}. Whenever this creature or another ARTIFACT CREATURE dies, you may untap TARGET ARTIFACT.',
      'Krark-Clan Ironworks': 'Artifact for {4}. Sacrifice an ARTIFACT: Add {C}{C}.',
      'Urza, Lord High Artificer': 'Legendary Creature — Human Artificer 1/4 for {2}{U}{U}. When Urza enters, create a 0/0 colorless Construct artifact creature token with “This token gets +1/+1 for each artifact you control.” Tap an untapped ARTIFACT you control: Add {U}. {5}: Shuffle your library, then exile the top card…',
      'True Conviction': 'Enchantment for {3}{W}{W}{W}. Creatures you control have double strike and LIFELINK.',
      'Kaya, Geist Hunter': 'Legendary Planeswalker — Kaya 3 for {1}{W}{B}. −2: Until end of turn, if one or more tokens would be created under your control, TWICE that many of those tokens are created instead.',
      'Earthcraft': 'Enchantment for {1}{G}. TAP AN UNTAPPED CREATURE YOU CONTROL: Untap target basic land.',
      'Agatha’s Soul Cauldron': 'Legendary Artifact for {2}. You may spend mana as though it were mana of any color to activate abilities of creatures you control. Creatures you control with +1/+1 counters on them have all activated abilities of all creature cards exiled with Agatha’s Soul Cauldron. {T}: Exile target card from a graveyard…',
      'Ramos, Dragon Engine': 'Legendary Artifact Creature — Dragon 4/4 for {6}. Flying. Whenever you cast a spell, put a +1/+1 counter on Ramos for each of that spell’s colors. Remove five +1/+1 counters from Ramos: Add {W}{W}{U}{U}{B}{B}{R}{R}{G}{G}. Activate only once each turn.',
      'Cathars’ Crusade': 'Enchantment for {4}{W}. Whenever a creature you control enters, put a +1/+1 counter on each creature you control.',
      'Ivy Lane Denizen': 'Creature — Elf Warrior 2/3 for {3}{G}. Whenever another GREEN creature you control enters, put a +1/+1 counter on target creature.',
      'Quickbeam, Upstart Ent': 'Legendary Creature — Treefolk 5/6 for {4}{G}{G}. Whenever Quickbeam or another TREEFOLK you control enters, up to two target creatures each get +2/+2 and gain trample until end of turn.',
    },
    date: '2026-08-03',
    method: 'the four cards that turn a +1/+1 counter into a token and a token back into a counter, compared line by line',
    proposed: 196,
    examined: 52,
    kept: 31,
    ruledOut: [
      { reason: 'Pentavus, Thopter Squadron and Triskelavus are ARTIFACTS making ARTIFACT '
        + 'tokens, and that is what most of their combos are about. Dross Scorpion untaps a '
        + 'target artifact when an artifact creature dies, Krark-Clan Ironworks sacrifices an '
        + 'artifact for {C}{C}, Urza taps an untapped artifact for {U}, and Clock of Omens, '
        + 'Extruder, Yotian Dissident, Stridehangar Automaton and the Atog family all read the '
        + 'same word. Ghave is a Fungus Shaman making a green Saproling; there is nothing in '
        + 'any of those loops for him to be' },
      { reason: 'the token’s own ability is the loop. Triskelavus makes a Triskelavite with '
        + '“Sacrifice this token: This token deals 1 damage to any target”, True Conviction '
        + 'gives it lifelink, and the life is what buys the next +1/+1 counter off Heliod or '
        + 'Spider-Man. A Saproling is a 1/1 with no text at all', count: 36 },
      { reason: 'Ulasht’s other mode, “deals 1 damage to target creature”, which Ghave has no '
        + 'equivalent of. No candidate here turned out to use it, so this rules out nothing — '
        + 'recorded because it is the one direction the swap does not run' },
    ],
    notes: 'A well-covered card that was still worth the sweep: 196 proposed, 31 kept, and 165 '
      + 'dead on two facts. **Ulasht is the true peer and it is not close** — “{1}, Remove a '
      + '+1/+1 counter from ULASHT” against Ghave’s “from A CREATURE YOU CONTROL”, same cost, '
      + 'same 1/1 green Saproling — so 21 of the 25 Ulasht shapes are rows and the other four '
      + 'are supersets of combos Ghave already has. The three Ramos lines are the ones to read '
      + 'twice: they blink the engine to refill its counters, and Ulasht enters with a counter '
      + 'per other red or green creature where Ghave enters with a flat five, so those work for '
      + 'Ghave on an empty board and for Ulasht only on a full one. **Not swept:** the four '
      + 'Quickbeam, Upstart Ent shapes, where a type-changer (Conspiracy, Xenograft, Maskwood '
      + 'Nexus, Arcane Adaptation) naming Treefolk makes the token trigger him. The swap looks '
      + 'sound — a Saproling under Conspiracy is as much a Treefolk as a Thopter is — but the '
      + 'loop also spends Devoted Druid’s untaps against Thopter Squadron’s sorcery-speed '
      + 'restriction, which Ghave does not have, so the mana arithmetic is a different sum and '
      + 'nobody has done it.',
  },
  {
    subject: 'Insidious Roots',
    cards: ['Insidious Roots'],
    cardIds: [5477],
    read: {
      'Insidious Roots': 'Enchantment for {B}{G}. Creature tokens you control have “{T}: Add one mana of any color.” Whenever one or more CREATURE CARDS leave your graveyard, create a 0/1 green Plant creature token, then put a +1/+1 counter on each Plant you control.',
      // The graveyard half: three cards with its trigger word for word, and four with
      // a wider one. The token is the only thing that differs.
      'Skeleton Crew': 'Creature — Skeleton Pirate 3/3 for {3}{B}. Each other creature you control that’s a Skeleton or Pirate gets +1/+1. Whenever one or more CREATURE CARDS leave your graveyard, create a 2/2 black Skeleton Pirate creature token. (This ability triggers only from the battlefield.) {5}{B}: Return this card from your graveyard to the battlefield tapped.',
      'Desecrated Tomb': 'Artifact for {3}. Whenever one or more CREATURE CARDS leave your graveyard, create a 1/1 black Bat creature token with flying.',
      'Chalk Outline': 'Enchantment for {3}{G}. Whenever one or more CREATURE CARDS leave your graveyard, create a 2/2 white and blue Detective creature token, THEN INVESTIGATE. (Create a Clue token. It’s an artifact with “{2}, Sacrifice this token: Draw a card.”)',
      'Tormod, the Desecrator': 'Legendary Creature — Zombie Wizard 4/2 for {3}{B}. Whenever one or more CARDS leave your graveyard, create a tapped 2/2 black Zombie creature token. Partner.',
      // The mana half. Springleaf Parade's second line is the Roots' first, verbatim.
      'Springleaf Parade': 'Enchantment for {X}{G}{G}. When this enchantment enters, create X 1/1 colorless Shapeshifter creature tokens with changeling. CREATURE TOKENS YOU CONTROL HAVE “{T}: ADD ONE MANA OF ANY COLOR.”',
      'Jaheira, Friend of the Forest': 'Legendary Creature — Human Elf Druid 2/3 for {2}{G}. TOKENS you control have “{T}: Add {G}.” Choose a Background.',
      // The engines each family turns on.
      'Ovalchase Daredevil': 'Creature — Human Pilot 4/2 for {4}{R}. Whenever an ARTIFACT you control enters, you may return this card from your graveyard to your hand.',
      'Shilgengar, Sire of Famine': 'Legendary Creature — Elder Demon 6/6. Flying. Sacrifice another creature: Create a Blood token. If you sacrificed an ANGEL this way, create a number of Blood tokens equal to its toughness instead. {W/B}{W/B}{W/B}, Sacrifice six Blood tokens: Return each creature card from your graveyard to the battlefield with a finality counter on it.',
      'Coercive Recruiter': 'Creature — Orc Pirate 4/3 for {4}{R}. Whenever this creature or another PIRATE you control enters, gain control of target creature until end of turn. Untap that creature. Until end of turn, it gains haste and becomes a Pirate in addition to its other types.',
      'Sage of the Falls': 'Creature — Merfolk Wizard 2/5 for {3}{U}. Whenever this creature or another NON-HUMAN creature you control enters, you may draw a card. If you do, discard a card.',
      'Whisper, Blood Liturgist': 'Legendary Creature — Human Cleric 2/2 for {3}{B}. {T}, Sacrifice TWO creatures: Return target creature card from your graveyard to the battlefield.',
      'Abby, Merciless Soldier': 'Legendary Creature — Human Survivor 4/4 for {1}{R}{G}. When you cast this spell, create a number of 1/1 black Fungus Zombie creature tokens named Cordyceps Infected equal to the amount of mana spent to cast it. Abby enters under the control of an opponent of your choice. Partner—Survivors.',
      'Ashnod’s Altar': 'Artifact for {3}. Sacrifice a creature: Add {C}{C}.',
      'Phyrexian Altar': 'Artifact for {3}. Sacrifice a creature: Add one mana of any color.',
    },
    date: '2026-08-03',
    method: 'each of its two abilities against the cards published with that ability alone',
    proposed: 172,
    examined: 68,
    kept: 49,
    ruledOut: [
      { reason: 'Chalk Outline INVESTIGATES and the Roots do not. The Clue is an artifact, and '
        + 'the artifact is what returns Ovalchase Daredevil — “whenever an ARTIFACT you control '
        + 'enters” — so the loop runs on the half of Chalk Outline the Roots have no equivalent '
        + 'of. The Plant is a creature token and nothing else. The six Moss-Pit Skeleton shapes '
        + 'are the same fact one step along: the Clue is what triggers Rook Turret', count: 18 },
      { reason: 'Coercive Recruiter reads “whenever this creature or another PIRATE you control '
        + 'enters”, and Skeleton Crew answers with a Skeleton PIRATE where the Roots answer '
        + 'with a Plant', count: 1 },
    ],
    notes: 'Two cards in one enchantment, so it has two peer families and they share nothing. '
      + 'The graveyard half has three verbatim twins — Skeleton Crew, Desecrated Tomb and Chalk '
      + 'Outline all read “whenever one or more CREATURE CARDS leave your graveyard” — which '
      + 'makes the token the only question, and the answer differs per loop: it has to be a '
      + 'creature Shilgengar can eat (14 rows), a creature an altar can eat or a NON-HUMAN '
      + 'creature entering for Sage of the Falls (11 rows), a Pirate (ruled out), or an artifact '
      + 'the Clue provides (18 ruled out). The mana half is cleaner than anything else in this '
      + 'file: Springleaf Parade’s second line IS the Roots’ first line, and its 24 shapes are '
      + 'one loop behind 24 haste enablers, so one reading of Abby, Merciless Soldier settles '
      + 'all of them. Jaheira, Friend of the Forest is not a source for it — she grants {G} '
      + 'only and Abby needs {R}{G}. **NOT SWEPT, and this is the open half of the card:** the '
      + '103 shapes carried by the peers that read “whenever one or more CARDS leave your '
      + 'graveyard” — Tormod, the Desecrator, both Quintorius, Garrison Excavator, Teval — '
      + 'where the Roots need the card leaving to be a CREATURE card. That is a per-shape '
      + 'question, not one fact about an engine, and nobody has asked it. Nor are the 1,689 '
      + 'shapes of Cryptolith Rite and Elven Chorus touched: they grant the mana ability to '
      + 'every creature where the Roots grant it to tokens only, which is a real difference and '
      + 'a large space, and it is the biggest thing left open about this card.',
  },
  {
    subject: 'Bartolomé del Presidio',
    cards: ['Bartolomé del Presidio'],
    cardIds: [2921],
    date: '2026-08-03',
    method: 'Substitution sweep against his six text-level peers, then the published steps '
      + 'for the peer version of each shape read against the cards. The first pass since '
      + 'card-text.json existed, so every text below is Scryfall\'s own wording rather than '
      + 'Forge\'s, fetched by the Cache card text workflow and committed.',
    read: {
      'Bartolomé del Presidio': 'Sacrifice another creature or artifact: Put a +1/+1 counter on Bartolomé del Presidio. Legendary Creature — Vampire Knight 2/1 for {W}{B}.',
      // The six peers, by text rather than by score. The line that matters in every one of
      // them is whether it says "a creature" or "another creature", and what the outlet
      // does besides eating.
      'Phantom Train': 'Trample. Sacrifice another artifact or creature: Put a +1/+1 counter on this Vehicle. It becomes a Spirit artifact creature in addition to its other types until end of turn. Artifact — Vehicle 4/4 for {3}{B}.',
      'Woe Strider': 'When Woe Strider enters, create a 0/1 white Goat creature token. Sacrifice another creature: Scry 1. Escape—{3}{B}{B}, Exile four other cards from your graveyard. Creature — Horror 3/2 for {2}{B}.',
      'Yahenni, Undying Partisan': 'Haste. Whenever a creature an opponent controls dies, put a +1/+1 counter on Yahenni. Sacrifice another creature: Yahenni gains indestructible until end of turn. Legendary Creature — Aetherborn Vampire 2/2 for {2}{B}.',
      'Bloodflow Connoisseur': 'Sacrifice a creature: Put a +1/+1 counter on this creature. Creature — Vampire 1/1 for {2}{B}.',
      'Viscera Seer': 'Sacrifice a creature: Scry 1. Creature — Vampire Wizard 1/1 for {B}.',
      'Carrion Feeder': 'This creature can’t block. Sacrifice a creature: Put a +1/+1 counter on this creature. Creature — Zombie 1/1 for {B}.',
      // The engines behind the four shapes whose steps were read.
      'Dargo, the Shipwrecker': 'As an additional cost to cast this spell, you may sacrifice any number of artifacts and/or creatures. This spell costs {2} less to cast for each permanent sacrificed this way and {2} less to cast for each other artifact or creature you’ve sacrificed this turn. Trample. Partner. Legendary Creature — Giant Pirate 7/5 for {6}{R}.',
      'Earthcraft': 'Tap an untapped creature you control: Untap target basic land. Enchantment for {1}{G}.',
      'Arwen Undómiel': 'Whenever you scry, put a +1/+1 counter on target creature. {4}{G}{U}: Scry 2. Legendary Creature — Elf Noble 2/2 for {G}{U}.',
      'Scurry Oak': 'Evolve. Whenever one or more +1/+1 counters are put on this creature, you may create a 1/1 green Squirrel creature token. Creature — Treefolk 1/2 for {2}{G}.',
      'Nim Deathmantle': 'Equipped creature gets +2/+2, has intimidate, and is a black Zombie. Whenever a nontoken creature is put into your graveyard from the battlefield, you may pay {4}. If you do, return that card to the battlefield and attach this Equipment to it. Equip {4}. Artifact — Equipment for {2}.',
      'Ashnod’s Altar': 'Sacrifice a creature: Add {C}{C}. Artifact for {3}.',
    },
    proposed: 280,
    examined: 4,
    kept: 1,
    ruledOut: [
      { reason: 'THE SCRY, and this is the widest finding of the pass. Woe Strider and Viscera '
        + 'Seer both read "Sacrifice … : Scry 1", so their outlet\'s *effect* is a scry — and a '
        + 'whole family of loops is built on converting that scry into something else. Arwen '
        + 'Undómiel reads "whenever you SCRY, put a +1/+1 counter on target creature", which is '
        + 'what feeds Scurry Oak in 997-1920-4186. Bartolomé\'s outlet scries nothing; it puts '
        + 'its counter on himself, and Scurry Oak needs the counter on ITSELF. So Arwen never '
        + 'triggers and the loop does not start. Bartolomé + Arwen + Scurry Oak looks identical '
        + 'to the Necrosynthesis + Scurry Oak row already in unofficial.js and is not the same '
        + 'thing at all — the row\'s enabler puts counters on directly',
        count: 1,
        sets: [['Arwen Undómiel', 'Scurry Oak', 'Bartolomé del Presidio']] },
      { reason: 'THE GOAT. Woe Strider reads "When Woe Strider enters, create a 0/1 white Goat '
        + 'creature token", and 997-2034-5003\'s published steps spend it: sacrifice him to '
        + 'Ashnod’s Altar, Nim Deathmantle pays {4} to return him, "when Woe Strider enters, it '
        + 'triggers, creating a creature token", and the token is the next sacrifice. Bartolomé '
        + 'comes back from the Deathmantle with nothing free to eat, so the loop stops on its '
        + 'first lap. Every Woe Strider shape that recurs him through a reanimator is this',
        count: 1,
        sets: [['Nim Deathmantle', 'Ashnod’s Altar', 'Bartolomé del Presidio']] },
      { reason: 'Yahenni\'s SECOND ability, not his outlet. 3693-3967-4613 and 1495-3967-4613 run '
        + 'on "whenever a creature an opponent controls dies, put a +1/+1 counter on Yahenni" '
        + 'plus granted deathtouch — Agatha’s Soul Cauldron lends him Walking Ballista’s '
        + 'counter-removal, and the counter comes back from the opponent\'s creature dying. '
        + 'Bartolomé has exactly one ability and it is the outlet; there is no trigger for the '
        + 'Cauldron to feed. The sacrifice half of Yahenni is not what these use',
        count: 2,
        sets: [['Agatha’s Soul Cauldron', 'Walking Ballista', 'Bartolomé del Presidio'],
          ['Agatha’s Soul Cauldron', 'Triskelion', 'Bartolomé del Presidio']] },
      { reason: 'categorical, and it is why Viscera Seer (234 surviving shapes) and Carrion '
        + 'Feeder (197) dwarf the true peers at ten and under: both read "Sacrifice A creature", '
        + 'so they can eat THEMSELVES, and Bartolomé reads "another". The same asymmetry this '
        + 'file already records for Scurry Oak against Broodscale’s Spawn. Not enumerated as '
        + 'sets — it is a property of the outlet, not of a card list — and NOT applied as a '
        + 'blanket rule-out either: a loop that feeds the outlet a third card substitutes fine. '
        + 'It is written down as the first thing to check on the 276 nobody read' },
    ],
    notes: 'FOUR OF 280 SHAPES WERE READ. kept: 1 is a real one and the 276 are simply unswept — '
      + 'said plainly because this file has already been burned once by a kept: 0 that read as '
      + 'diligence (see the Basking Broodscale entry, where reading the other 136 found 38 rows). '
      + 'Bartolomé is the most-published card any pass here has taken on: 1,674 published combos '
      + 'and six existing rows, and his peers share 1,555+ shapes with him, so the tail is thin '
      + 'rather than rich. The four read were chosen from the two truest peers by text — Phantom '
      + 'Train, which matches him word for word ("another artifact or creature"), and the two '
      + '"another creature" outlets — and three of the four died to the peer doing something '
      + 'besides eating: scrying, making a Goat, or triggering off an opponent\'s creature dying. '
      + 'That is the shape of the remaining work: the question is never "is this a free '
      + 'repeatable outlet" but "what else does the peer\'s ability DO", and the published steps '
      + 'answer it in one line every time. Also the first pass to run with card-text.json in '
      + 'place, which caught this file recording him as "Creature — Human Soldier" where Scryfall '
      + 'says "Legendary Creature — Vampire Knight" — corrected above, and nothing had turned on '
      + 'it, but a type line from recollection is exactly what the cache exists to stop.',
  },
  {
    subject: 'Experimental Confectioner, a second time — and the method is out of proposals',
    cards: ['Experimental Confectioner'],
    cardIds: [2590],
    date: '2026-08-03',
    method: 'Peer discovery from the data rather than from the 0.9 threshold, then the one peer '
      + 'it found swept exhaustively against today\'s snapshot. Asked because the earlier pass '
      + 'on this card (2026-08-02) only ever looked at Camellia, and nobody had checked whether '
      + 'he had other peers or whether newer combos had appeared since.',
    read: {
      'Experimental Confectioner': '{2}{B} Creature — Human Peasant 2/3. When this creature enters, create a Food token. Whenever you sacrifice a Food, create a 1/1 black Rat creature token with “This token can’t block.”',
      // Corrected 2026-08-04 against card-text.json, which now has her. This said
      // 'Squirrel Druid 3/3 for {2}{B}{G}' and 'each Squirrel you control': she is a
      // Squirrel WARLOCK for {1}{B}{G} and forages for 'each OTHER Squirrel'. Nothing
      // this pass concluded turned on any of the three — the trigger line was right —
      // but a cost and a type line from recollection sitting in the map whose whole job
      // is verbatim text is the Chatterfang mistake happening again, in the entry
      // directly above the pass that names it.
      'Camellia, the Seedmiser': 'Menace. Other Squirrels you control have menace. Whenever you sacrifice one or more Foods, create a 1/1 green Squirrel creature token. {2}, Forage: Put a +1/+1 counter on each other Squirrel you control. (To forage, exile three cards from your graveyard or sacrifice a Food.) Legendary Creature — Squirrel Warlock 3/3 for {1}{B}{G}.',
    },
    proposed: 82,
    examined: 82,
    kept: 0,
    ruledOut: [
      { reason: 'NOTHING WAS LEFT TO PROPOSE, and the accounting closes exactly: of the 82 shapes '
        + 'Camellia is published in that he is not, 25 are shapes he already has under a different '
        + 'card list, 53 are strict supersets of a combo he already has (Spellbook does not publish '
        + 'those), and 4 are already rows in unofficial.js from the 2026-08-02 pass. '
        + '25 + 53 + 4 + 0 = 82, no remainder. This is a COMPLETE zero rather than a provisional '
        + 'one, and the distinction matters here more than anywhere: the Basking Broodscale entry '
        + 'warns that a kept: 0 reads as diligence, and it was right — but that zero sat on 136 '
        + 'shapes nobody had read, where this one has nothing left to read. Subsumption is doing '
        + 'most of the work, which is the shape of a well-covered card',
        count: 82 },
      { reason: 'HE HAS NO PEER AT THE THRESHOLD THE TOOL USES. Ranking every card by how many of '
        + 'his 62 shapes it shares turned up exactly one above 3 shared — Camellia, at jaccard '
        + '0.21 against a default bar of 0.9. So substitution-scope.js would never have proposed '
        + 'him at all, and the only reason he has rows is that somebody swept him by hand from the '
        + 'Camellia end. He is the second card recorded here that the method is simply silent '
        + 'about, after Spike Feeder (83 published combos, no peer at any threshold). Worth '
        + 'knowing that the work queue is not the same thing as the work' },
      { reason: 'the gap this pass CANNOT close, named so nobody reads the zero above as '
        + '"nothing remains". His function is "turn a sacrificed Food into a creature token", and '
        + 'the method can only find a peer Spellbook has already published beside the same cards. '
        + 'A card that does the same job and that Spellbook has never used in a combo is invisible '
        + 'to all of this — the README says so under "What this cannot find". Answering it needs a '
        + 'Scryfall query rather than the combo data: oracle:"sacrifice a Food" together with '
        + 'oracle:"create", which a runner can ask and this sandbox cannot' },
    ],
    notes: 'A pass that added nothing, recorded because a card nobody has swept and a card swept '
      + 'to exhaustion look identical from outside this file — which is the whole reason it exists. '
      + 'The 2026-08-02 entry proposed 4, examined 4 and kept 4, and reading that alone would '
      + 'suggest a rich card with more to give; re-running it against a newer snapshot and against '
      + 'ALL his peers rather than the one somebody happened to pick says the opposite, and says it '
      + 'with arithmetic that closes. The other half of this pair is settled too: the Camellia pass '
      + 'took his shapes in the reverse direction, examined all 37 and ruled out 2 on the one real '
      + 'difference between them — she reads "whenever you sacrifice ONE OR MORE Foods" for one '
      + 'trigger per event, he reads "whenever you sacrifice A Food" for one per Food, so he is '
      + 'strictly better in a loop that spends several and she is not worse anywhere. Both '
      + 'directions of the only peer he has are now closed.',
  },
  {
    subject: 'the outlet slot behind Camellia, the Seedmiser + Peregrin Took',
    cards: [
      'Camellia, the Seedmiser', 'Peregrin Took', 'Umbral Collar Zealot', 'Bill the Pony',
      'Mushroom Watchdogs', 'Evereth, Viceroy of Plunder', 'Rusted Slasher', 'Thermal Navigator',
      'Oxidda Daredevil', 'Krark-Clan Shaman', 'Cauldron Familiar',
    ],
    cardIds: [5777, 4321, 6798, 1441, 7627, 6495, 1026, 3721, 7369, 6781, 856],
    date: '2026-08-04',
    method: 'The slot enumerated two ways and the two answers reconciled. First from the other '
      + 'side, the way the Cauldron Familiar pass had to be run: diff the outlets Spellbook lists '
      + 'behind Peregrin Took against the ones it lists behind Ygra, Eater of All, which fills the '
      + 'same slot. Then from the card text, which is the half a peer score cannot do — every '
      + 'Forge card script for all 7,365 names in the snapshot, filtered to activated abilities '
      + 'whose entire cost is one sacrifice, then to the ones that will take a Food.',
    read: {
      // The three the shape is, read from card-text.json (Scryfall) and cross-checked
      // against XMage for all three, because the whole pass turns on Peregrin Took's
      // replacement applying to Camellia's token and on what the Zealot's cost will eat.
      'Camellia, the Seedmiser': 'Menace. Other Squirrels you control have menace. Whenever you sacrifice one or more Foods, create a 1/1 green Squirrel creature token. {2}, Forage: Put a +1/+1 counter on each other Squirrel you control. (To forage, exile three cards from your graveyard or sacrifice a Food.) Legendary Creature — Squirrel Warlock 3/3 for {1}{B}{G}.',
      'Peregrin Took': 'If one or more tokens would be created under your control, those tokens plus an additional Food token are created instead. (It’s an artifact with “{2}, {T}, Sacrifice this token: You gain 3 life.”) Sacrifice three Foods: Draw a card. Legendary Creature — Halfling Citizen 2/3 for {2}{G}.',
      'Umbral Collar Zealot': 'Sacrifice another creature or artifact: Surveil 1. Creature — Human Cleric 3/2 for {1}{B}.',
      // The six kept. Each one is the same three words doing the work — a free,
      // repeatable sacrifice the Food is a legal choice for — and a rider that cannot
      // gate it. The riders are recorded anyway because "cannot gate it" is a claim
      // about the rider.
      'Bill the Pony': 'When Bill the Pony enters, create two Food tokens. Sacrifice a Food: Until end of turn, target creature you control assigns combat damage equal to its toughness rather than its power. Legendary Creature — Horse 1/4 for {3}{W}.',
      'Mushroom Watchdogs': 'Sacrifice a Food: Put a +1/+1 counter on this creature. It gains vigilance until end of turn. ACTIVATE ONLY AS A SORCERY. Creature — Dog 2/2 for {1}{G}.',
      'Evereth, Viceroy of Plunder': 'Flying. Sacrifice another creature or artifact: Put a +1/+1 counter on Evereth. If the sacrificed permanent was a Treasure, Evereth gains lifelink until end of turn. ACTIVATE ONLY AS A SORCERY. When Evereth dies, you may pay {1}{B/R}. When you do, Evereth deals damage equal to its power to each opponent. Legendary Creature — Vampire Soldier 2/2 for {2}{B}.',
      'Rusted Slasher': 'Sacrifice an artifact: Regenerate this creature. Artifact Creature — Phyrexian Horror 4/1 for {4}.',
      'Thermal Navigator': 'Sacrifice an artifact: This creature gains flying until end of turn. Artifact Creature — Construct 2/2 for {3}.',
      'Oxidda Daredevil': 'Sacrifice an artifact: This creature gains haste until end of turn. Creature — Goblin Artificer 2/1 for {1}{R}.',
      // The two the text sweep proposed and the text sweep killed. Both look like clean
      // free artifact-eaters in the cost column and are not, for reasons that are only
      // in the effect column — which is why the filter proposes and does not decide.
      'Krark-Clan Shaman': 'Sacrifice an artifact: THIS CREATURE deals 1 damage to EACH CREATURE WITHOUT FLYING. Creature — Goblin Shaman 1/1 for {R}.',
      'Cauldron Familiar': 'When this creature enters, each opponent loses 1 life and you gain 1 life. Sacrifice a Food: RETURN THIS CARD FROM YOUR GRAVEYARD to the battlefield. Creature — Cat 1/1 for {B}.',
      // The eleven the diff proposed and the reading killed. Every one of them says
      // "Sacrifice a creature", which is the whole rule-out: Peregrin Took's Food is an
      // artifact and none of these will take it. They are behind Ygra because Ygra makes
      // the Squirrel itself a Food.
      'Viscera Seer': 'Sacrifice A CREATURE: Scry 1. Creature — Vampire Wizard 1/1 for {B}.',
      'Carrion Feeder': 'This creature can’t block. Sacrifice A CREATURE: Put a +1/+1 counter on this creature. Creature — Zombie 1/1 for {B}.',
      'Woe Strider': 'When Woe Strider enters, create a 0/1 white Goat creature token. Sacrifice ANOTHER CREATURE: Scry 1. Escape—{3}{B}{B}, Exile four other cards from your graveyard. Creature — Horror 3/2 for {2}{B}.',
      'Yahenni, Undying Partisan': 'Haste. Whenever a creature an opponent controls dies, put a +1/+1 counter on Yahenni. Sacrifice ANOTHER CREATURE: Yahenni gains indestructible until end of turn. Legendary Creature — Aetherborn Vampire 2/2 for {2}{B}.',
      'Bloodflow Connoisseur': 'Sacrifice A CREATURE: Put a +1/+1 counter on Bloodflow Connoisseur. Creature — Vampire 1/1 for {2}{B}.',
      'Goblin Bombardment': 'Sacrifice A CREATURE: This enchantment deals 1 damage to any target. Enchantment for {1}{R}.',
      'Altar of Dementia': 'Sacrifice A CREATURE: Target player mills cards equal to the sacrificed creature’s power. Artifact for {2}.',
      'Blasting Station': '{T}, Sacrifice A CREATURE: This artifact deals 1 damage to any target. Whenever a creature enters, you may untap this artifact. Artifact for {3}.',
      'Shilgengar, Sire of Famine': 'Flying. Sacrifice ANOTHER CREATURE: Create a Blood token. If you sacrificed an Angel this way, create a number of Blood tokens equal to its toughness instead. {W/B}{W/B}{W/B}, Sacrifice six Blood tokens: Return each creature card from your graveyard to the battlefield with a finality counter on it. Legendary Creature — Elder Demon 6/6.',
      'Phyrexian Altar': 'Sacrifice a creature: Add ONE MANA of any color. Artifact for {3}.',
      'Thermopod': '{S}: This creature gains haste until end of turn. Sacrifice a creature: Add {R} — ONE MANA. Snow Creature — Slug 4/3 for {4}{R}.',
      // The three published outlets that work by a mechanism other than eating the Food
      // for free, read because the accounting only closes if each is explained. They are
      // why 14 + 3 = the 17 Spellbook lists.
      'Ashnod’s Altar': 'Sacrifice a creature: Add {C}{C} — TWO MANA. Artifact for {3}.',
      'Krark-Clan Ironworks': 'Sacrifice an artifact: Add {C}{C}. Artifact for {4}.',
      'Grinding Station': '{T}, Sacrifice an artifact: Target player mills three cards. Whenever an ARTIFACT enters, you may untap this artifact. Artifact for {2}.',
      'Ninja Pizza': 'FOODS YOU CONTROL HAVE “{T}, Sacrifice this artifact: Add one mana of any color.” At the beginning of your second main phase, create a Food token. Enchantment for {2}{G}.',
      'Ygra, Eater of All': 'Ward—Sacrifice a Food. OTHER CREATURES ARE FOOD ARTIFACTS in addition to their other types and have “{2}, {T}, Sacrifice this permanent: You gain 3 life.” Whenever a Food is put into a graveyard from the battlefield, put two +1/+1 counters on Ygra. Legendary Creature — Elemental Cat 6/6 for {3}{B}{G}.',
      // The two Food-eaters Spellbook does list behind Took, read to confirm the slot is
      // what it looks like rather than something narrower.
      'Wicked Wolf': 'When this creature enters, it fights up to one target creature you don’t control. Sacrifice a Food: Put a +1/+1 counter on this creature. It gains indestructible until end of turn. Tap it. Creature — Wolf 3/3 for {2}{G}{G}.',
      'Glimmer Bairn': 'Sacrifice a TOKEN: This creature gets +2/+2 until end of turn. Creature — Ouphe 1/2 for {G}.',
      // The near miss the text filter turned up and the type line settled: the only free
      // "sacrifice a token" in the data other than Glimmer Bairn, and it names the token.
      'Jungle Patrol': '{3}: Create a 0/3 colorless Wall artifact creature token with defender named Wood. Sacrifice A TOKEN NAMED WOOD: Add {R}. Enchantment for {2}{G}.',
      'Extruder': 'Echo {4}. Sacrifice an artifact: Put a +1/+1 counter on target creature. Artifact Creature — Juggernaut 4/3 for {4}.',
    },
    proposed: 19,
    examined: 19,
    kept: 6,
    ruledOut: [
      { reason: 'THE OUTLET HAS TO EAT AN ARTIFACT, AND THESE EAT A CREATURE. This is the answer '
        + 'to "every sacrifice outlet should substitute", and it is no: Peregrin Took returns a '
        + 'FOOD, which is an artifact, and Camellia only triggers on sacrificing a Food. An outlet '
        + 'reading "sacrifice a creature" can eat the Squirrel the loop just made, which triggers '
        + 'nothing and ends the loop one card down. All eleven are published behind Ygra, Eater of '
        + 'All and none behind Peregrin Took, and that is not an oversight in Spellbook’s '
        + 'list — Ygra makes every other creature a Food artifact, so behind HIM the Squirrel is a '
        + 'legal cost and behind Took it is not. The two lists differing exactly here is the '
        + 'evidence', count: 11,
        sets: [
          ['Camellia, the Seedmiser', 'Peregrin Took', 'Viscera Seer'],
          ['Camellia, the Seedmiser', 'Peregrin Took', 'Carrion Feeder'],
          ['Camellia, the Seedmiser', 'Peregrin Took', 'Woe Strider'],
          ['Camellia, the Seedmiser', 'Peregrin Took', 'Yahenni, Undying Partisan'],
          ['Camellia, the Seedmiser', 'Peregrin Took', 'Bloodflow Connoisseur'],
          ['Camellia, the Seedmiser', 'Peregrin Took', 'Goblin Bombardment'],
          ['Camellia, the Seedmiser', 'Peregrin Took', 'Altar of Dementia'],
          ['Camellia, the Seedmiser', 'Peregrin Took', 'Blasting Station'],
          ['Camellia, the Seedmiser', 'Peregrin Took', 'Shilgengar, Sire of Famine'],
          ['Camellia, the Seedmiser', 'Peregrin Took', 'Phyrexian Altar'],
          ['Camellia, the Seedmiser', 'Peregrin Took', 'Thermopod'],
        ] },
      { reason: 'AND THE MANA ROUTE ROUND IT FAILS ON ONE MANA, which is worth its own line '
        + 'because Ashnod’s Altar IS published here and looks identical from a distance. A '
        + 'creature-eating outlet can still reach the loop by paying for Camellia’s own '
        + '"{2}, Forage", since forage may be paid by sacrificing a Food — so the cycle is: two '
        + 'mana plus a Food in, one Squirrel and one Food out. Ashnod’s Altar turns one '
        + 'creature into {C}{C} and the Squirrel pays for the next lap exactly; Phyrexian Altar '
        + 'and Thermopod give ONE mana per creature, so each lap wants two Squirrels and makes '
        + 'one, and the loop runs down. Those two are inside the eleven above, counted once. '
        + 'This is the arithmetic that explains why the Altar is on Spellbook’s list' },
      { reason: 'CAULDRON FAMILIAR IS NOT A REPEATABLE OUTLET, it is a one-shot per trip to the '
        + 'graveyard. "Sacrifice a Food: Return this card from your graveyard to the battlefield" '
        + 'is activated from the graveyard, and once it resolves the Cat is on the battlefield '
        + 'and the ability is out of reach. One Food eaten, one Squirrel made, then nothing — '
        + 'getting a second lap needs a sacrifice outlet, which is a fourth card and a shape '
        + 'the Umbral Collar Zealot pass of 2026-08-03 already swept', count: 1,
        sets: [['Camellia, the Seedmiser', 'Peregrin Took', 'Cauldron Familiar']] },
      { reason: 'KRARK-CLAN SHAMAN KILLS ITSELF ON THE FIRST LAP. The cost is a clean free '
        + '"sacrifice an artifact" and the effect is what rules it out: 1 damage to each creature '
        + 'without flying, and the Shaman is a 1/1 Goblin with no flying. It dies to its own '
        + 'ability, taking the 1/1 Squirrels with it. The only rule-out here that lives entirely '
        + 'in the effect column rather than the cost column, which is why a cost filter proposes '
        + 'and a reading decides', count: 1,
        sets: [['Camellia, the Seedmiser', 'Peregrin Took', 'Krark-Clan Shaman']] },
      { reason: 'JUNGLE PATROL was the near miss and the type line settled it. It is the only '
        + 'free "sacrifice a token" in the data besides Glimmer Bairn, which is published here — '
        + 'but it reads "sacrifice a token NAMED WOOD", and a Food token is not one. Not counted '
        + 'among the 19: the enumeration proposed it and the same filter that proposed it threw '
        + 'it out, before anything was read' },
    ],
    notes: 'ASKED BECAUSE SOMEBODY PROPOSED THE COMBO AND IT WAS ALREADY PUBLISHED — Camellia + '
      + 'Peregrin Took + Umbral Collar Zealot is 4321-5777-6798, and its published steps are the '
      + 'clearest statement of the loop in the data: activate the outlet by sacrificing a Food, '
      + 'Camellia answers with a Squirrel, Took’s replacement returns a Food alongside it, '
      + 'repeat. Food-neutral, Squirrel-positive, and the only demand on the third card is a free '
      + 'repeatable sacrifice a Food is a legal cost for. The interesting question was the one '
      + 'behind it: what else fills that slot.\n\n'
      + '**The enumeration is machine-checkable, and that is the new thing here.** Every previous '
      + 'pass in this file read a handful of cards somebody chose; this one read the cost line of '
      + 'all 7,365 names in the snapshot, because Forge serves its card scripts as files on '
      + 'raw.githubusercontent.com and the whole set fetches in 72 seconds at twelve concurrent '
      + 'requests. 174 cards have an activated ability whose entire cost is one sacrifice. 23 of '
      + 'those will take a Food; Jungle Patrol’s Wood clause drops it to 22; 14 of the 22 '
      + 'are already published behind Peregrin Took, leaving 8. Spellbook’s list is 17, and '
      + 'the missing 3 are each a different mechanism — Ninja Pizza gives the Food its OWN '
      + 'sacrifice ability, Ashnod’s Altar pays for Camellia’s forage, Grinding Station '
      + 'taps but untaps itself on the Food entering (its trigger reads ARTIFACT, not creature, '
      + 'which is why the Food and not the Squirrel is what resets it). 14 + 3 = 17 with no '
      + 'residue, which is the first time an outlet slot in this file has been closed rather than '
      + 'sampled.\n\n'
      + 'The other arm was the Ygra diff, and it is the one that answers the question as asked. '
      + '13 outlets are behind Ygra and not behind Took; 11 of the 13 are creature-eaters that '
      + 'cannot be, and the remaining 2 — Bill the Pony and Mushroom Watchdogs — are free Food '
      + 'outlets Spellbook already publishes behind CAMELLIA in the Ygra version of the very same '
      + 'slot. Those two are rows now on the strongest evidence this method produces: not a peer '
      + 'that resembles the card, the card itself, in the same slot, one list over.\n\n'
      + 'Six rows: Bill the Pony, Mushroom Watchdogs, Evereth, Viceroy of Plunder, Rusted '
      + 'Slasher, Thermal Navigator, Oxidda Daredevil. Three of them (Evereth, Rusted Slasher, '
      + 'Thermal Navigator) share no combo shape with any outlet Spellbook put behind Took — '
      + 'Evereth is in one published combo, the other two only in Emry, Lurker of the Loch shapes '
      + '— so no substitution score would ever have proposed them. That is the argument for '
      + 'reading a slot from card text rather than from a score, stated as three rows.\n\n'
      + 'ALL SIX CLAIM LESS THAN THE COMBO THEY CITE. Spellbook tags 4321-5777-6798 with '
      + '"Infinite Food tokens", "Infinite card draw" and "Infinite death triggers"; none of the '
      + 'three holds. Foods are created every lap and never accumulate, Took’s draw wants '
      + 'three at once, and nothing dies — the Squirrels pile up untouched. Kept results are the '
      + 'Squirrels, the ETB, the LTB and the sacrifice triggers, plus a counter where the '
      + 'outlet’s rider is one.\n\n'
      + '**READ THE CAMELLIA ENTRY’S RULE-OUT NARROWLY, and this is the case that shows why.** '
      + 'ruledOutSets() already returns `Camellia, the Seedmiser + Peregrin Took` — killed on '
      + '2026-08-03 because the loop there had to spend three Foods a cycle and got one Squirrel '
      + 'back, the outlet being Took’s OWN "Sacrifice three Foods: Draw a card". That is a fact '
      + 'about the two-card shape and nothing else. Hand the pair any outlet that takes ONE Food '
      + 'and the arithmetic reverses, which is why 4321-5777-6798 is published and why there are '
      + 'six more rows here. A `sets` entry answers "has this exact combination been ruled out", '
      + 'not "is there anything here" — the note at the top of this file says the answer is yes '
      + 'or nothing-recorded, and a two-card rule-out is silent about every third card.',
  },
  {
    subject: 'Light of Promise, against Archangel of Thune and Heroic Feast',
    cards: [
      'Light of Promise',
      'Archangel of Thune',
      'Heroic Feast',
      'Scurry Oak',
      'Herd Baloth',
      'Basking Broodscale',
      'Aunt May',
      'Virulent Emissary',
      'Guide of Souls',
      'Elas il-Kor, Sadistic Pilgrim',
      'Bogwater Lumaret',
      'Lunarch Veteran // Luminous Phantom',
      'Kitchen Finks',
      'All Will Be One',
      'Essence Warden',
      'Soul Warden',
    ],
    cardIds: [338, 2919, 7743, 4186, 3197, 5641, 6823, 7173, 5870, 2811, 7399, 1939, 2086, 2390, 2741, 360],
    date: '2026-08-04',
    method:
      'A reader holding Archangel of Thune and Heroic Feast said Light of Promise should be in '
      + 'more combos than it is, and named those two as the peers to migrate from. THE PREMISE IS '
      + 'FALSE AT THE DATABASE LEVEL AND THAT GOES FIRST: Spellbook publishes Light of Promise in '
      + "357 combos against Archangel's 347 and Heroic Feast's 167, so the Aura is the best "
      + 'covered of the three. What is true is that the lists are not the same list — 65 shapes '
      + 'name Archangel and not the Aura, 20 name Heroic Feast and not the Aura. This pass took '
      + 'the 45 of those 85 that are three-card shapes and left the 40 four-card ones.',
    read: {
      'Light of Promise':
        'Enchant creature\n'
        + 'Enchanted creature has "Whenever you gain life, put that many +1/+1 counters on this creature."',
      'Archangel of Thune':
        'Flying\n'
        + 'Lifelink (Damage dealt by this creature also causes you to gain that much life.)\n'
        + 'Whenever you gain life, put a +1/+1 counter on each creature you control.',
      'Heroic Feast':
        'When this enchantment enters, create a Food token. (It\'s an artifact with "{2}, {T}, '
        + 'Sacrifice this token: You gain 3 life.")\n'
        + 'Whenever you gain life, choose up to that many target creatures you control. Put a '
        + '+1/+1 counter on each of them.',
      'Scurry Oak':
        'Evolve (Whenever a creature you control enters, if that creature has greater power or '
        + 'toughness than this creature, put a +1/+1 counter on this creature.)\n'
        + 'Whenever one or more +1/+1 counters are put on this creature, you may create a 1/1 '
        + 'green Squirrel creature token.',
      'Herd Baloth':
        'Whenever one or more +1/+1 counters are put on this creature, you may create a 4/4 '
        + 'green Beast creature token.',
      'Basking Broodscale':
        'Devoid (This card has no color.)\n'
        + '{1}{G}: Adapt 1. (If this creature has no +1/+1 counters on it, put a +1/+1 counter on it.)\n'
        + 'Whenever one or more +1/+1 counters are put on this creature, you may create a 0/1 '
        + 'colorless Eldrazi Spawn creature token with "Sacrifice this token: Add {C}."',
      'Aunt May':
        'Whenever another creature you control enters, you gain 1 life. If it\'s a Spider, put '
        + 'a +1/+1 counter on it.',
      'Virulent Emissary':
        'Deathtouch\n'
        + 'Whenever another creature you control enters, you gain 1 life.',
      // Re-read against Scryfall after the fact, pasted in by the reader who asked for the
      // pass. Word for word what Forge gave, which is why the three rows resting on it went
      // from `derived` to `verified` without their argument changing.
      'Guide of Souls':
        'Whenever another creature you control enters, you gain 1 life and get {E} (an energy counter).\n'
        + 'Whenever you attack, you may pay {E}{E}{E}. When you do, put two +1/+1 counters and a '
        + 'flying counter on target attacking creature. It becomes an Angel in addition to its '
        + 'other types.',
      'Elas il-Kor, Sadistic Pilgrim':
        'Deathtouch\n'
        + 'Whenever another creature you control enters, you gain 1 life.\n'
        + 'Whenever another creature you control dies, each opponent loses 1 life.',
      'Bogwater Lumaret':
        'Whenever this creature or another creature you control enters, you gain 1 life.',
      'Lunarch Veteran // Luminous Phantom':
        'Whenever another creature you control enters, you gain 1 life.\n'
        + 'Disturb {1}{W} (You may cast this card from your graveyard transformed for its disturb cost.)\n'
        + '// Luminous Phantom: Flying\n'
        + 'Whenever another creature you control leaves the battlefield, you gain 1 life.\n'
        + 'If Luminous Phantom would be put into a graveyard from anywhere, exile it instead.',
      'Kitchen Finks':
        'When Kitchen Finks enters, you gain 2 life.\n'
        + 'Persist (When this creature dies, if it had no -1/-1 counters on it, return it to the '
        + "battlefield under its owner's control with a -1/-1 counter on it.)",
      'All Will Be One':
        'Whenever you put one or more counters on a permanent or player, All Will Be One deals '
        + 'that much damage to target opponent, creature an opponent controls, or planeswalker '
        + 'an opponent controls.',
      'Essence Warden': 'Whenever another creature enters, you gain 1 life.',
      'Soul Warden': 'Whenever another creature enters, you gain 1 life.',
    },
    proposed: 85,
    examined: 45,
    kept: 14,
    ruledOut: [
      {
        reason:
          'THE AURA DIES WITH THE CREATURE, AND PERSIST IS A CREATURE DYING. Fifteen of the '
          + 'forty-five are Kitchen Finks plus a free sacrifice outlet, and the counter in that '
          + 'loop has to land on the Finks that just came back: persist returns it with a -1/-1 '
          + 'counter, and the +1/+1 from the lifegain trigger is what annihilates that counter so '
          + 'it can persist again. Archangel of Thune and Heroic Feast do that from outside the '
          + 'creature. Light of Promise is an Aura ON the Finks, so when the Finks dies the Aura '
          + 'goes to the graveyard with it and the second lap has no engine. One lap is not a '
          + 'combo. This is the general rule for the card rather than a fact about Kitchen Finks '
          + '— the Aura works exactly as long as its creature stays on the battlefield, which is '
          + 'why every one of the fourteen rows kept is a loop where nothing leaves it.',
        count: 15,
        sets: [
        ['Light of Promise', 'Kitchen Finks', 'Umbral Collar Zealot'],
        ['Light of Promise', 'Kitchen Finks', 'Phantom Train'],
        ['Light of Promise', 'Kitchen Finks', 'Thermopod'],
        ['Light of Promise', 'Kitchen Finks', 'Yahenni, Undying Partisan'],
        ['Light of Promise', 'Kitchen Finks', 'Woe Strider'],
        ['Light of Promise', 'Kitchen Finks', 'Shilgengar, Sire of Famine'],
        ['Light of Promise', 'Kitchen Finks', 'Phyrexian Altar'],
        ['Light of Promise', 'Kitchen Finks', 'Viscera Seer'],
        ['Light of Promise', 'Kitchen Finks', 'Carrion Feeder'],
        ['Light of Promise', 'Kitchen Finks', 'Bloodflow Connoisseur'],
        ['Light of Promise', 'Kitchen Finks', 'Goblin Bombardment'],
        ['Light of Promise', 'Kitchen Finks', 'Blasting Station'],
        ['Light of Promise', 'Kitchen Finks', 'Bartolomé del Presidio'],
        ['Light of Promise', 'Kitchen Finks', "Ashnod's Altar"],
        ['Light of Promise', 'Kitchen Finks', 'Altar of Dementia'],
        ],
      },
    ],
    notes:
      'WHAT WAS KEPT: fourteen rows, all one shape. A receiver that reads "whenever one or more '
      + '+1/+1 counters are put on this creature" and answers with a token (Scurry Oak, Herd '
      + 'Baloth, Basking Broodscale), a gainer that reads "whenever another creature you control '
      + 'enters, you gain 1 life" (Aunt May, Virulent Emissary, Guide of Souls, Elas il-Kor, '
      + 'Bogwater Lumaret), and the Aura on the receiver. One life, one counter, one creature, '
      + 'which is where all three peers read alike: Archangel spreads one counter over every '
      + 'creature, Heroic Feast one counter over that many creatures, the Aura that many counters '
      + 'over one. The fifteenth pair in the family, Basking Broodscale + Lunarch Veteran, WAS '
      + 'ALREADY A ROW here — the method landing on a row somebody else had already written is '
      + 'the closest thing to a control this file has.\n\n'
      + 'LEFT OPEN, NOT RULED OUT: nine three-card shapes and the forty four-card ones. Eight of '
      + 'the nine are All Will Be One plus enchantment animation or recursion — Starfield of Nyx, '
      + 'Opalescence, Saheeli, Radiant Creator, Captain Rex Nebula, Bello, Bard of the Brambles, '
      + "Relive the Past, Dance of the Manse, Abuelo's Awakening — and the ninth is Pestilence "
      + "Demon + K'rrik, Son of Yawgmoth. All Will Be One's own text is recorded above and its "
      + 'damage goes to an opponent rather than to you, so where the lifegain restarts is exactly '
      + 'the thing that needs reading; the other halves were not read. A shape whose loop nobody '
      + 'has traced is not a rule-out, and `sets` deliberately does not claim it.\n\n'
      + 'PROVENANCE, BECAUSE IT DECIDES THE CONFIDENCE ON EIGHT ROWS. Aunt May, Virulent '
      + 'Emissary, Guide of Souls, Heroic Feast, Kitchen Finks, Lunarch Veteran and All Will Be '
      + "One came from Forge's card scripts: every Scryfall host is refused at CONNECT from this "
      + 'sandbox. The Cache card text workflow was dispatched for them and had not landed when '
      + 'these rows were written, so the eight rows whose gainer is one of the Forge-read three '
      + 'are `derived` rather than `verified`. Everything the argument turns on for the other six '
      + 'rows — Light of Promise, Archangel of Thune, Scurry Oak, Herd Baloth, Basking '
      + "Broodscale, Elas il-Kor, Bogwater Lumaret — is Scryfall's wording out of card-text.json.",
  },
  {
    subject: 'Virulent Emissary and Aunt May, against Essence Warden and Soul Warden',
    cards: [
      'Virulent Emissary',
      'Aunt May',
      'Essence Warden',
      'Soul Warden',
      'Scurry Oak',
      'Spider-Man, Peter Parker',
      'Herd Baloth',
      'Sunbond',
      'Cleric Class',
      'Lurking Roper',
      'Splinter Twin',
      'Trudge Garden',
      'Mana Echoes',
      'Elemental Mastery',
      'Presence of Gond',
      'Yawgmoth, Thran Physician',
      'Famished Paladin',
      'Darien, King of Kjeldor',
      'Goblin Bombardment',
      'Pandemonium',
      'Warstorm Surge',
      'Terror of the Peaks',
      'Ratchet, Field Medic // Ratchet, Rescue Racer',
      'Sculpting Steel',
      'Blasting Station',
      'Basking Broodscale',
      'Warren Soultrader',
      'Enduring Renewal',
      'Stimulus Package',
      'Valentin, Dean of the Vein // Lisette, Dean of the Root',
      'The Locust God',
    ],
    cardIds: [7173, 6823, 2741, 360, 4186, 6824, 3197, 4017, 104, 859, 4702, 2308, 2440, 262, 1424, 4279, 3957, 1981, 5147, 2584, 2773, 1110, 5118, 661, 413, 5641, 5670, 678, 397, 3097, 1339],
    read: {
      'Virulent Emissary':
        'Deathtouch\nWhenever another creature you control enters, you gain 1 life.',
      'Aunt May':
        'Whenever another creature you control enters, you gain 1 life. If it\'s a Spider, put a +1/+1 counter on it.',
      'Essence Warden':
        'Whenever another creature enters, you gain 1 life.',
      'Soul Warden':
        'Whenever another creature enters, you gain 1 life.',
      'Scurry Oak':
        'Evolve (Whenever a creature you control enters, if that creature has greater power or toughness than this creature, put a +1/+1 counter on this creature.)\nWhenever one or more +1/+1 counters are put on this creature, you may create a 1/1 green Squirrel creature token.',
      'Spider-Man, Peter Parker':
        'Flying (This creature can\'t be blocked except by creatures with flying or reach.)\nWhenever you gain life, put a +1/+1 counter on target creature you control. It gains indestructible until end of turn. (Damage and effects that say "destroy" don\'t destroy it.)',
      'Herd Baloth':
        'Whenever one or more +1/+1 counters are put on this creature, you may create a 4/4 green Beast creature token.',
      'Sunbond':
        'Enchant creature\nEnchanted creature has "Whenever you gain life, put that many +1/+1 counters on this creature."',
      'Cleric Class':
        '(Gain the next level as a sorcery to add its ability.)\nIf you would gain life, you gain that much life plus 1 instead.\n{3}{W}: Level 2\nWhenever you gain life, put a +1/+1 counter on target creature you control.\n{4}{W}: Level 3\nWhen this Class becomes level 3, return target creature card from your graveyard to the battlefield. You gain life equal to that creature\'s toughness.',
      'Lurking Roper':
        'This creature doesn\'t untap during your untap step.\nWhenever you gain life, untap this creature.',
      'Splinter Twin':
        'Enchant creature\nEnchanted creature has "{T}: Create a token that\'s a copy of this creature, except it has haste. Exile that token at the beginning of the next end step."',
      'Trudge Garden':
        'Whenever you gain life, you may pay {2}. If you do, create a 4/4 green Fungus Beast creature token with trample.',
      'Mana Echoes':
        'Whenever a creature enters, you may add an amount of {C} equal to the number of creatures you control that share a creature type with it.',
      'Elemental Mastery':
        'Enchant creature\nEnchanted creature has "{T}: Create X 1/1 red Elemental creature tokens with haste, where X is this creature\'s power. Exile them at the beginning of the next end step."',
      'Presence of Gond':
        'Enchant creature\nEnchanted creature has "{T}: Create a 1/1 green Elf Warrior creature token."',
      'Yawgmoth, Thran Physician':
        'Protection from Humans\nPay 1 life, Sacrifice another creature: Put a -1/-1 counter on up to one target creature and draw a card.\n{B}{B}, Discard a card: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)',
      'Famished Paladin':
        'This creature doesn\'t untap during your untap step.\nWhenever you gain life, untap this creature.',
      'Darien, King of Kjeldor':
        'Whenever you\'re dealt damage, you may create that many 1/1 white Soldier creature tokens.',
      'Goblin Bombardment':
        'Sacrifice a creature: This enchantment deals 1 damage to any target.',
      'Pandemonium':
        'Whenever a creature enters, that creature\'s controller may have it deal damage equal to its power to any target of their choice.',
      'Warstorm Surge':
        'Whenever a creature you control enters, it deals damage equal to its power to any target.',
      'Terror of the Peaks':
        'Flying\nSpells your opponents cast that target this creature cost an additional 3 life to cast.\nWhenever another creature you control enters, this creature deals damage equal to that creature\'s power to any target.',
      'Ratchet, Field Medic // Ratchet, Rescue Racer':
        'More Than Meets the Eye {1}{W} (You may cast this card converted for {1}{W}.)\nLifelink\nWhenever you gain life, you may convert Ratchet. When you do, return target artifact card with mana value less than or equal to the amount of life you gained this turn from your graveyard to the battlefield tapped.\n// Ratchet, Rescue Racer: Living metal (During your turn, this Vehicle is also a creature.)\nLifelink\nWhenever one or more nontoken artifacts you control are put into a graveyard from the battlefield, convert Ratchet. This ability triggers only once each turn.',
      'Sculpting Steel':
        'You may have this artifact enter as a copy of any artifact on the battlefield.',
      'Blasting Station':
        '{T}, Sacrifice a creature: This artifact deals 1 damage to any target.\nWhenever a creature enters, you may untap this artifact.',
      'Basking Broodscale':
        'Devoid (This card has no color.)\n{1}{G}: Adapt 1. (If this creature has no +1/+1 counters on it, put a +1/+1 counter on it.)\nWhenever one or more +1/+1 counters are put on this creature, you may create a 0/1 colorless Eldrazi Spawn creature token with "Sacrifice this token: Add {C}."',
      'Warren Soultrader':
        'Pay 1 life, Sacrifice another creature: Create a Treasure token. (It\'s an artifact with "{T}, Sacrifice this token: Add one mana of any color.")',
      'Enduring Renewal':
        'Play with your hand revealed.\nIf you would draw a card, reveal the top card of your library instead. If it\'s a creature card, put it into your graveyard. Otherwise, draw a card.\nWhenever a creature is put into your graveyard from the battlefield, return it to your hand.',
      'Stimulus Package':
        'When this enchantment enters, create two Treasure tokens. (They\'re artifacts with "{T}, Sacrifice this token: Add one mana of any color.")\nSacrifice a Treasure: Create a 1/1 green and white Citizen creature token.',
      'Valentin, Dean of the Vein // Lisette, Dean of the Root':
        'Menace, lifelink\nIf a nontoken creature an opponent controls would die, exile it instead. When you do, you may pay {2}. If you do, create a 1/1 black and green Pest creature token with "When this token dies, you gain 1 life."\n// Whenever you gain life, you may pay {1}. If you do, put a +1/+1 counter on each creature you control and those creatures gain trample until end of turn.',
      'The Locust God':
        'Flying\nWhenever you draw a card, create a 1/1 blue and red Insect creature token with flying and haste.\n{2}{U}{R}: Draw a card, then discard a card.\nWhen The Locust God dies, return it to its owner\'s hand at the beginning of the next end step.',
    },
    date: '2026-08-04',
    method:
      'A reader said these two are in far fewer combos than Essence Warden, and they are: 54 '
      + "and 82 against Essence Warden's 121 and Soul Warden's 149. Unlike the Light of Promise "
      + 'claim in the pass above, THIS ONE IS TRUE, and the whole of the difference is one '
      + 'clause: the Wardens read "whenever another creature enters", these two read "whenever '
      + 'another creature YOU CONTROL enters". The Wardens therefore also see an opponent\'s '
      + 'creature enter, and a combo loop does not care, because every creature these loops put '
      + 'onto the battlefield is one of yours. So the sweep was the whole cross product of both '
      + 'subjects against both Wardens: 62 three-card shapes after dropping what is already '
      + 'published, and one question per shape — is there a creature in this loop I do not '
      + 'control? The answer was no every time the loop could be traced at all.',
    proposed: 268,
    examined: 62,
    kept: 39,
    ruledOut: [
      {
        reason:
          'NOT A RULE-OUT, A LOOP NOBODY TRACED, recorded so the next pass does not rediscover '
          + 'them as fresh candidates. Three published Warden combos whose loop does not follow '
          + "from the three cards' text alone: Enduring Renewal + Warren Soultrader needs "
          + 'something free to recast and the third card is not it; Ratchet + Sculpting Steel '
          + 'needs the copy back in the graveyard and nothing here puts it there; Scurry Oak + '
          + 'Yawgmoth, Thran Physician has Yawgmoth putting -1/-1 counters where Scurry Oak wants '
          + '+1/+1, and where the +1/+1 comes from is on none of the three cards. Five rows '
          + 'across the two subjects. These sets say UNTRACED rather than ruled out, which is the '
          + 'honest state: somebody who reads the published steps may well write all five.',
        count: 5,
        sets: [
          ['Virulent Emissary', 'Ratchet, Field Medic // Ratchet, Rescue Racer', 'Sculpting Steel'],
          ['Aunt May', 'Ratchet, Field Medic // Ratchet, Rescue Racer', 'Sculpting Steel'],
          ['Virulent Emissary', 'Scurry Oak', 'Yawgmoth, Thran Physician'],
          ['Aunt May', 'Scurry Oak', 'Yawgmoth, Thran Physician'],
          ['Aunt May', 'Enduring Renewal', 'Warren Soultrader'],
        ],
      },
    ],
    notes:
      'WHAT WAS KEPT: 39 rows over 23 card pairs, and they are not one family but six, which is '
      + 'what a swap this clean looks like. Darien, King of Kjeldor turning damage into your own '
      + 'Soldiers behind five different pingers (Blasting Station, Goblin Bombardment, '
      + 'Pandemonium, Terror of the Peaks, Warstorm Surge). Famished Paladin and Lurking Roper, '
      + 'both reading "whenever you gain life, untap this creature", behind three Auras that give '
      + 'a tap ability making tokens (Elemental Mastery, Presence of Gond, Splinter Twin). The '
      + 'counter-to-token receivers (Scurry Oak, Herd Baloth, Basking Broodscale) behind Cleric '
      + 'Class, Sunbond, Spider-Man and Valentin // Lisette. Then Warren Soultrader plus Stimulus '
      + 'Package, Trudge Garden plus Mana Echoes, and The Locust God plus Yawgmoth. In every one '
      + 'the entering creature is a token or a recast card of yours.\n\n'
      + 'EIGHTEEN OF THE 62 WERE ALREADY ROWS HERE, three of them written an hour earlier in the '
      + 'Light of Promise pass and reached this time from the other subject. The same row arrived '
      + 'at from two directions is the closest thing to a control this file has.\n\n'
      + 'PROVENANCE: all 31 cards were read and every row is `verified`. 20 partners came out of '
      + "card-text.json, which is Scryfall's wording; the two subjects and seven more (Pandemonium, "
      + 'Warstorm Surge, Terror of the Peaks, Ratchet, Sculpting Steel, Enduring Renewal, Stimulus '
      + 'Package) were pasted from Scryfall by the reader who asked, because every Scryfall host is '
      + 'refused at CONNECT from this sandbox and the Cache card text workflow dispatched for them '
      + 'never landed a branch. Reading Aunt May and Virulent Emissary against Scryfall also '
      + 'confirmed the Forge wording used an hour earlier, which is why five Light of Promise rows '
      + 'went from `derived` to `verified` in the same commit. The three that did not are the Guide '
      + 'of Souls ones: that card is still Forge-only, and one paste would clear it.\n\n'
      + 'STILL OPEN, AND BIGGER THAN WHAT WAS DONE: the four-card shapes (55 partner cards, 15 '
      + 'unread) and the five-card ones (19 partners, 14 unread). The categorical finding above, '
      + "that a combo loop never needs the Wardens' wider trigger, is what makes those cheap once "
      + 'the text is in hand, since the only per-shape question left is whether a creature in the '
      + 'loop belongs to somebody else.',
  },
  {
    subject: 'Sadistic Glee against Necrosynthesis: twelve rows read rather than reasoned',
    cards: [
      'Sadistic Glee',
      'Necrosynthesis',
      'Animation Module',
      'Ghave, Guru of Spores',
      'Ulasht, the Hate Seed',
      'Utopia Mycon',
      'Thermopod',
      "Ashnod's Altar",
      'Phyrexian Altar',
      'Krark-Clan Ironworks',
      'Evolution Witness',
      'Blood Pet',
      'Wild Cantor',
      'Reckless Barbarian',
    ],
    cardIds: [2082, 1628, 3490, 5189, 3192, 4214, 5231, 2034, 4050, 4659, 5660, 3944, 1497, 1947],
    date: '2026-08-05',
    method:
      'NOT A SWEEP. Twelve rows already in unofficial.js carried `derived` — both halves '
      + 'published, the pairing reasoned, nobody had read it against the cards — and this pass '
      + 'is the reading. It was cheap because the whole difference between the two Auras is one '
      + 'word, and the loops turn on whether that word is ever reached.',
    read: {
      'Sadistic Glee':
        'Enchant creature\n'
        + 'Whenever a creature dies, put a +1/+1 counter on enchanted creature.',
      'Necrosynthesis':
        'Enchant creature\n'
        + 'Enchanted creature has "Whenever another creature dies, put a +1/+1 counter on this creature."\n'
        + 'When enchanted creature dies, look at the top X cards of your library, where X is its '
        + 'power. Put one of those cards into your hand and the rest on the bottom of your library '
        + 'in a random order.',
      'Animation Module':
        'Whenever one or more +1/+1 counters are put on a permanent you control, you may pay {1}. '
        + 'If you do, create a 1/1 colorless Servo artifact creature token.\n'
        + '{3}, {T}: Choose a counter on target permanent or player. Give that permanent or player '
        + 'another counter of that kind.',
      'Ghave, Guru of Spores':
        'Ghave enters with five +1/+1 counters on it.\n'
        + '{1}, Remove a +1/+1 counter from a creature you control: Create a 1/1 green Saproling '
        + 'creature token.\n'
        + '{1}, Sacrifice a creature: Put a +1/+1 counter on target creature.',
      'Ulasht, the Hate Seed':
        'Ulasht enters with a +1/+1 counter on it for each other red creature you control and a '
        + '+1/+1 counter on it for each other green creature you control.\n'
        + '{1}, Remove a +1/+1 counter from Ulasht: Choose one —\n'
        + '• Ulasht deals 1 damage to target creature.\n'
        + '• Create a 1/1 green Saproling creature token.',
      'Utopia Mycon':
        'At the beginning of your upkeep, put a spore counter on this creature.\n'
        + 'Remove three spore counters from this creature: Create a 1/1 green Saproling creature token.\n'
        + 'Sacrifice a Saproling: Add one mana of any color.',
      'Thermopod':
        '{S}: This creature gains haste until end of turn. ({S} can be paid with one mana from a '
        + 'snow source.)\n'
        + 'Sacrifice a creature: Add {R}.',
      "Ashnod's Altar": 'Sacrifice a creature: Add {C}{C}.',
      'Phyrexian Altar': 'Sacrifice a creature: Add one mana of any color.',
      'Krark-Clan Ironworks': 'Sacrifice an artifact: Add {C}{C}.',
      'Evolution Witness':
        '{1}{G}: Adapt 2. (If this creature has no +1/+1 counters on it, put two +1/+1 counters on it.)\n'
        + 'Whenever one or more +1/+1 counters are put on this creature, return target permanent '
        + 'card from your graveyard to your hand.',
      'Blood Pet': 'Sacrifice this creature: Add {B}.',
      'Wild Cantor':
        '({R/G} can be paid with either {R} or {G}.)\n'
        + 'Sacrifice this creature: Add one mana of any color.',
      'Reckless Barbarian': 'Sacrifice this creature: Add {R}{R}.',
    },
    proposed: 12,
    examined: 12,
    kept: 0,
    ruledOut: [],
    notes:
      'THE WHOLE DIFFERENCE IS WHERE THE TRIGGER LIVES. Sadistic Glee keeps the ability on the '
      + 'Aura — "whenever A creature dies, put a +1/+1 counter on enchanted creature" — and '
      + 'Necrosynthesis grants it to the creature — "whenever ANOTHER creature dies, put a +1/+1 '
      + 'counter on this creature". They diverge on exactly one event: the enchanted creature\'s '
      + 'own death, where Glee triggers and Necrosynthesis does not. A counter on a creature that '
      + 'has just died does nothing, so the divergence is worth nothing either, and in all twelve '
      + 'loops the body that dies is a token or a recast one-shot rather than the enchanted '
      + 'creature. Necrosynthesis also throws in a card off the enchanted creature\'s death, which '
      + 'no loop here uses and none is harmed by.\n\n'
      + 'THE FOUR FAMILIES, each traced rather than assumed:\n'
      + '  - Animation Module + a sacrifice outlet (Ashnod\'s Altar, Phyrexian Altar, Krark-Clan '
      + 'Ironworks). A Servo dies to the outlet, the Aura answers with a counter, the Module sees '
      + 'a counter put on a permanent and pays {1} for the next Servo. Ashnod\'s pays {C}{C} for '
      + 'a {1} Servo, so the mana is where the loop profits. Ironworks eats an artifact, and a '
      + 'Servo is an artifact creature, so its sacrifice is still a creature dying.\n'
      + '  - Ghave, Guru of Spores + Utopia Mycon or Thermopod. Remove a counter for a Saproling, '
      + 'sacrifice the Saproling for the mana that paid for it, and the Aura hands the counter '
      + 'back. Nothing accumulates; the death, ETB and sacrifice triggers do, which is what those '
      + 'rows claim.\n'
      + '  - Ulasht, the Hate Seed + the same two outlets, on the same shape: its second mode is '
      + '"remove a +1/+1 counter: create a Saproling".\n'
      + '  - Evolution Witness + a one-shot mana body (Blood Pet, Wild Cantor, Reckless Barbarian). '
      + 'Sacrifice the body for mana, the Aura puts a counter on the Witness, the Witness returns '
      + 'the body from the graveyard to hand, the mana recasts it. The Aura is on the Witness, '
      + 'which never dies — the case where the two Auras would differ, avoided by construction '
      + 'rather than by luck.\n\n'
      + 'kept is 0 because this pass wrote no rows. It moved twelve from `derived` to `verified`, '
      + 'which is the other thing a reading can buy and the reason the two confidences exist. '
      + 'Eighteen more rows with the same swap were already `verified`, so all thirty now agree; a '
      + 'file where the same swap carried two confidences was itself the tell.\n\n'
      + 'ALL FOURTEEN CARDS OUT OF card-text.json, which is Scryfall\'s wording. Nothing here rests '
      + 'on Forge or on a paste, and that is new: the workflow dispatch that cached the last 40 '
      + 'landed first, so this is the first pass in this file that had the whole board in the cache '
      + 'before it started.'
  },
  {
    subject: 'the last thirteen derived rows: Rosie Cotton of South Lane, and Chatterfang for Quina',
    cards: [
      'Rosie Cotton of South Lane',
      'Ivy Lane Denizen',
      'Cathars\' Crusade',
      'Good-Fortune Unicorn',
      'Chatterfang, Squirrel General',
      'Quina, Qu Gourmet',
      'Ghave, Guru of Spores',
      'Ulasht, the Hate Seed',
      'Marath, Will of the Wild',
      'Xavier Sal, Infested Captain',
      'Animation Module',
      'Cryptic Trilobite',
      'Utopia Mycon',
      'Earthcraft',
      'Ashnod\'s Altar',
      'Phyrexian Altar',
      'Mana Echoes',
      'Intruder Alarm',
      'Kirol, Attentive First-Year',
      'Molten Echoes',
      'Council of Reeds',
      'Survey Mechan',
      'Mortuary',
      'Chalk Outline',
    ],
    cardIds: [2433, 2850, 2744, 4535, 3000, 6705, 5189, 3192, 1335, 3143, 3490, 4929, 4214, 2757, 2034, 4050, 2440, 1636, 7150, 2506, 7752, 6961, 5220, 5632],
    read: {
      'Rosie Cotton of South Lane':
        'When Rosie Cotton enters, create a Food token. (It\'s an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")\nWhenever you create a token, put a +1/+1 counter on target creature you control other than Rosie Cotton.',
      'Ivy Lane Denizen':
        'Whenever another green creature you control enters, put a +1/+1 counter on target creature.',
      'Cathars\' Crusade':
        'Whenever a creature you control enters, put a +1/+1 counter on each creature you control.',
      'Good-Fortune Unicorn':
        'Whenever another creature you control enters, put a +1/+1 counter on that creature.',
      'Chatterfang, Squirrel General':
        'Forestwalk (This creature can\'t be blocked as long as defending player controls a Forest.)\nIf one or more tokens would be created under your control, those tokens plus that many 1/1 green Squirrel creature tokens are created instead.\n{B}, Sacrifice X Squirrels: Target creature gets +X/-X until end of turn.',
      'Quina, Qu Gourmet':
        'If one or more tokens would be created under your control, those tokens plus a 1/1 green Frog creature token are created instead.\n{2}, Sacrifice a Frog: Put a +1/+1 counter on Quina.',
      'Ghave, Guru of Spores':
        'Ghave enters with five +1/+1 counters on it.\n{1}, Remove a +1/+1 counter from a creature you control: Create a 1/1 green Saproling creature token.\n{1}, Sacrifice a creature: Put a +1/+1 counter on target creature.',
      'Ulasht, the Hate Seed':
        'Ulasht enters with a +1/+1 counter on it for each other red creature you control and a +1/+1 counter on it for each other green creature you control.\n{1}, Remove a +1/+1 counter from Ulasht: Choose one —\n• Ulasht deals 1 damage to target creature.\n• Create a 1/1 green Saproling creature token.',
      'Marath, Will of the Wild':
        'Marath enters with a number of +1/+1 counters on it equal to the amount of mana spent to cast it.\n{X}, Remove X +1/+1 counters from Marath: Choose one —\n• Put X +1/+1 counters on target creature. X can\'t be 0.\n• Marath deals X damage to any target. X can\'t be 0.\n• Create an X/X green Elemental creature token. X can\'t be 0.',
      'Xavier Sal, Infested Captain':
        '{T}, Remove a counter from another permanent you control: Populate. Activate only as a sorcery. (Create a token that\'s a copy of a creature token you control.)\n{T}, Sacrifice another creature: Proliferate. Activate only as a sorcery. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)',
      'Animation Module':
        'Whenever one or more +1/+1 counters are put on a permanent you control, you may pay {1}. If you do, create a 1/1 colorless Servo artifact creature token.\n{3}, {T}: Choose a counter on target permanent or player. Give that permanent or player another counter of that kind.',
      'Cryptic Trilobite':
        'This creature enters with X +1/+1 counters on it.\nRemove a +1/+1 counter from this creature: Add {C}{C}. Spend this mana only to activate abilities.\n{1}, {T}: Put a +1/+1 counter on this creature.',
      'Utopia Mycon':
        'At the beginning of your upkeep, put a spore counter on this creature.\nRemove three spore counters from this creature: Create a 1/1 green Saproling creature token.\nSacrifice a Saproling: Add one mana of any color.',
      'Earthcraft':
        'Tap an untapped creature you control: Untap target basic land.',
      'Ashnod\'s Altar':
        'Sacrifice a creature: Add {C}{C}.',
      'Phyrexian Altar':
        'Sacrifice a creature: Add one mana of any color.',
      'Mana Echoes':
        'Whenever a creature enters, you may add an amount of {C} equal to the number of creatures you control that share a creature type with it.',
      'Intruder Alarm':
        'Creatures don\'t untap during their controllers\' untap steps.\nWhenever a creature enters, untap all creatures.',
      'Kirol, Attentive First-Year':
        'Tap two untapped creatures you control: Copy target triggered ability you control. You may choose new targets for the copy. Activate only once each turn.',
      'Molten Echoes':
        'As this enchantment enters, choose a creature type.\nWhenever a nontoken creature you control of the chosen type enters, create a token that\'s a copy of that creature. That token gains haste. Exile it at the beginning of the next end step.',
      'Council of Reeds':
        'The "legend rule" doesn\'t apply to creatures you control.\nAt the beginning of combat on your turn, if you\'ve cast a noncreature spell this turn, create a token that\'s a copy of Council of Reeds.',
      'Survey Mechan':
        'Flying\nHexproof (This creature can\'t be the target of spells or abilities your opponents control.)\n{10}, Sacrifice this creature: It deals 3 damage to any target. Target player draws three cards and gains 3 life. This ability costs {X} less to activate, where X is the number of differently named lands you control.',
      'Mortuary':
        'Whenever a creature is put into your graveyard from the battlefield, put that card on top of your library.',
      'Chalk Outline':
        'Whenever one or more creature cards leave your graveyard, create a 2/2 white and blue Detective creature token, then investigate. (Create a Clue token. It\'s an artifact with "{2}, Sacrifice this token: Draw a card.")',
    },
    date: '2026-08-05',
    method:
      'Not a sweep for new rows — a reading of the thirteen rows still marked `derived`, which '
      + 'is the state that means the pairing was reasoned and never read. Every card in them was '
      + 'already in card-text.json by this point, so the only thing missing was the reading, and '
      + 'three of the loops would not follow from the cards alone. THOSE THREE WERE SETTLED FROM '
      + "SPELLBOOK'S OWN PUBLISHED STEPS, fetched from the data branch — steps/<bucket>/<id>.json, "
      + 'the same tree the page reads, and raw.githubusercontent.com is the one host this sandbox '
      + 'is allowed. A published step list is the best evidence there is for what a loop does, and '
      + 'it is cheaper than deducing it: the Animation Module row turned on a prerequisite '
      + '("creatures you control can tap to produce at least {1}") that no card in the row states.',
    proposed: 13,
    examined: 13,
    kept: 13,
    ruledOut: [],
    notes:
      'ALL THIRTEEN HOLD, ON ONE PROPERTY. Rosie Cotton is the narrower card of the four: her '
      + 'peers trigger on a creature ENTERING — Ivy Lane Denizen on another green one, '
      + "Cathars' Crusade on any, Good-Fortune Unicorn on any — and she triggers on a TOKEN being "
      + 'CREATED. That is a real narrowing, and it costs nothing here because in every one of the '
      + 'thirteen loops the creature that enters IS a token: a Saproling off Ghave, Ulasht or '
      + 'Utopia Mycon, an Elemental off Marath, a Servo off Animation Module, a populate copy off '
      + 'Xavier Sal. A loop that entered a nontoken creature would break, and none of these does.\n\n'
      + 'THE SECOND CONSTRAINT IS HER TARGET: "target creature you control other than Rosie '
      + 'Cotton". Every loop wants the counter on its engine rather than on the trigger source, so '
      + 'the restriction is free — except at the start of the Animation Module loop, where Rosie '
      + 'needs one other creature on the battlefield to have a legal target at all. Her own ETB '
      + 'Food token primes it and the first Servo sustains it, but it is a prerequisite the '
      + "Cathars' Crusade version does not have, and it is why that row is the one to check first "
      + 'if any of this is ever disputed.\n\n'
      + 'AND WHERE SHE IS BROADER, WHICH IS WORTH SAYING TOO: Ivy Lane Denizen only sees a GREEN '
      + "creature enter and Cathars' Crusade spreads a counter over EVERY creature. Rosie sees any "
      + 'token and places one counter. None of the thirteen needed the colour and none needed the '
      + 'spread — they all need exactly one counter, on the engine, once per token.\n\n'
      + 'CHATTERFANG FOR QUINA, the two long rows: Quina adds one 1/1 Frog per token-creation '
      + 'event, Chatterfang adds a 1/1 Squirrel FOR EACH token created. Where one token is created '
      + 'at a time the two are the same card, which is the case in both loops — the published steps '
      + 'want exactly one extra body, to tap alongside a Kirol token in one and to feed '
      + "Ashnod's Altar for {C}{C}{C}{C} in the other. Chatterfang is never worse and is better on "
      + 'Chalk Outline, whose investigate makes a Clue as well: a second token creation, so a '
      + "second Squirrel, where Quina's Frog comes once. Quina's other ability ({2}, sacrifice a "
      + 'Frog: put a counter on Quina) is unused by both published loops.\n\n'
      + 'SO unofficial.js NOW HAS NO `derived` ROWS — 451 of them, every one read against the '
      + 'cards. That is not a milestone to defend: the next sweep will add `derived` rows the '
      + 'moment somebody reasons faster than they read, and the label exists so they can.',
  },
  {
    subject: 'the token slot of the Cauldron Familiar + Peregrin Took loop',
    cards: [
      'Cauldron Familiar', 'Peregrin Took', 'Camellia, the Seedmiser', 'Trudge Garden',
      'Experimental Confectioner', 'Desecrated Tomb', 'Ghave, Guru of Spores',
    ],
    cardIds: [856, 4321, 5777, 2308, 2590, 394, 5189],
    // Read from card-text.json, which answered all of them with no request — the
    // state the cache was built for. The peers below are in `read` and not in
    // `cards` because the pass reasoned about them without sweeping them, which is
    // the half that went wrong when Confectioner was recalled instead of fetched.
    read: {
      'Cauldron Familiar': 'When this creature enters, each opponent loses 1 life and you gain 1 life. Sacrifice a Food: Return this card from your graveyard to the battlefield. Creature — Cat 1/1 for {B}.',
      'Peregrin Took': 'If one or more tokens would be created under your control, those tokens plus an additional Food token are created instead. Sacrifice three Foods: Draw a card. Legendary Creature — Halfling Citizen 2/3 for {2}{G}.',
      'Camellia, the Seedmiser': 'Menace. Other Squirrels you control have menace. Whenever you sacrifice one or more Foods, create a 1/1 green Squirrel creature token. {2}, Forage: Put a +1/+1 counter on each other Squirrel you control. (To forage, exile three cards from your graveyard or sacrifice a Food.) Legendary Creature — Squirrel Warlock 3/3.',
      'Trudge Garden': 'Whenever you gain life, you may pay {2}. If you do, create a 4/4 green Fungus Beast creature token with trample. Enchantment.',
      'Experimental Confectioner': 'When this creature enters, create a Food token. Whenever you sacrifice a Food, create a 1/1 black Rat creature token with "This token can’t block." Creature — Human Peasant 2/3 for {2}{B}.',
      'Desecrated Tomb': 'Whenever one or more creature cards leave your graveyard, create a 1/1 black Bat creature token with flying. Artifact.',
      'Ghave, Guru of Spores': 'Ghave enters with five +1/+1 counters on it. {1}, Remove a +1/+1 counter from a creature you control: Create a 1/1 green Saproling creature token. {1}, Sacrifice a creature: Put a +1/+1 counter on target creature. Legendary Creature — Fungus Shaman 0/0.',
      // The rest of the published token slot, read to establish what the slot is.
      // Twelve of the thirteen read "cards leave your graveyard"; Pitiless Plunderer
      // is the one that reads the Cat dying instead.
      'Garrison Excavator': 'Menace. Whenever one or more cards leave your graveyard, create a 2/2 red and white Spirit creature token. Creature — Orc Sorcerer 3/4.',
      'Insidious Roots': 'Creature tokens you control have "{T}: Add one mana of any color." Whenever one or more creature cards leave your graveyard, create a 0/1 green Plant creature token, then put a +1/+1 counter on each Plant you control. Enchantment.',
      'Pitiless Plunderer': 'Whenever another creature you control dies, create a Treasure token. Creature — Human Pirate 1/4 for {3}{B}.',
      'Nuka-Cola Vending Machine': '{1}, {T}: Create a Food token. Whenever you sacrifice a Food, create a tapped Treasure token. Artifact for {3}.',
      'Warren Soultrader': 'Pay 1 life, Sacrifice another creature: Create a Treasure token. Creature — Zombie Goblin Wizard 3/3 for {2}{B}.',
      'Samwise Gamgee': 'Whenever another nontoken creature you control enters, create a Food token. Sacrifice three Foods: Return target historic card from your graveyard to your hand. Legendary Creature — Halfling Peasant 2/2 for {G}{W}.',
      'Shilgengar, Sire of Famine': 'Flying. Sacrifice another creature: Create a Blood token. If you sacrificed an Angel this way, create a number of Blood tokens equal to its toughness instead. {W/B}{W/B}{W/B}, Sacrifice six Blood tokens: Return each creature card from your graveyard to the battlefield with a finality counter on it. Legendary Creature — Elder Demon 6/6.',
      // The three outlets the rows this pass kept were measured against, because the
      // Trudge Garden rule-out is arithmetic about what each one pays.
      'Ashnod’s Altar': 'Sacrifice a creature: Add {C}{C}. Artifact.',
      'Phyrexian Altar': 'Sacrifice a creature: Add one mana of any color. Artifact for {3}.',
      'Thermopod': '{S}: Thermopod gains haste until end of turn. Sacrifice a creature: Add {R}. Snow Creature — Slug 4/3 for {4}{R}.',
    },
    date: '2026-08-06',
    method: 'the slot Spellbook fills by name, diffed against one deck — the same shape as the outlet-slot pass, one slot along',
    proposed: 90,
    examined: 18,
    kept: 12,
    ruledOut: [
      { reason: 'Warren Soultrader fills BOTH slots at once — he is the outlet and he '
        + 'makes the Treasure — so Spellbook publishes him as a three-card combo with the '
        + 'Cat and Peregrin Took, and every four-card set naming him is a strict superset '
        + 'of it. Shilgengar, Sire of Famine is the same card in this respect, with a '
        + 'Blood token instead of a Treasure, and is published the same way', count: 15 },
      { reason: 'Samwise Gamgee does not need Peregrin Took at all: Cauldron Familiar '
        + 'returning from the graveyard is a NONTOKEN creature entering, which is Samwise’s '
        + 'trigger, so he makes the Food himself. Spellbook publishes six three-card '
        + 'combos of Samwise plus the Cat plus an outlet and every four-card set adding '
        + 'Took to one is a superset', count: 15 },
      { reason: 'Ghave, Guru of Spores makes a token, but both of his abilities cost {1} '
        + 'and the Saproling also costs a +1/+1 counter removed from a creature. The slot '
        + 'wants a token every lap for free; his supply of counters is five and does not '
        + 'renew inside this loop', count: 15 },
      { reason: 'SUBSUMED BY A PUBLISHED TWO-CARD COMBO, and this is the answer to why '
        + 'Experimental Confectioner sits in exactly one combo in a deck built around him. '
        + 'He and Nuka-Cola Vending Machine trigger on the same event as Camellia — '
        + 'sacrificing a Food — but they read "a Food" and answer PER FOOD, so Peregrin '
        + 'Took’s own "sacrifice three Foods: draw a card" gives three triggers and three '
        + 'Foods back. That is already the whole combo: `Peregrin Took + Experimental '
        + 'Confectioner` (pop 33,850) and `Peregrin Took + Nuka-Cola Vending Machine` (pop '
        + '56,856) are both published as TWO cards, so every larger set containing the pair '
        + 'is a strict superset. Camellia reads "one or more Foods" and answers once '
        + 'however many were spent — three Foods buy one Squirrel — so she is not a combo '
        + 'with Took alone, and the Cat spends exactly one Food a lap, which is the one '
        + 'rate she keeps up with. The batching that ruled her out of Took’s draw loop is '
        + 'what keeps her out of this subsumption', count: 15 },
      { reason: 'Camellia is already published with Peregrin Took and this outlet as a '
        + 'three-card combo, so adding Cauldron Familiar makes a superset. Four of the '
        + 'fifteen outlets: the two that eat an artifact for free and so can eat the Food '
        + 'themselves (Umbral Collar Zealot, Bartolomé del Presidio, and Phantom Train, '
        + 'which reads "another artifact or creature"), plus Ashnod’s Altar, where '
        + 'Camellia’s own Forage eats the Food and the Altar eats the Squirrel for the {2}',
      count: 4,
      sets: [
        ['Cauldron Familiar', 'Peregrin Took', 'Camellia, the Seedmiser', 'Umbral Collar Zealot'],
        ['Cauldron Familiar', 'Peregrin Took', 'Camellia, the Seedmiser', 'Bartolomé del Presidio'],
        ['Cauldron Familiar', 'Peregrin Took', 'Camellia, the Seedmiser', 'Phantom Train'],
        ['Cauldron Familiar', 'Peregrin Took', 'Camellia, the Seedmiser', 'Ashnod\'s Altar'],
      ] },
      { reason: 'TRUDGE GARDEN’S TRIGGER IS NOT FREE and the outlet has to pay for it. '
        + 'It reads "whenever you gain life, you may pay {2}" — the Cat’s own arrival '
        + 'gains the life, so the lap is there, but {2} has to come from somewhere every '
        + 'time. Only three of the fifteen outlets make mana at all, and only Ashnod’s '
        + 'Altar gets {C}{C} out of a single creature. Phyrexian Altar and Thermopod give '
        + 'one mana each, so they cover the {2} only by also eating the previous lap’s '
        + '4/4 — which leaves the board flat and stops the row producing the infinite '
        + 'creature tokens the combo it cites produces. Those two were read through rather '
        + 'than dropped mechanically; the other twelve make no mana and the loop stops on '
        + 'the first lap', count: 14 },
    ],
    notes: 'Prompted by somebody reading their own decklist and saying Cauldron Familiar, '
      + 'Peregrin Took, Rosie Cotton, Academy Manufactor and Experimental Confectioner '
      + 'ought to be in more of its combos. Two of the five were right, and the reason is '
      + 'structural rather than an oversight in Spellbook’s list.\n\n'
      + 'THE SLOT. Spellbook enumerates this engine exhaustively — 175 combos name both '
      + 'the Cat and Peregrin Took, and all 175 are the same four parts: the Cat, a free '
      + 'sacrifice outlet to send it back to the graveyard (15 named cards), Peregrin Took, '
      + 'and something that creates a token every lap so that Took’s replacement effect '
      + 'hands back the Food the Cat just ate. Thirteen cards fill that last slot and '
      + 'twelve of them read "whenever one or more cards leave your graveyard" — the Cat '
      + 'leaving IS the event. Nothing published reads the *cost*. The Food being '
      + 'sacrificed is the same lap one step earlier, three cards trigger on it, and all '
      + 'three make a token.\n\n'
      + 'Only Camellia survives, and the two that do not die to the subsumption rule-out '
      + 'above rather than to anything about the loop. Zero of 103,867 published combos '
      + 'name Cauldron Familiar and Camellia together; zero name Cauldron Familiar and '
      + 'Experimental Confectioner. Eleven rows for Camellia, one for Trudge Garden, and '
      + 'the deck that prompted this holds all four cards of three Camellia rows and of '
      + 'the Trudge Garden one.\n\n'
      + 'THE ROWS CLAIM TWO RESULTS FEWER THAN THE COMBOS THEY CITE, on purpose. Spellbook '
      + 'lists "Infinite card draw" and "Infinite draw triggers" on the Desecrated Tomb '
      + 'family and its own published step list does not support it: the loop holds exactly '
      + 'one Food at every point — one spent, one replaced — and Took’s draw ability wants '
      + 'three off a single sacrifice. Dropped rather than copied, because copying a result '
      + 'list is how a row ends up asserting something nobody checked.\n\n'
      + 'Each row cites the Desecrated Tomb version of its own outlet rather than the more '
      + 'popular Insidious Roots one. The Tomb creates one creature token and does nothing '
      + 'else, which is Camellia’s sentence; Insidious Roots also hands every token a mana '
      + 'ability and counters the Plants, and would drag results into the row that Camellia '
      + 'does not produce.\n\n'
      + 'One negative worth having: tools/deck-gaps.js proposes four rows swapping a plain '
      + 'creature-only outlet in for Shilgengar in `Shilgengar + Cauldron Familiar + '
      + 'Peregrin Took`, and every one of them is wrong for the reason above — Shilgengar '
      + 'is in that combo as the token maker, not as the outlet, so replacing him with '
      + 'Viscera Seer leaves Took with nothing to replace and the Food never comes back. '
      + 'They are recorded as `sets` under the first rule-out so the tool stops offering '
      + 'them.',
  },
  {
    subject: 'Academy Manufactor and Rosie Cotton of South Lane against one deck',
    cards: ['Academy Manufactor', 'Rosie Cotton of South Lane'],
    cardIds: [4231, 2433],
    read: {
      'Academy Manufactor': 'If you would create a Clue, Food, or Treasure token, instead create one of each. Artifact Creature — Assembly-Worker 1/3 for {3}.',
      'Rosie Cotton of South Lane': 'When Rosie Cotton enters, create a Food token. Whenever you create a token, put a +1/+1 counter on target creature you control other than Rosie Cotton. Legendary Creature — Halfling Peasant 1/1 for {2}{W}.',
      // The two the deck offers as substitutes, and the doublers they were measured
      // against. This is the whole pass: are a token ADDER and a token DOUBLER the
      // same card in these loops, and they are not.
      'Chatterfang, Squirrel General': 'Forestwalk. If one or more tokens would be created under your control, those tokens plus that many 1/1 green Squirrel creature tokens are created instead. {B}, Sacrifice X Squirrels: Target creature gets +X/-X until end of turn. Legendary Creature — Squirrel Warrior 3/3.',
      'Quina, Qu Gourmet': 'If one or more tokens would be created under your control, those tokens plus a 1/1 green Frog creature token are created instead. {2}, Sacrifice a Frog: Put a +1/+1 counter on Quina. Legendary Creature — Qu 2/3.',
      'Doubling Season': 'If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead. If an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead. Enchantment.',
      'Parallel Lives': 'If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead. Enchantment.',
      'Peregrin Took': 'If one or more tokens would be created under your control, those tokens plus an additional Food token are created instead. Sacrifice three Foods: Draw a card. Legendary Creature — Halfling Citizen 2/3 for {2}{G}.',
    },
    date: '2026-08-06',
    method: 'the shapes each is published in that the deck is exactly one card short of, against what the deck holds instead',
    proposed: 47,
    examined: 8,
    kept: 0,
    ruledOut: [
      { reason: 'A TOKEN ADDER IS NOT A TOKEN DOUBLER. Academy Manufactor’s largest '
        + 'unreached family is Camellia + Peregrin Took + Academy Manufactor + a doubler, '
        + 'and the deck holds two cards that look like they fill that slot and do not. '
        + 'Doubling Season and Parallel Lives read "it creates TWICE THAT MANY of those '
        + 'tokens", so the Food Took added is doubled and the loop nets a Food a lap. '
        + 'Chatterfang adds "that many 1/1 green SQUIRREL" tokens and Quina adds "a 1/1 '
        + 'green FROG" — a fixed extra body of their own type, never another copy of the '
        + 'token that was being created. The Food count stays flat and there is no mana '
        + 'for Camellia’s {2}. Ygra, Eater of All is the card that makes Chatterfang work '
        + 'in the one published combo where he appears in this family, because Ygra turns '
        + 'the Squirrels into Foods; the deck does not have Ygra', count: 8 },
      { reason: 'Academy Manufactor reads three token types and this deck makes none of '
        + 'them in a loop. Every per-lap token the deck can produce is a Squirrel '
        + '(Chatterfang, Camellia), a Rat (Experimental Confectioner), a Frog (Quina) or a '
        + '4/4 Fungus Beast (Trudge Garden), and a Clue, a Food or a Treasure is what she '
        + 'is looking at. The only Treasure it makes on a repeatable trigger is Warren '
        + 'Soultrader’s, and `Warren Soultrader + Cauldron Familiar + Academy Manufactor` '
        + 'is already published' },
      { reason: 'Rosie Cotton reads "whenever you CREATE A TOKEN", which is the broadest '
        + 'trigger in the deck and is exactly why she produces nothing new: any repeatable '
        + 'token creation the deck can assemble is already a published combo without her, '
        + 'so adding her is a strict superset every time. The seven shapes she is one card '
        + 'short of want Phyrexian Altar (published with Ashnod’s Altar, which the deck '
        + 'has), Lonis, Animation Module, Pentavus, Triskelavus, Invisible Woman or '
        + 'Jaheira, and the deck holds no peer of any of them', count: 7 },
    ],
    notes: 'Logged because it found nothing, which is the case this file is most useful '
      + 'for. Academy Manufactor is in 661 published combos and this deck reaches 2 of '
      + 'them; Rosie Cotton is in 47 and it reaches 4. Both ratios look like neglect and '
      + 'neither is. Manufactor is a CONVERTER — she needs the loop’s token to already be '
      + 'a Clue, a Food or a Treasure — and this deck’s loops all run on creature tokens. '
      + 'Rosie is the opposite problem: her trigger is so broad that everything she would '
      + 'close is closed already.\n\n'
      + 'The adder-against-doubler rule-out is the one to reuse. It comes up wherever a '
      + 'deck runs Chatterfang or Quina and a combo asks for Doubling Season, and the '
      + 'substitution score will keep proposing it because all four cards are replacement '
      + 'effects on token creation. The difference is what they create: another copy of '
      + 'the token, or one more of a type of their own.',
  },
];

// Every card any pass has covered, lowercased for lookup the way combos.js does it.
function sweptCards() {
  const out = new Map();
  for (const pass of PASSES) {
    (pass.cards || []).forEach((name, i) => {
      // DeckCombos.nameKey, not a copy of it. This file used to spell the rule out again,
      // and the two drifted the moment nameKey learned that a curly apostrophe is an
      // apostrophe: six cards here are written "Ashnod’s Altar" and Spellbook writes
      // "Ashnod's Altar", so every lookup for them answered NOT SWEPT — which is the one
      // answer this index must never give wrongly, since the tools built on it report
      // exactly that. Same reasoning as variantCardNames(): fix the contract, never the
      // call site.
      const key = nameKey(name);
      if (!out.has(key)) out.set(key, { name, id: (pass.cardIds || [])[i], passes: [] });
      out.get(key).passes.push(pass.subject);
    });
  }
  return out;
}

// Every card set a pass has explicitly ruled out, with the reason it died to.
//
// Names are returned as written rather than normalised: this file has no opinion on
// how a consumer keys a card, and combos.js already owns that answer — importing it
// here would make the log depend on the page's code to answer a question about the
// log. tools/deck-gaps.js keys these with nameKey(), the same as everything else.
//
// **Read the note at the top of this file before using it.** The answer is yes or
// nothing-recorded; there is no third value and absence is not one.
function ruledOutSets() {
  const out = [];
  for (const pass of PASSES) {
    for (const rule of pass.ruledOut || []) {
      for (const cards of rule.sets || []) {
        out.push({ cards: cards.slice(), subject: pass.subject, reason: rule.reason });
      }
    }
  }
  return out;
}

const totals = () => PASSES.reduce((a, p) => ({
  proposed: a.proposed + p.proposed,
  examined: a.examined + p.examined,
  kept: a.kept + p.kept,
}), { proposed: 0, examined: 0, kept: 0 });

module.exports = { PASSES, sweptCards, ruledOutSets, totals };
