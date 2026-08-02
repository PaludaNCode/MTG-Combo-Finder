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
