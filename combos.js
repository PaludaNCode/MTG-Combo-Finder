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

  // variants: Spellbook combo variants the deck is close to (e.g. almostIncluded).
  // deckNames: Set from deckNameSet() of every card already in the deck.
  // Returns [{ card, unlocks: [variant, ...] }] sorted by combos unlocked desc.
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
    return [...byCard.values()].sort(
      (a, b) => b.unlocks.length - a.unlocks.length || a.card.localeCompare(b.card)
    );
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
      (a, b) => b.unlocks.length - a.unlocks.length || a.cards[0].localeCompare(b.cards[0])
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

  // What the deck supports colour-wise.
  //
  // The commander decides it when there is one — that is the Commander rule,
  // and a Golgari commander does not let you cast the white half of a card.
  // Without a commander (a 60-card list, or the box left empty) fall back to
  // the colours the deck itself actually plays, so filtering still happens.
  // Only if neither is recognizable does this return null, meaning "no idea,
  // don't filter".
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

  function deckIdentity(commanders, cardIdentity, deckNames) {
    if (!cardIdentity) return null;
    const byKey = identityIndex(cardIdentity);

    const collect = (keys) => {
      let known = false;
      const colors = new Set();
      for (const key of keys) {
        const identity = byKey[key];
        if (identity === undefined) continue;
        known = true;
        for (const c of String(identity)) if (c !== 'C') colors.add(c);
      }
      return known ? colors : null;
    };

    const fromCommanders = collect((commanders || []).map((e) => nameKey(e.card || e)));
    if (fromCommanders) return fromCommanders;
    return deckNames ? collect([...deckNames]) : null;
  }

  function withinIdentity(combo, identity) {
    if (!identity) return true; // unknown commander -> don't split by colour
    for (const c of String(combo.i || '')) {
      if (c !== 'C' && !identity.has(c)) return false;
    }
    return true;
  }

  // ---- working out the commander when nobody typed one --------------------
  //
  // Expecting people to fill in the commander box is expecting them to do work
  // the decklist already did: in a Commander deck the commander is one of the
  // pasted cards. This finds it.
  //
  // It is a guess, so it only commits to an answer when the export's ordering or
  // the deck's own colours single one out, and otherwise hands back the
  // shortlist for the page to show as "possible commanders" rather than picking
  // arbitrarily.
  //
  // Deliberate property, asserted in the tests: a commander returned here can
  // never *narrow* the deck's colour identity, because every rule requires the
  // candidate to cover the colours the deck already plays. A wrong guess can
  // mislabel the header; it cannot make combos disappear.

  function colourSet(identity) {
    const set = new Set();
    for (const c of String(identity || '')) if (c !== 'C') set.add(c);
    return set;
  }

  const sameColours = (a, b) => a.size === b.size && [...a].every((c) => b.has(c));
  const covers = (a, b) => [...b].every((c) => a.has(c)); // a ⊇ b

  // Sort key for spotting a machine-sorted list. Punctuation is dropped because
  // deck sites disagree about whether "Sam, Loyal Attendant" sorts as "sam
  // loyal" or "samloyal", and that disagreement is not worth being wrong over.
  function sortKey(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  // How many entries at the top sit in front of an alphabetically sorted list.
  //
  // Deck sites export the commander first and then the deck in name order, so a
  // card in front of an otherwise perfectly sorted list is there for a reason.
  // This is the only signal that separates a real partner pair from the several
  // other pairs whose colours would add up the same way.
  const MIN_SORTED_TAIL = 20; // short lists sort by accident; 99-card decks don't

  function commandersByPosition(entries, legal, byKey) {
    const names = [];
    for (const entry of entries || []) {
      const name = entry && (entry.card || entry.name || entry);
      if (typeof name === 'string') names.push(name);
    }

    const sortedFrom = (start) => {
      for (let i = start + 1; i < names.length; i += 1) {
        if (sortKey(names[i - 1]) > sortKey(names[i])) return false;
      }
      return true;
    };

    // Already sorted top to bottom: no card is out in front, so no signal.
    if (sortedFrom(0)) return null;

    // Commander decks have one commander, or two partners. Three would be a
    // sorting coincidence rather than a deck.
    for (const k of [1, 2]) {
      if (names.length - k < MIN_SORTED_TAIL) break;
      if (!sortedFrom(k)) continue;
      const front = names.slice(0, k);
      if (!front.every((n) => legal.has(nameKey(n)))) return null;
      return front.map((card) => ({ card, colours: colourSet(byKey[nameKey(card)]) }));
    }
    return null;
  }

  function detectCommanders(entries, dataset) {
    // Absent on data published before commander names were included; detection
    // is simply off until the next data refresh rather than wrong.
    const legalNames = dataset && dataset.commanderNames;
    if (!Array.isArray(legalNames) || !legalNames.length) return null;

    const byKey = identityIndex(dataset.cardIdentity);
    const legal = new Set(legalNames.map(nameKey));

    const deckColours = new Set();
    const candidates = [];
    const seen = new Set();
    for (const entry of entries || []) {
      const name = entry && (entry.card || entry.name || entry);
      if (typeof name !== 'string') continue;
      const key = nameKey(name);
      const colours = colourSet(byKey[key]);
      for (const c of colours) deckColours.add(c);
      if (!legal.has(key) || seen.has(key)) continue;
      seen.add(key);
      candidates.push({ card: name, colours });
    }
    if (!candidates.length) return null;

    const shortlist = candidates.map((c) => c.card);
    // Nothing may claim to be the commander unless it covers the colours the
    // deck already plays. This is the one check every rule shares, and the
    // reason a wrong guess can never hide combos.
    const settle = (list) => {
      const union = new Set();
      for (const c of list) for (const colour of c.colours) union.add(colour);
      if (!covers(union, deckColours)) return null;
      return { commanders: list.map((c) => ({ card: c.card })), confident: true, candidates: shortlist };
    };

    // Strongest signal first: the export's ordering. Moxfield and Archidekt
    // write the commander at the top and the rest of the deck alphabetically,
    // so a card sitting in front of an otherwise perfectly sorted list is there
    // because it is the commander. This is what identifies a partner pair whose
    // colours several other pairs could also add up to.
    const ordered = commandersByPosition(entries, legal, byKey);
    if (ordered) {
      const settled = settle(ordered);
      if (settled) return settled;
    }

    // The commander whose colours are exactly the deck's is the commander —
    // that is what building to a colour identity means.
    const unsure = { commanders: [], confident: false, candidates: shortlist };

    const exact = candidates.filter((c) => sameColours(c.colours, deckColours));
    if (exact.length === 1) return settle(exact) || unsure;

    // More than one card fits exactly: no way to tell them apart, so don't try.
    if (exact.length === 0) {
      // Two partners splitting the deck's colours between them — Thrasios (GU)
      // plus Tymna (WB) in a four-colour deck. Only when exactly one pair adds
      // up, otherwise it is a coin flip.
      const pairs = [];
      for (let i = 0; i < candidates.length; i += 1) {
        for (let j = i + 1; j < candidates.length; j += 1) {
          const union = new Set([...candidates[i].colours, ...candidates[j].colours]);
          if (sameColours(union, deckColours)) pairs.push([candidates[i], candidates[j]]);
        }
      }
      if (pairs.length === 1) return settle(pairs[0]) || unsure;

      // Nothing matches the deck's colours exactly, so the deck plays fewer
      // colours than its commander allows — a Mardu commander in a list that
      // happens to run no red cards. The narrowest candidate that still covers
      // everything is the answer, and only if it is the only one.
      const wider = candidates.filter((c) => covers(c.colours, deckColours));
      if (wider.length) {
        const narrowest = Math.min(...wider.map((c) => c.colours.size));
        const best = wider.filter((c) => c.colours.size === narrowest);
        if (best.length === 1) return settle(best) || unsure;
      }
    }

    return unsure;
  }

  // Splits the dataset against a deck the same way find-my-combos does:
  // complete combos, those one card short, and those one card short but
  // outside the deck's colours.
  function matchDeck(dataset, deckNames, commanders) {
    const combos = (dataset && dataset.combos) || [];
    const identity = deckIdentity(commanders, dataset && dataset.cardIdentity, deckNames);
    const included = [];
    const almost = [];
    const almostByAddingColors = [];

    for (const combo of combos) {
      const cards = combo.c || [];
      let missing = 0;
      for (const name of cards) {
        if (!deckNames.has(nameKey(name))) {
          missing += 1;
          if (missing > 1) break;
        }
      }
      if (missing === 0) {
        // A combo needing a template ("a sacrifice outlet") isn't proven
        // complete by card names alone, so it never counts as included.
        if (!combo.t) included.push(combo);
      } else if (missing === 1 && !combo.t) {
        (withinIdentity(combo, identity) ? almost : almostByAddingColors).push(combo);
      }
    }

    const byPopularity = (a, b) => (b.pop || 0) - (a.pop || 0);
    included.sort(byPopularity);
    return { identity, included, almostIncluded: almost, almostIncludedByAddingColors: almostByAddingColors };
  }

  // Normalizes a dataset combo into the shape the renderer expects, so the
  // rendering code doesn't need to know about the compact field names.
  function expand(combo) {
    return {
      id: combo.id,
      uses: (combo.c || []).map((name) => ({ card: { name } })),
      produces: (combo.p || []).map((name) => ({ feature: { name } })),
      identity: combo.i,
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
      for (const [key, name] of unique) {
        let entry = byCard.get(key);
        if (!entry) {
          entry = { card: name.split('//')[0].trim(), combos: [] };
          byCard.set(key, entry);
        }
        entry.combos.push(variant);
      }
    }
    return [...byCard.values()]
      .map((e) => ({ card: e.card, count: e.combos.length, combos: e.combos }))
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

  // EDHREC card page slug: "Kinnan, Bonder Prodigy" -> "kinnan-bonder-prodigy"
  function edhrecSlug(name) {
    return nameKey(name)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const api = {
    computeSuggestions, deckNameSet, nameKey, edhrecSlug, variantCardNames,
    matchDeck, deckIdentity, withinIdentity, expand, summarizeResults, comboPieces, splitResults,
    detectCommanders, groupSuggestions, groupVariants, variantSignature,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.DeckCombos = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
