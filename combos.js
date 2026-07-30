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

    for (let i = 0; i < slots.length; i += 1) {
      if (!assign(i, new Set())) return null;
    }
    return filled;
  }

  // How the deck fills a combo's template slots, or null when it cannot.
  //
  // Cards the combo already names are not eligible: a slot is an extra card the
  // combo needs, not a second job for one that is already in it. Where that is
  // stricter than Spellbook intends we lose a combo rather than claim one that
  // does not work, which is the error worth making.
  function fillTemplates(combo, byTemplate, templateNames) {
    const ids = combo.t;
    if (!ids) return [];
    // Data published before templates were resolved records only how many slots
    // a combo has, not which. There is nothing to check against, so those stay
    // excluded exactly as they were — the page and the data branch update
    // independently, and a stale combos.json must not start claiming combos.
    if (!Array.isArray(ids)) return null;
    if (!ids.length) return [];

    const named = new Set((combo.c || []).map(nameKey));
    const slots = [];
    for (const id of ids) {
      const candidates = (byTemplate.get(id) || []).filter((c) => !named.has(c.key));
      if (!candidates.length) return null;
      slots.push(candidates);
    }

    const filled = assignSlots(slots);
    if (!filled) return null;
    return filled.map((candidate, i) => ({
      id: ids[i],
      slot: (templateNames && templateNames[ids[i]]) || 'a card',
      card: candidate.name,
    }));
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
    const templateNames = (dataset && dataset.templates) || {};
    const byTemplate = deckTemplateIndex(dataset, deckNames, deckEntries);
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
      if (missing > 1) continue;

      // A template slot has no one card to suggest — thousands of cards fill
      // "a Creature with Haste" — so a combo counts only once the deck already
      // fills every slot it has. Unresolvable templates have no card list at
      // all, which lands here as "cannot fill" and keeps them excluded.
      const fills = combo.t ? fillTemplates(combo, byTemplate, templateNames) : [];
      if (!fills) continue;
      const row = fills.length ? Object.assign({}, combo, { fills }) : combo;

      if (missing === 0) {
        included.push(row);
      } else {
        (withinIdentity(combo, identity) ? almost : almostByAddingColors).push(row);
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
      // Which of the deck's cards was credited with each template slot, so the
      // page can show it rather than asking anyone to take the match on trust.
      fills: combo.fills || undefined,
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
    groupSuggestions, groupVariants, variantSignature,
    deckTemplateIndex, fillTemplates,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.DeckCombos = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
