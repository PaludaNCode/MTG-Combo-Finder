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
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, deck: 'marked' },
  { name: 'tablet', width: 768, height: 1024, deck: 'marked' },
  { name: 'desktop', width: 1440, height: 900, deck: 'marked' },
  // Same deck with the commander marker taken off. Nothing about the output
  // should change: colours are read off the cards either way.
  { name: 'desktop (no marker)', width: 1440, height: 900, deck: 'plain' },
  // And once with Worker taken away from the page, which is the fallback path in
  // app.js — searching in the window instead of beside it. Same output, or the
  // fallback is a branch nobody has ever run.
  { name: 'desktop (no worker)', width: 1440, height: 900, deck: 'marked', noWorker: true },
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
  const tabs = [...doc.querySelectorAll('.tabs .tab')].map((t) => ({
    label: t.querySelector('.tab-label').textContent,
    count: t.querySelector('.tab-count').textContent,
    active: t.classList.contains('is-active'),
    selected: t.getAttribute('aria-selected'),
    paneVisible: !doc.getElementById(t.getAttribute('aria-controls')).hidden,
    height: t.offsetHeight,
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
  const stuck = {
    rows: doc.querySelectorAll('#slots .combo').length,
    missing: [...doc.querySelectorAll('#slots .slot-missing')].map((e) => e.textContent),
    needs: [...doc.querySelectorAll('#slots .gap')].map((e) => e.textContent),
    candidates: [...doc.querySelectorAll('#slots .candidates .card-name')].map((e) => e.textContent),
    comboIds: [...doc.querySelectorAll('#slots .combo-link a')].map((a) => a.getAttribute('href')),
  };
  const ageEl = doc.getElementById('data-age');
  const dataAge = {
    hidden: ageEl ? ageEl.hidden : null,
    text: ageEl ? ageEl.textContent : '',
    source: ageEl ? ageEl.dataset.source : null,
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
  return {
    header,
    grouped,
    slots,
    stuck,
    dataAge,
    included,
    width: win.innerWidth,
    overflow: doc.documentElement.scrollWidth - doc.documentElement.clientWidth,
    panels,
    topPiece,
    tabs,
    sideBySide: out.left >= form.right - 1,
    formWidth: Math.round(form.width),
    outWidth: Math.round(out.width),
    chips,
  };
}

function runOne(vp) {
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
          { afterCollapse, expandedChips, storedDeck, afterClear }));
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

function serve(dir, extra, onVerdict) {
  return http.createServer((req, res) => {
    const url = req.url.split('?')[0];
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

    const problems = [];
    if (v.overflow > 0) problems.push(`horizontal overflow of ${v.overflow}px`);
    if (v.panels.length < 4) problems.push(`expected 4 panels, got ${v.panels.length}`);
    if (!v.topPiece) {
      problems.push('the combo-pieces overview did not render');
    } else if (!/in \d+ combos/.test(v.topPiece.badge)) {
      problems.push(`combo-pieces badge reads "${v.topPiece.badge}"`);
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

    // The decklist is the whole input; losing it on reload is the one thing a
    // page like this must not do. And Clear has to actually clear.
    if (!v.storedDeck || !/Basalt Monolith/.test(v.storedDeck)) problems.push('the decklist was not kept for the next visit');
    const cleared = v.afterClear;
    if (cleared.decklist || cleared.commanders) problems.push('Clear left the decklist behind');
    if (cleared.stored) problems.push('Clear left the stored decklist behind');
    if (!cleared.resultsHidden) problems.push('Clear left the results on screen');

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

    const layout = wide ? `two columns (${v.formWidth}px + ${v.outWidth}px)` : `stacked (${v.outWidth}px)`;
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
      console.log(`ok   ${v.name} @${v.width}px — ${layout}, ${headNote}, ${v.panels.length} panels, tabs ${tabNote}, ${pieceNote}, ${groupNote}, ${stuckNote}, data from ${v.dataAge.source}, ${chipNote}`);
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
