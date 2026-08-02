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
        { out: 'Sadistic Glee', in: 'Necrosynthesis' },
        { out: 'Carrion Feeder', in: 'Hammerhead, Maggia Boss' },
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
        { out: 'Sadistic Glee', in: 'Necrosynthesis' },
        { out: 'Carrion Feeder', in: 'Hammerhead, Maggia Boss' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
      swap: { out: 'Archangel of Thune', in: 'Heroic Feast' },
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
        { out: 'Archangel of Thune', in: 'Heroic Feast' },
        { out: 'Bartolomé del Presidio', in: 'Hammerhead, Maggia Boss' },
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
      confidence: 'verified',
      for: [
        {
          card: 'Bartolomé del Presidio',
          why: 'Hammerhead and Bartolomé del Presidio have one ability each and it is '
            + 'the same sentence: “Sacrifice another creature or artifact: Put a +1/+1 '
            + 'counter on this creature.” Same cost, free and repeatable, same 2/1 body. '
            + 'Spellbook publishes this combo with Bartolomé and has never used '
            + 'Hammerhead in a combo at all — he is mono-black where Bartolomé is '
            + 'white-black, which is the only difference that reaches the table.',
        },
        {
          card: 'Carrion Feeder',
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
