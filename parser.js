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

  // How many cards a command zone has to claim before we stop believing the heading
  // that says so. A command zone is one card, or two with partners; fifteen is far
  // above anything legal and far below a deck, so no real list sits in between. See
  // the fold at the end of parseDecklist().
  //
  // This applies to the command zone and nothing else. An earlier version applied it
  // to the sideboard too, on the reasoning that a constructed sideboard is capped at
  // fifteen cards and Commander has none — so a sixteenth meant the heading had gone
  // stale and swallowed the deck. That reasoning is about the rules of the game, and
  // the sideboard is not used by the rules of the game here: on Moxfield it is where
  // people park cards they are considering, and such a list has no size at all. A
  // stash of forty saved cards folded into the deck would invent combos the deck
  // cannot make, which is a worse failure than the one it was fixing, and quieter.
  // Sideboard cards stay out of the deck at every size.
  const DECK_SIZED_RUN = 15;

  // Where a new main-deck card should be written into a decklist someone is
  // already holding.
  //
  // "+ Add to deck" used to append to the end of the box, which is right until the
  // list ends in a section — and plenty do, because that is how the sites export
  // them. A card appended after "Sideboard:" is parsed as a sideboard card, never
  // enters the deck, and so comes straight back as a suggestion on the next search:
  // the button looks like it did nothing. Appending after "Commander:" is quieter
  // and worse, silently promoting whatever you added to the command zone.
  //
  // Returns the line index to insert before: the **end of the last main-deck run**,
  // not the first heading that leaves it. The difference shows on an export that
  // opens with its command zone —
  //
  //     Commander        Deck
  //     1 Chatterfang    1 Arcane Signet
  //
  // where "before the first non-main heading" is line 0, above everything. The card
  // parses as main-deck from there, so it works, but it reads as though the button
  // put it in the wrong place. The end of the last main run is under the deck, which
  // is where someone would have typed it.
  //
  // Lives here rather than in the page because this is the same walk parseDecklist()
  // does — including the oversized-command-zone rule — and two notions of "which
  // lines are the main deck" would drift apart the first time a site invented a
  // heading.
  function mainDeckInsertIndex(text) {
    const lines = String(text || '').split(/\r?\n/);
    let target = 'main';

    // Every contiguous run of card lines with the board it was read under, plus a
    // zero-card marker at each main heading so a heading with nothing under it yet
    // still says where cards would go. Collected rather than resolved on the fly
    // because whether a section is really the deck is only known once it has ended.
    const runs = [];
    let run = null;
    const closeRun = () => { if (run) { runs.push(run); run = null; } };

    for (let i = 0; i < lines.length; i += 1) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;

      const heading = normalizeHeading(trimmed);
      if (Object.prototype.hasOwnProperty.call(SECTION_TARGET, heading)) {
        target = SECTION_TARGET[heading];
        closeRun();
        if (target === 'main') runs.push({ target, cards: 0, end: i + 1 });
        continue;
      }
      if (/side\s*board|maybe\s*board/i.test(trimmed) && !/^\d/.test(trimmed)) {
        target = 'ignore';
        closeRun();
        continue;
      }
      if (isCategoryHeading(trimmed)) continue; // a label inside a board, not a board
      // MTGO marks its sideboard per line instead of with a heading. Those lines sit
      // inside the main run but are not in the deck, so a card added to such a list
      // goes above them rather than into the middle of the sideboard.
      if (/^sb:/i.test(trimmed)) continue;

      if (!run || run.target !== target) { closeRun(); run = { target, cards: 0, end: 0 }; }
      run.cards += 1;
      run.end = i + 1;
    }
    closeRun();

    // parseDecklist()'s size rule, applied to the same runs, so the card is written
    // into whatever that function will read as the deck.
    const zone = runs.reduce((n, r) => (r.target === 'commanders' ? n + r.cards : n), 0);
    const deck = runs.filter((r) => r.target === 'main'
      || (r.target === 'commanders' && zone > DECK_SIZED_RUN));

    // An empty box, and a list with no deck in it anywhere, take the top. Never a
    // sideboard, however many cards someone has parked in it: a card written there
    // is a card the next search will not see.
    if (!deck.length) return 0;

    // Otherwise the end of the **biggest** run that is deck, which is only a question
    // when a section has split the deck in two — a sideboard in the middle of a list,
    // or an export that repeats its Deck heading. Then "which of these is the deck"
    // is answered by weight of cards rather than by which happens to come last, and a
    // card added to a 60-card block reads as belonging where a card added to the
    // one-line block below the sideboard does not.
    //
    // Ties keep the later run, so an ordinary single-block list is unaffected and the
    // marker pushed at an empty Deck heading only wins when there is nothing else.
    //
    // Not the first heading that *leaves* the deck, in any case: on an export that
    // opens with its command zone that is line 0, above everything, which parses
    // correctly but reads as though the button misfired.
    return deck.reduce((best, r) => (r.cards >= best.cards ? r : best)).end;
  }

  // The decklist someone is holding, with one more card in its main deck. Trailing
  // blank lines before a section are kept below the new card, so a list keeps the
  // shape its owner gave it.
  function addMainDeckCard(text, name, quantity) {
    const lines = String(text || '').split(/\r?\n/);
    const at = mainDeckInsertIndex(text);
    const line = String(quantity || 1) + ' ' + name;

    // Nothing but blank lines below the main deck — including an empty box — is an
    // append, and appending must not leave the trailing newline the insert path would.
    if (!lines.slice(at).some((l) => l.trim())) {
      const body = lines.slice(0, at).join('\n').replace(/\s+$/, '');
      return body ? body + '\n' + line : line;
    }

    return lines.slice(0, at).concat(line, lines.slice(at)).join('\n');
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

    // A whole decklist pasted under a "Commander" heading, with no "Deck" heading
    // after it, is the one shape where believing the heading is worse than counting
    // the cards: it produces a hundred-card command zone, and colour identity — which
    // every suggestion is filtered by — is taken from the command zone. So the deck
    // would filter itself against itself, and the button that adds a card would add a
    // commander. Over DECK_SIZED_RUN cards, the heading loses.
    const intoMain = (name, quantity) => {
      const key = name.toLowerCase();
      const existing = byName.main.get(key);
      if (existing) { existing.quantity += quantity; return; }
      const entry = { card: name, quantity };
      byName.main.set(key, entry);
      main.push(entry);
    };

    if (commanders.length > DECK_SIZED_RUN) {
      for (const entry of commanders.splice(0)) intoMain(entry.card, entry.quantity);
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

  // ---- decks that arrive as a file -------------------------------------------
  //
  // Every deck site exports a text file, and a file needs no CORS, no API and no
  // new origin in the CSP — which is why this covers sites an adapter never will,
  // Moxfield included. The reading happens in app.js because it needs a DOM; the
  // two decisions worth getting right happen here, because they are the ones that
  // can quietly do the wrong thing.

  // A deck of 100 cards is about 2 KB. The cap is not about our own limits — it
  // is so that dropping a photo or a video on the box fails as a sentence rather
  // than as a browser reading 40 MB into a textarea and locking up the tab.
  const MAX_DECK_FILE_BYTES = 1024 * 1024;

  // Extensions deck sites actually export. `.dec` and `.mwdeck` are the old
  // Magic Workstation formats, which several sites still offer and which
  // parseLine already reads: they are "1 Sol Ring" with occasional SB: prefixes.
  const DECK_FILE_EXTENSIONS = ['.txt', '.dec', '.mwdeck', '.csv'];

  // Whether to even try reading a file, from what the browser tells us before it
  // is opened. Deliberately permissive about type and strict about size: browsers
  // report an empty `type` for plenty of legitimate .txt files, so a missing type
  // must not be a refusal, while a 40 MB file is never a decklist.
  function acceptDeckFile(file) {
    if (!file || typeof file !== 'object') return { ok: false, reason: 'empty' };
    const name = String(file.name || '');
    const size = Number(file.size);

    if (Number.isFinite(size) && size > MAX_DECK_FILE_BYTES) return { ok: false, reason: 'too-big', name };
    if (Number.isFinite(size) && size === 0) return { ok: false, reason: 'empty', name };

    const type = String(file.type || '').toLowerCase();
    // A type the browser is sure about and that is not text settles it — this is
    // what catches an image or a PDF before it is ever read.
    if (type && !/^text\//.test(type) && type !== 'application/json') {
      return { ok: false, reason: 'not-text', name };
    }
    const lower = name.toLowerCase();
    const known = DECK_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
    // No extension and no type is not a refusal: it is a file we will read and
    // then judge by its contents, which is the only honest test anyway.
    if (!known && lower.includes('.') && !type) return { ok: false, reason: 'not-text', name };
    return { ok: true, name };
  }

  // The honest test, applied after reading: does this look like text a person
  // wrote, or like bytes decoded as if they were? A binary file read as UTF-8
  // comes back full of U+FFFD replacement characters and C0 control bytes, and
  // pasting that into the box would produce a wall of skipped lines rather than
  // "that isn't a decklist".
  function looksLikeText(text) {
    const s = String(text || '');
    if (!s) return false;
    let bad = 0;
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charCodeAt(i);
      // Tab, newline and carriage return are the only control characters a
      // decklist has any business containing.
      if (c === 9 || c === 10 || c === 13) continue;
      if (c < 32 || c === 0xfffd) bad += 1;
    }
    return bad / s.length < 0.01;
  }

  // Limits enforced by the find-my-combos endpoint (common/serializers.py).
  // Exceeding them is a 400, so the page trims and says so instead.
  const API_LIMITS = { maxMain: 600, maxCommanders: 12, maxNameLength: 256 };

  const api = {
    parseDecklist, parseLine, fromMoxfield, fromArchidekt,
    parseDeckUrl, describeLoadFailure, SITES,
    normalizeHeading, isCategoryHeading, API_LIMITS,
    mainDeckInsertIndex, addMainDeckCard,
    acceptDeckFile, looksLikeText, MAX_DECK_FILE_BYTES, DECK_FILE_EXTENSIONS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.DeckParser = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
