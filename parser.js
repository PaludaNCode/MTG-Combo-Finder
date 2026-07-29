// Decklist parser. Runs in the browser (window.DeckParser) and under Node
// (module.exports) so the same code is unit-testable with node:test.
(function (global) {
  'use strict';

  // Section headers that switch which board subsequent lines belong to.
  // Matches e.g. "Commander:", "COMMANDERS", "Sideboard:", "Maybeboard",
  // "Deck", "Mainboard:", "Companion:", "Tokens" (Moxfield / MTGA / Archidekt
  // text exports all use some variation of these).
  const SECTION_RE = /^(commanders?|deck|main\s*board|main\s*deck|side\s*board|maybe\s*board|companion|tokens?|considering|about|wishlist)\s*:?\s*$/i;

  const SECTION_TARGET = {
    commander: 'commanders',
    commanders: 'commanders',
    deck: 'main',
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
  };

  // One card line. Handles:
  //   "Sol Ring"
  //   "1 Sol Ring"
  //   "1x Sol Ring"
  //   "1 Sol Ring (C21) 263"            (Moxfield / MTGA export)
  //   "1 Sol Ring (C21) 263 *F*"        (foil marker)
  //   "1 Sol Ring [C21]"                 (Archidekt-ish)
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

    // Strip trailing set/collector-number/foil annotations:
    //   "(C21) 263", "(C21)", "[C21]", "*F*", "<c21>", "#!Commander" tags
    let name = line
      .replace(/\s*\((?:[A-Za-z0-9]{2,6})\)(?:\s+[\w★†-]+)?\s*/g, ' ')
      .replace(/\s*\[[A-Za-z0-9]{2,6}\]\s*/g, ' ')
      .replace(/\s*<[^>]*>\s*/g, ' ')
      .replace(/\s*\*[A-Za-z]\*\s*/g, ' ')
      .replace(/\s*#[!\w-]+\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name) return null;
    return { name, quantity, sideboardPrefix };
  }

  // Parses a full decklist text blob into { commanders: [...], main: [...] }
  // where each entry is { card, quantity } (the shape Commander Spellbook's
  // find-my-combos endpoint expects).
  function parseDecklist(text) {
    const commanders = [];
    const main = [];
    const byName = { commanders: new Map(), main: new Map() };
    let target = 'main';

    for (const rawLine of String(text || '').split(/\r?\n/)) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      const sectionMatch = trimmed.match(SECTION_RE);
      if (sectionMatch) {
        const key = sectionMatch[1].toLowerCase().replace(/\s+/g, '');
        target = SECTION_TARGET[key] || 'main';
        continue;
      }
      if (target === 'ignore') continue;

      const parsed = parseLine(rawLine);
      if (!parsed || parsed.sideboardPrefix) continue;

      const bucket = byName[target];
      const existing = bucket.get(parsed.name.toLowerCase());
      if (existing) {
        existing.quantity += parsed.quantity;
      } else {
        const entry = { card: parsed.name, quantity: parsed.quantity };
        bucket.set(parsed.name.toLowerCase(), entry);
        (target === 'commanders' ? commanders : main).push(entry);
      }
    }

    return { commanders, main };
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

  // Pulls the public deck id out of a Moxfield deck URL.
  function moxfieldDeckId(url) {
    const m = String(url || '').match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }

  const api = { parseDecklist, parseLine, fromMoxfield, moxfieldDeckId };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.DeckParser = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
