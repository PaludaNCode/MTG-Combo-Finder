// Combos this project believes in that Commander Spellbook has not published.
//
// Everything else on the page comes from Spellbook's variants file and is shown on
// their authority. This file is the exception, and it exists because their coverage
// has holes: two cards that do the same thing are not always written into the same
// combos, so a deck holding one of them is told about a line while a deck holding
// the other is told nothing.
//
// The holes are found two ways.
//
// Most of them by substitution. Take two cards that appear interchangeably across
// many published combos — Soul Warden and Essence Warden share 97.5% of theirs —
// and any combo that names one but not the other is a candidate. Most candidates
// are not gaps: the cards turn out to differ in a way that matters to that
// particular loop, and the audit in the README lists the 35 of 44 that were ruled
// out and why.
//
// The rest by reading a card that substitution could never have proposed. A card
// Spellbook has never used in a single combo has nothing to be measured against,
// so no amount of comparing the data will suggest it — the last four rows below
// are one such card, and they exist because its text was read against loops that
// are published with a card whose ability is worded the same way.
//
// Each row therefore carries its own evidence rather than asking to be taken on
// trust, and the page shows it: the published combo it was derived from, which card
// was swapped for which, and how far the checking actually went.
//
//   verified  the swap was checked against both cards' oracle text
//   derived   both halves of the swap are separately published, but the specific
//             pairing has not been read against the card text
//
// A row disappears from this file's output the moment Spellbook publishes the same
// card set — see matchUnofficial() in combos.js. That is deliberate: these should
// graduate rather than accumulate, and a duplicate on screen would be worse than
// no entry at all.
(function (global) {
  'use strict';

  const COMBOS = [
    // ---- verified against the card text --------------------------------------
    {
      cards: ['Quina, Qu Gourmet', 'Warren Soultrader', 'Academy Manufactor'],
      confidence: 'verified',
      from: {
        id: '3000-4231-5670',
        cards: ['Chatterfang, Squirrel General', 'Warren Soultrader', 'Academy Manufactor'],
      },
      swap: { out: 'Chatterfang, Squirrel General', in: 'Quina, Qu Gourmet' },
      // Not because the two cards are equivalent — they are not. Chatterfang adds
      // *that many* Squirrels to a token creation; Quina adds exactly one Frog,
      // however many tokens were made. It works here because this loop only ever
      // needs one creature back per turn of the cycle.
      why: 'Soultrader eats a Frog and makes a Treasure, Academy Manufactor turns that '
        + 'into a Clue, a Food and a Treasure, and Quina adds one Frog to that creation — '
        + 'which is exactly the Frog that was eaten. The artifacts accumulate; the Frog '
        + 'count never moves.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite card draw', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite Clue tokens', 'Infinite Food tokens', 'Infinite creature tokens',
        'Destroy all creatures opponents control',
        'Reduce the toughness of creatures opponents control to 0',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Archangel of Thune', 'Elas il-Kor, Sadistic Pilgrim'],
      confidence: 'verified',
      from: {
        id: '2919-4268-5641',
        cards: ['Basking Broodscale', 'Archangel of Thune', 'Kor Celebrant'],
      },
      swap: { out: 'Kor Celebrant', in: 'Elas il-Kor, Sadistic Pilgrim' },
      why: 'Broodscale’s counter makes an Eldrazi Spawn; the Spawn entering is another '
        + 'creature entering, which Elas il-Kor turns into a life gained, which Archangel '
        + 'of Thune turns back into a counter. Spellbook publishes this loop with 26 other '
        + 'lifegain-on-entry cards, including Soul Warden and Kor Celebrant, but not this one.',
      produces: [
        'Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain',
        'Infinite lifegain triggers', 'Infinite LTB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite colorless mana',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },

    {
      cards: ['Scurry Oak', 'Heroic Feast', 'Lunarch Veteran // Luminous Phantom'],
      confidence: 'verified',
      from: {
        id: '1939-3197-7743',
        cards: ['Herd Baloth', 'Heroic Feast', 'Lunarch Veteran // Luminous Phantom'],
      },
      swap: { out: 'Herd Baloth', in: 'Scurry Oak' },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this '
        + 'creature, create a token”, and this loop only needs the token to enter: '
        + 'Lunarch Veteran turns that into a life gained, and Heroic Feast turns the '
        + 'life into the next counter. Spellbook publishes Scurry Oak + Heroic Feast '
        + 'with 33 other lifegain-on-entry cards, and Lunarch Veteran is the one missing.',
      produces: [
        'Infinite +1/+1 counters on a creature', 'Infinite ETB', 'Infinite creature tokens',
        'Infinite lifegain', 'Infinite lifegain triggers',
      ],
    },

    // ---- one shape, six rows -------------------------------------------------
    //
    // Necrosynthesis gives the creature it enchants “whenever another creature dies,
    // put a +1/+1 counter on this creature”. Enchant a token maker with it and any
    // free sacrifice outlet closes the loop: the counter makes a token, the outlet
    // eats the token, the death puts on the next counter. Each of these three outlets
    // is free and can eat the token in question, which is all the loop asks of it.
    //
    // Spellbook publishes the same six with Sadistic Glee, and publishes both token
    // makers with Necrosynthesis for five other outlets — so both halves of every swap
    // are already there. Only the pairing is missing.
    {
      cards: ['Scurry Oak', 'Necrosynthesis', 'Viscera Seer'],
      confidence: 'verified',
      from: { id: '2082-2292-4186', cards: ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'] },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next '
        + 'counter. Read against all three cards.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite scry 1', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Scurry Oak', 'Necrosynthesis', 'Carrion Feeder'],
      confidence: 'verified',
      from: { id: '2082-2438-4186', cards: ['Scurry Oak', 'Sadistic Glee', 'Carrion Feeder'] },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next '
        + 'counter. Read against all three cards.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Scurry Oak', 'Necrosynthesis', 'Umbral Collar Zealot'],
      confidence: 'verified',
      from: { id: '2082-4186-6798', cards: ['Scurry Oak', 'Sadistic Glee', 'Umbral Collar Zealot'] },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next '
        + 'counter. Read against all three cards.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite +1/+1 counters on a creature', 'Infinite surveil',
      ],
    },
    {
      cards: ['Herd Baloth', 'Necrosynthesis', 'Viscera Seer'],
      confidence: 'verified',
      from: { id: '2082-2292-3197', cards: ['Herd Baloth', 'Sadistic Glee', 'Viscera Seer'] },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next '
        + 'counter. Read against all three cards.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite scry 1', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Herd Baloth', 'Necrosynthesis', 'Carrion Feeder'],
      confidence: 'verified',
      from: { id: '2082-2438-3197', cards: ['Herd Baloth', 'Sadistic Glee', 'Carrion Feeder'] },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next '
        + 'counter. Read against all three cards.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Herd Baloth', 'Necrosynthesis', 'Umbral Collar Zealot'],
      confidence: 'verified',
      from: { id: '2082-3197-6798', cards: ['Herd Baloth', 'Sadistic Glee', 'Umbral Collar Zealot'] },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next '
        + 'counter. Read against all three cards.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite +1/+1 counters on a creature', 'Infinite surveil',
      ],
    },
    // ---- Hammerhead, Maggia Boss: a card Spellbook has never used ------------
    //
    // Different in kind from every row above, and worth saying so. The rows above
    // are gaps *between* published combos — both cards in the swap appear in the
    // data, and only the pairing is missing. Hammerhead appears in none of the
    // 103,675 combos at all, so no amount of measuring the data would ever have
    // proposed him: there is nothing to compare him to. He is here because his
    // text was read.
    //
    // What the text says is that he is Umbral Collar Zealot's ability with a
    // different rider:
    //
    //   Umbral Collar Zealot   Sacrifice another creature or artifact: Surveil 1.
    //   Hammerhead             Sacrifice another creature or artifact: Put a
    //                          +1/+1 counter on Hammerhead.
    //
    // Word for word the same cost, free and repeatable, and in each loop below the
    // rider is not part of the loop. So every row cites the Zealot version as its
    // source and drops "Infinite surveil" from what it produces, replacing it with
    // the counters Hammerhead accrues — which is exactly the difference Spellbook
    // itself publishes between the Zealot and Carrion Feeder versions of the same
    // combos (856-5270-6798 against 856-2438-5270).
    //
    // "Sacrifice another creature **or artifact**" is why the fourth row exists.
    // Camellia's loop eats Foods rather than creatures, and Spellbook publishes it
    // with the Zealot and with no creature-only outlet — no Carrion Feeder version,
    // no Viscera Seer version. Hammerhead eats artifacts, so he belongs to that
    // loop and Carrion Feeder does not. The same reading that rules a card out of
    // one loop rules this one in.
    //
    // Not included: the Necrosynthesis versions of the first two. Those would be
    // two swaps deep — our own row with another swap on top — and every row here
    // is one swap from something published.
    {
      cards: ['Scurry Oak', 'Sadistic Glee', 'Hammerhead, Maggia Boss'],
      confidence: 'verified',
      from: { id: '2082-4186-6798', cards: ['Scurry Oak', 'Sadistic Glee', 'Umbral Collar Zealot'] },
      swap: { out: 'Umbral Collar Zealot', in: 'Hammerhead, Maggia Boss' },
      why: 'Sadistic Glee on Scurry Oak. Sacrifice the Squirrel to Hammerhead, the death '
        + 'puts a +1/+1 counter on Scurry Oak, and the counter makes the next Squirrel. '
        + 'Hammerhead\'s cost is the Zealot\'s cost word for word — free, repeatable, and '
        + 'a creature is what is being eaten either way.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Herd Baloth', 'Sadistic Glee', 'Hammerhead, Maggia Boss'],
      confidence: 'verified',
      from: { id: '2082-3197-6798', cards: ['Herd Baloth', 'Sadistic Glee', 'Umbral Collar Zealot'] },
      swap: { out: 'Umbral Collar Zealot', in: 'Hammerhead, Maggia Boss' },
      why: 'The same loop as the Scurry Oak row, with 4/4 Beasts instead of Squirrels: '
        + 'the counter makes a token, Hammerhead eats it, the death puts on the next '
        + 'counter.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Samwise Gamgee', 'Cauldron Familiar', 'Hammerhead, Maggia Boss'],
      confidence: 'verified',
      from: { id: '856-5270-6798', cards: ['Samwise Gamgee', 'Cauldron Familiar', 'Umbral Collar Zealot'] },
      swap: { out: 'Umbral Collar Zealot', in: 'Hammerhead, Maggia Boss' },
      why: 'The Cat enters and drains, Samwise makes a Food off it, Hammerhead eats the '
        + 'Cat, and the Food brings it back. The outlet only has to eat a creature for '
        + 'free, which is the half of Hammerhead that is identical to the Zealot.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite lifeloss', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Hammerhead, Maggia Boss'],
      confidence: 'verified',
      from: { id: '4321-5777-6798', cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Umbral Collar Zealot'] },
      swap: { out: 'Umbral Collar Zealot', in: 'Hammerhead, Maggia Boss' },
      why: 'Hammerhead eats a Food, Camellia makes a Squirrel for it, and Peregrin Took '
        + 'adds a Food to that creation — so the Food comes back and the Squirrels pile '
        + 'up. This is the loop that needs an outlet which eats *artifacts*: Spellbook '
        + 'publishes it with the Zealot and with no creature-only outlet at all, which '
        + 'is why Carrion Feeder and Viscera Seer are absent from it and Hammerhead is '
        + 'not.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite creature tokens', 'Infinite card draw',
        'Infinite draw triggers', 'Infinite Food tokens',
        'Infinite +1/+1 counters on a creature',
      ],
    },
  ];

  const api = { COMBOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.UnofficialCombos = api;
}(typeof self !== 'undefined' ? self : this));
