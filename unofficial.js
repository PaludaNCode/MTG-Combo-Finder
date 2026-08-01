// Combos this project believes in that Commander Spellbook has not published.
//
// Everything else on the page comes from Spellbook's variants file and is shown on
// their authority. This file is the exception, and it exists because their coverage
// has holes: two cards that do the same thing are not always written into the same
// combos, so a deck holding one of them is told about a line while a deck holding
// the other is told nothing.
//
// The holes are found by substitution. Take two cards that appear interchangeably
// across many published combos — Soul Warden and Essence Warden share 97.5% of
// theirs — and any combo that names one but not the other is a candidate. Most
// candidates are not gaps: the cards turn out to differ in a way that matters to
// that particular loop, and the audit in the README lists the 28 of 44 that were
// ruled out and why. What survives is here.
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
      why: 'Quina fills the same doubling role Chatterfang does here, confirmed against '
        + 'both cards’ text. The rest of the loop is untouched.',
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

    // ---- derived, not read against the card text -----------------------------
    //
    // One shape, six rows. Spellbook publishes <token maker> + Sadistic Glee with all
    // fourteen sacrifice outlets it knows, and publishes the same token makers with
    // Necrosynthesis for eight other outlets — including Altar of Dementia, which like
    // these three is free and makes no mana. So both halves of every swap below are
    // already published; only the specific pairing is missing. What has not been done
    // is reading Necrosynthesis against Sadistic Glee, which is why these say derived.
    {
      cards: ['Scurry Oak', 'Necrosynthesis', 'Viscera Seer'],
      confidence: 'derived',
      from: { id: '2082-2292-4186', cards: ['Scurry Oak', 'Sadistic Glee', 'Viscera Seer'] },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
      why: 'Both halves of the swap are published separately; the pairing is not.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite scry 1', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Scurry Oak', 'Necrosynthesis', 'Carrion Feeder'],
      confidence: 'derived',
      from: { id: '2082-2438-4186', cards: ['Scurry Oak', 'Sadistic Glee', 'Carrion Feeder'] },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
      why: 'Both halves of the swap are published separately; the pairing is not.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Scurry Oak', 'Necrosynthesis', 'Umbral Collar Zealot'],
      confidence: 'derived',
      from: { id: '2082-4186-6798', cards: ['Scurry Oak', 'Sadistic Glee', 'Umbral Collar Zealot'] },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
      why: 'Both halves of the swap are published separately; the pairing is not.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite +1/+1 counters on a creature', 'Infinite surveil',
      ],
    },
    {
      cards: ['Herd Baloth', 'Necrosynthesis', 'Viscera Seer'],
      confidence: 'derived',
      from: { id: '2082-2292-3197', cards: ['Herd Baloth', 'Sadistic Glee', 'Viscera Seer'] },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
      why: 'Both halves of the swap are published separately; the pairing is not.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite scry 1', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Herd Baloth', 'Necrosynthesis', 'Carrion Feeder'],
      confidence: 'derived',
      from: { id: '2082-2438-3197', cards: ['Herd Baloth', 'Sadistic Glee', 'Carrion Feeder'] },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
      why: 'Both halves of the swap are published separately; the pairing is not.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite +1/+1 counters on a creature',
      ],
    },
    {
      cards: ['Herd Baloth', 'Necrosynthesis', 'Umbral Collar Zealot'],
      confidence: 'derived',
      from: { id: '2082-3197-6798', cards: ['Herd Baloth', 'Sadistic Glee', 'Umbral Collar Zealot'] },
      swap: { out: 'Sadistic Glee', in: 'Necrosynthesis' },
      why: 'Both halves of the swap are published separately; the pairing is not.',
      produces: [
        'Infinite LTB', 'Infinite ETB', 'Infinite sacrifice triggers',
        'Infinite death triggers', 'Infinite +1/+1 counters on a creature', 'Infinite surveil',
      ],
    },
  ];

  const api = { COMBOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.UnofficialCombos = api;
}(typeof self !== 'undefined' ? self : this));
