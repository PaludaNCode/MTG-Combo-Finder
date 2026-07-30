// Combo-result analysis: turns Commander Spellbook "almost included" variants
// into ranked card suggestions ("add this card, unlock N combos").
// Browser global (window.DeckCombos) + Node module, like parser.js.
(function (global) {
  'use strict';

  // Card-name comparison key: lowercase, front face only (decklists usually
  // write "Valki, God of Lies" while Spellbook uses "Valki, God of Lies // Tibalt...").
  function nameKey(name) {
    return String(name || '').split('//')[0].trim().toLowerCase();
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

  // ---- matching against the bundled combo dataset -------------------------
  // The page can't call Commander Spellbook's API (their CORS allowlist covers
  // only their own site and localhost), so a GitHub Action publishes the whole
  // database and we do the matching here. This mirrors what their
  // find-my-combos endpoint does server-side.

  // Colour identity of the deck, from its commanders where we know them.
  // Returns null when no commander is recognized, which means "don't filter".
  function deckIdentity(commanders, cardIdentity) {
    if (!cardIdentity) return null;
    const byKey = Object.create(null);
    for (const name of Object.keys(cardIdentity)) byKey[nameKey(name)] = cardIdentity[name];

    let known = false;
    const colors = new Set();
    for (const entry of commanders || []) {
      const identity = byKey[nameKey(entry.card || entry)];
      if (identity === undefined) continue;
      known = true;
      for (const c of String(identity)) if (c !== 'C') colors.add(c);
    }
    return known ? colors : null;
  }

  function withinIdentity(combo, identity) {
    if (!identity) return true; // unknown commander -> don't split by colour
    for (const c of String(combo.i || '')) {
      if (c !== 'C' && !identity.has(c)) return false;
    }
    return true;
  }

  // Splits the dataset against a deck the same way find-my-combos does:
  // complete combos, those one card short, and those one card short but
  // outside the deck's colours.
  function matchDeck(dataset, deckNames, commanders) {
    const combos = (dataset && dataset.combos) || [];
    const identity = deckIdentity(commanders, dataset && dataset.cardIdentity);
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

  // ---- what a combo actually gives you ------------------------------------

  // "Does this win?" has three honest answers, not two.
  //
  //   win      — the combo says so outright.
  //   decisive — ends most games without saying so, and the exceptions are real
  //              enough to be worth naming rather than either ignoring or
  //              overstating. Infinite life is the clearest case: it beats
  //              almost everything, but poison ignores life totals entirely,
  //              and mill or an alternate win condition goes over the top of it.
  //   other    — enablers. Infinite mana wins nothing by itself.
  const WIN_RE = /\b(?:wins?|loses?|lose) the game\b/i;

  // Each entry carries why it falls short of a stated win, shown on hover, so
  // the tier informs rather than just colouring things in.
  const DECISIVE = [
    {
      re: /\b(?:infinite|near-infinite|arbitrarily large)\b[^,;]*\blife\s?gain\b|\binfinite life\b/i,
      why: 'Beats most decks — but poison ignores life totals, and mill or an alternate win condition goes over the top of it.',
    },
    {
      re: /\b(?:infinite|near-infinite|arbitrarily large)\b[^,;]*\b(?:damage|life\s?loss)\b/i,
      why: 'Lethal in most games, unless damage is prevented or they out-gain it.',
    },
    {
      re: /\b(?:infinite|near-infinite|arbitrarily large)\b[^,;]*\bmill\b/i,
      why: 'Decks most opponents out, but loses to Thassa’s Oracle or a graveyard shuffle-back.',
    },
    {
      re: /\b(?:infinite|near-infinite)\b[^,;]*\b(?:turns?|combats?)\b/i,
      why: 'Wins eventually, but still needs something that actually closes the game.',
    },
    {
      re: /\b(?:infinite|near-infinite)\b[^,;]*\b(?:poison|infect)\b/i,
      why: 'Ten poison counters end it regardless of life total.',
    },
  ];

  function classify(name) {
    if (WIN_RE.test(name)) return { tier: 'win', why: 'This combo wins the game outright.' };
    for (const entry of DECISIVE) {
      if (entry.re.test(name)) return { tier: 'decisive', why: entry.why };
    }
    return { tier: 'other', why: '' };
  }

  // Commander Spellbook lists results as feature names. They arrive unordered,
  // sometimes repeated with different casing, and a long combo can produce a
  // dozen — so dedupe and rank rather than printing the raw list. Their wording
  // is left alone: rewriting "Infinite ETB triggers" into something snappier
  // risks saying something the combo does not actually do.
  const TIER_ORDER = { win: 0, decisive: 1, other: 2 };

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
    out.sort((a, b) => (TIER_ORDER[a.tier] - TIER_ORDER[b.tier]) || a.name.localeCompare(b.name));
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
    matchDeck, deckIdentity, withinIdentity, expand, summarizeResults,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.DeckCombos = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
