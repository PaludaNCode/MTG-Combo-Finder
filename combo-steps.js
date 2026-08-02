// How a combo is actually executed: what has to be true before you start, and
// the steps in order.
//
// PROTOTYPE. The shape of the panel and the way it loads are real; the text it
// loads is not. See SAMPLE at the bottom — two combos are written out by hand so
// the interaction can be judged end to end, and every other combo deliberately
// resolves to "no steps", because how the page behaves when it *cannot* answer is
// half of what is being prototyped.
//
// Why this is fetched at all rather than published with everything else: the
// combo database is 103,737 rows and 27.65 MB parsed, of which the results field
// alone is 13 MB. Steps and prerequisites are several times longer than results,
// so carrying them for every combo would multiply a download the page already
// works hard to make once (see search.js). The reader only ever wants the steps
// for a combo they have stopped to look at, so the steps are fetched for that one
// combo, at the moment they ask.
//
// Two sources could serve them, and the choice is deliberately not made here:
//
//   1. Commander Spellbook's per-variant endpoint. One request, always current,
//      nothing for us to publish. Blocked if their CORS allowlist refuses this
//      origin, which is the same restriction that made this project publish data
//      instead of querying it — so the likely answer is no. Needs a connect-src
//      entry in both pages' CSP if it turns out to be yes.
//   2. A steps file per bucket of combo ids on our own data branch, written by
//      the nightly refresh. No CORS question — raw.githubusercontent.com is
//      already named in the CSP — at the cost of publishing and sharding data we
//      currently drop on the floor.
//
// Everything above the source is the same either way, so the source is one
// function behind setSource() and the rest of this file does not know which one
// it got. normalize() takes Spellbook's own payload shape, so option 1 needs no
// adapter and option 2 can publish that shape untouched.
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
    // A card's state is recorded per zone — battlefield, graveyard, exile, library —
    // and only the one matching where it has to be is meaningful. They arrive as
    // empty strings rather than absent, so the first non-empty wins.
    const state = String(
      use.battlefieldCardState || use.graveyardCardState || use.exileCardState
      || use.libraryCardState || use.cardState || ''
    ).trim();
    const parts = [where, state].filter(Boolean);

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

  // Kept for the life of the page: a reader who collapses a combo and opens it
  // again should not pay for it twice, and the answer cannot change mid-session.
  // A combo with no steps caches too — as null — so a second press does not
  // re-ask a question already answered.
  const held = new Map();

  let source = null;

  // Where the steps come from. Replaced at load time by whichever of the two
  // options above wins; the default reads the sample below so the prototype
  // works with no network at all.
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
      const raw = await (source ? source(key) : Promise.resolve(SAMPLE[key] || null));
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

  // ---- sample data ---------------------------------------------------------
  //
  // Two combos from test/fixtures/deck.txt, in Spellbook's own payload shape so
  // normalize() is exercised rather than bypassed. Written by hand off the cards.
  // Everything here is placeholder text for judging the layout — the real panel
  // will show Spellbook's own wording, which is authoritative and this is not.
  const SAMPLE = {
    // Spike Feeder + Archangel of Thune — and this one is *not* hand-written. It is
    // exactly what Commander Spellbook sends, read out of the bulk export by
    // tools/peek-variant.js, which is why it reads differently from the two below:
    // shorter, and in their voice rather than mine.
    //
    // Worth keeping as the yardstick. The hand-written version said "remove two
    // counters to gain 2 life" and theirs says one for one — a difference nobody
    // would have caught by reading my prose, and a reminder that this panel is
    // quoting them rather than explaining the cards itself.
    '2290-2919': {
      manaNeeded: '',
      easyPrerequisites: '',
      notablePrerequisites: 'Spike Feeder has at least two +1/+1 counters on it.',
      uses: [
        { card: { name: 'Spike Feeder' }, zoneLocations: ['B'], battlefieldCardState: '' },
        { card: { name: 'Archangel of Thune' }, zoneLocations: ['B'], battlefieldCardState: '' },
      ],
      description: [
        'Remove a +1/+1 counter from Spike Feeder to gain 1 life.',
        'Archangel of Thune triggers, putting a +1/+1 counter on each creature you control, including Spike Feeder.',
        'Repeat for infinite life and infinite +1/+1 counters on all creatures you control, other than Spike Feeder.',
      ].join('\n'),
    },
    // Rosie Cotton of South Lane + Scurry Oak
    '2433-4186': {
      manaNeeded: '',
      easyPrerequisites: 'You need a way to put the first +1/+1 counter on Scurry Oak, or another creature entering to start the loop.',
      uses: [
        { card: { name: 'Rosie Cotton of South Lane' }, zoneLocations: ['B'] },
        { card: { name: 'Scurry Oak' }, zoneLocations: ['B'] },
      ],
      description: [
        'Put a +1/+1 counter on Scurry Oak. It triggers and creates a 1/1 green Squirrel token.',
        'The Squirrel entering triggers Rosie Cotton of South Lane, which puts a +1/+1 counter on target creature you control — choose Scurry Oak.',
        'Scurry Oak triggers again. Repeat for as many Squirrels as you want.',
      ].join('\n'),
    },
    // Scurry Oak + Sadistic Glee + Carrion Feeder. Here because two unofficial
    // rows cite it, so it is what exercises the caveat: the steps below name
    // Sadistic Glee and Carrion Feeder, and a reader looking at the unofficial
    // row is holding Necrosynthesis and Hammerhead instead.
    '2082-2438-4186': {
      manaNeeded: '',
      easyPrerequisites: 'Sadistic Glee has to be attached to Scurry Oak, and you need one creature to sacrifice to get started.',
      uses: [
        { card: { name: 'Scurry Oak' }, zoneLocations: ['B'], battlefieldCardState: 'enchanted by Sadistic Glee' },
        { card: { name: 'Sadistic Glee' }, zoneLocations: ['B'] },
        { card: { name: 'Carrion Feeder' }, zoneLocations: ['B'] },
      ],
      description: [
        'Sacrifice a creature to Carrion Feeder.',
        'The creature dying triggers Sadistic Glee, which puts a +1/+1 counter on Scurry Oak.',
        'Scurry Oak triggers on the counter and creates a 1/1 green Squirrel token.',
        'Sacrifice the Squirrel to Carrion Feeder and repeat from step two.',
      ].join('\n'),
    },
  };

  const api = {
    get,
    normalize,
    describeUse,
    setSource,
    // Test support: the cache is deliberately never invalidated in a session.
    reset() {
      held.clear();
      source = null;
    },
    SAMPLE,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.ComboSteps = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
