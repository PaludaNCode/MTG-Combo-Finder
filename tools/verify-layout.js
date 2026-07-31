#!/usr/bin/env node
// Layout smoke test: render the real page at phone, tablet and desktop widths,
// then assert the things that silently break — horizontal overflow, collapsed
// sections that don't collapse, and the desktop two-column split.
//
// Zero dependencies, so it drives a headless browser directly and has the page
// report its own verdict, rather than pulling in Playwright.
//
// The verdict comes back as a POST to this process's own server, and the browser
// runs on the real clock. It used to run under --virtual-time-budget --dump-dom,
// which is neater — one command, DOM on stdout — and cannot work here: with a
// virtual clock, `caches.open()` and a Worker's `fetch` both return promises
// that never settle, so Chrome waits for a page that can never finish and
// prints nothing at all. Both are now on the path a search takes, so the clock
// has to be real. (Measured: the same page reports in ~450ms in real time.)
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
// Async, not execFileSync: this process is also the web server the browser
// talks to, and a synchronous child would block the event loop so those
// requests were never answered — including the one carrying the verdict.
const { execFile } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml',
};

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, deck: 'marked' },
  { name: 'tablet', width: 768, height: 1024, deck: 'marked' },
  { name: 'desktop', width: 1440, height: 900, deck: 'marked' },
  // A real PC. The shell was capped at 1140px at every size, so this left 780px
  // of the screen empty while combo names wrapped inside a 714px column — the
  // widest viewport the test ran was 1440, where it is much less obvious.
  { name: 'wide desktop', width: 1920, height: 1200, deck: 'marked' },
  // Same deck with the commander marker taken off. Nothing about the output
  // should change: colours are read off the cards either way.
  { name: 'desktop (no marker)', width: 1440, height: 900, deck: 'plain' },
  // And once with Worker taken away from the page, which is the fallback path in
  // app.js — searching in the window instead of beside it. Same output, or the
  // fallback is a branch nobody has ever run.
  { name: 'desktop (no worker)', width: 1440, height: 900, deck: 'marked', noWorker: true },
  // Not a layout check: the share link's own round trip. Its encoding is ours,
  // so nothing about it can be taken on trust.
  { name: 'share link', width: 1440, height: 900, kind: 'share' },
  // Nor is this one. The deploy stamps ?v=<sha> onto every asset URL in the
  // HTML; the worker and the three files it imports are loaded from JS, where
  // that rewrite cannot reach, so they take the stamp from their own URLs. If
  // that ever breaks, the worker dies on a 404, the page quietly falls back, and
  // production looks fine while running half-stale JS. Hence asserting that the
  // search still went through the *worker* on a stamped page.
  { name: 'desktop (asset-stamped)', width: 1440, height: 900, deck: 'marked', kind: 'stamped' },
];

function findBrowser() {
  const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const pw = '/opt/pw-browsers';
  if (fs.existsSync(pw)) {
    for (const dir of fs.readdirSync(pw)) {
      candidates.push(path.join(pw, dir, 'chrome-linux', 'headless_shell'));
      candidates.push(path.join(pw, dir, 'chrome-linux', 'chrome'));
    }
  }
  return candidates.find((c) => c && fs.existsSync(c)) || null;
}

// A deck that produces every section: complete combos, on-colour suggestions
// and off-colour ones. Kept here so the test doesn't depend on published data.
const FIXTURE = {
  updatedAt: '2026-01-01T00:00:00Z',
  cardIdentity: {
    'Kinnan, Bonder Prodigy': 'GU', 'Basalt Monolith': '', 'Rings of Brighthearth': '',
    'Palinchron': 'U', 'Deadeye Navigator': 'U', 'Great Whale': 'U',
    'Walking Ballista': '', 'Heliod, Sun-Crowned': 'W', 'Island': 'U',
    'Sword of the Meek': '', 'Bloom Tender': 'G', 'Devoted Druid': 'G',
    'Murderous Redcap': 'BR',
  },
  commanderNames: ['Kinnan, Bonder Prodigy', 'Heliod, Sun-Crowned'],
  // Wizards' Game Changer list, as the fetcher publishes it. Which real cards are
  // on it is not this test's business — it comes from Scryfall's own flag — so
  // these are the fixture's own cards, chosen to make the page say something:
  // two are in the deck (floor 3), and Bloom Tender is not, so a list of three
  // must still report two.
  gameChangers: ['Bloom Tender', 'Palinchron', 'Rings of Brighthearth'],
  // A combo slot that names a property rather than a card, and the deck's
  // Walking Ballista filling it. The rendered row has to say so — a combo that
  // appears because of a slot but cannot show which card filled it reads as
  // invented, which is the whole risk this feature carries.
  templates: { 42: 'Creature with a Free Sacrifice Ability', 55: 'Persist Creature' },
  // 84 is a template Spellbook publishes no Scryfall query for, so it has a name
  // and can never have a card list — the "one slot away, and nothing to offer
  // for it" case.
  unresolvable: { 84: 'Haste Enabler' },
  templateCards: {
    'walking ballista': [42], 'devoted druid': [42],
    // Neither is in the deck, so both are candidates for the slot combo 13 is
    // short of. Bloom Tender is green, which the deck is; Murderous Redcap is
    // not, and must be counted but not named.
    'bloom tender': [55], 'murderous redcap': [55],
  },
  combos: [
    { id: '1', c: ['Kinnan, Bonder Prodigy', 'Basalt Monolith'],
      p: ['Infinite ETB', 'Win the game', 'Infinite lifegain', 'Infinite colorless mana', 'Infinite LTB',
          'Infinite death triggers', 'Infinite storm count', 'Infinite sacrifice triggers',
          'Infinite creature tokens', 'Lock'],
      i: 'GU', pop: 999 },
    { id: '2', c: ['Basalt Monolith', 'Rings of Brighthearth'], p: ['Infinite colorless mana'], i: 'C', pop: 90 },
    { id: '6', c: ['Basalt Monolith', 'Kinnan, Bonder Prodigy', 'Walking Ballista'], p: ['Infinite damage'], i: 'GU', pop: 10 },
    { id: '3', c: ['Palinchron', 'Deadeye Navigator'], p: ['Infinite mana'], i: 'U' },
    { id: '4', c: ['Great Whale', 'Deadeye Navigator'], p: ['Infinite mana'], i: 'U' },
    // A third combo Deadeye Navigator would unlock, needing one more card than
    // the two above. Without a suggestion whose combos differ in size, the
    // per-card breakdown renders one pill and proves nothing.
    { id: '14', c: ['Palinchron', 'Deadeye Navigator', 'Basalt Monolith'], p: ['Infinite mana'], i: 'U' },
    // Interchangeable with combo 2: same partner, same result, one card swapped.
    // Both are already in the deck, so they must collapse into one row.
    { id: '8', c: ['Basalt Monolith', 'Sword of the Meek'], p: ['Infinite colorless mana'], i: 'C', pop: 80 },
    // And two more that only differ in the card you'd have to add, so the
    // suggestion for them has to read as one choice, not two recommendations.
    { id: '9', c: ['Walking Ballista', 'Bloom Tender'], p: ['Infinite damage'], i: 'G' },
    { id: '10', c: ['Walking Ballista', 'Devoted Druid'], p: ['Infinite damage'], i: 'G' },
    { id: '5', c: ['Walking Ballista', 'Heliod, Sun-Crowned'], p: ['Infinite damage'], i: 'W' },
    // Complete only because the deck fills the slot.
    { id: '11', c: ['Rings of Brighthearth'], t: [42], p: ['Infinite damage'], i: 'C', pop: 70 },
    // Every named card present, one slot short. Not a combo the deck can pull
    // off, so it must not be listed with those — and not a combo to say nothing
    // about either, so it belongs in "One slot away" with the slot named and
    // the cards that fill it offered. Bloom Tender is one; Murderous Redcap
    // fills it too but is off-colour, so it is counted and not named.
    { id: '13', c: ['Basalt Monolith'], t: [55], p: ['Infinite damage'], i: 'G', pop: 60 },
    // Short of a slot Spellbook publishes no query for: nameable, never
    // fillable, so the row has to admit there is nothing to offer.
    { id: '12', c: ['Rings of Brighthearth'], t: [84], p: ['Infinite damage'], i: 'C', pop: 71 },
    // Big and popular, and every card in the deck. Under the old popularity-only
    // sort this came second; it now has to come last, after every smaller combo.
    // Without it the fixture's biggest combo is also its least played, and the
    // ordering would pass whichever rule were in force.
    { id: '15', c: ['Palinchron', 'Basalt Monolith', 'Great Whale', 'Kinnan, Bonder Prodigy'],
      p: ['Infinite mana'], i: 'GU', pop: 500 },
  ],
};

// Written the way Moxfield exports it, commander marked inline and nothing
// typed into the commander box — the path most people actually take.
const REST = [
  '1 Basalt Monolith', '1 Rings of Brighthearth', '1 Palinchron',
  '1 Great Whale', '1 Walking Ballista', '1 Sword of the Meek', '10 Island',
];
// tiers.html is checked against data carrying a result result-tiers.js does not
// list — the "Spellbook shipped a new set" case. Catching that is the entire
// reason the page is in the repository, so it is worth a test rather than trust.
const UNKNOWN_RESULT = 'Infinite eldrazi spawn from the Blind Eternities';
const TIERS_FIXTURE = {
  updatedAt: '2026-01-01T00:00:00Z',
  count: 3,
  combos: [
    { id: 't1', c: ['Kinnan, Bonder Prodigy', 'Basalt Monolith'], p: ['Win the game', 'Infinite colorless mana', 'Infinite ETB'], i: 'GU' },
    { id: 't2', c: ['A', 'B'], p: ['Infinite lifegain', 'Infinite LTB'], i: 'C' },
    { id: 't3', c: ['A', 'C'], p: [UNKNOWN_RESULT], i: 'C' },
  ],
};

const DECKS = {
  marked: ['1 Kinnan, Bonder Prodigy (C21) 3 *CMDR*'].concat(REST).join('\n'),
  plain: ['1 Kinnan, Bonder Prodigy'].concat(REST).join('\n'),
};

// The page under test is loaded inside an iframe sized to each viewport.
// Media queries evaluate against the iframe's own width, so the result no
// longer depends on whether the browser binary honours --window-size — the
// full chrome build silently clamps to 500px, which made a "390px" run a lie.
const HARNESS = `<!DOCTYPE html><meta charset="utf-8"><body style="margin:0">
<pre id="verdict"></pre>
<script>
const WIDTHS = ${JSON.stringify(VIEWPORTS)};
const DECKS = ${JSON.stringify(DECKS)};
const results = [];

function measure(win, doc) {
  const panels = [...doc.querySelectorAll('.panel')].map((p) => ({
    title: p.querySelector('.panel-title').textContent,
    count: (p.querySelector('.panel-count') || {}).textContent || null,
    bodyVisible: p.querySelector('.panel-body').offsetHeight > 0,
    headHeight: p.querySelector('.panel-head').offsetHeight,
  }));
  const piecesPanel = [...doc.querySelectorAll('.panel')].find((x) => /carrying/i.test(x.querySelector('.panel-title').textContent));
  const topPiece = piecesPanel ? {
    card: piecesPanel.querySelector('.card-name').textContent,
    badge: piecesPanel.querySelector('.badge').textContent,
  } : null;
  // Every "+4 combos" / "in 4 combos" pill sits directly after a card name in
  // the same line, so the space before it has to survive every breakpoint — it
  // was being dropped at narrow widths, exactly where the two are tightest.
  const badges = [...doc.querySelectorAll('.badge')].map((b) => ({
    text: b.textContent,
    spoken: b.getAttribute('aria-label') || '',
    gap: parseFloat(win.getComputedStyle(b).marginLeft) || 0,
    wraps: win.getComputedStyle(b).whiteSpace,
  }));
  const tabs = [...doc.querySelectorAll('.tabs .tab')].map((t) => ({
    label: t.querySelector('.tab-label').textContent,
    count: t.querySelector('.tab-count').textContent,
    active: t.classList.contains('is-active'),
    selected: t.getAttribute('aria-selected'),
    paneVisible: !doc.getElementById(t.getAttribute('aria-controls')).hidden,
    height: t.offsetHeight,
  }));
  // The per-card breakdown of what each suggestion's count is made of. The pills
  // on a row must add up to that row's own badge — that is the whole reason it
  // is reported per card rather than per panel.
  const sizes = [...doc.querySelectorAll('.tab-pane:not([hidden]) .combo.suggestion')].map((row) => ({
    badge: (row.querySelector('.badge') || {}).textContent || '',
    label: (row.querySelector('.sizes-label') || {}).textContent || '',
    inHeader: Boolean(row.querySelector('h3 .sizes')),
    pills: [...row.querySelectorAll('.sizes .size')].map((p) => p.textContent),
    easiest: [...row.querySelectorAll('.sizes .size.is-easiest')].map((p) => p.textContent),
    colour: row.querySelector('.sizes .size') ? win.getComputedStyle(row.querySelector('.sizes .size')).color : null,
  }));
  const grouped = {
    // A combo row offering a choice of part, and a suggestion offering a choice
    // of card. Both exist in the fixture, so both must render.
    eitherRows: [...doc.querySelectorAll('#included .either')].map((e) => e.textContent),
    choiceRows: doc.querySelectorAll('#included .choices').length,
    altGroups: [...doc.querySelectorAll('.alternatives .alt-label')].map((e) => e.textContent),
    altNames: doc.querySelectorAll('.alternatives .alt-list .card-name').length,
  };
  const slots = {
    labels: [...doc.querySelectorAll('#included .slot')].map((e) => e.textContent),
    credited: [...doc.querySelectorAll('#included .fills')].map((e) => e.textContent),
    comboIds: [...doc.querySelectorAll('#included .combo-link a')].map((a) => a.getAttribute('href')),
  };
  // The combos held up by a slot the deck cannot fill: reported, apart from the
  // ones it can assemble, and never counted among them.
  // "Combos in your deck" leads with the easiest: 2-card rows, then 3, then 4.
  // Card names inside a row are alphabetical, so two rows can be compared.
  // Scoped to the row's own heading: a collapsed row keeps every version inside a
  // <details>, each with a heading of its own, and a document-wide query pulls
  // those in too — which reads as one row naming five cards.
  const order = [...doc.querySelectorAll('#included .panel-body > .combo')].map((row) => {
    const head = row.querySelector(':scope > h3');
    const names = [...head.querySelectorAll(':scope > .card-name')].map((n) => n.textContent);
    const slots = head.querySelectorAll(':scope > .slot').length;
    const choices = head.querySelector(':scope > .either') ? 1 : 0; // "any of N" stands in for one card
    return { names, size: names.length + slots + choices, label: names.join(' + ') };
  });
  const stuck = {
    rows: doc.querySelectorAll('#slots .combo').length,
    missing: [...doc.querySelectorAll('#slots .slot-missing')].map((e) => e.textContent),
    needs: [...doc.querySelectorAll('#slots .gap')].map((e) => e.textContent),
    candidates: [...doc.querySelectorAll('#slots .candidates .card-name')].map((e) => e.textContent),
    comboIds: [...doc.querySelectorAll('#slots .combo-link a')].map((a) => a.getAttribute('href')),
  };
  // Combos listed *under* a card have to start with that card. Read from the
  // closed <details> — the rows are in the DOM whether or not it is open.
  const nested = (scope, cardSelector) => [...doc.querySelectorAll(scope)].slice(0, 3).map((row) => {
    const focal = (row.querySelector(cardSelector) || {}).textContent || '';
    const combos = [...row.querySelectorAll('details > .combo > h3')].map((h) => (
      [...h.querySelectorAll(':scope > .card-name')].map((n) => n.textContent)
    ));
    return { focal, combos };
  });
  const leads = {
    suggestions: nested('.tab-pane:not([hidden]) .combo.suggestion', 'h3 > .card-name'),
    pieces: nested('#pieces .combo.suggestion', '.sug-head > .card-name'),
  };

  // The bracket check. Two of Wizards' criteria are readable off a card list and
  // the rest are not, so the panel has to state the floor *and* what it did not
  // look at — a bracket number on its own would be read as the whole answer.
  const bracket = {
    floor: (doc.querySelector('#bracket .bracket-floor') || {}).textContent || '',
    why: (doc.querySelector('#bracket .bracket-why') || {}).textContent || '',
    changers: [...doc.querySelectorAll('#bracket .gc-list .card-name')].map((e) => e.textContent),
    twoCardCombos: doc.querySelectorAll('#bracket details > .combo').length,
    caveat: (doc.querySelector('#bracket .bracket-note') || {}).textContent || '',
    // The caveat must not be foldable: hidden behind a control it may as well not
    // be written.
    caveatFolded: Boolean(doc.querySelector('#bracket details .bracket-note')),
  };

  const ageEl = doc.getElementById('data-age');
  const dataAge = {
    hidden: ageEl ? ageEl.hidden : null,
    text: ageEl ? ageEl.textContent : '',
    source: ageEl ? ageEl.dataset.source : null,
    // Which path served the search. The worker and the in-page fallback produce
    // the same output on purpose, so without this the fallback run proves only
    // that *something* answered — not that the fallback was the thing that did.
    via: ageEl ? ageEl.dataset.via : null,
  };

  // The combo count must count combos, not rows. Collapsing interchangeable
  // versions into one row is a readability choice; it must not quietly shrink
  // the number the panel reports.
  const includedPanel = panels.find((p) => /Combos in your deck/.test(p.title));
  const included = {
    badge: includedPanel ? includedPanel.count : null,
    rows: doc.querySelectorAll('#included .panel-body > .combo').length,
    versions: [...doc.querySelectorAll('#included .panel-body > .combo')]
      .reduce((n, row) => n + Math.max(1, row.querySelectorAll('details .combo').length), 0),
  };

  const firstCombo = doc.querySelector('.combo');
  const chips = firstCombo ? [...firstCombo.querySelectorAll('.results .result')].map((c) => ({
    text: c.textContent, win: c.classList.contains('tier-win'),
    decisive: c.classList.contains('tier-decisive'),
    grey: c.classList.contains('tier-other'), more: c.classList.contains('more'),
    title: c.title || '', colour: win.getComputedStyle(c).color,
  })) : [];
  const header = {
    pips: [...doc.querySelectorAll('.identity-line .pip')].map((p) => ({
      letter: p.textContent,
      label: p.getAttribute('aria-label'),
      background: win.getComputedStyle(p).backgroundColor,
      round: win.getComputedStyle(p).borderRadius,
      size: Math.round(p.offsetWidth),
    })),
    // Colours come from the cards now, so nothing about a commander should be
    // rendered at all — no line, no shortlist of maybes to pick from.
    commanderLines: doc.querySelectorAll('.commander-line').length,
    pickers: doc.querySelectorAll('.pick-commander').length,
  };

  const form = doc.querySelector('.col-input').getBoundingClientRect();
  const out = doc.querySelector('.col-output').getBoundingClientRect();
  const shell = doc.body.getBoundingClientRect();
  return {
    header,
    grouped,
    slots,
    stuck,
    order,
    leads,
    bracket,
    dataAge,
    badges,
    sizes,
    included,
    width: win.innerWidth,
    overflow: doc.documentElement.scrollWidth - doc.documentElement.clientWidth,
    panels,
    topPiece,
    tabs,
    sideBySide: out.left >= form.right - 1,
    shellWidth: Math.round(shell.width),
    unusedWidth: Math.round(win.innerWidth - shell.width),
    formWidth: Math.round(form.width),
    outWidth: Math.round(out.width),
    chips,
  };
}

// Load the page and hand back its window, so a check can drive it.
function load(src, width) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'border:0;display:block;width:' + (width || 1440) + 'px;height:900px';
    frame.src = src;
    frame.onload = () => resolve({ win: frame.contentWindow, doc: frame.contentDocument });
    document.body.appendChild(frame);
  });
}

// The share link, end to end: a deck typed in, kept without a search, put into
// the URL by Copy link, and read back out of that URL by a page that has never
// seen it. Every step of that is our own encoding, so none of it is safe to
// assume — a link that silently loses the deck is worse than no link at all.
async function runShare(vp) {
  const out = { ok: true, name: vp.name, requested: vp.width, share: {} };
  try {
    const first = await load('/index.html', vp.width);
    first.win.localStorage.clear();
    const typed = DECKS.plain;
    first.doc.getElementById('decklist').value = typed;
    first.doc.getElementById('decklist').dispatchEvent(new first.win.Event('input'));
    // Typing is kept on a debounce, so this also asserts that a deck survives a
    // reload without ever pressing Find combos.
    await new Promise((r) => setTimeout(r, 600));
    out.share.storedWithoutSearching = first.win.localStorage.getItem('mtg-combo-finder.deck');

    first.doc.getElementById('copy-link').click();
    await new Promise((r) => setTimeout(r, 60));
    // The clipboard is not available to a headless browser and must not be what
    // this depends on: Copy link puts the URL in the address bar either way.
    out.share.search = first.win.location.search;
    out.share.buttonText = first.doc.getElementById('copy-link').textContent;

    // Put a *different* deck in storage before opening the link. Otherwise both
    // sources hold the same text and the check cannot tell which one was read —
    // and a link is documented to beat the stored list, because someone opening
    // a shared deck means to see theirs, not the one they were last working on.
    first.win.localStorage.setItem('mtg-combo-finder.deck', JSON.stringify({
      decklist: '1 Island', commanders: '',
    }));
    const shared = await load('/index.html' + out.share.search, vp.width);
    out.share.restored = shared.doc.getElementById('decklist').value;
    out.share.typed = typed;
    out.share.status = shared.doc.getElementById('status').textContent;

    // A truncated or mangled link has to say so rather than silently open empty.
    const broken = await load('/index.html?deck=%%%not-base64%%%', vp.width);
    out.share.brokenStatus = broken.doc.getElementById('status').textContent;
    out.share.brokenIsError = broken.doc.getElementById('status').classList.contains('error');
  } catch (err) {
    return { ok: false, name: vp.name, error: String((err && err.stack) || err) };
  }
  return out;
}

// A search on a page whose asset URLs all carry ?v=, the way the deploy serves
// them. All that matters is that it still ran in the worker: importScripts on a
// stamped URL either resolves or 404s, and a 404 shows up as the fallback.
async function runStamped(vp) {
  try {
    const { win, doc } = await load('/stamped/index.html', vp.width);
    win.localStorage.clear();
    doc.getElementById('decklist').value = DECKS[vp.deck];
    doc.getElementById('deck-form').dispatchEvent(new win.Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 700));
    const age = doc.getElementById('data-age');
    return {
      ok: true,
      name: vp.name,
      requested: vp.width,
      stamped: {
        via: age ? age.dataset.via : null,
        panels: doc.querySelectorAll('.panel').length,
        stuckRows: doc.querySelectorAll('#slots .combo').length,
        scripts: [...doc.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')),
      },
    };
  } catch (err) {
    return { ok: false, name: vp.name, error: String((err && err.stack) || err) };
  }
}

function runOne(vp) {
  if (vp.kind === 'share') return runShare(vp);
  if (vp.kind === 'stamped') return runStamped(vp);
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'border:0;display:block;width:' + vp.width + 'px;height:' + vp.height + 'px';
    frame.src = '/index.html';
    frame.onload = async () => {
      try {
        const win = frame.contentWindow;
        const doc = frame.contentDocument;
        win.localStorage.clear();
        // app.js reads Worker lazily, at the first search, so taking it away
        // after load is enough to send it down the in-page path.
        if (vp.noWorker) delete win.Worker;
        doc.getElementById('commanders').value = '';
        doc.getElementById('decklist').value = DECKS[vp.deck];
        doc.getElementById('deck-form').dispatchEvent(new win.Event('submit', { cancelable: true }));
        await new Promise((r) => setTimeout(r, 500));

        const before = measure(win, doc);

        // Tier ordering pushes the grey plumbing behind "+N more", so the fold
        // has to be opened before all three colours are on screen at once.
        // Scope to the same combo card throughout: the pieces panel re-renders
        // these, so a document-wide query picks up other cards' unopened folds.
        const combo0 = doc.querySelector('.combo');
        const moreBtn = combo0.querySelector('.results .result.more');
        if (moreBtn) moreBtn.click();
        await new Promise((r) => setTimeout(r, 60));
        const expandedChips = [...combo0.querySelectorAll('.results .result')].map((c) => ({
          text: c.textContent,
          win: c.classList.contains('tier-win'),
          decisive: c.classList.contains('tier-decisive'),
          grey: c.classList.contains('tier-other'),
          more: c.classList.contains('more'),
          colour: win.getComputedStyle(c).color,
        }));

        // Collapse the first section and confirm the body actually goes away.
        const first = doc.querySelector('.panel');
        first.querySelector('.panel-head').click();
        await new Promise((r) => setTimeout(r, 80));
        const afterCollapse = {
          expanded: first.querySelector('.panel-head').getAttribute('aria-expanded'),
          bodyVisible: first.querySelector('.panel-body').offsetHeight > 0,
          stored: win.localStorage.getItem('mtg-combo-finder.collapsed'),
        };
        first.querySelector('.panel-head').click();

        // Taking a suggestion. Every step of this is ours — appending the line,
        // keeping the list, and re-submitting the form — and the only proof that
        // it worked is that the deck now holds combos it did not hold before. A
        // button that appends the card and forgets to search again looks fine.
        const addBtn = doc.querySelector('.tab-pane:not([hidden]) .combo.suggestion .add-card');
        const addRow = addBtn ? addBtn.closest('.combo.suggestion') : null;
        const afterAdd = {
          present: Boolean(addBtn),
          spoken: addBtn ? addBtn.getAttribute('aria-label') : '',
          card: addRow ? addRow.querySelector('h3 .card-name').textContent : '',
          combosBefore: before.included.badge,
        };
        if (addBtn) {
          addBtn.click();
          await new Promise((r) => setTimeout(r, 600));
          const now = measure(win, doc);
          // The escape is doubled because this whole harness is a template literal
          // in tools/verify-layout.js: a lone \\n would become a real newline here
          // and break the string it sits in.
          afterAdd.lastLine = doc.getElementById('decklist').value.trim().split('\\n').pop();
          afterAdd.status = doc.getElementById('status').textContent;
          afterAdd.combosAfter = now.included.badge;
          afterAdd.suggestionsAfter = now.tabs.length ? now.tabs[0].count : null;
          // Kept immediately rather than on the typing debounce: the search that
          // follows must not be able to outrun the save.
          const kept = win.localStorage.getItem('mtg-combo-finder.deck');
          afterAdd.kept = kept ? JSON.parse(kept).decklist : '';
        }

        // The decklist is kept between visits, so a search has to have stored
        // it — and Clear has to actually empty it, list and copy both.
        const storedDeck = win.localStorage.getItem('mtg-combo-finder.deck');
        doc.getElementById('clear-deck').click();
        await new Promise((r) => setTimeout(r, 40));
        const afterClear = {
          decklist: doc.getElementById('decklist').value,
          commanders: doc.getElementById('commanders').value,
          stored: win.localStorage.getItem('mtg-combo-finder.deck'),
          resultsHidden: doc.getElementById('results').hidden,
        };

        resolve(Object.assign({ ok: true, name: vp.name, requested: vp.width }, before,
          { afterCollapse, expandedChips, afterAdd, storedDeck, afterClear }));
      } catch (err) {
        resolve({ ok: false, name: vp.name, error: String((err && err.stack) || err) });
      }
    };
    document.body.appendChild(frame);
  });
}

(async () => {
  for (const vp of WIDTHS) results.push(await runOne(vp));
  report(results);
})();
</script>`;

// tiers.html loads combos.json from the same origin, so it is served the
// fixture above under a path of its own and pointed at it by the harness.
const TIERS_HARNESS = `<!DOCTYPE html><meta charset="utf-8"><body style="margin:0">
<pre id="verdict"></pre>
<script>
const WIDTHS = ${JSON.stringify([{ name: 'tiers phone', width: 390 }, { name: 'tiers desktop', width: 1440 }])};
const results = [];
function runOne(vp) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'border:0;display:block;width:' + vp.width + 'px;height:1200px';
    frame.src = '/tiers.html';
    frame.onload = () => setTimeout(() => {
      try {
        const win = frame.contentWindow, doc = frame.contentDocument;
        const box = doc.getElementById('unclassified');
        const out = {
          ok: true, name: vp.name, requested: vp.width, width: win.innerWidth,
          overflow: doc.documentElement.scrollWidth - doc.documentElement.clientWidth,
          sections: [...doc.querySelectorAll('.tier h2')].map((h) => h.textContent),
          chipCounts: [...doc.querySelectorAll('.chip .n')].map((n) => n.textContent),
          chipHeight: (doc.querySelector('.chip') || {}).offsetHeight,
          rows: doc.querySelectorAll('.tier ol.rows > li').length,
          flagged: !box.hidden,
          flagText: box.hidden ? '' : box.querySelector('h2').textContent,
          snippet: box.hidden ? '' : (box.querySelector('.snippet') || {}).textContent,
          stripeColour: box.hidden ? '' : win.getComputedStyle(box.querySelector('.stripe')).backgroundColor,
        };
        doc.getElementById('q').value = 'lifegain';
        doc.getElementById('q').dispatchEvent(new win.Event('input'));
        setTimeout(() => {
          out.searchRows = doc.querySelectorAll('.tier ol.rows > li').length;
          doc.querySelector('.chip').click();
          setTimeout(() => {
            out.sectionsAfterToggle = doc.querySelectorAll('.tier').length;
            resolve(out);
          }, 60);
        }, 80);
      } catch (err) {
        resolve({ ok: false, name: vp.name, error: String((err && err.stack) || err) });
      }
    }, 700);
    document.body.appendChild(frame);
  });
}
(async () => {
  for (const vp of WIDTHS) results.push(await runOne(vp));
  report(results);
})();
</script>`;

// Both harnesses report the same way: whatever they measured, posted back to the
// process that launched the browser. Also written into the page, so opening the
// harness URL by hand still shows the verdict.
const REPORTER = `<script>
function report(results) {
  const body = JSON.stringify(results);
  document.getElementById('verdict').textContent = body;
  fetch('/_verdict', { method: 'POST', body: body });
}
</script>`;

// index.html with ?v= on every asset URL, the same rewrite .github/workflows/
// deploy.yml performs. Asserting the count here too, so this cannot silently
// stamp nothing and pass.
const STAMP = '?v=layout-test';

// Served under /stamped/, where the server refuses any .js or .css without the
// stamp. That is what makes the check real: unstamped URLs resolve fine on a
// normal static host, so a lost stamp is invisible — the file still loads, it
// just comes from whatever the CDN cached. Refusing them turns "the stamp was
// dropped" into "the worker 404s and the page falls back", which the `via`
// assertion already catches.
function stampedIndex() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const stamped = html.replace(/(src|href)="([\w-]+\.(?:js|css))"/g, `$1="/stamped/$2${STAMP}"`);
  const n = stamped.split(STAMP).length - 1;
  if (n < 6) {
    console.error(`stampedIndex() stamped ${n} asset URLs, expected at least 6 — the fixture is not testing what it claims.`);
    process.exit(1);
  }
  return stamped;
}

// Every URL the browser asked for, query string included. The server strips the
// query to find the file — as any static host does — so this is the only place
// that can see whether the stamp was actually carried, rather than whether the
// file happened to load. A missing stamp is invisible otherwise: unstamped URLs
// resolve perfectly well, they just serve whatever the CDN cached last.
const REQUESTS = [];

function serve(dir, extra, onVerdict) {
  return http.createServer((req, res) => {
    REQUESTS.push(req.url);
    let url = req.url.split('?')[0];

    // The stamped-assets sandbox. Code must arrive with the stamp on it; data
    // (combos.json) is fetched from a URL the deploy never rewrites, so it is
    // exempt — as it is in production, where it comes off another host entirely.
    if (url.startsWith('/stamped/') && url !== '/stamped/index.html') {
      if (/\.(?:js|css)$/.test(url) && !req.url.includes(STAMP)) {
        res.statusCode = 404;
        return res.end('unstamped asset refused');
      }
      url = url.slice('/stamped'.length);
    }
    if (req.method === 'POST' && url === '/_verdict') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        res.end('ok');
        onVerdict(body);
      });
      return undefined;
    }
    if (extra[url]) {
      res.setHeader('Content-Type', extra[url].type);
      return res.end(extra[url].body);
    }
    const file = path.join(dir, url === '/' ? 'index.html' : url);
    try {
      res.setHeader('Content-Type', MIME[path.extname(file)] || 'text/plain');
      res.end(fs.readFileSync(file));
    } catch (err) {
      res.statusCode = 404;
      res.end('not found');
    }
  });
}

// The same comparison key the page uses: a decklist writes "Valki, God of Lies"
// where Spellbook writes both faces.
const DeckCombos_nameKey = (name) => String(name || '').split('/')[0].trim().toLowerCase();

(async () => {
  const browser = findBrowser();
  if (!browser) {
    console.error('NO BROWSER FOUND — layout not verified.');
    console.error('Set CHROME_PATH, or install Chromium, then re-run.');
    process.exit(2); // distinct from a real failure
  }

  // Each page gets its own server and its own fixture: tiers.html is checked
  // against data containing a result the inventory has never seen, which would
  // be wrong for the deck page.
  async function collect(fixture, harness, label) {
    let deliver;
    const posted = new Promise((resolve) => { deliver = resolve; });
    const server = serve(ROOT, {
      '/combos.json': { type: 'application/json', body: JSON.stringify(fixture) },
      '/_page.html': { type: 'text/html', body: harness + REPORTER },
      // index.html as the deploy publishes it: every asset URL stamped. The
      // query is stripped when the file is served, so this only exercises the
      // URLs the page and the worker build, which is the point.
      '/stamped/index.html': { type: 'text/html', body: stampedIndex() },
    }, deliver);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;

    // Nothing tells the browser to quit — it is a browser — so it is killed once
    // the verdict is in, or once it is clear one is not coming.
    const child = execFile(browser, [
      '--headless', '--disable-gpu', '--no-sandbox',
      '--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage',
      '--window-size=1600,1200',
      `http://127.0.0.1:${port}/_page.html`,
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, () => {});

    let timer;
    const body = await Promise.race([
      posted,
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), 120000); }),
    ]).finally(() => {
      clearTimeout(timer);
      child.kill();
      server.close();
    });

    if (!body || !body.trim()) {
      console.error(`${label} produced no verdict — it probably threw before reporting.`);
      process.exit(1);
    }
    return JSON.parse(body);
  }

  const verdicts = await collect(FIXTURE, HARNESS, 'The deck page');

  let failed = false;
  for (const v of verdicts) {
    const vp = VIEWPORTS.find((x) => x.name === v.name) || { width: v.requested };
    if (!v.ok) {
      console.error(`FAIL ${v.name} — ${v.error}`);
      failed = true;
      continue;
    }

    // The stamped run is about asset URLs, not layout: what matters is that the
    // worker still loaded when every URL carried a query string.
    if (v.stamped) {
      const s = v.stamped;
      const wrong = [];
      if (!s.scripts.every((src) => src.includes(STAMP))) {
        wrong.push(`an unstamped script survived: ${s.scripts.filter((x) => !x.includes(STAMP)).join(', ')}`);
      }
      if (s.via !== 'worker') {
        wrong.push(`the search ran in the ${s.via} — a stamped worker or one of its imports did not load`);
      }
      // The stamp has to travel two hops that no sed can reach: app.js building
      // the worker's URL, and the worker building its importScripts URLs. The
      // sandbox already fails the run if either is dropped — this only says
      // which one, since "the search ran in the page" is a symptom, not a cause.
      for (const file of ['search-worker.js', 'result-tiers.js', 'combos.js', 'search.js']) {
        if (!REQUESTS.some((u) => u === `/stamped/${file}${STAMP}`)) {
          wrong.push(`${file} was never requested with the stamp — it would be served from whatever the CDN cached`);
        }
      }
      if (s.panels < 5) wrong.push(`only ${s.panels} panels rendered from a stamped page`);
      if (s.stuckRows < 2) wrong.push(`the one-slot-away rows did not render from a stamped page`);
      if (wrong.length) {
        failed = true;
        console.error(`FAIL ${v.name} — ${wrong.join('; ')}`);
      } else {
        console.log(`ok   ${v.name} — ${s.scripts.length} stamped scripts, searched in the worker, ${s.panels} panels`);
      }
      continue;
    }

    // The share-link run measures a round trip rather than a layout, so it is
    // judged on its own terms.
    if (v.share) {
      const s = v.share;
      const wrong = [];
      if (!s.storedWithoutSearching || !/Kinnan/.test(s.storedWithoutSearching)) {
        wrong.push('a typed deck was not kept without pressing Find combos');
      }
      if (!/[?&]deck=/.test(s.search || '')) wrong.push(`Copy link put "${s.search}" in the address bar`);
      if (s.restored !== s.typed) {
        wrong.push(`the shared link restored ${JSON.stringify(String(s.restored).slice(0, 40))}, not the deck that was shared`);
      }
      if (!/link/i.test(s.status || '')) wrong.push(`a shared deck loaded without saying so: "${s.status}"`);
      if (!s.brokenIsError) wrong.push('a corrupt link did not report an error');
      if (wrong.length) {
        failed = true;
        console.error(`FAIL ${v.name} — ${wrong.join('; ')}`);
      } else {
        const lines = s.typed.split('\n').length;
        console.log(`ok   ${v.name} — ${lines} lines survived typing → localStorage → URL (${s.search.length} chars) → a fresh page; a corrupt link errors`);
      }
      continue;
    }

    const problems = [];
    if (v.overflow > 0) problems.push(`horizontal overflow of ${v.overflow}px`);
    // Bracket check, combos in your deck, one slot away, cards carrying them,
    // suggested additions.
    if (v.panels.length < 5) problems.push(`expected 5 panels, got ${v.panels.length}`);
    if (!v.panels.some((p) => /Bracket check/.test(p.title))) problems.push('the bracket panel did not render');
    if (!v.topPiece) {
      problems.push('the combo-pieces overview did not render');
    } else if (!/in \d+ combos/.test(v.topPiece.badge)) {
      problems.push(`combo-pieces badge reads "${v.topPiece.badge}"`);
    }
    if (!v.badges.length) {
      problems.push('no "+N combos" badges rendered at all, so their spacing is untested');
    } else {
      const flush = v.badges.filter((b) => b.gap < 4);
      if (flush.length) problems.push(`${flush.length} badge(s) sit flush against the card name, e.g. "${flush[0].text}" (${flush[0].gap}px)`);
      const breakable = v.badges.filter((b) => b.wraps !== 'nowrap');
      if (breakable.length) problems.push(`a badge can break across lines: "${breakable[0].text}"`);
      // "+10" alone is terse by request; the word it lost has to reach a screen
      // reader instead of simply going away.
      const terse = v.badges.filter((b) => /^\+\d+$/.test(b.text));
      const unspoken = terse.filter((b) => !/\d+ combos?/.test(b.spoken));
      if (terse.length && unspoken.length) {
        problems.push(`a bare count badge ("${unspoken[0].text}") has no spoken label`);
      }
    }

    // Every suggestion says what its count is made of, and the parts have to
    // agree with the count: "+3 combos" alongside pills totalling 2 is worse
    // than no breakdown at all.
    if (!v.sizes.length) {
      problems.push('no suggestions rendered, so the per-card breakdown is untested');
    } else {
      for (const row of v.sizes) {
        if (!row.pills.length) {
          problems.push(`a suggestion (${row.badge}) shows no combo sizes`);
          continue;
        }
        const claimed = Number((row.badge.match(/\d+/) || [0])[0]);
        const counted = row.pills.reduce((n, text) => {
          const m = text.match(/^(\d+) × (\d+)-card$/);
          return n + (m ? Number(m[1]) : 1); // the single-combo row reads "N-card combo"
        }, 0);
        if (claimed !== counted) {
          problems.push(`"${row.badge}" but its sizes total ${counted} [${row.pills.join(', ')}]`);
        }
        // Only a two-card pill is marked — that is the floor, and a row with
        // nothing that easy should light nothing up.
        const hasTwo = row.pills.some((t) => /(^|\s)2-card$/.test(t));
        if (hasTwo && !row.easiest.length) problems.push(`a two-card combo is not marked on "${row.badge}"`);
        if (!hasTwo && row.easiest.length) problems.push(`"${row.easiest[0]}" is marked as easiest but is not a two-card combo`);
      }
      // The mixed row is the one worth having: several sizes, smallest first.
      const mixed = v.sizes.find((row) => row.pills.length > 1);
      if (!mixed) {
        problems.push('no suggestion unlocks combos of differing sizes, so the breakdown proves nothing');
      } else {
        const first = Number((mixed.pills[0].match(/(\d+)-card/) || [0, 0])[1]);
        const rest = mixed.pills.slice(1).map((t) => Number((t.match(/(\d+)-card/) || [0, 0])[1]));
        if (rest.some((n) => n < first)) problems.push(`sizes are not smallest-first: [${mixed.pills.join(', ')}]`);
        if (mixed.easiest.length && mixed.easiest[0] !== mixed.pills[0]) {
          problems.push('the marked size is not the smallest one');
        }
        // The label was dropped deliberately — it repeated on every row and said
        // nothing the pills and the panel heading did not.
        if (mixed.label) problems.push(`the size breakdown carries a label again: "${mixed.label}"`);
        if (!mixed.inHeader) problems.push('the size pills are not on the same line as the card');
      }
    }

    if (v.tabs.length !== 2) {
      problems.push(`expected 2 suggestion tabs, got ${v.tabs.length}`);
    } else {
      const active = v.tabs.filter((t) => t.active);
      if (active.length !== 1) problems.push(`${active.length} tabs active; exactly one should be`);
      const visible = v.tabs.filter((t) => t.paneVisible);
      if (visible.length !== 1) problems.push(`${visible.length} tab panes visible; exactly one should be`);
      if (v.tabs.some((t) => t.selected !== String(t.active))) problems.push('aria-selected does not match the active tab');
      if (v.tabs.some((t) => t.height < 44)) problems.push('a tab is under 44px tall');
      if (!/in your colours/i.test(v.tabs[0].label)) problems.push(`first tab reads "${v.tabs[0].label}"`);
    }
    // The header draws the deck's colours as mana symbols rather than the
    // letters "GU", and says nothing about a commander — colours are read off
    // the cards, so there is no commander to report.
    const h = v.header;
    if (h.pips.length !== 2) {
      problems.push(`expected 2 mana pips for a GU deck, got ${h.pips.length}`);
    } else {
      if (h.pips.map((p) => p.letter).join('') !== 'UG') problems.push(`pips read ${h.pips.map((p) => p.letter).join('')}, not WUBRG order (UG)`);
      if (h.pips.some((p) => !/^(blue|green)$/.test(p.label))) problems.push('a pip has no colour name for screen readers');
      if (new Set(h.pips.map((p) => p.background)).size !== 2) problems.push('both mana pips rendered the same colour');
      if (h.pips.some((p) => !/50%|9999px|^\d+px$/.test(p.round) || p.size < 12)) problems.push('mana pips did not render as filled circles');
    }
    if (h.commanderLines) problems.push(`${h.commanderLines} commander line(s) rendered; colours come from the cards now`);
    if (h.pickers) problems.push(`${h.pickers} commander picker(s) rendered; the shortlist was removed`);

    // Interchangeable cards must collapse. Without this the fixture's two
    // identical-payoff combos read as two finds and two recommendations.
    const g = v.grouped;
    if (!g.eitherRows.length) problems.push('no combo row collapsed its interchangeable part');
    if (g.eitherRows.some((t) => !/any of \d+/.test(t))) problems.push(`a collapsed row reads "${g.eitherRows[0]}"`);
    if (g.choiceRows !== g.eitherRows.length) problems.push('a collapsed row did not list its choices');
    if (!g.altGroups.length) problems.push('no suggestion offered interchangeable alternatives');
    if (g.altGroups.some((t) => !/or any one of these \d+/.test(t))) problems.push(`an alternatives label reads "${g.altGroups[0]}"`);
    if (g.altNames < 1) problems.push('the alternatives list named no cards');

    // Counting rows instead of combos under-reports a deck with interchangeable
    // versions in it — 34 combos shown as 23. The fixture collapses two combos
    // into one row on purpose, so the badge and the row count must disagree.
    const inc = v.included;
    if (inc.rows >= Number(inc.badge)) problems.push(`the combo count (${inc.badge}) does not exceed the ${inc.rows} rows, so versions are not being counted`);
    if (Number(inc.badge) !== inc.versions) problems.push(`the combo count reads ${inc.badge} but the rows hold ${inc.versions} version(s)`);

    // A combo that appears only because the deck fills a template slot has to
    // show the slot and name the card credited with it. Without that it reads
    // as the page inventing a combo out of one card.
    const s = v.slots;
    if (!s.labels.length) problems.push('the combo filling a template slot did not render the slot');
    if (!s.labels.some((t) => /Free Sacrifice Ability/.test(t))) problems.push(`a slot reads "${s.labels[0]}" instead of the template's name`);
    if (!s.credited.some((t) => /Walking Ballista/.test(t))) problems.push('the slot did not name the card of yours that fills it');
    // The twin combo needs a template nothing in the deck matches; showing it
    // would mean a slot was treated as filled without evidence.
    if (s.comboIds.some((href) => /\/12\//.test(href))) problems.push('a combo whose template nothing fills was listed as complete');
    if (!s.comboIds.some((href) => /\/11\//.test(href))) problems.push('the combo whose template the deck fills went missing');

    // A combo the deck holds every named card for and cannot assemble is worth
    // saying out loud, in its own section, naming the slot and what fills it.
    // Dropping these in silence was the old behaviour.
    const stuck = v.stuck;
    if (stuck.rows < 2) problems.push(`expected 2 one-slot-away rows, got ${stuck.rows}`);
    if (!stuck.comboIds.some((href) => /\/13\//.test(href))) problems.push('the combo one slot away was not reported');
    if (s.comboIds.some((href) => /\/13\//.test(href))) problems.push('a combo one slot away was listed among the combos in the deck');
    if (!stuck.missing.some((t) => /Persist Creature/.test(t))) problems.push(`the missing slot reads "${stuck.missing[0]}"`);
    if (!stuck.needs.some((t) => /2 cards fill it, 1 in your colours/.test(t))) {
      problems.push(`no row counted the cards that fill its slot: ${JSON.stringify(stuck.needs)}`);
    }
    if (!stuck.candidates.includes('Bloom Tender')) problems.push('the cards that fill the slot were not named');
    if (stuck.candidates.includes('Murderous Redcap')) problems.push('an off-colour card was offered for a slot');
    // Haste Enabler has no Scryfall query, so it can be named and never filled.
    if (!stuck.needs.some((t) => /Haste Enabler/.test(t))) problems.push('a slot with no card list was not named');
    if (!stuck.needs.some((t) => /no card list published/.test(t))) problems.push('a slot with no card list did not say so');

    // Which daily snapshot is on screen, and whether the kept copy is being
    // used. Caching that silently stops working costs 2.9 MB a visit and looks
    // like nothing at all, so the source is asserted rather than trusted.
    const age = v.dataAge;
    if (age.hidden !== false) problems.push('the data date is not shown after a search');
    if (!/Combo data from/.test(age.text)) problems.push(`the data date reads "${age.text}"`);
    if (!new RegExp(`${FIXTURE.combos.length} combos`).test(age.text)) {
      problems.push(`the data line does not count the combos: "${age.text}"`);
    }
    const expectSource = v === verdicts[0] ? 'network' : 'cache';
    if (age.source !== expectSource) {
      problems.push(`data came from "${age.source}", expected "${expectSource}" on run ${verdicts.indexOf(v) + 1}`);
    }
    // And that the run under test took the path it was set up to take. Without
    // this the no-worker run passes whether or not the fallback was ever used.
    const expectVia = vp.noWorker ? 'page' : 'worker';
    if (age.via !== expectVia) problems.push(`the search ran in the ${age.via}, expected the ${expectVia}`);

    // The bracket check. The fixture holds two of its three Game Changers and a
    // two-card combo that wins, so the floor is 3 and both reasons are on screen.
    const bracket = v.bracket;
    if (!/Bracket 3 at the earliest/.test(bracket.floor)) {
      problems.push(`the bracket floor reads "${bracket.floor}", expected bracket 3`);
    }
    if (!/Upgraded/.test(bracket.floor)) problems.push('the bracket number is not followed by its name');
    if (bracket.changers.length !== 2) {
      problems.push(`${bracket.changers.length} Game Changers named, expected the 2 the deck holds`);
    }
    if (bracket.changers.includes('Bloom Tender')) {
      problems.push('a Game Changer the deck does not play was counted');
    }
    if (!/2 Game Changers/.test(bracket.why)) problems.push(`the bracket reason reads "${bracket.why}"`);
    if (!/two-card combo/.test(bracket.why)) problems.push('the two-card win was not given as a reason');
    if (!bracket.twoCardCombos) problems.push('the two-card combos behind the floor are not shown');
    // The caveat is the reason a number on this panel is honest. It must be
    // present, and it must not be folded away.
    if (!/Mass land denial/.test(bracket.caveat)) problems.push('the bracket panel does not say what it did not check');
    if (bracket.caveatFolded) problems.push('the bracket caveat is hidden behind a control');

    // Taking a suggestion: the card lands in the decklist, the list is kept, and
    // the search runs again — proved by the deck holding more combos than it did.
    const added = v.afterAdd;
    if (!added.present) {
      problems.push('no suggestion offered a way to add the card');
    } else {
      if (added.lastLine !== `1 ${added.card}`) {
        problems.push(`Add to deck appended "${added.lastLine}", expected "1 ${added.card}"`);
      }
      if (!added.kept || !added.kept.includes(added.card)) {
        problems.push('an added card was not kept for the next visit');
      }
      if (!added.status || !added.status.includes(added.card)) {
        problems.push(`adding a card did not say so: "${added.status}"`);
      }
      if (!(Number(added.combosAfter) > Number(added.combosBefore))) {
        problems.push(`the deck held ${added.combosBefore} combos before adding ${added.card} and `
          + `${added.combosAfter} after — the search did not run again`);
      }
      if (!/^Add .+ to your decklist/.test(added.spoken)) {
        problems.push(`the add control's spoken label reads "${added.spoken}"`);
      }
    }

    // The decklist is the whole input; losing it on reload is the one thing a
    // page like this must not do. And Clear has to actually clear.
    if (!v.storedDeck || !/Basalt Monolith/.test(v.storedDeck)) problems.push('the decklist was not kept for the next visit');
    const cleared = v.afterClear;
    if (cleared.decklist || cleared.commanders) problems.push('Clear left the decklist behind');
    if (cleared.stored) problems.push('Clear left the stored decklist behind');
    if (!cleared.resultsHidden) problems.push('Clear left the results on screen');

    // Easiest first, and alphabetical within a row.
    const sizes = v.order.map((r) => r.size);
    if (sizes.length < 3) problems.push(`only ${sizes.length} combo rows to check the ordering of`);
    for (let i = 1; i < sizes.length; i += 1) {
      if (sizes[i] < sizes[i - 1]) {
        problems.push(`combo rows are not smallest-first: ${JSON.stringify(v.order.map((r) => r.size))}`);
        break;
      }
    }
    if (new Set(sizes).size < 2) problems.push('every combo row is the same size, so the ordering proves nothing');
    for (const row of v.order) {
      const sorted = row.names.slice().sort((a, b) => a.localeCompare(b));
      if (row.names.join('|') !== sorted.join('|')) {
        problems.push(`a combo row is not alphabetical: "${row.label}"`);
        break;
      }
    }
    // Under a card, that card leads and the rest follow alphabetically.
    for (const [where, rows] of Object.entries(v.leads)) {
      if (!rows.length) { problems.push(`no ${where} rows to check the card order of`); continue; }
      let checked = 0;
      for (const row of rows) {
        for (const names of row.combos) {
          if (names.length < 2) continue;
          checked += 1;
          if (DeckCombos_nameKey(names[0]) !== DeckCombos_nameKey(row.focal)) {
            problems.push(`${where}: "${names.join(' + ')}" does not start with ${row.focal}`);
          }
          const rest = names.slice(1);
          const sorted = rest.slice().sort((a, b) => a.localeCompare(b));
          if (rest.join('|') !== sorted.join('|')) {
            problems.push(`${where}: the cards after ${row.focal} are not alphabetical in "${names.join(' + ')}"`);
          }
        }
      }
      if (!checked) problems.push(`no ${where} combo lists the cards of, so the lead order is untested`);
    }
    if (v.panels.some((p) => !p.bodyVisible)) problems.push('a panel rendered with no visible body');
    if (v.panels.some((p) => p.headHeight < 44)) problems.push('a collapse control is under 44px tall');
    // Empty chips must fail: otherwise every assertion below passes vacuously.
    if (!v.chips.length) problems.push('the first combo listed no results at all');
    if (v.chips.length && v.chips[0].win !== true) problems.push('a game-winning result was not listed first');
    if (v.chips.some((c) => c.decisive && !c.title)) problems.push('a yellow result carries no explanation on hover');
    if (!v.chips.some((c) => c.more)) problems.push('the fixture no longer folds anything, so the fold is untested');
    // Grey must be on screen without expanding: it is quieter, not hidden.
    if (!v.chips.some((c) => c.grey)) problems.push('grey is not visible until the fold is opened');
    const ex = v.expandedChips;
    if (ex.some((c) => c.more)) problems.push('the "+N more" fold did not open');
    if (!ex.some((c) => c.win)) problems.push('the green tier rendered nothing');
    if (!ex.some((c) => c.decisive)) problems.push('the yellow tier rendered nothing');
    if (!ex.some((c) => c.grey)) problems.push('the grey tier rendered nothing');
    // Three tiers must be three visibly different colours, or the tiering is
    // lost on anyone actually looking at the page.
    const colours = new Set(ex.map((c) => c.colour));
    if (colours.size < 3) problems.push(`only ${colours.size} distinct chip colours: ${[...colours].join(' / ')}`);
    // Eight results plus the "+N more" control.
    if (v.chips.length > 9) problems.push(`${v.chips.length} result chips shown; the tail should fold behind "+N more"`);
    if (v.chips.length && !v.chips[v.chips.length - 1].more) problems.push('the folded results control is missing');
    if (v.afterCollapse.expanded !== 'false' || v.afterCollapse.bodyVisible) problems.push('clicking the header did not collapse the section');
    if (!v.afterCollapse.stored) problems.push('collapse state was not persisted');

    // Assert against the width actually rendered, not the one requested — a
    // sizing mechanism that silently does nothing would otherwise let every
    // viewport pass as whatever the default happens to be.
    if (Math.abs(v.width - vp.width) > 20) {
      problems.push(`rendered at ${v.width}px, not the requested ${vp.width}px`);
    }
    const wide = v.width >= 900;
    if (wide && !v.sideBySide) problems.push('wide viewport did not lay out in two columns');
    if (!wide && v.sideBySide) problems.push('narrow viewport did not stack to one column');

    // A desktop should be used, not framed. The sidebar is a fixed 370px, so all
    // the room a bigger screen offers belongs to the results.
    if (v.width >= 1600) {
      if (v.shellWidth < 1400) problems.push(`at ${v.width}px the page is only ${v.shellWidth}px wide, leaving ${v.unusedWidth}px unused`);
      if (v.outWidth < 1000) problems.push(`at ${v.width}px the results column is only ${v.outWidth}px`);
    }
    // And capped, so an ultrawide monitor does not string a combo's result chips
    // across half a metre.
    if (v.shellWidth > 1520) problems.push(`the page grew to ${v.shellWidth}px; the cap should hold it near 1500px`);

    const layout = wide
      ? `two columns (${v.formWidth}px + ${v.outWidth}px, ${v.unusedWidth}px unused)`
      : `stacked (${v.outWidth}px)`;
    const pieceNote = v.topPiece ? `top piece ${v.topPiece.card} ${v.topPiece.badge}` : 'no pieces';
    const tabNote = v.tabs.map((t) => `${t.active ? '[' : ''}${t.label}:${t.count}${t.active ? ']' : ''}`).join(' ');
    const chipNote = `${v.chips.length} folded / ${v.expandedChips.length} open, ${new Set(v.expandedChips.map((c) => c.colour)).size} colours [${v.expandedChips.map((c) => (c.win ? 'G:' : c.decisive ? 'Y:' : 'x:') + c.text).join(', ')}]`;
    if (problems.length) {
      failed = true;
      console.error(`FAIL ${v.name} @${v.width}px — ${problems.join('; ')}`);
    } else {
      const headNote = `{${v.header.pips.map((p) => p.letter).join('}{')}} from the cards`;
      const groupNote = `grouped: ${v.grouped.eitherRows.length} combo row(s) ${JSON.stringify(v.grouped.eitherRows)}, ${v.grouped.altGroups.length} suggestion choice(s)`;
      const stuckNote = `${v.stuck.rows} one slot away (${v.stuck.missing.join(', ')})`;
      const sizeNote = `sizes ${JSON.stringify((v.sizes.find((r) => r.pills.length > 1) || v.sizes[0]).pills)}`
        + `, rows ${JSON.stringify(v.order.map((r) => r.size))}`;
      const bracketNote = `bracket ${v.bracket.floor.replace(/ — .*/, '')} `
        + `(${v.bracket.changers.length} GC, ${v.bracket.twoCardCombos} two-card win)`;
      const addNote = `+${v.afterAdd.card} took combos ${v.afterAdd.combosBefore}→${v.afterAdd.combosAfter}`;
      console.log(`ok   ${v.name} @${v.width}px — ${layout}, ${headNote}, ${v.panels.length} panels, tabs ${tabNote}, ${pieceNote}, ${groupNote}, ${stuckNote}, ${sizeNote}, ${bracketNote}, ${addNote}, data from ${v.dataAge.source}, ${chipNote}`);
    }
  }

  // ---- the tier review page ----
  for (const t of await collect(TIERS_FIXTURE, TIERS_HARNESS, 'The tier page')) {
    if (!t.ok) {
      console.error(`FAIL ${t.name} — ${t.error}`);
      failed = true;
      continue;
    }
    const problems = [];
    if (Math.abs(t.width - t.requested) > 20) problems.push(`rendered at ${t.width}px, not ${t.requested}px`);
    if (t.overflow > 0) problems.push(`horizontal overflow of ${t.overflow}px`);
    if (t.sections.length !== 3) problems.push(`expected 3 tier sections, got ${t.sections.length}`);
    if (t.chipHeight < 44) problems.push('a filter chip is under 44px tall');
    if (t.rows < 3) problems.push(`only ${t.rows} result rows rendered`);
    // The point of the page: an unlisted result is called out, loudly, with the
    // lines to paste into result-tiers.js.
    if (!t.flagged) problems.push('an unclassified result was not flagged');
    if (!/1 result not classified/.test(t.flagText)) problems.push(`the warning reads "${t.flagText}"`);
    if (!t.snippet.includes(UNKNOWN_RESULT)) problems.push('the paste-ready snippet is missing the unknown result');
    if (t.searchRows >= t.rows) problems.push('searching did not narrow the list');
    if (t.sectionsAfterToggle !== 2) problems.push(`toggling a tier chip left ${t.sectionsAfterToggle} sections, expected 2`);

    if (problems.length) {
      failed = true;
      console.error(`FAIL ${t.name} @${t.width}px — ${problems.join('; ')}`);
    } else {
      console.log(`ok   ${t.name} @${t.width}px — ${t.rows} results, chips ${t.chipCounts.join('/')}, flagged: ${t.flagText}`);
    }
  }

  if (failed) process.exit(1);
  console.log('Layout verified at all viewports.');
})().catch((err) => {
  console.error('verify-layout crashed:', err);
  process.exit(1);
});
