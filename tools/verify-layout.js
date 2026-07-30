#!/usr/bin/env node
// Layout smoke test: render the real page at phone, tablet and desktop widths,
// then assert the things that silently break — horizontal overflow, collapsed
// sections that don't collapse, and the desktop two-column split.
//
// Zero dependencies, so it drives a headless browser through --dump-dom and has
// the page report its own verdict, rather than pulling in Playwright.
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
// Async, not execFileSync: this process is also the web server the browser
// talks to, and a synchronous child would block the event loop so those
// requests were never answered.
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
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
    'Walking Ballista': '', 'Heliod, Sun-Crowned': 'W',
  },
  combos: [
    { id: '1', c: ['Kinnan, Bonder Prodigy', 'Basalt Monolith'],
      p: ['Infinite storm count', 'Win the game', 'Infinite lifegain', 'Infinite colorless mana', 'Infinite ETB triggers', 'Infinite LTB triggers', 'Infinite untap'],
      i: 'GU', pop: 999 },
    { id: '2', c: ['Basalt Monolith', 'Rings of Brighthearth'], p: ['Infinite colorless mana'], i: 'C', pop: 90 },
    { id: '6', c: ['Basalt Monolith', 'Kinnan, Bonder Prodigy', 'Walking Ballista'], p: ['Infinite damage'], i: 'GU', pop: 10 },
    { id: '3', c: ['Palinchron', 'Deadeye Navigator'], p: ['Infinite mana'], i: 'U' },
    { id: '4', c: ['Great Whale', 'Deadeye Navigator'], p: ['Infinite mana'], i: 'U' },
    { id: '5', c: ['Walking Ballista', 'Heliod, Sun-Crowned'], p: ['Infinite damage'], i: 'W' },
  ],
};

const DECK = ['1 Basalt Monolith', '1 Rings of Brighthearth', '1 Palinchron', '1 Great Whale', '1 Walking Ballista', '10 Island'];

// The page under test is loaded inside an iframe sized to each viewport.
// Media queries evaluate against the iframe's own width, so the result no
// longer depends on whether the browser binary honours --window-size — the
// full chrome build silently clamps to 500px, which made a "390px" run a lie.
const HARNESS = `<!DOCTYPE html><meta charset="utf-8"><body style="margin:0">
<pre id="verdict"></pre>
<script>
const WIDTHS = ${JSON.stringify(VIEWPORTS)};
const DECK = ${JSON.stringify(DECK.join('\n'))};
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
  const firstCombo = doc.querySelector('.combo');
  const chips = firstCombo ? [...firstCombo.querySelectorAll('.results .result')].map((c) => ({
    text: c.textContent, win: c.classList.contains('tier-win'),
    decisive: c.classList.contains('tier-decisive'), more: c.classList.contains('more'),
    title: c.title || '',
  })) : [];
  const form = doc.querySelector('.col-input').getBoundingClientRect();
  const out = doc.querySelector('.col-output').getBoundingClientRect();
  return {
    width: win.innerWidth,
    overflow: doc.documentElement.scrollWidth - doc.documentElement.clientWidth,
    panels,
    topPiece,
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
        doc.getElementById('commanders').value = 'Kinnan, Bonder Prodigy';
        doc.getElementById('decklist').value = DECK;
        doc.getElementById('deck-form').dispatchEvent(new win.Event('submit', { cancelable: true }));
        await new Promise((r) => setTimeout(r, 500));

        const before = measure(win, doc);

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
        resolve(Object.assign({ ok: true, name: vp.name, requested: vp.width }, before, { afterCollapse }));
      } catch (err) {
        resolve({ ok: false, name: vp.name, error: String((err && err.stack) || err) });
      }
    };
    document.body.appendChild(frame);
  });
}

(async () => {
  for (const vp of WIDTHS) results.push(await runOne(vp));
  document.getElementById('verdict').textContent = JSON.stringify(results);
})();
</script>`;

function serve(dir, extra) {
  return http.createServer((req, res) => {
    const url = req.url.split('?')[0];
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

  const extra = {
    '/combos.json': { type: 'application/json', body: JSON.stringify(FIXTURE) },
    '/_verify.html': { type: 'text/html', body: HARNESS },
  };
  const server = serve(ROOT, extra);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const { stdout: dom } = await execFileAsync(browser, [
    '--headless', '--disable-gpu', '--no-sandbox',
    '--window-size=1600,1200',
    '--virtual-time-budget=15000', '--dump-dom',
    `http://127.0.0.1:${port}/_verify.html`,
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000 });

  server.close();

  const match = dom.match(/<pre id="verdict">([\s\S]*?)<\/pre>/);
  if (!match || !match[1].trim()) {
    console.error('The page produced no verdict — it probably threw before reporting.');
    process.exit(1);
  }
  const decoded = match[1]
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const verdicts = JSON.parse(decoded);

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
    if (!v.topPiece) problems.push('the combo-pieces overview did not render');
    else if (!/in \d+ combos/.test(v.topPiece.badge)) problems.push(`combo-pieces badge reads "${v.topPiece.badge}"`);
    if (v.panels.some((p) => !p.bodyVisible)) problems.push('a panel rendered with no visible body');
    if (v.panels.some((p) => p.headHeight < 44)) problems.push('a collapse control is under 44px tall');
    // Empty chips must fail: otherwise every assertion below passes vacuously.
    if (!v.chips.length) problems.push('the first combo listed no results at all');
    if (v.chips.length && v.chips[0].win !== true) problems.push('a game-winning result was not listed first');
    const decisive = v.chips.filter((c) => c.decisive);
    if (!decisive.length) problems.push('the decisive tier rendered nothing');
    if (decisive.some((c) => !c.title)) problems.push('a decisive result carries no explanation on hover');
    if (v.chips.length > 5) problems.push(`${v.chips.length} result chips shown; the tail should fold behind "+N more"`);
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
    const chipNote = `${v.chips.length} chips [${v.chips.map((c) => (c.win ? '*' : c.decisive ? '~' : '') + c.text).join(', ')}]`;
    if (problems.length) {
      failed = true;
      console.error(`FAIL ${v.name} @${v.width}px — ${problems.join('; ')}`);
    } else {
      console.log(`ok   ${v.name} @${v.width}px — ${layout}, ${v.panels.length} panels, ${pieceNote}, ${chipNote}`);
    }
  }

  if (failed) process.exit(1);
  console.log('Layout verified at all viewports.');
})().catch((err) => {
  console.error('verify-layout crashed:', err);
  process.exit(1);
});
