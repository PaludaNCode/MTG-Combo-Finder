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
// out and why, alongside the 15 of 51 thrown out by the later pass over the
// lifegain loops.
//
// The rest by reading a card that substitution could never have proposed. A card
// Spellbook has never used in a single combo has nothing to be measured against,
// so no amount of comparing the data will suggest it — it takes somebody reading
// the card and recognising a published one in it.
//
// Which is why this file has two halves. COMBOS is one row per combo, written by
// hand, for gaps that are one combo wide. STAND_INS is for the case where the
// answer is not a combo but a card: two cards with the same ability, one of them
// in a thousand published combos and the other in none. Writing that difference
// out by hand is not work anybody finishes, so the rule is declared once and
// standInRows() in combos.js works out the rows against the live data.
//
// Either way a row carries its own evidence rather than asking to be taken on
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
      swap: { out: 'Chatterfang, Squirrel General', in: 'Quina, Qu Gourmet', inId: 6705 },
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
      swap: { out: 'Kor Celebrant', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
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
      swap: { out: 'Herd Baloth', in: 'Scurry Oak', inId: 4186 },
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

    // ---- one shape, eight rows -----------------------------------------------
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
    //
    // Two more follow the six, and they are a step further out: Hammerhead standing
    // in for Carrion Feeder on top of our own swap. See the note above them.
    {
      cards: ['Scurry Oak', 'Necrosynthesis', 'Viscera Seer'],
      confidence: 'verified',
      from: { id: '2082-2292-4186', cards: ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'] },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
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
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
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
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
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
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
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
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
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
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next '
        + 'counter. Read against all three cards.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite +1/+1 counters on a creature', 'Infinite surveil',
      ],
    },
     // Two more that are two swaps deep, from the same six above. Necrosynthesis
    // for Sadistic Glee is our judgement; Hammerhead for Carrion Feeder is the
    // identity STAND_INS declares — one ability each, the same sentence. The rule
    // itself will not produce these, because it reads published combos only, so
    // they are written out with both steps named.
    {
      cards: ['Scurry Oak', 'Necrosynthesis', 'Hammerhead, Maggia Boss'],
      confidence: 'verified',
      from: { id: '2082-2438-4186', cards: ['Scurry Oak', 'Sadistic Glee', 'Carrion Feeder'] },
      swaps: [
        { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
        { out: 'Carrion Feeder', in: 'Hammerhead, Maggia Boss', inId: null },
      ],
      why: 'The counter makes a Squirrel, Hammerhead eats it for free, and the death puts '
        + 'on the next counter. He eats creatures on the same terms Carrion Feeder does — '
        + 'the same sentence, one card less restrictive — and takes a +1/+1 counter of his '
        + 'own each time.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Herd Baloth', 'Necrosynthesis', 'Hammerhead, Maggia Boss'],
      confidence: 'verified',
      from: { id: '2082-2438-3197', cards: ['Herd Baloth', 'Sadistic Glee', 'Carrion Feeder'] },
      swaps: [
        { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
        { out: 'Carrion Feeder', in: 'Hammerhead, Maggia Boss', inId: null },
      ],
      why: 'The same loop as the Scurry Oak row, with 4/4 Beasts instead of Squirrels: the '
        + 'counter makes a token, Hammerhead eats it, the death puts on the next counter.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite +1/+1 counters on a creature',
      ],
    },

    // ---- one shape, sixteen rows ---------------------------------------------
    //
    // Kitchen Finks gains 2 life when it enters and has persist, so a free
    // sacrifice outlet turns it into a loop as soon as something puts a +1/+1
    // counter on it: the counter cancels the -1/-1 persist left behind, and the
    // Finks can die again.
    //
    // Spellbook publishes exactly that loop across fifteen free outlets, four
    // times over — once each for Archangel of Thune, Heliod, Sun-Crowned, Cleric
    // Class and The Destined White Mage, all of which turn the 2 life into the
    // counter. Heroic Feast does the same job:
    //
    //   Archangel of Thune  Whenever you gain life, put a +1/+1 counter on each
    //                       creature you control.
    //   Heroic Feast        Whenever you gain life, choose up to that many target
    //                       creatures you control. Put a +1/+1 counter on each.
    //
    // Two life gained is two targets, and the loop needs one. Spellbook already
    // treats the two cards as interchangeable — 152 of Heroic Feast's 167
    // published combos are card sets Archangel of Thune also appears in — and
    // this is the shape where it did not: nought Kitchen Finks combos against
    // fifteen apiece for the other four.
    //
    // They are not equivalent, which is why these are written out one at a time
    // rather than declared as a stand-in rule. Archangel counters *every* creature
    // you control; Heroic Feast counters up to as many as you gained life, and
    // has to target. Here that difference costs nothing. Elsewhere it would, and
    // a rule would have generated 347 rows without knowing where.
    //
    // What it does cost is one result, and only on five of the rows. Every source
    // combo claims "Infinite +1/+1 counters on creatures you control", which is
    // Archangel's wording — a counter on *each* creature, every iteration. Heroic
    // Feast does not do that, so the line changes rather than survives.
    //
    // Two life is two targets, not two counters on one creature: "choose up to
    // that many target creatures you control. Put a +1/+1 counter on each of
    // them." The targets have to be different objects, so one goes on the Finks
    // to cancel persist and the second goes anywhere else. Which means the loop
    // grows something for good whenever a second creature is on the battlefield —
    // and for ten of these fifteen the outlet *is* a creature, so the three cards
    // guarantee it between them. Those ten claim "Infinite +1/+1 counters on a
    // creature": singular, because it is one creature rather than all of them.
    //
    // The five whose outlet is not a creature — Altar of Dementia, Ashnod's Altar,
    // Blasting Station, Goblin Bombardment, Phyrexian Altar — leave the Finks as
    // the only creature the three cards promise, so the second target has nothing
    // to land on and those rows claim no counters at all.
    //
    // Phantom Train is counted among the ten on purpose: it is a Vehicle rather
    // than a creature, but its own ability turns it into one for the turn as it
    // eats, and it puts the counter on itself anyway.
    {
      cards: [
        'Kitchen Finks', 'Heroic Feast', 'Altar of Dementia',
      ],
      confidence: 'verified',
      from: {
        id: '2086-2919-5256',
        cards: [
          'Kitchen Finks', 'Archangel of Thune', 'Altar of Dementia',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Altar of Dementia eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite mill', 'Infinite self-mill',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Ashnod\'s Altar', 'Heroic Feast',
      ],
      confidence: 'verified',
      from: {
        id: '2034-2086-2919',
        cards: [
          'Kitchen Finks', 'Ashnod\'s Altar', 'Archangel of Thune',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Ashnod\'s Altar eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite colorless mana',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Heroic Feast', 'Bartolomé del Presidio',
      ],
      confidence: 'verified',
      from: {
        id: '2086-2919-2921',
        cards: [
          'Kitchen Finks', 'Archangel of Thune', 'Bartolomé del Presidio',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Bartolomé del Presidio eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Blasting Station', 'Heroic Feast',
      ],
      confidence: 'verified',
      from: {
        id: '413-2086-2919',
        cards: [
          'Kitchen Finks', 'Blasting Station', 'Archangel of Thune',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Blasting Station eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite damage',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Heroic Feast', 'Bloodflow Connoisseur',
      ],
      confidence: 'verified',
      from: {
        id: '2086-2511-2919',
        cards: [
          'Kitchen Finks', 'Archangel of Thune', 'Bloodflow Connoisseur',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Bloodflow Connoisseur eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Heroic Feast', 'Carrion Feeder',
      ],
      confidence: 'verified',
      from: {
        id: '2086-2438-2919',
        cards: [
          'Kitchen Finks', 'Archangel of Thune', 'Carrion Feeder',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Carrion Feeder eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Heroic Feast', 'Goblin Bombardment',
      ],
      confidence: 'verified',
      from: {
        id: '2086-2919-5147',
        cards: [
          'Kitchen Finks', 'Archangel of Thune', 'Goblin Bombardment',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Goblin Bombardment eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite damage',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Heroic Feast', 'Phantom Train',
      ],
      confidence: 'verified',
      from: {
        id: '2086-2919-6797',
        cards: [
          'Kitchen Finks', 'Archangel of Thune', 'Phantom Train',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Phantom Train eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Heroic Feast', 'Phyrexian Altar',
      ],
      confidence: 'verified',
      from: {
        id: '2086-2919-4050',
        cards: [
          'Kitchen Finks', 'Archangel of Thune', 'Phyrexian Altar',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Phyrexian Altar eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite colored mana',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Heroic Feast', 'Shilgengar, Sire of Famine',
      ],
      confidence: 'verified',
      from: {
        id: '2086-2919-5686',
        cards: [
          'Kitchen Finks', 'Archangel of Thune', 'Shilgengar, Sire of Famine',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Shilgengar, Sire of Famine eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite Blood tokens',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Heroic Feast', 'Thermopod',
      ],
      confidence: 'verified',
      from: {
        id: '2086-2919-5231',
        cards: [
          'Kitchen Finks', 'Archangel of Thune', 'Thermopod',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Thermopod eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite red mana',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Heroic Feast', 'Umbral Collar Zealot',
      ],
      confidence: 'verified',
      from: {
        id: '2086-2919-6798',
        cards: [
          'Kitchen Finks', 'Archangel of Thune', 'Umbral Collar Zealot',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Umbral Collar Zealot eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite surveil',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Viscera Seer', 'Heroic Feast',
      ],
      confidence: 'verified',
      from: {
        id: '2086-2292-2919',
        cards: [
          'Kitchen Finks', 'Viscera Seer', 'Archangel of Thune',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Viscera Seer eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite scry 1',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Woe Strider', 'Heroic Feast',
      ],
      confidence: 'verified',
      from: {
        id: '997-2086-2919',
        cards: [
          'Kitchen Finks', 'Woe Strider', 'Archangel of Thune',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Woe Strider eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite scry 1',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: [
        'Kitchen Finks', 'Heroic Feast', 'Yahenni, Undying Partisan',
      ],
      confidence: 'verified',
      from: {
        id: '2086-2919-3967',
        cards: [
          'Kitchen Finks', 'Archangel of Thune', 'Yahenni, Undying Partisan',
        ],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Yahenni, Undying Partisan eats the Finks for free; persist returns it with a -1/-1 '
        + 'counter, its entry gains 2 life, and Heroic Feast spends one of those two '
        + 'targets putting a +1/+1 counter back on it. The two counters cancel, so the '
        + 'Finks can persist again.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    // The one row that is two swaps deep.
    //
    // Every other row in this file is one step from something Spellbook
    // published, and that rule is what keeps the evidence checkable. This one
    // takes a second step, and it is allowed because the two steps are not the
    // same kind of claim. Heroic Feast for Archangel of Thune is a judgement
    // about two cards that do the same job here — the fifteen rows above are
    // that judgement. Hammerhead for Bartolome del Presidio is not a judgement
    // at all: the two cards have one ability each and it is the same sentence,
    // which is why STAND_INS declares it once for 1,889 combos.
    //
    // Chaining an identity onto a judgement leaves exactly the risk the
    // judgement already carried. Chaining two judgements would not, and the page
    // shows both steps rather than presenting this as one swap.
    {
      cards: ['Kitchen Finks', 'Heroic Feast', 'Hammerhead, Maggia Boss'],
      confidence: 'verified',
      from: {
        id: '2086-2919-2921',
        cards: ['Kitchen Finks', 'Archangel of Thune', 'Bartolomé del Presidio'],
      },
      swaps: [
        { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
        { out: 'Bartolomé del Presidio', in: 'Hammerhead, Maggia Boss', inId: null },
      ],
      why: 'Hammerhead eats the Finks for free; persist returns it with a -1/-1 counter, '
        + 'its entry gains 2 life, and Heroic Feast spends one of those two targets putting '
        + 'a +1/+1 counter back on it, so it can persist again. Hammerhead is Bartolomé del '
        + 'Presidio\'s ability word for word — and mono-black rather than white-black, which '
        + 'is the only difference this loop can see.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite +1/+1 counters on a creature',
      ],
    },

    // ---- one loop, twenty-seven gainers, nine holes ---------------------------
    //
    // A creature entering gains you life, the life puts a +1/+1 counter on a
    // creature, the counter makes a token, and the token entering is the next
    // creature. Scurry Oak, Herd Baloth and Basking Broodscale each make the token;
    // Archangel of Thune, Heliod, Sun-Crowned and Heroic Feast each turn the life
    // into the counter; and some 27 published cards turn the token back into the life.
    //
    // Three makers times three payoffs times the nine of those gainers this deck
    // holds is 81 combinations, and 11 of them are missing from the data while
    // their siblings are in it. Two are already in this file. These are the nine.
    //
    // That is the shape of a gap rather than a judgement, because the card being
    // swapped in is the card being swapped out with a rider on it. Every one of
    // them reads "whenever another creature you control enters, you gain 1 life" —
    // Hinterland Sanctifier's sentence, which the published row already trusts —
    // and then adds deathtouch, or disturb, or a Spider clause, or a drain on
    // death, none of which this loop ever asks about.
    {
      cards: ['Scurry Oak', 'Archangel of Thune', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '2919-4186-6097',
        cards: ['Archangel of Thune', 'Scurry Oak', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Archangel of Thune puts a +1/+1 counter on Scurry Oak, the counter makes a 1/1 '
        + 'Squirrel, and the token entering is another creature entering — which Virulent '
        + 'Emissary turns into a life gained, and the life into the next counter. Virulent '
        + 'Emissary’s trigger is Hinterland Sanctifier’s sentence word for word — “whenever '
        + 'another creature you control enters, you gain 1 life” — with deathtouch as its only '
        + 'rider, and green where the Sanctifier is white, so nothing in the loop can tell the '
        + 'two apart. Spellbook publishes Archangel of Thune and Scurry Oak with 27 other cards '
        + 'that turn the token entering into life, and leaves this one out.',
      produces: [
        'Infinite ETB', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Scurry Oak', 'Heliod, Sun-Crowned', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '1274-4186-6097',
        cards: ['Heliod, Sun-Crowned', 'Scurry Oak', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Heliod, Sun-Crowned puts a +1/+1 counter on Scurry Oak, the counter makes a 1/1 '
        + 'Squirrel, and the token entering is another creature entering — which Virulent '
        + 'Emissary turns into a life gained, and the life into the next counter. Virulent '
        + 'Emissary’s trigger is Hinterland Sanctifier’s sentence word for word — “whenever '
        + 'another creature you control enters, you gain 1 life” — with deathtouch as its only '
        + 'rider, and green where the Sanctifier is white, so nothing in the loop can tell the '
        + 'two apart. Spellbook publishes Heliod, Sun-Crowned and Scurry Oak with 27 other '
        + 'cards that turn the token entering into life, and leaves this one out.',
      produces: [
        'Infinite ETB', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Herd Baloth', 'Archangel of Thune', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '2919-3197-6097',
        cards: ['Archangel of Thune', 'Herd Baloth', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Archangel of Thune puts a +1/+1 counter on Herd Baloth, the counter makes a 4/4 '
        + 'Beast, and the token entering is another creature entering — which Virulent Emissary '
        + 'turns into a life gained, and the life into the next counter. Virulent Emissary’s '
        + 'trigger is Hinterland Sanctifier’s sentence word for word — “whenever another '
        + 'creature you control enters, you gain 1 life” — with deathtouch as its only rider, '
        + 'and green where the Sanctifier is white, so nothing in the loop can tell the two '
        + 'apart. Spellbook publishes Archangel of Thune and Herd Baloth with 27 other cards '
        + 'that turn the token entering into life, and leaves this one out.',
      produces: [
        'Infinite ETB', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Herd Baloth', 'Heliod, Sun-Crowned', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '1274-3197-6097',
        cards: ['Heliod, Sun-Crowned', 'Herd Baloth', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Heliod, Sun-Crowned puts a +1/+1 counter on Herd Baloth, the counter makes a 4/4 '
        + 'Beast, and the token entering is another creature entering — which Virulent Emissary '
        + 'turns into a life gained, and the life into the next counter. Virulent Emissary’s '
        + 'trigger is Hinterland Sanctifier’s sentence word for word — “whenever another '
        + 'creature you control enters, you gain 1 life” — with deathtouch as its only rider, '
        + 'and green where the Sanctifier is white, so nothing in the loop can tell the two '
        + 'apart. Spellbook publishes Heliod, Sun-Crowned and Herd Baloth with 27 other cards '
        + 'that turn the token entering into life, and leaves this one out.',
      produces: [
        'Infinite ETB', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Archangel of Thune', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '2919-5641-6097',
        cards: ['Basking Broodscale', 'Archangel of Thune', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Archangel of Thune puts a +1/+1 counter on Basking Broodscale, the counter makes an '
        + 'Eldrazi Spawn, and the token entering is another creature entering — which Virulent '
        + 'Emissary turns into a life gained, and the life into the next counter. Virulent '
        + 'Emissary’s trigger is Hinterland Sanctifier’s sentence word for word — “whenever '
        + 'another creature you control enters, you gain 1 life” — with deathtouch as its only '
        + 'rider, and green where the Sanctifier is white, so nothing in the loop can tell the '
        + 'two apart. Spellbook publishes Archangel of Thune and Basking Broodscale with 26 '
        + 'other cards that turn the token entering into life, and leaves this one out.',
      produces: [
        'Infinite ETB', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite LTB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite colorless mana',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Archangel of Thune', 'Aunt May'],
      confidence: 'verified',
      from: {
        id: '2919-5641-6097',
        cards: ['Basking Broodscale', 'Archangel of Thune', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Aunt May', inId: 6823 },
      why: 'Archangel of Thune puts a +1/+1 counter on Basking Broodscale, the counter makes an '
        + 'Eldrazi Spawn, and the token entering is another creature entering — which Aunt May '
        + 'turns into a life gained, and the life into the next counter. Aunt May’s trigger is '
        + 'Hinterland Sanctifier’s sentence word for word, plus a rider that reads only Spiders '
        + 'and never fires here, so nothing in the loop can tell the two apart. Spellbook '
        + 'publishes Archangel of Thune and Basking Broodscale with 26 other cards that turn '
        + 'the token entering into life, and leaves this one out.',
      produces: [
        'Infinite ETB', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite LTB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite colorless mana',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Heliod, Sun-Crowned', 'Lunarch Veteran // Luminous Phantom'],
      confidence: 'verified',
      from: {
        id: '1274-5641-6097',
        cards: ['Basking Broodscale', 'Heliod, Sun-Crowned', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Lunarch Veteran // Luminous Phantom', inId: 1939 },
      why: 'Heliod, Sun-Crowned puts a +1/+1 counter on Basking Broodscale, the counter makes an '
        + 'Eldrazi Spawn, and the token entering is another creature entering — which Lunarch '
        + 'Veteran turns into a life gained, and the life into the next counter. Lunarch '
        + 'Veteran’s trigger is Hinterland Sanctifier’s sentence word for word, with disturb as '
        + 'its only rider, so nothing in the loop can tell the two apart. Spellbook publishes '
        + 'Heliod, Sun-Crowned and Basking Broodscale with 25 other cards that turn the token '
        + 'entering into life, and leaves this one out.',
      produces: [
        'Infinite ETB', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite +1/+1 counters on a creature', 'Infinite LTB',
        'Infinite sacrifice triggers', 'Infinite death triggers', 'Infinite colorless mana',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Heliod, Sun-Crowned', 'Elas il-Kor, Sadistic Pilgrim'],
      confidence: 'verified',
      from: {
        id: '1274-5641-6097',
        cards: ['Basking Broodscale', 'Heliod, Sun-Crowned', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Heliod, Sun-Crowned puts a +1/+1 counter on Basking Broodscale, the counter makes an '
        + 'Eldrazi Spawn, and the token entering is another creature entering — which Elas '
        + 'il-Kor, Sadistic Pilgrim turns into a life gained, and the life into the next '
        + 'counter. Elas il-Kor gains the life on exactly the Sanctifier’s terms — “whenever '
        + 'another creature you control enters, you gain 1 life” — and adds deathtouch and a '
        + 'drain on death, so nothing in the loop can tell the two apart. Spellbook publishes '
        + 'Heliod, Sun-Crowned and Basking Broodscale with 25 other cards that turn the token '
        + 'entering into life, and leaves this one out.',
      produces: [
        'Infinite ETB', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite +1/+1 counters on a creature', 'Infinite LTB',
        'Infinite sacrifice triggers', 'Infinite death triggers', 'Infinite colorless mana',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Heliod, Sun-Crowned', 'Aunt May'],
      confidence: 'verified',
      from: {
        id: '1274-5641-6097',
        cards: ['Basking Broodscale', 'Heliod, Sun-Crowned', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Aunt May', inId: 6823 },
      why: 'Heliod, Sun-Crowned puts a +1/+1 counter on Basking Broodscale, the counter makes an '
        + 'Eldrazi Spawn, and the token entering is another creature entering — which Aunt May '
        + 'turns into a life gained, and the life into the next counter. Aunt May’s trigger is '
        + 'Hinterland Sanctifier’s sentence word for word, plus a rider that reads only Spiders '
        + 'and never fires here, so nothing in the loop can tell the two apart. Spellbook '
        + 'publishes Heliod, Sun-Crowned and Basking Broodscale with 25 other cards that turn '
        + 'the token entering into life, and leaves this one out.',
      produces: [
        'Infinite ETB', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite +1/+1 counters on a creature', 'Infinite LTB',
        'Infinite sacrifice triggers', 'Infinite death triggers', 'Infinite colorless mana',
      ],
    },
    // ---- Animation Module, and the altar nobody wrote down: eleven rows -------
    //
    // The same trade in a different loop. Animation Module reads "whenever one or
    // more +1/+1 counters are put on a permanent you control, you may pay {1}. If
    // you do, create a 1/1 colorless Servo artifact creature token", so a card that
    // turns life into a counter and a card that turns a creature entering into life
    // close a circle around it, and an altar eats each Servo to pay for the next.
    //
    // Spellbook publishes that loop 31 times over with Archangel of Thune, 30 with
    // Heliod, Sun-Crowned, and 25 with Heroic Feast — but every Heroic Feast row
    // uses Phyrexian Altar. With Ashnod's Altar there are none at all, for any of
    // the cards that can gain the life, which is the hole the first seven rows fill.
    //
    // Ashnod's Altar is the freer of the two altars here: {C}{C} a Servo against a
    // cost of {1}, where Phyrexian Altar makes one coloured mana and the loop breaks
    // even. So these rows carry a line the Phyrexian Altar rows cannot — infinite
    // colorless mana — and it is the same line every published Ashnod's Altar
    // version of the loop already claims.
    {
      cards: ['Animation Module', 'Ashnod\'s Altar', 'Heroic Feast', 'Hinterland Sanctifier'],
      confidence: 'verified',
      from: {
        id: '3490-4050-6097-7743',
        cards: ['Animation Module', 'Phyrexian Altar', 'Hinterland Sanctifier', 'Heroic Feast'],
      },
      swap: { out: 'Phyrexian Altar', in: 'Ashnod\'s Altar', inId: 2034 },
      why: 'Animation Module turns a +1/+1 counter into a Servo for {1}, the Servo entering '
        + 'gains 1 life off Hinterland Sanctifier, and Heroic Feast spends that life on one '
        + 'target — which is the next counter. The altar is there to eat the Servo and pay for '
        + 'the next one, and that is the whole of the swap: Ashnod’s Altar makes {C}{C} where '
        + 'Phyrexian Altar makes one coloured mana, against a cost of {1} either way. Spellbook '
        + 'publishes the Phyrexian Altar version of this loop for 25 cards that turn it into '
        + 'life and the Ashnod’s Altar version for none of them — while publishing Ashnod’s '
        + 'Altar in the same loop 31 times over with Archangel of Thune in Heroic Feast’s '
        + 'place. The spare mana is the one line this row adds: two made against one spent is '
        + 'infinite colorless mana, which every published Ashnod’s Altar version of the loop '
        + 'claims too.',
      produces: [
        'Infinite +1/+1 counters on creatures you control', 'Infinite ETB', 'Infinite LTB',
        'Infinite death triggers', 'Infinite lifegain', 'Infinite lifegain triggers',
        'Infinite sacrifice triggers', 'Infinite colorless mana',
      ],
    },
    {
      cards: ['Animation Module', 'Ashnod\'s Altar', 'Heroic Feast', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '3490-4050-7173-7743',
        cards: ['Animation Module', 'Phyrexian Altar', 'Virulent Emissary', 'Heroic Feast'],
      },
      swap: { out: 'Phyrexian Altar', in: 'Ashnod\'s Altar', inId: 2034 },
      why: 'Animation Module turns a +1/+1 counter into a Servo for {1}, the Servo entering '
        + 'gains 1 life off Virulent Emissary, and Heroic Feast spends that life on one target '
        + '— which is the next counter. The altar is there to eat the Servo and pay for the '
        + 'next one, and that is the whole of the swap: Ashnod’s Altar makes {C}{C} where '
        + 'Phyrexian Altar makes one coloured mana, against a cost of {1} either way. Spellbook '
        + 'publishes the Phyrexian Altar version of this loop for 25 cards that turn it into '
        + 'life and the Ashnod’s Altar version for none of them — while publishing Ashnod’s '
        + 'Altar in the same loop 31 times over with Archangel of Thune in Heroic Feast’s '
        + 'place. The spare mana is the one line this row adds: two made against one spent is '
        + 'infinite colorless mana, which every published Ashnod’s Altar version of the loop '
        + 'claims too.',
      produces: [
        'Infinite +1/+1 counters on creatures you control', 'Infinite ETB', 'Infinite LTB',
        'Infinite death triggers', 'Infinite lifegain', 'Infinite lifegain triggers',
        'Infinite sacrifice triggers', 'Infinite colorless mana',
      ],
    },
    {
      cards: ['Animation Module', 'Ashnod\'s Altar', 'Heroic Feast', 'Aunt May'],
      confidence: 'verified',
      from: {
        id: '3490-4050-6823-7743',
        cards: ['Animation Module', 'Phyrexian Altar', 'Aunt May', 'Heroic Feast'],
      },
      swap: { out: 'Phyrexian Altar', in: 'Ashnod\'s Altar', inId: 2034 },
      why: 'Animation Module turns a +1/+1 counter into a Servo for {1}, the Servo entering '
        + 'gains 1 life off Aunt May, and Heroic Feast spends that life on one target — which '
        + 'is the next counter. The altar is there to eat the Servo and pay for the next one, '
        + 'and that is the whole of the swap: Ashnod’s Altar makes {C}{C} where Phyrexian Altar '
        + 'makes one coloured mana, against a cost of {1} either way. Spellbook publishes the '
        + 'Phyrexian Altar version of this loop for 25 cards that turn it into life and the '
        + 'Ashnod’s Altar version for none of them — while publishing Ashnod’s Altar in the '
        + 'same loop 31 times over with Archangel of Thune in Heroic Feast’s place. The spare '
        + 'mana is the one line this row adds: two made against one spent is infinite colorless '
        + 'mana, which every published Ashnod’s Altar version of the loop claims too.',
      produces: [
        'Infinite +1/+1 counters on creatures you control', 'Infinite ETB', 'Infinite LTB',
        'Infinite death triggers', 'Infinite lifegain', 'Infinite lifegain triggers',
        'Infinite sacrifice triggers', 'Infinite colorless mana',
      ],
    },
    {
      cards: ['Animation Module', 'Ashnod\'s Altar', 'Heroic Feast', 'Prosperous Innkeeper'],
      confidence: 'verified',
      from: {
        id: '3490-4050-4716-7743',
        cards: ['Animation Module', 'Phyrexian Altar', 'Prosperous Innkeeper', 'Heroic Feast'],
      },
      swap: { out: 'Phyrexian Altar', in: 'Ashnod\'s Altar', inId: 2034 },
      why: 'Animation Module turns a +1/+1 counter into a Servo for {1}, the Servo entering '
        + 'gains 1 life off Prosperous Innkeeper, and Heroic Feast spends that life on one '
        + 'target — which is the next counter. The altar is there to eat the Servo and pay for '
        + 'the next one, and that is the whole of the swap: Ashnod’s Altar makes {C}{C} where '
        + 'Phyrexian Altar makes one coloured mana, against a cost of {1} either way. Spellbook '
        + 'publishes the Phyrexian Altar version of this loop for 25 cards that turn it into '
        + 'life and the Ashnod’s Altar version for none of them — while publishing Ashnod’s '
        + 'Altar in the same loop 31 times over with Archangel of Thune in Heroic Feast’s '
        + 'place. The spare mana is the one line this row adds: two made against one spent is '
        + 'infinite colorless mana, which every published Ashnod’s Altar version of the loop '
        + 'claims too.',
      produces: [
        'Infinite +1/+1 counters on creatures you control', 'Infinite ETB', 'Infinite LTB',
        'Infinite death triggers', 'Infinite lifegain', 'Infinite lifegain triggers',
        'Infinite sacrifice triggers', 'Infinite colorless mana',
      ],
    },
    {
      cards: ['Animation Module', 'Ashnod\'s Altar', 'Heroic Feast', 'Soul Warden'],
      confidence: 'verified',
      from: {
        id: '360-3490-4050-7743',
        cards: ['Animation Module', 'Soul Warden', 'Phyrexian Altar', 'Heroic Feast'],
      },
      swap: { out: 'Phyrexian Altar', in: 'Ashnod\'s Altar', inId: 2034 },
      why: 'Animation Module turns a +1/+1 counter into a Servo for {1}, the Servo entering '
        + 'gains 1 life off Soul Warden, and Heroic Feast spends that life on one target — '
        + 'which is the next counter. The altar is there to eat the Servo and pay for the next '
        + 'one, and that is the whole of the swap: Ashnod’s Altar makes {C}{C} where Phyrexian '
        + 'Altar makes one coloured mana, against a cost of {1} either way. Spellbook publishes '
        + 'the Phyrexian Altar version of this loop for 25 cards that turn it into life and the '
        + 'Ashnod’s Altar version for none of them — while publishing Ashnod’s Altar in the '
        + 'same loop 31 times over with Archangel of Thune in Heroic Feast’s place. The spare '
        + 'mana is the one line this row adds: two made against one spent is infinite colorless '
        + 'mana, which every published Ashnod’s Altar version of the loop claims too.',
      produces: [
        'Infinite +1/+1 counters on creatures you control', 'Infinite ETB', 'Infinite LTB',
        'Infinite death triggers', 'Infinite lifegain', 'Infinite lifegain triggers',
        'Infinite sacrifice triggers', 'Infinite colorless mana',
      ],
    },
    {
      cards: ['Animation Module', 'Ashnod\'s Altar', 'Heroic Feast', 'Essence Warden'],
      confidence: 'verified',
      from: {
        id: '2741-3490-4050-7743',
        cards: ['Animation Module', 'Essence Warden', 'Phyrexian Altar', 'Heroic Feast'],
      },
      swap: { out: 'Phyrexian Altar', in: 'Ashnod\'s Altar', inId: 2034 },
      why: 'Animation Module turns a +1/+1 counter into a Servo for {1}, the Servo entering '
        + 'gains 1 life off Essence Warden, and Heroic Feast spends that life on one target — '
        + 'which is the next counter. The altar is there to eat the Servo and pay for the next '
        + 'one, and that is the whole of the swap: Ashnod’s Altar makes {C}{C} where Phyrexian '
        + 'Altar makes one coloured mana, against a cost of {1} either way. Spellbook publishes '
        + 'the Phyrexian Altar version of this loop for 25 cards that turn it into life and the '
        + 'Ashnod’s Altar version for none of them — while publishing Ashnod’s Altar in the '
        + 'same loop 31 times over with Archangel of Thune in Heroic Feast’s place. The spare '
        + 'mana is the one line this row adds: two made against one spent is infinite colorless '
        + 'mana, which every published Ashnod’s Altar version of the loop claims too.',
      produces: [
        'Infinite +1/+1 counters on creatures you control', 'Infinite ETB', 'Infinite LTB',
        'Infinite death triggers', 'Infinite lifegain', 'Infinite lifegain triggers',
        'Infinite sacrifice triggers', 'Infinite colorless mana',
      ],
    },
    {
      cards: ['Animation Module', 'Ashnod\'s Altar', 'Heroic Feast', 'Case of the Uneaten Feast'],
      confidence: 'verified',
      from: {
        id: '3490-4050-6720-7743',
        cards: ['Animation Module', 'Phyrexian Altar', 'Case of the Uneaten Feast', 'Heroic Feast'],
      },
      swap: { out: 'Phyrexian Altar', in: 'Ashnod\'s Altar', inId: 2034 },
      why: 'Animation Module turns a +1/+1 counter into a Servo for {1}, the Servo entering '
        + 'gains 1 life off Case of the Uneaten Feast, and Heroic Feast spends that life on one '
        + 'target — which is the next counter. The altar is there to eat the Servo and pay for '
        + 'the next one, and that is the whole of the swap: Ashnod’s Altar makes {C}{C} where '
        + 'Phyrexian Altar makes one coloured mana, against a cost of {1} either way. Spellbook '
        + 'publishes the Phyrexian Altar version of this loop for 25 cards that turn it into '
        + 'life and the Ashnod’s Altar version for none of them — while publishing Ashnod’s '
        + 'Altar in the same loop 31 times over with Archangel of Thune in Heroic Feast’s '
        + 'place. The spare mana is the one line this row adds: two made against one spent is '
        + 'infinite colorless mana, which every published Ashnod’s Altar version of the loop '
        + 'claims too.',
      produces: [
        'Infinite +1/+1 counters on creatures you control', 'Infinite ETB', 'Infinite LTB',
        'Infinite death triggers', 'Infinite lifegain', 'Infinite lifegain triggers',
        'Infinite sacrifice triggers', 'Infinite colorless mana',
      ],
    },
    // The four that go the other way: Heroic Feast in Archangel of Thune's place,
    // for the two lifegain-on-entry cards Spellbook's Heroic Feast rows skip.
    {
      cards: ['Animation Module', 'Ashnod\'s Altar', 'Heroic Feast', 'Elas il-Kor, Sadistic Pilgrim'],
      confidence: 'verified',
      from: {
        id: '2034-2811-2919-3490',
        cards: ['Animation Module', 'Ashnod\'s Altar', 'Elas il-Kor, Sadistic Pilgrim', 'Archangel of Thune'],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Animation Module turns a +1/+1 counter into a Servo for {1}, Ashnod\'s Altar eats the '
        + 'Servo to pay for the next one, and Elas il-Kor, Sadistic Pilgrim gains 1 life every '
        + 'time one enters. Heroic Feast does Archangel of Thune’s job here: one life gained is '
        + 'one target, and one counter on any permanent you control is all Animation Module '
        + 'asks for. Spellbook publishes the Heroic Feast version of this loop, with Phyrexian '
        + 'Altar, for 25 cards that turn it into life — and Elas il-Kor, Sadistic Pilgrim is '
        + 'not one of them.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite colorless mana', 'Infinite lifegain triggers',
        'Infinite lifegain', 'Infinite lifeloss',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Animation Module', 'Ashnod\'s Altar', 'Heroic Feast', 'Lunarch Veteran // Luminous Phantom'],
      confidence: 'verified',
      from: {
        id: '1939-2034-2919-3490',
        cards: ['Animation Module', 'Ashnod\'s Altar', 'Archangel of Thune', 'Lunarch Veteran // Luminous Phantom'],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Animation Module turns a +1/+1 counter into a Servo for {1}, Ashnod\'s Altar eats the '
        + 'Servo to pay for the next one, and Lunarch Veteran gains 1 life every time one '
        + 'enters. Heroic Feast does Archangel of Thune’s job here: one life gained is one '
        + 'target, and one counter on any permanent you control is all Animation Module asks '
        + 'for. Spellbook publishes the Heroic Feast version of this loop, with Phyrexian '
        + 'Altar, for 25 cards that turn it into life — and Lunarch Veteran is not one of them.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite colorless mana', 'Infinite lifegain triggers',
        'Infinite lifegain', 'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Animation Module', 'Phyrexian Altar', 'Heroic Feast', 'Elas il-Kor, Sadistic Pilgrim'],
      confidence: 'verified',
      from: {
        id: '2811-2919-3490-4050',
        cards: ['Animation Module', 'Elas il-Kor, Sadistic Pilgrim', 'Archangel of Thune', 'Phyrexian Altar'],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Animation Module turns a +1/+1 counter into a Servo for {1}, Phyrexian Altar eats '
        + 'the Servo to pay for the next one, and Elas il-Kor, Sadistic Pilgrim gains 1 life '
        + 'every time one enters. Heroic Feast does Archangel of Thune’s job here: one life '
        + 'gained is one target, and one counter on any permanent you control is all Animation '
        + 'Module asks for. Spellbook publishes the Heroic Feast version of this loop, with '
        + 'Phyrexian Altar, for 25 cards that turn it into life — and Elas il-Kor, Sadistic '
        + 'Pilgrim is not one of them.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite lifeloss', 'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Animation Module', 'Phyrexian Altar', 'Heroic Feast', 'Lunarch Veteran // Luminous Phantom'],
      confidence: 'verified',
      from: {
        id: '1939-2919-3490-4050',
        cards: ['Animation Module', 'Archangel of Thune', 'Lunarch Veteran // Luminous Phantom', 'Phyrexian Altar'],
      },
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast', inId: 7743 },
      why: 'Animation Module turns a +1/+1 counter into a Servo for {1}, Phyrexian Altar eats '
        + 'the Servo to pay for the next one, and Lunarch Veteran gains 1 life every time one '
        + 'enters. Heroic Feast does Archangel of Thune’s job here: one life gained is one '
        + 'target, and one counter on any permanent you control is all Animation Module asks '
        + 'for. Spellbook publishes the Heroic Feast version of this loop, with Phyrexian '
        + 'Altar, for 25 cards that turn it into life — and Lunarch Veteran is not one of them.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    // ---- Virulent Emissary, four more times ----------------------------------
    //
    // Virulent Emissary is the card this audit kept arriving at: 54 published
    // combos against Hinterland Sanctifier's 106, for a trigger that is the same
    // sentence written twice. Deathtouch is the only rider, and green rather than
    // white is the only difference that reaches the table — which is the whole of
    // why a Golgari deck cares. These are the Animation Module loops where
    // Spellbook wrote the Sanctifier down and not him.
    {
      cards: ['Animation Module', 'Ashnod\'s Altar', 'Archangel of Thune', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '2034-2919-3490-6097',
        cards: ['Animation Module', 'Ashnod\'s Altar', 'Archangel of Thune', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Archangel of Thune turns each life gained into a +1/+1 counter, Animation Module '
        + 'turns the counter into a Servo for {1}, and the Servo entering is what Virulent '
        + 'Emissary gains the life for; Ashnod\'s Altar eats the Servo to pay the {1}. Virulent '
        + 'Emissary’s trigger is Hinterland Sanctifier’s sentence word for word — “whenever '
        + 'another creature you control enters, you gain 1 life” — with deathtouch as its only '
        + 'rider, and green where the Sanctifier is white — and the life on entry is the only '
        + 'thing the loop asks of it. Spellbook publishes these three cards with 31 other cards '
        + 'that turn the loop into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite colorless mana', 'Infinite lifegain triggers',
        'Infinite lifegain', 'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Animation Module', 'Phyrexian Altar', 'Archangel of Thune', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '2919-3490-4050-6097',
        cards: ['Animation Module', 'Archangel of Thune', 'Phyrexian Altar', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Archangel of Thune turns each life gained into a +1/+1 counter, Animation Module '
        + 'turns the counter into a Servo for {1}, and the Servo entering is what Virulent '
        + 'Emissary gains the life for; Phyrexian Altar eats the Servo to pay the {1}. Virulent '
        + 'Emissary’s trigger is Hinterland Sanctifier’s sentence word for word — “whenever '
        + 'another creature you control enters, you gain 1 life” — with deathtouch as its only '
        + 'rider, and green where the Sanctifier is white — and the life on entry is the only '
        + 'thing the loop asks of it. Spellbook publishes these three cards with 31 other cards '
        + 'that turn the loop into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Animation Module', 'Ashnod\'s Altar', 'Heliod, Sun-Crowned', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '1274-2034-3490-6097',
        cards: ['Animation Module', 'Ashnod\'s Altar', 'Heliod, Sun-Crowned', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Heliod, Sun-Crowned turns each life gained into a +1/+1 counter, Animation Module '
        + 'turns the counter into a Servo for {1}, and the Servo entering is what Virulent '
        + 'Emissary gains the life for; Ashnod\'s Altar eats the Servo to pay the {1}. Virulent '
        + 'Emissary’s trigger is Hinterland Sanctifier’s sentence word for word — “whenever '
        + 'another creature you control enters, you gain 1 life” — with deathtouch as its only '
        + 'rider, and green where the Sanctifier is white — and the life on entry is the only '
        + 'thing the loop asks of it. Spellbook publishes these three cards with 30 other cards '
        + 'that turn the loop into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite colorless mana', 'Infinite lifegain triggers',
        'Infinite lifegain', 'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Animation Module', 'Phyrexian Altar', 'Heliod, Sun-Crowned', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '1274-3490-4050-6097',
        cards: ['Animation Module', 'Heliod, Sun-Crowned', 'Phyrexian Altar', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Heliod, Sun-Crowned turns each life gained into a +1/+1 counter, Animation Module '
        + 'turns the counter into a Servo for {1}, and the Servo entering is what Virulent '
        + 'Emissary gains the life for; Phyrexian Altar eats the Servo to pay the {1}. Virulent '
        + 'Emissary’s trigger is Hinterland Sanctifier’s sentence word for word — “whenever '
        + 'another creature you control enters, you gain 1 life” — with deathtouch as its only '
        + 'rider, and green where the Sanctifier is white — and the life on entry is the only '
        + 'thing the loop asks of it. Spellbook publishes these three cards with 30 other cards '
        + 'that turn the loop into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    // Amalia's version of the same loop: the life sends her exploring rather than
    // straight to a counter, and the counter she takes from it is what the Module
    // reads.
    {
      cards: ['Amalia Benavides Aguirre', 'Animation Module', 'Ashnod\'s Altar', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '2034-3490-6097-6283',
        cards: ['Amalia Benavides Aguirre', 'Animation Module', 'Ashnod\'s Altar', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Every life gained sends Amalia Benavides Aguirre exploring, which puts a +1/+1 '
        + 'counter on her; Animation Module turns that counter into a Servo for {1}; and the '
        + 'Servo entering is the life. Ashnod\'s Altar eats the Servo to pay for the next one. '
        + 'Virulent Emissary’s trigger is Hinterland Sanctifier’s sentence word for word — '
        + '“whenever another creature you control enters, you gain 1 life” — with deathtouch as '
        + 'its only rider, and green where the Sanctifier is white, which is the only card this '
        + 'row changes — Spellbook publishes the other three with 31 cards that turn the loop '
        + 'into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite colorless mana', 'Infinite lifegain triggers',
        'Infinite lifegain', 'Infinite creature tokens',
        'Destroy all creatures opponents control', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Amalia Benavides Aguirre', 'Animation Module', 'Phyrexian Altar', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '3490-4050-6097-6283',
        cards: ['Amalia Benavides Aguirre', 'Animation Module', 'Phyrexian Altar', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Every life gained sends Amalia Benavides Aguirre exploring, which puts a +1/+1 '
        + 'counter on her; Animation Module turns that counter into a Servo for {1}; and the '
        + 'Servo entering is the life. Phyrexian Altar eats the Servo to pay for the next one. '
        + 'Virulent Emissary’s trigger is Hinterland Sanctifier’s sentence word for word — '
        + '“whenever another creature you control enters, you gain 1 life” — with deathtouch as '
        + 'its only rider, and green where the Sanctifier is white, which is the only card this '
        + 'row changes — Spellbook publishes the other three with 31 cards that turn the loop '
        + 'into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Destroy all creatures opponents control', 'Infinite +1/+1 counters on a creature',
      ],
    },
    // ---- Warren Soultrader and a token doubler: seven rows -------------------
    //
    // Soultrader's ability costs a creature and a life: "Pay 1 life, sacrifice
    // another creature: create a Treasure token." A card that adds a token to every
    // token creation hands the creature back, and a card that gains 1 life when a
    // creature enters hands the life back, so the only number that moves is the
    // Treasure count. Spellbook publishes it with 59 such cards behind Chatterfang,
    // 57 behind Stridehangar Automaton and 59 behind Quina — and this deck's Aunt
    // May, Case of the Uneaten Feast and Virulent Emissary fall in the gaps.
    {
      cards: ['Warren Soultrader', 'Chatterfang, Squirrel General', 'Aunt May'],
      confidence: 'verified',
      from: {
        id: '3000-5670-6097',
        cards: ['Warren Soultrader', 'Chatterfang, Squirrel General', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Aunt May', inId: 6823 },
      why: 'Warren Soultrader pays 1 life and eats a Squirrel to make a Treasure, Chatterfang '
        + 'puts a Squirrel back into that creation, and Aunt May gains the 1 life back as it '
        + 'enters. The token count and the life total both end where they started; the '
        + 'Treasures do not. Aunt May’s trigger is Hinterland Sanctifier’s sentence word for '
        + 'word, plus a rider that reads only Spiders and never fires here. Spellbook publishes '
        + 'these two cards with 59 other cards that turn the loop into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite Treasure tokens',
      ],
    },
    {
      cards: ['Warren Soultrader', 'Chatterfang, Squirrel General', 'Case of the Uneaten Feast'],
      confidence: 'verified',
      from: {
        id: '3000-5670-6097',
        cards: ['Warren Soultrader', 'Chatterfang, Squirrel General', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Case of the Uneaten Feast', inId: 6720 },
      why: 'Warren Soultrader pays 1 life and eats a Squirrel to make a Treasure, Chatterfang '
        + 'puts a Squirrel back into that creation, and Case of the Uneaten Feast gains the 1 '
        + 'life back as it enters. The token count and the life total both end where they '
        + 'started; the Treasures do not. Case of the Uneaten Feast gains the life on a '
        + 'creature you control entering rather than on *another* one, which is the '
        + 'Sanctifier’s trigger with the restriction taken off. Spellbook publishes these two '
        + 'cards with 59 other cards that turn the loop into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite Treasure tokens',
      ],
    },
    {
      cards: ['Warren Soultrader', 'Chatterfang, Squirrel General', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '3000-5670-6097',
        cards: ['Warren Soultrader', 'Chatterfang, Squirrel General', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Warren Soultrader pays 1 life and eats a Squirrel to make a Treasure, Chatterfang '
        + 'puts a Squirrel back into that creation, and Virulent Emissary gains the 1 life back '
        + 'as it enters. The token count and the life total both end where they started; the '
        + 'Treasures do not. Virulent Emissary’s trigger is Hinterland Sanctifier’s sentence '
        + 'word for word — “whenever another creature you control enters, you gain 1 life” — '
        + 'with deathtouch as its only rider, and green where the Sanctifier is white. '
        + 'Spellbook publishes these two cards with 59 other cards that turn the loop into '
        + 'life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite Treasure tokens',
      ],
    },
    {
      cards: ['Warren Soultrader', 'Stridehangar Automaton', 'Aunt May'],
      confidence: 'verified',
      from: {
        id: '5670-6097-6291',
        cards: ['Warren Soultrader', 'Hinterland Sanctifier', 'Stridehangar Automaton'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Aunt May', inId: 6823 },
      why: 'Warren Soultrader pays 1 life and eats a Thopter to make a Treasure, Stridehangar '
        + 'Automaton puts a Thopter back into that creation, and Aunt May gains the 1 life back '
        + 'as it enters. The token count and the life total both end where they started; the '
        + 'Treasures do not. Aunt May’s trigger is Hinterland Sanctifier’s sentence word for '
        + 'word, plus a rider that reads only Spiders and never fires here. Spellbook publishes '
        + 'these two cards with 57 other cards that turn the loop into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite Treasure tokens',
      ],
    },
    {
      cards: ['Warren Soultrader', 'Stridehangar Automaton', 'Case of the Uneaten Feast'],
      confidence: 'verified',
      from: {
        id: '5670-6097-6291',
        cards: ['Warren Soultrader', 'Hinterland Sanctifier', 'Stridehangar Automaton'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Case of the Uneaten Feast', inId: 6720 },
      why: 'Warren Soultrader pays 1 life and eats a Thopter to make a Treasure, Stridehangar '
        + 'Automaton puts a Thopter back into that creation, and Case of the Uneaten Feast '
        + 'gains the 1 life back as it enters. The token count and the life total both end '
        + 'where they started; the Treasures do not. Case of the Uneaten Feast gains the life '
        + 'on a creature you control entering rather than on *another* one, which is the '
        + 'Sanctifier’s trigger with the restriction taken off. Spellbook publishes these two '
        + 'cards with 57 other cards that turn the loop into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite Treasure tokens',
      ],
    },
    {
      cards: ['Warren Soultrader', 'Stridehangar Automaton', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '5670-6097-6291',
        cards: ['Warren Soultrader', 'Hinterland Sanctifier', 'Stridehangar Automaton'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Warren Soultrader pays 1 life and eats a Thopter to make a Treasure, Stridehangar '
        + 'Automaton puts a Thopter back into that creation, and Virulent Emissary gains the 1 '
        + 'life back as it enters. The token count and the life total both end where they '
        + 'started; the Treasures do not. Virulent Emissary’s trigger is Hinterland '
        + 'Sanctifier’s sentence word for word — “whenever another creature you control enters, '
        + 'you gain 1 life” — with deathtouch as its only rider, and green where the Sanctifier '
        + 'is white. Spellbook publishes these two cards with 57 other cards that turn the loop '
        + 'into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite Treasure tokens',
      ],
    },
    {
      cards: ['Warren Soultrader', 'Quina, Qu Gourmet', 'Virulent Emissary'],
      confidence: 'verified',
      from: {
        id: '5670-6097-6705',
        cards: ['Warren Soultrader', 'Hinterland Sanctifier', 'Quina, Qu Gourmet'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Virulent Emissary', inId: 7173 },
      why: 'Warren Soultrader pays 1 life and eats a Frog to make a Treasure, Quina puts a Frog '
        + 'back into that creation, and Virulent Emissary gains the 1 life back as it enters. '
        + 'The token count and the life total both end where they started; the Treasures do '
        + 'not. Virulent Emissary’s trigger is Hinterland Sanctifier’s sentence word for word — '
        + '“whenever another creature you control enters, you gain 1 life” — with deathtouch as '
        + 'its only rider, and green where the Sanctifier is white. Spellbook publishes these '
        + 'two cards with 59 other cards that turn the loop into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite Treasure tokens',
      ],
    },
    // ---- Trudge Garden: three rows -------------------------------------------
    //
    // Trudge Garden makes a 4/4 for {2} every time you gain life, which is why the
    // audit in the README threw out eighteen candidates for it: this loop needs mana
    // out of the sacrifice, and a free outlet gives it none. These three keep the
    // mana. Ashnod's Altar makes the {2} by itself; Phyrexian Altar makes half and
    // Pitiless Plunderer's Treasure the other half, which is the four-card version
    // Spellbook publishes 31 times over. What is missing is only ever the card that
    // gains the life.
    {
      cards: ['Trudge Garden', 'Ashnod\'s Altar', 'Aunt May'],
      confidence: 'verified',
      from: {
        id: '2034-2308-6097',
        cards: ['Trudge Garden', 'Ashnod\'s Altar', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Aunt May', inId: 6823 },
      why: 'A 4/4 Fungus Beast enters, Aunt May gains 1 life for it, and Trudge Garden pays {2} '
        + 'off that trigger for the next 4/4 — the {2} Ashnod’s Altar has already made by '
        + 'eating the last one. Aunt May’s trigger is Hinterland Sanctifier’s sentence word for '
        + 'word, plus a rider that reads only Spiders and never fires here, and the loop asks '
        + 'nothing else of it. Spellbook publishes Trudge Garden and Ashnod’s Altar with 62 '
        + 'other cards that turn the token into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
      ],
    },
    {
      cards: ['Trudge Garden', 'Ashnod\'s Altar', 'Case of the Uneaten Feast'],
      confidence: 'verified',
      from: {
        id: '2034-2308-6097',
        cards: ['Trudge Garden', 'Ashnod\'s Altar', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Case of the Uneaten Feast', inId: 6720 },
      why: 'A 4/4 Fungus Beast enters, Case of the Uneaten Feast gains 1 life for it, and Trudge '
        + 'Garden pays {2} off that trigger for the next 4/4 — the {2} Ashnod’s Altar has '
        + 'already made by eating the last one. Case of the Uneaten Feast gains the life on a '
        + 'creature you control entering rather than on *another* one, which is the '
        + 'Sanctifier’s trigger with the restriction taken off, and the loop asks nothing else '
        + 'of it. Spellbook publishes Trudge Garden and Ashnod’s Altar with 62 other cards that '
        + 'turn the token into life.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
      ],
    },

    {
      cards: ['Trudge Garden', 'Pitiless Plunderer', 'Phyrexian Altar', 'Lunarch Veteran // Luminous Phantom'],
      confidence: 'verified',
      from: {
        id: '2308-4050-4871-6097',
        cards: ['Trudge Garden', 'Pitiless Plunderer', 'Phyrexian Altar', 'Hinterland Sanctifier'],
      },
      swap: { out: 'Hinterland Sanctifier', in: 'Lunarch Veteran // Luminous Phantom', inId: 1939 },
      why: 'Phyrexian Altar eats the 4/4 Fungus Beast for one mana and Pitiless Plunderer’s '
        + 'Treasure makes the second, which is the {2} Trudge Garden charges for the next one — '
        + 'and Lunarch Veteran gains the 1 life that triggers it as the token enters. Lunarch '
        + 'Veteran’s trigger is Hinterland Sanctifier’s sentence word for word, with disturb as '
        + 'its only rider, so this is the Sanctifier row with a different white one-drop. '
        + 'Spellbook publishes the other three with 31 cards that turn the loop into life.',
      produces: [
        'Infinite ETB', 'Infinite LTB', 'Infinite death triggers', 'Infinite lifegain',
        'Infinite lifegain triggers', 'Infinite sacrifice triggers',
      ],
    },

    // ---- the token-creation half of the counter loops ------------------------
    //
    // Everything above came from a question about one card. These came from asking
    // the same question of the whole file: tools/substitution-scope.js points the
    // method at every card rather than the one being asked about, and these are the
    // two families that survived reading.
    //
    // Rosie Cotton reads *a token being created* where the cards Spellbook pairs
    // with these loops read *a creature entering*. It is the same trigger wherever
    // the creature entering is a token, which in all twenty of her rows it is — and
    // it is why she needs no sacrifice outlet: the token creation is already the
    // event, so she closes in two cards what Sadistic Glee closes in three.
    {
      cards: ['Rosie Cotton of South Lane', 'Devoted Druid', 'Nest of Scarabs'],
      confidence: 'verified',
      from: {
        id: '2760-4762-7325',
        cards: ['Mighty Mutanimals', 'Devoted Druid', 'Nest of Scarabs'],
      },
      swap: { out: 'Mighty Mutanimals', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Nest of Scarabs, Hapatra and Flourishing Defenses all answer a -1/-1 counter with a token, and the token is what Rosie reads. She puts the +1/+1 counter back on the creature that just counted itself down, the two annihilate, and the untap is free again. Mighty Mutanimals closes it the same way for one counter on one target creature; Rosie differs only in needing that creature to be a token, which every one of these makes.',
      produces: [
        'Infinite ETB',
        'Infinite creature tokens',
        'Infinite green mana',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Devoted Druid', 'Hapatra, Vizier of Poisons'],
      confidence: 'verified',
      from: {
        id: '2228-4762-7325',
        cards: ['Mighty Mutanimals', 'Devoted Druid', 'Hapatra, Vizier of Poisons'],
      },
      swap: { out: 'Mighty Mutanimals', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Nest of Scarabs, Hapatra and Flourishing Defenses all answer a -1/-1 counter with a token, and the token is what Rosie reads. She puts the +1/+1 counter back on the creature that just counted itself down, the two annihilate, and the untap is free again. Mighty Mutanimals closes it the same way for one counter on one target creature; Rosie differs only in needing that creature to be a token, which every one of these makes.',
      produces: [
        'Infinite ETB',
        'Infinite creature tokens',
        'Infinite green mana',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Devoted Druid', 'Flourishing Defenses'],
      confidence: 'verified',
      from: {
        id: '1084-4762-7325',
        cards: ['Mighty Mutanimals', 'Devoted Druid', 'Flourishing Defenses'],
      },
      swap: { out: 'Mighty Mutanimals', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Nest of Scarabs, Hapatra and Flourishing Defenses all answer a -1/-1 counter with a token, and the token is what Rosie reads. She puts the +1/+1 counter back on the creature that just counted itself down, the two annihilate, and the untap is free again. Mighty Mutanimals closes it the same way for one counter on one target creature; Rosie differs only in needing that creature to be a token, which every one of these makes.',
      produces: [
        'Infinite ETB',
        'Infinite creature tokens',
        'Infinite green mana',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Cinderhaze Wretch', 'Nest of Scarabs'],
      confidence: 'verified',
      from: {
        id: '1242-2760-7325',
        cards: ['Mighty Mutanimals', 'Cinderhaze Wretch', 'Nest of Scarabs'],
      },
      swap: { out: 'Mighty Mutanimals', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Nest of Scarabs, Hapatra and Flourishing Defenses all answer a -1/-1 counter with a token, and the token is what Rosie reads. She puts the +1/+1 counter back on the creature that just counted itself down, the two annihilate, and the untap is free again. Mighty Mutanimals closes it the same way for one counter on one target creature; Rosie differs only in needing that creature to be a token, which every one of these makes.',
      produces: [
        'Infinite ETB',
        'Infinite creature tokens',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Cinderhaze Wretch', 'Hapatra, Vizier of Poisons'],
      confidence: 'verified',
      from: {
        id: '1242-2228-7325',
        cards: ['Mighty Mutanimals', 'Cinderhaze Wretch', 'Hapatra, Vizier of Poisons'],
      },
      swap: { out: 'Mighty Mutanimals', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Nest of Scarabs, Hapatra and Flourishing Defenses all answer a -1/-1 counter with a token, and the token is what Rosie reads. She puts the +1/+1 counter back on the creature that just counted itself down, the two annihilate, and the untap is free again. Mighty Mutanimals closes it the same way for one counter on one target creature; Rosie differs only in needing that creature to be a token, which every one of these makes.',
      produces: [
        'Infinite ETB',
        'Infinite creature tokens',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Cinderhaze Wretch', 'Flourishing Defenses'],
      confidence: 'verified',
      from: {
        id: '1084-1242-7325',
        cards: ['Mighty Mutanimals', 'Flourishing Defenses', 'Cinderhaze Wretch'],
      },
      swap: { out: 'Mighty Mutanimals', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Nest of Scarabs, Hapatra and Flourishing Defenses all answer a -1/-1 counter with a token, and the token is what Rosie reads. She puts the +1/+1 counter back on the creature that just counted itself down, the two annihilate, and the untap is free again. Mighty Mutanimals closes it the same way for one counter on one target creature; Rosie differs only in needing that creature to be a token, which every one of these makes.',
      produces: [
        'Infinite ETB',
        'Infinite creature tokens',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Barrenton Medic', 'Nest of Scarabs'],
      confidence: 'verified',
      from: {
        id: '2335-2760-7325',
        cards: ['Mighty Mutanimals', 'Barrenton Medic', 'Nest of Scarabs'],
      },
      swap: { out: 'Mighty Mutanimals', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Nest of Scarabs, Hapatra and Flourishing Defenses all answer a -1/-1 counter with a token, and the token is what Rosie reads. She puts the +1/+1 counter back on the creature that just counted itself down, the two annihilate, and the untap is free again. Mighty Mutanimals closes it the same way for one counter on one target creature; Rosie differs only in needing that creature to be a token, which every one of these makes.',
      produces: [
        'Infinite ETB',
        'Infinite creature tokens',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Barrenton Medic', 'Hapatra, Vizier of Poisons'],
      confidence: 'verified',
      from: {
        id: '2228-2335-7325',
        cards: ['Mighty Mutanimals', 'Hapatra, Vizier of Poisons', 'Barrenton Medic'],
      },
      swap: { out: 'Mighty Mutanimals', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Nest of Scarabs, Hapatra and Flourishing Defenses all answer a -1/-1 counter with a token, and the token is what Rosie reads. She puts the +1/+1 counter back on the creature that just counted itself down, the two annihilate, and the untap is free again. Mighty Mutanimals closes it the same way for one counter on one target creature; Rosie differs only in needing that creature to be a token, which every one of these makes.',
      produces: [
        'Infinite ETB',
        'Infinite creature tokens',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Barrenton Medic', 'Flourishing Defenses'],
      confidence: 'verified',
      from: {
        id: '1084-2335-7325',
        cards: ['Mighty Mutanimals', 'Flourishing Defenses', 'Barrenton Medic'],
      },
      swap: { out: 'Mighty Mutanimals', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Nest of Scarabs, Hapatra and Flourishing Defenses all answer a -1/-1 counter with a token, and the token is what Rosie reads. She puts the +1/+1 counter back on the creature that just counted itself down, the two annihilate, and the untap is free again. Mighty Mutanimals closes it the same way for one counter on one target creature; Rosie differs only in needing that creature to be a token, which every one of these makes.',
      produces: [
        'Infinite ETB',
        'Infinite creature tokens',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Ghave, Guru of Spores', 'Utopia Mycon'],
      confidence: 'derived',
      from: {
        id: '4214-4535-5189',
        cards: ['Ghave, Guru of Spores', 'Utopia Mycon', 'Good-Fortune Unicorn'],
      },
      swap: { out: 'Good-Fortune Unicorn', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Ghave, Ulasht and Marath each pay {1} and remove a +1/+1 counter to make a token, and the outlet eats that token to refund the {1}. Rosie supplies the counter the activation spent — she reads the token being created, where the published version reads the creature entering. Derived: both halves are published and the loop is the one she already runs with Presence of Gond, but this pairing has not been read against the cards.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Ghave, Guru of Spores', 'Cryptic Trilobite'],
      confidence: 'derived',
      from: {
        id: '4535-4929-5189',
        cards: ['Ghave, Guru of Spores', 'Cryptic Trilobite', 'Good-Fortune Unicorn'],
      },
      swap: { out: 'Good-Fortune Unicorn', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Ghave, Ulasht and Marath each pay {1} and remove a +1/+1 counter to make a token, and the outlet eats that token to refund the {1}. Rosie supplies the counter the activation spent — she reads the token being created, where the published version reads the creature entering. Derived: both halves are published and the loop is the one she already runs with Presence of Gond, but this pairing has not been read against the cards.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Ghave, Guru of Spores', 'Earthcraft'],
      confidence: 'derived',
      from: {
        id: '2757-2850-5189',
        cards: ['Ghave, Guru of Spores', 'Earthcraft', 'Ivy Lane Denizen'],
      },
      swap: { out: 'Ivy Lane Denizen', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Ghave, Ulasht and Marath each pay {1} and remove a +1/+1 counter to make a token, and the outlet eats that token to refund the {1}. Rosie supplies the counter the activation spent — she reads the token being created, where the published version reads the creature entering. Derived: both halves are published and the loop is the one she already runs with Presence of Gond, but this pairing has not been read against the cards.',
      produces: [
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite mana basic lands you control can produce',
        'Infinite untap of basic lands you control',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Marath, Will of the Wild', 'Ashnod\'s Altar'],
      confidence: 'derived',
      from: {
        id: '1335-2034-2850',
        cards: ['Marath, Will of the Wild', 'Ivy Lane Denizen', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Ivy Lane Denizen', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Ghave, Ulasht and Marath each pay {1} and remove a +1/+1 counter to make a token, and the outlet eats that token to refund the {1}. Rosie supplies the counter the activation spent — she reads the token being created, where the published version reads the creature entering. Derived: both halves are published and the loop is the one she already runs with Presence of Gond, but this pairing has not been read against the cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite colorless mana',
        'Infinite creature tokens',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Marath, Will of the Wild', 'Mana Echoes'],
      confidence: 'derived',
      from: {
        id: '1335-2440-2850',
        cards: ['Marath, Will of the Wild', 'Mana Echoes', 'Ivy Lane Denizen'],
      },
      swap: { out: 'Ivy Lane Denizen', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Ghave, Ulasht and Marath each pay {1} and remove a +1/+1 counter to make a token, and the outlet eats that token to refund the {1}. Rosie supplies the counter the activation spent — she reads the token being created, where the published version reads the creature entering. Derived: both halves are published and the loop is the one she already runs with Presence of Gond, but this pairing has not been read against the cards.',
      produces: [
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite ETB',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Ulasht, the Hate Seed', 'Utopia Mycon'],
      confidence: 'derived',
      from: {
        id: '2744-3192-4214',
        cards: ['Ulasht, the Hate Seed', 'Cathars\' Crusade', 'Utopia Mycon'],
      },
      swap: { out: 'Cathars\' Crusade', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Ghave, Ulasht and Marath each pay {1} and remove a +1/+1 counter to make a token, and the outlet eats that token to refund the {1}. Rosie supplies the counter the activation spent — she reads the token being created, where the published version reads the creature entering. Derived: both halves are published and the loop is the one she already runs with Presence of Gond, but this pairing has not been read against the cards.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Ulasht, the Hate Seed', 'Ashnod\'s Altar'],
      confidence: 'derived',
      from: {
        id: '2034-2850-3192',
        cards: ['Ulasht, the Hate Seed', 'Ivy Lane Denizen', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Ivy Lane Denizen', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Ghave, Ulasht and Marath each pay {1} and remove a +1/+1 counter to make a token, and the outlet eats that token to refund the {1}. Rosie supplies the counter the activation spent — she reads the token being created, where the published version reads the creature entering. Derived: both halves are published and the loop is the one she already runs with Presence of Gond, but this pairing has not been read against the cards.',
      produces: [
        'Infinite colorless mana',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Ulasht, the Hate Seed', 'Mana Echoes'],
      confidence: 'derived',
      from: {
        id: '2440-2850-3192',
        cards: ['Ulasht, the Hate Seed', 'Ivy Lane Denizen', 'Mana Echoes'],
      },
      swap: { out: 'Ivy Lane Denizen', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Ghave, Ulasht and Marath each pay {1} and remove a +1/+1 counter to make a token, and the outlet eats that token to refund the {1}. Rosie supplies the counter the activation spent — she reads the token being created, where the published version reads the creature entering. Derived: both halves are published and the loop is the one she already runs with Presence of Gond, but this pairing has not been read against the cards.',
      produces: [
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite ETB',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Ulasht, the Hate Seed', 'Phyrexian Altar'],
      confidence: 'derived',
      from: {
        id: '2744-3192-4050',
        cards: ['Ulasht, the Hate Seed', 'Cathars\' Crusade', 'Phyrexian Altar'],
      },
      swap: { out: 'Cathars\' Crusade', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Ghave, Ulasht and Marath each pay {1} and remove a +1/+1 counter to make a token, and the outlet eats that token to refund the {1}. Rosie supplies the counter the activation spent — she reads the token being created, where the published version reads the creature entering. Derived: both halves are published and the loop is the one she already runs with Presence of Gond, but this pairing has not been read against the cards.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Xavier Sal, Infested Captain', 'Intruder Alarm'],
      confidence: 'derived',
      from: {
        id: '1636-2850-3143',
        cards: ['Xavier Sal, Infested Captain', 'Intruder Alarm', 'Ivy Lane Denizen'],
      },
      swap: { out: 'Ivy Lane Denizen', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Intruder Alarm untaps the mana creatures that pay for the next token, and the token is what Rosie reads — she puts the +1/+1 counter on a creature, which is what the published third card does when a creature enters. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite ETB',
        'Infinite creature tokens',
        'Infinite untap of creatures',
        'Infinite mana creatures you control can produce',
        'Infinite copies of creature tokens you control',
      ],
    },
    {
      cards: ['Rosie Cotton of South Lane', 'Animation Module', 'Intruder Alarm'],
      confidence: 'derived',
      from: {
        id: '1636-2744-3490',
        cards: ['Animation Module', 'Intruder Alarm', 'Cathars\' Crusade'],
      },
      swap: { out: 'Cathars\' Crusade', in: 'Rosie Cotton of South Lane', inId: 2433 },
      why: 'Intruder Alarm untaps the mana creatures that pay for the next token, and the token is what Rosie reads — she puts the +1/+1 counter on a creature, which is what the published third card does when a creature enters. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite mana creatures you control can produce',
        'Infinite untap of creatures',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Animation Module', 'Ashnod\'s Altar'],
      confidence: 'derived',
      from: {
        id: '2034-2082-3490',
        cards: ['Sadistic Glee', 'Animation Module', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The engine spends a +1/+1 counter to make a token, the outlet eats the token for the mana that pays for the next one, and the death puts the counter back. Necrosynthesis wants "another creature" to die and the token always is one. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Ghave, Guru of Spores', 'Utopia Mycon'],
      confidence: 'derived',
      from: {
        id: '2082-4214-5189',
        cards: ['Ghave, Guru of Spores', 'Sadistic Glee', 'Utopia Mycon'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The engine spends a +1/+1 counter to make a token, the outlet eats the token for the mana that pays for the next one, and the death puts the counter back. Necrosynthesis wants "another creature" to die and the token always is one. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Animation Module', 'Phyrexian Altar'],
      confidence: 'derived',
      from: {
        id: '2082-3490-4050',
        cards: ['Sadistic Glee', 'Animation Module', 'Phyrexian Altar'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The engine spends a +1/+1 counter to make a token, the outlet eats the token for the mana that pays for the next one, and the death puts the counter back. Necrosynthesis wants "another creature" to die and the token always is one. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite sacrifice triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite +1/+1 counters on a creature',
        'Infinite death triggers',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Ghave, Guru of Spores', 'Phyrexian Altar'],
      confidence: 'derived',
      from: {
        id: '2082-4050-5189',
        cards: ['Ghave, Guru of Spores', 'Sadistic Glee', 'Phyrexian Altar'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The engine spends a +1/+1 counter to make a token, the outlet eats the token for the mana that pays for the next one, and the death puts the counter back. Necrosynthesis wants "another creature" to die and the token always is one. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Scurry Oak', 'Woe Strider'],
      confidence: 'verified',
      from: {
        id: '997-2082-4186',
        cards: ['Scurry Oak', 'Sadistic Glee', 'Woe Strider'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next counter. Necrosynthesis says "another creature dies" where Sadistic Glee says "a creature", and the creature dying here is the token, never the enchanted one. Read against all three cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite scry 1',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Herd Baloth', 'Woe Strider'],
      confidence: 'verified',
      from: {
        id: '997-2082-3197',
        cards: ['Herd Baloth', 'Sadistic Glee', 'Woe Strider'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next counter. Necrosynthesis says "another creature dies" where Sadistic Glee says "a creature", and the creature dying here is the token, never the enchanted one. Read against all three cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite scry 1',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Scurry Oak', 'Bartolomé del Presidio'],
      confidence: 'verified',
      from: {
        id: '2082-2921-4186',
        cards: ['Scurry Oak', 'Sadistic Glee', 'Bartolomé del Presidio'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next counter. Necrosynthesis says "another creature dies" where Sadistic Glee says "a creature", and the creature dying here is the token, never the enchanted one. Read against all three cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite death triggers',
        'Infinite +1/+1 counters on a creature',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Scurry Oak', 'Yahenni, Undying Partisan'],
      confidence: 'verified',
      from: {
        id: '2082-3967-4186',
        cards: ['Scurry Oak', 'Sadistic Glee', 'Yahenni, Undying Partisan'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next counter. Necrosynthesis says "another creature dies" where Sadistic Glee says "a creature", and the creature dying here is the token, never the enchanted one. Read against all three cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Scurry Oak', 'Bloodflow Connoisseur'],
      confidence: 'verified',
      from: {
        id: '2082-2511-4186',
        cards: ['Scurry Oak', 'Sadistic Glee', 'Bloodflow Connoisseur'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next counter. Necrosynthesis says "another creature dies" where Sadistic Glee says "a creature", and the creature dying here is the token, never the enchanted one. Read against all three cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Evolution Witness', 'Blood Pet'],
      confidence: 'derived',
      from: {
        id: '2082-3944-5660',
        cards: ['Evolution Witness', 'Sadistic Glee', 'Blood Pet'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The engine spends a +1/+1 counter to make a token, the outlet eats the token for the mana that pays for the next one, and the death puts the counter back. Necrosynthesis wants "another creature" to die and the token always is one. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite storm count',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Herd Baloth', 'Yahenni, Undying Partisan'],
      confidence: 'verified',
      from: {
        id: '2082-3197-3967',
        cards: ['Herd Baloth', 'Sadistic Glee', 'Yahenni, Undying Partisan'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next counter. Necrosynthesis says "another creature dies" where Sadistic Glee says "a creature", and the creature dying here is the token, never the enchanted one. Read against all three cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Herd Baloth', 'Bloodflow Connoisseur'],
      confidence: 'verified',
      from: {
        id: '2082-2511-3197',
        cards: ['Herd Baloth', 'Sadistic Glee', 'Bloodflow Connoisseur'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next counter. Necrosynthesis says "another creature dies" where Sadistic Glee says "a creature", and the creature dying here is the token, never the enchanted one. Read against all three cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Animation Module', 'Krark-Clan Ironworks'],
      confidence: 'derived',
      from: {
        id: '2082-3490-4659',
        cards: ['Sadistic Glee', 'Animation Module', 'Krark-Clan Ironworks'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The engine spends a +1/+1 counter to make a token, the outlet eats the token for the mana that pays for the next one, and the death puts the counter back. Necrosynthesis wants "another creature" to die and the token always is one. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Herd Baloth', 'Bartolomé del Presidio'],
      confidence: 'verified',
      from: {
        id: '2082-2921-3197',
        cards: ['Herd Baloth', 'Sadistic Glee', 'Bartolomé del Presidio'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next counter. Necrosynthesis says "another creature dies" where Sadistic Glee says "a creature", and the creature dying here is the token, never the enchanted one. Read against all three cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Scurry Oak', 'Thermopod'],
      confidence: 'verified',
      from: {
        id: '2082-4186-5231',
        cards: ['Scurry Oak', 'Sadistic Glee', 'Thermopod'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next counter. Necrosynthesis says "another creature dies" where Sadistic Glee says "a creature", and the creature dying here is the token, never the enchanted one. Read against all three cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite red mana',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Evolution Witness', 'Wild Cantor'],
      confidence: 'derived',
      from: {
        id: '1497-2082-5660',
        cards: ['Evolution Witness', 'Sadistic Glee', 'Wild Cantor'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The engine spends a +1/+1 counter to make a token, the outlet eats the token for the mana that pays for the next one, and the death puts the counter back. Necrosynthesis wants "another creature" to die and the token always is one. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite storm count',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Ulasht, the Hate Seed', 'Utopia Mycon'],
      confidence: 'derived',
      from: {
        id: '2082-3192-4214',
        cards: ['Ulasht, the Hate Seed', 'Sadistic Glee', 'Utopia Mycon'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The engine spends a +1/+1 counter to make a token, the outlet eats the token for the mana that pays for the next one, and the death puts the counter back. Necrosynthesis wants "another creature" to die and the token always is one. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Ulasht, the Hate Seed', 'Phyrexian Altar'],
      confidence: 'derived',
      from: {
        id: '2082-3192-4050',
        cards: ['Ulasht, the Hate Seed', 'Sadistic Glee', 'Phyrexian Altar'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The engine spends a +1/+1 counter to make a token, the outlet eats the token for the mana that pays for the next one, and the death puts the counter back. Necrosynthesis wants "another creature" to die and the token always is one. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Evolution Witness', 'Reckless Barbarian'],
      confidence: 'derived',
      from: {
        id: '1947-2082-5660',
        cards: ['Evolution Witness', 'Sadistic Glee', 'Reckless Barbarian'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The engine spends a +1/+1 counter to make a token, the outlet eats the token for the mana that pays for the next one, and the death puts the counter back. Necrosynthesis wants "another creature" to die and the token always is one. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite +1/+1 counters on a creature',
        'Infinite storm count',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Herd Baloth', 'Shilgengar, Sire of Famine'],
      confidence: 'verified',
      from: {
        id: '2082-3197-5686',
        cards: ['Herd Baloth', 'Sadistic Glee', 'Shilgengar, Sire of Famine'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next counter. Necrosynthesis says "another creature dies" where Sadistic Glee says "a creature", and the creature dying here is the token, never the enchanted one. Read against all three cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite +1/+1 counters on a creature',
        'Infinite Blood tokens',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Scurry Oak', 'Shilgengar, Sire of Famine'],
      confidence: 'verified',
      from: {
        id: '2082-4186-5686',
        cards: ['Scurry Oak', 'Sadistic Glee', 'Shilgengar, Sire of Famine'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next counter. Necrosynthesis says "another creature dies" where Sadistic Glee says "a creature", and the creature dying here is the token, never the enchanted one. Read against all three cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite +1/+1 counters on a creature',
        'Infinite Blood tokens',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Ulasht, the Hate Seed', 'Thermopod'],
      confidence: 'derived',
      from: {
        id: '2082-3192-5231',
        cards: ['Ulasht, the Hate Seed', 'Sadistic Glee', 'Thermopod'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The engine spends a +1/+1 counter to make a token, the outlet eats the token for the mana that pays for the next one, and the death puts the counter back. Necrosynthesis wants "another creature" to die and the token always is one. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Ghave, Guru of Spores', 'Thermopod'],
      confidence: 'derived',
      from: {
        id: '2082-5189-5231',
        cards: ['Ghave, Guru of Spores', 'Sadistic Glee', 'Thermopod'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The engine spends a +1/+1 counter to make a token, the outlet eats the token for the mana that pays for the next one, and the death puts the counter back. Necrosynthesis wants "another creature" to die and the token always is one. Derived: both halves are published, but this pairing has not been read against the cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
      ],
    },
    {
      cards: ['Necrosynthesis', 'Herd Baloth', 'Thermopod'],
      confidence: 'verified',
      from: {
        id: '2082-3197-5231',
        cards: ['Herd Baloth', 'Sadistic Glee', 'Thermopod'],
      },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis', inId: 1628 },
      why: 'The counter makes a token, the outlet eats it, the death puts on the next counter. Necrosynthesis says "another creature dies" where Sadistic Glee says "a creature", and the creature dying here is the token, never the enchanted one. Read against all three cards.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite red mana',
        'Infinite +1/+1 counters on a creature',
      ],
    },

    // ---- Chatterfang, and the two cards that do his job -----------------------
    //
    // Three cards hand a creature back inside a token creation, and the sweep found
    // Chatterfang missing from five loops the other two are published in. He is the
    // largest of the three — *that many* Squirrels, on *any* token, where Quina adds
    // one Frog and Stridehangar Automaton adds one Thopter and only ever to artifact
    // tokens. So anywhere either of them closes a loop, he closes it too.
    //
    // Which is also why he is correctly absent from most of Stridehangar’s: those turn
    // on the added token being an artifact — Clock of Omens, Krark-Clan Ironworks,
    // Arcbound Ravager — and a Squirrel is not one. That is a rule-out on the card text
    // rather than on a score, and it is what took 1,202 candidates down to five.
    {
      cards: ['Chatterfang, Squirrel General', 'Warren Soultrader', 'Pactdoll Terror'],
      confidence: 'verified',
      from: {
        id: '5670-6291-6830',
        cards: ['Stridehangar Automaton', 'Warren Soultrader', 'Pactdoll Terror'],
      },
      swap: { out: 'Stridehangar Automaton', in: 'Chatterfang, Squirrel General', inId: 3000 },
      why: 'Warren Soultrader pays 1 life and eats a creature for a Treasure, and Chatterfang hands the creature back inside that creation. Pactdoll Terror reads artifacts entering, and the Treasure is one — so the life comes back whether or not the added token is an artifact. Spellbook publishes this only behind Stridehangar Automaton, whose Thopter is an artifact and triggers it a second time; the loop never needed that second trigger.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite colored mana',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite lifegain triggers',
        'Infinite lifegain',
        'Infinite lifeloss',
        'Infinite Treasure tokens',
      ],
    },
    {
      cards: ['Chatterfang, Squirrel General', 'Warren Soultrader', 'Dazzling Angel'],
      confidence: 'verified',
      from: {
        id: '5670-6705-6719',
        cards: ['Warren Soultrader', 'Quina, Qu Gourmet', 'Dazzling Angel'],
      },
      swap: { out: 'Quina, Qu Gourmet', in: 'Chatterfang, Squirrel General', inId: 3000 },
      why: 'Warren Soultrader pays 1 life and eats a creature for a Treasure; Chatterfang hands the creature straight back inside that same token creation, and the gainer hands the life back as it enters. Only the Treasure count moves. Spellbook publishes this loop with 59 gainers behind Chatterfang and this is not among them, though it is behind the two cards that do the same job.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite colored mana',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite lifegain triggers',
        'Infinite Treasure tokens',
      ],
    },
    {
      cards: ['Chatterfang, Squirrel General', 'Warren Soultrader', 'Anointer Priest'],
      confidence: 'verified',
      from: {
        id: '1086-5670-6705',
        cards: ['Warren Soultrader', 'Anointer Priest', 'Quina, Qu Gourmet'],
      },
      swap: { out: 'Quina, Qu Gourmet', in: 'Chatterfang, Squirrel General', inId: 3000 },
      why: 'Warren Soultrader pays 1 life and eats a creature for a Treasure; Chatterfang hands the creature straight back inside that same token creation, and the gainer hands the life back as it enters. Only the Treasure count moves. Spellbook publishes this loop with 59 gainers behind Chatterfang and this is not among them, though it is behind the two cards that do the same job.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite colored mana',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite lifegain triggers',
        'Infinite Treasure tokens',
      ],
    },
    {
      cards: ['Chatterfang, Squirrel General', 'Kirol, Attentive First-Year', 'Molten Echoes', 'Council of Reeds'],
      confidence: 'derived',
      from: {
        id: '2506-6705-7150-7752',
        cards: ['Kirol, Attentive First-Year', 'Molten Echoes', 'Quina, Qu Gourmet', 'Council of Reeds'],
      },
      swap: { out: 'Quina, Qu Gourmet', in: 'Chatterfang, Squirrel General', inId: 3000 },
      why: 'Chatterfang adds that many Squirrels to any token creation where the published card adds one creature to it, so he does the same job a size larger. Derived: both halves are published and the loop is unchanged, but this pairing has not been read against the cards.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite tapped creature tokens',
      ],
    },
    {
      cards: ['Chatterfang, Squirrel General', 'Survey Mechan', 'Mortuary', 'Ashnod\'s Altar', 'Chalk Outline'],
      confidence: 'derived',
      from: {
        id: '2034-5220-5632-6705-6961',
        cards: ['Survey Mechan', 'Mortuary', 'Ashnod\'s Altar', 'Chalk Outline', 'Quina, Qu Gourmet'],
      },
      swap: { out: 'Quina, Qu Gourmet', in: 'Chatterfang, Squirrel General', inId: 3000 },
      why: 'Chatterfang adds that many Squirrels to any token creation where the published card adds one creature to it, so he does the same job a size larger. Derived: both halves are published and the loop is unchanged, but this pairing has not been read against the cards.',
      produces: [
        'Near-infinite damage',
        'Infinite card draw',
        'Near-infinite lifegain',
        'Near-infinite lifegain triggers',
        'Near-infinite ETB',
        'Infinite draw triggers',
        'Near-infinite storm count',
        'Near-infinite LTB',
        'Near-infinite death triggers',
        'Near-infinite sacrifice triggers',
        'Near-infinite Clue tokens',
      ],
    },

    // ---- Academy Manufactor where Spellbook wrote only Peregrin Took ----------
    //
    // Academy Manufactor has exactly one substitution peer in 103,737 combos, and it
    // is Peregrin Took. They share 54 combo shapes; Peregrin Took appears in 400 more
    // that Academy Manufactor does not. Almost all 400 are his and not hers, and one
    // line of card text says which:
    //
    //   Peregrin Took       If one or more tokens would be created under your control,
    //                       those tokens plus an additional Food token are created instead.
    //   Academy Manufactor  If you would create a Clue, Food, or Treasure token, instead
    //                       create one of each.
    //
    // Peregrin Took reads *any* token and hands back a Food. Academy Manufactor reads
    // three token types and hands back the other two. So a loop whose token is a
    // Squirrel, a Zombie, a Spirit, a Thopter, a Blood or a Myr is his alone — she is
    // not looking at it — and that is what killed 75 of the candidates outright,
    // Camellia's Squirrels and the whole Ant Queen family among them.
    //
    // Two more distinctions did the rest. He *adds* a Food where she only *converts*
    // one, so any loop needing two Foods a cycle breaks on her: that is the four
    // Samwise Gamgee token-doubler lines and the Gingerbrute one. And his second
    // ability, "Sacrifice three Foods: Draw a card", is a free sacrifice outlet she
    // has no equivalent of — the Nuka-Cola Vending Machine, Experimental Confectioner
    // and Lonis lines are that ability, not the replacement effect, and are his alone.
    //
    // What survived is the case where the loop's own token is a Clue or a Treasure.
    // Then she sees it, and what comes back includes the Food he would have added —
    // plus the two other artifacts, which is why every row below produces more than
    // the combo it came from. Spellbook already publishes the shape with her in it
    // for Eloise, Nephalia Sleuth and Pitiless Plunderer; these are the engines it
    // did not.

    // Chalk Outline investigates on top of its Detective token — thirteen outlets.
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Altar of Dementia', 'Chalk Outline'],
      confidence: 'verified',
      from: {
        id: '856-4321-5256-5632',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Altar of Dementia', 'Chalk Outline'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Chalk Outline investigates on top of its Detective, and the Clue is what Academy '
        + 'Manufactor sees: one Clue becomes a Clue, a Food and a Treasure, and the Food is the '
        + 'one the Cat just ate. Altar of Dementia eats the Cat for free, which is all the loop '
        + 'asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite mill', 'Infinite self-mill',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite creature tokens',
        'Infinite lifeloss', 'Infinite Clue tokens', 'Infinite card draw',
        'Infinite draw triggers', 'Infinite Treasure tokens', 'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Ashnod\'s Altar', 'Chalk Outline'],
      confidence: 'verified',
      from: {
        id: '856-2034-4321-5632',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Ashnod\'s Altar', 'Chalk Outline'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Chalk Outline investigates on top of its Detective, and the Clue is what Academy '
        + 'Manufactor sees: one Clue becomes a Clue, a Food and a Treasure, and the Food is the '
        + 'one the Cat just ate. Ashnod\'s Altar eats the Cat for free, which is all the loop '
        + 'asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite colorless mana', 'Infinite lifegain triggers',
        'Infinite lifegain', 'Infinite creature tokens', 'Infinite lifeloss',
        'Infinite card draw', 'Infinite draw triggers', 'Infinite Clue tokens',
        'Infinite Treasure tokens', 'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Chalk Outline', 'Bartolomé del Presidio'],
      confidence: 'verified',
      from: {
        id: '856-2921-4321-5632',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Chalk Outline', 'Bartolomé del Presidio'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Chalk Outline investigates on top of its Detective, and the Clue is what Academy '
        + 'Manufactor sees: one Clue becomes a Clue, a Food and a Treasure, and the Food is the '
        + 'one the Cat just ate. Bartolomé del Presidio eats the Cat for free, which is all the '
        + 'loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite lifeloss',
        'Infinite +1/+1 counters on a creature', 'Infinite Clue tokens',
        'Infinite card draw', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Blasting Station', 'Chalk Outline'],
      confidence: 'verified',
      from: {
        id: '413-856-4321-5632',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Blasting Station', 'Chalk Outline'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Chalk Outline investigates on top of its Detective, and the Clue is what Academy '
        + 'Manufactor sees: one Clue becomes a Clue, a Food and a Treasure, and the Food is the '
        + 'one the Cat just ate. Blasting Station eats the Cat for free, which is all the loop '
        + 'asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite damage', 'Infinite lifegain triggers',
        'Infinite lifegain', 'Infinite creature tokens', 'Infinite lifeloss',
        'Infinite Clue tokens', 'Infinite card draw', 'Infinite draw triggers',
        'Infinite Treasure tokens', 'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Chalk Outline', 'Bloodflow Connoisseur'],
      confidence: 'verified',
      from: {
        id: '856-2511-4321-5632',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Chalk Outline', 'Bloodflow Connoisseur'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Chalk Outline investigates on top of its Detective, and the Clue is what Academy '
        + 'Manufactor sees: one Clue becomes a Clue, a Food and a Treasure, and the Food is the '
        + 'one the Cat just ate. Bloodflow Connoisseur eats the Cat for free, which is all the '
        + 'loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite lifeloss',
        'Infinite +1/+1 counters on a creature', 'Infinite Clue tokens',
        'Infinite card draw', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Chalk Outline', 'Carrion Feeder'],
      confidence: 'verified',
      from: {
        id: '856-2438-4321-5632',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Chalk Outline', 'Carrion Feeder'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Chalk Outline investigates on top of its Detective, and the Clue is what Academy '
        + 'Manufactor sees: one Clue becomes a Clue, a Food and a Treasure, and the Food is the '
        + 'one the Cat just ate. Carrion Feeder eats the Cat for free, which is all the loop '
        + 'asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite lifeloss',
        'Infinite +1/+1 counters on a creature', 'Infinite Clue tokens',
        'Infinite card draw', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Goblin Bombardment', 'Chalk Outline'],
      confidence: 'verified',
      from: {
        id: '856-4321-5147-5632',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Goblin Bombardment', 'Chalk Outline'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Chalk Outline investigates on top of its Detective, and the Clue is what Academy '
        + 'Manufactor sees: one Clue becomes a Clue, a Food and a Treasure, and the Food is the '
        + 'one the Cat just ate. Goblin Bombardment eats the Cat for free, which is all the '
        + 'loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite damage', 'Infinite lifegain triggers',
        'Infinite lifegain', 'Infinite creature tokens', 'Infinite lifeloss',
        'Infinite Clue tokens', 'Infinite card draw', 'Infinite draw triggers',
        'Infinite Treasure tokens', 'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Phyrexian Altar', 'Chalk Outline'],
      confidence: 'verified',
      from: {
        id: '856-4050-4321-5632',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Phyrexian Altar', 'Chalk Outline'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Chalk Outline investigates on top of its Detective, and the Clue is what Academy '
        + 'Manufactor sees: one Clue becomes a Clue, a Food and a Treasure, and the Food is the '
        + 'one the Cat just ate. Phyrexian Altar eats the Cat for free, which is all the loop '
        + 'asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana',
        'Infinite sacrifice triggers', 'Infinite death triggers',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite creature tokens',
        'Infinite lifeloss', 'Infinite card draw', 'Infinite draw triggers',
        'Infinite Clue tokens', 'Infinite Treasure tokens',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Spawning Pit', 'Chalk Outline'],
      confidence: 'verified',
      from: {
        id: '856-3899-4321-5632',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Spawning Pit', 'Chalk Outline'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Chalk Outline investigates on top of its Detective, and the Clue is what Academy '
        + 'Manufactor sees: one Clue becomes a Clue, a Food and a Treasure, and the Food is the '
        + 'one the Cat just ate. Spawning Pit eats the Cat for free, which is all the loop asks '
        + 'of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite lifeloss', 'Infinite Clue tokens',
        'Infinite card draw', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Thermopod', 'Chalk Outline'],
      confidence: 'verified',
      from: {
        id: '856-4321-5231-5632',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Thermopod', 'Chalk Outline'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Chalk Outline investigates on top of its Detective, and the Clue is what Academy '
        + 'Manufactor sees: one Clue becomes a Clue, a Food and a Treasure, and the Food is the '
        + 'one the Cat just ate. Thermopod eats the Cat for free, which is all the loop asks of '
        + 'the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite red mana', 'Infinite creature tokens', 'Infinite lifeloss',
        'Infinite card draw', 'Infinite draw triggers', 'Infinite Clue tokens',
        'Infinite Treasure tokens', 'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Viscera Seer', 'Chalk Outline'],
      confidence: 'verified',
      from: {
        id: '856-2292-4321-5632',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Viscera Seer', 'Chalk Outline'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Chalk Outline investigates on top of its Detective, and the Clue is what Academy '
        + 'Manufactor sees: one Clue becomes a Clue, a Food and a Treasure, and the Food is the '
        + 'one the Cat just ate. Viscera Seer eats the Cat for free, which is all the loop asks '
        + 'of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite lifeloss', 'Infinite Clue tokens',
        'Infinite card draw', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Woe Strider', 'Chalk Outline'],
      confidence: 'verified',
      from: {
        id: '856-997-4321-5632',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Woe Strider', 'Chalk Outline'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Chalk Outline investigates on top of its Detective, and the Clue is what Academy '
        + 'Manufactor sees: one Clue becomes a Clue, a Food and a Treasure, and the Food is the '
        + 'one the Cat just ate. Woe Strider eats the Cat for free, which is all the loop asks '
        + 'of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite lifeloss', 'Infinite Clue tokens',
        'Infinite card draw', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Chalk Outline', 'Yahenni, Undying Partisan'],
      confidence: 'verified',
      from: {
        id: '856-3967-4321-5632',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Chalk Outline', 'Yahenni, Undying Partisan'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Chalk Outline investigates on top of its Detective, and the Clue is what Academy '
        + 'Manufactor sees: one Clue becomes a Clue, a Food and a Treasure, and the Food is the '
        + 'one the Cat just ate. Yahenni, Undying Partisan eats the Cat for free, which is all '
        + 'the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite creature tokens', 'Infinite lifeloss', 'Infinite Clue tokens',
        'Infinite card draw', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },

    // Kheru Goldkeeper makes the Treasure directly — the same thirteen outlets.
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Altar of Dementia', 'Kheru Goldkeeper'],
      confidence: 'verified',
      from: {
        id: '856-4321-5256-6462',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Altar of Dementia', 'Kheru Goldkeeper'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Kheru Goldkeeper makes a Treasure when the Cat leaves the graveyard, and Academy '
        + 'Manufactor turns that Treasure into a Clue, a Food and a Treasure — the Food '
        + 'replacing the one spent returning the Cat. Altar of Dementia eats the Cat for free, '
        + 'which is all the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite mill', 'Infinite self-mill',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite lifeloss',
        'Infinite card draw', 'Infinite draw triggers', 'Infinite Clue tokens',
        'Infinite Treasure tokens', 'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Ashnod\'s Altar', 'Kheru Goldkeeper'],
      confidence: 'verified',
      from: {
        id: '856-2034-4321-6462',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Ashnod\'s Altar', 'Kheru Goldkeeper'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Kheru Goldkeeper makes a Treasure when the Cat leaves the graveyard, and Academy '
        + 'Manufactor turns that Treasure into a Clue, a Food and a Treasure — the Food '
        + 'replacing the one spent returning the Cat. Ashnod\'s Altar eats the Cat for free, '
        + 'which is all the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite colorless mana', 'Infinite lifegain triggers',
        'Infinite lifegain', 'Infinite lifeloss', 'Infinite card draw',
        'Infinite draw triggers', 'Infinite Clue tokens', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Bartolomé del Presidio', 'Kheru Goldkeeper'],
      confidence: 'verified',
      from: {
        id: '856-2921-4321-6462',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Bartolomé del Presidio', 'Kheru Goldkeeper'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Kheru Goldkeeper makes a Treasure when the Cat leaves the graveyard, and Academy '
        + 'Manufactor turns that Treasure into a Clue, a Food and a Treasure — the Food '
        + 'replacing the one spent returning the Cat. Bartolomé del Presidio eats the Cat for '
        + 'free, which is all the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite lifeloss', 'Infinite +1/+1 counters on a creature', 'Infinite card draw',
        'Infinite draw triggers', 'Infinite Clue tokens', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Blasting Station', 'Kheru Goldkeeper'],
      confidence: 'verified',
      from: {
        id: '413-856-4321-6462',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Blasting Station', 'Kheru Goldkeeper'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Kheru Goldkeeper makes a Treasure when the Cat leaves the graveyard, and Academy '
        + 'Manufactor turns that Treasure into a Clue, a Food and a Treasure — the Food '
        + 'replacing the one spent returning the Cat. Blasting Station eats the Cat for free, '
        + 'which is all the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite damage', 'Infinite lifegain triggers',
        'Infinite lifegain', 'Infinite lifeloss', 'Infinite card draw',
        'Infinite draw triggers', 'Infinite Clue tokens', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Bloodflow Connoisseur', 'Kheru Goldkeeper'],
      confidence: 'verified',
      from: {
        id: '856-2511-4321-6462',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Bloodflow Connoisseur', 'Kheru Goldkeeper'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Kheru Goldkeeper makes a Treasure when the Cat leaves the graveyard, and Academy '
        + 'Manufactor turns that Treasure into a Clue, a Food and a Treasure — the Food '
        + 'replacing the one spent returning the Cat. Bloodflow Connoisseur eats the Cat for '
        + 'free, which is all the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite lifeloss', 'Infinite +1/+1 counters on a creature', 'Infinite card draw',
        'Infinite draw triggers', 'Infinite Clue tokens', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Carrion Feeder', 'Kheru Goldkeeper'],
      confidence: 'verified',
      from: {
        id: '856-2438-4321-6462',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Carrion Feeder', 'Kheru Goldkeeper'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Kheru Goldkeeper makes a Treasure when the Cat leaves the graveyard, and Academy '
        + 'Manufactor turns that Treasure into a Clue, a Food and a Treasure — the Food '
        + 'replacing the one spent returning the Cat. Carrion Feeder eats the Cat for free, '
        + 'which is all the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite lifeloss', 'Infinite +1/+1 counters on a creature', 'Infinite card draw',
        'Infinite draw triggers', 'Infinite Clue tokens', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Goblin Bombardment', 'Kheru Goldkeeper'],
      confidence: 'verified',
      from: {
        id: '856-4321-5147-6462',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Goblin Bombardment', 'Kheru Goldkeeper'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Kheru Goldkeeper makes a Treasure when the Cat leaves the graveyard, and Academy '
        + 'Manufactor turns that Treasure into a Clue, a Food and a Treasure — the Food '
        + 'replacing the one spent returning the Cat. Goblin Bombardment eats the Cat for free, '
        + 'which is all the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite damage', 'Infinite lifegain triggers',
        'Infinite lifegain', 'Infinite lifeloss', 'Infinite card draw',
        'Infinite draw triggers', 'Infinite Clue tokens', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Phyrexian Altar', 'Kheru Goldkeeper'],
      confidence: 'verified',
      from: {
        id: '856-4050-4321-6462',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Phyrexian Altar', 'Kheru Goldkeeper'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Kheru Goldkeeper makes a Treasure when the Cat leaves the graveyard, and Academy '
        + 'Manufactor turns that Treasure into a Clue, a Food and a Treasure — the Food '
        + 'replacing the one spent returning the Cat. Phyrexian Altar eats the Cat for free, '
        + 'which is all the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana',
        'Infinite sacrifice triggers', 'Infinite death triggers',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite lifeloss',
        'Infinite card draw', 'Infinite draw triggers', 'Infinite Clue tokens',
        'Infinite Treasure tokens',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Spawning Pit', 'Kheru Goldkeeper'],
      confidence: 'verified',
      from: {
        id: '856-3899-4321-6462',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Spawning Pit', 'Kheru Goldkeeper'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Kheru Goldkeeper makes a Treasure when the Cat leaves the graveyard, and Academy '
        + 'Manufactor turns that Treasure into a Clue, a Food and a Treasure — the Food '
        + 'replacing the one spent returning the Cat. Spawning Pit eats the Cat for free, which '
        + 'is all the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite lifeloss', 'Infinite card draw', 'Infinite draw triggers',
        'Infinite Clue tokens', 'Infinite Treasure tokens', 'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Thermopod', 'Kheru Goldkeeper'],
      confidence: 'verified',
      from: {
        id: '856-4321-5231-6462',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Thermopod', 'Kheru Goldkeeper'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Kheru Goldkeeper makes a Treasure when the Cat leaves the graveyard, and Academy '
        + 'Manufactor turns that Treasure into a Clue, a Food and a Treasure — the Food '
        + 'replacing the one spent returning the Cat. Thermopod eats the Cat for free, which is '
        + 'all the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite red mana', 'Infinite lifeloss', 'Infinite card draw',
        'Infinite draw triggers', 'Infinite Clue tokens', 'Infinite Treasure tokens',
        'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Viscera Seer', 'Kheru Goldkeeper'],
      confidence: 'verified',
      from: {
        id: '856-2292-4321-6462',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Viscera Seer', 'Kheru Goldkeeper'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Kheru Goldkeeper makes a Treasure when the Cat leaves the graveyard, and Academy '
        + 'Manufactor turns that Treasure into a Clue, a Food and a Treasure — the Food '
        + 'replacing the one spent returning the Cat. Viscera Seer eats the Cat for free, which '
        + 'is all the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite lifeloss', 'Infinite card draw', 'Infinite draw triggers',
        'Infinite Clue tokens', 'Infinite Treasure tokens', 'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Woe Strider', 'Kheru Goldkeeper'],
      confidence: 'verified',
      from: {
        id: '856-997-4321-6462',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Woe Strider', 'Kheru Goldkeeper'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Kheru Goldkeeper makes a Treasure when the Cat leaves the graveyard, and Academy '
        + 'Manufactor turns that Treasure into a Clue, a Food and a Treasure — the Food '
        + 'replacing the one spent returning the Cat. Woe Strider eats the Cat for free, which '
        + 'is all the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite lifeloss', 'Infinite card draw', 'Infinite draw triggers',
        'Infinite Clue tokens', 'Infinite Treasure tokens', 'Infinite colored mana',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Cauldron Familiar', 'Yahenni, Undying Partisan', 'Kheru Goldkeeper'],
      confidence: 'verified',
      from: {
        id: '856-3967-4321-6462',
        cards: ['Peregrin Took', 'Cauldron Familiar', 'Yahenni, Undying Partisan', 'Kheru Goldkeeper'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Kheru Goldkeeper makes a Treasure when the Cat leaves the graveyard, and Academy '
        + 'Manufactor turns that Treasure into a Clue, a Food and a Treasure — the Food '
        + 'replacing the one spent returning the Cat. Yahenni, Undying Partisan eats the Cat '
        + 'for free, which is all the loop asks of the outlet.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite lifegain triggers', 'Infinite lifegain',
        'Infinite lifeloss', 'Infinite card draw', 'Infinite draw triggers',
        'Infinite Clue tokens', 'Infinite Treasure tokens', 'Infinite colored mana',
      ],
    },
    // ---- the Bootleggers' Stash loop, four lands and Toph ---------------------
    //
    // Bootleggers' Stash gives every land "{T}: Create a Treasure token", Clock of
    // Omens untaps an artifact for two untapped artifacts, and an artifact land is
    // both. One Treasure is one short; Academy Manufactor makes it three.
    //
    // Spellbook publishes this with Peregrin Took for eight artifact lands and with
    // Academy Manufactor for four of them. The rows below are the other four and the
    // Toph variant, where the Stash is itself the artifact being tapped. The evidence
    // is as strong as it gets in this file: the same loop with a different artifact
    // land in it is already published under her name.

    {
      cards: ['Bootleggers\' Stash', 'Academy Manufactor', 'Clock of Omens', 'Ancient Den'],
      confidence: 'verified',
      from: {
        id: '596-1651-3340-4231',
        cards: ['Bootleggers\' Stash', 'Academy Manufactor', 'Clock of Omens', 'Darksteel Citadel'],
      },
      swap: { out: 'Darksteel Citadel', in: 'Ancient Den', inId: 1361 },
      why: 'Ancient Den is an artifact land like Darksteel Citadel, so Bootleggers\' Stash gives '
        + 'it “{T}: Create a Treasure token” the same way and Academy Manufactor turns that '
        + 'Treasure into three tokens — one more than Clock of Omens needs to untap the land '
        + 'again. Spellbook publishes this with Academy Manufactor for four of the eight '
        + 'artifact lands it publishes it with Peregrin Took for, and this is one of the other '
        + 'four.',
      produces: [
        'Infinite card draw', 'Infinite Clue tokens', 'Infinite colored mana',
        'Infinite draw triggers', 'Infinite Food tokens', 'Infinite lifegain',
        'Infinite lifegain triggers', 'Infinite mana artifacts you control can produce',
        'Infinite Treasure tokens', 'Infinite untap of artifacts you control',
      ],
    },
    {
      cards: ['Bootleggers\' Stash', 'Academy Manufactor', 'Clock of Omens', 'Great Furnace'],
      confidence: 'verified',
      from: {
        id: '596-1651-3340-4231',
        cards: ['Bootleggers\' Stash', 'Academy Manufactor', 'Clock of Omens', 'Darksteel Citadel'],
      },
      swap: { out: 'Darksteel Citadel', in: 'Great Furnace', inId: 3281 },
      why: 'Great Furnace is an artifact land like Darksteel Citadel, so Bootleggers\' Stash '
        + 'gives it “{T}: Create a Treasure token” the same way and Academy Manufactor turns '
        + 'that Treasure into three tokens — one more than Clock of Omens needs to untap the '
        + 'land again. Spellbook publishes this with Academy Manufactor for four of the eight '
        + 'artifact lands it publishes it with Peregrin Took for, and this is one of the other '
        + 'four.',
      produces: [
        'Infinite card draw', 'Infinite Clue tokens', 'Infinite colored mana',
        'Infinite draw triggers', 'Infinite Food tokens', 'Infinite lifegain',
        'Infinite lifegain triggers', 'Infinite mana artifacts you control can produce',
        'Infinite Treasure tokens', 'Infinite untap of artifacts you control',
      ],
    },
    {
      cards: ['Bootleggers\' Stash', 'Academy Manufactor', 'Clock of Omens', 'Seat of the Synod'],
      confidence: 'verified',
      from: {
        id: '596-1651-3340-4231',
        cards: ['Bootleggers\' Stash', 'Academy Manufactor', 'Clock of Omens', 'Darksteel Citadel'],
      },
      swap: { out: 'Darksteel Citadel', in: 'Seat of the Synod', inId: 2119 },
      why: 'Seat of the Synod is an artifact land like Darksteel Citadel, so Bootleggers\' Stash '
        + 'gives it “{T}: Create a Treasure token” the same way and Academy Manufactor turns '
        + 'that Treasure into three tokens — one more than Clock of Omens needs to untap the '
        + 'land again. Spellbook publishes this with Academy Manufactor for four of the eight '
        + 'artifact lands it publishes it with Peregrin Took for, and this is one of the other '
        + 'four.',
      produces: [
        'Infinite card draw', 'Infinite Clue tokens', 'Infinite colored mana',
        'Infinite draw triggers', 'Infinite Food tokens', 'Infinite lifegain',
        'Infinite lifegain triggers', 'Infinite mana artifacts you control can produce',
        'Infinite Treasure tokens', 'Infinite untap of artifacts you control',
      ],
    },
    {
      cards: ['Bootleggers\' Stash', 'Academy Manufactor', 'Clock of Omens', 'Vault of Whispers'],
      confidence: 'verified',
      from: {
        id: '596-1651-3340-4231',
        cards: ['Bootleggers\' Stash', 'Academy Manufactor', 'Clock of Omens', 'Darksteel Citadel'],
      },
      swap: { out: 'Darksteel Citadel', in: 'Vault of Whispers', inId: 916 },
      why: 'Vault of Whispers is an artifact land like Darksteel Citadel, so Bootleggers\' Stash '
        + 'gives it “{T}: Create a Treasure token” the same way and Academy Manufactor turns '
        + 'that Treasure into three tokens — one more than Clock of Omens needs to untap the '
        + 'land again. Spellbook publishes this with Academy Manufactor for four of the eight '
        + 'artifact lands it publishes it with Peregrin Took for, and this is one of the other '
        + 'four.',
      produces: [
        'Infinite card draw', 'Infinite Clue tokens', 'Infinite colored mana',
        'Infinite draw triggers', 'Infinite Food tokens', 'Infinite lifegain',
        'Infinite lifegain triggers', 'Infinite mana artifacts you control can produce',
        'Infinite Treasure tokens', 'Infinite untap of artifacts you control',
      ],
    },
    {
      cards: ['Toph, the First Metalbender', 'Bootleggers\' Stash', 'Clock of Omens', 'Academy Manufactor'],
      confidence: 'verified',
      from: {
        id: '1651-3340-4772-6871',
        cards: ['Toph, the First Metalbender', 'Bootleggers\' Stash', 'Clock of Omens', 'Doubling Season'],
      },
      swap: { out: 'Doubling Season', in: 'Academy Manufactor', inId: 4231 },
      why: 'Toph makes Bootleggers\' Stash a land, so it taps for a Treasure itself. Doubling '
        + 'Season turns that into the two untapped artifacts Clock of Omens needs; Academy '
        + 'Manufactor turns it into three — a Clue, a Food and a Treasure — which is two with '
        + 'one left over. Spellbook publishes the Manufactor version of this loop already, with '
        + 'an artifact land in place of Toph.',
      produces: [
        'Infinite card draw', 'Infinite Clue tokens', 'Infinite colored mana',
        'Infinite draw triggers', 'Infinite Food tokens', 'Infinite lifegain',
        'Infinite lifegain triggers', 'Infinite mana artifacts you control can produce',
        'Infinite Treasure tokens', 'Infinite untap of artifacts you control',
      ],
    },
    // ---- and two singles, the same swap ---------------------------------------
    {
      cards: ['Urza, Prince of Kroog', 'Magic Pot', 'Academy Manufactor', 'Krark-Clan Ironworks'],
      confidence: 'verified',
      from: {
        id: '2043-4321-4659-6671',
        cards: ['Urza, Prince of Kroog', 'Magic Pot', 'Peregrin Took', 'Krark-Clan Ironworks'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Urza pays {6} for a token copy of Magic Pot, Krark-Clan Ironworks eats it for '
        + '{C}{C}, and the copy dying makes a Treasure. Peregrin Took gets 8 mana back out of '
        + '{6} by adding a Food to each of the two creations; Academy Manufactor cannot see the '
        + 'Soldier copy at all, but it turns the one Treasure into three artifacts, which is '
        + 'the same 8. Only the route differs.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana',
        'Infinite sacrifice triggers', 'Infinite death triggers', 'Infinite colorless mana',
        'Infinite creature tokens', 'Infinite Treasure tokens',
        'Infinite creature copies of artifacts you control', 'Infinite lifegain triggers',
        'Infinite lifegain', 'Infinite card draw', 'Infinite draw triggers',
        'Infinite Food tokens', 'Infinite Clue tokens',
      ],
    },
    {
      cards: ['Stridehangar Automaton', 'Warren Soultrader', 'Academy Manufactor'],
      confidence: 'verified',
      from: {
        id: '4321-5670-6291',
        cards: ['Stridehangar Automaton', 'Warren Soultrader', 'Peregrin Took'],
      },
      swap: { out: 'Peregrin Took', in: 'Academy Manufactor', inId: 4231 },
      why: 'Warren Soultrader pays 1 life and eats a Thopter for a Treasure; Stridehangar '
        + 'Automaton hands the Thopter back inside that creation, and the Food is what pays the '
        + 'life back. Academy Manufactor makes exactly the Food Peregrin Took makes — one per '
        + 'Treasure created — and a Clue on top of it, so it is the same loop with one more '
        + 'token in it.',
      produces: [
        'Infinite ETB', 'Infinite Food tokens', 'Infinite LTB', 'Infinite Treasure tokens',
        'Infinite card draw', 'Infinite colored mana', 'Infinite death triggers',
        'Infinite draw triggers', 'Infinite lifegain', 'Infinite lifegain triggers',
        'Infinite sacrifice triggers', 'Infinite Clue tokens',
      ],
    },

    // ---- Ulvenwald Mysteries, nine outlets behind Eloise ----------------------
    //
    // Not a Peregrin Took swap at all, but the same hole one shelf over. Three cards
    // turn a creature death into a Clue or a Treasure beside Cauldron Familiar and
    // Academy Manufactor, and Spellbook enumerates the sacrifice outlet slot for each
    // of them separately: fifteen for Eloise, Nephalia Sleuth, fifteen for Pitiless
    // Plunderer, six for Ulvenwald Mysteries. The nine missing from the third list are
    // below, each citing the Eloise combo with the same outlet in it.
    //
    // The two cards differ in one word that this loop does not reach — Eloise counts
    // "another creature you control", Ulvenwald Mysteries counts a "nontoken" one, and
    // the Cat is both. Ulvenwald Mysteries has no surveil, and turns a sacrificed Clue
    // into a Human Soldier, which is where the creature tokens come from; drawing a
    // card for each Clue is what keeps that near-infinite rather than infinite.
    //
    // The published Ulvenwald Mysteries rows drop the lifegain and the lifeloss that
    // the Eloise rows carry. That is Spellbook's inconsistency and not a difference
    // between the cards — Cauldron Familiar drains for one every time it enters,
    // whichever card is investigating — so these keep them.

    {
      cards: ['Ulvenwald Mysteries', 'Cauldron Familiar', 'Academy Manufactor', 'Bartolomé del Presidio'],
      confidence: 'verified',
      from: {
        id: '856-1808-2921-4231',
        cards: ['Eloise, Nephalia Sleuth', 'Cauldron Familiar', 'Academy Manufactor', 'Bartolomé del Presidio'],
      },
      swap: { out: 'Eloise, Nephalia Sleuth', in: 'Ulvenwald Mysteries', inId: 5267 },
      why: 'Eloise investigates whenever another creature you control dies; Ulvenwald Mysteries '
        + 'investigates whenever a nontoken creature you control does, and Cauldron Familiar is '
        + 'nontoken. Academy Manufactor turns either Clue into a Clue, a Food and a Treasure, '
        + 'and the Food returns the Cat. Spellbook publishes the Ulvenwald Mysteries version '
        + 'for six outlets and the Eloise version for fifteen; Bartolomé del Presidio is in the '
        + 'second list and not the first.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana',
        'Infinite sacrifice triggers', 'Infinite death triggers',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite card draw',
        'Infinite lifeloss', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite Clue tokens', 'Infinite +1/+1 counters on a creature',
        'Near-infinite creature tokens',
      ],
    },
    {
      cards: ['Ulvenwald Mysteries', 'Cauldron Familiar', 'Academy Manufactor', 'Blasting Station'],
      confidence: 'verified',
      from: {
        id: '413-856-1808-4231',
        cards: ['Eloise, Nephalia Sleuth', 'Cauldron Familiar', 'Academy Manufactor', 'Blasting Station'],
      },
      swap: { out: 'Eloise, Nephalia Sleuth', in: 'Ulvenwald Mysteries', inId: 5267 },
      why: 'Eloise investigates whenever another creature you control dies; Ulvenwald Mysteries '
        + 'investigates whenever a nontoken creature you control does, and Cauldron Familiar is '
        + 'nontoken. Academy Manufactor turns either Clue into a Clue, a Food and a Treasure, '
        + 'and the Food returns the Cat. Spellbook publishes the Ulvenwald Mysteries version '
        + 'for six outlets and the Eloise version for fifteen; Blasting Station is in the '
        + 'second list and not the first.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana',
        'Infinite sacrifice triggers', 'Infinite death triggers', 'Infinite damage',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite card draw',
        'Infinite lifeloss', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite Clue tokens', 'Near-infinite creature tokens',
      ],
    },
    {
      cards: ['Ulvenwald Mysteries', 'Cauldron Familiar', 'Academy Manufactor', 'Bloodflow Connoisseur'],
      confidence: 'verified',
      from: {
        id: '856-1808-2511-4231',
        cards: ['Eloise, Nephalia Sleuth', 'Cauldron Familiar', 'Academy Manufactor', 'Bloodflow Connoisseur'],
      },
      swap: { out: 'Eloise, Nephalia Sleuth', in: 'Ulvenwald Mysteries', inId: 5267 },
      why: 'Eloise investigates whenever another creature you control dies; Ulvenwald Mysteries '
        + 'investigates whenever a nontoken creature you control does, and Cauldron Familiar is '
        + 'nontoken. Academy Manufactor turns either Clue into a Clue, a Food and a Treasure, '
        + 'and the Food returns the Cat. Spellbook publishes the Ulvenwald Mysteries version '
        + 'for six outlets and the Eloise version for fifteen; Bloodflow Connoisseur is in the '
        + 'second list and not the first.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana',
        'Infinite sacrifice triggers', 'Infinite death triggers',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite card draw',
        'Infinite lifeloss', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite +1/+1 counters on a creature', 'Infinite Clue tokens',
        'Near-infinite creature tokens',
      ],
    },
    {
      cards: ['Ulvenwald Mysteries', 'Cauldron Familiar', 'Academy Manufactor', 'Phantom Train'],
      confidence: 'verified',
      from: {
        id: '856-1808-4231-6797',
        cards: ['Eloise, Nephalia Sleuth', 'Cauldron Familiar', 'Academy Manufactor', 'Phantom Train'],
      },
      swap: { out: 'Eloise, Nephalia Sleuth', in: 'Ulvenwald Mysteries', inId: 5267 },
      why: 'Eloise investigates whenever another creature you control dies; Ulvenwald Mysteries '
        + 'investigates whenever a nontoken creature you control does, and Cauldron Familiar is '
        + 'nontoken. Academy Manufactor turns either Clue into a Clue, a Food and a Treasure, '
        + 'and the Food returns the Cat. Spellbook publishes the Ulvenwald Mysteries version '
        + 'for six outlets and the Eloise version for fifteen; Phantom Train is in the second '
        + 'list and not the first.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana',
        'Infinite sacrifice triggers', 'Infinite death triggers',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite card draw',
        'Infinite lifeloss', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite Clue tokens', 'Infinite +1/+1 counters on a creature',
        'Near-infinite creature tokens',
      ],
    },
    {
      cards: ['Ulvenwald Mysteries', 'Cauldron Familiar', 'Academy Manufactor', 'Shilgengar, Sire of Famine'],
      confidence: 'verified',
      from: {
        id: '856-1808-4231-5686',
        cards: ['Eloise, Nephalia Sleuth', 'Cauldron Familiar', 'Academy Manufactor', 'Shilgengar, Sire of Famine'],
      },
      swap: { out: 'Eloise, Nephalia Sleuth', in: 'Ulvenwald Mysteries', inId: 5267 },
      why: 'Eloise investigates whenever another creature you control dies; Ulvenwald Mysteries '
        + 'investigates whenever a nontoken creature you control does, and Cauldron Familiar is '
        + 'nontoken. Academy Manufactor turns either Clue into a Clue, a Food and a Treasure, '
        + 'and the Food returns the Cat. Spellbook publishes the Ulvenwald Mysteries version '
        + 'for six outlets and the Eloise version for fifteen; Shilgengar, Sire of Famine is in '
        + 'the second list and not the first.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana',
        'Infinite sacrifice triggers', 'Infinite death triggers',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite card draw',
        'Infinite lifeloss', 'Infinite self-discard triggers', 'Infinite draw triggers',
        'Infinite Treasure tokens', 'Infinite rummaging', 'Infinite Clue tokens',
        'Infinite Blood tokens', 'Near-infinite creature tokens',
      ],
    },
    {
      cards: ['Ulvenwald Mysteries', 'Cauldron Familiar', 'Academy Manufactor', 'Thermopod'],
      confidence: 'verified',
      from: {
        id: '856-1808-4231-5231',
        cards: ['Eloise, Nephalia Sleuth', 'Cauldron Familiar', 'Academy Manufactor', 'Thermopod'],
      },
      swap: { out: 'Eloise, Nephalia Sleuth', in: 'Ulvenwald Mysteries', inId: 5267 },
      why: 'Eloise investigates whenever another creature you control dies; Ulvenwald Mysteries '
        + 'investigates whenever a nontoken creature you control does, and Cauldron Familiar is '
        + 'nontoken. Academy Manufactor turns either Clue into a Clue, a Food and a Treasure, '
        + 'and the Food returns the Cat. Spellbook publishes the Ulvenwald Mysteries version '
        + 'for six outlets and the Eloise version for fifteen; Thermopod is in the second list '
        + 'and not the first.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana',
        'Infinite sacrifice triggers', 'Infinite death triggers',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite card draw',
        'Infinite lifeloss', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite Clue tokens', 'Near-infinite creature tokens',
      ],
    },
    {
      cards: ['Ulvenwald Mysteries', 'Cauldron Familiar', 'Academy Manufactor', 'Umbral Collar Zealot'],
      confidence: 'verified',
      from: {
        id: '856-1808-4231-6798',
        cards: ['Eloise, Nephalia Sleuth', 'Cauldron Familiar', 'Academy Manufactor', 'Umbral Collar Zealot'],
      },
      swap: { out: 'Eloise, Nephalia Sleuth', in: 'Ulvenwald Mysteries', inId: 5267 },
      why: 'Eloise investigates whenever another creature you control dies; Ulvenwald Mysteries '
        + 'investigates whenever a nontoken creature you control does, and Cauldron Familiar is '
        + 'nontoken. Academy Manufactor turns either Clue into a Clue, a Food and a Treasure, '
        + 'and the Food returns the Cat. Spellbook publishes the Ulvenwald Mysteries version '
        + 'for six outlets and the Eloise version for fifteen; Umbral Collar Zealot is in the '
        + 'second list and not the first.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana',
        'Infinite sacrifice triggers', 'Infinite death triggers',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite card draw',
        'Infinite lifeloss', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite Clue tokens', 'Near-infinite creature tokens',
      ],
    },
    {
      cards: ['Ulvenwald Mysteries', 'Cauldron Familiar', 'Academy Manufactor', 'Woe Strider'],
      confidence: 'verified',
      from: {
        id: '856-997-1808-4231',
        cards: ['Eloise, Nephalia Sleuth', 'Cauldron Familiar', 'Academy Manufactor', 'Woe Strider'],
      },
      swap: { out: 'Eloise, Nephalia Sleuth', in: 'Ulvenwald Mysteries', inId: 5267 },
      why: 'Eloise investigates whenever another creature you control dies; Ulvenwald Mysteries '
        + 'investigates whenever a nontoken creature you control does, and Cauldron Familiar is '
        + 'nontoken. Academy Manufactor turns either Clue into a Clue, a Food and a Treasure, '
        + 'and the Food returns the Cat. Spellbook publishes the Ulvenwald Mysteries version '
        + 'for six outlets and the Eloise version for fifteen; Woe Strider is in the second '
        + 'list and not the first.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana',
        'Infinite sacrifice triggers', 'Infinite death triggers',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite card draw',
        'Infinite lifeloss', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite Clue tokens', 'Near-infinite creature tokens',
      ],
    },
    {
      cards: ['Ulvenwald Mysteries', 'Cauldron Familiar', 'Academy Manufactor', 'Yahenni, Undying Partisan'],
      confidence: 'verified',
      from: {
        id: '856-1808-3967-4231',
        cards: ['Eloise, Nephalia Sleuth', 'Cauldron Familiar', 'Academy Manufactor', 'Yahenni, Undying Partisan'],
      },
      swap: { out: 'Eloise, Nephalia Sleuth', in: 'Ulvenwald Mysteries', inId: 5267 },
      why: 'Eloise investigates whenever another creature you control dies; Ulvenwald Mysteries '
        + 'investigates whenever a nontoken creature you control does, and Cauldron Familiar is '
        + 'nontoken. Academy Manufactor turns either Clue into a Clue, a Food and a Treasure, '
        + 'and the Food returns the Cat. Spellbook publishes the Ulvenwald Mysteries version '
        + 'for six outlets and the Eloise version for fifteen; Yahenni, Undying Partisan is in '
        + 'the second list and not the first.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana',
        'Infinite sacrifice triggers', 'Infinite death triggers',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite card draw',
        'Infinite lifeloss', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite Clue tokens', 'Near-infinite creature tokens',
      ],
    },

    // ---- Spawning Pit, the outlet four families leave out ---------------------
    //
    // The last one is not an engine but an outlet. Spellbook fills the free-sacrifice
    // slot of the Cauldron Familiar loop by name, and behind Peregrin Took the list
    // runs to sixteen cards with Spawning Pit among them. Behind Samwise Gamgee it is
    // sixteen without it, and behind Academy Manufactor it is fifteen without it, three
    // times over. Nothing about the card explains the difference: "Sacrifice a creature:
    // Put a charge counter on Spawning Pit" is free, repeatable, and unfussy about what
    // it eats, which is the entire job.

    {
      cards: ['Samwise Gamgee', 'Cauldron Familiar', 'Spawning Pit'],
      confidence: 'verified',
      from: {
        id: '856-2292-5270',
        cards: ['Samwise Gamgee', 'Cauldron Familiar', 'Viscera Seer'],
      },
      swap: { out: 'Viscera Seer', in: 'Spawning Pit', inId: 3899 },
      why: 'Spawning Pit reads “Sacrifice a creature: Put a charge counter on Spawning Pit” — '
        + 'free, repeatable, and it will eat the Cat, which is everything Viscera Seer does '
        + 'here bar the scry. Spellbook enumerates sixteen outlets for this loop behind '
        + 'Peregrin Took and includes Spawning Pit in every one of them; the Samwise Gamgee '
        + 'version also lists sixteen, but a different sixteen — Warren Soultrader is on it '
        + 'and Spawning Pit is not.',
      produces: [
        'Infinite death triggers', 'Infinite ETB', 'Infinite lifegain',
        'Infinite lifegain triggers', 'Infinite lifeloss', 'Infinite LTB',
        'Infinite sacrifice triggers', 'Infinite charge counters on a permanent',
      ],
    },
    {
      cards: ['Eloise, Nephalia Sleuth', 'Cauldron Familiar', 'Academy Manufactor', 'Spawning Pit'],
      confidence: 'verified',
      from: {
        id: '856-1808-2292-4231',
        cards: ['Eloise, Nephalia Sleuth', 'Cauldron Familiar', 'Academy Manufactor', 'Viscera Seer'],
      },
      swap: { out: 'Viscera Seer', in: 'Spawning Pit', inId: 3899 },
      why: 'Spawning Pit reads “Sacrifice a creature: Put a charge counter on Spawning Pit” — '
        + 'free, repeatable, and it will eat the Cat, which is everything Viscera Seer does '
        + 'here bar the scry. Spellbook enumerates sixteen outlets for this loop behind '
        + 'Peregrin Took and includes Spawning Pit in every one of them; the Eloise, Nephalia '
        + 'Sleuth and Academy Manufactor version stops at fifteen and leaves it out.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite colored mana',
        'Infinite sacrifice triggers', 'Infinite death triggers',
        'Infinite lifegain triggers', 'Infinite lifegain', 'Infinite card draw',
        'Infinite lifeloss', 'Infinite draw triggers', 'Infinite Treasure tokens',
        'Infinite Clue tokens', 'Infinite surveil',
        'Infinite charge counters on a permanent',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Pitiless Plunderer', 'Cauldron Familiar', 'Spawning Pit'],
      confidence: 'verified',
      from: {
        id: '856-2292-4231-4871',
        cards: ['Academy Manufactor', 'Pitiless Plunderer', 'Cauldron Familiar', 'Viscera Seer'],
      },
      swap: { out: 'Viscera Seer', in: 'Spawning Pit', inId: 3899 },
      why: 'Spawning Pit reads “Sacrifice a creature: Put a charge counter on Spawning Pit” — '
        + 'free, repeatable, and it will eat the Cat, which is everything Viscera Seer does '
        + 'here bar the scry. Spellbook enumerates sixteen outlets for this loop behind '
        + 'Peregrin Took and includes Spawning Pit in every one of them; the Academy Manufactor '
        + 'and Pitiless Plunderer version stops at fifteen and leaves it out.',
      produces: [
        'Infinite colored mana', 'Infinite death triggers', 'Infinite ETB',
        'Infinite lifegain', 'Infinite lifegain triggers', 'Infinite lifeloss',
        'Infinite LTB', 'Infinite sacrifice triggers', 'Infinite Treasure tokens',
        'Infinite charge counters on a permanent',
      ],
    },
    {
      cards: ['Academy Manufactor', 'Ulvenwald Mysteries', 'Cauldron Familiar', 'Spawning Pit'],
      confidence: 'verified',
      from: {
        id: '856-2292-4231-5267',
        cards: ['Academy Manufactor', 'Ulvenwald Mysteries', 'Cauldron Familiar', 'Viscera Seer'],
      },
      swap: { out: 'Viscera Seer', in: 'Spawning Pit', inId: 3899 },
      why: 'Spawning Pit reads “Sacrifice a creature: Put a charge counter on Spawning Pit” — '
        + 'free, repeatable, and it will eat the Cat, which is everything Viscera Seer does '
        + 'here bar the scry. Spellbook enumerates sixteen outlets for this loop behind '
        + 'Peregrin Took and includes Spawning Pit in every one of them; the Academy Manufactor '
        + 'and Ulvenwald Mysteries version stops at fifteen and leaves it out.',
      produces: [
        'Infinite card draw', 'Infinite Clue tokens', 'Infinite colored mana',
        'Infinite death triggers', 'Infinite draw triggers', 'Infinite ETB', 'Infinite LTB',
        'Infinite sacrifice triggers', 'Infinite Treasure tokens',
        'Near-infinite creature tokens', 'Infinite charge counters on a permanent',
      ],
    },

    // ---- Experimental Confectioner, the other way round ----------------------
    //
    // The Camellia pass looked for shapes she lacked. These are the four he lacks
    // and she has. Ygra turns every other creature into a Food, so the token the
    // loop just made is the next thing the outlet eats — and all four outlets take
    // a Food for free.
    //
    // He triggers per Food where she triggers per sacrifice event, so he is the
    // larger effect and closes anything she closes. The two directions were swept
    // separately because that asymmetry means neither answers for the other.
    {
      cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Wicked Wolf'],
      confidence: 'verified',
      from: {
        id: '5776-5777-6692',
        cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Wicked Wolf'],
      },
      swap: { out: 'Camellia, the Seedmiser', in: 'Experimental Confectioner', inId: 2590 },
      why: 'Ygra makes every other creature a Food, so the token the loop just made is the next thing the outlet eats. Experimental Confectioner reads "whenever you sacrifice a Food" and answers with a Rat; Camellia reads "one or more Foods" and answers with a Squirrel. Both fire once here because the outlet takes one Food at a time, so the two are interchangeable in this shape — and he is the larger effect where a loop ever spends more than one. Read against Ygra, the outlet and both halves of the swap.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Mushroom Watchdogs'],
      confidence: 'verified',
      from: {
        id: '5776-5777-7627',
        cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Mushroom Watchdogs'],
      },
      swap: { out: 'Camellia, the Seedmiser', in: 'Experimental Confectioner', inId: 2590 },
      why: 'Ygra makes every other creature a Food, so the token the loop just made is the next thing the outlet eats. Experimental Confectioner reads "whenever you sacrifice a Food" and answers with a Rat; Camellia reads "one or more Foods" and answers with a Squirrel. Both fire once here because the outlet takes one Food at a time, so the two are interchangeable in this shape — and he is the larger effect where a loop ever spends more than one. Read against Ygra, the outlet and both halves of the swap.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Bill the Pony'],
      confidence: 'verified',
      from: {
        id: '1441-5776-5777',
        cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Bill the Pony'],
      },
      swap: { out: 'Camellia, the Seedmiser', in: 'Experimental Confectioner', inId: 2590 },
      why: 'Ygra makes every other creature a Food, so the token the loop just made is the next thing the outlet eats. Experimental Confectioner reads "whenever you sacrifice a Food" and answers with a Rat; Camellia reads "one or more Foods" and answers with a Squirrel. Both fire once here because the outlet takes one Food at a time, so the two are interchangeable in this shape — and he is the larger effect where a loop ever spends more than one. Read against Ygra, the outlet and both halves of the swap.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Glimmer Bairn'],
      confidence: 'verified',
      from: {
        id: '5776-5777-6716',
        cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Glimmer Bairn'],
      },
      swap: { out: 'Camellia, the Seedmiser', in: 'Experimental Confectioner', inId: 2590 },
      why: 'Ygra makes every other creature a Food, so the token the loop just made is the next thing the outlet eats. Experimental Confectioner reads "whenever you sacrifice a Food" and answers with a Rat; Camellia reads "one or more Foods" and answers with a Squirrel. Both fire once here because the outlet takes one Food at a time, so the two are interchangeable in this shape — and he is the larger effect where a loop ever spends more than one. Read against Ygra, the outlet and both halves of the swap.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinitely large creature until end of turn',
      ],
    },

    // ---- Basking Broodscale, the 38 that survived reading -----------------------
    //
    // The Broodscale sweep had been sitting at kept: 0 with a note admitting the
    // number was provisional — 148 candidates proposed, 12 read, 136 nobody had
    // opened. Reading the other 136 killed 108 of them on five facts and left these
    // 38, so the zero was not a well-covered card. It was an unfinished pass.
    //
    // Broodscale, Scurry Oak and Herd Baloth share a sentence — "whenever one or more
    // +1/+1 counters are put on this creature, you may create a token" — and differ in
    // what the token *is*. Everything below is a loop that never asks. The five facts
    // that killed the other 108 are all the opposite case, and they are in
    // research-log.js with their counts:
    //
    //   the Spawn is 0/1 where the Squirrel is 1/1   38  power, and "a 1/1 creature"
    //   Scurry Oak has evolve and Broodscale has not 38  the counter's only source
    //   Treebeard targets a Halfling or Treefolk     27  Broodscale is an Eldrazi Lizard
    //   the loop reads a GREEN creature entering      3  the Spawn is colourless
    //   Ravenous Baloth sacrifices a BEAST            2  the Spawn is an Eldrazi Spawn
    //
    // Two more are held back rather than written, and the reason is worth keeping: the
    // Arbaaz Mir pair. Spellbook's own step list has a token triggering him, and both
    // Forge and XMage give him "another NONTOKEN historic permanent". The swap is
    // sound either way — Broodscale and Scurry Oak both make tokens, so whatever is
    // true of the published version is true of ours — but a row asserting a loop that
    // cannot be traced is not a row this file writes.
    //
    // ---- The counter is moved by hand, and any creature will do ----------------
    {
      cards: ['Basking Broodscale', 'Ghave, Guru of Spores', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '2034-4186-5189',
        cards: ['Ghave, Guru of Spores', 'Scurry Oak', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Ghave spends {1} and a creature '
        + 'to put the counter on, and {1} and a counter to make the creature — so the loop only '
        + 'asks the engine for a body, and takes it back the same turn. The Eldrazi Spawn is a '
        + 'body, and it also taps itself for {C}, which the Squirrel does not: Ashnod’s Altar has '
        + 'less to do here than in the published version.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },

    // ---- A Food is made alongside the token, and the Food is the mana ----------
    {
      cards: ['Basking Broodscale', 'Greta, Sweettooth Scourge', 'Night of the Sweets\' Revenge', 'Peregrin Took'],
      confidence: 'verified',
      from: {
        id: '4186-4321-6451-6934',
        cards: ['Greta, Sweettooth Scourge', 'Night of the Sweets\' Revenge', 'Peregrin Took', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Peregrin Took adds a Food to '
        + 'whatever token the engine creates, Night of the Sweets’ Revenge taps that Food for '
        + '{G}, and Greta sacrifices the same tapped Food to put the next counter on. Nothing in '
        + 'the cycle reads the engine’s own token at all — it only has to be a token, so that '
        + 'Took’s replacement effect sees it.',
      produces: [
        'Infinite ETB',
        'Infinite creature tokens',
        'Infinite card draw',
        'Infinite draw triggers',
        'Infinite Food tokens',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Greta, Sweettooth Scourge', 'Jaheira, Friend of the Forest', 'Peregrin Took'],
      confidence: 'verified',
      from: {
        id: '1563-4186-4321-6934',
        cards: ['Greta, Sweettooth Scourge', 'Jaheira, Friend of the Forest', 'Peregrin Took', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same cycle with Jaheira '
        + 'supplying the {G} instead: she gives every token “{T}: Add {G}”, and the Food Peregrin '
        + 'Took adds is a token and an artifact, so it taps the turn it arrives. Greta then eats '
        + 'it. Again the engine’s own token is never read.',
      produces: [
        'Infinite ETB',
        'Infinite creature tokens',
        'Infinite card draw',
        'Infinite draw triggers',
        'Infinite Food tokens',
        'Infinite +1/+1 counters on a creature',
      ],
    },

    // ---- Scry is the trigger, and a scry does not care what entered ------------
    {
      cards: ['Basking Broodscale', 'Arwen Undómiel', 'Season of Growth'],
      confidence: 'verified',
      from: {
        id: '1920-2359-3197',
        cards: ['Arwen Undómiel', 'Season of Growth', 'Herd Baloth'],
      },
      swap: { out: 'Herd Baloth', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Season of Growth scries on *a '
        + 'creature* entering with no colour or type clause, and Arwen turns each scry into a '
        + 'counter on target creature. Broodscale is a legal target and the Spawn is a creature, '
        + 'which is the whole of what this loop asks.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite scry 1',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Elrond, Master of Healing', 'Season of Growth'],
      confidence: 'verified',
      from: {
        id: '2359-3197-4167',
        cards: ['Elrond, Master of Healing', 'Season of Growth', 'Herd Baloth'],
      },
      swap: { out: 'Herd Baloth', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same loop with Elrond '
        + 'reading the scry: one card looked at makes X = 1, so one target creature gets the '
        + 'counter. Broodscale is that target.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite scry 1',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Arwen Undómiel', 'Viscera Seer'],
      confidence: 'verified',
      from: {
        id: '1920-2292-4186',
        cards: ['Arwen Undómiel', 'Scurry Oak', 'Viscera Seer'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Viscera Seer scries by eating '
        + 'the token, Arwen turns the scry into the next counter. The outlet is free and takes '
        + 'any creature, and the Spawn is one.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
        'Infinite scry 1',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Arwen Undómiel', 'Woe Strider'],
      confidence: 'verified',
      from: {
        id: '997-1920-4186',
        cards: ['Arwen Undómiel', 'Scurry Oak', 'Woe Strider'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same with Woe Strider, '
        + 'whose “sacrifice another creature” takes the token the engine just made. Free, '
        + 'repeatable, and indifferent to what it eats.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
        'Infinite scry 1',
      ],
    },

    // ---- Proliferate, which reads a counter already there and nothing else -----
    {
      cards: ['Basking Broodscale', 'Xavier Sal, Infested Captain', 'Thornbite Staff'],
      confidence: 'verified',
      from: {
        id: '2178-3143-4186',
        cards: ['Xavier Sal, Infested Captain', 'Scurry Oak', 'Thornbite Staff'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Xavier Sal eats the token to '
        + 'proliferate, Thornbite Staff untaps him on the death. Proliferate adds a counter to '
        + 'anything that already has one, so the engine only has to be holding a +1/+1 counter — '
        + 'and Broodscale’s own adapt puts the first one on.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite copies of creature tokens you control',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite proliferate',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Tainted Observer', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '2034-3517-4186',
        cards: ['Tainted Observer', 'Ashnod\'s Altar', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Tainted Observer proliferates '
        + 'when *another creature you control enters*, for {2}. The Spawn is another creature '
        + 'entering, and it sacrifices itself for {C} on top of the {C}{C} Ashnod’s Altar pays — '
        + 'this loop is cheaper for Broodscale than for the Oak.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite proliferate',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Tainted Observer', 'Mana Echoes'],
      confidence: 'verified',
      from: {
        id: '2440-3517-4186',
        cards: ['Tainted Observer', 'Mana Echoes', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Mana Echoes pays for the '
        + 'proliferate, counting creatures that share a type with the one entering. Every Eldrazi '
        + 'Spawn shares Eldrazi with Broodscale and with every Spawn before it, so the count '
        + 'climbs exactly as the Squirrels’ does.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite proliferate',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Plaguemaw Beast', 'Intruder Alarm'],
      confidence: 'verified',
      from: {
        id: '1636-3654-4186',
        cards: ['Plaguemaw Beast', 'Intruder Alarm', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Plaguemaw Beast taps and eats '
        + 'the token to proliferate; Intruder Alarm untaps him when the next token enters. Both '
        + 'halves read “a creature”, with no clause the Spawn fails.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite proliferate',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Plaguemaw Beast', 'Thornbite Staff'],
      confidence: 'verified',
      from: {
        id: '2178-3654-4186',
        cards: ['Plaguemaw Beast', 'Thornbite Staff', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same, untapped by Thornbite '
        + 'Staff off the death rather than by Intruder Alarm off the entry.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite proliferate',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Roalesk, Apex Hybrid', 'Blade of Shared Souls', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '2034-3008-3048-4186',
        cards: ['Roalesk, Apex Hybrid', 'Blade of Shared Souls', 'Scurry Oak', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Blade of Shared Souls makes a '
        + 'creature a copy of Roalesk, the legend rule kills it, and its death proliferates twice '
        + '— two counter events, two tokens. Proliferate is indifferent to what the engine makes; '
        + 'Ashnod’s Altar pays the equip out of it.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite proliferate',
        'Infinite sacrifice triggers',
      ],
    },

    // ---- The token entering is a life gained, and the life is the counter ------
    {
      cards: ['Basking Broodscale', 'Light of Promise', 'Lunarch Veteran // Luminous Phantom'],
      confidence: 'verified',
      from: {
        id: '338-1939-4186',
        cards: ['Light of Promise', 'Lunarch Veteran // Luminous Phantom', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Lunarch Veteran gains a life on '
        + '*another creature you control* entering, and Light of Promise turns life gained into '
        + 'counters on the creature it enchants. Enchant Broodscale and the Spawn closes it — '
        + 'neither card reads a colour, a type or a power.',
      produces: [
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Lunarch Veteran // Luminous Phantom', 'Sunbond'],
      confidence: 'verified',
      from: {
        id: '1939-4017-4186',
        cards: ['Lunarch Veteran // Luminous Phantom', 'Sunbond', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Sunbond is Light of Promise '
        + 'with a different name and the same sentence, so the loop is the same one.',
      produces: [
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Daxos, Blessed by the Sun', 'Spider-Man, Peter Parker'],
      confidence: 'verified',
      from: {
        id: '671-4186-6824',
        cards: ['Daxos, Blessed by the Sun', 'Scurry Oak', 'Spider-Man, Peter Parker'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Daxos gains a life on another '
        + 'creature entering *or dying*, and Spider-Man turns life gained into a counter on '
        + 'target creature. Broodscale is the target; the Spawn is the creature. Nothing here '
        + 'reads what kind.',
      produces: [
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite lifegain',
        'Infinite creature tokens',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Valentin, Dean of the Vein // Lisette, Dean of the Root', 'Spike Feeder', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '2034-2290-3097-3197',
        cards: ['Valentin, Dean of the Vein // Lisette, Dean of the Root', 'Spike Feeder', 'Herd Baloth', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Herd Baloth', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Spike Feeder trades a counter '
        + 'for 2 life, Lisette pays {1} to turn any life gained into a counter on *each* creature '
        + 'you control — Broodscale among them — and Ashnod’s Altar makes the {1} out of the '
        + 'token. “Each creature you control” is as type-blind as a clause gets.',
      produces: [
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Valentin, Dean of the Vein // Lisette, Dean of the Root', 'Spike Feeder', 'Phyrexian Altar'],
      confidence: 'verified',
      from: {
        id: '2290-3097-4050-4186',
        cards: ['Valentin, Dean of the Vein // Lisette, Dean of the Root', 'Spike Feeder', 'Scurry Oak', 'Phyrexian Altar'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same loop paid for by '
        + 'Phyrexian Altar instead. Its one mana of any colour is more than the {1} Lisette asks '
        + 'for, so the colourless restriction that kills so many Ashnod’s Altar swaps does not '
        + 'arise.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },

    // ---- Peregrin Took’s Food is an artifact, and an artifact entering is the life ----
    {
      cards: ['Basking Broodscale', 'Peregrin Took', 'Heliod, Sun-Crowned', 'Teething Wurmlet'],
      confidence: 'verified',
      from: {
        id: '1274-2685-4186-4321',
        cards: ['Peregrin Took', 'Heliod, Sun-Crowned', 'Teething Wurmlet', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Peregrin Took adds a Food to '
        + 'the token creation, Teething Wurmlet gains a life on the artifact entering, Heliod '
        + 'turns that into a counter on target creature. The engine’s own token is never read — '
        + 'only the Food is — so the Spawn does the Squirrel’s job.',
      produces: [
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite lifegain',
        'Infinite creature tokens',
        'Infinite card draw',
        'Infinite draw triggers',
        'Infinite Food tokens',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Peregrin Took', 'Leonin Elder', 'Heliod, Sun-Crowned'],
      confidence: 'verified',
      from: {
        id: '475-1274-4186-4321',
        cards: ['Peregrin Took', 'Leonin Elder', 'Heliod, Sun-Crowned', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same cycle with Leonin '
        + 'Elder gaining the life off the Food.',
      produces: [
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite lifegain',
        'Infinite creature tokens',
        'Infinite card draw',
        'Infinite draw triggers',
        'Infinite Food tokens',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Peregrin Took', 'Cleric Class', 'Leonin Elder'],
      confidence: 'verified',
      from: {
        id: '104-475-4186-4321',
        cards: ['Peregrin Took', 'Cleric Class', 'Leonin Elder', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same, with Cleric Class at '
        + 'level 2 turning the life into the counter instead of Heliod. It reads “target creature '
        + 'you control”, which Broodscale is.',
      produces: [
        'Infinite card draw',
        'Infinite creature tokens',
        'Infinite draw triggers',
        'Infinite ETB',
        'Infinite Food tokens',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Peregrin Took', 'Archangel of Thune', 'Teething Wurmlet'],
      confidence: 'verified',
      from: {
        id: '2685-2919-4186-4321',
        cards: ['Peregrin Took', 'Archangel of Thune', 'Teething Wurmlet', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Archangel of Thune in the '
        + 'counter slot: it puts one on *each* creature you control, so the engine gets one '
        + 'whatever else is on the board.',
      produces: [
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite lifegain',
        'Infinite creature tokens',
        'Infinite card draw',
        'Infinite draw triggers',
        'Infinite Food tokens',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Peregrin Took', 'Archangel of Thune', 'Leonin Elder'],
      confidence: 'verified',
      from: {
        id: '475-2919-4186-4321',
        cards: ['Peregrin Took', 'Archangel of Thune', 'Leonin Elder', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same pair with Leonin Elder '
        + 'gaining the life.',
      produces: [
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite lifegain',
        'Infinite creature tokens',
        'Infinite card draw',
        'Infinite draw triggers',
        'Infinite Food tokens',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Peregrin Took', 'Pactdoll Terror', 'Heliod, Sun-Crowned'],
      confidence: 'verified',
      from: {
        id: '1274-4186-4321-6830',
        cards: ['Peregrin Took', 'Pactdoll Terror', 'Heliod, Sun-Crowned', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Pactdoll Terror gains the life '
        + 'on “this creature or another artifact you control” entering — the Food again — and '
        + 'Heliod pays it back as a counter.',
      produces: [
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite lifegain',
        'Infinite creature tokens',
        'Infinite card draw',
        'Infinite draw triggers',
        'Infinite Food tokens',
        'Infinite +1/+1 counters on a creature',
        'Infinite lifeloss',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Peregrin Took', 'Archangel of Thune', 'Pactdoll Terror'],
      confidence: 'verified',
      from: {
        id: '2919-4186-4321-6830',
        cards: ['Peregrin Took', 'Archangel of Thune', 'Pactdoll Terror', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same with Archangel of '
        + 'Thune reading the life.',
      produces: [
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite lifegain',
        'Infinite creature tokens',
        'Infinite card draw',
        'Infinite draw triggers',
        'Infinite Food tokens',
        'Infinite lifeloss',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },

    // ---- Biotransference makes the token itself the artifact -------------------
    {
      cards: ['Basking Broodscale', 'Archangel of Thune', 'Biotransference', 'Teething Wurmlet'],
      confidence: 'verified',
      from: {
        id: '549-2685-2919-4186',
        cards: ['Archangel of Thune', 'Biotransference', 'Teething Wurmlet', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Biotransference makes every '
        + 'creature you control an artifact, so the token the engine creates is an artifact '
        + 'entering and Teething Wurmlet gains the life directly — no Food needed. Archangel of '
        + 'Thune returns the counter to each creature, Broodscale included. The clause is '
        + '“creatures you control”, so the Spawn is covered as the Squirrel is.',
      produces: [
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite lifegain',
        'Infinite creature tokens',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Archangel of Thune', 'Pactdoll Terror', 'Biotransference'],
      confidence: 'verified',
      from: {
        id: '549-2919-4186-6830',
        cards: ['Archangel of Thune', 'Pactdoll Terror', 'Biotransference', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same with Pactdoll Terror '
        + 'reading the artifact entering.',
      produces: [
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite lifegain',
        'Infinite creature tokens',
        'Infinite lifeloss',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Archangel of Thune', 'Leonin Elder', 'Biotransference'],
      confidence: 'verified',
      from: {
        id: '475-549-2919-4186',
        cards: ['Archangel of Thune', 'Leonin Elder', 'Biotransference', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same with Leonin Elder '
        + 'reading it.',
      produces: [
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite lifegain',
        'Infinite creature tokens',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },

    // ---- A card drawn is the counter -------------------------------------------
    {
      cards: ['Basking Broodscale', 'Wizard Class', 'Kindred Discovery'],
      confidence: 'verified',
      from: {
        id: '1017-4052-4186',
        cards: ['Wizard Class', 'Kindred Discovery', 'Scurry Oak'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Kindred Discovery names a '
        + 'creature type as it enters and draws on one of that type entering; Wizard Class at '
        + 'level 3 turns each draw into a counter on target creature. Name Eldrazi rather than '
        + 'Squirrel and the loop is unchanged — the type is chosen, not fixed, which is why this '
        + 'swap costs nothing.',
      produces: [
        'Infinite card draw',
        'Infinite draw triggers',
        'Near-infinite +1/+1 counters on a creature',
        'Near-infinite creature tokens',
        'Near-infinite ETB',
      ],
    },

    // ---- Constellation: with Enchanted Evening every token is an enchantment ----
    {
      cards: ['Basking Broodscale', 'Calix, Guided by Fate', 'Enchanted Evening'],
      confidence: 'verified',
      from: {
        id: '860-1462-4186',
        cards: ['Calix, Guided by Fate', 'Scurry Oak', 'Enchanted Evening'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Enchanted Evening makes all '
        + 'permanents enchantments, so the token the engine creates is an enchantment entering '
        + 'and Calix’s constellation puts the next counter on target creature. Neither card reads '
        + 'what the token otherwise is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite creature tokens',
        'Infinite ETB',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Calix, Guided by Fate', 'Rancor', 'Phyrexian Altar'],
      confidence: 'verified',
      from: {
        id: '860-3018-4050-4186',
        cards: ['Calix, Guided by Fate', 'Scurry Oak', 'Rancor', 'Phyrexian Altar'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Rancor is the recurring '
        + 'enchantment instead: enchant the token, sacrifice it to Phyrexian Altar for the mana, '
        + 'Rancor returns to hand off the battlefield, recast it for the constellation trigger. '
        + 'Rancor enchants any creature and the Altar eats any creature.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Eutropia the Twice-Favored', 'Enchanted Evening'],
      confidence: 'verified',
      from: {
        id: '1462-1523-4186',
        cards: ['Eutropia the Twice-Favored', 'Scurry Oak', 'Enchanted Evening'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Eutropia’s constellation in '
        + 'Calix’s place, reading the same Enchanted Evening.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite creature tokens',
        'Infinite ETB',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Eutropia the Twice-Favored', 'Rancor', 'Phyrexian Altar'],
      confidence: 'verified',
      from: {
        id: '1523-3018-4050-4186',
        cards: ['Eutropia the Twice-Favored', 'Scurry Oak', 'Rancor', 'Phyrexian Altar'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. And the Rancor version of the '
        + 'same.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },

    // ---- Steel Overseer counts artifact creatures, and the engine can be made one ----
    {
      cards: ['Basking Broodscale', 'Intruder Alarm', 'Steel Overseer', 'Liquimetal Coating'],
      confidence: 'verified',
      from: {
        id: '662-1102-1636-4186',
        cards: ['Scurry Oak', 'Intruder Alarm', 'Steel Overseer', 'Liquimetal Coating'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. Steel Overseer taps to put a '
        + 'counter on each artifact creature; Liquimetal Coating makes the engine an artifact for '
        + 'the turn; Intruder Alarm untaps the Overseer every time a token enters. Broodscale is '
        + 'as valid a Liquimetal target as the Oak — the Coating reads “target permanent”.',
      produces: [
        'Infinite +1/+1 counters on certain creatures',
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite mana creatures you control can produce',
        'Infinite untap of creatures',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Intruder Alarm', 'Steel Overseer', 'Liquimetal Torque'],
      confidence: 'verified',
      from: {
        id: '486-1102-1636-4186',
        cards: ['Scurry Oak', 'Intruder Alarm', 'Steel Overseer', 'Liquimetal Torque'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same with Liquimetal Torque '
        + 'supplying the artifact-making.',
      produces: [
        'Infinite +1/+1 counters on certain creatures',
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite mana creatures you control can produce',
        'Infinite untap of creatures',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Intruder Alarm', 'Steel Overseer', 'Mycosynth Lattice'],
      confidence: 'verified',
      from: {
        id: '1102-1636-3263-4186',
        cards: ['Scurry Oak', 'Intruder Alarm', 'Steel Overseer', 'Mycosynth Lattice'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same with Mycosynth '
        + 'Lattice, which makes everything an artifact permanently.',
      produces: [
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite mana creatures you control can produce',
        'Infinite untap of creatures',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Intruder Alarm', 'Steel Overseer', 'Biotransference'],
      confidence: 'verified',
      from: {
        id: '549-1102-1636-4186',
        cards: ['Scurry Oak', 'Intruder Alarm', 'Steel Overseer', 'Biotransference'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. The same with Biotransference, '
        + 'which does it for creatures you control.',
      produces: [
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite mana creatures you control can produce',
        'Infinite untap of creatures',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: ['Basking Broodscale', 'Intruder Alarm', 'Steel Overseer', 'Encroaching Mycosynth'],
      confidence: 'verified',
      from: {
        id: '1102-1379-1636-4186',
        cards: ['Scurry Oak', 'Intruder Alarm', 'Steel Overseer', 'Encroaching Mycosynth'],
      },
      swap: { out: 'Scurry Oak', in: 'Basking Broodscale', inId: 5641 },
      why: 'Both cards read “whenever one or more +1/+1 counters are put on this creature, you may '
        + 'create a token”, and both fire once per counter event. And with Encroaching Mycosynth.',
      produces: [
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite mana creatures you control can produce',
        'Infinite untap of creatures',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },

    // ---- Camellia, the 35 the pass found and never wrote down -------------------
    //
    // The Camellia entry in research-log.js is the file's cautionary tale twice over.
    // Its first version ruled out all 37 candidates on a card text nobody had opened;
    // read properly, the difference is batching — she reads "whenever you sacrifice
    // ONE OR MORE Foods" and triggers once per sacrifice event, where Experimental
    // Confectioner reads "whenever you sacrifice A Food" and triggers per Food — and
    // only 2 of the 37 die to it. Then the 35 survivors sat in a note saying they
    // survived, with kept: 0 beside them, because nobody wrote the rows. These are
    // the rows.
    //
    // **Not a STAND_INS rule, and the two rule-outs are the proof.** A stand-in rule
    // is a claim about a card — "this one stands in for that one, wherever the data
    // uses it" — expanded unconditionally against every combo. Camellia does not
    // stand in for Experimental Confectioner unconditionally: Peregrin Took spends
    // three Foods a cycle and Savvy Hunter two, and one Squirrel does not sustain
    // either. A rule would generate exactly those two rows and be wrong about both.
    // The swap holds per shape, not per card, so it is written per shape.
    //
    // ---- One shape, 34 rows: Ygra, Ninja Pizza and a haste enabler ------
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Concordant Crossroads'],
      confidence: 'verified',
      from: {
        id: '1322-2590-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Concordant Crossroads'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Concordant '
        + 'Crossroads is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Tyvar, Jubilant Brawler'],
      confidence: 'verified',
      from: {
        id: '2590-4927-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Tyvar, Jubilant Brawler'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Tyvar, '
        + 'Jubilant Brawler is the haste, which the granted ability needs because it taps; it '
        + 'reads nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Thousand-Year Elixir'],
      confidence: 'verified',
      from: {
        id: '2590-5295-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Thousand-Year Elixir'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Thousand-Year '
        + 'Elixir is the haste, which the granted ability needs because it taps; it reads nothing '
        + 'about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Shang-Chi, Master of Kung Fu'],
      confidence: 'verified',
      from: {
        id: '2590-5776-7313-7730',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Shang-Chi, Master of Kung Fu'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Shang-Chi, '
        + 'Master of Kung Fu is the haste, which the granted ability needs because it taps; it '
        + 'reads nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Akroma\'s Memorial'],
      confidence: 'verified',
      from: {
        id: '2590-3499-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Akroma\'s Memorial'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Akroma\'s '
        + 'Memorial is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Mass Hysteria'],
      confidence: 'verified',
      from: {
        id: '1849-2590-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Mass Hysteria'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Mass Hysteria '
        + 'is the haste, which the granted ability needs because it taps; it reads nothing about '
        + 'what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Urabrask the Hidden'],
      confidence: 'verified',
      from: {
        id: '647-2590-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Urabrask the Hidden'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Urabrask the '
        + 'Hidden is the haste, which the granted ability needs because it taps; it reads nothing '
        + 'about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Rising of the Day'],
      confidence: 'verified',
      from: {
        id: '1879-2590-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Rising of the Day'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Rising of the '
        + 'Day is the haste, which the granted ability needs because it taps; it reads nothing '
        + 'about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Lavaleaper'],
      confidence: 'verified',
      from: {
        id: '2590-5776-7175-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Lavaleaper'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Lavaleaper is '
        + 'the haste, which the granted ability needs because it taps; it reads nothing about '
        + 'what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Dynaheir, Invoker Adept'],
      confidence: 'verified',
      from: {
        id: '2590-4785-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Dynaheir, Invoker Adept'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Dynaheir, '
        + 'Invoker Adept is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Fires of Yavimaya'],
      confidence: 'verified',
      from: {
        id: '2590-5223-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Fires of Yavimaya'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Fires of '
        + 'Yavimaya is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Samut, Voice of Dissent'],
      confidence: 'verified',
      from: {
        id: '1753-2590-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Samut, Voice of Dissent'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Samut, Voice '
        + 'of Dissent is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Roar of Resistance'],
      confidence: 'verified',
      from: {
        id: '2590-4478-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Roar of Resistance'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Roar of '
        + 'Resistance is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Anger'],
      confidence: 'verified',
      from: {
        id: '2590-4068-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Anger'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Anger is the '
        + 'haste, which the granted ability needs because it taps; it reads nothing about what '
        + 'the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Garna, the Bloodflame'],
      confidence: 'verified',
      from: {
        id: '2590-4359-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Garna, the Bloodflame'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Garna, the '
        + 'Bloodflame is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Dragonlord Kolaghan'],
      confidence: 'verified',
      from: {
        id: '1251-2590-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Dragonlord Kolaghan'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Dragonlord '
        + 'Kolaghan is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Maelstrom Wanderer'],
      confidence: 'verified',
      from: {
        id: '955-2590-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Maelstrom Wanderer'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Maelstrom '
        + 'Wanderer is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Purphoros, Bronze-Blooded'],
      confidence: 'verified',
      from: {
        id: '2590-3480-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Purphoros, Bronze-Blooded'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Purphoros, '
        + 'Bronze-Blooded is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Cyclops of Eternal Fury'],
      confidence: 'verified',
      from: {
        id: '2590-4460-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Cyclops of Eternal Fury'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Cyclops of '
        + 'Eternal Fury is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Tannuk, Steadfast Second'],
      confidence: 'verified',
      from: {
        id: '2590-5776-6791-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Tannuk, Steadfast Second'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Tannuk, '
        + 'Steadfast Second is the haste, which the granted ability needs because it taps; it '
        + 'reads nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Gimli\'s Reckless Might'],
      confidence: 'verified',
      from: {
        id: '2590-5776-7296-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Gimli\'s Reckless Might'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Gimli\'s '
        + 'Reckless Might is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Tuktuk Rubblefort'],
      confidence: 'verified',
      from: {
        id: '2590-4885-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Tuktuk Rubblefort'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Tuktuk '
        + 'Rubblefort is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Kratos, God of War'],
      confidence: 'verified',
      from: {
        id: '2590-5776-6968-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Kratos, God of War'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Kratos, God '
        + 'of War is the haste, which the granted ability needs because it taps; it reads nothing '
        + 'about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Hammer of Purphoros'],
      confidence: 'verified',
      from: {
        id: '1115-2590-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Hammer of Purphoros'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Hammer of '
        + 'Purphoros is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Temur Ascendancy'],
      confidence: 'verified',
      from: {
        id: '2079-2590-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Temur Ascendancy'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Temur '
        + 'Ascendancy is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Samut, Tyrant Smasher'],
      confidence: 'verified',
      from: {
        id: '206-2590-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Samut, Tyrant Smasher'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Samut, Tyrant '
        + 'Smasher is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Nahiri\'s Resolve'],
      confidence: 'verified',
      from: {
        id: '2590-4742-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Nahiri\'s Resolve'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Nahiri\'s '
        + 'Resolve is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Fervor'],
      confidence: 'verified',
      from: {
        id: '969-2590-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Fervor'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Fervor is the '
        + 'haste, which the granted ability needs because it taps; it reads nothing about what '
        + 'the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Barbarian Class'],
      confidence: 'verified',
      from: {
        id: '2590-5776-7297-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Barbarian Class'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Barbarian '
        + 'Class is the haste, which the granted ability needs because it taps; it reads nothing '
        + 'about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Phabine, Boss\'s Confidant'],
      confidence: 'verified',
      from: {
        id: '1169-2590-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Phabine, Boss\'s Confidant'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Phabine, '
        + 'Boss\'s Confidant is the haste, which the granted ability needs because it taps; it '
        + 'reads nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Yarus, Roar of the Old Gods'],
      confidence: 'verified',
      from: {
        id: '2590-5434-5776-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Yarus, Roar of the Old Gods'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Yarus, Roar '
        + 'of the Old Gods is the haste, which the granted ability needs because it taps; it '
        + 'reads nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Smellerbee, Rebel Fighter'],
      confidence: 'verified',
      from: {
        id: '2590-5776-7060-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Smellerbee, Rebel Fighter'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Smellerbee, '
        + 'Rebel Fighter is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'The Fire Crystal'],
      confidence: 'verified',
      from: {
        id: '2590-5776-6633-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'The Fire Crystal'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. The Fire '
        + 'Crystal is the haste, which the granted ability needs because it taps; it reads '
        + 'nothing about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ygra, Eater of All', 'Camellia, the Seedmiser', 'Ninja Pizza', 'Frostcliff Siege'],
      confidence: 'verified',
      from: {
        id: '2590-5776-6965-7313',
        cards: ['Ygra, Eater of All', 'Experimental Confectioner', 'Ninja Pizza', 'Frostcliff Siege'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. This loop spends exactly one Food a cycle: Ygra makes every other '
        + 'creature a Food, Ninja Pizza gives Foods “{T}, Sacrifice this artifact: Add one mana '
        + 'of any color”, and the token that comes back is the next Food to eat. One Food, one '
        + 'trigger, one creature back — so the Squirrel does the Rat’s job exactly. Frostcliff '
        + 'Siege is the haste, which the granted ability needs because it taps; it reads nothing '
        + 'about what the token is.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
      ],
    },

    // ---- The other shape the same pass found ----------------------------------
    {
      cards: ['Sam, Loyal Attendant', 'Warren Soultrader', 'Academy Manufactor', 'Camellia, the Seedmiser'],
      confidence: 'verified',
      from: {
        id: '342-2590-4231-5670',
        cards: ['Sam, Loyal Attendant', 'Warren Soultrader', 'Academy Manufactor', 'Experimental Confectioner'],
      },
      swap: { out: 'Experimental Confectioner', in: 'Camellia, the Seedmiser', inId: 5777 },
      why: 'Camellia reads “whenever you sacrifice ONE OR MORE Foods” — one trigger per sacrifice '
        + 'event — where Experimental Confectioner reads “whenever you sacrifice A Food” and '
        + 'triggers per Food. Warren Soultrader eats a creature for a Treasure, Academy '
        + 'Manufactor makes that a Clue, a Food and a Treasure, the Treasure pays the {1} the '
        + 'Food costs with Sam, Loyal Attendant’s discount on it — and exactly ONE Food is '
        + 'sacrificed a cycle. One trigger, one creature back, which is the creature Soultrader '
        + 'eats next. The published step list spends the same single Food.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite lifegain triggers',
        'Infinite lifegain',
        'Infinite Clue tokens',
      ],
    },
  {
    // Bartolomé is Phantom Train's closest true peer, and for once that is a reading
    // rather than a score: both say "sacrifice another artifact or creature", free and
    // repeatable, and both put the counter on themselves where the loop does not care.
    // Nothing in this line needs the outlet to be a Vehicle, an artifact, or tapped.
    cards: ['Dargo, the Shipwrecker', 'Earthcraft', 'Bartolomé del Presidio'],
    confidence: 'verified',
    from: {
      id: '2757-3327-6797',
      cards: ['Phantom Train', 'Dargo, the Shipwrecker', 'Earthcraft'],
    },
    swap: { out: 'Phantom Train', in: 'Bartolomé del Presidio', inId: 2921 },
    why: 'Earthcraft taps Dargo to untap a basic Mountain, which pays the {R} that recasts '
      + 'him from the command zone; Bartolomé eats him for free, and a commander sacrificed '
      + 'this way goes back to the command zone. The arithmetic is what makes it repeat: '
      + 'commander tax adds {2} per cast, and Dargo reads {2} less for each other artifact '
      + 'or creature sacrificed this turn, so every lap adds one cast and one sacrifice and '
      + 'the cost holds where it started. Bartolomé substitutes because the loop only ever '
      + 'asks the outlet to eat another creature for free — Earthcraft taps Dargo, not the '
      + 'outlet, so the Vehicle half of Phantom Train is never used.',
    produces: [
      'Infinite LTB',
      'Infinite ETB',
      'Infinite sacrifice triggers',
      'Infinite +1/+1 counters on a creature',
    ],
  },
  ];

  // ---- cards that are another card under a different name --------------------
  //
  // The rows above are gaps *between* published combos: both cards in the swap
  // appear in the data and only the pairing is missing, so each one is a single
  // combo somebody read and wrote down. These are a different problem.
  //
  // Hammerhead, Maggia Boss appears in none of the 103,675 published combos.
  // Nothing can be measured against him, so no amount of comparing the data
  // would ever propose him — he is here because his text was read, and what it
  // says is that he is a card Spellbook has published 1,674 combos for:
  //
  //   Bartolomé del Presidio  {W}{B}  2/1  Sacrifice another creature or
  //                                        artifact: Put a +1/+1 counter on
  //                                        Bartolomé del Presidio.
  //   Hammerhead, Maggia Boss {1}{B}  2/1  Sacrifice another creature or
  //                                        artifact: Put a +1/+1 counter on
  //                                        Hammerhead.
  //
  // One ability each, the same sentence, the same body. The names, the mana
  // costs and the colours are the whole difference — and the colour is the part
  // that earns its keep, because Hammerhead is mono-black where Bartolomé is
  // white-black, so a Golgari deck can run the ability that Spellbook only ever
  // writes into a combo in Orzhov colours.
  //
  // Carrion Feeder is the second source, and not quite the same claim:
  //
  //   Carrion Feeder          {B}     1/1  This creature can't block.
  //                                        Sacrifice a creature: Put a +1/+1
  //                                        counter on this creature.
  //
  // Free and repeatable the same way, but creatures only where Hammerhead also
  // eats artifacts, and able to eat *itself* where Hammerhead cannot. So it is
  // listed second: a row cites Bartolomé when Spellbook published that version,
  // and falls back to the Feeder for the 215 lines the Feeder has and Bartolomé
  // does not. The direction matters and only runs one way — every Carrion Feeder
  // loop is a Hammerhead loop, and the reverse is not true. The one shape this
  // gets wrong is a loop that sacrifices the Feeder itself, which no longer has
  // an outlet once it does; a sacrifice outlet that eats itself ends the loop
  // rather than continuing it, so there is nothing in the data doing this on
  // purpose, and it is written down here rather than left as a surprise.
  //
  // 1,730 combos come out of the two sources together, deduplicated. Four of
  // them used to be written out by hand above, citing Umbral Collar Zealot —
  // same cost, different rider — and they are gone: this cites the card that
  // matches word for word instead, and covers the other 1,726.
  const STAND_INS = [
    {
      card: 'Hammerhead, Maggia Boss',
      cardId: null,
      confidence: 'verified',
      for: [
        {
          card: 'Bartolomé del Presidio',
          cardId: 2921,
          why: 'Hammerhead and Bartolomé del Presidio have one ability each and it is '
            + 'the same sentence: “Sacrifice another creature or artifact: Put a +1/+1 '
            + 'counter on this creature.” Same cost, free and repeatable, same 2/1 body. '
            + 'Spellbook publishes this combo with Bartolomé and has never used '
            + 'Hammerhead in a combo at all — he is mono-black where Bartolomé is '
            + 'white-black, which is the only difference that reaches the table.',
        },
        {
          card: 'Carrion Feeder',
          cardId: 2438,
          why: 'Carrion Feeder’s ability is “Sacrifice a creature: Put a +1/+1 counter on '
            + 'this creature”, and Hammerhead’s is the same for one card less restrictive '
            + '— he eats artifacts as well. Free and repeatable either way, and a creature '
            + 'is what this loop feeds it. Spellbook publishes the Feeder version and has '
            + 'never used Hammerhead in a combo at all.',
        },
      ],
    },
  ];

  const api = { COMBOS, STAND_INS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.UnofficialCombos = api;
}(typeof self !== 'undefined' ? self : this));
