// Combo-result analysis: turns Commander Spellbook "almost included" variants
// into ranked card suggestions ("add this card, unlock N combos").
// Browser global (window.DeckCombos) + Node module, like parser.js.
(function (global) {
  'use strict';

  // Card-name comparison key: lowercase, front face only (decklists usually
  // write "Valki, God of Lies" while Spellbook uses "Valki, God of Lies // Tibalt...").
  //
  // One slash or two: Spellbook and Scryfall write "//", but Moxfield exports a
  // modal double-faced card as "Sorin of House Markov / Sorin, Ravenous Neonate",
  // and that spelling matched nothing at all. No card name contains a slash, so
  // splitting on a single one is safe.
  //
  // …and an apostrophe is an apostrophe however it was typed. Spellbook and Scryfall
  // spell card names with an ASCII quote — "Ashnod's Altar" — but a curly one arrives
  // constantly: it is what Scryfall's own oracle *text* uses, what a word processor
  // substitutes, and what comes back from copying a decklist out of an article. Keyed
  // literally the two are different cards, so a deck holding Ashnod's Altar found none
  // of its combos and the page called the card unrecognized — visible, and wrong, and
  // silent about the combos it cost. The whole apostrophe family folds to the plain one.
  const APOSTROPHES = /[‘’‚‛ʼ´`]/g;

  function nameKey(name) {
    return String(name || '').split('/')[0].replace(APOSTROPHES, "'").trim().toLowerCase();
  }

  function deckNameSet(entries) {
    const set = new Set();
    for (const e of entries || []) {
      const name = e && (e.card || e.name || e);
      if (typeof name === 'string') set.add(nameKey(name));
    }
    return set;
  }

  // ---- the published payload's string tables --------------------------------
  //
  // combos.json interns the two fields that repeat: card names in `c` and result
  // strings in `p`. There are 103,737 combos and only 7,364 distinct card names
  // and 1,079 distinct results between them — "Infinite ETB" was being written to
  // the file some forty thousand times. Published as indices into two tables at
  // the top of the payload, the file goes from 27.65 MB to 9.37 MB, and 2.30 MB
  // to 1.72 MB on the wire.
  //
  // The bigger win is memory, and it is worth being precise about where it comes
  // from. JSON.parse builds a separate string for every occurrence, so the old
  // payload landed as ~500,000 short strings and 69 MB of heap that the worker
  // then holds for the life of the session. Resolving indices through a table
  // hands back the *same* string object each time, so the arrays hold pointers to
  // 8,443 strings instead: 35 MB, measured, for identical data.
  //
  // Which is why decoding here rather than teaching thirty call sites to read an
  // integer is not a compromise. Measured both ways: keeping the indices and
  // resolving lazily also lands at 35 MB. The saving is in the sharing, not in
  // the integers, so the rest of this file never learns that any of this happened.
  //
  // A third table, `cardIds`, carries one Spellbook card id per distinct card, and
  // most rows arrive with no `id` at all because theirs can be rebuilt from it —
  // see rebuildId() below. That was another 27.5% of the wire.
  //
  // Mutates in place — building a copy would need both shapes in memory at once,
  // which is the one thing this is for. Idempotent: the tables are dropped on the
  // way out, so a second call finds nothing to do. A payload with no tables is
  // returned untouched, which is what makes the test fixtures and any older local
  // combos.json keep working.
  function decode(data) {
    if (!data || !Array.isArray(data.names)) return data;
    const names = data.names;
    const results = Array.isArray(data.results) ? data.results : [];
    const cardIds = Array.isArray(data.cardIds) ? data.cardIds : null;
    for (const combo of data.combos || []) {
      // Before `c` stops being indices. A row without an `id` has one that can be
      // rebuilt; a row with one kept it because it could not be.
      if (cardIds && !combo.id && Array.isArray(combo.c)) combo.id = rebuildId(combo, cardIds);
      if (Array.isArray(combo.c)) combo.c = combo.c.map((i) => names[i]);
      if (Array.isArray(combo.p)) combo.p = combo.p.map((i) => results[i]);
    }
    delete data.names;
    delete data.results;
    delete data.cardIds;
    return data;
  }

  // A Spellbook variant id, rebuilt rather than downloaded: the combo's card ids
  // in ascending order joined with `-`, then each distinct template id, ascending,
  // prefixed with `--`.
  //
  //   1110-4694-7839--112     three cards, one template slot
  //   215-579--85--181        two cards, two template slots
  //
  // It was 27.5% of the payload on the wire, spent on something derivable from one
  // number per distinct card. The fetcher only drops a row's id after rebuilding it
  // and checking it matches, so anything this cannot rebuild still arrives with its
  // own — which is why an unrebuildable row returns null here rather than guessing:
  // it never happens on a payload the fetcher produced, and a wrong permalink is
  // the one outcome worth refusing outright. Callers treat a null id as "no link",
  // the same as a row that never had one.
  function rebuildId(combo, cardIds) {
    const ids = combo.c.map((i) => cardIds[i]);
    if (ids.some((id) => typeof id !== 'number')) return null;
    const templates = (combo.t || []).filter((t) => typeof t === 'number');
    if (templates.length !== (combo.t || []).length) return null;
    const unique = [...new Set(templates)].sort((a, b) => a - b);
    return ids.slice().sort((a, b) => a - b).join('-') + unique.map((t) => '--' + t).join('');
  }

  // The cards a combo names, in whichever of the two shapes it is currently in: a compact
  // row straight from the dataset (`c`, plain strings) or one that has been through
  // expand() (`uses`, objects). The same contract comboSize() carries, and for the same
  // reason — **sorting happens before expansion and rendering after it.**
  //
  // This read `uses` alone, and every caller holding a compact row got an empty list back.
  // Not an error, not a zero: an empty list, which every ordering rule accepts. The
  // unofficial panel shipped that way. matchUnofficial() sorts its rows with byDrawnName()
  // and search.js expands them afterwards, so every row was compared as `''` against `''`,
  // no row had any cards to share with another, and 46 rows came out in the order they
  // happen to sit in unofficial.js — size still separated them, because comboSize() works
  // around this at its own call site, which is exactly why nobody noticed.
  //
  // The workaround is the tell. A function two callers have to know the shape for is a
  // function with the wrong contract, and the third caller will not know.
  function variantCardNames(variant) {
    if (!variant) return [];
    if (variant.uses) {
      return variant.uses.map((u) => (u.card && u.card.name) || u.name).filter(Boolean);
    }
    return (variant.c || []).filter((n) => typeof n === 'string' && n);
  }

  // How much of the world plays a combo. Spellbook publishes it per variant and
  // the fetcher carries it through as `pop`; a variant without one counts as
  // zero rather than as unknown, so ordering never depends on a missing field.
  const popularity = (variant) => Number((variant && variant.pop) || 0);

  // The most-played combo in a set of them. Used to rank a suggestion by the
  // company it keeps: two cards each unlocking three combos are not equally
  // good if one of them unlocks three combos nobody plays.
  const bestPopularity = (variants) => (variants || []).reduce(
    (best, v) => Math.max(best, popularity(v)), 0
  );

  const byPopularity = (a, b) => popularity(b) - popularity(a);

  // variants: Spellbook combo variants the deck is close to (e.g. almostIncluded).
  // deckNames: Set from deckNameSet() of every card already in the deck.
  // Returns [{ card, unlocks: [variant, ...] }], most combos unlocked first and
  // the most-played combos breaking the ties.
  //
  // `unofficial` is the same question asked of the rows in unofficial.js, and the
  // answer is kept in its own list rather than merged into `unlocks`. A card that
  // unlocks nothing published and four of ours still belongs here — Hammerhead
  // unlocks 1,889 combos and was, until this existed, a card the page could not
  // mention — but "+4" and "+4 of our own" are different claims and the row says
  // which. Ranking is by the two together, because impact is impact.
  function computeSuggestions(variants, deckNames, unofficial) {
    const byCard = new Map();
    const at = (name) => {
      const key = nameKey(name);
      let entry = byCard.get(key);
      if (!entry) {
        entry = { card: name.split('//')[0].trim(), unlocks: [], unofficial: [] };
        byCard.set(key, entry);
      }
      return entry;
    };

    for (const variant of variants || []) {
      const missing = variantCardNames(variant).filter((n) => !deckNames.has(nameKey(n)));
      if (missing.length !== 1) continue; // only "one card away" combos count
      at(missing[0]).unlocks.push(variant);
    }
    // These arrive already knowing what they are short of: matchUnofficial worked
    // it out against the same deck, and a row that is short of nothing is a combo
    // the deck has rather than a reason to add anything.
    for (const variant of unofficial || []) {
      const needs = variant.needs || [];
      if (needs.length !== 1) continue;
      at(needs[0]).unofficial.push(variant);
    }
    // Smallest first — the size breakdown printed on the row above says the same,
    // and a 4-card line at the top of that list reads as a recommendation to build
    // the harder combo — then by the names as drawn, so a reader can find a card in
    // the list and the rows of one family sit together. Every row here is short of
    // exactly this entry's card, which is therefore what each of them leads with.
    // Popularity still ranks the suggestions themselves; see byDrawnName.
    for (const entry of byCard.values()) {
      entry.unlocks = byDrawnName(entry.unlocks, entry.card);
      entry.unofficial = byDrawnName(entry.unofficial, entry.card);
    }
    return [...byCard.values()].sort(
      (a, b) => (b.unlocks.length + b.unofficial.length) - (a.unlocks.length + a.unofficial.length)
        // Published unlocks break the tie, so two cards of equal reach are not
        // ordered by how much of that reach is our own claim.
        || b.unlocks.length - a.unlocks.length
        || bestPopularity(b.unlocks) - bestPopularity(a.unlocks)
        || a.card.localeCompare(b.card)
    );
  }

  // ---- how big a combo is ---------------------------------------------------
  //
  // How many cards have to be on the table for a combo to do anything. A
  // two-card combo and a four-card one are different propositions — fewer
  // pieces to find, fewer to keep alive — and a count of combos says nothing
  // about it: "+6 combos" reads the same whether it is six two-carders or five
  // four-carders and a two.
  //
  // A slot counts as a card, because something has to occupy it: a combo of
  // "Rings of Brighthearth + a Persist Creature" needs two cards, one of which
  // your deck happens to supply.
  //
  // Takes either shape: a compact row straight from the dataset (`c`) or one that
  // has been through expand() (`uses`). Sorting happens before expansion and
  // rendering after it, and a function that silently returned 0 for one of them
  // would sort every combo as though it were empty.
  //
  // It used to reach past variantCardNames() to do that — `variant.uses ? … : variant.c`
  // — which made this function correct and left the shape a caller's problem. It was the
  // only caller that knew, and the ordering rules that did not got empty lists and sorted
  // the unofficial panel on nothing. The contract lives in variantCardNames() now, so
  // this can just ask.
  function comboSize(variant) {
    if (!variant) return 0;
    return variantCardNames(variant).length + ((variant && variant.fills || []).length);
  }

  // Smallest first, most played breaking the tie. Two cards on the table is a
  // different proposition from four, so the combos a deck can actually assemble
  // are ordered by how hard they are before how popular they are.
  const bySizeThenPopularity = (a, b) => comboSize(a) - comboSize(b) || popularity(b) - popularity(a);

  // Smallest first, then by the cards themselves. For the lists that sit *under* one
  // card — the combos a suggestion unlocks, the combos one of your cards holds together,
  // the unofficial panel — where the job is finding a particular combo in a list of
  // seventeen rather than being told which to build.
  //
  // Popularity is wrong for those, even though it is right for ranking the cards
  // above them. Ordering eleven rows by play count scatters every repeated partner
  // down the list: Archangel of Thune at 999 plays, then two other combos, then
  // Archangel again at 493, then three more, then Archangel at 186. Nothing about
  // that is out of order and all of it reads as unsorted, because a reader scanning
  // for a card has no idea what the play counts are.
  //
  // **Compared on the names as the row will be drawn**, which is not the same string as
  // the alphabetical one wherever a pin applies — and comparing the alphabetical one is
  // what split a family. Three rows of Carrion Feeder's list are "Carrion Feeder +
  // Kitchen Finks + <the one that changes>", and their alphabetical keys start Archangel
  // / Carrion / Carrion, so they landed at positions 2, 4 and 7 with a Cauldron Familiar
  // row and two Herd Baloth rows between them. Aligning each row inside itself put the
  // difference in one column and then the list moved the rows apart, which gives most of
  // the benefit back. On the drawn name they sort by their shared cards first and by the
  // card that changes only after, so a family lands together and the column reads down.
  //
  // **Biggest block first, and only then alphabetically.** Alphabetical alone keeps a
  // family together but says nothing about which families are worth reading first, so a
  // list opens on whichever block happens to start with an A: Carrion Feeder's opened on
  // a Cauldron Familiar row that is the only one of its kind, above three Kitchen Finks
  // rows that are one decision between three cards. A block of three is three versions of
  // one thing and a single row is one thing, and the reader is choosing between the
  // versions — so the choices come first, largest down to smallest, and the rows that
  // stand alone follow.
  //
  // A row with no family counts as a family of one, because that is what it is: nothing
  // beside it to compare against. So the singletons land after every block, in
  // alphabetical order among themselves.
  //
  // Combo size still outranks both, unchanged. Nothing is lost to it either, because a
  // family's rows are all the same size by construction — they share every card but one —
  // so no block is ever split across the 2-card / 3-card boundary.
  //
  // `leadFor` answers "what does this row lead with" — a card, or a function of the row
  // for the lists whose lead is per row, and null where nothing leads. It has to be the
  // same answer the render side gives, or the list is sorted on strings nobody sees.
  //
  // **This orders rows and never cards.** The drawn name is read, not rewritten: the
  // cards inside a row are placed by orderComboNames() and this only decides which row
  // sits where. test/combos.test.js pins that, by holding every row's drawn card order
  // against the same list sorted differently.
  function byDrawnName(variants, leadFor) {
    const list = (variants || []).slice();
    const trails = interchangeableIn(list);
    const drawn = new Map(list.map((v) => [v, orderComboNames(variantCardNames(v), {
      lead: typeof leadFor === 'function' ? leadFor(v) : leadFor,
      trail: trails.get(v),
    }).join(' + ')]));
    // How many rows this row is one of. `trail` holds one card per row in the block that
    // claimed it, so its length is that block's size.
    const family = (v) => (trails.get(v) || []).length || 1;
    return list.sort((a, b) => comboSize(a) - comboSize(b)
      || family(b) - family(a)
      || drawn.get(a).localeCompare(drawn.get(b)));
  }

  // What a set of combos is made of, smallest first:
  // [{ size, count }] — "one 2-card combo and nine 3-card ones".
  //
  // The counts always sum to the number of combos passed in, which is the whole
  // point: a row can show its own breakdown without inviting the reader to work
  // out which total it is a fraction of.
  function sizeBreakdown(variants) {
    const counts = new Map();
    for (const variant of variants || []) {
      const size = comboSize(variant);
      counts.set(size, (counts.get(size) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([size, count]) => ({ size, count }));
  }

  // ---- interchangeable cards -----------------------------------------------
  //
  // Spellbook stores one variant per concrete card list, so a combo its own site
  // shows as "Spike Feeder + 1 of 8 cards" arrives here as eight rows. Left
  // alone that turns one decision into eight recommendations — and it is why
  // four different cards can sit at the top of the list each claiming to unlock
  // seven combos. They are the same seven.
  //
  // Two cards are interchangeable *for your deck* when adding either completes
  // exactly the same combos. That is a fact about the data: no wording is read
  // and nothing is inferred from card names.

  const sortedKeys = (names) => (names || []).map(nameKey).sort().join('~');

  const producedNames = (variant) => ((variant && variant.produces) || [])
    .map((p) => (p.feature && p.feature.name) || p.name)
    .filter(Boolean);

  // What a variant looks like to a deck already holding part of it: the cards
  // you have, and what the whole thing makes. Same signature = the same combo
  // with one slot filled differently.
  function variantSignature(variant, deckNames) {
    const held = variantCardNames(variant).filter((n) => deckNames.has(nameKey(n)));
    return sortedKeys(held) + '||' + sortedKeys(producedNames(variant));
  }

  // suggestions: the output of computeSuggestions().
  // Returns [{ cards: [name, ...], unlocks: [variant, ...] }] in the same order
  // — most combos first — with perfect substitutes collapsed into one entry.
  // `cards` always holds at least one name; the first is the representative.
  function groupSuggestions(suggestions, deckNames) {
    const groups = new Map();
    for (const suggestion of suggestions || []) {
      // The unofficial unlocks are part of the signature, not an afterthought:
      // two cards opening the same published combos but different rows of ours
      // are not the same suggestion, and merging them would print one card's
      // count against the other's list.
      const signature = suggestion.unlocks.concat(suggestion.unofficial || [])
        .map((v) => variantSignature(v, deckNames))
        .sort()
        .join('#');
      let group = groups.get(signature);
      if (!group) {
        group = { cards: [], unlocks: suggestion.unlocks, unofficial: suggestion.unofficial || [] };
        groups.set(signature, group);
      }
      group.cards.push(suggestion.card);
    }

    // The card this row would have you add, per variant rather than per group: the group's
    // cards are interchangeable, so which of them a given combo is short of differs from
    // row to row, and taking the representative would put the wrong card first on most of
    // them. The render side reads it the same way, which it has to — an ordering compared
    // on a lead the page does not draw is compared on a string nobody sees.
    const shortOf = (v) => variantCardNames(v)
      .find((n) => !deckNames || !deckNames.has(nameKey(n)));

    for (const group of groups.values()) {
      group.cards.sort((a, b) => a.localeCompare(b));
      // **One list, ours and Spellbook's together**, the way "Combos in your deck"
      // has always drawn them. They used to be two, with ours under a heading of their
      // own below the published ones, on the argument that whether somebody published a
      // combo is not a property of a row. It is still not — but splitting the list made
      // it the property that decides where a row *sits*, which put a row of ours below
      // the fold and away from the family it belongs to, and asked a reader comparing
      // eight near-identical lines to compare them across a heading. The row says whose
      // it is; see the unofficial badge in render-combos.js. The order does not have to.
      //
      // The counts stay apart. `unlocks` and `unofficial` keep their own lengths for the
      // gutter and the split, because "+4" and "+4 of our own" are different claims —
      // that part was never about ordering.
      group.combos = byDrawnName(group.unlocks.concat(group.unofficial), shortOf);
    }
    return [...groups.values()].sort(
      (a, b) => (b.unlocks.length + b.unofficial.length) - (a.unlocks.length + a.unofficial.length)
        || b.unlocks.length - a.unlocks.length
        || bestPopularity(b.unlocks) - bestPopularity(a.unlocks)
        || a.cards[0].localeCompare(b.cards[0])
    );
  }

  // How many versions it takes before folding them into one row is worth doing.
  //
  // **Four.** Two and three are written out; four and up fold.
  //
  // The height argument alone would say three. A collapsed row spends five blocks — the
  // heading, the line listing the choices, the link line, the result chips, and the
  // "All N versions" summary — against three per written-out row, so a pair costs six and
  // a triple nine. On that reading three already pays.
  //
  // Height is not the whole of it, and a triple on the real page is what settled it:
  //
  //     Basking Broodscale + Heroic Feast + any of 3
  //     Aunt May · Essence Warden · Prosperous Innkeeper
  //
  // Every card is already on screen. The fold has not hidden anything — it has asked the
  // reader to assemble three combos in their head out of a heading and a list, and put
  // each one's Spellbook link and "How it works" behind a disclosure to be opened. Three
  // rows that each say what they are cost four more blocks and ask nothing.
  //
  // The number where that reverses is where the fold stops being an indirection and
  // starts being a summary — where a reader would not want the versions written out even
  // if they were free, because the versions have *identical results* by construction (that
  // is what merging requires) and eight of them are eight copies of the same block of
  // chips. Four is the judgement, and it is a judgement rather than a measurement.
  //
  // What it costs, measured, so the dial can be moved on evidence. The standing Chatterfang
  // deck holds 32 pairs, 2 triples and 21 larger groups:
  //
  //     fold from     2      3      4      5    never
  //     rows         84    116    120    126      233
  //
  // A presentation judgement living in combos.js rather than in the render layer, for the
  // reason orderComboNames() is here too: this is where it can be tested without a
  // browser. The render side cannot hold it anyway — one group has to become two rows,
  // and a function returning one element cannot do that.
  //
  // Exported, and the tests are written against it rather than against the literal, so
  // moving it is one character plus a fixture. One test pins the number itself — a suite
  // that only ever asks "one below folds, one at it does not" would follow the constant
  // anywhere, including somewhere nobody chose.
  const COLLAPSE_FROM = 4;

  // The same idea for combos you can already assemble: variants differing in
  // exactly one card, producing the same results, are one combo with a choice of
  // part — from COLLAPSE_FROM versions up. Returns
  // [{ shared: [name], choices: [name], variants: [variant] }], and every variant lands
  // in exactly one group so nothing is lost: a pair that does not meet the threshold
  // comes back as two groups of one, which is what a written-out row is.
  function groupVariants(variants) {
    const list = variants || [];
    const keyOf = (variant, omit) => sortedKeys(
      variantCardNames(variant).filter((_, i) => i !== omit)
    ) + '||' + sortedKeys(producedNames(variant));

    // Every way each variant could be "all of these cards, but one".
    const buckets = new Map();
    list.forEach((variant, index) => {
      variantCardNames(variant).forEach((_, omit) => {
        const k = keyOf(variant, omit);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push({ index, omit });
      });
    });

    // Biggest groups claim their members first, so a variant that could join two
    // families joins the more useful one. Ties break on the key, so the result
    // never depends on iteration order.
    const order = [...buckets.entries()].sort(
      (a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1)
    );

    const taken = new Array(list.length).fill(false);
    const groups = [];
    for (const [, members] of order) {
      const free = members.filter((m) => !taken[m.index]);
      // Counted on the members still free, not on the bucket: a family whose rows have
      // mostly been claimed elsewhere is not a family of that size any more, and folding
      // its two survivors would be the pair this threshold exists to leave alone.
      if (free.length < COLLAPSE_FROM) continue;
      free.forEach((m) => { taken[m.index] = true; });
      const first = list[free[0].index];
      groups.push({
        at: Math.min(...free.map((m) => m.index)),
        shared: variantCardNames(first).filter((_, i) => i !== free[0].omit),
        choices: free.map((m) => variantCardNames(list[m.index])[m.omit]),
        variants: free.map((m) => list[m.index]),
      });
    }
    list.forEach((variant, index) => {
      if (taken[index]) return;
      groups.push({ at: index, shared: variantCardNames(variant), choices: [], variants: [variant] });
    });

    // Hand them back in the order they arrived. Grouping is not a place to make an
    // ordering decision — a function that both merges rows and moves them can only be
    // reasoned about as a whole — so the caller's order survives it and the caller
    // decides what the order should be. The map is the caller now: see ComboGraph, which
    // wants the families and does its own arithmetic on them.
    groups.sort((a, b) => a.at - b.at);
    return groups.map(({ at, ...group }) => group);
  }

  // The card that changes, for every variant in a list, as a lookup the render side
  // can ask one row at a time: variant -> the cards that vary across its siblings,
  // ready to hand to orderComboNames() as its `trail`.
  //
  // "The card that changes" is a fact about a *set* of rows and never about one on its
  // own, so this takes the list exactly as it will be drawn. The lists that needed it
  // are the ones that never collapse — a suggestion's combos, a piece's combos and the
  // unofficial panel are one row per variant, so nothing was asking and every row fell
  // back to alphabetical.
  //
  // **Cards only, deliberately unlike groupVariants().** That function also requires
  // the same results, and it must: merging two combos that do different things would
  // tell the reader one thing when the data says two. This decides where a name sits
  // on a line, which merges nothing and hides nothing, and the reader comparing eight
  // rows under Chatterfang does not care that one of them also drains — they care that
  // the piece that differs is in the same place on all eight. Held to the stricter bar
  // it aligned five of those eight, which reads as a rule that half works.
  //
  // Keyed by the variant object, because the caller is the loop that draws those very
  // objects. A copy would miss the lookup and the row would read alphabetically —
  // no worse than before this existed, rather than wrong.
  function interchangeableIn(variants) {
    const list = variants || [];

    // Every way each row could be "all of these cards, but one" — the same first step
    // groupVariants() takes, without the results in the key.
    const buckets = new Map();
    list.forEach((variant, index) => {
      const names = variantCardNames(variant);
      names.forEach((name, omit) => {
        const k = sortedKeys(names.filter((_, i) => i !== omit));
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push({ index, name });
      });
    });

    // Biggest family first, and a family **claims** the rows it orders, so each row is
    // ordered against one set of siblings and every member of that set agrees which card
    // is the one that changes. Ties break on the key, so the answer never depends on
    // iteration order.
    //
    // Claiming is the part that matters, and the case that needs it is a row sitting in
    // two families at once — "the lead + one of these + one of those". Carrion Feeder's
    // list holds a 2×2 of them: {Herd Baloth, Scurry Oak} against {Necrosynthesis,
    // Sadistic Glee}, four rows, each of which could be read as either dimension varying.
    // Choosing per row without claiming let two of the four pick the *other* axis — the
    // Scurry Oak rows sent Scurry Oak last while the Herd Baloth rows sent it middle — so
    // the block came apart into two rows here and two rows four places down.
    //
    // Claiming picks one axis for the whole block: the first family takes its rows, and
    // the families that cross it are then left with one unclaimed row each, which is not
    // a family any more and is skipped. The rows that remain are claimed by the next
    // family along the same axis, so all four read "lead + shared + the one that changes"
    // and sort into one block of two pairs.
    const trails = new Map();
    const taken = new Set();
    const order = [...buckets.entries()].sort(
      (a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1)
    );
    for (const [, members] of order) {
      const free = members.filter((m) => !taken.has(m.index));
      // One row is not a family: there is nothing left beside it to line up against, so
      // it stays alphabetical rather than trailing a card against rows drawn elsewhere.
      if (free.length < 2) continue;
      // The cards that vary among the rows this family will actually show together —
      // not among the members it lost, whose card is being sent last somewhere else.
      const choices = free.map((m) => m.name);
      for (const m of free) {
        taken.add(m.index);
        trails.set(list[m.index], choices);
      }
    }
    return trails;
  }

  // ---- the order a row of combos reads in -------------------------------------
  //
  // There were two functions here, comboRowNames() and byDrawnRow(), and both belonged to
  // the panel that listed every combo the deck could assemble as its own row: one decided
  // what a collapsed row's heading drew, the other put those rows in reading order. That
  // panel is gone. "Combos in your deck" is one row per card now, ranked by how many
  // combos the card carries, and the combos under it are ordered by byDrawnName() like
  // every other nested list on the page.
  //
  // The rule they implemented is not lost with them — size first, then the biggest block
  // of versions, then what the row draws — it is byDrawnName()'s, and the nested lists
  // still read that way. What went is the transposition of it onto rows that were groups,
  // which had no reader left.

  // ---- matching against the bundled combo dataset -------------------------
  // The page can't call Commander Spellbook's API (their CORS allowlist covers
  // only their own site and localhost), so a GitHub Action publishes the whole
  // database and we do the matching here. This mirrors what their
  // find-my-combos endpoint does server-side.

  // name -> colour-identity string, keyed the way decklists spell cards.
  //
  // A colourless entry must never displace a coloured one. Scryfall's bulk file
  // carries tokens named "Pippin, Warden of Isengard // Pippin, Warden of
  // Isengard" with no colour identity, and reducing that to a front face lands
  // it on the real card's key — which zeroed the identity of 1,901 real cards,
  // Sam, Loyal Attendant among them. The fetcher drops tokens now, but this also
  // repairs data published before it did.
  // Kept per dataset, because building it is a walk over every card Spellbook
  // knows — 34,715 of them — and the callers ask for it once per *row* rather
  // than once per search. That was affordable while there were seven unofficial
  // rows and stopped being affordable at fifty-eight: the rebuild was costing
  // about 20 ms a row, or two and a half seconds a search, all of it spent
  // computing the same index over and over. The dataset is parsed once per worker
  // and never mutated, so a WeakMap on it is a safe place to keep the answer, and
  // a second dataset (the tests use several) gets its own.
  const identityIndexes = new WeakMap();

  function identityIndex(cardIdentity) {
    if (!cardIdentity) return Object.create(null);
    const held = identityIndexes.get(cardIdentity);
    if (held) return held;

    const byKey = Object.create(null);
    for (const name of Object.keys(cardIdentity)) {
      const key = nameKey(name);
      if (byKey[key] && !cardIdentity[name]) continue;
      byKey[key] = cardIdentity[name];
    }
    identityIndexes.set(cardIdentity, byKey);
    return byKey;
  }

  // The deck's colours, read off the deck.
  //
  // This used to come from the commander, falling back to the cards — and when
  // no commander was given it tried to work one out, which meant guessing, which
  // put a shortlist of maybes on screen for any list with a few legendary
  // creatures in it. The cards answer the question directly and cannot be wrong
  // about it: every card in the list is a card the deck plays.
  //
  // One consequence, accepted: a deck whose commander permits a colour it plays
  // none of — a Mardu commander over a list with no red card in it — reads as
  // the colours actually present, so suggestions in that unplayed colour land
  // under "other colours" instead of "in your colours". That is a fair
  // description of the list as pasted, and it hides nothing: the split is
  // between two visible tabs, not between shown and dropped.
  function deckIdentity(cardIdentity, deckNames) {
    if (!cardIdentity) return null;
    const byKey = identityIndex(cardIdentity);

    let known = false;
    const colours = new Set();
    for (const key of deckNames || []) {
      const identity = byKey[key];
      if (identity === undefined) continue;
      known = true;
      for (const c of String(identity)) if (c !== 'C') colours.add(c);
    }
    return known ? colours : null;
  }

  // The cards the identity map has never heard of — the same lookup deckIdentity()
  // does, keeping the misses instead of skipping them.
  //
  // `cardIdentity` is keyed by every card in Scryfall's oracle-cards bulk file and
  // not only the ones that appear in combos, so a name missing from it is a name
  // Scryfall does not publish under that spelling: a typo, an old or alternate
  // wording, a card printed after the snapshot, or a token line out of a deck site's
  // export. `1 Sol Rimg` is a perfectly good card line by every rule in parser.js,
  // so it reaches the search, matches nothing, and without this is never mentioned
  // again.
  //
  // Facts only — how many were looked at, how big the map was, and which names
  // missed. Whether any of that is worth saying to a reader is DeckView's decision,
  // because a thin map makes *everything* a miss and a wall of names would be worse
  // than silence. Deduplicated by comparison key: a card in the deck and in the
  // command zone is one card, and one mention.
  function unrecognizedCards(cardIdentity, deckEntries) {
    const byKey = identityIndex(cardIdentity);
    const names = [];
    const seen = new Set();
    let checked = 0;
    for (const entry of deckEntries || []) {
      const name = (entry && entry.card) || '';
      const key = nameKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      checked += 1;
      if (byKey[key] === undefined) names.push(name);
    }
    return { names, checked, mapped: Object.keys(byKey).length };
  }

  // ---- how many cards, and how many of them are lands ------------------------
  //
  // The strip above the results: "98 cards · 62 spells · 36 lands". Worked out here
  // rather than in the page for the same reason the bracket and the legality line
  // are — the lists it reads are part of the dataset and the dataset stays in the
  // worker.
  //
  // Facts only. Whether any of this is worth saying is DeckView's decision, and it
  // has to be a decision: an empty `lands` list would otherwise make every card in
  // the deck a spell, which is the shape a broken publish takes and reads as an
  // ordinary landless deck.
  //
  // Kept on the array in a WeakMap exactly as identityIndex() is, and for the same
  // reason: the dataset is parsed once per worker and never mutated, so the keys are
  // the same on every search.
  const landIndexes = new WeakMap();

  function landIndex(lands) {
    if (!Array.isArray(lands)) return null;
    const held = landIndexes.get(lands);
    if (held) return held;
    const set = new Set();
    for (const name of lands) {
      const key = nameKey(name);
      if (key) set.add(key);
    }
    landIndexes.set(lands, set);
    return set;
  }

  // Counted by *quantity*, never by line. The tuning deck is 85 lines and 98 cards
  // because sixteen of its lands arrive as "10 Forest", and the number a reader is
  // checking against their deck site is 98. tools/try-deck.js prints the other one.
  //
  // A card the identity map has never heard of is neither land nor spell — it has no
  // type line to read — so it is counted apart rather than folded into either half.
  // Lands + spells + unread is the card count, and the strip shows enough of that
  // sum for a reader to check it.
  function deckCounts(dataset, deckEntries) {
    const byKey = identityIndex(dataset && dataset.cardIdentity);
    const landKeys = landIndex(dataset && dataset.lands);
    const basicKeys = landIndex(dataset && dataset.basicLands);
    const mdfcKeys = landIndex(dataset && dataset.mdfc);

    let cards = 0;
    let lands = 0;
    let basic = 0;
    let spells = 0;
    let mdfc = 0;
    let unread = 0;

    for (const entry of deckEntries || []) {
      const quantity = Math.max(0, Number(entry && entry.quantity) || 0);
      if (!quantity) continue;
      cards += quantity;
      const key = nameKey((entry && entry.card) || '');
      // The identity map decides whether the card is *known at all*, because the land
      // list only holds lands: "absent from the lands" and "absent from the data" are
      // the same absence there, and reading it as the first would call a misspelling a
      // spell.
      if (!key || byKey[key] === undefined) { unread += quantity; continue; }
      if (landKeys && landKeys.has(key)) {
        lands += quantity;
        if (basicKeys && basicKeys.has(key)) basic += quantity;
      } else {
        spells += quantity;
        // A modal double-faced card — a land on the back — counted inside the spells
        // rather than beside them: the front face is what you cast, and a deck runs these
        // partly as lands. Kept as its own number so the strip can say why its land count
        // is lower than the one the reader's deck site shows.
        if (mdfcKeys && mdfcKeys.has(key)) mdfc += quantity;
      }
    }

    return {
      cards,
      lands,
      spells,
      basic,
      nonbasic: lands - basic,
      mdfc,
      unread,
      // How big the two lists were, so the page can tell "no lands in this deck"
      // from "no land list in this payload". `basicsKnown` is separate because a
      // deck with no basics in it and a payload with no basic list both come out as
      // basic: 0, and only one of them is a number worth printing.
      mapped: landKeys ? landKeys.size : 0,
      basicsKnown: !!(basicKeys && basicKeys.size),
      // Separate from the count for the same reason `basicsKnown` is: a deck with no
      // double-faced lands and a payload with no list of them both come out as 0.
      mdfcKnown: !!(mdfcKeys && mdfcKeys.size),
    };
  }

  function withinIdentity(combo, identity) {
    if (!identity) return true; // no colour data -> don't split by colour
    for (const c of String(combo.i || '')) {
      if (c !== 'C' && !identity.has(c)) return false;
    }
    return true;
  }

  // ---- which combos are worth looking at at all ------------------------------
  //
  // Both walks of the database — matchDeck() and standInRows() — used to visit all
  // 103,891 combos and call nameKey() on every card as they went: about 343,000
  // `trim().toLowerCase()` allocations per search, over a dataset that is parsed
  // once per worker and never mutated afterwards. The keys are the same every time.
  //
  // So they are computed once, into card key -> the positions of the combos naming
  // it. Kept on the combos array in a WeakMap, exactly as identityIndex() is kept on
  // cardIdentity and for the same reason: the tests use several datasets and each
  // gets its own, and a dataset that goes away takes its index with it.
  //
  // **The candidate set is not small, and a design that assumes it is, is designed
  // against the wrong number.** 27,039 of 103,891 combos name at least one card of
  // the standing deck — 26%, not a few thousand. What makes this worth doing is that
  // a posting is an integer with nameKey() already applied, not that there is little
  // to walk: matchDeck measured 71.1ms -> 5.4ms on the standing deck and 63.7ms ->
  // 1.3ms on the tuning one, and 1.5x even on a deck holding every card in the
  // database, where nothing is filtered out at all and the only saving left is the
  // lowercasing. Issue #181 has the rest.
  //
  // **Held as one flat array with offsets, not 7,370 little ones.** The obvious
  // shape — a Map of card key to an array of positions — measured **+6.3 MB of
  // worker heap on a 35.3 MB payload**, which is a fifth of the string interning
  // that took the payload from 69 MB to 35 MB in the first place, handed back for a
  // lookup table. Every posting is a small integer, so they all live in one
  // Int32Array, `starts` says where each card's run begins, and the Map holds a slot
  // number rather than an array: **2.0 MB for the same answers.** The cost is that
  // the build reads the database twice — once to count, once to place — which is
  // ~70ms more, once per dataset, against a parse that already takes 678ms.
  const comboIndexes = new WeakMap();

  function comboIndex(combos) {
    const held = comboIndexes.get(combos);
    if (held) return held;

    // `for…of` and a counter rather than forEach or an index, so each pass works on
    // anything iterable and test/unofficial.test.js can hand this a list that counts
    // its own passes. "The database is walked once per dataset" is the property this
    // whole index exists to provide and it is not observable from the results.
    const slot = new Map();
    const counts = [];
    // A combo naming one card, or none, can be one card short while naming nothing
    // the deck holds — so no deck card can ever lead the index to it, and it has to
    // be carried separately. There are 7 in the published database.
    const loose = [];
    let at = -1;
    let postings = 0;
    for (const combo of combos) {
      at += 1;
      const cards = combo.c || [];
      if (cards.length <= 1) loose.push(at);
      for (const name of cards) {
        const key = nameKey(name);
        let s = slot.get(key);
        if (s === undefined) { s = counts.length; slot.set(key, s); counts.push(0); }
        // **One posting per occurrence, not per distinct card**, and the difference
        // is the whole correctness argument. The walk this replaced counted a *name*
        // it could not find, so a combo naming the same card twice and scored once
        // would come back one short where the old code called it complete. Counting
        // every occurrence makes `cards.length - held` exactly the number that loop
        // produced, for any data — including data no published combo has ever
        // contained. A guard against the duplicate looked cheaper and was a silent
        // behaviour change.
        counts[s] += 1;
        postings += 1;
      }
    }

    // Prefix sums, so every card's run of positions has its place before anything is
    // written into it. `cursor` walks each run as the second pass fills it and ends
    // up equal to the next run's start, which is what makes this a placement rather
    // than an append.
    const starts = new Int32Array(counts.length + 1);
    for (let i = 0; i < counts.length; i += 1) starts[i + 1] = starts[i] + counts[i];
    const cursor = starts.slice(0, counts.length);
    const list = new Int32Array(postings);
    at = -1;
    for (const combo of combos) {
      at += 1;
      for (const name of combo.c || []) {
        const s = slot.get(nameKey(name));
        list[cursor[s]] = at;
        cursor[s] += 1;
      }
    }

    const index = { slot, starts, list, loose };
    comboIndexes.set(combos, index);
    return index;
  }

  // The combos naming at least one of `keys`, as positions **in database order**,
  // with how many of `keys` each of them names.
  //
  // The sort is not an aesthetic choice and costs about half the time this saves.
  // Candidates come out of the index grouped by the card that found them, and both
  // callers hand their results to a stable sort — bySizeThenPopularity, byPopularity,
  // and standInRows' first-one-wins on `best`. 42% of published combos carry no
  // `pop` at all, so ties are the common case rather than the edge one, and an
  // unsorted walk reorders the page while returning exactly the same combos.
  function candidateCombos(combos, keys, includeLoose) {
    const index = comboIndex(combos);
    // One byte per combo, thrown away at the end of the walk: ~100 KB, against a Map
    // that would allocate an entry per candidate. Every combo names at most 10 cards,
    // so nothing here can reach 255.
    const held = new Uint8Array(combos.length);
    // Typed too, and sized for the worst case rather than grown: a deck holding every
    // card in the database makes every combo a candidate. `sort()` on an Int32Array
    // is numeric with no comparator to call, which is most of why the sort is
    // affordable at all — an Array with `(a, b) => a - b` calls into JS per comparison.
    const found = new Int32Array(combos.length);
    let n = 0;
    for (const key of keys) {
      const s = index.slot.get(key);
      if (s === undefined) continue;
      const end = index.starts[s + 1];
      for (let i = index.starts[s]; i < end; i += 1) {
        const at = index.list[i];
        if (held[at] === 0) { found[n] = at; n += 1; }
        held[at] += 1;
      }
    }
    if (includeLoose) {
      for (const at of index.loose) if (held[at] === 0) { found[n] = at; n += 1; }
    }
    const order = found.subarray(0, n);
    order.sort();
    return { order, held };
  }

  // How much of the last matchDeck() the index saved, for the test that would
  // otherwise have nothing to fail on: a walk that quietly went back to visiting
  // every combo returns the same answers, just slower, and no assertion about
  // *results* can tell the difference. A duration assertion would be a flake on CI,
  // so the property pinned is the count. → test/scan-index.test.js.
  let scan = { examined: 0, total: 0 };

  // ---- template slots -------------------------------------------------------
  //
  // Some combos have a slot naming a property instead of a card — "a Persist
  // Creature". tools/templates.js resolves each into Spellbook's own list of the
  // cards that fill it, published as card -> template ids, so the only question
  // here is whether the deck holds one of them. Nothing is read from wording and
  // nothing is inferred: a slot is filled or it is not.

  // Which of the deck's cards can fill which template. Built once per search,
  // not once per combo — the deck is a hundred cards and the database is a
  // hundred thousand combos.
  function deckTemplateIndex(dataset, deckNames, deckEntries) {
    const lookup = (dataset && dataset.templateCards) || {};

    // Deck names arrive as comparison keys, which are lowercased. Keep the
    // spelling the user typed so the page can name the card it credited.
    const spelling = new Map();
    for (const entry of deckEntries || []) {
      const name = entry && (entry.card || entry.name || entry);
      if (typeof name !== 'string') continue;
      const key = nameKey(name);
      if (!spelling.has(key)) spelling.set(key, name.split('//')[0].trim());
    }

    const byTemplate = new Map();
    for (const key of deckNames || []) {
      for (const id of lookup[key] || []) {
        if (!byTemplate.has(id)) byTemplate.set(id, []);
        byTemplate.get(id).push({ key, name: spelling.get(key) || key });
      }
    }
    return byTemplate;
  }

  // Give every slot its own card. Taking the first candidate for each slot in
  // turn can strand a later slot whose only option is already spoken for, so
  // this is a real matching (Kuhn's algorithm) rather than a greedy pass. Slots
  // are few and candidates never leave the deck, so it costs nothing.
  //
  // Returns { filled, unfilled }: the card assigned to each slot, and the
  // indexes of the slots nothing was left for. It does not stop at the first
  // failure, because "which slot are you short of" is the useful answer — a
  // combo whose every named card you own and whose one slot you cannot fill is
  // a combo worth telling someone about. A failed augmenting path mutates
  // nothing, so the slots that did match are still a real assignment.
  function assignSlots(slots) {
    const takenBy = new Map(); // card key -> index of the slot holding it
    const filled = new Array(slots.length).fill(null);

    function assign(slot, tried) {
      for (const candidate of slots[slot]) {
        if (tried.has(candidate.key)) continue;
        tried.add(candidate.key);
        const holder = takenBy.get(candidate.key);
        if (holder === undefined || assign(holder, tried)) {
          takenBy.set(candidate.key, slot);
          filled[slot] = candidate;
          return true;
        }
      }
      return false;
    }

    const unfilled = [];
    for (let i = 0; i < slots.length; i += 1) {
      if (!assign(i, new Set())) unfilled.push(i);
    }
    return { filled, unfilled };
  }

  // How the deck stands against a combo's template slots: which the deck fills,
  // and which it is short of. Null means the question cannot be asked at all.
  //
  // Cards the combo already names are not eligible: a slot is an extra card the
  // combo needs, not a second job for one that is already in it. Where that is
  // stricter than Spellbook intends we lose a combo rather than claim one that
  // does not work, which is the error worth making.
  function resolveSlots(combo, byTemplate, templateNames) {
    const ids = combo.t;
    if (!ids) return { fills: [], gaps: [] };
    // Data published before templates were resolved records only how many slots
    // a combo has, not which. There is nothing to check against, so those stay
    // excluded exactly as they were — the page and the data branch update
    // independently, and a stale combos.json must not start claiming combos.
    if (!Array.isArray(ids)) return null;
    if (!ids.length) return { fills: [], gaps: [] };

    const nameOf = (id) => (templateNames && templateNames[id]) || null;
    const named = new Set((combo.c || []).map(nameKey));
    const slots = ids.map((id) => (byTemplate.get(id) || []).filter((c) => !named.has(c.key)));

    const { filled, unfilled } = assignSlots(slots);
    const short = new Set(unfilled);
    const fills = [];
    const gaps = [];
    ids.forEach((id, i) => {
      if (short.has(i)) gaps.push({ id: id === undefined ? null : id, slot: nameOf(id) || 'an unnamed slot' });
      else fills.push({ id, slot: nameOf(id) || 'a card', card: filled[i].name });
    });
    return { fills, gaps };
  }

  // How the deck fills a combo's template slots, or null when it cannot fill
  // them all. A combo is claimed only when every slot has its own card.
  function fillTemplates(combo, byTemplate, templateNames) {
    const slots = resolveSlots(combo, byTemplate, templateNames);
    if (!slots || slots.gaps.length) return null;
    return slots.fills;
  }

  // Splits the dataset against a deck the same way find-my-combos does:
  // complete combos, those one card short, and those one card short but
  // outside the deck's colours.
  //
  // deckEntries is optional and only supplies the original spelling of the
  // cards credited with filling a template slot.
  function matchDeck(dataset, deckNames, deckEntries) {
    const combos = (dataset && dataset.combos) || [];
    const identity = deckIdentity(dataset && dataset.cardIdentity, deckNames);
    const templateNames = Object.assign(
      {},
      (dataset && dataset.unresolvable) || {}, // named, but no card list to match against
      (dataset && dataset.templates) || {}
    );
    const byTemplate = deckTemplateIndex(dataset, deckNames, deckEntries);
    const included = [];
    const almost = [];
    const almostByAddingColors = [];

    // Only the combos naming a card this deck holds, plus the handful that name at
    // most one card at all. A combo missing two or more of its cards cannot become
    // anything this function returns, and one missing at most one names at least
    // n-1 of the deck's cards — so for everything above a single card, "names
    // nothing you play" and "is at least two cards away" are the same statement.
    const { order, held } = candidateCombos(combos, deckNames, true);
    scan = { examined: order.length, total: combos.length };

    for (const at of order) {
      const combo = combos[at];
      const cards = combo.c || [];
      // Exact rather than capped at 2, because the index counted it: `held` is how
      // many of this combo's cards the deck has, and they are distinct by
      // construction — see the adjacency guard in comboIndex().
      const missing = cards.length - held[at];
      if (missing > 1) continue;

      // A template slot has no one card to suggest — thousands of cards fill
      // "a Creature with Haste" — so a combo counts only once the deck already
      // fills every slot it has. Unresolvable templates have no card list at
      // all, which lands here as "cannot fill" and keeps them excluded.
      const slots = combo.t ? resolveSlots(combo, byTemplate, templateNames) : { fills: [], gaps: [] };
      if (!slots) continue;

      // A gap is a slot nothing in the deck fills, so the combo is not claimable
      // and drops out here. It used to be kept when it was the *only* thing
      // missing, and reported in a panel of its own; that panel is gone — see the
      // README's "The panel that could not answer its own question".
      if (slots.gaps.length) continue;

      const row = slots.fills.length ? Object.assign({}, combo, { fills: slots.fills }) : combo;

      if (missing === 0) {
        included.push(row);
      } else {
        (withinIdentity(combo, identity) ? almost : almostByAddingColors).push(row);
      }
    }

    // The combos the deck can assemble lead with the easiest: every 2-card combo,
    // then every 3-card one, and so on. The rest stay ordered by popularity alone —
    // a suggestion is a card to add rather than a line to look for, and its own
    // sizes are shown on its row.
    //
    // Play count breaks the tie here and no longer decides anything a reader sees:
    // "Combos in your deck" ranks its rows by how many combos each card carries, the
    // lists inside them are ordered by byDrawnName(), and the map does its own
    // arithmetic on what it is handed. It stays because a
    // stable, explicable base order is worth more than an arbitrary one — and
    // because tools/try-deck.js prints this list rather than the panel.
    included.sort(bySizeThenPopularity);
    almost.sort(byPopularity);
    almostByAddingColors.sort(byPopularity);
    return {
      identity,
      included,
      almostIncluded: almost,
      almostIncludedByAddingColors: almostByAddingColors,
    };
  }

  // The combos in unofficial.js that this deck can assemble, in the same shape
  // matchDeck() returns so the renderer needs no second code path.
  //
  // `included` is passed in and checked against, not for speed but for correctness:
  // these rows exist because Spellbook has not published them, and Spellbook is
  // refreshed nightly. The day a row is published it arrives in `included` on its
  // own authority, and showing our copy beside it would be the same combo listed
  // twice — one of them stale. So a row that has been published drops out here and
  // the entry graduates to the official list without anyone editing this file.
  //
  // `allowMissing` is 0 for the panel and 1 for the suggestions: a row the deck is
  // one card short of is not a combo it has, it is a reason to add that card, and
  // the card it is short of comes back on the row as `needs`. When it is 1 the
  // caller has to widen `included` to match — a published combo one card away sits
  // in `almostIncluded`, not in `included`, and a row checked against the wrong
  // set would print our copy of something Spellbook already suggests.
  function matchUnofficial(dataset, rows, deckNames, included, allowMissing) {
    if (!Array.isArray(rows) || !deckNames) return [];
    const short = Math.max(0, Number(allowMissing) || 0);
    const published = new Set(
      (included || []).map((c) => (c.c || []).map(nameKey).sort().join('|'))
    );
    // Two rows can arrive naming the same cards: a hand-written one and the same
    // set generated by a stand-in rule. Both are right, and printing both would
    // be the combo twice. First one wins, which is why search.js puts the
    // hand-written rows first — a row somebody reasoned about by name beats the
    // same row produced by a rule.
    const seen = new Set();
    const out = [];

    for (const row of rows) {
      const cards = (row && row.cards) || [];
      if (!cards.length) continue;
      const needs = cards.filter((name) => !deckNames.has(nameKey(name)));
      if (needs.length > short) continue;

      const key = cards.map(nameKey).sort().join('|');
      if (published.has(key) || seen.has(key)) continue;
      seen.add(key);

      out.push({
        // Which cards the deck does not have. Empty for a combo it can assemble,
        // and that is the difference between the two panels this feeds.
        needs: needs.length ? needs.slice() : undefined,
        id: 'unofficial:' + key,
        c: cards.slice(),
        p: (row.produces || []).slice(),
        // Worked out from the cards rather than stored, so it cannot drift from the
        // identity data the rest of the page filters by.
        i: identityString(deckIdentity(dataset && dataset.cardIdentity, new Set(cards.map(nameKey)))),
        // Present only on a row generated from a combo with a template slot: which
        // of the deck's cards filled it. Carried through for the same reason the
        // published rows carry it — the page names the card it credited.
        fills: (row.fills && row.fills.length) ? row.fills : undefined,
        unofficial: row,
      });
    }

    // No lead: these are top-level rows in a panel of their own, so only the card that
    // changes is pinned — and the list is ordered by that same drawn name, since the
    // panel is several of the same swap over a different gainer and those belong together.
    return byDrawnName(out, null);
  }

  // Unofficial rows worked out from a stand-in rule rather than written by hand.
  //
  // Some cards are not merely similar, they are the same card with a different
  // name — Hammerhead, Maggia Boss and Bartolomé del Presidio have one ability
  // each and it is the same sentence. When Spellbook has published a thousand
  // combos naming one of them and none naming the other, writing out the
  // difference by hand is not work anybody finishes: the file would need 1,730
  // entries for a single card, each one a copy of a published combo with a word
  // changed. So the rule is declared once in unofficial.js and the rows are
  // worked out here, against the same data the rest of the page is matched to.
  //
  // Everything a hand-written row carries, a generated row carries too: the
  // published combo it came from, by id, which card was swapped for which, and
  // why the swap holds. The difference is that the evidence is looked up rather
  // than typed, so it cannot cite a combo that has been retired — if the source
  // leaves the data, the row it produced leaves with it.
  //
  // Rows are built for what this deck can reach, and no further: a combo it can
  // assemble outright, or — when `allowMissing` is 1 — one it is a single card
  // short of, which is a reason to add that card rather than a combo it has. That
  // bound is not an optimisation, it is the reason this is affordable at all.
  //
  // A combo with a template slot — "any Persist Creature" — is included the same
  // way matchDeck() includes one: the deck has to fill every slot, and the row
  // says which of your cards was credited with each. The slot is resolved against
  // the deck *minus the stand-in*, because a card cannot both be the swap and fill
  // a slot beside itself.
  //
  // **The combo list is walked exactly once, whatever the rules cost.** Every
  // rule's source cards go into one index first, so a second or a twentieth rule
  // adds work proportional to what it *matches* rather than another pass over
  // 100,000 combos. Written that way on purpose: the rules are a list somebody
  // will add to, and a per-rule scan would make each addition cost another sweep
  // of the database on every search anybody runs. test/unofficial.test.js counts
  // the passes and holds them at one.
  //
  // One thing is deliberately left out, and visibly rather than silently — see
  // tools/verify-unofficial.js: a rule reads published combos only. Generating
  // from an unofficial row would put a swap on top of a swap, and all but three
  // rows on this page are one step from something Spellbook published. Those
  // three are written out by hand, with both steps named.
  function standInRows(dataset, standIns, deckNames, deckEntries, allowMissing) {
    const combos = (dataset && dataset.combos) || [];
    if (!Array.isArray(standIns) || !deckNames || !combos.length) return [];
    const short = Math.max(0, Number(allowMissing) || 0);
    const templateNames = Object.assign(
      {},
      (dataset && dataset.unresolvable) || {},
      (dataset && dataset.templates) || {}
    );

    // Every rule, indexed by the cards it stands in for, so one walk of the combo
    // list serves all of them. `rank` is position in the rule's own `for` list:
    // the first source named is the one whose text matches most closely, and a
    // row cites the best source available to it.
    const bySource = new Map();
    const rules = [];
    for (const rule of standIns) {
      const inKey = nameKey(rule && rule.card);
      if (!inKey || !(rule.for || []).length) continue;
      // A deck without the stand-in can still be told to add it — that is the
      // whole of Hammerhead's case — so this is a rule that needs one more card
      // rather than a rule to skip, and only when the caller allows one.
      const held = deckNames.has(inKey);
      if (!held && !short) continue;

      // The stand-in goes into the combo by name, so it is not also available to
      // fill one of that combo's slots: that would be the same card twice.
      const others = new Set(deckNames);
      others.delete(inKey);
      const entry = {
        rule,
        inKey,
        held,
        byTemplate: deckTemplateIndex(dataset, others, deckEntries),
        sources: new Map(),
      };
      (rule.for || []).forEach((src, rank) => {
        const key = nameKey(src && src.card);
        if (!key) return;
        entry.sources.set(key, { rank, src });
        if (!bySource.has(key)) bySource.set(key, []);
        bySource.get(key).push(entry);
      });
      if (entry.sources.size) rules.push(entry);
    }
    if (!rules.length) return [];

    const best = new Map();
    // The one pass, and now only over the combos that name one of the cards being
    // swapped out. That is exactly the set the old walk kept: a combo naming no
    // source card leaves `candidates` null below and is skipped, so restricting the
    // walk to the index's answer drops nothing — it just stops asking 100,000
    // combos a question three rules already know the answer to. No `loose` here:
    // a rule with no source card in a combo has nothing to stand in for.
    //
    // Written as a loop that gives up on the first disqualifying card rather than
    // as map/filter/every: almost every combo fails on its first or second name,
    // and the arrays those would allocate are the whole cost.
    const { order } = candidateCombos(combos, bySource.keys(), false);
    for (const at of order) {
      const combo = combos[at];
      const names = combo.c || [];
      let candidates = null; // rules this combo could serve, found on the way past
      let missing = null;    // cards the deck does not have, source cards aside
      let overrun = false;

      for (let i = 0; i < names.length; i++) {
        const key = nameKey(names[i]);
        const here = bySource.get(key);
        if (here) {
          if (!candidates) candidates = new Map();
          for (const entry of here) candidates.set(entry, key);
        }
        if (deckNames.has(key)) continue;
        if (here) continue; // a source card is the one being swapped out
        (missing || (missing = [])).push(names[i]);
        // Nothing can come back from two cards short even before the stand-in.
        if (missing.length > short) { overrun = true; break; }
      }
      if (overrun || !candidates) continue;

      for (const [entry, sourceKey] of candidates) {
        // Exactly one of a rule's sources may appear: a combo naming two of them
        // is not one swap, and the row would have to say which.
        let hits = 0;
        let named = false;
        for (let i = 0; i < names.length; i++) {
          const key = nameKey(names[i]);
          if (key === entry.inKey) { named = true; break; }
          if (entry.sources.has(key)) hits += 1;
        }
        if (named || hits !== 1) continue;

        const needs = entry.held ? (missing || []) : (missing || []).concat(entry.rule.card);
        if (needs.length > short) continue;

        // Left until last: the cheap name checks throw out all but a handful of
        // combos, and this is the only part that allocates.
        const fills = combo.t ? fillTemplates(combo, entry.byTemplate, templateNames) : [];
        if (!fills) continue;

        const cards = names.filter((name) => nameKey(name) !== sourceKey).concat(entry.rule.card);
        const key = cards.map(nameKey).sort().join('|');
        const { rank, src } = entry.sources.get(sourceKey);
        const held = best.get(key);
        // A row the deck can assemble beats the same row it is a card short of,
        // whichever rule or source produced them.
        if (held && (held.needs <= needs.length && held.rank <= rank)) continue;

        best.set(key, {
          rank,
          needs: needs.length,
          row: {
            cards,
            confidence: entry.rule.confidence,
            from: { id: combo.id, cards: names.slice() },
            swap: { out: names.find((name) => nameKey(name) === sourceKey), in: entry.rule.card },
            why: src.why,
            // Carried across untouched. A loop that was infinite with one of two
            // cards that share an ability is infinite with the other; inventing
            // an extra line here would be a claim the source combo never made.
            produces: (combo.p || []).slice(),
            // Which of your cards was credited with each of the source combo's
            // slots, so the page can show it rather than asking for trust.
            fills: fills.length ? fills : undefined,
            // So the page, the tests and the audit can all tell a row that was
            // reasoned about from a row that was worked out.
            standIn: true,
          },
        });
      }
    }

    return [...best.values()].map((held) => held.row);
  }

  // A colour set back into the WUBRG string the combo rows carry.
  function identityString(colours) {
    if (!colours || !colours.size) return 'C';
    return 'WUBRG'.split('').filter((c) => colours.has(c)).join('');
  }

  // Normalizes a dataset combo into the shape the renderer expects, so the
  // rendering code doesn't need to know about the compact field names.
  function expand(combo) {
    return {
      id: combo.id,
      uses: (combo.c || []).map((name) => ({ card: { name } })),
      produces: (combo.p || []).map((name) => ({ feature: { name } })),
      identity: combo.i,
      // Carried through so ranking survives expansion: the renderer sorts and
      // groups these, and a dropped field would silently mean "unplayed".
      pop: combo.pop,
      // Which of the deck's cards was credited with each template slot, so the
      // page can show it rather than asking anyone to take the match on trust.
      fills: combo.fills || undefined,
      // Present only on rows from unofficial.js: which published combo this was
      // derived from, and how far the checking went. The renderer keys the whole
      // "unofficial" treatment off this field being there.
      unofficial: combo.unofficial || undefined,
      // Which card an unofficial row is short of, for the suggestion built out of
      // it. Distinct from `gaps`, which is a template slot rather than a card.
      needs: combo.needs || undefined,
      // And which slot it is short of, for the combos it cannot assemble.
      gaps: combo.gaps || undefined,
    };
  }

  // Every card one combo is actually held up by, as key -> the spelling to
  // print: the cards it names, plus whichever of your cards filled each of its
  // template slots. A card filling a slot holds the combo up just as much as one
  // the combo names, and cutting it costs the combo all the same. A card listed
  // twice in one combo appears once, because it is still one card.
  function comboCardIndex(variant) {
    const unique = new Map();
    for (const name of variantCardNames(variant)) {
      unique.set(nameKey(name), name.split('//')[0].trim());
    }
    for (const fill of (variant && variant.fills) || []) {
      if (fill && fill.card) unique.set(nameKey(fill.card), fill.card.split('//')[0].trim());
    }
    return unique;
  }

  // Which of your cards are load-bearing: how many of the combos you can
  // already assemble each one takes part in. A list of combos doesn't make this
  // obvious — cutting a card that turns up in four of them costs four combos,
  // and that is exactly the thing you want to know before trimming a deck.
  //
  // `unofficial` is counted beside the published combos rather than into them.
  // The panel's question is what cutting a card costs, and a card holding up two
  // published combos and four of ours costs six — so the ranking is by the total,
  // while the two numbers stay apart on the row. Leaving ours out entirely was
  // the older behaviour and it answered the question wrong: a card that carries
  // nothing but unofficial combos was absent from the panel altogether.
  function comboPieces(variants, unofficial) {
    const byCard = new Map();
    const add = (list, field) => {
      for (const variant of list || []) {
        for (const [key, name] of comboCardIndex(variant)) {
          let entry = byCard.get(key);
          if (!entry) {
            entry = { card: name, combos: [], unofficial: [] };
            byCard.set(key, entry);
          }
          entry[field].push(variant);
        }
      }
    };
    add(variants, 'combos');
    add(unofficial, 'unofficial');
    // The cards stay ranked by how many combos each holds up — that is this panel's
    // whole question, since cutting a card that appears in four costs four. The
    // combos *under* each card are re-sorted rather than left in the order they
    // arrived: they inherited the deck list's ranking, which is by play count, and
    // eleven rows ordered by play count read as unsorted to anyone scanning them for
    // a card name.
    return [...byCard.values()]
      .map((e) => ({
        card: e.card,
        count: e.combos.length,
        unofficial: e.unofficial.length,
        // One list, ours and Spellbook's together, ordered by what it draws: this card
        // leads every row, so the rows sort on what they share with each other.
        combos: byDrawnName(e.combos.concat(e.unofficial), e.card),
      }))
      .sort((a, b) => (b.count + b.unofficial) - (a.count + a.unofficial)
        || b.count - a.count
        || a.card.localeCompare(b.card));
  }

  // ---- what a combo actually gives you ------------------------------------
  //
  // Three tiers, shown as three colours. Which outcome sits in which tier is not
  // worked out from its wording — it is written down, by name, in
  // result-tiers.js. See that file for the reasoning and for how to move one.
  //
  //   win      (green)  — this ends the game.
  //   decisive (yellow) — real value that something else still has to convert.
  //   other    (grey)   — the plumbing a loop runs on.
  //
  // Resolved once here so the browser and Node reach the same list: the page
  // loads result-tiers.js before this file, Node requires it.
  const TIERS = (typeof module !== 'undefined' && module.exports)
    ? require('./result-tiers.js')
    : global.ResultTiers;

  function classify(name) {
    return TIERS.tierOf(name);
  }

  const TIER_RANK = { win: 0, decisive: 1, other: 2 };

  // Splits results into what to show and what to fold away.
  //
  // **Grey folds.** It is the plumbing a loop runs on — infinite ETB, infinite death
  // triggers, infinite LTB — and it is the same handful of entries under combo after
  // combo, four and five deep on rows whose actual payoff is one green chip. On a phone
  // that is most of the row's height spent on the least of what it says.
  //
  // This reverses the earlier rule, which kept one of every present tier on screen so
  // that "grey is quieter, not hidden". The reasoning was sound and the measurement is
  // what changed it: quieter cost four lines a row, and the fold is one press away with
  // the count on it, so nothing is hidden in the sense that mattered — a reader who wants
  // the plumbing is told it is there and how much of it.
  //
  // The limit still applies to what is left, because a combo with nine decisive results
  // is a wall of yellow whatever the tiers say.
  //
  // A combo whose results are *all* grey is the case worth being careful about: folding
  // them by that rule would leave a row saying nothing at all about what it does, which
  // is worse than a tall row. So the fold is only ever applied to grey that sits under
  // something louder — with nothing louder, grey is what the combo does and it is shown.
  function splitResults(results, limit) {
    if (!Array.isArray(results)) return { shown: [], hidden: [] };

    const byTier = (a, b) => (TIER_RANK[a.tier] - TIER_RANK[b.tier]) || a.name.localeCompare(b.name);
    const ranked = results.slice().sort(byTier);
    const louder = ranked.filter((r) => r.tier !== 'other');
    const grey = ranked.filter((r) => r.tier === 'other');

    // What the row is really about: the louder tiers, or grey itself when that is all
    // this combo produces.
    const speaks = louder.length ? louder : grey;
    const folds = louder.length ? grey : [];

    return {
      shown: speaks.slice(0, limit),
      hidden: speaks.slice(limit).concat(folds).sort(byTier),
    };
  }

  // Commander Spellbook lists results as feature names. They arrive unordered,
  // sometimes repeated with different casing, and a long combo can produce a
  // dozen — so dedupe and rank rather than printing the raw list. Their wording
  // is left alone: rewriting "Infinite ETB triggers" into something snappier
  // risks saying something the combo does not actually do.
  function summarizeResults(names) {
    const seen = new Set();
    const out = [];
    for (const raw of names || []) {
      const name = String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const { tier, why } = classify(name);
      out.push({ name, tier, why, win: tier === 'win' });
    }
    out.sort((a, b) => (TIER_RANK[a.tier] - TIER_RANK[b.tier]) || a.name.localeCompare(b.name));
    return out;
  }

  // ---- which bracket the decklist sits in ----------------------------------
  //
  // Wizards' bracket system rates a Commander deck 1–5. Two of its criteria are
  // properties of a card list and can be read straight off one; the rest are
  // judgement calls about how a deck plays. This checks the two, and the page
  // names the ones it did not check rather than implying they passed.
  //
  //   1 Exhibition / 2 Core   no Game Changers, no two-card infinite combos
  //   3 Upgraded              up to three Game Changers, no early two-card combo
  //   4 Optimized             no limit on either
  //   5 cEDH                  a choice about how you play, not a fact about the list
  //
  // So the answer is a *floor* — the lowest bracket the list is still eligible
  // for — and never a verdict. A deck with no Game Changers and no two-card win
  // could be bracket 2; whether it really is depends on mass land denial, chained
  // extra turns, how many tutors counts as "a few", and how early a combo lands.
  // None of those is a card name, so none of them is guessed at here.
  const GAME_CHANGER_ALLOWANCE = 3; // what bracket 3 permits

  // The results of a variant as plain names, whichever shape it is in: compact
  // from the dataset (`p`) or expanded for rendering (`produces`). Same reason
  // comboSize() takes both — this is called on either side of expand().
  function resultNames(variant) {
    if (!variant) return [];
    return variant.produces ? producedNames(variant) : (variant.p || []);
  }

  // Whether the combo itself claims to end the game — the green tier, by the same
  // written-down inventory the chips use. "Two-card infinite combo" in Wizards'
  // wording is a two-card line that wins, not any two cards that loop.
  function endsTheGame(variant) {
    return resultNames(variant).some((name) => classify(name).tier === 'win');
  }

  // dataset: the published data, for its Game Changer list.
  // included: the combos the deck can already assemble (either shape).
  // Returns { gameChangers, twoCardWins, floor }, or null when the data carries
  // no list at all — half a bracket check is worse than none, because a deck full
  // of Game Changers would read as bracket 3 on the strength of its combos alone.
  function bracketCheck(dataset, deckNames, included) {
    const published = (dataset && dataset.gameChangers) || null;
    if (!Array.isArray(published) || !published.length) return null;

    const gameChangers = published
      .filter((name) => deckNames && deckNames.has(nameKey(name)))
      .map((name) => name.split('//')[0].trim())
      .sort((a, b) => a.localeCompare(b));

    // A slot counts as a card here for the same reason it does in comboSize():
    // something has to occupy it, and the deck is what occupies it.
    const twoCardWins = (included || []).filter((v) => comboSize(v) <= 2 && endsTheGame(v));

    let floor = 2;
    if (gameChangers.length > GAME_CHANGER_ALLOWANCE) floor = 4;
    else if (gameChangers.length || twoCardWins.length) floor = 3;

    return { gameChangers, twoCardWins, floor };
  }

  // ---- whether the decklist is allowed ---------------------------------------
  //
  // The bracket says what power level a list sits at and never says whether it is
  // *legal*. Two neighbouring questions, answered from data that is already here:
  //
  //   - cards outside the commander's colour identity, which is a decklist mistake
  //   - cards banned in Commander, which is a format rule
  //
  // Kept apart all the way through, because they are different accusations and a
  // panel that ran them together would be alarming where it should be useful.
  //
  // Facts only, like everything else this file returns: which cards, and what could
  // not be checked. Whether any of it is worth saying, and how, is DeckView's — see
  // legalityProse() there, and the thin-map rule it shares with unrecognizedNote().
  //
  // deckEntries carries `commander: true` on the cards the parser found in the
  // command zone, from either the marker or the commander box. The identity claim
  // rests on those and not on the deck's own colours: a Commander deck's identity is
  // its commanders', which is the whole point of the rule — reading it off every card
  // would make every deck legal by construction.
  function legalityCheck(dataset, deckEntries) {
    const cardIdentity = (dataset && dataset.cardIdentity) || null;
    const byKey = identityIndex(cardIdentity);
    const mapped = Object.keys(byKey).length;
    const entries = (deckEntries || []).filter((e) => e && e.card);
    const commanders = entries.filter((e) => e.commander);

    // The commanders' own identity, as a set of colours. Read through the same
    // index every other colour question here uses.
    const allowed = new Set();
    let commandersKnown = 0;
    for (const entry of commanders) {
      const identity = byKey[nameKey(entry.card)];
      if (identity === undefined) continue;
      commandersKnown += 1;
      for (const c of String(identity)) if (c !== 'C') allowed.add(c);
    }

    // Off-identity is only answerable when a commander was named *and* the map knows
    // it. A commander it cannot look up would produce an empty identity, against
    // which every coloured card in the deck reads as illegal.
    const canCheckIdentity = commanders.length > 0 && commandersKnown === commanders.length;
    const offIdentity = [];
    let checked = 0;
    if (canCheckIdentity) {
      const seen = new Set();
      for (const entry of entries) {
        if (entry.commander) continue;
        const key = nameKey(entry.card);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const identity = byKey[key];
        // A card the map has never heard of is #116's business, not this one: it is
        // an unknown name rather than an illegal card, and saying both about the same
        // card twice would be two accusations for one typo.
        if (identity === undefined) continue;
        checked += 1;
        const outside = [...String(identity)].filter((c) => c !== 'C' && !allowed.has(c));
        if (outside.length) offIdentity.push({ card: entry.card, colours: outside.join('') });
      }
    }

    // The ban list is its own published field, and a missing one means "cannot say"
    // rather than "nothing is banned" — the same rule bracketCheck() uses for the
    // Game Changers, and for the same reason.
    const published = (dataset && dataset.banned) || null;
    const hasBanList = Array.isArray(published) && published.length > 0;
    const deckKeys = new Set(entries.map((e) => nameKey(e.card)));
    const banned = hasBanList
      ? published
        .filter((name) => deckKeys.has(nameKey(name)))
        .map((name) => name.split('//')[0].trim())
        .sort((a, b) => a.localeCompare(b))
      : [];

    return {
      offIdentity,
      banned,
      // What the answer rests on, so the page can say what it did not check rather
      // than implying it passed.
      commanders: commanders.map((e) => e.card),
      allowed: [...allowed].sort(),
      canCheckIdentity,
      hasBanList,
      checked,
      mapped,
    };
  }

  // The order a combo's cards are named in on screen.
  //
  // Alphabetical is the base. Spellbook lists them in the order the combo was
  // authored in, which means two rows sharing the same pieces can name them in
  // different orders — and with no description shown, that order carries nothing.
  // Alphabetical makes a row scannable and two rows comparable.
  //
  // Two things outrank it, both about where the reader's eye has to go, and they
  // apply together rather than one instead of the other:
  //
  // `lead` is the card the reader is already looking at — the card a suggestion is
  // about, or the one whose combos are being listed. A list of combos under "Scurry
  // Oak" that buries Scurry Oak mid-line makes them find it again on every row.
  //
  // `trail` is the same argument from the other end, for rows that differ from the
  // rows beside them by one card. Those rows are identical but for that card, and
  // alphabetical order puts it wherever its name happens to fall:
  //
  //     Chatterfang + Essence Warden + Warren Soultrader
  //     Chatterfang + Soul Warden + Warren Soultrader
  //
  // so the difference moves around and the eye has to hunt for it on each line.
  // Sending the interchangeable cards last gives every row the shape a collapsed
  // group's heading already has — "X + Y + the one that changes" — and the difference
  // lands in the same column every time.
  //
  // A lead used to *replace* a trail rather than sit in front of one, which read as
  // alphabetical everywhere a list was both about a card and made of near-identical
  // rows — which is both nested lists, the two places a reader compares rows most
  // closely. The bands are the fix: what the row is about, what every one of these
  // rows shares, then what makes this row this row.
  //
  // Both are orderings, never filters: every card in the combo is still named.
  function orderComboNames(names, opts) {
    const list = (names || []).filter((n) => typeof n === 'string' && n.trim());
    const sorted = (xs) => xs.slice().sort((a, b) => a.localeCompare(b));
    const o = opts || {};

    // A lead or a trail naming nothing in this combo simply does not match, and the
    // row keeps whatever order the rest of the rule gives it rather than losing a
    // card or gaining one.
    const leadKey = o.lead ? nameKey(o.lead) : null;
    const trailKeys = new Set((o.trail || []).map((n) => nameKey(n)));
    // The lead is the one card whose place is not up for discussion, so a lead that
    // is *also* interchangeable leads and is not named again at the end. That is the
    // ordinary case in the suggestion panel rather than an edge of it: the card you
    // would be adding is usually the card that varies between its own rows.
    if (leadKey !== null) trailKeys.delete(leadKey);

    const isLead = (n) => leadKey !== null && nameKey(n) === leadKey;
    const isTrail = (n) => trailKeys.has(nameKey(n));

    // Each band sorted within itself, so a row naming two of the interchangeable
    // cards is still ordered rather than left in whatever order the data arrived in.
    return list.filter(isLead)
      .concat(sorted(list.filter((n) => !isLead(n) && !isTrail(n))))
      .concat(sorted(list.filter((n) => !isLead(n) && isTrail(n))));
  }

  // EDHREC card page slug: "Kinnan, Bonder Prodigy" -> "kinnan-bonder-prodigy"
  function edhrecSlug(name) {
    return nameKey(name)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // A Scryfall query matching a whole set of cards at once: `!"A" or !"B"`. Its
  // point is comparison — sixteen interchangeable cards are one decision, and
  // making it means looking at sixteen cards, which is one page on Scryfall and
  // sixteen middle-clicks without this.
  //
  // `!"..."` is Scryfall's exact-name form, so a card is never confused for
  // another that merely contains its name (there is a real "Blood Artist" and a
  // real "Blood Artist Avatar" problem here). A repeated name is dropped, because
  // it costs ~25 characters of a URL already carrying sixteen and Scryfall shows
  // the card once either way.
  //
  // Runs of whitespace are collapsed rather than passed through, which is where
  // this parts company with nameKey(): that trims and lowercases but leaves inner
  // spacing alone, and it is right to, since it decides whether a deck holds a
  // card. Here the string goes into a search — `!"Blood   Artist"` matches nothing
  // at all — so the spacing has to be fixed rather than preserved, and fixing it
  // is also what makes the two spellings dedupe to one term.
  //
  // Returns the query, not the URL: the caller already builds
  // `scryfall.com/search?q=` for single cards and there is no reason for a second
  // place that knows the host.
  function scryfallSetQuery(names) {
    const seen = new Set();
    const exact = [];
    (names || []).forEach((name) => {
      if (typeof name !== 'string' || !name.trim()) return;
      // No Magic card name contains a double quote, and one arriving here would
      // end the quoted term early and change what the query matches.
      const tidy = name.trim().replace(/\s+/g, ' ').replace(/"/g, '');
      if (!tidy) return;
      const key = nameKey(tidy);
      if (seen.has(key)) return;
      seen.add(key);
      exact.push('!"' + tidy + '"');
    });
    return exact.join(' or ');
  }

  const api = {
    computeSuggestions, deckNameSet, nameKey, edhrecSlug, scryfallSetQuery, variantCardNames,
    orderComboNames,
    matchDeck, matchUnofficial, standInRows, identityString,
    deckIdentity, withinIdentity, unrecognizedCards, deckCounts,
    expand, summarizeResults, comboPieces, comboCardIndex,
    splitResults,
    groupSuggestions, groupVariants, COLLAPSE_FROM, interchangeableIn,
    variantSignature,
    deckTemplateIndex, fillTemplates, resolveSlots,
    candidateCombos, lastScan: () => scan,
    comboSize, sizeBreakdown, bracketCheck, legalityCheck,
    decode, rebuildId,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.DeckCombos = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
