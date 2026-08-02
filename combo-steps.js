// How a combo is actually executed: what has to be true before you start, and
// the steps in order.
//
// Why this is fetched at all rather than published with everything else: the
// combo database is 103,737 rows and 27.65 MB parsed, of which the results field
// alone is 13 MB. The steps add 51.70 MB of text on top of that — twice the whole
// rest of the database — so carrying them for every combo would swamp a download
// the page already works hard to make once (see search.js). The reader only wants the
// steps for a combo they have stopped to look at, so they are fetched for that one
// combo, at the moment they ask. steps-source.js is where they come from, and why
// they come from there; this file only decides what they say.
//
// The two halves are still kept apart behind setSource(). Not because the source
// is undecided any more — it is one small file per combo on the data branch — but
// because normalize() reads Commander Spellbook's own payload shape, so if their
// CORS allowlist ever admits this origin, their endpoint drops in with no adapter.
// pick() is the other end of the same idea: it selects the fields normalize()
// reads and nothing else, so what gets published is a subset of what they send
// rather than a format of our own that could drift from what the panel expects.
//
// Runs in the page and under Node (module.exports) so the parsing is testable
// without a browser. Deliberately not imported by search-worker.js: like the
// combo map, this is drawn from a result rather than worked out during a search.
(function (global) {
  'use strict';

  // Spellbook records where a card has to be, as a letter per zone. Spelled out
  // here because "B" on a row that is trying to explain something is worse than
  // saying nothing — an unknown letter is dropped rather than printed raw.
  const ZONES = {
    B: 'on the battlefield',
    G: 'in your graveyard',
    H: 'in your hand',
    E: 'in exile',
    L: 'in your library',
    C: 'in the command zone',
  };

  // A card's state is recorded per zone, and only the one matching where it has to
  // be is meaningful. They arrive as empty strings rather than absent, so the first
  // non-empty wins. Named because pick() has to collapse them in exactly this
  // order for what it publishes to say the same thing as what it was given.
  const STATE_FIELDS = [
    'battlefieldCardState', 'graveyardCardState', 'exileCardState',
    'libraryCardState', 'cardState',
  ];

  const stateOf = (use) => {
    for (const field of STATE_FIELDS) {
      const value = String((use && use[field]) || '').trim();
      if (value) return value;
    }
    return '';
  };

  // What has to be true of one card before the combo starts: where it is, and
  // anything Spellbook notes about the state it is in ("untapped", "with two
  // +1/+1 counters on it"). Returns null when there is nothing to say, so a
  // combo whose cards just need to be on the battlefield does not produce four
  // lines saying so.
  function describeUse(use) {
    if (!use) return null;
    const name = (use.card && use.card.name) || use.name;
    if (!name) return null;

    const zones = []
      .concat(use.zoneLocations || [])
      .map((z) => ZONES[String(z).toUpperCase()])
      .filter(Boolean);
    // A card that could be in any of three zones is not a prerequisite worth
    // printing — it is a card the combo does not care about the position of.
    const where = zones.length === 1 ? zones[0] : '';
    const parts = [where, stateOf(use)].filter(Boolean);

    // The one exception to "nothing to say means no line": a commander has to be
    // *your* commander, which no zone or state field captures.
    if (!parts.length) return use.mustBeCommander ? name + ' — as your commander' : null;
    return name + ' — ' + parts.join(', ');
  }

  // Spellbook writes the steps as one string with a line per step, and the
  // prerequisites either as prose or as fields on each card. Both arrive with
  // blank lines and stray whitespace in them.
  const lines = (text) => String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Their payload → what the panel draws. Defensive about which fields exist:
  // this shape is read off their API rather than agreed with them, so a field
  // that has been renamed should cost that one line, not the whole panel.
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;

    // `notablePrerequisites` then `easyPrerequisites`, in that order: they separate
    // the conditions worth stopping on from the ones a player assumes, and printing
    // the notable ones first is the whole value of them having split it.
    //
    // `otherPrerequisites` used to be read here and does not exist. It was a guess,
    // and a guessed field name does not fail — it comes back undefined and the
    // panel quietly shows one fewer line. tools/peek-variant.js settled it against
    // the real export; see the README for what a variant really contains.
    const prerequisites = []
      .concat(lines(raw.notablePrerequisites))
      .concat(lines(raw.easyPrerequisites))
      .concat(([].concat(raw.uses || [])).map(describeUse).filter(Boolean));

    const steps = lines(raw.description || raw.steps);
    // Mana is a prerequisite like any other, but it is the one people check
    // first, so it leads rather than joining the end of the list.
    const mana = String(raw.manaNeeded || '').trim();
    if (mana) prerequisites.unshift('Mana available: ' + mana);

    // A panel with a heading and nothing under it is worse than no panel. If
    // neither half survived, say so by returning null and let the caller show
    // the "not recorded" state.
    if (!prerequisites.length && !steps.length) return null;
    return { prerequisites, steps };
  }

  // ---- what gets published ---------------------------------------------------
  //
  // One variant from Spellbook's bulk export → the record the data branch carries,
  // or null if the combo has nothing showable and so needs no file at all.
  //
  // This is a *subset*, not a translation. Every key it emits is one normalize()
  // already reads, so the published file is something normalize() could have been
  // handed straight from their API — which is the property that keeps the two ends
  // from drifting, and the one test/combo-steps.test.js checks directly:
  // normalize(pick(v)) deep-equals normalize(v), for any v.
  //
  // Worth doing rather than publishing the variant whole: a variant carries card
  // images, legality, prices and its full result list, and the export is 512 MB.
  // Worth doing rather than publishing normalize()'s output: the wording of a
  // prerequisite is a rendering decision, and baking today's into 103,737 files
  // would mean a change to describeUse() needing a data refresh to take effect.
  function pick(variant, id) {
    if (!variant || typeof variant !== 'object') return null;

    const record = { id: String(id) };
    // Empty fields are dropped rather than published as "": across 103,737 rows
    // most of these are empty most of the time, and normalize() cannot tell the
    // difference between absent and blank.
    const put = (key, value) => {
      const text = String(value || '').trim();
      if (text) record[key] = text;
    };
    put('manaNeeded', variant.manaNeeded);
    put('notablePrerequisites', variant.notablePrerequisites);
    put('easyPrerequisites', variant.easyPrerequisites);
    put('description', variant.description || variant.steps);

    // Only the cards that produce a line. A card describeUse() says nothing about
    // contributes nothing to the panel, so publishing it is bytes spent on a row
    // that will never be drawn — and dropping it cannot change the output, which
    // is exactly why the equality test can be an equality rather than a subset.
    const uses = [].concat(variant.uses || []).map((use) => {
      if (!use) return null;
      const name = (use.card && use.card.name) || use.name;
      if (!name) return null;
      const out = { name };
      const zones = [].concat(use.zoneLocations || []);
      if (zones.length) out.zoneLocations = zones;
      // Collapsed to the one field describeUse() would have reached anyway,
      // in the order it reaches them.
      const state = stateOf(use);
      if (state) out.cardState = state;
      if (use.mustBeCommander) out.mustBeCommander = true;
      return describeUse(out) ? out : null;
    }).filter(Boolean);
    if (uses.length) record.uses = uses;

    // Asked of the real function rather than reimplemented: a record the panel
    // would refuse to draw is a file nobody should have to fetch to find that out.
    return normalize(record) ? record : null;
  }

  // Kept for the life of the page: a reader who collapses a combo and opens it
  // again should not pay for it twice, and the answer cannot change mid-session.
  // A combo with no steps caches too — as null — so a second press does not
  // re-ask a question already answered.
  const held = new Map();

  let source = null;

  // Where the steps come from. app.js sets it to steps-source.js's reader; the
  // tests set it to whatever they are testing. With no source at all, every combo
  // answers "no steps" — deliberately, and deliberately not with sample text: a
  // fallback that invents three combos' worth of instructions would make a page
  // that had failed to wire up its data indistinguishable from one that had.
  function setSource(fn) {
    source = typeof fn === 'function' ? fn : null;
    held.clear(); // a new source can give a different answer to the same id
  }

  // The steps for one combo, or null if there are none to show. Never rejects:
  // a failure to fetch is reported as `{ error }` rather than thrown, because
  // every caller has the same fallback — the link to the combo's own page — and
  // a panel is a bad place for an exception to arrive.
  async function get(id) {
    const key = String(id || '');
    if (!key) return null;
    if (held.has(key)) return held.get(key);

    let answer;
    try {
      const raw = await (source ? source(key) : null);
      answer = normalize(raw);
    } catch (err) {
      // Not cached: a fetch that failed because the network was down should be
      // retried the next time someone asks, unlike a combo that simply has no
      // steps recorded.
      return { error: err && err.message ? err.message : String(err) };
    }
    held.set(key, answer);
    return answer;
  }

  const api = {
    get,
    normalize,
    describeUse,
    pick,
    setSource,
    // Test support: the cache is deliberately never invalidated in a session.
    reset() {
      held.clear();
      source = null;
    },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.ComboSteps = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
