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

  // ---- what "Combos in your deck" is a list of --------------------------------

  // The panel is headed "Combos in your deck" and its rows are *cards*, one per card
  // that carries at least one. That mismatch is the whole reason this function exists:
  // the count beside the heading has to be combos, because that is what the heading
  // says, and it will therefore disagree with the number of rows underneath it: the
  // standing Chatterfang deck's 233 combos are carried by some subset of its 103 cards.
  // A three-figure badge over a two-figure list of rows, with nothing explaining the
  // difference, is a page that looks right and says something false — which is the rule
  // for what belongs in this file.
  //
  // So both numbers are stated, in the panel, in one sentence: how many combos, and
  // how many of your cards carry them.
  //
  // `official` and `ours` stay apart for the same reason they do on every row — an
  // unofficial row is not published data and is never counted as though it were. A
  // deck can be all one or all the other: a card can carry nothing but combos of ours.
  //
  // Returns null when there is nothing to say, and the panel prints its empty line
  // instead. The badge is `count`, which is the published total alone — the same
  // number the panel that used to list the combos row by row carried.
  function deckCombosNote(official, ours, cards) {
    if (!official && !ours) return null;
    const combos = (n) => n + ' combo' + (n === 1 ? '' : 's');
    const carried = `carried by ${cards} of your card${cards === 1 ? '' : 's'}`;

    let what;
    if (official && ours) {
      what = `${combos(official)} published by Commander Spellbook and ${ours} of ours`;
    } else if (official) {
      what = `${combos(official)} published by Commander Spellbook`;
    } else {
      what = `${combos(ours)} of ours, none published by Commander Spellbook`;
    }

    return {
      count: official || null,
      sentence: `${what}, ${carried}. Each row is one card: the number beside it is what `
        + 'cutting that card would cost, and the combos behind it are folded away underneath.',
    };
  }

  // ---- what this session added, and what it bought ----------------------------

  // The caption over "Cards you've added": how many cards, and the one number that says
  // whether adding them was worth it.
  //
  // The badge beside that heading counts **cards** while the sentence talks about
  // **combos**, which is the disagreement `deckCombosNote()` above exists to handle on
  // the other panel — a count beside a heading has to say what it counts, or the two
  // read as the same number disagreeing with itself. So the sentence leads with the card
  // count in words.
  //
  // Only one combo figure is offered, and that is deliberate. Every card in this list
  // also has a personal count — Herd Baloth is in 18 of the tuning deck's combos — and
  // those **cannot be added up**: on the five-card basket the prototypes were drawn
  // from they total 57 while the deck gained 47, because a combo naming two of the
  // cards is counted by both. A panel that summed its own rows would be wrong by ten
  // and look arithmetically sound. So the deck total before and after is the claim, and
  // the per-row numbers are left as what they are — descriptions of one card.
  //
  // `before` is null until a search has established a baseline, and then the sentence is
  // the card count alone rather than a delta against a number nobody measured.
  // `before` and `after` are `{ official, ours }` pairs, and taking both halves is not
  // decoration — it is the fix for a caption that contradicted its own rows. The rows
  // count both, the way every row on this page does, so a caption counting only the
  // published half read **"this deck still has 0 combos — none of them changed that"**
  // directly above a row saying **1 combo · 0 official · 1 unofficial**. Photographed on
  // the `unofficialAlmost` fixture, which is the one deck here where an added card's
  // combos are entirely ours.
  //
  // They are still never *summed*. An unofficial row is not published data, and "this
  // deck has 14 combos" would be counting it as though it were — the rule the whole
  // unofficial panel rests on. So where there are any of ours the sentence names the two
  // separately, exactly as `deckCombosNote()` does one panel up; where there are none —
  // which is most decks — it says "combos" and stays short.
  function basketNote(cards, before, after) {
    if (!cards) return null;
    const combos = (n) => n + ' combo' + (n === 1 ? '' : 's');
    const what = `${cards} card${cards === 1 ? '' : 's'} that ${cards === 1 ? 'was' : 'were'} `
      + 'not in the deck you started with';

    if (!before || !after || before.official == null || after.official == null) {
      return { count: cards, sentence: what + '.' };
    }

    let outcome;
    if (before.ours || after.ours) {
      // "(was N)" rather than three phrasings per half: with two halves that is nine
      // sentences, and the one nobody writes a test for is the one that reads wrong.
      outcome = `this deck has ${combos(after.official)} published by Commander Spellbook `
        + `(was ${before.official}) and ${after.ours} of ours (was ${before.ours})`;
    } else if (after.official > before.official) {
      outcome = `this deck has ${combos(after.official)} rather than ${before.official}`;
    } else if (after.official === before.official) {
      // "went from 33 to 33" reads as an arithmetic error rather than as the useful fact
      // it is, which is that the reader has bought nothing.
      outcome = `this deck still has ${combos(after.official)} — none of them changed that`;
    } else {
      // Reachable: the basket holds only additions, but the reader can cut cards by hand
      // in the same sitting, and phrasing that as a gain would be the page lying about
      // their own edit.
      outcome = `this deck has ${combos(after.official)}, down from ${before.official}`;
    }
    return { count: cards, sentence: `${what}. With ${cards === 1 ? 'it' : 'them'} in, ${outcome}.` };
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

  // The rule itself, in one place, because two features need it and a second copy is
  // a second thing to get wrong: a claim about more than half the deck is a claim
  // about the data. Used by unrecognizedNote() below and by legalityProse().
  function tooMuchOfTheDeck(count, checked) {
    return !checked || count / checked > UNKNOWN_LIMIT;
  }

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
    if (tooMuchOfTheDeck(names.length, checked)) return null;

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

  // ---- how many cards, and how many of them are lands ------------------------

  // What the strip above the results says, or null for nothing at all.
  //
  // The card count is the one number here that never depends on the data: it is a sum
  // over the decklist somebody pasted, so it survives a payload with no card lists in
  // it at all. Everything else is a claim about card types, and each has its own
  // reason to be dropped rather than guessed:
  //
  //   - no land list (`mapped` 0) means the payload cannot answer. An empty list is
  //     what a broken publish looks like, and reading it as "this deck plays no
  //     lands" would put a confident 0 on screen for every deck at once.
  //   - too much of the deck unread means the *data* is thin rather than the deck
  //     odd, which is the rule unrecognizedNote() and legalityProse() already share.
  //   - the basic/nonbasic split needs the basic list, because a deck with no basics
  //     and a payload with no basic list both arrive as 0.
  //
  // Spells before lands, and both after the total: the deck's body is what somebody
  // reads first, and the land count is the number they came to check.
  function deckCountsNote(counts) {
    const cards = Number(counts && counts.cards) || 0;
    if (!cards) return null;

    const parts = [{ key: 'cards', text: plural(cards, 'card') }];
    const unread = Number(counts.unread) || 0;
    const typed = Number(counts.mapped) > 0 && !tooMuchOfTheDeck(unread, cards);

    if (typed) {
      const spells = { key: 'spells', text: `${Number(counts.spells) || 0} spells` };
      // The modal double-faced cards, said where they are counted. They are in the
      // spells because the front face is what you cast — which is also what the reader's
      // deck site shows — but a deck runs them partly as lands, so a land count that
      // never mentions them answers a slightly different question than the one asked.
      //
      // "MDFC" and not "with a land back": it is what a deckbuilder calls these, and it
      // is short enough to sit inside a strip that already wraps on a phone. It is also
      // the page's only acronym, so it carries its expansion — `subTitle` becomes a
      // `title` on the aside, which is where a reader who does not know the word can
      // find out without leaving the page.
      if (counts.mdfcKnown && Number(counts.mdfc)) {
        spells.sub = plural(Number(counts.mdfc), 'MDFC');
        spells.subTitle = 'Modal double-faced cards: a spell on the front, a land on the back. '
          + 'Counted here rather than as lands, which is what your deck site does too.';
      }
      parts.push(spells);
      // The one sub-number a deckbuilder acts on, and only when both halves of it are
      // real. Written as the strip's own aside rather than a second line: it qualifies
      // the land count and means nothing away from it.
      const count = Number(counts.lands) || 0;
      const lands = { key: 'lands', text: `${count} lands` };
      // Only the halves that are there. "10 basic · 0 nonbasic" is a zero nobody asked
      // about, and a deck of nothing but duals reads better as "36 nonbasic" than as an
      // apology for having no Forests.
      //
      // Two fields rather than one string, because the second half is what a narrow
      // column drops first — see style.css. `sub` is what always shows once the aside
      // shows at all, and `subExtra` is the part a phone does without: it is the one
      // number here a reader can work out from the other two, since nonbasic is the
      // land count minus the basics.
      if (counts.basicsKnown && count) {
        const halves = [
          Number(counts.basic) ? `${counts.basic} basic` : '',
          Number(counts.nonbasic) ? `${counts.nonbasic} nonbasic` : '',
        ].filter(Boolean);
        if (halves.length) lands.sub = halves[0];
        if (halves.length > 1) lands.subExtra = halves[1];
      }
      parts.push(lands);
      // Says why the three numbers do not add up, in the one case where they don't.
      // Quiet, because it is a note about the data and not a finding about the deck —
      // the unrecognized-cards box above is where those names are named.
      // "unread", not "N cards unread". In a keyed row the noun becomes the key, so the
      // old wording rendered as "CARD UNREAD | 1" — the count and its noun either side of
      // the column, reading backwards. The aside carries what it means.
      if (unread) {
        parts.push({
          key: 'unread',
          text: `${unread} unread`,
          // The unrecognized-cards box above says "aren't in this snapshot of the card
          // list"; this is the same claim in the words that fit a row. "no type line in
          // this snapshot" was the first wording and wrapped the row on a phone.
          sub: 'not in this snapshot',
          quiet: true,
        });
      }
    }

    return { label: 'Deck', parts, typed };
  }

  // ---- whether the decklist is allowed ---------------------------------------

  // The colours a card carries that its commander does not, as mana symbols read the
  // way the pips are: "{W}" rather than "W", and in WUBRG order, since that is the
  // order Magic prints them in — so a Simic commander reads {U}{G} and never {G}{U}.
  //
  // The order is written out here rather than borrowed from identityString() in
  // combos.js or the pips in render-rows.js, which both hold their own copy: this
  // file is a pure function of a search result and requires nothing, which is what
  // lets `node --test` reach it. Five letters in a fixed order is the cheapest thing
  // in the repository to keep in three places.
  const WUBRG_ORDER = ['W', 'U', 'B', 'R', 'G'];
  // The letters a card or a command zone carries, in the order Magic prints them, so a
  // Simic commander is UG and never GU.
  //
  // Letters and not "{U}{G}". This used to return the braced form and app.js printed it
  // as text, so the one place on the page that talks about colours in a sentence was the
  // one place that showed "{U}{B}{R}" instead of drawing the pips every other line draws.
  // The braces were a notation for a renderer that never read them.
  const colourLetters = (colours) => WUBRG_ORDER
    .filter((c) => String(colours || '').includes(c))
    .join('');

  // What to say about a decklist's legality, or null for nothing at all.
  //
  // Two findings, kept apart the whole way, because they are different accusations:
  // a card outside the commander's colour identity is a decklist mistake, and a
  // banned card is a format rule. Running them together would be alarming where the
  // panel should be useful.
  //
  // Nothing to report is *silence*, not a clean bill of health. "0 problems" is a
  // claim this cannot support — only two of the format's rules are readable off a
  // card list, exactly as with the bracket, and a green tick would be read as
  // covering singleton, deck size, and everything else nobody checked.
  //
  // What it did not check comes along with a finding rather than standing on its own,
  // for the same reason: a panel that appears on a legal deck to say what it skipped
  // is an empty panel with a caveat in it.
  function legalityProse(check) {
    if (!check) return null;
    const banned = (check.banned || []).slice();
    let off = (check.offIdentity || []).slice();

    // The rule shared with unrecognizedNote(). Off-identity is computed only over
    // cards the map knows, so it cannot invent a card — but it *can* be wrong about
    // all of them at once, which is what a commander whose own identity came back
    // empty looks like. The published data has zeroed real cards' identities once
    // already, and half a deck reading as illegal is that, not a deck.
    if (off.length && tooMuchOfTheDeck(off.length, Number(check.checked) || 0)) off = [];

    // One card, one accusation, and the graver one. A banned card in the wrong
    // colours is on both lists — the ban list is not filtered by colour — and naming
    // it twice reads as two problems where there is one card to cut. The ban is the
    // format refusing it; the colours would stop mattering the moment it went.
    if (banned.length && off.length) {
      const onBanList = new Set(banned.map((name) => name.toLowerCase()));
      off = off.filter((o) => !onBanList.has(String(o.card).toLowerCase()));
    }

    if (!banned.length && !off.length) return null;

    const unchecked = [];
    // Said only alongside a finding, and worth saying then: a reader looking at one
    // banned card should know the other half of the question went unanswered.
    if (!check.canCheckIdentity) {
      unchecked.push((check.commanders || []).length
        ? 'This snapshot does not know your commander, so colour identity was not checked.'
        : 'No commander was named, so colour identity was not checked.');
    }
    if (!check.hasBanList) {
      unchecked.push('This snapshot carries no ban list, so nothing was checked against one.');
    }

    return {
      banned,
      bannedSentence: banned.length === 1
        ? 'One card in your list is banned in Commander:'
        : `${banned.length} cards in your list are banned in Commander:`,
      offIdentity: off.map((o) => ({ card: o.card, colours: colourLetters(o.colours) })),
      // The sentence and the commander's colours are separate, because the colours are
      // drawn rather than written: app.js puts real pips between the two halves. Ending
      // the first half without its bracket would leave a renderer free to forget the
      // colours entirely and still read as a finished sentence, so the halves are named
      // for what surrounds them.
      identitySentence: off.length === 1
        ? 'One card is outside your commander’s colour identity ('
        : `${off.length} cards are outside your commander’s colour identity (`,
      identityColours: colourLetters((check.allowed || []).join('')),
      identitySentenceEnd: '):',
      unchecked,
      // The floor of the claim, the same shape the bracket panel uses: this is two of
      // the format's rules and never a verdict on the whole list.
      note: 'Only two legality rules can be read off a card list, and those are the two '
        + 'above. Singleton, deck size and everything else are not checked here.',
    };
  }

  const api = {
    pickedSentence,
    unrecognizedNote,
    deckCountsNote,
    legalityProse,
    UNKNOWN_NAMED,
    UNKNOWN_LIMIT,
    sizePills,
    deckCombosNote,
    basketNote,
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
