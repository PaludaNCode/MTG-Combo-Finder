// The decisions app.js used to make while building DOM: what a sentence says, how
// a number is phrased, which of five pips is which.
//
// Why this file exists. `app.js` is deliberately not covered by the unit tests —
// it is the layout test's job, and that is the right call for DOM wiring. It is a
// much weaker call for the parts of app.js that are not DOM wiring at all. The
// layout test proves a panel is not empty; it cannot prove the panel is telling
// the truth, because **a wrong number renders exactly as happily as a right one**.
// "3 of your combos need both" and "4 of your combos need both" are both perfectly
// good HTML.
//
// So everything here is a pure function of a search result: strings and numbers in,
// strings and numbers out, no `document`. app.js turns what comes back into
// elements and does nothing else with it. Same IIFE shape as every other module, so
// `node --test` can require it.
//
// The rule for what belongs here: if getting it wrong would produce a page that
// looks right and says something false, it is a decision, and it goes here.
(function (global) {
  'use strict';

  // ---- comparing cards on the map -------------------------------------------

  // How many of the cards they all combo with to name before the number speaks
  // for itself.
  const SHARED_NAMED = 3;

  // What picking two or three cards out of the map found, in a sentence. Every
  // number in it is counted by ComboGraph.compare(); this decides what they mean
  // and how to say it.
  //
  // The pluralisation is the fiddly part and the reason this is tested: "both"
  // against "all three", "card" against "cards", a list that is one name or two
  // names joined by "and" or a comma-run ending in "and". Each is a small mistake
  // that reads as a broken page.
  function pickedSentence(found) {
    const names = found.cards;
    const list = names.length === 1 ? names[0]
      : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
    const plural = names.length > 2 ? 'all three' : 'both';

    if (names.length === 1) {
      const parts = [list + ' is in ' + found.inAll + ' of your combos'];
      if (found.shared.length) {
        parts.push('with ' + found.shared.length + ' other '
          + (found.shared.length === 1 ? 'card' : 'cards'));
      }
      let text = parts.join(', ') + '. ';
      text += found.lost
        ? 'Cutting it would cost ' + found.lost + ' of them'
          + (found.saved ? '; the other ' + found.saved + ' have a stand-in' : '')
        : 'Cutting it costs nothing — every one of them has a stand-in in your deck';
      return text + '. Pick another card to compare the two.';
    }

    const relation = [];
    if (found.inAll) relation.push(found.inAll + ' need ' + plural);
    if (found.interchangeable) {
      relation.push(found.interchangeable + ' take any one of them in the same slot');
    }
    if (!relation.length) relation.push('no combo of yours needs them together or takes one for another');

    // "3 of your combos need both, 4 take any one of them" — what the numbers
    // count is said once, on the first of them, whichever that turns out to be.
    let text = list + ': ' + relation.join(', ').replace(/^(\d+)/, '$1 of your combos') + '. ';
    if (found.shared.length) {
      const named = found.shared.slice(0, SHARED_NAMED).join(', ');
      const more = found.shared.length - SHARED_NAMED;
      text += (names.length > 2 ? 'All three' : 'Both') + ' combo with ' + named
        + (more > 0 ? ' and ' + more + ' more' : '') + '. ';
    }
    text += found.lost
      ? 'Cut ' + plural + ' and ' + found.lost + ' of the ' + found.atRisk
        + ' combos they appear in would go'
        + (found.saved ? '; the other ' + found.saved + ' have a stand-in' : '')
      : 'Cut ' + plural + ' and none of the ' + found.atRisk
        + ' combos they appear in would go — each has a stand-in in your deck';
    return text + '.';
  }

  // ---- how big the combos are -----------------------------------------------

  // The pills that say what sizes a card's combos come in: "3 × 2-card", "1 ×
  // 4-card". Takes what DeckCombos.sizeBreakdown() produces and returns one entry
  // per pill; app.js makes each a span.
  function sizePills(breakdown) {
    const rows = breakdown || [];
    if (!rows.length) return [];
    // A single combo needs no multiplier: "2-card" says it.
    const only = rows.length === 1 && rows[0].count === 1;
    return rows.map(({ size, count }) => ({
      label: only ? size + '-card' : count + ' × ' + size + '-card',
      title: count === 1
        ? `One combo needing ${size} cards on the table`
        : `${count} combos needing ${size} cards on the table`,
      // Two cards is as small as a combo gets, so a two-card pill is the easiest
      // thing on the page and the one worth marking. Marking whichever pill happens
      // to be smallest on its row would instead mark "smallest of one size" — a
      // card whose seven combos all need three would light up for it.
      easiest: size <= 2,
    }));
  }

  // ---- the numbers a row carries, and whose combos they are -------------------

  // A result row's numbers sit in a column of their own rather than in the
  // sentence: the total, the word, and under it the two halves it is made of —
  // "24 / combos / 17+7". One function for all three because they are one claim,
  // and a total that disagreed with its own halves is the worst thing this panel
  // could print.
  //
  // The halves are numerals where they used to be "17 official · 7 unofficial",
  // and that is a deliberate reversal of what this file used to say. The words
  // were here so the distinction did not rest on colour, which is a real concern
  // and the reason `spoken` exists: it is the split's accessible name and its
  // tooltip, so the sentence still reaches a screen reader and a pointer while
  // the column stays a column. Cutting the words *without* that would be the
  // version of this change that hides half the answer.
  //
  // `plus` is the suggestion panel's "+24" — there the total is what the card
  // would add. The split never takes the sign: "+20+4" reads as arithmetic, and
  // the + between the halves is the only one that means anything.
  function rowNumbers(official, ours, plus) {
    const total = official + ours;
    return {
      sign: plus ? '+' : '',
      count: String(total),
      // What the column has to hold. Four-digit totals are real — one card
      // unlocks 1,889 combos of ours — and widening the gutter for every row to
      // fit them would take 20px off the card name on the rows that don't need
      // it. Stepping the rare ones down a size keeps one fixed column instead,
      // and right alignment means the edge does not move when the size does.
      scale: total >= 1000 ? 'wide' : total >= 100 ? 'mid' : null,
      label: total === 1 ? 'combo' : 'combos',
      spoken: (plus ? 'unlocks ' : 'in ') + total + ' combo' + (total === 1 ? '' : 's'),
      // Only worth printing when the count has two halves, which most rows do
      // not. A card whose whole case is ours still says so, in the spoken half:
      // "none published" is the interesting part of that row, not a gap.
      //
      // The words come back too, because whether they are *shown* is not a
      // decision this function can make — it depends on how wide the row's own
      // column turns out to be, which only CSS knows. So both readings are built
      // and the stylesheet picks: "17+7" where the gutter is 4.2rem, and
      // "17 official · 7 unofficial" where it has room to be 12rem. Two readings
      // of one pair of numbers, never two different pairs.
      split: ours ? {
        official: String(official),
        ours: String(ours),
        officialWord: 'official',
        oursWord: 'unofficial',
        spoken: (official
          ? official + ' published by Commander Spellbook'
          : 'none published by Commander Spellbook')
          + ', ' + ours + ' unofficial',
      } : null,
    };
  }

  // ---- which bracket the list is in -------------------------------------------

  const BRACKET_NAMES = { 1: 'Exhibition', 2: 'Core', 3: 'Upgraded', 4: 'Optimized', 5: 'cEDH' };
  const BRACKET_STEPS = [1, 2, 3, 4, 5];

  // The words and the pip states behind the bracket line. A floor, never a verdict
  // — see bracketCheck() in combos.js for why, and for the two criteria it rests
  // on. Returns null when there is no answer to give, because half a bracket check
  // is worse than none.
  function bracketProse(bracket) {
    if (!bracket) return null;
    const changers = bracket.gameChangers || [];
    const wins = bracket.twoCardWins || [];
    const floor = bracket.floor;

    // Bracket 4 is the top this check can reach, so "at the earliest" would be
    // promising a 5 it cannot rule in.
    const headline = floor > 2
      ? `Bracket ${floor}${floor === 4 ? '' : ' at the earliest'}`
      : 'Nothing here rules out bracket 2';
    const named = headline + ' — ' + BRACKET_NAMES[floor];

    const counts = [];
    if (changers.length) {
      counts.push(changers.length + ' Game Changer' + (changers.length === 1 ? '' : 's'));
    }
    if (wins.length) {
      counts.push(wins.length === 1
        ? '1 two-card combo that ends the game'
        : wins.length + ' two-card combos that end the game');
    }
    const reason = floor === 4
      ? `${counts.join(' · ')}. Bracket 3 allows three Game Changers, so a list with more sits at 4.`
      : floor === 3
        ? `${counts.join(' · ')}. Brackets 1 and 2 allow neither, so 3 is the floor.`
        : 'No Game Changers, and no two-card combo that says it ends the game.';

    // Struck through below the floor, filled at it, outlined above — so the number
    // reads as a position on a scale rather than a score from nowhere.
    const steps = BRACKET_STEPS.map((n) => ({
      n,
      state: n < floor ? 'out' : n === floor ? 'floor' : 'open',
    }));

    return { floor, headline, named, reason, steps };
  }

  // ---- what the search cost ---------------------------------------------------

  const secs = (ms) => (ms >= 100 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms');

  // What the first phase is called depends on where the bytes came from, and the
  // difference is the most interesting thing on the line. `msFetch` in search.js
  // times fetchDatabase(), which either downloads the database or reads the copy
  // already on disk — two operations three orders of magnitude apart.
  //
  // Calling both "download" was wrong, and wrong in the direction that matters:
  // a first visit read `download 1.5s` and the second read `download 39ms`, which
  // says the network got forty times faster rather than that the cache did its
  // job. The number was honest and the word was not.
  const SOURCE_LABEL = { cache: 'cache', network: 'download' };

  // "ready in 1.4s (download 0.9s · parse 0.4s · match 0.1s)" on a first visit,
  // "ready in 0.2s (cache 39ms · parse 43ms · match 71ms)" on the next one.
  //
  // Only the phases that happened. The second search *within* a session has no
  // fetch and no parse at all — the dataset is already in memory, which is the
  // whole reason the worker keeps it — and printing "download 0ms" would report a
  // skipped phase as an instant one, which is the opposite of what makes the
  // number worth having.
  function timingSentence(t, source) {
    if (!t || typeof t.total !== 'number') return '';
    const parts = [];
    if (typeof t.fetch === 'number') {
      // An unrecognised source falls back to the neutral word rather than to
      // "download", which would be a guess in the one place a guess misleads.
      parts.push((SOURCE_LABEL[source] || 'read') + ' ' + secs(t.fetch));
    }
    if (typeof t.parse === 'number') parts.push('parse ' + secs(t.parse));
    if (typeof t.match === 'number') parts.push('match ' + secs(t.match));
    // One phase and a total that agrees with it is the same number twice.
    return parts.length > 1
      ? `ready in ${secs(t.total)} (${parts.join(' · ')})`
      : `ready in ${secs(t.total)}`;
  }

  // ---- a deck that arrived as a file -----------------------------------------
  //
  // Dropping a file is the one way into this page that can fail for reasons the
  // reader can actually fix — wrong file, empty file, a screenshot of a decklist
  // rather than the decklist. So each refusal names what happened *and* what to do,
  // and none of them says "invalid file", which tells nobody anything.
  //
  // Here rather than in app.js because a sentence that miscounts, or that says
  // "cards" when it loaded one, is exactly the kind of wrong that looks right.
  // "1 card", "12 cards". A count and its noun are the pair most likely to be
  // built by hand in three places and get it wrong in one of them.
  const plural = (n, noun) => n + ' ' + noun + (n === 1 ? '' : 's');

  const FILE_REFUSALS = {
    'too-big': (name, limitMb) => `${name} is too big to be a decklist (over ${limitMb} MB). `
      + 'Export the deck as text and try that file, or paste it below.',
    empty: (name) => `${name} is empty. Export the deck as text and try again, or paste it below.`,
    'not-text': (name) => `${name} isn’t a text file. Deck sites all offer a text or .txt export — `
      + 'use that one, or paste the list below.',
    unreadable: (name) => `${name} could not be read as text. If it is a spreadsheet or a PDF, `
      + 'export the deck as plain text instead, or paste it below.',
    'no-cards': (name) => `No card lines found in ${name}. `
      + 'It should have one card per line, like "1 Sol Ring".',
  };

  function fileRefusal(reason, name, limitBytes) {
    const build = FILE_REFUSALS[reason] || FILE_REFUSALS.unreadable;
    const label = name ? '“' + name + '”' : 'That file';
    return build(label, Math.round((limitBytes || 0) / 1024 / 1024));
  }

  // What a successful drop says. Counts come from the same parseDecklist() the
  // search runs, so this cannot claim a card the search will not see.
  function fileLoaded(name, counts) {
    const c = counts || {};
    const cards = Number(c.main) || 0;
    const commanders = Number(c.commanders) || 0;
    const parts = [plural(cards, 'card')];
    if (commanders) parts.push(plural(commanders, 'commander'));
    // A file with lines the parser threw away is worth saying so about: the
    // reader chose this file, and silently dropping a third of it is the sort of
    // thing they should hear from us rather than notice in the results.
    const skipped = Number(c.skipped) || 0;
    const tail = skipped ? ` ${plural(skipped, 'line')} skipped.` : '';
    return `Loaded ${parts.join(' + ')} from “${name}”.${tail}`;
  }

  // ---- cards the snapshot has never heard of ---------------------------------

  // How many names to write out before the list stops being readable. Twenty is
  // already an unusual paste; past that the count is the information.
  const UNKNOWN_NAMED = 20;

  // Above this fraction of the deck, the answer is about the data and not about the
  // deck. It is the guard the whole feature rests on, for the reason `deckIdentity()`
  // already returns null rather than guessing: when the identity map cannot answer,
  // say nothing.
  //
  // The case is not hypothetical in either direction. The test fixture's
  // `cardIdentity` has 14 entries against decks of 85 and 103 cards, so the naive
  // version reports 83% of the tuning deck as unrecognized in `npm run verify` and
  // `npm run test:ui`. And the published payload has shipped `cardIdentity: {}` once
  // already, which made colour filtering silently inert — that same payload would
  // report *every card in the deck* as unknown.
  //
  // A half rather than something tighter, because the rule has to survive a small
  // paste: a reader checking three cards with one typo is 33% unknown and deserves
  // to be told. Nobody's real decklist is half misspelled, and a map thin enough to
  // be broken misses almost everything — the fixtures are at 83% and 100%, not 55%.
  const UNKNOWN_LIMIT = 0.5;

  // What to say about the cards the snapshot did not recognise, or null for nothing
  // at all — which is the answer whenever the data cannot support the claim.
  //
  // The wording is careful about what is actually known. The data is a nightly
  // snapshot of Scryfall by way of Spellbook, so the honest sentence is that *this
  // snapshot* has no card by that name, not that the card does not exist. A page
  // that says "Sol Rimg is not a real card" is wrong the day a set is released.
  function unrecognizedNote(found) {
    const names = (found && found.names) || [];
    const checked = Number(found && found.checked) || 0;
    if (!names.length || !checked) return null;
    // No map at all cannot distinguish an unknown card from an unknown database.
    if (!Number(found.mapped)) return null;
    if (names.length / checked > UNKNOWN_LIMIT) return null;

    const shown = names.slice(0, UNKNOWN_NAMED);
    const rest = names.length - shown.length;
    const sentence = names.length === 1
      ? 'One card in your list isn’t in this snapshot of the card list, so no combo was looked for it:'
      : `${names.length} cards in your list aren’t in this snapshot of the card list, `
        + 'so no combo was looked for them:';
    return {
      count: names.length,
      names: shown,
      more: rest > 0 ? rest : 0,
      sentence,
      // Every cause, because the reader cannot tell them apart from here and only
      // one of them is their mistake.
      why: 'Usually a misspelling. A card printed since the snapshot, an older or '
        + 'alternate name, and a token line pasted out of a deck export all land here too.',
    };
  }

  const api = {
    pickedSentence,
    unrecognizedNote,
    UNKNOWN_NAMED,
    UNKNOWN_LIMIT,
    sizePills,
    rowNumbers,
    bracketProse,
    timingSentence,
    fileLoaded,
    fileRefusal,
    secs,
    SHARED_NAMED,
    BRACKET_NAMES,
    BRACKET_STEPS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.DeckView = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
