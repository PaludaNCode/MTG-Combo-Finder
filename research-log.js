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
//               opened. Sixteen entries predate the rule and say UNREAD; the test
//               caps that number and it may only go down.
//   method      how candidates were generated, because a pass is only as wide as
//               the net it threw
//   proposed    what the method produced before any judgement
//   examined    how many a human actually read. Lower than `proposed` whenever a
//               rule-out is mechanical — Chatterfang's 1,197 died to one fact
//               about artifact tokens, not to 1,197 readings
//   kept        how many became rows
//   ruledOut    why the rest did not, which is the part worth keeping. Counts are
//               given where the pass counted them and omitted where it did not;
//               an invented count would be worse than none
//
// The arithmetic is not asserted — examined and kept are what somebody did, and
// proposed is what a tool said, and forcing them to reconcile would only invite
// tidying the numbers. test/research-log.test.js checks the shape, that every card
// set under `kept` is really in unofficial.js, and the thing that actually rots:
// that no unofficial row exists which no entry here claims to have found.
'use strict';

const PASSES = [
  {
    subject: 'The first substitution sweep',
    cards: [
      'Quina, Qu Gourmet', 'Basking Broodscale', 'Trudge Garden', 'Camellia, the Seedmiser',
      'Cauldron Familiar', 'Warren Soultrader', 'Chatterfang, Squirrel General',
    ],
    cardIds: [6705, 5641, 2308, 3868, 1475, 5670, 3000],
    read: {
      'Quina, Qu Gourmet': 'UNREAD — logged before the read-the-card rule; do not reason from this pass without fetching it',
      'Basking Broodscale': 'Devoid. {1}{G}: Adapt 1. Whenever one or more +1/+1 counters are put on this creature, you may create a 0/1 COLORLESS Eldrazi Spawn creature token with \u201cSacrifice this token: Add {C}.\u201d 2/2 for {1}{G}.',
      'Trudge Garden': 'UNREAD — logged before the read-the-card rule; do not reason from this pass without fetching it',
      'Camellia, the Seedmiser': 'Menace. Other Squirrels you control have menace. Whenever you sacrifice one or more Foods, create a 1/1 green Squirrel creature token. {2}, Forage: Put a +1/+1 counter on each other Squirrel you control.',
      'Cauldron Familiar': 'UNREAD — logged before the read-the-card rule; do not reason from this pass without fetching it',
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
      { reason: 'Trudge Garden needs mana out of the sacrifice, not just a sacrifice — '
        + 'all 187 of its published combos use a mana-producing outlet', count: 18 },
      { reason: 'supersets of a two-card combo, which Spellbook never publishes', count: 5 },
      { reason: 'the opposite reading of the same card — Scurry Oak and Herd Baloth make no '
        + 'token that can sacrifice itself, so they need the third card', count: 4 },
      { reason: 'the loop needs a *token* out of the sacrifice, not just a sacrifice', count: 4 },
      { reason: 'Camellia’s loop eats artifacts, and those outlets take creatures only', count: 2 },
      { reason: 'Chatterfang adds Squirrels equal to the tokens created; he does not double '
        + 'what the loop spends', count: 1 },
      { reason: 'Quina adds one Frog however many tokens were made — she is not a doubler', count: 1 },
    ],
    notes: 'The pass the README’s "nothing remains open" was written under. True of these '
      + '44; it read as a claim about the database, which is what later had to be corrected.',
  },
  {
    subject: 'The lifegain loops of one deck',
    cards: [
      'Heroic Feast', 'Archangel of Thune', 'Heliod, Sun-Crowned', 'Kitchen Finks',
      'Scurry Oak', 'Herd Baloth', 'Basking Broodscale', 'Animation Module',
    ],
    cardIds: [7743, 2919, 3944, 2086, 4186, 3197, 5641, 3490],
    read: {
      'Heroic Feast': 'UNREAD — logged before the read-the-card rule; do not reason from this pass without fetching it',
      'Archangel of Thune': 'UNREAD — logged before the read-the-card rule; do not reason from this pass without fetching it',
      'Heliod, Sun-Crowned': 'UNREAD — logged before the read-the-card rule; do not reason from this pass without fetching it',
      'Kitchen Finks': 'UNREAD — logged before the read-the-card rule; do not reason from this pass without fetching it',
      'Scurry Oak': 'Evolve. Whenever one or more +1/+1 counters are put on this creature, you may create a 1/1 GREEN Squirrel creature token. 1/2 for {2}{G}.',
      'Herd Baloth': 'Whenever one or more +1/+1 counters are put on this creature, you may create a 4/4 GREEN Beast creature token. 4/4 for {3}{G}{G}.',
      'Basking Broodscale': 'Devoid. {1}{G}: Adapt 1. Whenever one or more +1/+1 counters are put on this creature, you may create a 0/1 COLORLESS Eldrazi Spawn creature token with \u201cSacrifice this token: Add {C}.\u201d 2/2 for {1}{G}.',
      'Animation Module': 'UNREAD — logged before the read-the-card rule; do not reason from this pass without fetching it',
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
      'Sadistic Glee': 'UNREAD — logged before the read-the-card rule; do not reason from this pass without fetching it',
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
      'Arcbound Ravager': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
      'Pitiless Plunderer': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
      'Clock of Omens': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
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
    subject: 'Ashnod’s Altar',
    cards: ["Ashnod's Altar"],
    read: {
      "Ashnod's Altar": 'Sacrifice a creature: Add {C}{C}.',
      'Phyrexian Altar': 'Sacrifice a creature: Add one mana of any color.',
      'Gravecrawler': '{B} Creature — Zombie 2/1. Gravecrawler cannot block. You may cast Gravecrawler from your graveyard as long as you control a Zombie.',
      'Reassembling Skeleton': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
      'Forsaken Miner': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
      'Nether Traitor': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
      'Krark-Clan Ironworks': 'Sacrifice an artifact: Add {C}{C}.',
      'Scrap Trawler': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
      'Nuka-Cola Vending Machine': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
      'Pitiless Plunderer': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
      'Goblin Bombardment': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
      'Polyraptor': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
      'Broodhatch Nantuko': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
      'Altar of Dementia': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
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
    notes: '**kept: 0 IS STILL PROVISIONAL, but less of it.** Three rule-outs are now read '
      + 'end to end. Ashnod’s Altar adds {C}{C} where Phyrexian Altar adds one mana of any '
      + 'colour; Gravecrawler must be CAST from the graveyard and costs {B}, so colourless '
      + 'mana cannot return it, and that is the biggest candidate here at pop 70,620; and '
      + 'Krark-Clan Ironworks reads "Sacrifice an ARTIFACT" where Ashnod’s Altar takes a '
      + 'creature, which is the Scrap Trawler family gone. Ten cards in the remaining '
      + 'rule-outs are still unread — Reassembling Skeleton, Forsaken Miner, Nether Traitor, '
      + 'Goblin Bombardment, Polyraptor, Altar of Dementia and the rest — so the colour '
      + 'argument is proven for one card and assumed for three. The largest card in the deck by combo count — 6,063 — and it kept nothing. Its top '
      + 'scored peers are four different kinds of card and only the free outlets are '
      + 'substitutable at all, which is the clearest case yet for taking peers off the card text.',
  },
  {
    subject: 'Camellia, the Seedmiser',
    cards: ['Camellia, the Seedmiser', 'Experimental Confectioner'],
    cardIds: [3868, 2590],
    read: {
      'Camellia, the Seedmiser': 'Menace. Other Squirrels you control have menace. Whenever you sacrifice one or more Foods, create a 1/1 green Squirrel creature token. {2}, Forage: Put a +1/+1 counter on each other Squirrel you control.',
      'Experimental Confectioner': 'When this creature enters, create a Food token. Whenever you sacrifice a Food, create a 1/1 black Rat creature token with \\u201cThis token can\\u2019t block.\\u201d',
      'Peregrin Took': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
      'Savvy Hunter': 'UNREAD — named in this pass reasoning but never fetched; the conclusion above is provisional on it',
    },
    date: '2026-08-02',
    method: 'her one scored peer, Experimental Confectioner, and every shape it has that she lacks',
    proposed: 37,
    examined: 37,
    kept: 0,
    ruledOut: [
      { reason: 'the loop spends more than one Food per cycle and needs that many creatures back. '
        + 'Camellia reads "whenever you sacrifice ONE OR MORE Foods" — one trigger per event, one '
        + 'Squirrel however many were spent — where Confectioner reads "whenever you sacrifice A '
        + 'Food" and triggers per Food. Peregrin Took spends three and Savvy Hunter spends two; '
        + 'both published step lists say so, and one Squirrel does not sustain either', count: 2 },
    ],
    notes: 'THE FIRST VERSION OF THIS ENTRY WAS WRONG, and the way it was wrong is the reason the '
      + 'log records reasons rather than verdicts. It said the two cards answer "a nontoken '
      + 'creature died" with different tokens — Food against Squirrel — and ruled out all 37 on '
      + 'that. Neither half was true: both trigger on *sacrificing a Food*, and Confectioner '
      + 'creates a Rat, not a Food. The text was asserted from memory instead of read, which is '
      + 'exactly the step the process says not to skip. Read properly, the difference is batching '
      + 'and only 2 of the 37 die to it. **35 candidates survive and are not yet written up** — '
      + 'kept is 0 because no row exists yet, not because nothing was found. They are two shapes: '
      + 'Sam, Loyal Attendant + Warren Soultrader + Academy Manufactor (pop 1,278), and Ygra, '
      + 'Eater of All + Ninja Pizza with 33 haste enablers behind it.',
  },
  {
    subject: 'Experimental Confectioner',
    cards: ['Experimental Confectioner', 'Camellia, the Seedmiser'],
    cardIds: [2590, 3868],
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
    cardIds: [1475, 4232, 4231],
    read: {
      'Cauldron Familiar': 'UNREAD — logged before the read-the-card rule; do not reason from this pass without fetching it',
      'Samwise Gamgee': 'UNREAD — logged before the read-the-card rule; do not reason from this pass without fetching it',
      'Academy Manufactor': 'UNREAD — logged before the read-the-card rule; do not reason from this pass without fetching it',
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
    },
    date: '2026-08-02',
    method: 'shapes the two counter-to-token peers are published in and Broodscale is not; the same search for Spike Feeder returned no peer at all',
    proposed: 148,
    examined: 12,
    kept: 0,
    ruledOut: [
      { reason: 'the Eldrazi Spawn is COLOURLESS where the Squirrel and the Beast are green. '
        + 'Ivy Lane Denizen reads "whenever another GREEN creature you control enters", so it '
        + 'never sees the Spawn — and Scurry Oak + Ivy Lane Denizen is the biggest candidate '
        + 'here at pop 28,108. Read against both cards', count: 1 },
      { reason: 'Scurry Oak has EVOLVE and Broodscale does not, so a loop that feeds the Oak its '
        + 'own counters from a bigger token has nothing to feed Broodscale. Coat of Arms '
        + '(pop 3,912) is that shape', count: 1 },
      { reason: 'the remaining 136 were not read. The peers are otherwise a near-exact match — '
        + 'same trigger, same "one or more" batching, same "you may" — so those survivors are '
        + 'plausible rather than dismissed, and this pass stopped instead of guessing' },
    ],
    notes: 'Spike Feeder has 83 published combos and NO peer at any threshold — the fourth card '
      + 'in this deck the method is simply silent about. Broodscale is the opposite: two '
      + 'near-twins and 148 candidates, and both that were read died on differences the card '
      + 'text makes obvious and a similarity score cannot see — the token colour and an evolve '
      + 'trigger. **kept: 0 is provisional on the 136 nobody read.** Clearing the UNREAD markers '
      + 'on Broodscale, Scurry Oak and Herd Baloth in the two older passes took the backlog '
      + '36 -> 30, which is what a debt entry is for.',
  },
];

// Every card any pass has covered, lowercased for lookup the way combos.js does it.
function sweptCards() {
  const out = new Map();
  for (const pass of PASSES) {
    (pass.cards || []).forEach((name, i) => {
      const key = String(name || '').split('/')[0].trim().toLowerCase();
      if (!out.has(key)) out.set(key, { name, id: (pass.cardIds || [])[i], passes: [] });
      out.get(key).passes.push(pass.subject);
    });
  }
  return out;
}

const totals = () => PASSES.reduce((a, p) => ({
  proposed: a.proposed + p.proposed,
  examined: a.examined + p.examined,
  kept: a.kept + p.kept,
}), { proposed: 0, examined: 0, kept: 0 });

module.exports = { PASSES, sweptCards, totals };
