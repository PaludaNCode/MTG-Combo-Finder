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

    // ---- Ghave, Guru of Spores, against Ulasht, the Hate Seed -----------------
    //
    // Ghave's first ability is Ulasht's with one word changed, and the word is the
    // one that matters:
    //
    //   Ulasht, the Hate Seed   {1}, Remove a +1/+1 counter from Ulasht:
    //                           Create a 1/1 green Saproling creature token.
    //   Ghave, Guru of Spores   {1}, Remove a +1/+1 counter from A CREATURE YOU
    //                           CONTROL: Create a 1/1 green Saproling creature token.
    //
    // Same cost, same token, and Ghave will take the counter off anything. Every
    // loop below puts a counter back on the engine and spends it again, so Ghave
    // runs each of them by taking the counter off himself — and he has a second
    // ability, "{1}, Sacrifice a creature: Put a +1/+1 counter on target creature",
    // which Ulasht has no equivalent of at all.
    //
    // Ulasht's other mode, "deals 1 damage to target creature", is the half Ghave
    // lacks; nothing here uses it. The Ramos lines are the ones worth a second look:
    // they blink the engine to refill its counters, and Ulasht enters with a counter
    // per other red or green creature where Ghave enters with a flat five, so those
    // three work for Ghave on an empty board and for Ulasht only on a full one.
    {
      cards: [
        'Ramos, Dragon Engine',
        'Agatha\'s Soul Cauldron',
        'Deadeye Navigator',
        'Ghave, Guru of Spores',
      ],
      confidence: 'verified',
      from: {
        id: '546-1409-3192-4613',
        cards: [
          'Ramos, Dragon Engine',
          'Agatha\'s Soul Cauldron',
          'Deadeye Navigator',
          'Ulasht, the Hate Seed',
        ],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: ['Infinite ETB', 'Infinite LTB', 'Infinite blinking', 'Infinite colored mana'],
    },
    {
      cards: [
        'Ramos, Dragon Engine',
        'Agatha\'s Soul Cauldron',
        'Emiel the Blessed',
        'Ghave, Guru of Spores',
      ],
      confidence: 'verified',
      from: {
        id: '546-3192-4499-4613',
        cards: [
          'Ramos, Dragon Engine',
          'Agatha\'s Soul Cauldron',
          'Emiel the Blessed',
          'Ulasht, the Hate Seed',
        ],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: ['Infinite ETB', 'Infinite LTB', 'Infinite blinking', 'Infinite colored mana'],
    },
    {
      cards: [
        'Ramos, Dragon Engine',
        'Agatha\'s Soul Cauldron',
        'Lilysplash Mentor',
        'Ghave, Guru of Spores',
      ],
      confidence: 'verified',
      from: {
        id: '546-3192-4613-5900',
        cards: [
          'Ramos, Dragon Engine',
          'Agatha\'s Soul Cauldron',
          'Lilysplash Mentor',
          'Ulasht, the Hate Seed',
        ],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: ['Infinite ETB', 'Infinite LTB', 'Infinite blinking', 'Infinite colored mana'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Death\'s Presence', 'Thermopod'],
      confidence: 'verified',
      from: {
        id: '2249-3192-5231',
        cards: ['Ulasht, the Hate Seed', 'Death\'s Presence', 'Thermopod'],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: ['Infinite death triggers', 'Infinite ETB', 'Infinite LTB', 'Infinite sacrifice triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Agatha\'s Soul Cauldron', 'Wildwood Mentor', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '692-2034-3192-4613',
        cards: ['Ulasht, the Hate Seed', 'Agatha\'s Soul Cauldron', 'Wildwood Mentor', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: [
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Agatha\'s Soul Cauldron', 'Wildwood Mentor', 'Utopia Mycon'],
      confidence: 'verified',
      from: {
        id: '692-3192-4214-4613',
        cards: ['Ulasht, the Hate Seed', 'Agatha\'s Soul Cauldron', 'Wildwood Mentor', 'Utopia Mycon'],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: ['Infinite death triggers', 'Infinite ETB', 'Infinite LTB', 'Infinite sacrifice triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Agatha\'s Soul Cauldron', 'Wildwood Mentor', 'Thermopod'],
      confidence: 'verified',
      from: {
        id: '692-3192-4613-5231',
        cards: ['Ulasht, the Hate Seed', 'Agatha\'s Soul Cauldron', 'Wildwood Mentor', 'Thermopod'],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: ['Infinite death triggers', 'Infinite ETB', 'Infinite LTB', 'Infinite sacrifice triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Agatha\'s Soul Cauldron', 'Wildwood Mentor', 'Phyrexian Altar'],
      confidence: 'verified',
      from: {
        id: '692-3192-4050-4613',
        cards: ['Ulasht, the Hate Seed', 'Agatha\'s Soul Cauldron', 'Wildwood Mentor', 'Phyrexian Altar'],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: ['Infinite death triggers', 'Infinite ETB', 'Infinite LTB', 'Infinite sacrifice triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Blade of the Bloodchief', 'Utopia Mycon'],
      confidence: 'verified',
      from: {
        id: '1988-3192-4214',
        cards: ['Ulasht, the Hate Seed', 'Blade of the Bloodchief', 'Utopia Mycon'],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: ['Infinite death triggers', 'Infinite ETB', 'Infinite LTB', 'Infinite sacrifice triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Blade of the Bloodchief', 'Thermopod'],
      confidence: 'verified',
      from: {
        id: '1988-3192-5231',
        cards: ['Ulasht, the Hate Seed', 'Blade of the Bloodchief', 'Thermopod'],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: ['Infinite death triggers', 'Infinite ETB', 'Infinite LTB', 'Infinite sacrifice triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Blade of the Bloodchief', 'Phyrexian Altar'],
      confidence: 'verified',
      from: {
        id: '1988-3192-4050',
        cards: ['Ulasht, the Hate Seed', 'Blade of the Bloodchief', 'Phyrexian Altar'],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: ['Infinite death triggers', 'Infinite ETB', 'Infinite LTB', 'Infinite sacrifice triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Blade of the Bloodchief', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '1988-2034-3192',
        cards: ['Ulasht, the Hate Seed', 'Blade of the Bloodchief', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: [
        'Infinite colorless mana',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Ghave, Guru of Spores',
        'Slimefoot, the Stowaway',
        'Valentin, Dean of the Vein // Lisette, Dean of the Root',
        'Ashnod\'s Altar',
      ],
      confidence: 'verified',
      from: {
        id: '2034-2775-3097-3192',
        cards: [
          'Ulasht, the Hate Seed',
          'Slimefoot, the Stowaway',
          'Valentin, Dean of the Vein // Lisette, Dean of the Root',
          'Ashnod\'s Altar',
        ],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: [
        'Infinite +1/+1 counters on most creatures you control',
        'Infinite damage',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Cathars\' Crusade', 'Utopia Mycon'],
      confidence: 'verified',
      from: {
        id: '2744-3192-4214',
        cards: ['Ulasht, the Hate Seed', 'Cathars\' Crusade', 'Utopia Mycon'],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: [
        'Infinite +1/+1 counters on most creatures you control',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Slimefoot, the Stowaway', 'Archangel of Thune', 'Utopia Mycon'],
      confidence: 'verified',
      from: {
        id: '2775-2919-3192-4214',
        cards: ['Ulasht, the Hate Seed', 'Slimefoot, the Stowaway', 'Archangel of Thune', 'Utopia Mycon'],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: [
        'Infinite damage',
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
      cards: [
        'Ghave, Guru of Spores',
        'Slimefoot, the Stowaway',
        'Archangel of Thune',
        'Phyrexian Altar',
      ],
      confidence: 'verified',
      from: {
        id: '2775-2919-3192-4050',
        cards: [
          'Ulasht, the Hate Seed',
          'Slimefoot, the Stowaway',
          'Archangel of Thune',
          'Phyrexian Altar',
        ],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: [
        'Infinite damage',
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
      cards: [
        'Ghave, Guru of Spores',
        'Slimefoot, the Stowaway',
        'Archangel of Thune',
        'Ashnod\'s Altar',
      ],
      confidence: 'verified',
      from: {
        id: '2034-2775-2919-3192',
        cards: [
          'Ulasht, the Hate Seed',
          'Slimefoot, the Stowaway',
          'Archangel of Thune',
          'Ashnod\'s Altar',
        ],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: [
        'Infinite colorless mana',
        'Infinite damage',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
        'Infinite creature tokens',
        'Infinite +1/+1 counters on creatures you control',
      ],
    },
    {
      cards: [
        'Ivy Lane Denizen',
        'Ghave, Guru of Spores',
        'Jaheira, Friend of the Forest',
        'Tuktuk Rubblefort',
      ],
      confidence: 'verified',
      from: {
        id: '1563-2850-3192-4885',
        cards: [
          'Ivy Lane Denizen',
          'Ulasht, the Hate Seed',
          'Jaheira, Friend of the Forest',
          'Tuktuk Rubblefort',
        ],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: ['Infinite ETB', 'Infinite tapped creature tokens'],
    },
    {
      cards: [
        'Ivy Lane Denizen',
        'Ghave, Guru of Spores',
        'Jaheira, Friend of the Forest',
        'Fires of Yavimaya',
      ],
      confidence: 'verified',
      from: {
        id: '1563-2850-3192-5223',
        cards: [
          'Ivy Lane Denizen',
          'Ulasht, the Hate Seed',
          'Jaheira, Friend of the Forest',
          'Fires of Yavimaya',
        ],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: ['Infinite ETB', 'Infinite tapped creature tokens'],
    },
    {
      cards: ['Ivy Lane Denizen', 'Ghave, Guru of Spores', 'Jaheira, Friend of the Forest', 'Fervor'],
      confidence: 'verified',
      from: {
        id: '969-1563-2850-3192',
        cards: ['Ivy Lane Denizen', 'Ulasht, the Hate Seed', 'Jaheira, Friend of the Forest', 'Fervor'],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: ['Infinite ETB', 'Infinite tapped creature tokens'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Mazirek, Kraul Death Priest', 'Thermopod'],
      confidence: 'verified',
      from: {
        id: '317-3192-5231',
        cards: ['Ulasht, the Hate Seed', 'Mazirek, Kraul Death Priest', 'Thermopod'],
      },
      swap: { out: 'Ulasht, the Hate Seed', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'Ulasht’s ability is “{1}, Remove a +1/+1 counter from Ulasht: … Create a 1/1 green '
        + 'Saproling creature token” and Ghave’s is “{1}, Remove a +1/+1 counter from a creature '
        + 'you control: Create a 1/1 green Saproling creature token”. Same cost, same token, and '
        + 'Ghave may take the counter off anything he controls where Ulasht may only take it off '
        + 'itself — so every loop that feeds the counter back to Ulasht can feed it to Ghave '
        + 'instead, and Ghave has a second ability that can put it there himself.',
      produces: [
        'Infinite +1/+1 counters on most creatures you control',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },

    // ---- and against the artifact engines, where the doubler carries it --------
    //
    // Pentavus, Thopter Squadron and Triskelavus have Ghave's two abilities fused
    // into one card, and all three are artifacts making artifact tokens, which is
    // what most of their combos are actually about — see the rule-out in
    // research-log.js. These are the shapes where the artifact is not read. A token
    // doubler splits the engine's one token in two: one pays the free outlet, the
    // other pays the ability that puts the counter back. Ghave does both halves,
    // and at instant speed, where Thopter Squadron's two abilities are sorcery-only.
    {
      cards: ['Ghave, Guru of Spores', 'Ashnod\'s Altar', 'Bard, King of Dale'],
      confidence: 'verified',
      from: {
        id: '2034-2762-7824',
        cards: ['Thopter Squadron', 'Ashnod\'s Altar', 'Bard, King of Dale'],
      },
      swap: { out: 'Thopter Squadron', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'A doubler turns the engine’s one token into two: one pays the free outlet, the other '
        + 'pays the ability that puts the counter back. Ghave runs both halves of that — “{1}, '
        + 'Remove a +1/+1 counter from a creature you control: Create a 1/1 green Saproling” and '
        + '“{1}, Sacrifice a creature: Put a +1/+1 counter on target creature” — where Thopter '
        + 'Squadron and Pentavus each read only their own token and only their own counter, and '
        + 'Thopter Squadron’s two abilities are sorcery-speed where Ghave’s are not.',
      produces: ['Infinite ETB', 'Infinite LTB', 'Infinite death triggers', 'Infinite sacrifice triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Krark-Clan Ironworks', 'Bard, King of Dale'],
      confidence: 'verified',
      from: {
        id: '2762-4659-7824',
        cards: ['Thopter Squadron', 'Krark-Clan Ironworks', 'Bard, King of Dale'],
      },
      swap: { out: 'Thopter Squadron', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'A doubler turns the engine’s one token into two: one pays the free outlet, the other '
        + 'pays the ability that puts the counter back. Ghave runs both halves of that — “{1}, '
        + 'Remove a +1/+1 counter from a creature you control: Create a 1/1 green Saproling” and '
        + '“{1}, Sacrifice a creature: Put a +1/+1 counter on target creature” — where Thopter '
        + 'Squadron and Pentavus each read only their own token and only their own counter, and '
        + 'Thopter Squadron’s two abilities are sorcery-speed where Ghave’s are not.',
      produces: ['Infinite ETB', 'Infinite LTB', 'Infinite death triggers', 'Infinite sacrifice triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Kaya, Geist Hunter', 'Krark-Clan Ironworks'],
      confidence: 'verified',
      from: {
        id: '2762-4094-4659',
        cards: ['Thopter Squadron', 'Kaya, Geist Hunter', 'Krark-Clan Ironworks'],
      },
      swap: { out: 'Thopter Squadron', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'A doubler turns the engine’s one token into two: one pays the free outlet, the other '
        + 'pays the ability that puts the counter back. Ghave runs both halves of that — “{1}, '
        + 'Remove a +1/+1 counter from a creature you control: Create a 1/1 green Saproling” and '
        + '“{1}, Sacrifice a creature: Put a +1/+1 counter on target creature” — where Thopter '
        + 'Squadron and Pentavus each read only their own token and only their own counter, and '
        + 'Thopter Squadron’s two abilities are sorcery-speed where Ghave’s are not.',
      produces: ['Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers', 'Infinite death triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Ashnod\'s Altar', 'Kaya, Geist Hunter'],
      confidence: 'verified',
      from: {
        id: '2034-2762-4094',
        cards: ['Thopter Squadron', 'Ashnod\'s Altar', 'Kaya, Geist Hunter'],
      },
      swap: { out: 'Thopter Squadron', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'A doubler turns the engine’s one token into two: one pays the free outlet, the other '
        + 'pays the ability that puts the counter back. Ghave runs both halves of that — “{1}, '
        + 'Remove a +1/+1 counter from a creature you control: Create a 1/1 green Saproling” and '
        + '“{1}, Sacrifice a creature: Put a +1/+1 counter on target creature” — where Thopter '
        + 'Squadron and Pentavus each read only their own token and only their own counter, and '
        + 'Thopter Squadron’s two abilities are sorcery-speed where Ghave’s are not.',
      produces: ['Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers', 'Infinite death triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Krark-Clan Ironworks', 'Exalted Sunborn'],
      confidence: 'verified',
      from: {
        id: '2762-4659-6753',
        cards: ['Thopter Squadron', 'Krark-Clan Ironworks', 'Exalted Sunborn'],
      },
      swap: { out: 'Thopter Squadron', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'A doubler turns the engine’s one token into two: one pays the free outlet, the other '
        + 'pays the ability that puts the counter back. Ghave runs both halves of that — “{1}, '
        + 'Remove a +1/+1 counter from a creature you control: Create a 1/1 green Saproling” and '
        + '“{1}, Sacrifice a creature: Put a +1/+1 counter on target creature” — where Thopter '
        + 'Squadron and Pentavus each read only their own token and only their own counter, and '
        + 'Thopter Squadron’s two abilities are sorcery-speed where Ghave’s are not.',
      produces: ['Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers', 'Infinite death triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Ashnod\'s Altar', 'Exalted Sunborn'],
      confidence: 'verified',
      from: {
        id: '2034-2762-6753',
        cards: ['Thopter Squadron', 'Ashnod\'s Altar', 'Exalted Sunborn'],
      },
      swap: { out: 'Thopter Squadron', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'A doubler turns the engine’s one token into two: one pays the free outlet, the other '
        + 'pays the ability that puts the counter back. Ghave runs both halves of that — “{1}, '
        + 'Remove a +1/+1 counter from a creature you control: Create a 1/1 green Saproling” and '
        + '“{1}, Sacrifice a creature: Put a +1/+1 counter on target creature” — where Thopter '
        + 'Squadron and Pentavus each read only their own token and only their own counter, and '
        + 'Thopter Squadron’s two abilities are sorcery-speed where Ghave’s are not.',
      produces: ['Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers', 'Infinite death triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Krark-Clan Ironworks', 'Elspeth, Storm Slayer'],
      confidence: 'verified',
      from: {
        id: '2762-4659-6441',
        cards: ['Thopter Squadron', 'Krark-Clan Ironworks', 'Elspeth, Storm Slayer'],
      },
      swap: { out: 'Thopter Squadron', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'A doubler turns the engine’s one token into two: one pays the free outlet, the other '
        + 'pays the ability that puts the counter back. Ghave runs both halves of that — “{1}, '
        + 'Remove a +1/+1 counter from a creature you control: Create a 1/1 green Saproling” and '
        + '“{1}, Sacrifice a creature: Put a +1/+1 counter on target creature” — where Thopter '
        + 'Squadron and Pentavus each read only their own token and only their own counter, and '
        + 'Thopter Squadron’s two abilities are sorcery-speed where Ghave’s are not.',
      produces: ['Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers', 'Infinite death triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Ashnod\'s Altar', 'Elspeth, Storm Slayer'],
      confidence: 'verified',
      from: {
        id: '2034-2762-6441',
        cards: ['Thopter Squadron', 'Ashnod\'s Altar', 'Elspeth, Storm Slayer'],
      },
      swap: { out: 'Thopter Squadron', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'A doubler turns the engine’s one token into two: one pays the free outlet, the other '
        + 'pays the ability that puts the counter back. Ghave runs both halves of that — “{1}, '
        + 'Remove a +1/+1 counter from a creature you control: Create a 1/1 green Saproling” and '
        + '“{1}, Sacrifice a creature: Put a +1/+1 counter on target creature” — where Thopter '
        + 'Squadron and Pentavus each read only their own token and only their own counter, and '
        + 'Thopter Squadron’s two abilities are sorcery-speed where Ghave’s are not.',
      produces: ['Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers', 'Infinite death triggers'],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Queen Allenal of Ruadach', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '560-2034-2762',
        cards: ['Thopter Squadron', 'Queen Allenal of Ruadach', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Thopter Squadron', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'A doubler turns the engine’s one token into two: one pays the free outlet, the other '
        + 'pays the ability that puts the counter back. Ghave runs both halves of that — “{1}, '
        + 'Remove a +1/+1 counter from a creature you control: Create a 1/1 green Saproling” and '
        + '“{1}, Sacrifice a creature: Put a +1/+1 counter on target creature” — where Thopter '
        + 'Squadron and Pentavus each read only their own token and only their own counter, and '
        + 'Thopter Squadron’s two abilities are sorcery-speed where Ghave’s are not.',
      produces: ['Infinite death triggers', 'Infinite ETB', 'Infinite LTB', 'Infinite sacrifice triggers'],
    },

    // ---- and the one Earthcraft line -------------------------------------------
    //
    // Earthcraft taps a creature you control to untap a basic land. The cost is
    // Earthcraft's rather than the token's, so a Saproling that just arrived pays it
    // exactly as a Pentavite does, and Intruder Alarm untaps it again on the next
    // token. Pentavus's "{1}, Sacrifice a Pentavite" becomes Ghave's "{1}, Sacrifice
    // a creature", which is the same line one card less restrictive.
    {
      cards: ['Ghave, Guru of Spores', 'Earthcraft', 'Intruder Alarm'],
      confidence: 'verified',
      from: {
        id: '1183-1636-2757',
        cards: ['Pentavus', 'Earthcraft', 'Intruder Alarm'],
      },
      swap: { out: 'Pentavus', in: 'Ghave, Guru of Spores', inId: 5189 },
      why: 'The published loop taps the Pentavite for Earthcraft to untap a basic land, spends '
        + 'that mana on another token, and Intruder Alarm untaps the token when the next one '
        + 'enters. Ghave’s Saproling is a creature Earthcraft can tap exactly as well — the cost '
        + 'is Earthcraft’s, not the token’s, so a Saproling with summoning sickness pays it — '
        + 'and Ghave’s “{1}, Sacrifice a creature” replaces Pentavus’s “{1}, Sacrifice a '
        + 'Pentavite”.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite mana basic lands you control can produce',
        'Infinite mana creatures you control can produce',
        'Infinite sacrifice triggers',
        'Infinite untap of creatures',
      ],
    },

    // ---- Insidious Roots, the half that reads your graveyard -------------------
    //
    // Three cards share its trigger word for word — "whenever one or more CREATURE
    // CARDS leave your graveyard" — and differ only in the token they answer with:
    //
    //   Skeleton Crew      a 2/2 black Skeleton Pirate
    //   Desecrated Tomb    a 1/1 black Bat with flying
    //   Chalk Outline      a 2/2 Detective, then investigate
    //   Insidious Roots    a 0/1 green Plant, then a +1/+1 counter on each Plant
    //
    // So every one of their combos is a candidate and the question is only ever what
    // the token has to be. Here it has to be a creature Shilgengar can eat for the
    // next Blood token, and a 0/1 Plant is one: Shilgengar reads toughness only when
    // what it ate was an Angel. The Blood is the artifact that returns Ovalchase
    // Daredevil, and the discard outlet puts it back.
    {
      cards: [
        'Shilgengar, Sire of Famine',
        'Ovalchase Daredevil',
        'Insidious Roots',
        'Hardened Academic',
      ],
      confidence: 'verified',
      from: {
        id: '4798-5631-5686-7435',
        cards: [
          'Shilgengar, Sire of Famine',
          'Ovalchase Daredevil',
          'Skeleton Crew',
          'Hardened Academic',
        ],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite Blood tokens',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite self-discard triggers',
      ],
    },
    {
      cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Insidious Roots', 'Iron-Shield Elf'],
      confidence: 'verified',
      from: {
        id: '4798-5631-5686-7178',
        cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Skeleton Crew', 'Iron-Shield Elf'],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite Blood tokens',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite self-discard triggers',
      ],
    },
    {
      cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Insidious Roots', 'Aeromoeba'],
      confidence: 'verified',
      from: {
        id: '3365-4798-5631-5686',
        cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Skeleton Crew', 'Aeromoeba'],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite self-discard triggers',
        'Infinite Blood tokens',
      ],
    },
    {
      cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Insidious Roots', 'Psychic Frog'],
      confidence: 'verified',
      from: {
        id: '4798-5631-5636-5686',
        cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Skeleton Crew', 'Psychic Frog'],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite self-discard triggers',
        'Infinite Blood tokens',
        'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: [
        'Shilgengar, Sire of Famine',
        'Ovalchase Daredevil',
        'Insidious Roots',
        'Witch-king of Angmar',
      ],
      confidence: 'verified',
      from: {
        id: '4798-5436-5631-5686',
        cards: [
          'Shilgengar, Sire of Famine',
          'Ovalchase Daredevil',
          'Skeleton Crew',
          'Witch-king of Angmar',
        ],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite self-discard triggers',
        'Infinite Blood tokens',
      ],
    },
    {
      cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Insidious Roots', 'Skirge Familiar'],
      confidence: 'verified',
      from: {
        id: '1742-4798-5631-5686',
        cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Skeleton Crew', 'Skirge Familiar'],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite self-discard triggers',
        'Infinite black mana',
        'Infinite Blood tokens',
        'Infinite draw triggers',
        'Infinite rummaging',
      ],
    },
    {
      cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Insidious Roots', 'Putrid Imp'],
      confidence: 'verified',
      from: {
        id: '4798-5014-5631-5686',
        cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Skeleton Crew', 'Putrid Imp'],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite self-discard triggers',
        'Infinite Blood tokens',
      ],
    },
    {
      cards: [
        'Shilgengar, Sire of Famine',
        'Ovalchase Daredevil',
        'Insidious Roots',
        'Prognostic Sphinx',
      ],
      confidence: 'verified',
      from: {
        id: '4798-5437-5631-5686',
        cards: [
          'Shilgengar, Sire of Famine',
          'Ovalchase Daredevil',
          'Skeleton Crew',
          'Prognostic Sphinx',
        ],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite self-discard triggers',
        'Infinite Blood tokens',
      ],
    },
    {
      cards: [
        'Shilgengar, Sire of Famine',
        'Ovalchase Daredevil',
        'Insidious Roots',
        'Noose Constrictor',
      ],
      confidence: 'verified',
      from: {
        id: '4444-4798-5631-5686',
        cards: [
          'Shilgengar, Sire of Famine',
          'Ovalchase Daredevil',
          'Skeleton Crew',
          'Noose Constrictor',
        ],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite self-discard triggers',
        'Infinite Blood tokens',
        'Infinitely large creature until end of turn',
      ],
    },
    {
      cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Insidious Roots', 'Mind Over Matter'],
      confidence: 'verified',
      from: {
        id: '4067-4798-5631-5686',
        cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Skeleton Crew', 'Mind Over Matter'],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite self-discard triggers',
        'Infinite mana permanents you control can produce',
        'Infinite Blood tokens',
        'Infinite draw triggers',
        'Infinite rummaging',
      ],
    },
    {
      cards: [
        'Shilgengar, Sire of Famine',
        'Ovalchase Daredevil',
        'Insidious Roots',
        'Jadzi, Oracle of Arcavios // Journey to the Oracle',
      ],
      confidence: 'verified',
      from: {
        id: '1401-4798-5631-5686',
        cards: [
          'Shilgengar, Sire of Famine',
          'Ovalchase Daredevil',
          'Skeleton Crew',
          'Jadzi, Oracle of Arcavios // Journey to the Oracle',
        ],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite self-discard triggers',
        'Infinite Blood tokens',
      ],
    },
    {
      cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Insidious Roots', 'Ghostly Pilferer'],
      confidence: 'verified',
      from: {
        id: '3017-4798-5631-5686',
        cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Skeleton Crew', 'Ghostly Pilferer'],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite self-discard triggers',
        'Infinite Blood tokens',
      ],
    },
    {
      cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Insidious Roots', 'Dream Trawler'],
      confidence: 'verified',
      from: {
        id: '4798-5435-5631-5686',
        cards: ['Shilgengar, Sire of Famine', 'Ovalchase Daredevil', 'Skeleton Crew', 'Dream Trawler'],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite self-discard triggers',
        'Infinite Blood tokens',
      ],
    },
    {
      cards: [
        'Shilgengar, Sire of Famine',
        'Ovalchase Daredevil',
        'Insidious Roots',
        'Birgi, God of Storytelling // Harnfel, Horn of Bounty',
      ],
      confidence: 'verified',
      from: {
        id: '392-4798-5631-5686',
        cards: [
          'Shilgengar, Sire of Famine',
          'Ovalchase Daredevil',
          'Skeleton Crew',
          'Birgi, God of Storytelling // Harnfel, Horn of Bounty',
        ],
      },
      swap: { out: 'Skeleton Crew', in: 'Insidious Roots', inId: 5477 },
      why: 'Skeleton Crew and Insidious Roots read the same event — “whenever one or more '
        + 'creature cards leave your graveyard” — and Ovalchase Daredevil leaving for your hand '
        + 'is that event. What the token has to do here is be a creature Shilgengar can eat for '
        + 'the next Blood token, and the 0/1 Plant is one. Shilgengar counts toughness only for '
        + 'an Angel, so the Plant being 0/1 rather than a 2/2 Skeleton Pirate costs the loop '
        + 'nothing.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite self-discard triggers',
        'Infinite Blood tokens',
        'Exile your library with the ability to play the exiled cards until end of turn',
      ],
    },

    // ---- the same trigger, where the token is eaten for mana -------------------
    //
    // A recursive creature comes back from the graveyard, the trigger answers with a
    // token, and the token is sacrificed to a free altar for the mana to do it again.
    // The card leaving the graveyard is a creature card in all of them — Ebondeath,
    // Gutterbones, Squee, Golgari Thug, whatever Whisper returns — which is what the
    // Roots need and what separates them from the peers that read any card at all.
    // The Bat's flying and its 1/1 body are never read; the Plant just has to be a
    // creature. The two Sage of the Falls lines are the exception worth naming: there
    // the token has to be a NON-HUMAN creature entering, to trigger Sage again, and
    // a Plant is that too.
    {
      cards: [
        'Norman Osborn // Green Goblin',
        'Squee, the Immortal',
        'Insidious Roots',
        'Phyrexian Altar',
      ],
      confidence: 'verified',
      from: {
        id: '394-3705-4050-6896',
        cards: [
          'Norman Osborn // Green Goblin',
          'Squee, the Immortal',
          'Desecrated Tomb',
          'Phyrexian Altar',
        ],
      },
      swap: { out: 'Desecrated Tomb', in: 'Insidious Roots', inId: 5477 },
      why: 'Desecrated Tomb’s trigger is Insidious Roots’ trigger word for word — “whenever one '
        + 'or more creature cards leave your graveyard” — and in each of these the card leaving '
        + 'is a creature card being recast or returned, so the Roots see it too. The token’s '
        + 'whole job is to be a creature the outlet can eat for mana, or a non-Human creature '
        + 'entering; a 0/1 green Plant is both, where the Bat’s flying and its 1/1 body are '
        + 'never read.',
      produces: [
        'Infinite LTB',
        'Infinite ETB',
        'Infinite sacrifice triggers',
        'Infinite death triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: ['Sage of the Falls', 'Necroplasm', 'Insidious Roots'],
      confidence: 'verified',
      from: {
        id: '394-1570-3674',
        cards: ['Sage of the Falls', 'Necroplasm', 'Desecrated Tomb'],
      },
      swap: { out: 'Desecrated Tomb', in: 'Insidious Roots', inId: 5477 },
      why: 'Desecrated Tomb’s trigger is Insidious Roots’ trigger word for word — “whenever one '
        + 'or more creature cards leave your graveyard” — and in each of these the card leaving '
        + 'is a creature card being recast or returned, so the Roots see it too. The token’s '
        + 'whole job is to be a creature the outlet can eat for mana, or a non-Human creature '
        + 'entering; a 0/1 green Plant is both, where the Bat’s flying and its 1/1 body are '
        + 'never read.',
      produces: [
        'Infinite self-mill',
        'Near-infinite creature tokens',
        'Near-infinite ETB',
        'Near-infinite self-discard triggers',
      ],
    },
    {
      cards: ['Sage of the Falls', 'Golgari Thug', 'Insidious Roots'],
      confidence: 'verified',
      from: {
        id: '394-1570-5010',
        cards: ['Sage of the Falls', 'Golgari Thug', 'Desecrated Tomb'],
      },
      swap: { out: 'Desecrated Tomb', in: 'Insidious Roots', inId: 5477 },
      why: 'Desecrated Tomb’s trigger is Insidious Roots’ trigger word for word — “whenever one '
        + 'or more creature cards leave your graveyard” — and in each of these the card leaving '
        + 'is a creature card being recast or returned, so the Roots see it too. The token’s '
        + 'whole job is to be a creature the outlet can eat for mana, or a non-Human creature '
        + 'entering; a 0/1 green Plant is both, where the Bat’s flying and its 1/1 body are '
        + 'never read.',
      produces: ['Infinite self-mill'],
    },
    {
      cards: ['Ebondeath, Dracolich', 'Insidious Roots', 'Ashnod\'s Altar', 'Initiates of the Ebon Hand'],
      confidence: 'verified',
      from: {
        id: '394-2034-2948-4484',
        cards: [
          'Ebondeath, Dracolich',
          'Desecrated Tomb',
          'Ashnod\'s Altar',
          'Initiates of the Ebon Hand',
        ],
      },
      swap: { out: 'Desecrated Tomb', in: 'Insidious Roots', inId: 5477 },
      why: 'Desecrated Tomb’s trigger is Insidious Roots’ trigger word for word — “whenever one '
        + 'or more creature cards leave your graveyard” — and in each of these the card leaving '
        + 'is a creature card being recast or returned, so the Roots see it too. The token’s '
        + 'whole job is to be a creature the outlet can eat for mana, or a non-Human creature '
        + 'entering; a 0/1 green Plant is both, where the Bat’s flying and its 1/1 body are '
        + 'never read.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: ['Ebondeath, Dracolich', 'Insidious Roots', 'Ashnod\'s Altar', 'Bog Initiate'],
      confidence: 'verified',
      from: {
        id: '394-2034-3537-4484',
        cards: ['Ebondeath, Dracolich', 'Desecrated Tomb', 'Ashnod\'s Altar', 'Bog Initiate'],
      },
      swap: { out: 'Desecrated Tomb', in: 'Insidious Roots', inId: 5477 },
      why: 'Desecrated Tomb’s trigger is Insidious Roots’ trigger word for word — “whenever one '
        + 'or more creature cards leave your graveyard” — and in each of these the card leaving '
        + 'is a creature card being recast or returned, so the Roots see it too. The token’s '
        + 'whole job is to be a creature the outlet can eat for mana, or a non-Human creature '
        + 'entering; a 0/1 green Plant is both, where the Bat’s flying and its 1/1 body are '
        + 'never read.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Lier, Disciple of the Drowned',
        'Merfolk Secretkeeper // Venture Deeper',
        'Phyrexian Altar',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '394-3029-4050-4408',
        cards: [
          'Lier, Disciple of the Drowned',
          'Merfolk Secretkeeper // Venture Deeper',
          'Phyrexian Altar',
          'Desecrated Tomb',
        ],
      },
      swap: { out: 'Desecrated Tomb', in: 'Insidious Roots', inId: 5477 },
      why: 'Desecrated Tomb’s trigger is Insidious Roots’ trigger word for word — “whenever one '
        + 'or more creature cards leave your graveyard” — and in each of these the card leaving '
        + 'is a creature card being recast or returned, so the Roots see it too. The token’s '
        + 'whole job is to be a creature the outlet can eat for mana, or a non-Human creature '
        + 'entering; a 0/1 green Plant is both, where the Bat’s flying and its 1/1 body are '
        + 'never read.',
      produces: [
        'Infinite creature tokens',
        'Infinite mill',
        'Infinite sacrifice triggers',
        'Infinite colored mana',
        'Infinite LTB',
        'Infinite death triggers',
      ],
    },
    {
      cards: ['Cleaving Reaper', 'Insidious Roots', 'Peace of Mind', 'Phyrexian Altar'],
      confidence: 'verified',
      from: {
        id: '394-517-2383-4050',
        cards: ['Cleaving Reaper', 'Desecrated Tomb', 'Peace of Mind', 'Phyrexian Altar'],
      },
      swap: { out: 'Desecrated Tomb', in: 'Insidious Roots', inId: 5477 },
      why: 'Desecrated Tomb’s trigger is Insidious Roots’ trigger word for word — “whenever one '
        + 'or more creature cards leave your graveyard” — and in each of these the card leaving '
        + 'is a creature card being recast or returned, so the Roots see it too. The token’s '
        + 'whole job is to be a creature the outlet can eat for mana, or a non-Human creature '
        + 'entering; a 0/1 green Plant is both, where the Bat’s flying and its 1/1 body are '
        + 'never read.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Embalmer\'s Tools', 'Phyrexian Altar', 'Insidious Roots', 'Gutterbones'],
      confidence: 'verified',
      from: {
        id: '308-394-2299-4050',
        cards: ['Embalmer\'s Tools', 'Phyrexian Altar', 'Desecrated Tomb', 'Gutterbones'],
      },
      swap: { out: 'Desecrated Tomb', in: 'Insidious Roots', inId: 5477 },
      why: 'Desecrated Tomb’s trigger is Insidious Roots’ trigger word for word — “whenever one '
        + 'or more creature cards leave your graveyard” — and in each of these the card leaving '
        + 'is a creature card being recast or returned, so the Roots see it too. The token’s '
        + 'whole job is to be a creature the outlet can eat for mana, or a non-Human creature '
        + 'entering; a 0/1 green Plant is both, where the Bat’s flying and its 1/1 body are '
        + 'never read.',
      produces: ['Infinite ETB', 'Infinite LTB', 'Infinite sacrifice triggers'],
    },
    {
      cards: ['Whisper, Blood Liturgist', 'Thornbite Staff', 'Insidious Roots', 'Zulaport Cutthroat'],
      confidence: 'verified',
      from: {
        id: '394-1385-2178-4283',
        cards: ['Whisper, Blood Liturgist', 'Thornbite Staff', 'Desecrated Tomb', 'Zulaport Cutthroat'],
      },
      swap: { out: 'Desecrated Tomb', in: 'Insidious Roots', inId: 5477 },
      why: 'Desecrated Tomb’s trigger is Insidious Roots’ trigger word for word — “whenever one '
        + 'or more creature cards leave your graveyard” — and in each of these the card leaving '
        + 'is a creature card being recast or returned, so the Roots see it too. The token’s '
        + 'whole job is to be a creature the outlet can eat for mana, or a non-Human creature '
        + 'entering; a 0/1 green Plant is both, where the Bat’s flying and its 1/1 body are '
        + 'never read.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite lifeloss',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Whisper, Blood Liturgist', 'Thornbite Staff', 'Insidious Roots', 'Blood Artist'],
      confidence: 'verified',
      from: {
        id: '394-2178-2842-4283',
        cards: ['Whisper, Blood Liturgist', 'Thornbite Staff', 'Desecrated Tomb', 'Blood Artist'],
      },
      swap: { out: 'Desecrated Tomb', in: 'Insidious Roots', inId: 5477 },
      why: 'Desecrated Tomb’s trigger is Insidious Roots’ trigger word for word — “whenever one '
        + 'or more creature cards leave your graveyard” — and in each of these the card leaving '
        + 'is a creature card being recast or returned, so the Roots see it too. The token’s '
        + 'whole job is to be a creature the outlet can eat for mana, or a non-Human creature '
        + 'entering; a 0/1 green Plant is both, where the Bat’s flying and its 1/1 body are '
        + 'never read.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite lifeloss',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Squee, the Immortal', 'Insidious Roots', 'Runaway Steam-Kin', 'Phyrexian Altar'],
      confidence: 'verified',
      from: {
        id: '394-3101-3705-4050',
        cards: ['Squee, the Immortal', 'Desecrated Tomb', 'Runaway Steam-Kin', 'Phyrexian Altar'],
      },
      swap: { out: 'Desecrated Tomb', in: 'Insidious Roots', inId: 5477 },
      why: 'Desecrated Tomb’s trigger is Insidious Roots’ trigger word for word — “whenever one '
        + 'or more creature cards leave your graveyard” — and in each of these the card leaving '
        + 'is a creature card being recast or returned, so the Roots see it too. The token’s '
        + 'whole job is to be a creature the outlet can eat for mana, or a non-Human creature '
        + 'entering; a 0/1 green Plant is both, where the Bat’s flying and its 1/1 body are '
        + 'never read.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },

    // ---- Insidious Roots, the half that makes mana -----------------------------
    //
    // Its first line is Springleaf Parade's second, word for word:
    //
    //   Springleaf Parade   Creature tokens you control have "{T}: Add one mana of
    //                       any color."
    //   Insidious Roots     Creature tokens you control have "{T}: Add one mana of
    //                       any color."
    //
    // One shape behind twenty-four haste enablers, and the haste is the point: Abby,
    // Merciless Soldier is cast from the command zone, Mirror of Life Trapping sends
    // her back, and her Cordyceps Infected tokens tap for the {R}{G} to recast her
    // the turn they arrive. Springleaf Parade's own ETB Shapeshifters take no part
    // in it, which is the only thing the Roots lack — so the swap is the granted
    // ability alone, read once and true twenty-four times.
    //
    // Jaheira, Friend of the Forest is NOT a source here even though she grants a
    // token mana ability: hers adds {G} only, and this loop needs {R}{G}.
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Purphoros, Bronze-Blooded',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-3480-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Purphoros, Bronze-Blooded',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Hammer of Purphoros',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '1115-2034-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Hammer of Purphoros',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Tannuk, Steadfast Second',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-6791-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Tannuk, Steadfast Second',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Tuktuk Rubblefort',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-4885-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Tuktuk Rubblefort',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Gimli\'s Reckless Might',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-6970-7296-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Gimli\'s Reckless Might',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Lavaleaper',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-6970-7175-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Lavaleaper',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Akroma\'s Memorial',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-3499-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Akroma\'s Memorial',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Shang-Chi, Master of Kung Fu',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-6970-7730-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Shang-Chi, Master of Kung Fu',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Fires of Yavimaya',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-5223-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Fires of Yavimaya',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Fervor',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '969-2034-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Fervor',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Cyclops of Eternal Fury',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-4460-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Cyclops of Eternal Fury',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Kratos, God of War',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-6968-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Kratos, God of War',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Anger',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-4068-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Anger',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Smellerbee, Rebel Fighter',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-6970-7060-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Smellerbee, Rebel Fighter',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Samut, Tyrant Smasher',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '206-2034-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Samut, Tyrant Smasher',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'The Fire Crystal',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-6633-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'The Fire Crystal',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Mass Hysteria',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '1849-2034-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Mass Hysteria',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Roar of Resistance',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-4478-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Roar of Resistance',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Barbarian Class',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-6970-7297-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Barbarian Class',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Thousand-Year Elixir',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-5295-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Thousand-Year Elixir',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Concordant Crossroads',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '1322-2034-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Concordant Crossroads',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Yarus, Roar of the Old Gods',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '2034-5434-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Yarus, Roar of the Old Gods',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Urabrask the Hidden',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '647-2034-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Urabrask the Hidden',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },
    {
      cards: [
        'Abby, Merciless Soldier',
        'Ashnod\'s Altar',
        'Mirror of Life Trapping',
        'Rising of the Day',
        'Insidious Roots',
      ],
      confidence: 'verified',
      from: {
        id: '1879-2034-6970-7763-7850',
        cards: [
          'Abby, Merciless Soldier',
          'Ashnod\'s Altar',
          'Mirror of Life Trapping',
          'Rising of the Day',
          'Springleaf Parade',
        ],
      },
      swap: { out: 'Springleaf Parade', in: 'Insidious Roots', inId: 5477 },
      why: 'Insidious Roots’ first line is Springleaf Parade’s second, word for word: “Creature '
        + 'tokens you control have “{T}: Add one mana of any color.”” The published loop taps '
        + 'two of Abby’s Cordyceps Infected tokens for {R}{G} and eats a third on Ashnod’s '
        + 'Altar, and the haste enabler is what lets tokens tap the turn they arrive. Springleaf '
        + 'Parade’s own ETB Shapeshifters take no part in it, which is the only thing the Roots '
        + 'lack.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite colored mana',
        'Infinite colorless mana',
        'Infinite commander casts',
        'Infinite creature tokens with haste',
        'Infinite death triggers',
        'Infinite sacrifice triggers',
        'Infinite storm count',
      ],
    },

    // ---- Bogwater Lumaret and Elas il-Kor, where the peer is wider -------------
    //
    // The stand-in rule at the bottom of this file covers these two against the four
    // cards whose trigger is theirs exactly. Soul Warden, Soul's Attendant and
    // Essence Warden are not those cards — they read "whenever ANOTHER creature
    // enters", an opponent's included — so their combos are written out here one at
    // a time instead, each read for whose creature it is that enters.
    //
    // In all thirty-three it is yours. Spellbook itself keeps the two apart: the
    // loops that hand an opponent a creature (Questing Phelddagrif, Hive Mind with
    // Storm Herd) are published with Suture Priest, whose second ability is the one
    // that reads an opponent's board.
    {
      cards: ['Animation Module', 'Scion of the Swarm', 'Phyrexian Altar', 'Bogwater Lumaret'],
      confidence: 'verified',
      from: {
        id: '360-2161-3490-4050',
        cards: ['Animation Module', 'Scion of the Swarm', 'Phyrexian Altar', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Animation Module', 'Scion of the Swarm', 'Krark-Clan Ironworks', 'Bogwater Lumaret'],
      confidence: 'verified',
      from: {
        id: '360-2161-3490-4659',
        cards: ['Animation Module', 'Scion of the Swarm', 'Krark-Clan Ironworks', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Animation Module', 'Scion of the Swarm', 'Ashnod\'s Altar', 'Bogwater Lumaret'],
      confidence: 'verified',
      from: {
        id: '360-2034-2161-3490',
        cards: ['Animation Module', 'Scion of the Swarm', 'Ashnod\'s Altar', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Darien, King of Kjeldor', 'Goblin Bombardment', 'Bogwater Lumaret'],
      confidence: 'verified',
      from: {
        id: '360-1981-5147',
        cards: ['Darien, King of Kjeldor', 'Goblin Bombardment', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite death triggers',
        'Infinite lifegain triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Darien, King of Kjeldor', 'Pandemonium', 'Bogwater Lumaret'],
      confidence: 'verified',
      from: {
        id: '360-1981-2584',
        cards: ['Darien, King of Kjeldor', 'Pandemonium', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: ['Darien, King of Kjeldor', 'Warstorm Surge', 'Bogwater Lumaret'],
      confidence: 'verified',
      from: {
        id: '360-1981-2773',
        cards: ['Darien, King of Kjeldor', 'Warstorm Surge', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: ['Darien, King of Kjeldor', 'Terror of the Peaks', 'Bogwater Lumaret'],
      confidence: 'verified',
      from: {
        id: '360-1110-1981',
        cards: ['Darien, King of Kjeldor', 'Terror of the Peaks', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Elesh Norn, Mother of Machines',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
      ],
      confidence: 'verified',
      from: {
        id: '360-1770-1981-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Elesh Norn, Mother of Machines',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
        'Virtue of Knowledge // Vantress Visions',
      ],
      confidence: 'verified',
      from: {
        id: '360-1418-1981-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Virtue of Knowledge // Vantress Visions',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
        'Panharmonicon',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-2397-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Panharmonicon',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
        'Yarok, the Desecrated',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-2499-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Yarok, the Desecrated',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Ratchet, Field Medic // Ratchet, Rescue Racer',
        'Preston, the Vanisher',
        'Bogwater Lumaret',
        'Ephemerate',
      ],
      confidence: 'verified',
      from: {
        id: '360-4605-5118-5144',
        cards: [
          'Ratchet, Field Medic // Ratchet, Rescue Racer',
          'Preston, the Vanisher',
          'Soul Warden',
          'Ephemerate',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
      ],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Mondrak, Glory Dominus',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-4365-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Mondrak, Glory Dominus',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
        'Primal Vigor',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-3129-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Primal Vigor',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
        'Parallel Lives',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-2557-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Parallel Lives',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
        'Doubling Season',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-4591-4740-4772',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Doubling Season',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: ['Ratchet, Field Medic // Ratchet, Rescue Racer', 'Sculpting Steel', 'Bogwater Lumaret'],
      confidence: 'verified',
      from: {
        id: '360-661-5118',
        cards: ['Ratchet, Field Medic // Ratchet, Rescue Racer', 'Sculpting Steel', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite ETB', 'Infinite lifegain', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
        'Anointed Procession',
      ],
      confidence: 'verified',
      from: {
        id: '360-1308-1981-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Anointed Procession',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
        'Rhox Faithmender',
      ],
      confidence: 'verified',
      from: {
        id: '360-1071-1981-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Rhox Faithmender',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
        'Alhammarret\'s Archive',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-4435-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Alhammarret\'s Archive',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
        'Boon Reflection',
      ],
      confidence: 'verified',
      from: {
        id: '360-1841-1981-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Boon Reflection',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: ['Drogskol Reaver', 'Nadir Kraken', 'Ashnod\'s Altar', 'Bogwater Lumaret'],
      confidence: 'verified',
      from: {
        id: '360-444-1722-2034',
        cards: ['Drogskol Reaver', 'Nadir Kraken', 'Ashnod\'s Altar', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite card draw',
        'Infinite draw triggers',
        'Near-infinite +1/+1 counters on a creature',
        'Near-infinite death triggers',
        'Near-infinite ETB',
        'Near-infinite lifegain',
        'Near-infinite lifegain triggers',
        'Near-infinite LTB',
        'Near-infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Bogwater Lumaret', 'Darien, King of Kjeldor', 'Dingus Staff', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '360-1610-1981-2034',
        cards: ['Soul Warden', 'Darien, King of Kjeldor', 'Dingus Staff', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Bogwater Lumaret', 'Darien, King of Kjeldor', 'Dingus Staff', 'Phyrexian Altar'],
      confidence: 'verified',
      from: {
        id: '360-1610-1981-4050',
        cards: ['Soul Warden', 'Darien, King of Kjeldor', 'Dingus Staff', 'Phyrexian Altar'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite colored mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Bogwater Lumaret', 'Darien, King of Kjeldor', 'Dingus Staff', 'Altar of Dementia'],
      confidence: 'verified',
      from: {
        id: '360-1610-1981-5256',
        cards: ['Soul Warden', 'Darien, King of Kjeldor', 'Dingus Staff', 'Altar of Dementia'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite mill',
        'Infinite sacrifice triggers',
        'Infinite self-mill',
      ],
    },
    {
      cards: ['Yawgmoth, Thran Physician', 'Fiend Hunter', 'Karmic Guide', 'Bogwater Lumaret'],
      confidence: 'verified',
      from: {
        id: '360-1734-4279-4681',
        cards: ['Yawgmoth, Thran Physician', 'Fiend Hunter', 'Karmic Guide', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite card draw',
        'Infinite draw triggers',
        'Near-infinite -1/-1 counters',
        'Near-infinite death triggers',
        'Near-infinite ETB',
        'Near-infinite lifegain triggers',
        'Near-infinite LTB',
        'Near-infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ghave, Guru of Spores', 'Carnival of Souls', 'Bogwater Lumaret', 'Panharmonicon'],
      confidence: 'verified',
      from: {
        id: '360-2397-2530-5189',
        cards: ['Ghave, Guru of Spores', 'Carnival of Souls', 'Soul Warden', 'Panharmonicon'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Darien, King of Kjeldor', 'Bogwater Lumaret', 'Blasting Station'],
      confidence: 'verified',
      from: {
        id: '360-413-1981',
        cards: ['Darien, King of Kjeldor', 'Soul Warden', 'Blasting Station'],
      },
      swap: { out: 'Soul Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
        'Chatterfang, Squirrel General',
      ],
      confidence: 'verified',
      from: {
        id: '567-1981-3000-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul\'s Attendant',
          'Chatterfang, Squirrel General',
        ],
      },
      swap: { out: 'Soul\'s Attendant', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Bogwater Lumaret',
        'Adrix and Nev, Twincasters',
      ],
      confidence: 'verified',
      from: {
        id: '567-851-1981-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul\'s Attendant',
          'Adrix and Nev, Twincasters',
        ],
      },
      swap: { out: 'Soul\'s Attendant', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Yawgmoth, Thran Physician',
        'Hapatra, Vizier of Poisons',
        'Anointed Procession',
        'Bogwater Lumaret',
      ],
      confidence: 'verified',
      from: {
        id: '1308-2228-2741-4279',
        cards: [
          'Yawgmoth, Thran Physician',
          'Hapatra, Vizier of Poisons',
          'Anointed Procession',
          'Essence Warden',
        ],
      },
      swap: { out: 'Essence Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite card draw',
        'Near-infinite -1/-1 counters',
        'Near-infinite creature tokens',
        'Near-infinite death triggers',
        'Near-infinite ETB',
        'Near-infinite lifegain',
        'Near-infinite lifegain triggers',
        'Near-infinite LTB',
        'Near-infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Yawgmoth, Thran Physician',
        'Hapatra, Vizier of Poisons',
        'Parallel Lives',
        'Bogwater Lumaret',
      ],
      confidence: 'verified',
      from: {
        id: '2228-2557-2741-4279',
        cards: [
          'Yawgmoth, Thran Physician',
          'Hapatra, Vizier of Poisons',
          'Parallel Lives',
          'Essence Warden',
        ],
      },
      swap: { out: 'Essence Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite card draw',
        'Near-infinite -1/-1 counters',
        'Near-infinite creature tokens',
        'Near-infinite death triggers',
        'Near-infinite ETB',
        'Near-infinite lifegain',
        'Near-infinite lifegain triggers',
        'Near-infinite LTB',
        'Near-infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Yawgmoth, Thran Physician',
        'Hapatra, Vizier of Poisons',
        'Doubling Season',
        'Bogwater Lumaret',
      ],
      confidence: 'verified',
      from: {
        id: '2228-2741-4279-4772',
        cards: [
          'Yawgmoth, Thran Physician',
          'Hapatra, Vizier of Poisons',
          'Doubling Season',
          'Essence Warden',
        ],
      },
      swap: { out: 'Essence Warden', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Bogwater Lumaret reads “whenever this creature or another creature '
        + 'you control enters”, so the swap holds only where the creature entering is yours. In '
        + 'every one of these it is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s '
        + 'Snakes, Ghave’s Saproling, and Fiend Hunter and Karmic Guide returning under your own '
        + 'control. That difference is exactly why this is a row and not part of the stand-in '
        + 'rule below — a rule would be claiming it of every Soul Warden combo there will ever '
        + 'be, and the opponent-facing loops Spellbook does publish put Suture Priest in this '
        + 'slot rather than Soul Warden.',
      produces: [
        'Infinite card draw',
        'Near-infinite -1/-1 counters',
        'Near-infinite creature tokens',
        'Near-infinite death triggers',
        'Near-infinite ETB',
        'Near-infinite lifegain',
        'Near-infinite lifegain triggers',
        'Near-infinite LTB',
        'Near-infinite sacrifice triggers',
      ],
    },

    // ---- and where the peer is an enchantment ----------------------------------
    //
    // Ajani's Welcome is one line and it is the subject's line. It is kept out of the
    // stand-in rule for one reason: it is an enchantment and both subjects are
    // creatures. Nothing in these five loops reads the lifegainer's card type, but a
    // rule would be claiming that of every Ajani's Welcome combo there will ever be.
    {
      cards: ['Trudge Garden', 'Intruder Alarm', 'Bogwater Lumaret'],
      confidence: 'verified',
      from: {
        id: '1636-1874-2308',
        cards: ['Trudge Garden', 'Intruder Alarm', 'Ajani\'s Welcome'],
      },
      swap: { out: 'Ajani\'s Welcome', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Ajani’s Welcome is one line, “Whenever a creature you control enters, you gain 1 '
        + 'life”, and that is the subject’s sentence for every creature the loop makes. It is an '
        + 'enchantment where the subject is a creature, which is the only reason this is written '
        + 'out rather than left to the stand-in rule: nothing in these loops reads the '
        + 'lifegainer’s card type, but a rule would be claiming that of every combo Ajani’s '
        + 'Welcome is ever published in.',
      produces: [
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite mana creatures you control can produce',
        'Infinite untap of creatures',
      ],
    },
    {
      cards: ['Wall of Limbs', 'Animation Module', 'Bogwater Lumaret', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '1874-2034-3490-3708',
        cards: ['Wall of Limbs', 'Animation Module', 'Ajani\'s Welcome', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Ajani\'s Welcome', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Ajani’s Welcome is one line, “Whenever a creature you control enters, you gain 1 '
        + 'life”, and that is the subject’s sentence for every creature the loop makes. It is an '
        + 'enchantment where the subject is a creature, which is the only reason this is written '
        + 'out rather than left to the stand-in rule: nothing in these loops reads the '
        + 'lifegainer’s card type, but a rule would be claiming that of every combo Ajani’s '
        + 'Welcome is ever published in.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ajani\'s Pridemate', 'Animation Module', 'Bogwater Lumaret', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '701-1874-2034-3490',
        cards: ['Ajani\'s Pridemate', 'Animation Module', 'Ajani\'s Welcome', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Ajani\'s Welcome', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Ajani’s Welcome is one line, “Whenever a creature you control enters, you gain 1 '
        + 'life”, and that is the subject’s sentence for every creature the loop makes. It is an '
        + 'enchantment where the subject is a creature, which is the only reason this is written '
        + 'out rather than left to the stand-in rule: nothing in these loops reads the '
        + 'lifegainer’s card type, but a rule would be claiming that of every combo Ajani’s '
        + 'Welcome is ever published in.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ageless Entity', 'Animation Module', 'Bogwater Lumaret', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '1874-2034-3490-4159',
        cards: ['Ageless Entity', 'Animation Module', 'Ajani\'s Welcome', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Ajani\'s Welcome', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Ajani’s Welcome is one line, “Whenever a creature you control enters, you gain 1 '
        + 'life”, and that is the subject’s sentence for every creature the loop makes. It is an '
        + 'enchantment where the subject is a creature, which is the only reason this is written '
        + 'out rather than left to the stand-in rule: nothing in these loops reads the '
        + 'lifegainer’s card type, but a rule would be claiming that of every combo Ajani’s '
        + 'Welcome is ever published in.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Karlov of the Ghost Council', 'Animation Module', 'Bogwater Lumaret', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '1874-2034-3490-3514',
        cards: ['Karlov of the Ghost Council', 'Animation Module', 'Ajani\'s Welcome', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Ajani\'s Welcome', in: 'Bogwater Lumaret', inId: 7399 },
      why: 'Ajani’s Welcome is one line, “Whenever a creature you control enters, you gain 1 '
        + 'life”, and that is the subject’s sentence for every creature the loop makes. It is an '
        + 'enchantment where the subject is a creature, which is the only reason this is written '
        + 'out rather than left to the stand-in rule: nothing in these loops reads the '
        + 'lifegainer’s card type, but a rule would be claiming that of every combo Ajani’s '
        + 'Welcome is ever published in.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },

    // ---- the same thirty-three for Elas il-Kor ---------------------------------
    //
    // Elas reads "whenever another creature you control enters", which is the same
    // sentence again, and adds a second half — "whenever another creature you control
    // dies, each opponent loses 1 life" — that several of these loops turn into a
    // win. `produces` is carried from the published combo rather than extended,
    // because a claim the source never made is not this file's to add.
    {
      cards: [
        'Animation Module',
        'Scion of the Swarm',
        'Phyrexian Altar',
        'Elas il-Kor, Sadistic Pilgrim',
      ],
      confidence: 'verified',
      from: {
        id: '360-2161-3490-4050',
        cards: ['Animation Module', 'Scion of the Swarm', 'Phyrexian Altar', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Animation Module',
        'Scion of the Swarm',
        'Krark-Clan Ironworks',
        'Elas il-Kor, Sadistic Pilgrim',
      ],
      confidence: 'verified',
      from: {
        id: '360-2161-3490-4659',
        cards: ['Animation Module', 'Scion of the Swarm', 'Krark-Clan Ironworks', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Animation Module',
        'Scion of the Swarm',
        'Ashnod\'s Altar',
        'Elas il-Kor, Sadistic Pilgrim',
      ],
      confidence: 'verified',
      from: {
        id: '360-2034-2161-3490',
        cards: ['Animation Module', 'Scion of the Swarm', 'Ashnod\'s Altar', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Darien, King of Kjeldor', 'Goblin Bombardment', 'Elas il-Kor, Sadistic Pilgrim'],
      confidence: 'verified',
      from: {
        id: '360-1981-5147',
        cards: ['Darien, King of Kjeldor', 'Goblin Bombardment', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite ETB',
        'Infinite LTB',
        'Infinite death triggers',
        'Infinite lifegain triggers',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Darien, King of Kjeldor', 'Pandemonium', 'Elas il-Kor, Sadistic Pilgrim'],
      confidence: 'verified',
      from: {
        id: '360-1981-2584',
        cards: ['Darien, King of Kjeldor', 'Pandemonium', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: ['Darien, King of Kjeldor', 'Warstorm Surge', 'Elas il-Kor, Sadistic Pilgrim'],
      confidence: 'verified',
      from: {
        id: '360-1981-2773',
        cards: ['Darien, King of Kjeldor', 'Warstorm Surge', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: ['Darien, King of Kjeldor', 'Terror of the Peaks', 'Elas il-Kor, Sadistic Pilgrim'],
      confidence: 'verified',
      from: {
        id: '360-1110-1981',
        cards: ['Darien, King of Kjeldor', 'Terror of the Peaks', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Elesh Norn, Mother of Machines',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
      ],
      confidence: 'verified',
      from: {
        id: '360-1770-1981-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Elesh Norn, Mother of Machines',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
        'Virtue of Knowledge // Vantress Visions',
      ],
      confidence: 'verified',
      from: {
        id: '360-1418-1981-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Virtue of Knowledge // Vantress Visions',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
        'Panharmonicon',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-2397-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Panharmonicon',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
        'Yarok, the Desecrated',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-2499-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Yarok, the Desecrated',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Ratchet, Field Medic // Ratchet, Rescue Racer',
        'Preston, the Vanisher',
        'Elas il-Kor, Sadistic Pilgrim',
        'Ephemerate',
      ],
      confidence: 'verified',
      from: {
        id: '360-4605-5118-5144',
        cards: [
          'Ratchet, Field Medic // Ratchet, Rescue Racer',
          'Preston, the Vanisher',
          'Soul Warden',
          'Ephemerate',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
      ],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Mondrak, Glory Dominus',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-4365-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Mondrak, Glory Dominus',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
        'Primal Vigor',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-3129-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Primal Vigor',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
        'Parallel Lives',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-2557-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Parallel Lives',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
        'Doubling Season',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-4591-4740-4772',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Doubling Season',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Ratchet, Field Medic // Ratchet, Rescue Racer',
        'Sculpting Steel',
        'Elas il-Kor, Sadistic Pilgrim',
      ],
      confidence: 'verified',
      from: {
        id: '360-661-5118',
        cards: ['Ratchet, Field Medic // Ratchet, Rescue Racer', 'Sculpting Steel', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite ETB', 'Infinite lifegain', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
        'Anointed Procession',
      ],
      confidence: 'verified',
      from: {
        id: '360-1308-1981-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Anointed Procession',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
        'Rhox Faithmender',
      ],
      confidence: 'verified',
      from: {
        id: '360-1071-1981-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Rhox Faithmender',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
        'Alhammarret\'s Archive',
      ],
      confidence: 'verified',
      from: {
        id: '360-1981-4435-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Alhammarret\'s Archive',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
        'Boon Reflection',
      ],
      confidence: 'verified',
      from: {
        id: '360-1841-1981-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul Warden',
          'Boon Reflection',
        ],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: ['Drogskol Reaver', 'Nadir Kraken', 'Ashnod\'s Altar', 'Elas il-Kor, Sadistic Pilgrim'],
      confidence: 'verified',
      from: {
        id: '360-444-1722-2034',
        cards: ['Drogskol Reaver', 'Nadir Kraken', 'Ashnod\'s Altar', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite card draw',
        'Infinite draw triggers',
        'Near-infinite +1/+1 counters on a creature',
        'Near-infinite death triggers',
        'Near-infinite ETB',
        'Near-infinite lifegain',
        'Near-infinite lifegain triggers',
        'Near-infinite LTB',
        'Near-infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Elas il-Kor, Sadistic Pilgrim',
        'Darien, King of Kjeldor',
        'Dingus Staff',
        'Ashnod\'s Altar',
      ],
      confidence: 'verified',
      from: {
        id: '360-1610-1981-2034',
        cards: ['Soul Warden', 'Darien, King of Kjeldor', 'Dingus Staff', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Elas il-Kor, Sadistic Pilgrim',
        'Darien, King of Kjeldor',
        'Dingus Staff',
        'Phyrexian Altar',
      ],
      confidence: 'verified',
      from: {
        id: '360-1610-1981-4050',
        cards: ['Soul Warden', 'Darien, King of Kjeldor', 'Dingus Staff', 'Phyrexian Altar'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite colored mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Elas il-Kor, Sadistic Pilgrim',
        'Darien, King of Kjeldor',
        'Dingus Staff',
        'Altar of Dementia',
      ],
      confidence: 'verified',
      from: {
        id: '360-1610-1981-5256',
        cards: ['Soul Warden', 'Darien, King of Kjeldor', 'Dingus Staff', 'Altar of Dementia'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite mill',
        'Infinite sacrifice triggers',
        'Infinite self-mill',
      ],
    },
    {
      cards: [
        'Yawgmoth, Thran Physician',
        'Fiend Hunter',
        'Karmic Guide',
        'Elas il-Kor, Sadistic Pilgrim',
      ],
      confidence: 'verified',
      from: {
        id: '360-1734-4279-4681',
        cards: ['Yawgmoth, Thran Physician', 'Fiend Hunter', 'Karmic Guide', 'Soul Warden'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite card draw',
        'Infinite draw triggers',
        'Near-infinite -1/-1 counters',
        'Near-infinite death triggers',
        'Near-infinite ETB',
        'Near-infinite lifegain triggers',
        'Near-infinite LTB',
        'Near-infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Ghave, Guru of Spores',
        'Carnival of Souls',
        'Elas il-Kor, Sadistic Pilgrim',
        'Panharmonicon',
      ],
      confidence: 'verified',
      from: {
        id: '360-2397-2530-5189',
        cards: ['Ghave, Guru of Spores', 'Carnival of Souls', 'Soul Warden', 'Panharmonicon'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Darien, King of Kjeldor', 'Elas il-Kor, Sadistic Pilgrim', 'Blasting Station'],
      confidence: 'verified',
      from: {
        id: '360-413-1981',
        cards: ['Darien, King of Kjeldor', 'Soul Warden', 'Blasting Station'],
      },
      swap: { out: 'Soul Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
        'Chatterfang, Squirrel General',
      ],
      confidence: 'verified',
      from: {
        id: '567-1981-3000-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul\'s Attendant',
          'Chatterfang, Squirrel General',
        ],
      },
      swap: { out: 'Soul\'s Attendant', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Darien, King of Kjeldor',
        'Aetherflux Reservoir',
        'Platinum Angel',
        'Elas il-Kor, Sadistic Pilgrim',
        'Adrix and Nev, Twincasters',
      ],
      confidence: 'verified',
      from: {
        id: '567-851-1981-4591-4740',
        cards: [
          'Darien, King of Kjeldor',
          'Aetherflux Reservoir',
          'Platinum Angel',
          'Soul\'s Attendant',
          'Adrix and Nev, Twincasters',
        ],
      },
      swap: { out: 'Soul\'s Attendant', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: ['Infinite creature tokens', 'Infinite ETB', 'Infinite lifegain triggers'],
    },
    {
      cards: [
        'Yawgmoth, Thran Physician',
        'Hapatra, Vizier of Poisons',
        'Anointed Procession',
        'Elas il-Kor, Sadistic Pilgrim',
      ],
      confidence: 'verified',
      from: {
        id: '1308-2228-2741-4279',
        cards: [
          'Yawgmoth, Thran Physician',
          'Hapatra, Vizier of Poisons',
          'Anointed Procession',
          'Essence Warden',
        ],
      },
      swap: { out: 'Essence Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite card draw',
        'Near-infinite -1/-1 counters',
        'Near-infinite creature tokens',
        'Near-infinite death triggers',
        'Near-infinite ETB',
        'Near-infinite lifegain',
        'Near-infinite lifegain triggers',
        'Near-infinite LTB',
        'Near-infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Yawgmoth, Thran Physician',
        'Hapatra, Vizier of Poisons',
        'Parallel Lives',
        'Elas il-Kor, Sadistic Pilgrim',
      ],
      confidence: 'verified',
      from: {
        id: '2228-2557-2741-4279',
        cards: [
          'Yawgmoth, Thran Physician',
          'Hapatra, Vizier of Poisons',
          'Parallel Lives',
          'Essence Warden',
        ],
      },
      swap: { out: 'Essence Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite card draw',
        'Near-infinite -1/-1 counters',
        'Near-infinite creature tokens',
        'Near-infinite death triggers',
        'Near-infinite ETB',
        'Near-infinite lifegain',
        'Near-infinite lifegain triggers',
        'Near-infinite LTB',
        'Near-infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Yawgmoth, Thran Physician',
        'Hapatra, Vizier of Poisons',
        'Doubling Season',
        'Elas il-Kor, Sadistic Pilgrim',
      ],
      confidence: 'verified',
      from: {
        id: '2228-2741-4279-4772',
        cards: [
          'Yawgmoth, Thran Physician',
          'Hapatra, Vizier of Poisons',
          'Doubling Season',
          'Essence Warden',
        ],
      },
      swap: { out: 'Essence Warden', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Soul Warden reads “whenever ANOTHER creature enters” — anyone’s, including an '
        + 'opponent’s — where Elas il-Kor reads “whenever another creature you control enters”, '
        + 'so the swap holds only where the creature entering is yours. In every one of these it '
        + 'is: Darien’s Soldiers, Animation Module’s Servo, Hapatra’s Snakes, Ghave’s Saproling, '
        + 'and Fiend Hunter and Karmic Guide returning under your own control. That difference '
        + 'is exactly why this is a row and not part of the stand-in rule below — a rule would '
        + 'be claiming it of every Soul Warden combo there will ever be, and the opponent-facing '
        + 'loops Spellbook does publish put Suture Priest in this slot rather than Soul Warden.',
      produces: [
        'Infinite card draw',
        'Near-infinite -1/-1 counters',
        'Near-infinite creature tokens',
        'Near-infinite death triggers',
        'Near-infinite ETB',
        'Near-infinite lifegain',
        'Near-infinite lifegain triggers',
        'Near-infinite LTB',
        'Near-infinite sacrifice triggers',
      ],
    },

    // ---- and Elas il-Kor's five --------------------------------------------------
    {
      cards: ['Trudge Garden', 'Intruder Alarm', 'Elas il-Kor, Sadistic Pilgrim'],
      confidence: 'verified',
      from: {
        id: '1636-1874-2308',
        cards: ['Trudge Garden', 'Intruder Alarm', 'Ajani\'s Welcome'],
      },
      swap: { out: 'Ajani\'s Welcome', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Ajani’s Welcome is one line, “Whenever a creature you control enters, you gain 1 '
        + 'life”, and that is the subject’s sentence for every creature the loop makes. It is an '
        + 'enchantment where the subject is a creature, which is the only reason this is written '
        + 'out rather than left to the stand-in rule: nothing in these loops reads the '
        + 'lifegainer’s card type, but a rule would be claiming that of every combo Ajani’s '
        + 'Welcome is ever published in.',
      produces: [
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite mana creatures you control can produce',
        'Infinite untap of creatures',
      ],
    },
    {
      cards: ['Wall of Limbs', 'Animation Module', 'Elas il-Kor, Sadistic Pilgrim', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '1874-2034-3490-3708',
        cards: ['Wall of Limbs', 'Animation Module', 'Ajani\'s Welcome', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Ajani\'s Welcome', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Ajani’s Welcome is one line, “Whenever a creature you control enters, you gain 1 '
        + 'life”, and that is the subject’s sentence for every creature the loop makes. It is an '
        + 'enchantment where the subject is a creature, which is the only reason this is written '
        + 'out rather than left to the stand-in rule: nothing in these loops reads the '
        + 'lifegainer’s card type, but a rule would be claiming that of every combo Ajani’s '
        + 'Welcome is ever published in.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Ajani\'s Pridemate',
        'Animation Module',
        'Elas il-Kor, Sadistic Pilgrim',
        'Ashnod\'s Altar',
      ],
      confidence: 'verified',
      from: {
        id: '701-1874-2034-3490',
        cards: ['Ajani\'s Pridemate', 'Animation Module', 'Ajani\'s Welcome', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Ajani\'s Welcome', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Ajani’s Welcome is one line, “Whenever a creature you control enters, you gain 1 '
        + 'life”, and that is the subject’s sentence for every creature the loop makes. It is an '
        + 'enchantment where the subject is a creature, which is the only reason this is written '
        + 'out rather than left to the stand-in rule: nothing in these loops reads the '
        + 'lifegainer’s card type, but a rule would be claiming that of every combo Ajani’s '
        + 'Welcome is ever published in.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Ageless Entity', 'Animation Module', 'Elas il-Kor, Sadistic Pilgrim', 'Ashnod\'s Altar'],
      confidence: 'verified',
      from: {
        id: '1874-2034-3490-4159',
        cards: ['Ageless Entity', 'Animation Module', 'Ajani\'s Welcome', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Ajani\'s Welcome', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Ajani’s Welcome is one line, “Whenever a creature you control enters, you gain 1 '
        + 'life”, and that is the subject’s sentence for every creature the loop makes. It is an '
        + 'enchantment where the subject is a creature, which is the only reason this is written '
        + 'out rather than left to the stand-in rule: nothing in these loops reads the '
        + 'lifegainer’s card type, but a rule would be claiming that of every combo Ajani’s '
        + 'Welcome is ever published in.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: [
        'Karlov of the Ghost Council',
        'Animation Module',
        'Elas il-Kor, Sadistic Pilgrim',
        'Ashnod\'s Altar',
      ],
      confidence: 'verified',
      from: {
        id: '1874-2034-3490-3514',
        cards: ['Karlov of the Ghost Council', 'Animation Module', 'Ajani\'s Welcome', 'Ashnod\'s Altar'],
      },
      swap: { out: 'Ajani\'s Welcome', in: 'Elas il-Kor, Sadistic Pilgrim', inId: 2811 },
      why: 'Ajani’s Welcome is one line, “Whenever a creature you control enters, you gain 1 '
        + 'life”, and that is the subject’s sentence for every creature the loop makes. It is an '
        + 'enchantment where the subject is a creature, which is the only reason this is written '
        + 'out rather than left to the stand-in rule: nothing in these loops reads the '
        + 'lifegainer’s card type, but a rule would be claiming that of every combo Ajani’s '
        + 'Welcome is ever published in.',
      produces: [
        'Infinite +1/+1 counters on a creature',
        'Infinite colorless mana',
        'Infinite creature tokens',
        'Infinite death triggers',
        'Infinite ETB',
        'Infinite lifegain',
        'Infinite lifegain triggers',
        'Infinite LTB',
        'Infinite sacrifice triggers',
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

    // ---- the outlet slot behind Camellia + Peregrin Took ------------------------
    //
    // Spellbook's own published steps for Camellia, the Seedmiser + Peregrin Took +
    // Umbral Collar Zealot are four lines: activate the outlet by sacrificing a Food,
    // Camellia answers the sacrifice with a 1/1 Squirrel, Peregrin Took's replacement
    // puts an additional Food back alongside it, repeat. So the loop is Food-neutral
    // and Squirrel-positive, and the *only* thing it asks of the third card is a free
    // repeatable outlet that will eat one Food. The Zealot's surveil is never used.
    //
    // That makes the slot enumerable, and Spellbook enumerates it: seventeen outlets
    // behind Peregrin Took, twenty-nine behind Ygra, Eater of All, which fills the same
    // slot by making every other creature a Food. The six rows below are what the two
    // lists disagree about plus what neither holds — see the research-log entry for the
    // full sweep, including the eleven creature-only outlets that are behind Ygra and
    // cannot be behind Took, because Took's Food is an artifact and they will not eat it.
    //
    // **These rows claim less than the combo they cite, on purpose.** Spellbook tags the
    // Zealot version with "Infinite Food tokens", "Infinite card draw" and "Infinite
    // death triggers"; none of the three survives the arithmetic. The Food count is flat
    // — one spent, one returned — so Foods are created infinitely often but never
    // accumulate, and Peregrin Took's own draw wants three of them at once. Nothing in
    // the loop dies either: the Squirrels pile up untouched. What is left is the part
    // that is actually unbounded, and it is still a win: the Squirrels.
    {
      cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Bill the Pony'],
      confidence: 'verified',
      from: {
        id: '4321-5777-6798',
        cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Umbral Collar Zealot'],
      },
      swap: { out: 'Umbral Collar Zealot', in: 'Bill the Pony', inId: 1441 },
      why: 'Bill the Pony reads "Sacrifice a Food:" where the Zealot reads "Sacrifice another '
        + 'creature or artifact:", and a Food is what this loop feeds either of them — free, '
        + 'repeatable, no tap. His rider targets a creature you control and he is one himself, '
        + 'so there is always a legal target. Spellbook already publishes him as a free Food '
        + 'outlet behind Camellia in the Ygra, Eater of All version of this slot (1441-5776-5777) '
        + 'and simply does not list him behind Peregrin Took. He is also the one outlet here '
        + 'that satisfies the combo’s own prerequisite: "when Bill the Pony enters, create '
        + 'two Food tokens".',
      produces: [
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Mushroom Watchdogs'],
      confidence: 'verified',
      from: {
        id: '4321-5777-6798',
        cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Umbral Collar Zealot'],
      },
      swap: { out: 'Umbral Collar Zealot', in: 'Mushroom Watchdogs', inId: 7627 },
      why: 'Another free "Sacrifice a Food:", and like Bill the Pony already published behind '
        + 'Camellia in the Ygra version of this slot (5776-5777-7627) but not behind Peregrin '
        + 'Took. "Activate only as a sorcery" is the one difference from the Zealot and it does '
        + 'not bound the loop, which runs as many times as you like in your own main phase with '
        + 'an empty stack — it only means you cannot run it in response to removal. The counter '
        + 'lands every lap, so the Dog is the second unbounded thing here.',
      produces: [
        'Infinite creature tokens',
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Evereth, Viceroy of Plunder'],
      confidence: 'verified',
      from: {
        id: '4321-5777-6798',
        cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Umbral Collar Zealot'],
      },
      swap: { out: 'Umbral Collar Zealot', in: 'Evereth, Viceroy of Plunder', inId: 6495 },
      why: 'Evereth is the Zealot’s cost word for word — "Sacrifice another creature or '
        + 'artifact:" — so the Food he eats is the same Food, and he keeps the counter the '
        + 'Zealot spends on surveil. Spellbook has him in exactly one combo, which is why no '
        + 'score proposes him: the pairing came off reading the slot rather than off shared '
        + 'shapes. Sorcery-speed only, on the same reasoning as Mushroom Watchdogs. His '
        + 'Treasure clause never fires here and does not need to.',
      produces: [
        'Infinite creature tokens',
        'Infinite +1/+1 counters on a creature',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Rusted Slasher'],
      confidence: 'verified',
      from: {
        id: '4321-5777-6798',
        cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Umbral Collar Zealot'],
      },
      swap: { out: 'Umbral Collar Zealot', in: 'Rusted Slasher', inId: 1026 },
      why: '"Sacrifice an artifact: Regenerate this creature." A Food is an artifact, the cost '
        + 'is the whole cost, and regeneration shields stack harmlessly however many times you '
        + 'do it — so the rider being useless is exactly what makes this a clean substitution '
        + 'rather than a different combo. Spellbook publishes the same outlet in the Atog '
        + 'shapes it belongs to and puts thirteen other free artifact-eaters behind Peregrin '
        + 'Took; this one it missed. Colourless, so unlike every other row here it costs the '
        + 'deck no colour it did not already need for Camellia.',
      produces: [
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Thermal Navigator'],
      confidence: 'verified',
      from: {
        id: '4321-5777-6798',
        cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Umbral Collar Zealot'],
      },
      swap: { out: 'Umbral Collar Zealot', in: 'Thermal Navigator', inId: 3721 },
      why: '"Sacrifice an artifact: This creature gains flying until end of turn." The same '
        + 'reading as Rusted Slasher and the same conclusion: free, repeatable, eats the Food, '
        + 'and a rider that is redundant after the first activation and therefore cannot break '
        + 'the loop. Also colourless. Both it and Rusted Slasher sit in the data only in Emry, '
        + 'Lurker of the Loch shapes, which is why the substitution score never proposed either '
        + '— they share no shape with any outlet Spellbook put behind Peregrin Took.',
      produces: [
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
      ],
    },
    {
      cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Oxidda Daredevil'],
      confidence: 'verified',
      from: {
        id: '4321-5777-6798',
        cards: ['Camellia, the Seedmiser', 'Peregrin Took', 'Umbral Collar Zealot'],
      },
      swap: { out: 'Umbral Collar Zealot', in: 'Oxidda Daredevil', inId: 7369 },
      why: '"Sacrifice an artifact: This creature gains haste until end of turn." Free, '
        + 'repeatable, and the Food is an artifact. The haste is redundant on the second lap '
        + 'and irrelevant on the first, which is the point: nothing about the rider gates the '
        + 'sacrifice. Worth having anyway, because "Infinite creature tokens" wants haste from '
        + 'somewhere to be lethal this turn and the Daredevil is not the card that gives it — '
        + 'the Squirrels enter without it, so this row is a win the turn after, like the '
        + 'thirteen artifact-eaters Spellbook does list.',
      produces: [
        'Infinite creature tokens',
        'Infinite ETB',
        'Infinite LTB',
        'Infinite sacrifice triggers',
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

    // Bogwater Lumaret and Elas il-Kor, Sadistic Pilgrim, against the Soul Warden
    // family — the second and third rules here, and the case the mechanism was
    // built for.
    //
    // Spellbook enumerates this slot by name. Nine cards fill it across the same
    // loops, and four of them say one thing and only that thing:
    //
    //   Kor Celebrant           {2}{W}  1/4  Whenever THIS CREATURE OR another
    //                                        creature you control enters, you
    //                                        gain 1 life.
    //   Impassioned Orator      {1}{W}  2/2  Whenever another creature you
    //                                        control enters, you gain 1 life.
    //   Hinterland Sanctifier   {W}     1/2  (the same sentence)
    //   Social Climber          {2}{G}  3/2  (the same sentence, under Alliance,
    //                                        which is an ability word and no more)
    //
    //   Bogwater Lumaret        {B}{G}  2/2  Whenever THIS CREATURE OR another
    //                                        creature you control enters, you
    //                                        gain 1 life.
    //   Elas il-Kor             {W}{B}  2/2  Deathtouch. Whenever another creature
    //                                        you control enters, you gain 1 life.
    //                                        Whenever another creature you control
    //                                        dies, each opponent loses 1 life.
    //
    // Bogwater Lumaret is Kor Celebrant's sentence with nothing else on the card,
    // and he is in 60 published combos where Kor Celebrant is in 115, Impassioned
    // Orator 119, Hinterland Sanctifier 106 and Social Climber 107. The gap is that
    // he is Spellbook card 7399 and they have not caught up, not that anything
    // differs. Elas il-Kor is the same trigger plus a drain half, so he is the
    // strictly larger card and closes everything the four close.
    //
    // The two rules come to 61 card sets for Bogwater and 38 for Elas that are
    // neither published nor written out above. They produce 121 rows each against
    // the whole database; the rest are combos Spellbook has already published with
    // the subject in them, and matchUnofficial() drops those on sight.
    //
    // Read against the published steps for a dozen of these, the job is always the
    // one sentence: a creature token you control enters, the lifegainer gains 1
    // life, and something turns that life back into a counter, an untap or a
    // sacrifice. Nothing reads the lifegainer's colour, cost, body or type. The
    // Defiler of Faith lines were the ones to check, since Defiler cares what
    // colour a spell is — it is Kor Skyfisher and Whitemane Lion being recast
    // there, never the lifegainer.
    //
    // Five cards that fill the same slot are deliberately NOT sources, and the
    // rows above are what they produce instead. Soul Warden, Soul's Attendant and
    // Essence Warden read "whenever ANOTHER creature enters" — an opponent's too,
    // which neither subject sees. Prosperous Innkeeper's ETB Treasure and
    // Distinguished Conjurer's blink ability are what their loops actually run on.
    // Suture Priest's second half reads an opponent's board and Haliya, Guided by
    // Light's trigger reads artifacts. A rule is unconditional, and those five are
    // five conditions.
    //
    // Kor Celebrant is ranked last for Elas il-Kor on purpose: he triggers on
    // himself entering and Elas does not, so of the four he is the one whose text
    // Elas does not quite reach. It costs nothing in a loop whose creature is a
    // token, and the other three are cited first wherever Spellbook published them.
    {
      card: 'Bogwater Lumaret',
      cardId: 7399,
      confidence: 'verified',
      for: [
        {
          card: 'Kor Celebrant',
          cardId: 4268,
          why: 'Bogwater Lumaret and Kor Celebrant have one ability each and it is the '
            + 'same sentence: “Whenever this creature or another creature you control '
            + 'enters, you gain 1 life.” Nothing else is printed on either card. Bogwater '
            + 'is {B}{G} where Kor Celebrant is {2}{W}, which is the only difference that '
            + 'reaches the table — and it is the useful one, because it puts the ability '
            + 'in Golgari colours that Spellbook only ever writes into a combo in white.',
        },
        {
          card: 'Impassioned Orator',
          cardId: 2999,
          why: 'Impassioned Orator’s only ability is “Whenever another creature you '
            + 'control enters, you gain 1 life”, and Bogwater Lumaret’s is that plus his '
            + 'own arrival — strictly the larger trigger, and the extra half can only ever '
            + 'fire once. Every loop here is fed by a token entering, which both see.',
        },
        {
          card: 'Hinterland Sanctifier',
          cardId: 6097,
          why: 'Hinterland Sanctifier’s only ability is “Whenever another creature you '
            + 'control enters, you gain 1 life” — Bogwater Lumaret’s sentence, less his own '
            + 'arrival. A 1/2 Rabbit Cleric against a 2/2 Spirit Frog; no loop in this '
            + 'family reads the lifegainer’s body.',
        },
        {
          card: 'Social Climber',
          cardId: 3188,
          why: 'Social Climber’s only ability is “Alliance — Whenever another creature you '
            + 'control enters, you gain 1 life”. Alliance is an ability word and changes '
            + 'nothing about when it triggers, so this is Bogwater Lumaret’s sentence with '
            + 'a label on it.',
        },
      ],
    },
    {
      card: 'Elas il-Kor, Sadistic Pilgrim',
      cardId: 2811,
      confidence: 'verified',
      for: [
        {
          card: 'Impassioned Orator',
          cardId: 2999,
          why: 'Impassioned Orator’s only ability is “Whenever another creature you '
            + 'control enters, you gain 1 life”, which is Elas il-Kor’s second line word '
            + 'for word. Elas adds deathtouch and “whenever another creature you control '
            + 'dies, each opponent loses 1 life”, so he is the strictly larger card — the '
            + 'drain turns several of these loops into a win, but the loop itself runs on '
            + 'the lifegain either way.',
        },
        {
          card: 'Hinterland Sanctifier',
          cardId: 6097,
          why: 'Hinterland Sanctifier’s only ability is “Whenever another creature you '
            + 'control enters, you gain 1 life” — Elas il-Kor’s second line exactly. Elas '
            + 'carries two abilities the Sanctifier does not, and neither takes anything '
            + 'away from the one they share.',
        },
        {
          card: 'Social Climber',
          cardId: 3188,
          why: 'Social Climber’s only ability is “Alliance — Whenever another creature you '
            + 'control enters, you gain 1 life”. Alliance is an ability word and no part of '
            + 'the trigger condition, so this is Elas il-Kor’s second line with a label.',
        },
        {
          card: 'Kor Celebrant',
          cardId: 4268,
          why: 'Kor Celebrant reads “whenever THIS CREATURE or another creature you '
            + 'control enters” where Elas il-Kor reads only “another”, so Elas is the one '
            + 'card here whose trigger is narrower than its source — he does not fire on '
            + 'his own arrival. Every loop in this family is fed by a token entering '
            + 'afterwards, so nothing turns on it; he is cited last so that the three '
            + 'exact matches are preferred wherever Spellbook published them.',
        },
      ],
    },
  ];

  const api = { COMBOS, STAND_INS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.UnofficialCombos = api;
}(typeof self !== 'undefined' ? self : this));
