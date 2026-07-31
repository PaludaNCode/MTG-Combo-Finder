// Decklist parser. Runs in the browser (window.DeckParser) and under Node
// (module.exports) so the same code is unit-testable with node:test.
(function (global) {
  'use strict';

  // Which board a section header switches to. Keys are the normalized form
  // produced by normalizeHeading(), so "Sideboard:", "SIDEBOARD (15)" and
  // "// Sideboard" all arrive here as "sideboard".
  const SECTION_TARGET = {
    commander: 'commanders',
    commanders: 'commanders',
    commandzone: 'commanders',
    command: 'commanders',
    deck: 'main',
    main: 'main',
    mainboard: 'main',
    maindeck: 'main',
    sideboard: 'ignore',
    maybeboard: 'ignore',
    companion: 'ignore',
    token: 'ignore',
    tokens: 'ignore',
    considering: 'ignore',
    about: 'ignore',
    wishlist: 'ignore',
    outside: 'ignore',
  };

  // Strips the decoration deck sites hang off section headings so they can be
  // compared against SECTION_TARGET: a leading comment marker, a trailing card
  // count, a trailing colon, then case and inner spaces.
  //   "// Sideboard"     -> "sideboard"
  //   "Commander (1):"   -> "commander"
  //   "Main Deck (99)"   -> "maindeck"
  function normalizeHeading(line) {
    return String(line)
      .replace(/^\s*(?:\/\/+|#+)\s*/, '')
      .replace(/[\s:]*[([]\s*\d+\s*[)\]]\s*:?\s*$/, '')
      .replace(/\s*:\s*$/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  // A category heading like "Creatures (24)" or "Lands [37]" — a label followed
  // by a count, with no quantity in front. Deckstats, Archidekt and MTGGoldfish
  // exports are full of them and they are not cards.
  //
  // A real card line is never mistaken for one: "1 Sol Ring (C21) 263" leads
  // with a quantity, and a set code like "(C21)" or "(MB1)" always contains a
  // letter, so only an all-digit count matches here.
  function isCategoryHeading(line) {
    return /^[^\d].*[([]\s*\d+\s*[)\]]\s*:?$/.test(String(line).trim());
  }

  // How the export formats mark "this one is the commander" on the card line
  // itself, rather than under a heading:
  //   "*CMDR*"           Moxfield / Arena text export
  //   "[Commander{top}]" Archidekt text export (the category, with its layout hint)
  // Worth recognizing on its own: it means a plain paste of a Moxfield export
  // identifies its own commander, with nothing typed into the commander box.
  //
  // "#!Commander" is deliberately not here. It looks like the same thing but is
  // a free-form Moxfield tag, and it lands on cards like Arcane Signet that no
  // rule would let you command with.
  const COMMANDER_MARK = /\*CMDR\*|\[commander\b[^\]]*\]/i;

  // One card line. Handles:
  //   "Sol Ring"
  //   "1 Sol Ring"
  //   "1x Sol Ring"
  //   "1 Sol Ring (C21) 263"            (Moxfield / MTGA export)
  //   "1 Sol Ring (C21) 263 *F*"        (foil marker)
  //   "1 Sol Ring [C21]"                 (Archidekt-ish)
  //   "1 Sol Ring (c21) 3 [Ramp,Artifact]" (Archidekt text export categories)
  //   "SB: 1 Swords to Plowshares"      (MTGO sideboard prefix -> ignored)
  function parseLine(rawLine) {
    let line = rawLine.trim();
    if (!line) return null;
    // Comments
    if (line.startsWith('//') || line.startsWith('#')) return null;

    let sideboardPrefix = false;
    if (/^SB:\s*/i.test(line)) {
      sideboardPrefix = true;
      line = line.replace(/^SB:\s*/i, '');
    }

    let quantity = 1;
    const qtyMatch = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10);
      line = qtyMatch[2];
    }

    // Read the commander marker before the annotations carrying it are stripped.
    const commander = COMMANDER_MARK.test(line);

    // Strip trailing set/collector-number/foil annotations:
    //   "(C21) 263", "(C21)", "[C21]", "[Commander{top}]", "*F*", "*CMDR*",
    //   "<c21>", "#!Commander" tags
    //
    // Brackets are cleared whatever is inside them: Archidekt writes arbitrary
    // category names there ("[Ramp]", "[Commander{top}]"), and no card name
    // contains a bracket, so there is nothing to lose by being permissive.
    // Asterisk markers likewise take any run of letters — matching only a
    // single one left "*CMDR*" sitting in the card name.
    const name = line
      .replace(/\s*\((?:[A-Za-z0-9]{2,6})\)(?:\s+[\w★†-]+)?\s*/g, ' ')
      .replace(/\s*\[[^\]]*\]\s*/g, ' ')
      .replace(/\s*<[^>]*>\s*/g, ' ')
      .replace(/\s*\*[A-Za-z]+\*\s*/g, ' ')
      .replace(/\s*#[!\w-]+\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name) return null;
    return { name, quantity, sideboardPrefix, commander };
  }

  // Parses a full decklist text blob into { commanders, main, skipped } where
  // each card entry is { card, quantity } (the shape Commander Spellbook's
  // find-my-combos endpoint expects) and `skipped` lists what was dropped and
  // why, so the page can show it rather than silently losing lines.
  function parseDecklist(text) {
    const commanders = [];
    const main = [];
    const skipped = [];
    const byName = { commanders: new Map(), main: new Map() };
    let target = 'main';

    for (const rawLine of String(text || '').split(/\r?\n/)) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue; // blank lines are not worth reporting

      // A section heading anywhere switches the board, decorated or not.
      const heading = normalizeHeading(trimmed);
      if (Object.prototype.hasOwnProperty.call(SECTION_TARGET, heading)) {
        target = SECTION_TARGET[heading];
        continue;
      }
      // Anything else that mentions a board we ignore — "Sideboard cards",
      // "// sideboard" with trailing text — switches too rather than becoming a card.
      if (/side\s*board|maybe\s*board/i.test(trimmed) && !/^\d/.test(trimmed)) {
        target = 'ignore';
        continue;
      }
      if (target === 'ignore') {
        skipped.push({ line: trimmed, reason: 'sideboard / ignored section' });
        continue;
      }
      if (isCategoryHeading(trimmed)) {
        skipped.push({ line: trimmed, reason: 'category heading' });
        continue;
      }
      if (trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

      const parsed = parseLine(rawLine);
      if (!parsed) {
        skipped.push({ line: trimmed, reason: 'no card name found' });
        continue;
      }
      if (parsed.sideboardPrefix) {
        skipped.push({ line: trimmed, reason: 'sideboard (SB:) line' });
        continue;
      }
      // The API rejects a blank name or a quantity below 1.
      if (!parsed.name || parsed.quantity < 1) {
        skipped.push({ line: trimmed, reason: 'empty name or zero quantity' });
        continue;
      }

      // A per-line marker beats the section it sits in: a Moxfield export lists
      // the commander in the main board with "*CMDR*" on it and no heading.
      const board = parsed.commander ? 'commanders' : target;
      const bucket = byName[board];
      const existing = bucket.get(parsed.name.toLowerCase());
      if (existing) {
        existing.quantity += parsed.quantity;
      } else {
        const entry = { card: parsed.name, quantity: parsed.quantity };
        bucket.set(parsed.name.toLowerCase(), entry);
        (board === 'commanders' ? commanders : main).push(entry);
      }
    }

    return { commanders, main, skipped };
  }

  // Extracts { commanders, main } from a Moxfield API deck payload.
  // Tolerates both the v2 shape ({ mainboard: { "Name": { quantity } } })
  // and the v3 shape ({ boards: { mainboard: { cards: { id: { quantity, card: { name } } } } } }).
  function fromMoxfield(deck) {
    function collect(board) {
      const out = [];
      if (!board) return out;
      const cards = board.cards || board;
      for (const key of Object.keys(cards)) {
        const entry = cards[key];
        if (!entry || typeof entry !== 'object') continue;
        const name = (entry.card && entry.card.name) || entry.name || key;
        const quantity = entry.quantity || 1;
        if (typeof name === 'string' && name) out.push({ card: name, quantity });
      }
      return out;
    }

    const boards = deck && deck.boards ? deck.boards : deck || {};
    return {
      commanders: collect(boards.commanders),
      main: collect(boards.mainboard),
    };
  }

  // Extracts { commanders, main } from an Archidekt API deck payload
  // (https://archidekt.com/api/decks/{id}/). Card categories decide the board:
  // "Commander" -> commanders; categories flagged includedInDeck:false at the
  // deck level (plus the usual Maybeboard/Sideboard names) are skipped.
  function fromArchidekt(deck) {
    const commanders = [];
    const main = [];

    const excluded = new Set(['maybeboard', 'sideboard', 'considering', 'wishlist']);
    if (deck && Array.isArray(deck.categories)) {
      for (const cat of deck.categories) {
        if (cat && cat.includedInDeck === false && cat.name) {
          excluded.add(String(cat.name).toLowerCase());
        }
      }
    }

    for (const entry of (deck && deck.cards) || []) {
      if (!entry || typeof entry !== 'object') continue;
      const card = entry.card || {};
      const name = (card.oracleCard && card.oracleCard.name) || card.name || entry.name;
      if (typeof name !== 'string' || !name) continue;
      const cats = (entry.categories || []).map((c) => String(c).toLowerCase());
      if (cats.some((c) => excluded.has(c))) continue;
      const target = cats.includes('commander') ? commanders : main;
      target.push({ card: name, quantity: entry.quantity || 1 });
    }

    return { commanders, main };
  }

  // Deck sites we can recognize, and whether a *browser* can read their API.
  //
  // Moxfield deliberately gates its API: requests need a User-Agent it has
  // whitelisted on request, and Cloudflare bot protection sits in front. A page
  // can't set User-Agent (fetch forbids it) or answer a Cloudflare challenge
  // cross-origin, and no CORS headers come back either — so a static site can
  // never load a Moxfield deck, however the URL is written. Don't attempt the
  // fetch; send people straight to the export, which always works.
  const SITES = {
    moxfield: {
      label: 'Moxfield',
      browserImport: false,
      why: 'Moxfield blocks deck reads from other websites.',
      exportHint: 'Open the deck on Moxfield → More (…) → Export → copy, then paste below.',
    },
    archidekt: {
      label: 'Archidekt',
      browserImport: true,
      why: '',
      exportHint: 'Open the deck on Archidekt → Export → Text → copy, then paste below.',
    },
  };

  // Recognizes deck URLs -> { site, id, label, browserImport, why, exportHint } or null.
  function parseDeckUrl(url) {
    const s = String(url || '');
    let m = s.match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)/);
    if (m) return Object.assign({ site: 'moxfield', id: m[1] }, SITES.moxfield);
    m = s.match(/archidekt\.com\/(?:api\/)?decks\/(\d+)/);
    if (m) return Object.assign({ site: 'archidekt', id: m[1] }, SITES.archidekt);
    return null;
  }

  // Turns a failed deck fetch into something the user can act on. A browser
  // reports a blocked cross-origin request as a TypeError with no status
  // ("Failed to fetch" in Chrome, "Load failed" in Safari), which is a very
  // different problem from the deck being missing or private.
  function describeLoadFailure(err, site) {
    const label = (SITES[site] && SITES[site].label) || site;
    const hint = (SITES[site] && SITES[site].exportHint) || 'Copy the deck’s text export and paste it below.';
    const status = err && err.status;
    if (status === 404) return `${label} has no public deck with that ID — check the URL, or that the deck isn’t private. ${hint}`;
    if (status === 403) return `${label} refused the request (the deck may be private). ${hint}`;
    if (status) return `${label} returned HTTP ${status}. ${hint}`;
    return `Your browser blocked the request to ${label} — it doesn’t allow other websites to read decks. ${hint}`;
  }

  // Limits enforced by the find-my-combos endpoint (common/serializers.py).
  // Exceeding them is a 400, so the page trims and says so instead.
  const API_LIMITS = { maxMain: 600, maxCommanders: 12, maxNameLength: 256 };

  const api = {
    parseDecklist, parseLine, fromMoxfield, fromArchidekt,
    parseDeckUrl, describeLoadFailure, SITES,
    normalizeHeading, isCategoryHeading, API_LIMITS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.DeckParser = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
