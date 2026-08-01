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
  function nameKey(name) {
    return String(name || '').split('/')[0].trim().toLowerCase();
  }

  function deckNameSet(entries) {
    const set = new Set();
    for (const e of entries || []) {
      const name = e && (e.card || e.name || e);
      if (typeof name === 'string') set.add(nameKey(name));
    }
    return set;
  }

  function variantCardNames(variant) {
    return ((variant && variant.uses) || [])
      .map((u) => (u.card && u.card.name) || u.name)
      .filter(Boolean);
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
  function computeSuggestions(variants, deckNames) {
    const byCard = new Map();
    for (const variant of variants || []) {
      const missing = variantCardNames(variant).filter((n) => !deckNames.has(nameKey(n)));
      if (missing.length !== 1) continue; // only "one card away" combos count
      const key = nameKey(missing[0]);
      let entry = byCard.get(key);
      if (!entry) {
        entry = { card: missing[0].split('//')[0].trim(), unlocks: [] };
        byCard.set(key, entry);
      }
      entry.unlocks.push(variant);
    }
    // Smallest first — the size breakdown printed on the row above says the same,
    // and a 4-card line at the top of that list reads as a recommendation to build
    // the harder combo — then alphabetically, so a reader can find a card in the
    // list. Popularity still ranks the suggestions themselves; see bySizeThenName.
    for (const entry of byCard.values()) entry.unlocks.sort(bySizeThenName);
    return [...byCard.values()].sort(
      (a, b) => b.unlocks.length - a.unlocks.length
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
  function comboSize(variant) {
    if (!variant) return 0;
    const named = variant.uses ? variantCardNames(variant) : (variant.c || []);
    return named.length + ((variant.fills || []).length);
  }

  // Smallest first, most played breaking the tie. Two cards on the table is a
  // different proposition from four, so the combos a deck can actually assemble
  // are ordered by how hard they are before how popular they are.
  const bySizeThenPopularity = (a, b) => comboSize(a) - comboSize(b) || popularity(b) - popularity(a);

  // Smallest first, then alphabetically by the cards themselves. For the lists that
  // sit *under* one card — the combos a suggestion unlocks, the combos one of your
  // cards holds together — where the job is finding a particular combo in a list of
  // seventeen rather than being told which to build.
  //
  // Popularity is wrong for those, even though it is right for ranking the cards
  // above them. Ordering eleven rows by play count scatters every repeated partner
  // down the list: Archangel of Thune at 999 plays, then two other combos, then
  // Archangel again at 493, then three more, then Archangel at 186. Nothing about
  // that is out of order and all of it reads as unsorted, because a reader scanning
  // for a card has no idea what the play counts are.
  //
  // Compared on the names as drawn, so the order on screen is the order the
  // comparator produced and there is no second arrangement to reconcile.
  const nameSignature = (variant) => orderComboNames(
    variant && variant.uses ? variantCardNames(variant) : ((variant && variant.c) || [])
  ).join(' + ');
  const bySizeThenName = (a, b) => comboSize(a) - comboSize(b)
    || nameSignature(a).localeCompare(nameSignature(b));

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
      const signature = suggestion.unlocks
        .map((v) => variantSignature(v, deckNames))
        .sort()
        .join('#');
      let group = groups.get(signature);
      if (!group) {
        group = { cards: [], unlocks: suggestion.unlocks };
        groups.set(signature, group);
      }
      group.cards.push(suggestion.card);
    }
    for (const group of groups.values()) group.cards.sort((a, b) => a.localeCompare(b));
    return [...groups.values()].sort(
      (a, b) => b.unlocks.length - a.unlocks.length
        || bestPopularity(b.unlocks) - bestPopularity(a.unlocks)
        || a.cards[0].localeCompare(b.cards[0])
    );
  }

  // The same idea for combos you can already assemble: variants differing in
  // exactly one card, producing the same results, are one combo with a choice of
  // part. Returns [{ shared: [name], choices: [name], variants: [variant] }],
  // and every variant lands in exactly one group so nothing is lost.
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
      if (free.length < 2) continue;
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

    // Hand them back in the order they arrived — the caller sorted by popularity,
    // and grouping must not quietly reshuffle the most-played combo down the page.
    groups.sort((a, b) => a.at - b.at);
    return groups.map(({ at, ...group }) => group);
  }

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
  function identityIndex(cardIdentity) {
    const byKey = Object.create(null);
    for (const name of Object.keys(cardIdentity || {})) {
      const key = nameKey(name);
      if (byKey[key] && !cardIdentity[name]) continue;
      byKey[key] = cardIdentity[name];
    }
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

  function withinIdentity(combo, identity) {
    if (!identity) return true; // no colour data -> don't split by colour
    for (const c of String(combo.i || '')) {
      if (c !== 'C' && !identity.has(c)) return false;
    }
    return true;
  }

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

  // ---- the cards that would fill a slot you are short of ---------------------
  //
  // A slot has no single card to suggest — 394 cards are a "Noncreature Artifact
  // with MV<=1" — so this does not pretend to make a recommendation. It reports
  // how many cards fill the slot, and names a few, ranked by how many of *your*
  // blocked combos each one would complete. That ranking is read off your own
  // list rather than from anything about the card.

  // key -> the spelling Scryfall uses, front face only. The published template
  // lists are keyed by comparison key, so without this a candidate could only be
  // shown lowercased.
  function spellingIndex(cardIdentity) {
    const byKey = Object.create(null);
    for (const name of Object.keys(cardIdentity || {})) {
      const key = nameKey(name);
      if (byKey[key]) continue;
      byKey[key] = name.split('//')[0].trim();
    }
    return byKey;
  }

  // rows: the one-slot-away combos, each carrying its `gaps`.
  // Returns { [templateId]: { total, inColour, names } } — `total` counts every
  // card Spellbook's query matched, `names` only the ones your deck could play.
  function slotCandidates(dataset, rows, deckNames, identity, limit) {
    const wanted = new Map(); // template id (as string) -> combos waiting on it
    for (const row of rows || []) {
      for (const gap of (row && row.gaps) || []) {
        if (gap.id === null || gap.id === undefined) continue;
        const id = String(gap.id);
        wanted.set(id, (wanted.get(id) || 0) + 1);
      }
    }
    const out = Object.create(null);
    if (!wanted.size) return out;

    const lookup = (dataset && dataset.templateCards) || {};
    const identities = identityIndex(dataset && dataset.cardIdentity);
    const spelling = spellingIndex(dataset && dataset.cardIdentity);
    for (const id of wanted.keys()) out[id] = { total: 0, inColour: 0, names: [] };

    const scored = new Map(); // template id -> [{ name, score }]
    for (const key of Object.keys(lookup)) {
      const ids = (lookup[key] || []).map(String).filter((id) => wanted.has(id));
      if (!ids.length) continue;
      for (const id of ids) out[id].total += 1;
      // A card you already play is not an addition, and a card outside your
      // colours is noise — the same line the suggestion tabs draw.
      if (deckNames && deckNames.has(key)) continue;
      if (!withinIdentity({ i: identities[key] }, identity)) continue;
      // How many of the combos you are short on this one card would complete.
      const score = ids.reduce((sum, id) => sum + wanted.get(id), 0);
      for (const id of ids) {
        out[id].inColour += 1;
        if (!scored.has(id)) scored.set(id, []);
        scored.get(id).push({ name: spelling[key] || key, score });
      }
    }

    const cap = limit || 6;
    for (const [id, cards] of scored) {
      cards.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
      out[id].names = cards.slice(0, cap).map((c) => c.name);
    }
    return out;
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
    const oneSlotAway = [];

    for (const combo of combos) {
      const cards = combo.c || [];
      let missing = 0;
      for (const name of cards) {
        if (!deckNames.has(nameKey(name))) {
          missing += 1;
          if (missing > 1) break;
        }
      }
      if (missing > 1) continue;

      // A template slot has no one card to suggest — thousands of cards fill
      // "a Creature with Haste" — so a combo counts only once the deck already
      // fills every slot it has. Unresolvable templates have no card list at
      // all, which lands here as "cannot fill" and keeps them excluded.
      const slots = combo.t ? resolveSlots(combo, byTemplate, templateNames) : { fills: [], gaps: [] };
      if (!slots) continue;

      if (slots.gaps.length) {
        // Not claimable — but silence is the wrong answer. A deck holding every
        // card a combo names and short of one slot is one card from the combo,
        // and that card is a real deckbuilding decision. Reported apart from the
        // combos the deck can actually assemble, and never counted among them.
        //
        // Only one gap, only when nothing else is missing, and only inside the
        // deck's colours: two gaps is two cards away, and a slot whose id the
        // data could not record has nothing to say about what would fill it.
        if (missing === 0 && slots.gaps.length === 1 && slots.gaps[0].id !== null
          && withinIdentity(combo, identity)) {
          oneSlotAway.push(Object.assign({}, combo, { fills: slots.fills, gaps: slots.gaps }));
        }
        continue;
      }

      const row = slots.fills.length ? Object.assign({}, combo, { fills: slots.fills }) : combo;

      if (missing === 0) {
        included.push(row);
      } else {
        (withinIdentity(combo, identity) ? almost : almostByAddingColors).push(row);
      }
    }

    // The combos the deck can assemble lead with the easiest: every 2-card combo,
    // then every 3-card one, and so on, most played first within each size. The
    // rest stay ordered by popularity alone — a suggestion is a card to add
    // rather than a line to look for, and its own sizes are shown on its row.
    included.sort(bySizeThenPopularity);
    almost.sort(byPopularity);
    almostByAddingColors.sort(byPopularity);
    oneSlotAway.sort(byPopularity);
    return {
      identity,
      included,
      oneSlotAway,
      slotCandidates: slotCandidates(dataset, oneSlotAway, deckNames, identity),
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
  function matchUnofficial(dataset, rows, deckNames, included) {
    if (!Array.isArray(rows) || !deckNames) return [];
    const published = new Set(
      (included || []).map((c) => (c.c || []).map(nameKey).sort().join('|'))
    );
    const out = [];

    for (const row of rows) {
      const cards = (row && row.cards) || [];
      if (!cards.length) continue;
      if (!cards.every((name) => deckNames.has(nameKey(name)))) continue;

      const key = cards.map(nameKey).sort().join('|');
      if (published.has(key)) continue;

      out.push({
        id: 'unofficial:' + key,
        c: cards.slice(),
        p: (row.produces || []).slice(),
        // Worked out from the cards rather than stored, so it cannot drift from the
        // identity data the rest of the page filters by.
        i: identityString(deckIdentity(dataset && dataset.cardIdentity, new Set(cards.map(nameKey)))),
        unofficial: row,
      });
    }

    return out.sort(bySizeThenName);
  }

  // The other half of unofficial.js: not "this combo is missing" but "this card is".
  // A rule says one card stands in for another wherever that other one appears, and
  // this expands it against the dataset the page has already loaded — so the answer
  // stays right as Spellbook grows, which a written-out list of 1,492 rows would not.
  //
  // Three things keep it from inventing combos:
  //
  //   the deck must hold the substitute   — no point walking 100k combos otherwise,
  //                                         and it makes the whole pass free for the
  //                                         decks that do not play the card
  //   `attestedBy`                        — the same combo must also be published
  //                                         with a third card of the same class, which
  //                                         is what proves the loop does not depend on
  //                                         the replaced card's particular rider
  //   no template slots                   — a combo with a slot needs the full
  //                                         resolveSlots() walk to know whether the
  //                                         deck fills it, and a row claiming a combo
  //                                         the deck cannot assemble is the one thing
  //                                         worse than no row
  //
  // The results are taken from the attested twin rather than from the combo being
  // substituted into. That is not a detail: 1,482 of the Zealot's combos list
  // "Infinite surveil", which comes from the Zealot and not from the loop, and
  // printing it next to Hammerhead would be stating something false.
  function matchSubstitutions(dataset, rules, deckNames, included) {
    const combos = (dataset && dataset.combos) || [];
    if (!Array.isArray(rules) || !rules.length || !combos.length || !deckNames) return [];

    // Whether any rule can fire at all is one Set lookup, and it is answered before
    // anything is indexed. Almost no deck plays the substitute, and those decks
    // should not pay for the feature — indexing first cost 300 ms on every search.
    const active = rules.filter((rule) => rule && rule.card && rule.substituteFor
      && deckNames.has(nameKey(rule.card)));
    if (!active.length) return [];

    const setKey = (names) => (names || []).map(nameKey).sort().join('|');
    const published = new Set((included || []).map((c) => setKey(c.c)));
    const out = [];
    const seen = new Set();

    for (const rule of active) {
      const wanted = rule.card;
      const wantedKey = nameKey(wanted);
      const replaced = nameKey(rule.substituteFor);
      const attests = rule.attestedBy ? nameKey(rule.attestedBy) : null;

      // One walk, and only the three small subsets it turns up are keyed. Keying all
      // 103k — a sort and a join each — is what made this slow; the combos naming any
      // one of these three cards number in the low thousands.
      const targets = [];
      const attested = new Map();
      const already = new Set();
      for (const combo of combos) {
        let hasReplaced = false;
        let hasAttest = false;
        let hasWanted = false;
        for (const name of combo.c || []) {
          const key = nameKey(name);
          if (key === replaced) hasReplaced = true;
          else if (key === wantedKey) hasWanted = true;
          else if (attests && key === attests) hasAttest = true;
        }
        if (hasWanted) already.add(setKey(combo.c));
        if (hasAttest) attested.set(setKey(combo.c), combo);
        // A slot needs the full resolveSlots() walk to know whether the deck fills
        // it, so a combo carrying one is never claimed here.
        if (hasReplaced && !combo.t) targets.push(combo);
      }

      for (const combo of targets) {
        const cards = combo.c || [];
        const swapped = cards.map((name) => (nameKey(name) === replaced ? wanted : name));
        // Cheapest discriminator first: nearly every combo fails it.
        if (!swapped.every((name) => deckNames.has(nameKey(name)))) continue;

        // The same combo, published with a different card of the same class — which
        // is what says the loop does not depend on the replaced card's own rider.
        let twin = combo;
        if (attests) {
          twin = attested.get(setKey(cards.map((n) => (nameKey(n) === replaced ? rule.attestedBy : n))));
          if (!twin) continue;
        }

        const key = setKey(swapped);
        if (seen.has(key) || published.has(key) || already.has(key)) continue;
        seen.add(key);

        out.push({
          id: 'unofficial:' + key,
          c: swapped,
          p: (twin.p || []).slice(),
          i: identityString(deckIdentity(dataset.cardIdentity, new Set(swapped.map(nameKey)))),
          unofficial: {
            confidence: rule.confidence || 'derived',
            from: { id: combo.id, cards: cards.slice() },
            swap: { out: rule.substituteFor, in: wanted },
            why: rule.why || '',
          },
        });
      }
    }

    return out.sort(bySizeThenName);
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
      // And which slot it is short of, for the combos it cannot assemble.
      gaps: combo.gaps || undefined,
    };
  }

  // Which of your cards are load-bearing: how many of the combos you can
  // already assemble each one takes part in. A list of combos doesn't make this
  // obvious — cutting a card that turns up in four of them costs four combos,
  // and that is exactly the thing you want to know before trimming a deck.
  function comboPieces(variants) {
    const byCard = new Map();
    for (const variant of variants || []) {
      // A card listed twice in one combo is still one combo for that card.
      const unique = new Map();
      for (const name of variantCardNames(variant)) unique.set(nameKey(name), name);
      // A card filling a template slot holds the combo up just as much as one
      // the combo names, and cutting it costs the combo all the same.
      for (const fill of variant.fills || []) {
        if (fill && fill.card) unique.set(nameKey(fill.card), fill.card);
      }
      for (const [key, name] of unique) {
        let entry = byCard.get(key);
        if (!entry) {
          entry = { card: name.split('//')[0].trim(), combos: [] };
          byCard.set(key, entry);
        }
        entry.combos.push(variant);
      }
    }
    // The cards stay ranked by how many combos each holds up — that is this panel's
    // whole question, since cutting a card that appears in four costs four. The
    // combos *under* each card are re-sorted rather than left in the order they
    // arrived: they inherited the deck list's ranking, which is by play count, and
    // eleven rows ordered by play count read as unsorted to anyone scanning them for
    // a card name.
    return [...byCard.values()]
      .map((e) => ({ card: e.card, count: e.combos.length, combos: e.combos.slice().sort(bySizeThenName) }))
      .sort((a, b) => b.count - a.count || a.card.localeCompare(b.card));
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

  // Splits results into what to show and what to fold away. Grey is quieter
  // than the rest, not hidden — so a tier that is present never disappears
  // entirely behind "+N more", even when a combo produces a dozen results.
  function splitResults(results, limit) {
    if (!Array.isArray(results)) return { shown: [], hidden: [] };
    if (results.length <= limit) return { shown: results.slice(), hidden: [] };

    const shown = results.slice(0, limit);
    const hidden = results.slice(limit);

    for (const tier of ['win', 'decisive', 'other']) {
      const swapIn = hidden.findIndex((r) => r.tier === tier);
      if (swapIn === -1 || shown.some((r) => r.tier === tier)) continue;

      // Give up a slot from whichever tier is already best represented.
      const counts = shown.reduce((acc, r) => Object.assign(acc, { [r.tier]: (acc[r.tier] || 0) + 1 }), {});
      const fullest = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      const dropAt = shown.map((r) => r.tier).lastIndexOf(fullest);
      if (dropAt === -1) continue;

      hidden.push(shown[dropAt]);
      shown.splice(dropAt, 1);
      shown.push(hidden.splice(swapIn, 1)[0]);
    }

    const byTier = (a, b) => (TIER_RANK[a.tier] - TIER_RANK[b.tier]) || a.name.localeCompare(b.name);
    return { shown: shown.sort(byTier), hidden: hidden.sort(byTier) };
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

  // The order a combo's cards are named in on screen.
  //
  // Alphabetical is the base. Spellbook lists them in the order the combo was
  // authored in, which means two rows sharing the same pieces can name them in
  // different orders — and with no description shown, that order carries nothing.
  // Alphabetical makes a row scannable and two rows comparable.
  //
  // Two things outrank it, both about where the reader's eye has to go:
  //
  // `lead` is the card the reader is already looking at — the card a suggestion is
  // about, or the one whose combos are being listed. A list of combos under "Scurry
  // Oak" that buries Scurry Oak mid-line makes them find it again on every row.
  //
  // `trail` is the same argument from the other end, for the versions of a collapsed
  // group. Those rows are identical but for one card, and alphabetical order puts
  // that card wherever its name happens to fall:
  //
  //     Chatterfang + Essence Warden + Warren Soultrader
  //     Chatterfang + Soul Warden + Warren Soultrader
  //
  // so the difference moves around and the eye has to hunt for it on each line.
  // Sending the interchangeable cards last gives every version the shape its own
  // heading already has — "X + Y + the one that changes" — and the difference lands
  // in the same column every time.
  //
  // Both are orderings, never filters: every card in the combo is still named.
  function orderComboNames(names, opts) {
    const list = (names || []).filter((n) => typeof n === 'string' && n.trim());
    const sorted = (xs) => xs.slice().sort((a, b) => a.localeCompare(b));
    const o = opts || {};

    if (o.lead) {
      const key = nameKey(o.lead);
      // A lead not in this combo simply does not match, and the row stays
      // alphabetical rather than losing a card or gaining one.
      const first = list.filter((n) => nameKey(n) === key);
      return first.concat(sorted(list.filter((n) => nameKey(n) !== key)));
    }

    if (o.trail && o.trail.length) {
      const keys = new Set(o.trail.map((n) => nameKey(n)));
      // Each side sorted, so a version naming two of the interchangeable cards is
      // still ordered rather than left in whatever order the data arrived in.
      return sorted(list.filter((n) => !keys.has(nameKey(n))))
        .concat(sorted(list.filter((n) => keys.has(nameKey(n)))));
    }

    return sorted(list);
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
    matchDeck, matchUnofficial, matchSubstitutions, identityString,
    deckIdentity, withinIdentity, expand, summarizeResults, comboPieces, splitResults,
    groupSuggestions, groupVariants, variantSignature,
    deckTemplateIndex, fillTemplates, resolveSlots, slotCandidates,
    comboSize, sizeBreakdown, bracketCheck,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.DeckCombos = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
