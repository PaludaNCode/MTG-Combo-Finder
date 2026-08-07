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
// The deploy's asset rewrite, shared rather than reimplemented — see stampedIndex().
const { rewriteAssets } = require('./stamp-assets.js');

const ROOT = path.join(__dirname, '..');
// charset=utf-8 on every one of them, and it is load-bearing rather than tidy. Without it
// the browser sniffs the encoding per file, and CI's Chrome decoded the em dash in
// render-map.js's hover text as mojibake while the Chromium here guessed UTF-8 and passed
// — so `verify` failed on one viewport with "a card on the map has no hover text" and no
// local run could reproduce it. GitHub Pages serves these with a charset, so the page was
// never wrong in production; only this server was, which is the worst shape a harness bug
// can take. Any new text type added here needs the same suffix.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
};

// The `rows` container width at which a combo heading stops stacking one card per line and
// goes back to "A + B + C" inline. Held here as well as in style.css on purpose: a
// threshold only in the stylesheet is a number no test can disagree with, and this file's
// job is to check the rule rather than restate the breakpoint. If one moves, this fails.
const HEADING_INLINE_AT = 560;

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
  // The same deck with a misspelling and a token line in it. Both parse as card
  // lines, reach the search and match nothing, so the page has to name them — and
  // every other run above is the other branch of that rule, where nothing is
  // unrecognized and nothing at all is said.
  { name: 'misspelled card', width: 1440, height: 900, deck: 'misspelled' },
  { name: 'misspelled card (phone)', width: 390, height: 844, deck: 'misspelled' },
  // The same deck made illegal two ways at once — a card outside the commander's
  // colour identity and a card on the fixture's ban list — because the two findings
  // have to be drawn together to be checked apart. Every other deck here is the
  // silent branch: nothing to report, and no line at all.
  { name: 'illegal deck', width: 1440, height: 900, deck: 'illegal', kind: 'legality' },
  // And on a phone, where the two lines wrap: a claim, a card name and two links per
  // line is the widest thing in that box, and it has to stay inside the column.
  { name: 'illegal deck (phone)', width: 390, height: 844, deck: 'illegal', kind: 'legality' },
  // And with no commander named, which is the half the check cannot answer: a
  // Commander deck's identity is its commander's, and there is none to read. The ban
  // still stands, and the line has to say why the other half went unanswered.
  {
    name: 'illegal deck (no commander)',
    width: 1440,
    height: 900,
    deck: 'illegalNoCommander',
    kind: 'legality',
  },
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
  // And the same page with no Worker, which is the combination nothing covered until
  // unofficial.js and search.js left index.html. Those two are now injected by app.js,
  // making a third hop the deploy's rewrite cannot reach — and an unstamped one is
  // invisible in production, since it resolves fine and serves whatever the CDN
  // cached. That is how unofficial.js, graph.js and theme.js each shipped stale. The
  // sandbox 404s unstamped .js, so this run fails rather than a reader's.
  {
    name: 'desktop (asset-stamped, no worker)',
    width: 1440,
    height: 900,
    deck: 'marked',
    kind: 'stamped',
    noWorker: true,
  },
  // Also not a layout check: the theme control overriding the system, remembering
  // the answer, and carrying it to the second page.
  { name: 'theme toggle', width: 1440, height: 900, kind: 'theme' },
  // Same page, same press, a decklist that ends in a section.
  { name: 'desktop (sideboarded deck)', width: 1440, height: 900, deck: 'sideboarded' },
  // Combos we believe in that Spellbook has not published, in their own panel
  // below the published ones.
  { name: 'unofficial combos', width: 1440, height: 900, deck: 'unofficial', kind: 'unofficial' },
  // And the one row that took two steps to get there, which has to say so.
  { name: 'unofficial (two swaps)', width: 1440, height: 900, deck: 'chained', kind: 'unofficial', steps: 2 },
  // A deck one card short of an unofficial row and of nothing else: the whole
  // suggestion rests on combos nobody published, and both counts have to say so.
  { name: 'unofficial (suggested)', width: 1440, height: 900, deck: 'unofficialAlmost', kind: 'suggested' },
  // The same deck on a phone, which is the only run where a real split is drawn in a
  // narrow column. Without it the compact "0+1" reading is asserted nowhere: the
  // tuning deck has no unofficial combos, so every other viewport draws no split at
  // all and the desktop runs draw the words.
  { name: 'unofficial (suggested, phone)', width: 390, height: 844, deck: 'unofficialAlmost', kind: 'suggested' },
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

// The fixture deck and dataset, shared with the Playwright suite in e2e/ — see
// test/fixtures/dataset.js. Both harnesses drive the real pages against the same
// made-up deck, so a case added for one is a case the other gets too.
const { FIXTURE, DECKS, TIERS_FIXTURE, UNKNOWN_RESULT, asPublished, stepsFiles } = require('../test/fixtures/dataset.js');

// The steps tree, at the paths steps-source.js builds and in the shape
// tools/fetch-combos.js writes. Served here so the disclosure on a combo row
// draws real fetched text in this test rather than something the harness made
// easier — and so a combo with no file still has to render the 404 as an answer.
const STEPS_FILES = Object.fromEntries(Object.entries(stepsFiles())
  .map(([at, body]) => [at, { type: 'application/json', body }]));

// The footer's build line exactly as deploy.yml publishes it, substituted in by both
// harnesses before they measure it.
//
// This run serves the pages unstamped, where the line reads "Build local · not
// deployed" — twenty characters shorter than the real one. Measuring that would pass
// a footer that overflows in production and nowhere else, which is the same class of
// vacuum as an assertion matching nothing: the check would run, and be about a string
// no reader ever sees.
//
// It is the widest the deploy can produce rather than a sample of it, and that is a
// property of the format rather than luck: the short SHA is always seven characters
// and the timestamp is fixed-width, digits throughout. So there is exactly one
// production line to check and this is it. A format with a variable-width month or an
// unpadded day would need the worst case picked by hand instead.
const DEPLOYED_BUILD_LINE = 'Build <code id="build">1234567</code> · '
  + '<span id="built">deployed <time datetime="2026-12-31T23:59:59Z">2026-12-31 23:59:59 UTC</time></span>';

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

// What a reader sees, as opposed to what the markup holds. Some text on a row is
// present in two readings with CSS showing one — the split, which spells itself out
// where the row's column has room — so asserting on textContent would pass on a page
// that had lost the rule and was showing both at once.
// Every panel that opens with a caption, measured as a box. Three panels draw one and they
// have to be one kind of thing: same left edge, same measure, same size and colour, and the
// same distance from the heading above and the rows below. The margins are half of that and
// were the half nobody was measuring -- a caption with a top margin sits away from its
// heading and pushes the panel's contents down.
//
// One function called from two runs rather than the same reads written twice: the pair of
// copies this replaces already differed by their indentation alone, which is one edit away
// from differing by what they measure.
//
// No backticks in here, comments included: this is inside the HARNESS template literal and
// one would end it.
function captionBoxes(win, doc) {
  return ['graph', 'pieces', 'unofficial'].map(function (id) {
    const p = doc.querySelector('#' + id + ' .panel-note');
    if (!p) return null;
    const r = p.getBoundingClientRect();
    const cs = win.getComputedStyle(p);
    const next = p.nextElementSibling;
    return {
      panel: id,
      left: Math.round(r.left),
      width: Math.round(r.width),
      size: cs.fontSize,
      colour: cs.color,
      marginTop: cs.marginTop,
      marginBottom: cs.marginBottom,
      // What the caption stands on, so the space below it is measured rather than inferred
      // from a margin something else may be collapsing.
      gapBelow: next ? Math.round(next.getBoundingClientRect().top - r.bottom) : null,
      lines: Math.round(r.height / parseFloat(cs.lineHeight)),
    };
  }).filter(Boolean);
}

// The node's OWN display is checked as well as its children's. Without that, asking a
// hidden element for its visible text returns all of it — which is how the deck-counts
// label read "Deck" at a width that hides it, in a check written specifically to catch
// that. The recursion always had the test; the entry point did not.
function visibleTextIn(win, node) {
  if (!node) return '';
  if (node.nodeType === 1 && win.getComputedStyle(node).display === 'none') return '';
  return [...node.childNodes].map((n) => {
    if (n.nodeType === 3) return n.textContent;
    if (n.nodeType !== 1) return '';
    return win.getComputedStyle(n).display === 'none' ? '' : visibleTextIn(win, n);
  }).join('');
}

// The row the result-chip assertions are about — the tier order, the fold, the three
// colours, the height folding saves.
//
// Not the first .combo on the page, which is what they used to read — and note that a
// backtick cannot be written in this comment: everything from HARNESS down is one
// template literal, and one would end it. Nothing about those checks
// is about the first row; they need *a* row whose results span the tiers, and taking the
// first one quietly made every one of them depend on a decision belonging to another
// panel entirely. Ordering "Combos in your deck" by what its rows draw rather than by
// play count changed which combo leads, and eight viewports failed on chips that had not
// moved: "a game-winning result was not listed first" on a page whose tier ordering was
// perfectly intact.
//
// So ask for the row that exercises them: one with a game-winning result, and among
// those the one with the most chips. Ties keep document order, so the answer does not
// depend on the sort. If no row has one the fallback is the first row, and the
// assertions then fail as they should — a fixture that has stopped covering the green
// tier is exactly what "the green tier rendered nothing" is for.
//
// Where those rows live changed with the panel: there is no list of combo rows in a
// panel body any more, only the combos folded under each card of "Combos in your deck".
// So the rows are read from the disclosures the run opens (see openCombos()) — and they
// have to be opened, or every rect is 0 and the chip geometry is measured on boxes that
// were never laid out, which passes.
function tieredCombo(doc) {
  const rows = [...doc.querySelectorAll('#pieces details[open] > .combo')];
  const chips = (row) => row.querySelectorAll('.results .result').length;
  const withWin = rows.filter((row) => row.querySelector('.results .result.tier-win'));
  return withWin.slice().sort((a, b) => chips(b) - chips(a))[0] || doc.querySelector('.combo');
}

function measure(win, doc) {
  const visibleText = (node) => visibleTextIn(win, node);
  const panels = [...doc.querySelectorAll('.panel')].map((p) => ({
    title: p.querySelector('.panel-title').textContent,
    count: (p.querySelector('.panel-count') || {}).textContent || null,
    bodyVisible: p.querySelector('.panel-body').offsetHeight > 0,
    headHeight: p.querySelector('.panel-head').offsetHeight,
  }));
  // Asked for by its container and not by its title: "Combos in your deck" is the
  // heading now, and matching on that would also match nothing else on the page only
  // by luck. The id is the stable half.
  const piecesPanel = doc.querySelector('#pieces .panel');
  const topPiece = piecesPanel ? {
    card: piecesPanel.querySelector('.card-name').textContent,
    total: piecesPanel.querySelector('.row-total').textContent,
    spoken: piecesPanel.querySelector('.row-total').title || '',
    // The size breakdown on the row, same as a suggestion carries. "in 9 combos" is
    // one number over nine different propositions, and this panel's whole question is
    // what cutting the card would cost.
    pills: [...piecesPanel.querySelectorAll('.combo.suggestion .sizes .size')].length
      ? [...piecesPanel.querySelector('.combo.suggestion').querySelectorAll('.sizes .size')].map((p) => p.textContent)
      : [],
    // The pills close the card's column, below the name and the links, rather than
    // sharing the name's line as they used to.
    inMain: Boolean(piecesPanel.querySelector('.combo.suggestion > .row-main > .sizes')),
  } : null;
  // The point of the gutter, and the one thing about it a screenshot cannot show:
  // every total in a panel lines up. Read as the set of distinct right edges per
  // panel — one edge means a column, several means the old ragged badge back in a
  // new guise. Also the totals' own geometry: a total that can break across two
  // lines mid-number, or one whose word has drifted onto its line, is not a number
  // in a column any more.
  const numberColumns = [...doc.querySelectorAll('.panel')]
    .map((p) => {
      // Rendered rows only. The off-colour suggestions tab is hidden until it is
      // picked, and a row with no geometry cannot be out of line with anything —
      // counting it would report every panel as misaligned by exactly one row.
      const totals = [...p.querySelectorAll('.row-total')]
        .filter((t) => t.getBoundingClientRect().width > 0);
      if (!totals.length) return null;
      return {
        panel: p.querySelector('.panel-title').textContent,
        rows: totals.length,
        // Rounded to the pixel: sub-pixel text metrics are not a misalignment.
        edges: [...new Set(totals.map((t) => Math.round(t.getBoundingClientRect().right)))],
        wraps: [...new Set(totals.map((t) => win.getComputedStyle(t).whiteSpace))],
        // Every row's numbers carry the sentence, or cutting the words hid it.
        spoken: totals.filter((t) => /\\d+ combos?/.test(t.title || '')).length,
        // The width the container query is asked about: the panel body's content
        // box, which is the row's own column and not the window. Reported so the
        // report can check the rule rather than restate the breakpoint.
        column: (() => {
          const body = p.querySelector('.panel-body');
          const cs = win.getComputedStyle(body);
          return Math.round(body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
        })(),
        // Where the card's links sit relative to its name. Beside it where the row's
        // column has room for both, on a line of their own below where it has not —
        // and this is the only check that can tell those apart, because both are the
        // same three children in the same order and only the geometry differs.
        // Rendered rows only, for the same reason the totals are filtered above.
        rowLinks: [...p.querySelectorAll('.combo.suggestion')].map((row) => {
          const main = row.querySelector(':scope > .row-main');
          const name = main && main.querySelector(':scope > .row-name');
          const links = main && main.querySelector(':scope > .card-links');
          if (!name || !links) return null;
          const nb = name.getBoundingClientRect();
          const lb = links.getBoundingClientRect();
          if (!nb.width || !lb.width) return null;
          return {
            name: name.textContent,
            // Sharing the name's line: starting after the name ends, and starting
            // before the name's own box does.
            beside: lb.left >= nb.right - 1 && lb.top < nb.bottom,
            below: lb.top >= nb.bottom - 1,
            // Whichever branch is taken, the line has to stay inside the column.
            // A links line running past the row's own right edge is the failure
            // mode this rule can produce and a screenshot of a short name hides.
            overflows: Math.round(lb.right) > Math.round(main.getBoundingClientRect().right) + 1,
          };
        }).filter(Boolean),
        splits: [...p.querySelectorAll('.row-split')].map((s) => ({
          // What a reader actually sees. Both readings of the split are in the
          // markup and CSS shows one, so textContent would report the words even
          // where they are hidden — and the phone assertion would pass on a page
          // that had lost the rule entirely.
          text: visibleText(s),
          spoken: s.getAttribute('aria-label') || '',
          role: s.getAttribute('role') || '',
          ours: s.querySelector('.ours') ? win.getComputedStyle(s.querySelector('.ours')).color : null,
          official: s.querySelector('.official') ? win.getComputedStyle(s.querySelector('.official')).color : null,
        })),
      };
    })
    .filter(Boolean);
  const tabs = [...doc.querySelectorAll('.tabs .tab')].map((t) => ({
    label: t.querySelector('.tab-label').textContent,
    count: t.querySelector('.tab-count').textContent,
    active: t.classList.contains('is-active'),
    selected: t.getAttribute('aria-selected'),
    paneVisible: !doc.getElementById(t.getAttribute('aria-controls')).hidden,
    height: t.offsetHeight,
  }));
  // The per-card breakdown of what each suggestion's count is made of. The pills
  // on a row must add up to that row's own total — that is the whole reason it
  // is reported per card rather than per panel.
  const sizes = [...doc.querySelectorAll('.tab-pane:not([hidden]) .combo.suggestion')].map((row) => ({
    total: (row.querySelector('.row-total') || {}).textContent || '',
    inMain: Boolean(row.querySelector(':scope > .row-main > .sizes')),
    pills: [...row.querySelectorAll('.sizes .size')].map((p) => p.textContent),
    easiest: [...row.querySelectorAll('.sizes .size.is-easiest')].map((p) => p.textContent),
    colour: row.querySelector('.sizes .size') ? win.getComputedStyle(row.querySelector('.sizes .size')).color : null,
    // The sizes of the combos listed inside "Combos this unlocks", in the order they
    // are drawn. The pills above them are in size order, so a list that is not says
    // two different things about the same set of combos — and it puts the hardest
    // line to assemble at the top of a panel headed by the easiest.
    //
    // Counted the way the top-level rows are: named cards, plus a slot or an
    // "any of N" choice, each of which something has to occupy.
    unlockSizes: [...row.querySelectorAll('details > .combo')].map((c) => {
      const head = c.querySelector(':scope > h3');
      if (!head) return 0;
      return head.querySelectorAll(':scope > .card-name').length
        + head.querySelectorAll(':scope > .slot').length
        + (head.querySelector(':scope > .either') ? 1 : 0);
    }),
  }));
  // Where the row's divider runs, and where the blocks beside it start. The line is
  // drawn in pieces — a left border on every block in the card's column, each
  // reaching back across the column gap to meet the one above — so "one line down
  // the row" is a fact about three or four boxes agreeing and nothing in the CSS
  // says it. Changing the column gap, dropping the stretch, putting a block back in
  // column 1, adding a block to the column without giving it a piece, or giving one
  // a margin where it should have padding each breaks it, and each leaves a page
  // that renders perfectly. A row offering interchangeable cards is the case that
  // carries three pieces, which is why it is measured as a list rather than a pair.
  //
  // The gutter is measured for the opposite reason: it must draw NOTHING. It used to
  // own the top segment, which is what forced it to share a grid row with .row-main
  // and made the disclosure sit at a different height on every row that carried a
  // split. It spans the rows now, and a border-right returning here would be a
  // second line at the same x — invisible on screen, and the whole design undone.
  const dividers = [...doc.querySelectorAll('.tab-pane:not([hidden]) .combo.suggestion, #pieces .combo.suggestion')].map((row) => {
    const num = row.querySelector(':scope > .row-numbers');
    const main = row.querySelector(':scope > .row-main');
    const det = row.querySelector(':scope > details');
    const sum = det && det.querySelector(':scope > summary');
    if (!num || !main || !det || !sum) return null;
    return {
      name: (row.querySelector('h3 > .card-name') || {}).textContent || '',
      // Must be 0. See above — the gutter draws no part of the line any more.
      gutterWidth: parseFloat(win.getComputedStyle(num).borderRightWidth) || 0,
      // Every block in the card's column, in the order they are drawn: the card
      // itself, the interchangeable cards where there are any, then the disclosure.
      // Rounded: a sub-pixel difference is not a broken line. A piece that has lost
      // its border reports the box edge instead, so it stops agreeing with the rest
      // — which is the answer wanted, since part of a divider is not one.
      blocks: [...row.querySelectorAll(':scope > .row-main, :scope > .alternatives, :scope > details')].map((b) => {
        const box = b.getBoundingClientRect();
        return {
          what: b.classList.contains('row-main') ? 'the card'
            : b.classList.contains('alternatives') ? 'the choice of card' : 'the disclosure',
          line: Math.round(box.left),
          width: parseFloat(win.getComputedStyle(b).borderLeftWidth) || 0,
          top: Math.round(box.top),
          bottom: Math.round(box.bottom),
        };
      }),
      // The disclosure reads from the card's column, level with the name and the
      // sizes above it — not from under the gutter, where it read as a third thing
      // the row was about rather than the list behind the number.
      //
      // Both are content edges, not box edges: every block in this column now
      // reaches back over the column gap to draw the divider, so their boxes all
      // start a gap to the LEFT of the column and comparing those would compare two
      // numbers that agree no matter where the text went.
      summaryLeft: Math.round(sum.getBoundingClientRect().left),
      // The border counts: getBoundingClientRect() is the border box, and this
      // column's blocks all carry a 1px left border that the padding sits inside.
      mainLeft: Math.round(main.getBoundingClientRect().left
        + (parseFloat(win.getComputedStyle(main).borderLeftWidth) || 0)
        + (parseFloat(win.getComputedStyle(main).paddingLeft) || 0)),
    };
  }).filter(Boolean);
  const grouped = {
    // There were two more measurements here — the "any of N" pill a collapsed combo row
    // drew, and the choices it listed underneath. Both belonged to the panel that listed
    // every combo as its own row, and that panel is gone: "Combos in your deck" is one
    // row per card now, and a card's combos are written out in full inside it. Nothing
    // renders .either or .choices any more, so a measurement of them would be a
    // check that matches nothing and reports success.
    //
    // A suggestion still offers a choice of card, which is altGroups below, and the
    // template-slot pill is still a heading pill — which is what keeps pillInset honest.
    //
    // The separator has to sit *outside* the pill's outline. It used to be drawn on the
    // element carrying the outline, so it landed within it and the heading read
    // "Trudge Garden ( + any of 4 )". The mark is generated content and the outline is a
    // box-shadow, so neither is visible to textContent and no screenshot diff would flag
    // it either — the only way to see it is to compare the two boxes.
    //
    // The outer element is the flex item and carries the mark; the inner .pill carries the
    // outline. If the mark is outside, the pill starts to the right of the item. If it were
    // back inside, the two would share a left edge. Rows inside a closed disclosure have no
    // geometry at all — every box is 0 — so they are dropped rather than read as equal.
    pillInset: [...doc.querySelectorAll('#pieces .combo > h3 > .slot')]
      .map((outer) => {
        const inner = outer.querySelector(':scope > .pill');
        if (!inner) return { kind: outer.className, inset: null };
        const o = outer.getBoundingClientRect();
        const i = inner.getBoundingClientRect();
        if (!o.width || !i.width) return null;
        // Geometry alone is not enough, and this is the trap: with the outline back on the
        // outer element its own padding still pushes the inner one rightwards, so the inset
        // stays positive while the mark sits squarely inside the outline again. What has to
        // hold is structural — the element carrying the outline is not the element carrying
        // the mark — so the shadow is read on both.
        const shadow = (n) => win.getComputedStyle(n).boxShadow;
        return {
          kind: outer.className,
          inset: Math.round((i.left - o.left) * 10) / 10,
          outerRinged: shadow(outer) !== 'none',
          innerRinged: shadow(inner) !== 'none',
        };
      })
      .filter(Boolean),
    // The mark in front of a heading pill, read off generated content because that is
    // where it lives: it moved from its own span onto the ::before of the item it
    // introduces, so textContent cannot see it and neither can visibleTextIn(). It was
    // missing for a while and every text-based assertion here was happy — the heading
    // read "Altar of Dementia + Kitchen Finks any of 5" on the live page. The pill it
    // is read off now is the template slot, the only heading pill left.
    slotSeps: [...doc.querySelectorAll('#pieces .combo > h3 > .plus + .slot')].map((e) => {
      const before = win.getComputedStyle(e, '::before').content;
      return (before === 'none' || before === 'normal') ? '' : before.replace(/^["']|["']$/g, '');
    }),
    altGroups: [...doc.querySelectorAll('.alternatives .alt-label')].map((e) => e.textContent),
    // The width the alternatives' container query is asked about: the suggestions
    // panel body's content box, which is the row's own column and not the window.
    // Reported so the two shapes below can be checked as a rule rather than as a
    // breakpoint repeated in the test.
    column: (() => {
      const body = doc.querySelector('#suggestions .panel-body');
      if (!body) return 0;
      const cs = win.getComputedStyle(body);
      return Math.round(body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    })(),
    // The label, its comparison pill, and how they share the card's column. Two
    // separate questions, and only the first has one answer at every width:
    //
    // The *sentence* must never break. Measured over its own text node rather than
    // the label's box, because the box holds the pill too — so a label reported as
    // one line can still be "or these 2, same / combo:" with the pill beside it,
    // which is what happened when the block moved into the card's column.
    //
    // Where the pill sits does depend on the room: beside the sentence where the
    // column can hold both, on its own line below where it cannot. Reported as a
    // fact about geometry, so the report can check the rule against the column's
    // width rather than restate a breakpoint.
    altLabel: (() => {
      const label = doc.querySelector('.alternatives .alt-label');
      if (!label) return null;
      const lineHeight = parseFloat(win.getComputedStyle(label).lineHeight) || 16;
      const pill = label.querySelector('.alt-all');
      const box = label.getBoundingClientRect();
      const sentence = doc.createRange();
      sentence.selectNodeContents(label.firstChild);
      const sentenceBox = sentence.getBoundingClientRect();
      const pillBox = pill ? pill.getBoundingClientRect() : null;
      return {
        lines: Math.round(box.height / lineHeight),
        // One client rect per line box the sentence occupies.
        sentenceLines: sentence.getClientRects().length,
        sentenceWidth: Math.round(sentenceBox.width),
        boxWidth: Math.round(box.width),
        pillWidth: pillBox ? Math.round(pillBox.width) : 0,
        pillBeside: Boolean(pillBox) && Math.abs(pillBox.top - sentenceBox.top) < lineHeight / 2,
        text: label.textContent,
      };
    })(),
    altNames: doc.querySelectorAll('.alternatives .alt-list .card-name').length,
    // Where each interchangeable row's + Add actually sits. A wrapping row put the
    // button of a long name on a second line and started every button at a different
    // x, so the list read as ragged — measured, because "they line up" is a fact
    // about geometry and nothing in the markup states it.
    altRows: [...doc.querySelectorAll('.alternatives .alt-list li')].map((li) => {
      const name = li.querySelector('.card-name');
      const add = li.querySelector('.add-card');
      if (!name || !add) return null;
      const nameBox = name.getBoundingClientRect();
      const addBox = add.getBoundingClientRect();
      return {
        name: name.textContent,
        // Rounded: sub-pixel layout differences are not raggedness.
        addRight: Math.round(addBox.right),
        nameWidth: Math.round(nameBox.width),
        sameLine: Math.abs(addBox.top - nameBox.top) < 12,
        // Clipped rather than shortened, so the text is all still there to be read.
        clipped: name.scrollWidth > name.clientWidth + 1,
        titled: name.getAttribute('title') === name.textContent,
      };
    }).filter(Boolean),
    // The one link that covers a whole choice at once. Gathered per suggestion and
    // alongside the names that suggestion shows, because the query inside the href
    // is the part that can silently stop matching what the group actually offers —
    // and a document-wide query could not tell which cards it was meant to carry.
    compare: [...doc.querySelectorAll('.combo.suggestion')]
      .filter((row) => row.querySelector('.alternatives'))
      .map((row) => {
        const a = row.querySelector('.alternatives .alt-all');
        return {
          headline: (row.querySelector('h3 > .card-name') || {}).textContent || '',
          // Both lists: the spelled-out few and the folded-away remainder.
          alts: [...row.querySelectorAll('.alternatives .alt-list .card-name')].map((n) => n.textContent),
          label: a ? a.textContent : null,
          href: a ? a.getAttribute('href') : null,
          opensAway: Boolean(a) && a.getAttribute('target') === '_blank'
            && (a.getAttribute('rel') || '').includes('noopener'),
        };
      }),
  };
  // One link per combo row that opens all of its cards on Scryfall. Read as the real
  // href and checked against the row's own card names, because the query is the part
  // that can quietly stop matching the row it sits under.
  //
  // The rows are the combos folded under a card in "Combos in your deck" — which is the
  // only place on the page a published combo is drawn at all now, so it is also where
  // "How it works" and the Spellbook link have to be. There is no collapsed row to make
  // an exception for any more: every row stands for exactly one combo and carries both.
  const comboCompare = [...doc.querySelectorAll('#pieces .combo.suggestion > details > .combo')]
    .slice(0, 4).map((row) => {
    const head = row.querySelector(':scope > h3');
    const a = row.querySelector(':scope > .combo-link .alt-all');
    const spellbook = row.querySelector(':scope > .combo-link a:not(.alt-all)');
    return {
      names: head ? [...head.querySelectorAll(':scope > .card-name')].map((n) => n.textContent) : [],
      slots: head ? head.querySelectorAll(':scope > .slot').length : 0,
      label: a ? a.textContent : null,
      href: a ? a.getAttribute('href') : null,
      hasSpellbook: Boolean(spellbook),
      hasSteps: Boolean(row.querySelector(':scope > .combo-link .steps-toggle')),
      // The link line sits above the result chips: what a combo needs is read before
      // what it does. 4 is DOCUMENT_POSITION_FOLLOWING — the chips come after.
      beforeChips: (() => {
        const line = row.querySelector(':scope > .combo-link');
        const chips = row.querySelector(':scope > .results');
        if (!line || !chips) return null;
        return (line.compareDocumentPosition(chips) & 4) !== 0;
      })(),
    };
  });

  // How a combo heading is laid out, measured rather than assumed: does each card get a
  // line of its own, and does any card end up split across two lines?
  //
  // The reported case was a phone heading reading "Hammerhead, Maggia Boss +" / "Kitchen
  // Finks + Archangel of" / "Thune" — three lines, none of them a card. A screenshot shows
  // that and textContent does not, so the geometry is the only honest test: a card's own
  // client rects say whether it wrapped, and the tops of the cards say whether they share
  // lines. "wants" is the width the inline shape would need to sit on one line, which is
  // the number the threshold is set against — and no backticks in here, because this whole
  // function is inside a template literal.
  const headingShape = (() => {
    const rows = [...doc.querySelectorAll('.panel-body .combo > h3')];
    // How many of them the browser actually laid out. Counted because everything below
    // skips a heading with no geometry, and every combo heading on the page is now inside
    // a disclosure: with those shut, this whole measurement is empty, every assertion
    // about the two shapes holds vacuously, and the run reports a page it never looked at.
    let rendered = 0;
    let stacked = 0;
    let sharing = 0;
    let split = 0;
    let wants = 0;
    let column = 0;
    let example = '';
    let splitExample = '';
    for (const head of rows) {
      // Rendered headings only. A combo inside a closed disclosure has no geometry at all
      // — every rect is zero — so every card in it shares a top of 0 and it would report
      // as "two cards on one line" on a page laying it out perfectly. The same filter the
      // row totals need, for the same reason.
      const box = head.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      rendered += 1;
      // The width the container query is actually answered at, which is no longer the
      // panel body: a combo row sits inside a card's disclosure now, and that disclosure
      // is a rows container of its own so the row keys on the space it really has. Read
      // the panel body only where there is no disclosure above it — the unofficial panel,
      // whose rows sit in the body directly. Reading the body everywhere reported 689px
      // for rows laid out in 450px, so the tablet run demanded the inline shape of a
      // column too narrow to hold it and called a correct page broken.
      const queried = head.closest('.combo.suggestion > details') || head.closest('.panel-body');
      if (queried) {
        const cs = win.getComputedStyle(queried);
        column = Math.max(column, Math.round(
          queried.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        ));
      }
      const cards = [...head.querySelectorAll(':scope > .card-name, :scope > .slot')];
      if (cards.length < 2) continue;
      const tops = cards.map((c) => Math.round(c.getBoundingClientRect().top));
      if (new Set(tops).size === cards.length) {
        stacked += 1;
      } else {
        sharing += 1;
        // Named, because "1 heading is wrong" is not something anybody can go and look at.
        if (!example) {
          const panel = head.closest('.panel');
          const title = panel && panel.querySelector('.panel-title');
          example = head.textContent.trim().slice(0, 60)
            + ' [in ' + (title ? title.textContent : 'no panel') + ']';
        }
      }
      // More than one rect means the browser broke this name across lines.
      if (cards.some((c) => c.getClientRects().length > 1)) {
        split += 1;
        if (!splitExample) {
          const bad = cards.find((c) => c.getClientRects().length > 1);
          splitExample = bad.textContent.trim().slice(0, 40)
            + ' in "' + head.textContent.trim().slice(0, 60) + '"'
            + ' [' + Math.round(bad.getBoundingClientRect().width) + 'px of ' + column
            + 'px, h3 draws as ' + win.getComputedStyle(head).display + ']';
        }
      }
      // What this heading would need to sit on one line, whatever it is doing now. Read
      // off max-content and not scrollWidth: a block-level heading fills its column, so
      // scrollWidth reported the column back and every viewport looked like it had ~32px
      // to spare — a measurement that agrees with whatever it is measuring.
      const was = { display: head.style.display, ws: head.style.whiteSpace, w: head.style.width };
      head.style.display = 'block';
      head.style.whiteSpace = 'nowrap';
      head.style.width = 'max-content';
      wants = Math.max(wants, Math.ceil(head.getBoundingClientRect().width));
      head.style.display = was.display;
      head.style.whiteSpace = was.ws;
      head.style.width = was.w;
    }
    // How much room the text in a row actually has, and how much of the column is spent
    // on air either side of it. The column width alone does not answer that: a panel and a
    // card each take a padding out of it before a card name gets any.
    let text = 0;
    let air = 0;
    const firstHead = rows.find((h) => h.getBoundingClientRect().width);
    if (firstHead) {
      text = Math.round(firstHead.getBoundingClientRect().width);
      // Against the box the row is laid out in, for the same reason the column above is:
      // measured off the panel body, the air would include the whole number gutter and
      // read as room a card name could have had.
      const box = firstHead.closest('.combo.suggestion > details') || firstHead.closest('.panel-body');
      if (box) {
        air = Math.round(box.getBoundingClientRect().width - text);
      }
    }
    return {
      rows: rows.length, rendered, stacked, sharing, split, wants, column, example, splitExample,
      text, air,
    };
  })();

  // The link line's separators, read as what a reader sees. A dot is only ever a
  // separator *between* two offers on one line: where the offers stack it is a bullet
  // in front of a chip, which is how "…came from → ·" with the chip below got shipped.
  const linkLine = (() => {
    const line = doc.querySelector('.panel-body .combo > .combo-link');
    if (!line) return null;
    const offers = [...line.children].filter((c) => !c.classList.contains('sep'));
    const seps = [...line.querySelectorAll(':scope > .sep')];
    const tops = offers.map((c) => Math.round(c.getBoundingClientRect().top));
    return {
      offers: offers.length,
      // Separators the reader can actually see.
      seps: seps.filter((s) => getComputedStyle(s).display !== 'none').length,
      stacked: offers.length > 1 && new Set(tops).size === offers.length,
    };
  })();

  // Where the "+" between the split's halves sits, against where it should sit.
  //
  // The sign is set at .62em — deliberately, since at the digits' size "+24" alone needed
  // 63px of a 54px column — and a smaller inline box shares the digits' *baseline*, not
  // their centre. Digits have no descender, so the sign ended up about a third of their
  // height low and read as a subscript.
  //
  // Measured off real ink metrics rather than box geometry: a box's height is font ascent
  // plus descent and says nothing about where the glyph's ink sits inside it, which is the
  // whole question. Canvas gives actualBoundingBox* for the two strings at their two sizes,
  // so "the centre of the digits" and "the centre of the plus" are numbers, and the shift
  // that makes them equal is arithmetic instead of taste.
  const signAlign = (() => {
    const ctx = doc.createElement('canvas').getContext('2d');
    const ink = (node, text) => {
      const cs = win.getComputedStyle(node);
      ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      const m = ctx.measureText(text);
      return {
        size: parseFloat(cs.fontSize),
        // Positive is above the baseline. The centre of the ink, not of the box.
        centre: (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2,
        descent: m.fontBoundingBoxDescent,
        bottom: node.getBoundingClientRect().bottom,
      };
    };

    // One sign, against where it should sit. The digits are measured as an inline span
    // beside it, inheriting the same font, so the two measurements are the same shape: an
    // inline box's height is its font's ascent plus descent, which makes its bottom a fixed
    // distance under the shared baseline. A Range over the text node would report the line
    // box and answer a different question.
    const measure = (sign, where) => {
      const host = sign && sign.parentNode;
      if (!sign || !host || !sign.getBoundingClientRect().width) return null;
      const probe = doc.createElement('span');
      probe.appendChild(doc.createTextNode('20'));
      host.insertBefore(probe, sign);
      const d = ink(probe, '20');
      const p = ink(sign, '+');
      probe.remove();
      // A box's bottom is its baseline plus that font's descent, so the difference of the
      // two baselines is how far the sign has actually been raised off the digits'.
      const raised = (d.bottom - d.descent) - (p.bottom - p.descent);
      return {
        where,
        ideal: Math.round((d.centre - p.centre) * 100) / 100,
        raised: Math.round(raised * 100) / 100,
        signSize: p.size,
        idealEm: Math.round(((d.centre - p.centre) / p.size) * 1000) / 1000,
      };
    };

    const out = [];
    // The sign in front of a suggestion's total, which this deck draws.
    const total = doc.querySelector('.row-total > .sign');
    const inTotal = measure(total, 'total');
    if (inTotal) out.push(inTotal);

    // And the one between a split's halves — the case the fix was reported for, and the one
    // no fixture here renders, because this deck has no unofficial combos. Built the same
    // way the gutter's worst case is, since a rule that is right at one size and unchecked
    // at the other is half a rule.
    const host = doc.querySelector('.row-numbers');
    if (host) {
      const span = (cls, text) => {
        const e = doc.createElement('span');
        if (cls) e.className = cls;
        if (text) e.appendChild(doc.createTextNode(text));
        return e;
      };
      const half = (cls, count, word) => {
        const e = span(cls, count);
        e.appendChild(span('word', ' ' + word));
        return e;
      };
      const built = span('row-split');
      built.appendChild(half('official', '31', 'official'));
      built.appendChild(span('sign', '+'));
      built.appendChild(span('dot', ' · '));
      built.appendChild(half('ours', '9', 'unofficial'));
      host.appendChild(built);
      const inSplit = measure(built.querySelector(':scope > .sign'), 'split');
      if (inSplit) out.push(inSplit);
      built.remove();
    }
    return out;
  })();

  // What the gutter actually needs, so its width is a measurement rather than a memory.
  // Every rendered thing in it, widest first — and then the worst real case built on
  // purpose, because the fixture need not contain it: a card holding up 1,889 combos of
  // ours and none of Spellbook's, which is the row the 4.2rem was set for.
  const gutterNeeds = (() => {
    const parts = [...doc.querySelectorAll('.row-numbers > *')]
      .filter((e) => e.getBoundingClientRect().width > 0);
    let widest = 0;
    let what = '';
    for (const part of parts) {
      const w = Math.ceil(part.getBoundingClientRect().width);
      if (w > widest) {
        widest = w;
        what = part.className.split(' ')[0] + ' "' + part.textContent.trim().slice(0, 14) + '"';
      }
    }
    // Built rather than cloned from a rendered row: this deck has no unofficial combos, so
    // it draws no split at all, and a clone of nothing measures 0px and reports as "fits".
    // The shape mirrors numberGutter() in render-rows.js — if that changes, this measures
    // the wrong thing, which is why the note prints the number instead of only asserting it.
    const host = doc.querySelector('.row-numbers');
    let worst = 0;
    if (host) {
      const span = (cls, text) => {
        const e = doc.createElement('span');
        if (cls) e.className = cls;
        if (text) e.appendChild(doc.createTextNode(text));
        return e;
      };
      const half = (cls, count, word) => {
        const e = span(cls, count);
        e.appendChild(span('word', ' ' + word));
        return e;
      };
      const probe = span('row-split');
      probe.appendChild(half('official', '0', 'official'));
      probe.appendChild(span('sign', '+'));
      probe.appendChild(span('dot', ' · '));
      probe.appendChild(half('ours', '1889', 'unofficial'));
      host.appendChild(probe);
      worst = Math.ceil(probe.getBoundingClientRect().width);
      probe.remove();
    }
    const cs = host ? win.getComputedStyle(host) : null;
    return {
      widest,
      what,
      worst,
      pad: cs ? Math.ceil(parseFloat(cs.paddingRight)) : 0,
      column: host ? Math.round(host.getBoundingClientRect().width) : 0,
    };
  })();

  const slots = {
    labels: [...doc.querySelectorAll('#pieces .slot')].map((e) => e.textContent),
    credited: [...doc.querySelectorAll('#pieces .fills')].map((e) => e.textContent),
    comboIds: [...doc.querySelectorAll('#pieces .combo-link a')].map((a) => a.getAttribute('href')),
  };
  // What the page said about cards it did not recognise. Read as what a reader sees
  // — is the section there, what does it claim, and which names does it write out —
  // plus where it sits, because a notice about the input that renders below the
  // answer it is qualifying is a notice nobody reads.
  const unknownCards = (() => {
    const box = doc.querySelector('#unrecognized .unknown-cards');
    const firstPanel = doc.querySelector('#results .panel');
    return {
      shown: !!box,
      head: box ? (box.querySelector('.unknown-head') || {}).textContent || '' : '',
      names: [...doc.querySelectorAll('#unrecognized .unknown-list .card-name')].map((e) => e.textContent),
      why: box ? (box.querySelector('.unknown-why') || {}).textContent || '' : '',
      // Above the first panel of results, measured rather than assumed from the
      // markup order: a float or a grid could put it anywhere.
      aboveResults: !!(box && firstPanel
        && box.getBoundingClientRect().top < firstPanel.getBoundingClientRect().top),
    };
  })();
  // The deck summary: one box holding what the page can say about the *list* rather
  // than about the search — colours, bracket, and a row per number. Read as a reader
  // sees it, which for this box means row by row: the keys line up in a column, and a
  // row whose value wrapped is a row twice the height of its neighbours.
  //
  // It cannot be measured off the markup order alone. The box has to sit above the
  // results and below the unrecognized-cards notice, and both are plain blocks that a
  // stylesheet could reorder.
  const deckSummary = (() => {
    const box = doc.querySelector('#deck-summary');
    const rows = box && !box.hidden ? [...box.querySelectorAll('.identity-line, .bracket-line, .summary-row')] : [];
    const firstPanel = doc.querySelector('#results .panel');
    return {
      shown: Boolean(box) && !box.hidden,
      // Key, value and aside per row, in the order they are drawn. The key doubles as
      // the row's name in a failure message, which is worth more than an index.
      rows: rows.map((row) => ({
        key: visibleText(row.querySelector('.summary-key, .identity-label, .bracket-label')).trim(),
        n: visibleText(row.querySelector('.summary-n')).trim(),
        sub: visibleText(row.querySelector('.summary-sub')).trim(),
        // Rounded to the line: a row that wrapped is twice the height of one that did
        // not, and that is the failure this box replaced a one-line strip to avoid.
        lines: Math.round(row.getBoundingClientRect().height
          / parseFloat(win.getComputedStyle(row).lineHeight)),
      })),
      // The pips still belong to their own renderers; this only checks they are in here.
      identityPips: box ? box.querySelectorAll('.identity-line .pip').length : 0,
      // .step and not .bracket-pip -- the renderer has always called them steps, and a
      // selector matching nothing would report a box with a bracket in it as a bracket
      // with no pips. No backticks in here: this is inside the HARNESS template literal.
      bracketPips: box ? box.querySelectorAll('.bracket-line .step').length : 0,
      // Every key starts at the same x, or the column is not a column.
      keyLefts: [...new Set(rows.map((row) => {
        const key = row.querySelector('.summary-key, .identity-label, .bracket-label');
        return key ? Math.round(key.getBoundingClientRect().left) : -1;
      }))],
      // Same question for the figures, which only line up while the key column is fixed
      // — under 24rem of box the keys size to their text and this is expected to spread.
      valueLefts: [...new Set(rows.map((row) => {
        const n = row.querySelector('.summary-n');
        return n ? Math.round(n.getBoundingClientRect().left) : -1;
      })).values()].filter((x) => x !== -1),
      column: box ? Math.round(box.getBoundingClientRect().width) : 0,
      // What the container query actually answers to: an inline-size container measures
      // its CONTENT box, so the padding and border come off. Reading the outer width and
      // comparing it against the rule's rem value is how the first threshold here landed
      // between the two phones on paper and fired on both in the browser.
      inner: box ? Math.round(box.clientWidth
        - parseFloat(win.getComputedStyle(box).paddingLeft)
        - parseFloat(win.getComputedStyle(box).paddingRight)) : 0,
      aboveResults: Boolean(box && firstPanel
        && box.getBoundingClientRect().top < firstPanel.getBoundingClientRect().top),
    };
  })();
  // What the page said about legality. Two lines, or none -- and read as a reader sees
  // it: which claim, which cards, and what it admitted to not checking.
  const legality = (() => {
    const box = doc.querySelector('#legality .legality');
    // One <li> per card now, so this reads the names off the list items rather than off a
    // run of spans. Same query either way -- what changed is that a name is a line.
    const cardsIn = (sel) => [...doc.querySelectorAll(sel + ' .legality-cards li .card-name')]
      .map((e) => e.textContent);
    return {
      shown: !!box,
      banned: cardsIn('#legality .is-banned'),
      bannedClaim: (doc.querySelector('#legality .is-banned .legality-claim') || {}).textContent || '',
      offIdentity: cardsIn('#legality .is-off-identity'),
      // The pips a card carries that its commander does not. Read as letters off the pip
      // elements, because these are drawn now rather than written -- this same reader used
      // to collect the text "{W}", which is what the page was wrongly printing.
      colours: [...doc.querySelectorAll('#legality .is-off-identity .legality-colours')]
        .map((e) => [...e.querySelectorAll('.pip')].map((pip) => pip.getAttribute('data-colour')).join('')),
      identityClaim: (doc.querySelector('#legality .is-off-identity .legality-claim') || {}).textContent || '',
      // The commander's own identity, inside that sentence, as pips rather than the
      // braces it used to print.
      identityClaimPips: [...doc.querySelectorAll('#legality .is-off-identity .legality-claim .pip')]
        .map((pip) => pip.getAttribute('data-colour')).join(''),
      notes: [...doc.querySelectorAll('#legality .legality-note')].map((e) => e.textContent),
      // Beside the bracket, which means under it and above the combos.
      belowBracket: (() => {
        const bracket = doc.querySelector('#bracket .bracket-line');
        const firstPanel = doc.querySelector('#results .panel');
        if (!box || !bracket || !firstPanel) return null;
        return box.getBoundingClientRect().top >= bracket.getBoundingClientRect().top
          && box.getBoundingClientRect().top < firstPanel.getBoundingClientRect().top;
      })(),
      // The ban is the format refusing the deck and takes --error; a card in the
      // wrong colours does not, or the two accusations read as one.
      bannedColour: doc.querySelector('#legality .is-banned .legality-claim')
        ? win.getComputedStyle(doc.querySelector('#legality .is-banned .legality-claim')).color
        : null,
      identityColour: doc.querySelector('#legality .is-off-identity .legality-claim')
        ? win.getComputedStyle(doc.querySelector('#legality .is-off-identity .legality-claim')).color
        : null,
    };
  })();
  // A combo the deck cannot assemble for want of a template slot must not be on the
  // page at all. Combo 13 in the fixture is the case — every card it names is in the
  // deck and nothing fills its slot — and it used to have a panel of its own. Read
  // across every combo link in the results, not just the ones in a single panel,
  // because the way this could go wrong now is it turning up somewhere else.
  const stuckSlot = (() => {
    const links = [...doc.querySelectorAll('#results .combo-link a')].map((a) => a.getAttribute('href') || '');
    return {
      links: links.length,
      // A substring and not a regex: this block is inside a template literal, where
      // a lone \\/ collapses to / and turns the pattern into a line comment.
      anywhere: links.some((href) => href.indexOf('/13/') !== -1),
      missingPills: doc.querySelectorAll('#results .slot-missing').length,
    };
  })();
  // There was an order measurement here, over the rows of the panel that listed every
  // combo: easiest first, then families together. It went with that panel. The rule it
  // checked did not disappear — it moved inside a card, where leads below already
  // holds it: the combos folded under one of your cards are listed smallest-first, lead
  // card first, and what a family shares before what changes.
  //
  // The panel's own ordering is now the gutter — most combos carried first — which is
  // the ranking measured further down, and that is a different claim needing its own check.
  //
  // Combos listed *under* a card have to start with that card. Read out of the
  // <details> whether or not it is open — the rows are in the DOM either way.
  const nested = (scope, cardSelector) => [...doc.querySelectorAll(scope)].slice(0, 3).map((row) => {
    const focal = (row.querySelector(cardSelector) || {}).textContent || '';
    const combos = [...row.querySelectorAll('details > .combo > h3')].map((h) => (
      [...h.querySelectorAll(':scope > .card-name')].map((n) => n.textContent)
    ));
    // The order these are listed in: size first, then alphabetically by the cards.
    // Sizes count a slot and an "any of N" too, since something has to occupy them —
    // without that a two-card-plus-slot row looks smaller than it is and the size
    // sequence appears to go backwards.
    const order = [...row.querySelectorAll('details > .combo > h3')].map((h) => {
      const names = [...h.querySelectorAll(':scope > .card-name')].map((n) => n.textContent);
      return {
        size: names.length + h.querySelectorAll(':scope > .slot').length
          + (h.querySelector(':scope > .either') ? 1 : 0),
        // As drawn, which is what the list is sorted on. It used to be the names *sorted*,
        // on the grounds that the focal card is pulled to the front and is the same on every
        // row — true, and it stopped being the whole story when the card that changes started
        // going last: rows now sort by what they share before what differs, so comparing
        // alphabetical signatures asserted a rule the page had stopped following. It passed
        // only because no nested list in this deck holds two rows a card apart.
        drawn: names.join(' + '),
        // Everything but the last card: the part a family holds in common.
        prefix: names.slice(0, -1).join(' + '),
      };
    });
    return { focal, combos, order };
  });
  const leads = {
    suggestions: nested('.tab-pane:not([hidden]) .combo.suggestion', 'h3 > .card-name'),
    pieces: nested('#pieces .combo.suggestion', '.row-name > .card-name'),
  };

  // The bracket check. Two of Wizards' criteria are readable off a card list and
  // the rest are not, so the panel has to state the floor *and* what it did not
  // look at — a bracket number on its own would be read as the whole answer.
  const scaleButton = doc.querySelector('#bracket .bracket-scale');
  const whyPanel = doc.querySelector('#bracket .bracket-why');
  const bracket = {
    // One pip per bracket, and its state. Read as three lists rather than one
    // string, because "which brackets are ruled out" is the claim being made.
    pips: [...doc.querySelectorAll('#bracket .step')].map((p) => ({
      n: p.textContent,
      state: p.classList.contains('floor') ? 'floor' : p.classList.contains('out') ? 'out' : 'open',
    })),
    // The whole answer lives in the button's accessible name, since the pips are
    // decorative — so this is also what a screen reader gets.
    spoken: scaleButton ? scaleButton.getAttribute('aria-label') : '',
    // Shut until asked. Read from computed style: display is what actually
    // decides, and a panel left open would put the caveat back on the page.
    closed: Boolean(whyPanel) && win.getComputedStyle(whyPanel).display === 'none',
    floor: (doc.querySelector('#bracket .why-floor') || {}).textContent || '',
    why: (doc.querySelector('#bracket .why-reason') || {}).textContent || '',
    changers: [...doc.querySelectorAll('#bracket .why-cards .card-name')].map((e) => e.textContent),
    // The Game Changers keep their links, which is the one thing a hover cannot
    // carry as plain text.
    changerLinks: doc.querySelectorAll('#bracket .why-cards .card-links a').length,
    caveat: (doc.querySelector('#bracket .why-note') || {}).textContent || '',
    // The caveat is now behind a hover, so the ways of asking for it are what has to
    // hold. Hover cannot be simulated here; a press is the path a phone has, and the
    // one that would silently fail if the control were hover-only.
    //
    // Everything only readable while it is open is read in this one press, because the
    // panel is the one thing on this page whose layout no other check can see. It shipped
    // 123px past the right of a 390px phone: the document grew wider than the screen,
    // mobile Safari zoomed the whole page out to fit, and every assertion here — including
    // the document-wide overflow number — passed, because all of them measure it shut.
    // (No backticks in here, ever: this is inside HARNESS, a template literal.)
    whileOpen: (() => {
      if (!scaleButton || !whyPanel) return null;
      scaleButton.click();
      const r = whyPanel.getBoundingClientRect();
      const box = doc.querySelector('.deck-summary');
      const out = {
        open: win.getComputedStyle(whyPanel).display !== 'none',
        width: Math.round(r.width),
        // The document's own overflow, re-measured with the panel out. This is the
        // number the reader feels, since it is what makes the browser rescale.
        overflow: doc.documentElement.scrollWidth - doc.documentElement.clientWidth,
        // How far past the box it explains — the shape the bug takes before it becomes
        // document overflow. Reported separately because the box sits inside the shell's
        // padding, so a panel can clear the box's edge by 20px and still be inside the
        // window: this goes red first, on the wider viewports, where the overflow number
        // alone stays 0 and says nothing is wrong.
        pastBox: box ? Math.round(r.right - box.getBoundingClientRect().right) : null,
        pastWindow: Math.round(r.right - doc.documentElement.clientWidth),
      };
      scaleButton.click(); // put it back, so nothing measured after this sees it open
      return out;
    })(),
    closesOnSecondPress: Boolean(whyPanel) && win.getComputedStyle(whyPanel).display === 'none',
  };
  // After the literal rather than in it, because it reads a sibling key: the press
  // happens once, so whether it opened is one of the things that press found out.
  bracket.opensOnPress = Boolean(bracket.whileOpen && bracket.whileOpen.open);

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

  // "Combos in your deck", and the one thing about it that can render perfectly while
  // being false: the badge counts *combos* and the rows are *cards*, so the two numbers
  // disagree by design. What has to hold is that the panel says so. The sentence under the heading is the only thing
  // standing between a reader and "233 rows, 63 shown", so it is read as text and both
  // numbers are checked against what is actually on the page.
  //
  // ranking is the panel's own order, which is the gutter: most combos carried first.
  // It was the whole point of ranking these rows and nothing else on the page states it.
  const includedPanel = doc.querySelector('#pieces .panel');
  const included = {
    badge: includedPanel ? (includedPanel.querySelector('.panel-count') || {}).textContent || null : null,
    title: includedPanel ? includedPanel.querySelector('.panel-title').textContent : null,
    rows: doc.querySelectorAll('#pieces .panel-body > .combo.suggestion').length,
    note: (doc.querySelector('#pieces .panel-note') || {}).textContent || '',
    notes: captionBoxes(win, doc),
    // Every distinct published combo the panel reaches, counted off the hrefs rather
    // than off the rows: a combo appears once under each of its cards, so the rows
    // outnumber the combos and only the set of ids can be compared with the badge. Our
    // own rows cite the published combo they came from, so they are dropped by the badge
    // they carry — counting them would credit Spellbook with them.
    reached: new Set([...doc.querySelectorAll('#pieces details > .combo')]
      .filter((c) => !c.querySelector('.derived-note'))
      .map((c) => {
        const a = c.querySelector('.combo-link a:not(.alt-all)');
        return a ? a.getAttribute('href') : '';
      })
      .filter(Boolean)).size,
    // The first panel in the results, measured rather than taken off the markup order:
    // this is the answer, and a grid or a float could put it anywhere.
    isFirst: (() => {
      const first = doc.querySelector('#results .panel');
      return Boolean(includedPanel) && first === includedPanel;
    })(),
    ranking: [...doc.querySelectorAll('#pieces .panel-body > .combo.suggestion .row-total')]
      .map((t) => Number(t.textContent)),
  };

  // The combo map. Everything about it is geometry, so nothing about it can be
  // read off the markup: a graph drawn with every node at the same point, or
  // outside its own viewBox, is valid SVG and an empty panel on screen.
  const map = (() => {
    const svg = doc.querySelector('#graph .combo-map');
    if (!svg) return null;
    const box = svg.viewBox.baseVal;
    const dots = [...svg.querySelectorAll('.node .dot')].map((c) => ({
      x: c.cx.baseVal.value, y: c.cy.baseVal.value, r: c.r.baseVal.value,
    }));
    // Hovering a card has to pick out its own corner of the map, or the picture
    // is unreadable the moment a deck has more than a handful of combos in it.
    // The *last* card, which is the one in fewest combos: hovering the busiest
    // one can light the whole map, and then there is nothing dimmed to measure.
    const nodes = [...svg.querySelectorAll('.node')];
    const hovered = nodes[nodes.length - 1];
    if (hovered) hovered.dispatchEvent(new win.PointerEvent('pointerenter', { bubbles: true }));
    const dark = svg.querySelector('.node:not(.is-lit)');
    const lit = {
      nodes: svg.querySelectorAll('.node.is-lit').length,
      edges: svg.querySelectorAll('.edge.is-lit').length,
      dimmed: svg.classList.contains('is-lit'),
      // What the dimming is actually worth, measured rather than assumed: a rule
      // that stopped applying would leave the class on and the map unchanged.
      // null when the hovered card touches everything, which is not a failure.
      faded: dark ? win.getComputedStyle(dark).opacity : null,
    };
    // Read after the pointer leaves, so "the map goes back to normal" is a fact
    // about the page rather than about the order the checks happen to run in.
    svg.dispatchEvent(new win.PointerEvent('pointerleave', { bubbles: true }));

    const combos = [...svg.querySelectorAll('.edge:not(.swap)')];
    const swapEdges = [...svg.querySelectorAll('.edge.swap')];
    const shownCount = (el) => win.getComputedStyle(el).display !== 'none'
      && Number(win.getComputedStyle(el).opacity) > 0.5;

    // Either relation on its own. Nothing about the *cards* may move — the layout
    // is worked out from both at once and the whole promise of the control is
    // that it takes lines away rather than redrawing the map.
    const before = [...svg.querySelectorAll('.node .dot')].map((c) => [c.cx.baseVal.value, c.cy.baseVal.value]);
    const chips = [...doc.querySelectorAll('#graph .map-filter .chip')];
    const chip = (view) => chips.find((c) => c.dataset.view === view);
    const filtered = {};
    const counts = [...svg.querySelectorAll('.count')];
    for (const view of ['swap', 'combo']) {
      if (chip(view)) chip(view).click();
      filtered[view] = {
        combos: combos.filter((e) => win.getComputedStyle(e).display !== 'none').length,
        swaps: swapEdges.filter((e) => win.getComputedStyle(e).display !== 'none').length,
        // A line's number carries the same class the line does, so a view takes the pair
        // together. Without that a view hid every count, including the ones belonging to
        // the lines it was showing — a number floating over nothing.
        countsShown: counts.filter((e) => win.getComputedStyle(e).display !== 'none').length,
        pressed: chip(view) ? chip(view).getAttribute('aria-pressed') : null,
        moved: [...svg.querySelectorAll('.node .dot')]
          .some((c, i) => c.cx.baseVal.value !== before[i][0] || c.cy.baseVal.value !== before[i][1]),
      };
    }
    // Which cards light up, in the view that had it wrong. The lines are already checked
    // above; this is the other half, and the half that shipped broken — the swap view drew
    // dashed lines and lit the hovered card's *combo* partners, several of which have no
    // dashed line to it at all.
    //
    // Read off classes rather than text. Built from the graph the page is drawing so the
    // check cannot drift from the fixture: pick a card that has at least one stand-in and
    // at least one combo-only partner, hover it in the swap view, and the two must differ.
    const swapLit = (() => {
      if (!chip('swap')) return null;
      // The relations, read off the rendered lines. A line's ends are not on the element,
      // so they are matched by geometry against the nodes' own centres — the same numbers
      // the layout wrote out.
      const nodes = [...svg.querySelectorAll('.node')].map((g) => {
        const dot = g.querySelector('.dot');
        return { g, x: dot.cx.baseVal.value, y: dot.cy.baseVal.value };
      });
      const at = (x, y) => nodes.find((n) => Math.abs(n.x - x) < 0.6 && Math.abs(n.y - y) < 0.6);
      const rel = { swap: new Map(), combo: new Map() };
      [...svg.querySelectorAll('.edge')].forEach((e) => {
        const a = at(e.x1.baseVal.value, e.y1.baseVal.value);
        const b = at(e.x2.baseVal.value, e.y2.baseVal.value);
        if (!a || !b) return;
        const kind = e.classList.contains('swap') ? 'swap' : 'combo';
        [[a, b], [b, a]].forEach(([from, to]) => {
          if (!rel[kind].has(from.g)) rel[kind].set(from.g, new Set());
          rel[kind].get(from.g).add(to.g);
        });
      });
      // A card with both kinds of neighbour, and a combo partner that is not also a
      // stand-in — without one of those the check cannot tell the two views apart.
      let subject = null;
      let comboOnly = null;
      for (const n of nodes) {
        const swaps = rel.swap.get(n.g);
        const partners = [...(rel.combo.get(n.g) || [])].filter((p) => !(swaps && swaps.has(p)));
        if (swaps && swaps.size && partners.length) { subject = n; comboOnly = partners[0]; break; }
      }
      if (!subject) return { usable: false };
      chip('swap').click();
      subject.g.dispatchEvent(new win.PointerEvent('pointerenter', { bubbles: true }));
      const standIn = [...rel.swap.get(subject.g)][0];
      const out = {
        usable: true,
        subject: subject.g.getAttribute('aria-label'),
        standInLit: standIn.classList.contains('is-lit'),
        comboOnlyLit: comboOnly.classList.contains('is-lit'),
      };
      svg.dispatchEvent(new win.PointerEvent('pointerleave', { bubbles: true }));
      return out;
    })();

    if (chip('all')) chip('all').click();

    // Picking two cards out. The whole feature is that the answer is about the
    // *pair* — what they share and what cutting them costs — so what is read back
    // is the sentence under the map and which cards are left lit.
    const picked = (() => {
      const line = doc.querySelector('#graph .map-picked');
      const empty = line ? line.textContent : null;
      const cards = [...svg.querySelectorAll('.node')];
      if (!line || cards.length < 2) return null;
      cards[0].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
      const one = line.textContent;
      cards[1].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
      const two = line.textContent;
      const state = {
        empty,
        one,
        two,
        // Pinned cards stay lit with the pointer elsewhere — a selection is a
        // decision and a hover is a look.
        ringed: svg.querySelectorAll('.node.is-picked').length,
        pressed: cards[0].getAttribute('aria-pressed'),
        litNodes: svg.querySelectorAll('.node.is-lit').length,
        focusable: cards[0].getAttribute('tabindex'),
        named: cards[0].getAttribute('aria-label') || '',
        role: cards[0].getAttribute('role'),
        live: line.getAttribute('role'),
      };
      // Pressing the same card again unpicks it, and the background clears.
      cards[1].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
      state.afterSecondPress = svg.querySelectorAll('.node.is-picked').length;
      svg.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
      state.afterBackground = svg.querySelectorAll('.node.is-picked').length;
      state.cleared = line.textContent;
      return state;
    })();

    return {
      picked,
      dots,
      width: Math.round(svg.getBoundingClientRect().width),
      viewBox: [box.width, box.height],
      // Rendered wider than it is tall at every viewport, or the SVG is not
      // scaling with the column and the panel is a letterbox on a phone.
      height: Math.round(svg.getBoundingClientRect().height),
      edges: combos.length,
      // The second relation: cards that stand in for each other, which is the
      // half of the map a list cannot show at all.
      swapEdges: swapEdges.length,
      swapDashed: swapEdges.length ? win.getComputedStyle(swapEdges[0]).strokeDasharray : '',
      tiers: [...new Set(combos.map((e) => (
        e.classList.contains('tier-win') ? 'win' : e.classList.contains('tier-decisive') ? 'decisive' : 'other'
      )))].sort(),
      // The colour has to survive CSS, not just be in a class name.
      edgeColours: [...new Set(combos.map((e) => win.getComputedStyle(e).stroke))].length,
      // The explicit number on a line, and the ones kept back for the hover.
      counts: [...svg.querySelectorAll('.count')].filter(shownCount).map((t) => t.textContent),
      hiddenCounts: svg.querySelectorAll('.count.is-crowded').length,
      // A number has to sit on the line it belongs to, not somewhere in the middle
      // of the picture.
      countsOnLines: [...svg.querySelectorAll('.count')].filter(shownCount).every((t) => {
        const x = Number(t.getAttribute('x'));
        const y = Number(t.getAttribute('y'));
        return [...svg.querySelectorAll('.edge')].some((e) => {
          const x1 = Number(e.getAttribute('x1'));
          const y1 = Number(e.getAttribute('y1'));
          const x2 = Number(e.getAttribute('x2'));
          const y2 = Number(e.getAttribute('y2'));
          const len = Math.hypot(x2 - x1, y2 - y1) || 1;
          // Distance from the point to the line the segment lies on.
          const off = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / len;
          const within = Math.min(x1, x2) - 40 <= x && x <= Math.max(x1, x2) + 40
            && Math.min(y1, y2) - 40 <= y && y <= Math.max(y1, y2) + 40;
          return off < 40 && within;
        });
      }),
      legend: [...doc.querySelectorAll('#graph .map-legend li')].length,
      filtered,
      swapLit,
      labels: [...svg.querySelectorAll('.node .label')].map((t) => t.textContent),
      titled: [...svg.querySelectorAll('.node > title')].map((t) => t.textContent),
      lineTitles: [...svg.querySelectorAll('.edge > title')].map((t) => t.textContent),
      described: (svg.querySelector(':scope > title') || {}).textContent || '',
      role: svg.getAttribute('role'),
      lit,
      stillLit: svg.classList.contains('is-lit'),
    };
  })();

  const firstCombo = tieredCombo(doc);
  const chips = firstCombo ? [...firstCombo.querySelectorAll('.results .result')].map((c) => ({
    text: c.textContent, win: c.classList.contains('tier-win'),
    decisive: c.classList.contains('tier-decisive'),
    grey: c.classList.contains('tier-other'), more: c.classList.contains('more'),
    title: c.title || '', colour: win.getComputedStyle(c).color,
  })) : [];
  const header = {
    pips: [...doc.querySelectorAll('.identity-line .pip')].map((p) => ({
      // The pip holds a drawn glyph now, so its letter lives in an attribute. Reading
      // textContent here would return the empty string for every colour and compare
      // clean against another empty string.
      letter: p.getAttribute('data-colour'),
      label: p.getAttribute('aria-label'),
      background: win.getComputedStyle(p).backgroundColor,
      // The drawn glyph inside the disc — a sun, a drop, a skull, a fireball, a tree.
      // Measured rather than counted: display:none on it leaves the element in the DOM
      // and every other assertion here passing, which is what happened when this was
      // checked by hand and the whole suite stayed green over five blank circles.
      art: (() => {
        const art = p.querySelector('.pip-art');
        if (!art) return 0;
        const box = art.getBoundingClientRect();
        return Math.round(Math.min(box.width, box.height));
      })(),
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
    stuckSlot,
    unknownCards,
    deckSummary,
    legality,
    comboCompare,
    gutterNeeds,
    signAlign,
    headingShape,
    linkLine,
    leads,
    bracket,
    dataAge,
    numberColumns,
    sizes,
    dividers,
    included,
    map,
    width: win.innerWidth,
    overflow: doc.documentElement.scrollWidth - doc.documentElement.clientWidth,
    footer: deployedFooter(win, doc),
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

// Wait for the search to have rendered, rather than guessing how long it takes.
//
// This used to be a flat 500ms after submitting the form. The first run of the
// suite pays for the database download *and* the parse, so on a slower machine
// that guess lost: nothing was on screen, doc.querySelector('.combo') returned
// null, and the next line died with "Cannot read properties of null" — a crash
// where the truth was "the search had not finished yet". Worse, it cascaded: the
// run that crashed never populated the cache, so the following run reported its
// data as coming from the network and failed too.
//
// Polls for the condition and gives up loudly, naming the page's own status line,
// which is where a real failure to search says so.
async function settled(doc, selector, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 15000);
  while (!doc.querySelector(selector) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!doc.querySelector(selector)) {
    const status = (doc.getElementById('status') || {}).textContent || '(no status)';
    throw new Error('nothing matched ' + selector + ' within '
      + ((timeoutMs || 15000) / 1000) + 's of the search — status: "' + status + '"');
  }
  // One more tick, so panels rendered in the same pass are all in place before
  // anything is measured.
  await new Promise((r) => setTimeout(r, 120));
}

// The share link, end to end: a deck typed in, kept without a search, put into
// the URL by Copy link, and read back out of that URL by a page that has never
// seen it. Every step of that is our own encoding, so none of it is safe to
// assume — a link that silently loses the deck is worse than no link at all.
// The theme control, end to end: the colours really change, the label really
// follows, and the choice really survives a reload. Every one of those is a thing
// that can be wired backwards while looking correct in the markup — and the reason
// the button exists at all is that prefers-color-scheme alone decided for the
// reader, so "does it override the system" is the assertion that matters most.
//
// Runs inside the harness page, so no backticks and no template literals in here:
// this whole region is itself inside one.
async function runTheme(vp) {
  const out = { ok: true, name: vp.name, requested: vp.width, theme: {} };
  const paint = (win, doc) => {
    const button = doc.getElementById('theme-toggle');
    const shown = (sel) => {
      const icon = button && button.querySelector(sel);
      return Boolean(icon) && win.getComputedStyle(icon).display !== 'none';
    };
    return {
      attr: doc.documentElement.dataset.theme,
      bg: win.getComputedStyle(doc.body).backgroundColor,
      text: win.getComputedStyle(doc.body).color,
      // The button carries no text, so the accessible name is the only wording a
      // reader gets — on hover, or read out.
      label: button ? button.getAttribute('aria-label') : null,
      // Exactly one icon should ever be on screen. Read from the computed style, so
      // this is what CSS actually did rather than which classes are present.
      icon: [shown('.icon-moon') ? 'moon' : null, shown('.icon-sun') ? 'sun' : null].filter(Boolean).join('+'),
      hidden: button ? button.hidden : null,
    };
  };
  try {
    const first = await load('/index.html', vp.width);
    first.win.localStorage.clear();
    // Reloaded after clearing, so this is a genuinely first visit: no stored choice,
    // and the theme is whatever the headless browser asks for.
    const fresh = await load('/index.html', vp.width);
    out.theme.initial = paint(fresh.win, fresh.doc);

    const button = fresh.doc.getElementById('theme-toggle');
    if (!button) throw new Error('no theme toggle on the page');
    button.click();
    await new Promise((r) => setTimeout(r, 60));
    out.theme.afterPress = paint(fresh.win, fresh.doc);
    out.theme.stored = fresh.win.localStorage.getItem('mtg-combo-finder.theme');

    // The whole point of storing it. A fresh document, no query string, and the
    // choice has to still be in force before anything is pressed.
    const returning = await load('/index.html', vp.width);
    out.theme.onReturn = paint(returning.win, returning.doc);

    // Pressing it again goes back, and that must also be remembered — a toggle that
    // only sticks in one direction is a trap.
    const back = returning.doc.getElementById('theme-toggle');
    back.click();
    await new Promise((r) => setTimeout(r, 60));
    out.theme.afterSecondPress = paint(returning.win, returning.doc);
    out.theme.storedAfterSecond = returning.win.localStorage.getItem('mtg-combo-finder.theme');

    // The second page carries the same control, and it is the same choice: a theme
    // that resets when you follow a link is not a preference.
    const tiers = await load('/tiers.html', vp.width);
    out.theme.tiersPage = paint(tiers.win, tiers.doc);
  } catch (err) {
    return { ok: false, name: vp.name, error: String((err && err.stack) || err) };
  }
  return out;
}

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
    // The combination nothing covered until unofficial.js and search.js stopped being
    // in the HTML. The no-worker viewport proves the fallback runs; this proves the
    // scripts it injects carry the stamp — and the sandbox 404s any .js that does not,
    // so an unstamped injection fails here rather than silently serving a CDN copy in
    // production. app.js reads Worker lazily, so removing it after load is enough.
    if (vp.noWorker) delete win.Worker;
    doc.getElementById('decklist').value = DECKS[vp.deck];
    doc.getElementById('deck-form').dispatchEvent(new win.Event('submit', { cancelable: true }));
    await settled(doc, '.combo');
    const age = doc.getElementById('data-age');
    return {
      ok: true,
      name: vp.name,
      requested: vp.width,
      stamped: {
        via: age ? age.dataset.via : null,
        noWorker: !!vp.noWorker,
        panels: doc.querySelectorAll('.panel').length,
        // Read after the search, so the two scripts app.js injects are in the DOM by
        // now and their URLs are part of what gets checked for the stamp.
        scripts: [...doc.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')),
      },
    };
  } catch (err) {
    return { ok: false, name: vp.name, error: String((err && err.stack) || err) };
  }
}

// Whether the list is allowed, which needs a deck that is not: the tuning deck is
// legal, and making it illegal would mean changing its colours, its combos and its
// ordering — all of which the run above asserts. So this is its own run, like the
// unofficial panel's, with only the legality line in scope.
async function runLegality(vp) {
  try {
    const { win, doc } = await load('/index.html', vp.width);
    win.localStorage.clear();
    doc.getElementById('commanders').value = '';
    doc.getElementById('decklist').value = DECKS[vp.deck];
    doc.getElementById('deck-form').dispatchEvent(new win.Event('submit', { cancelable: true }));
    await settled(doc, '.combo');

    const box = doc.querySelector('#legality .legality');
    // One <li> per card now, so this reads the names off the list items rather than off a
    // run of spans. Same query either way -- what changed is that a name is a line.
    const cardsIn = (sel) => [...doc.querySelectorAll(sel + ' .legality-cards li .card-name')]
      .map((e) => e.textContent);
    const claim = (sel) => (doc.querySelector(sel + ' .legality-claim') || {}).textContent || '';
    const claimPips = (sel) => [...doc.querySelectorAll(sel + ' .legality-claim .pip')]
      .map((pip) => pip.getAttribute('data-colour')).join('');
    const bracket = doc.querySelector('#bracket .bracket-line');
    const firstPanel = doc.querySelector('#results .panel');
    return {
      ok: true,
      name: vp.name,
      requested: vp.width,
      deck: vp.deck,
      legality: {
        shown: !!box,
        banned: cardsIn('#legality .is-banned'),
        bannedClaim: claim('#legality .is-banned'),
        offIdentity: cardsIn('#legality .is-off-identity'),
        colours: [...doc.querySelectorAll('#legality .is-off-identity .legality-colours')]
          .map((e) => [...e.querySelectorAll('.pip')].map((pip) => pip.getAttribute('data-colour')).join('')),
        // How many distinct lines those names occupy -- by their top edge, not by how
        // many list items there are, so a rule that put two <li> side by side would fail
        // this rather than pass it on markup alone.
        cardLines: new Set([...doc.querySelectorAll('#legality .is-off-identity .legality-cards li')]
          .map((li) => Math.round(li.getBoundingClientRect().top))).size,
        identityClaim: claim('#legality .is-off-identity'),
        identityClaimPips: claimPips('#legality .is-off-identity'),
        notes: [...doc.querySelectorAll('#legality .legality-note')].map((e) => e.textContent),
        // Beside the bracket: under that line, above the first panel of results.
        besideBracket: !!(box && bracket && firstPanel
          && box.getBoundingClientRect().top >= bracket.getBoundingClientRect().top
          && box.getBoundingClientRect().top < firstPanel.getBoundingClientRect().top),
        // Two accusations, so two colours. The ban is the format refusing the deck
        // and takes --error; a card in the wrong colours does not.
        bannedColour: doc.querySelector('#legality .is-banned .legality-claim')
          ? win.getComputedStyle(doc.querySelector('#legality .is-banned .legality-claim')).color
          : null,
        identityColour: doc.querySelector('#legality .is-off-identity .legality-claim')
          ? win.getComputedStyle(doc.querySelector('#legality .is-off-identity .legality-claim')).color
          : null,
        overflow: doc.documentElement.scrollWidth > vp.width,
      },
    };
  } catch (err) {
    return { ok: false, name: vp.name, error: String((err && err.stack) || err) };
  }
}

// The unofficial panel, against the real unofficial.js rather than a fixture — the
// data is small enough to ship and its rows are the thing being checked. The
// fixture dataset does not need to know about any of it: an unofficial row matches
// on the deck alone, so a deck of exactly one row's cards finds nothing official
// and exactly one unofficial combo, which is the cleanest possible reading.
async function runUnofficial(vp) {
  try {
    const { win, doc } = await load('/index.html', vp.width);
    win.localStorage.clear();
    doc.getElementById('commanders').value = '';
    doc.getElementById('decklist').value = DECKS[vp.deck];
    doc.getElementById('deck-form').dispatchEvent(new win.Event('submit', { cancelable: true }));
    await settled(doc, '#unofficial .combo');

    const panel = doc.querySelector('#unofficial .panel');
    const row = doc.querySelector('#unofficial .combo');
    // Each badge asked for by what it is, not by being first. A row carries two now —
    // whose it is, then how far the checking went — and reading ".derived-badge" got
    // whichever the markup happened to put first, which is the one that just changed.
    const badge = row && row.querySelector('.derived-badge.verified, .derived-badge.derived');
    const whose = row && row.querySelector('.derived-badge.unofficial');
    const link = row && row.querySelector('.combo-link a');
    const combos = doc.getElementById('pieces');
    const unofficial = doc.getElementById('unofficial');
    // Which comes first on the page. Published combos have to be read before ours.
    const order = combos.compareDocumentPosition(unofficial);

    return {
      ok: true,
      name: vp.name,
      requested: vp.width,
      steps: vp.steps || 1,
      // "Combos in your deck" counts both now, in two numbers rather than one.
      // This deck has no published combos at all, so every card in that panel is
      // there on our authority — which is precisely the case the panel used to
      // answer by leaving the card out.
      pieces: {
        rows: doc.querySelectorAll('#pieces .row-name').length,
        ours: doc.querySelectorAll('#pieces .row-split .ours').length,
        totals: doc.querySelectorAll('#pieces .row-numbers .row-total').length,
        text: (doc.querySelector('#pieces .row-total') || {}).textContent || null,
        split: doc.querySelector('#pieces .row-split')
          ? visibleTextIn(win, doc.querySelector('#pieces .row-split'))
          : null,
        // The words the numerals replaced. This deck has nothing published, so
        // "none published" is the whole point of its rows — and it is now said
        // here rather than on screen, which is exactly why it is asserted.
        spoken: (doc.querySelector('#pieces .row-split') || {}).getAttribute
          ? doc.querySelector('#pieces .row-split').getAttribute('aria-label') || ''
          : '',
      },
      unofficial: {
        // How many swaps the note spells out, which has to be how many the row
        // actually took: a two-step row shown as one step is the page claiming
        // more than the file does.
        steps: row ? (row.querySelector('.derived-note').textContent.match(/in place of/g) || []).length : 0,
        title: panel ? panel.querySelector('.panel-title').textContent : null,
        count: panel ? panel.querySelector('.panel-count').textContent : null,
        rows: doc.querySelectorAll('#unofficial .combo').length,
        cards: row ? [...row.querySelectorAll('h3 .card-name')].map(function (n) { return n.textContent; }) : [],
        badge: badge ? badge.textContent : null,
        badgeClass: badge ? badge.className : null,
        badgeColour: badge ? win.getComputedStyle(badge).color : null,
        whose: whose ? whose.textContent : null,
        // Which of the two a reader meets first. Whose row it is decides whether the
        // rest of the note is worth reading at all, so it leads.
        whoseFirst: (whose && badge)
          ? (whose.compareDocumentPosition(badge) & 4) === 4 : null,
        whoseColour: whose ? win.getComputedStyle(whose).color : null,
        note: row && row.querySelector('.derived-note') ? row.querySelector('.derived-note').textContent : '',
        link: link ? link.textContent : null,
        href: link ? link.getAttribute('href') : null,
        chips: row ? row.querySelectorAll('.results .result').length : 0,
        // Nothing published for this deck, and the panel has to say so in words: the
        // badge is absent — there is no published total to show — so the sentence under
        // the heading is the only thing left that can. And no row in the panel may claim
        // to be published: every combo it reaches is ours, so every one carries the badge
        // saying so.
        officialEmpty: /none published by Commander Spellbook/
          .test((doc.querySelector('#pieces .panel-note') || {}).textContent || ''),
        officialRows: [...doc.querySelectorAll('#pieces details > .combo')]
          .filter(function (c) { return !c.querySelector('.derived-note'); }).length,
        // DOCUMENT_POSITION_FOLLOWING is 4.
        unofficialIsBelow: (order & 4) === 4,
        // The two panels' opening sentences, which sit one above the other and have to
        // read as a pair. The unofficial one used to be .empty -- a colour and nothing
        // else -- so it ran the panel's whole width at 1rem while the note above it
        // wrapped at 62ch of .92rem, and the difference said nothing. Measured rather
        // than asserted by class name: the point is what a reader sees, and two classes
        // could agree in the markup and still lay out differently.
        //
        // No backticks in here, deliberately: this whole function is inside the HARNESS
        // template literal, and one in a comment ends it.
        notes: captionBoxes(win, doc),
        overflow: doc.documentElement.scrollWidth > vp.width,
      },
    };
  } catch (err) {
    return { ok: false, name: vp.name, error: String((err && err.stack) || err) };
  }
}

// A card suggested on the strength of unofficial combos alone. The panel has
// always been able to say "+7"; what it could not say until now is "+0 published,
// +4 of ours", and a card whose whole case is ours was simply absent from it.
async function runSuggested(vp) {
  try {
    const { win, doc } = await load('/index.html', vp.width);
    win.localStorage.clear();
    doc.getElementById('commanders').value = '';
    doc.getElementById('decklist').value = DECKS[vp.deck];
    doc.getElementById('deck-form').dispatchEvent(new win.Event('submit', { cancelable: true }));
    await settled(doc, '#suggestions .combo');

    const pane = doc.querySelector('#suggestions .tab-pane:not([hidden])');
    const ours = pane ? pane.querySelectorAll('.row-split .ours') : [];
    const row = ours.length ? ours[0].closest('.combo') : null;
    return {
      ok: true,
      name: vp.name,
      requested: vp.width,
      suggested: {
        rows: pane ? pane.querySelectorAll('.combo').length : 0,
        // The row's own column, so the split's reading can be checked as a rule
        // rather than pinned to whichever width this run happens to use.
        column: (() => {
          const body = doc.querySelector('#suggestions .panel-body');
          if (!body) return 0;
          const cs = win.getComputedStyle(body);
          return Math.round(body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
        })(),
        ours: ours.length,
        text: ours.length ? visibleTextIn(win, ours[0]) : null,
        split: row ? visibleTextIn(win, row.querySelector('.row-split')) : null,
        // The claim the numerals stand for. On screen this row is "0+1"; that it
        // means "none published" is carried by the accessible name, so that is
        // where it gets checked.
        spoken: row ? row.querySelector('.row-split').getAttribute('aria-label') || '' : '',
        // One total on the row, carrying both halves.
        totals: row ? row.querySelectorAll('.row-total').length : 0,
        total: row ? row.querySelector('.row-total').textContent : null,
        // ...and the combos behind them are listed in one order, ours among Spellbook's,
        // with each row of ours saying so on itself. There is no heading to read any more:
        // splitting the list made "who published this" decide where a row sits, and that
        // is what the badge replaced. So what gets checked is that the disclosure holds
        // rows, and that every row of ours in it carries the badge — a merged list where
        // the badge went missing is a list that silently attributes our work to Spellbook.
        listed: row ? row.querySelectorAll('details > .combo').length : 0,
        ourRows: row ? row.querySelectorAll('details > .combo .derived-note').length : 0,
        ourBadges: row ? row.querySelectorAll('details > .combo .derived-badge.unofficial').length : 0,
        // Nothing may reintroduce a heading between them: it would put the rows of ours
        // back below a divider and undo the ordering they were merged for.
        splitHeads: row ? row.querySelectorAll('details > .ours-head').length : 0,
        // The unofficial half has to be visibly its own claim: a colour of its
        // own against the published half beside it, rather than the same grey.
        colour: ours.length ? win.getComputedStyle(ours[0]).color : null,
        muted: row ? win.getComputedStyle(row.querySelector('.row-split .official')).color : null,
        overflow: doc.documentElement.scrollWidth > vp.width,
      },
    };
  } catch (err) {
    return { ok: false, name: vp.name, error: String((err && err.stack) || err) };
  }
}

function runOne(vp) {
  if (vp.kind === 'suggested') return runSuggested(vp);
  if (vp.kind === 'theme') return runTheme(vp);
  if (vp.kind === 'share') return runShare(vp);
  if (vp.kind === 'stamped') return runStamped(vp);
  if (vp.kind === 'unofficial') return runUnofficial(vp);
  if (vp.kind === 'legality') return runLegality(vp);
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

        // What is on screen the first time the browser can paint after a search.
        //
        // renderResults() builds "Combos in your deck", yields, and builds the panels
        // below it a frame later — because a browser cannot paint in the middle of a
        // task, so a single-task render made a reader wait for panels several screens
        // down before seeing anything at all. On a 520-combo deck at 390px with the CPU
        // throttled 4x that was the difference between 3,094ms and 797ms to the answer.
        //
        // The finished page looks identical either way, so the yield is checked at the
        // one moment it is observable: a frame booked from the top of the render cannot
        // run until that task ends, and what is filled in by then is what the reader got.
        // comboPieces() is the first thing renderResults() calls, and it is called from
        // nowhere else — which is what makes it the hook rather than a convenience.
        const firstFrame = {};
        const comboPieces0 = win.DeckCombos.comboPieces;
        let booked = false;
        win.DeckCombos.comboPieces = function () {
          if (!booked) {
            booked = true;
            win.requestAnimationFrame(function () {
              const filled = function (id) {
                const node = doc.getElementById(id);
                return Boolean(node && node.getElementsByTagName('*').length > 3);
              };
              firstFrame.included = filled('pieces');
              firstFrame.graph = filled('graph');
              firstFrame.suggestions = filled('suggestions');
            });
          }
          return comboPieces0.apply(this, arguments);
        };

        doc.getElementById('deck-form').dispatchEvent(new win.Event('submit', { cancelable: true }));
        await settled(doc, '.combo');
        win.DeckCombos.comboPieces = comboPieces0;

        // Open every card's combos before anything is measured. This is not a
        // convenience: a combo row is only drawn inside one of these disclosures now, and
        // a row inside a closed one has no geometry at all — every rect is 0. Left shut,
        // the heading-shape, chip-colour, pill-inset and divider checks would all read
        // boxes the browser never laid out, agree with themselves, and pass. Opened once
        // here rather than per check so every one of them measures the same page.
        [...doc.querySelectorAll('#pieces .combo.suggestion > details')]
          .forEach(function (d) { d.open = true; });
        await new Promise((r) => setTimeout(r, 80));

        const before = measure(win, doc);

        // Tier ordering pushes the grey plumbing behind "+N more", so the fold
        // has to be opened before all three colours are on screen at once.
        // Scope to the same combo card throughout: the pieces panel re-renders
        // these, so a document-wide query picks up other cards' unopened folds.
        // The same row measure() read its chips from, or the folded and open numbers
        // below are two rows' heights compared against each other.
        const combo0 = tieredCombo(doc);
        const results0 = combo0.querySelector('.results');
        // The height the fold is buying, measured on the same element either side of the
        // press. This is the whole point of folding grey, so it is worth a number rather
        // than an assumption that hiding four chips must have saved something.
        const foldedHeight = results0 ? Math.round(results0.getBoundingClientRect().height) : 0;
        const moreBtn = combo0.querySelector('.results .result.more');
        if (moreBtn) moreBtn.click();
        await new Promise((r) => setTimeout(r, 60));
        const resultsHeight = {
          folded: foldedHeight,
          open: results0 ? Math.round(results0.getBoundingClientRect().height) : 0,
        };
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
          // The deck-counts strip has to move with the deck, and it is the one thing on
          // the page that describes the decklist rather than the search — so a render
          // that rebuilt every panel and left the strip alone would look entirely
          // correct. It said 101 cards before this check existed and would have gone on
          // saying 101 after the add.
          countsBefore: before.deckSummary.rows.map((r) => r.key + ' ' + r.n).join(' | '),
          // The map is drawn from the search's own results, so it has to move
          // with them. A picture that is one search behind the list beside it is
          // worse than no picture — it says the added card is in no combos.
          mapBefore: before.map ? before.map.dots.length : 0,
        };
        // The map's column width used to be read as body.clientWidth in the middle of
        // the render. Reading a geometry property flushes style and layout for the whole
        // document, and this one ran after "Combos in your deck" had been rebuilt and
        // before the pieces and suggestions panels went in — so the page was laid out
        // twice per search, and the first one bought nothing but a number. On a
        // 520-combo deck at 390px with the CPU throttled 4x it was 601ms of a 3,620ms
        // search. It comes off a ResizeObserver now, where layout is already settled.
        //
        // A count and not a duration, because a regression here is invisible twice over:
        // the page draws exactly the same map, and a timing threshold on a shared runner
        // is a flake. render-map.js:columnWidth() holds the only synchronous read of this
        // property in the shipped page, and on a re-search it must not be reached at all
        // — the cache is warm by now, and the fallback is for the first search only.
        const widthDesc = Object.getOwnPropertyDescriptor(win.Element.prototype, 'clientWidth');
        let widthReads = 0;
        Object.defineProperty(win.Element.prototype, 'clientWidth', {
          configurable: true,
          get: function () { widthReads += 1; return widthDesc.get.call(this); },
        });
        if (addBtn) {
          addBtn.click();
          // Wait for the count to move rather than for a guessed interval: the whole
          // claim here is "adding a card left the deck holding more combos", so a
          // fixed wait would decide the assertion it is supposed to be testing. If
          // the re-search never happens the loop simply times out and the existing
          // check reports the numbers, which is the failure worth reading.
          const wasBadge = before.included.badge;
          const moved = Date.now() + 15000;
          while (Date.now() < moved) {
            const nowBadge = (doc.querySelector('#pieces .panel-count') || {}).textContent;
            if (nowBadge && nowBadge !== wasBadge) break;
            await new Promise((r) => setTimeout(r, 50));
          }
          await new Promise((r) => setTimeout(r, 120));
          // Read before measure(), which reads geometry everywhere by design and would
          // swamp the count. renderResults() is synchronous, so by the time the badge
          // above was seen to move the whole re-search has already been drawn.
          afterAdd.widthReads = widthReads;
          const now = measure(win, doc);
          // The escape is doubled because this whole harness is a template literal
          // in tools/verify-layout.js: a lone \\n would become a real newline here
          // and break the string it sits in.
          // Where the card actually landed, not merely that the box grew. "the last
          // line" was the old check and it encoded the bug: a list ending in a
          // sideboard section put the card under the heading, where it parses as a
          // sideboard card and never enters the deck.
          const box = doc.getElementById('decklist').value;
          const lines = box.split('\\n').map(function (l) { return l.trim(); });
          afterAdd.lastLine = lines.filter(Boolean).pop();
          afterAdd.cardLine = lines.indexOf('1 ' + afterAdd.card);
          afterAdd.sectionLine = lines.findIndex(function (l) { return /^side\\s*board/i.test(l); });
          afterAdd.status = doc.getElementById('status').textContent;
          afterAdd.combosAfter = now.included.badge;
          afterAdd.countsAfter = now.deckSummary.rows.map((r) => r.key + ' ' + r.n).join(' | ');
          afterAdd.mapAfter = now.map ? now.map.dots.length : 0;
          afterAdd.mapHasCard = now.map
            ? now.map.titled.some(function (t) { return t.indexOf(afterAdd.card) === 0; })
            : false;
          afterAdd.suggestionsAfter = now.tabs.length ? now.tabs[0].count : null;
          // Kept immediately rather than on the typing debounce: the search that
          // follows must not be able to outrun the save.
          const kept = win.localStorage.getItem('mtg-combo-finder.deck');
          afterAdd.kept = kept ? JSON.parse(kept).decklist : '';
        }
        // Put the real accessor back before anything else measures the page.
        Object.defineProperty(win.Element.prototype, 'clientWidth', widthDesc);

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

        resolve(Object.assign({ ok: true, name: vp.name, requested: vp.width, deck: vp.deck }, before,
          { afterCollapse, expandedChips, resultsHeight, afterAdd, storedDeck, afterClear, firstFrame }));
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
          footer: deployedFooter(win, doc),
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

// Appended to both harnesses, for the checks both pages need. Neither page owns the
// footer's build line — it is stamped into each of them by the same deploy step — so a
// probe for it that lived in one harness would check one page and quietly leave the
// other to production.
const SHARED = `<script>
const DEPLOYED_BUILD_LINE = ${JSON.stringify(DEPLOYED_BUILD_LINE)};

// The footer as deployed, measured rather than assumed. See DEPLOYED_BUILD_LINE for
// why this run cannot just read what it serves.
//
// hasMarker is not a formality. If #built is ever dropped from a page the substitution
// below matches nothing, and every number after it describes the local line while
// looking like it covered the deployed one — a check that passes for a footer it never
// saw. The deploy's grep guard catches the removal too, but a step later, and only
// after the page is built.
function deployedFooter(win, doc) {
  const line = doc.querySelector('.build');
  const marker = line && line.querySelector('#built');
  if (!line || !marker) return { hasMarker: false, added: 0, height: 0, text: '' };
  const before = line.innerHTML;
  const baseline = doc.documentElement.scrollWidth - doc.documentElement.clientWidth;
  line.innerHTML = DEPLOYED_BUILD_LINE;
  const out = {
    hasMarker: true,
    // The footer's own contribution to the overflow, not the document's total. A page
    // already overflowing for an unrelated reason is reported by the check that owns
    // that, and must not be reported a second time here as a footer problem.
    added: (doc.documentElement.scrollWidth - doc.documentElement.clientWidth) - baseline,
    height: Math.round(line.getBoundingClientRect().height),
    text: line.textContent,
  };
  line.innerHTML = before;
  return out;
}
</script>`;

// The other half of the probe above, and shared for the same reason: one deploy step
// stamps this line into both pages, so one rule judges it on both. Split across the
// two reporting loops, the tier page's footer would answer to whatever that loop
// happened to check, which for the whole of this line's history was nothing.
// Printed on every viewport's ok line, so the check cannot pass quietly for a footer
// it never measured. "deployed footer" with no height beside it would be the visible
// shape of a probe that found no marker — which is a failure above, but this is what
// makes a green run legible rather than merely green.
function footerNote(f) {
  if (!f || !f.hasMarker) return 'NO deployed footer measured';
  return `deployed footer ${f.height}px, ${f.added}px overflow`;
}

function footerProblems(f) {
  if (!f) return ['no footer measurement in this capture — deployedFooter() did not run'];
  if (!f.hasMarker) {
    return ['the footer has no #built marker: the deploy has nothing to stamp the time into, '
      + 'and the width check found no line to measure'];
  }
  // Wrapping onto a second line is fine and expected at 390px — 48 characters do not
  // fit a phone's footer and were never going to. Overflowing the document is not:
  // that is the whole page scrolling sideways for a line nobody reads on purpose.
  return f.added > 0
    ? [`the deployed build line overflows by ${f.added}px ("${f.text}")`]
    : [];
}

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
  // Through the deploy's own rewrite, not a second regex beside it. This fixture
  // exists to prove the deploy's stamping works; built from a different rule, it
  // would eventually prove that a rule nobody ships works.
  const stamped = rewriteAssets(html, (url) => `/stamped/${url}${STAMP}`);
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
      // Buffered and decoded ONCE, which is the whole of this fix. `body += chunk`
      // stringifies every chunk on its own, so a character whose UTF-8 bytes straddle a
      // chunk boundary arrives as replacement characters — and the verdict is a JSON POST
      // carrying every string this tool measured. It cost three commits: `verify` failed at
      // 390px and only there, on the same card every time, with "Basalt Monolith ?? in 7
      // combos", and no local run could reproduce it because the sandbox chunks the body
      // differently than CI does. The em dash in render-map.js's hover text simply happened
      // to land on the boundary in the phone verdict.
      //
      // Worth being plain about the size of it: nothing was wrong with the page, and this
      // could have corrupted any measured string in any check — silently, since U+FFFD
      // inside a JSON string parses perfectly well.
      const chunks = [];
      req.on('data', (chunk) => { chunks.push(chunk); });
      req.on('end', () => {
        res.end('ok');
        onVerdict(Buffer.concat(chunks).toString('utf8'));
      });
      return undefined;
    }
    if (extra[url]) {
      res.setHeader('Content-Type', extra[url].type);
      return res.end(extra[url].body);
    }
    // The steps tree is answered from the fixture and from nowhere else. Left to
    // fall through, a checkout that had once run tools/fetch-combos.js would serve
    // its own `steps/` here and the test would quietly start depending on whatever
    // Commander Spellbook published that morning.
    if (url.startsWith('/steps/')) {
      res.statusCode = 404;
      return res.end('no steps for ' + url);
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
      ...STEPS_FILES,
      '/combos.json': { type: 'application/json', body: JSON.stringify(fixture) },
      '/_page.html': { type: 'text/html', body: harness + SHARED + REPORTER },
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

  // Served the way the deploy publishes it — interned, most ids derived — so a page
  // that forgets DeckCombos.decode() fails here rather than in production. It did:
  // tiers.html shipped without the call and sat on "Loading the combo database…",
  // with both of this file's tier runs green the whole time.
  const verdicts = await collect(asPublished(FIXTURE), HARNESS, 'The deck page');

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
      const expectVia = s.noWorker ? 'page' : 'worker';
      if (s.via !== expectVia) {
        wrong.push(s.noWorker
          ? `the search ran in the ${s.via}, expected the page — Worker was removed`
          : `the search ran in the ${s.via} — a stamped worker or one of its imports did not load`);
      }
      // The stamp has to travel three hops that no sed can reach: app.js building the
      // worker's URL, the worker building its importScripts URLs, and app.js injecting
      // unofficial.js and search.js when there is no worker at all. The sandbox already
      // fails the run if any is dropped — this only says which, since "the search ran
      // in the page" is a symptom, not a cause.
      //
      // Which files to expect depends on which path ran: with no worker, search-worker.js
      // is never requested and the two lazy scripts are, injected by app.js. With a
      // worker they all arrive, because the worker imports them.
      const expectStamped = s.noWorker
        ? ['unofficial.js', 'search.js']
        : ['search-worker.js', 'result-tiers.js', 'combos.js', 'unofficial.js', 'search.js'];
      for (const file of expectStamped) {
        if (!REQUESTS.some((u) => u === `/stamped/${file}${STAMP}`)) {
          wrong.push(`${file} was never requested with the stamp — it would be served from whatever the CDN cached`);
        }
      }
      if (s.panels < 3) wrong.push(`only ${s.panels} panels rendered from a stamped page`);
      if (wrong.length) {
        failed = true;
        console.error(`FAIL ${v.name} — ${wrong.join('; ')}`);
      } else {
        // Reads `via` rather than asserting it in prose. The line said "searched in the
        // worker" unconditionally, which on the no-worker run reported the opposite of
        // what happened next to a tick.
        console.log(`ok   ${v.name} — ${s.scripts.length} stamped scripts, searched in the ${s.via}, ${s.panels} panels`);
      }
      continue;
    }

    // A suggestion whose case is entirely ours. The number has to be there — a
    // card with real impact that the page cannot mention is the bug this fixes —
    // and it has to be visibly a different claim from the published count.
    if (v.suggested) {
      const g = v.suggested;
      const wrong = [];
      if (!g.rows) wrong.push('nothing was suggested at all');
      if (!g.ours) wrong.push('no unofficial count on any suggestion');
      // Spelled out where the row's column has room, compact where it has not —
      // the same rule the main runs check, asked here of a row whose whole case is
      // ours. This viewport list runs it at both widths on purpose.
      const words = g.column >= 560;
      if (g.text !== (words ? '1 unofficial' : '1')) {
        wrong.push(`the unofficial half reads "${g.text}" in a ${g.column}px column`);
      }
      // One total, carrying both halves; the split says what it is made of.
      if (g.totals !== 1) wrong.push(`${g.totals} totals on the row, expected 1`);
      if (g.total !== '+1') wrong.push(`the total reads "${g.total}"`);
      if (g.split !== (words ? '0 official · 1 unofficial' : '0+1')) {
        wrong.push(`the split reads "${g.split}" in a ${g.column}px column`);
      }
      // The numerals are half the claim and colour is the other half, so the
      // sentence has to survive somewhere a screen reader can reach it. A row whose
      // whole case is ours saying nothing about that is the bug this run exists for.
      if (!/none published/.test(g.spoken || '')) wrong.push(`the split is unspoken: "${g.spoken}"`);
      if (!g.listed) wrong.push('the suggestion lists no combos at all');
      if (!g.ourRows) wrong.push('no row in the list is one of ours, so the badge is untested');
      if (g.ourBadges !== g.ourRows) {
        wrong.push(`${g.ourRows} of our rows carry ${g.ourBadges} badges saying so`);
      }
      if (g.splitHeads) wrong.push('the list is split by a heading again, not ordered as one');
      // Outlined in the accent rather than filled like the published badge: the
      // page spends its other colours on result tiers, and a fourth would read as
      // one. If this ever computes to the same treatment, the distinction is gone.
      if (!g.colour) wrong.push('the unofficial count has no colour of its own');
      if (g.colour === g.muted) wrong.push(`the unofficial half is the same colour as the line it sits in (${g.colour})`);
      if (g.overflow) wrong.push('the panel overflows horizontally');
      if (wrong.length) {
        failed = true;
        console.error(`FAIL ${v.name} — ${wrong.join('; ')}`);
      } else {
        console.log(`ok   ${v.name} — ${g.rows} suggestion(s), ${g.ours} split, `
          + `top row "${g.total}" then "${g.split}" in ${g.colour}`);
      }
      continue;
    }

    // Every panel that opens with a caption has to draw the same kind of caption: same left
// edge, same measure, same size. Three panels do — the map, "Combos in your deck" and the
// unofficial rows — and they arrived at different times, so the drift this catches is the
// realistic one: a rule aimed at one of them that the others never got. The map's caption
// is the oldest and longest and is therefore the shape the others answer to.
//
// A pixel of tolerance on the width rather than equality: these resolve against each
// panel's own metrics and need only agree to the eye.
function captionDrift(notes) {
  const seen = notes || [];
  if (seen.length < 2) return [];
  const first = seen[0];
  const wrong = [];
  for (const n of seen.slice(1)) {
    if (n.left !== first.left) {
      wrong.push(`the ${n.panel} and ${first.panel} captions start at different x `
        + `(${n.left}px vs ${first.left}px)`);
    }
    if (Math.abs(n.width - first.width) > 1) {
      wrong.push(`the ${n.panel} and ${first.panel} captions are different widths `
        + `(${n.width}px vs ${first.width}px)`);
    }
    if (n.size !== first.size) {
      wrong.push(`the ${n.panel} and ${first.panel} captions are set at different sizes `
        + `(${n.size} vs ${first.size})`);
    }
    if (n.colour !== first.colour) {
      wrong.push(`the ${n.panel} and ${first.panel} captions are different colours `
        + `(${n.colour} vs ${first.colour})`);
    }
    // Placement, which is the half that was going unmeasured while the comments claimed
    // it: same distance from the heading above, same distance from the rows below.
    for (const edge of ['marginTop', 'marginBottom']) {
      if (n[edge] !== first[edge]) {
        wrong.push(`the ${n.panel} and ${first.panel} captions have different ${edge} `
          + `(${n[edge]} vs ${first[edge]})`);
      }
    }
  }
  return wrong;
}

// The unofficial run is about a claim, not a layout: that the page keeps our
    // own combos visibly apart from Commander Spellbook's and shows the working
    // for each. Every assertion here is something that, if it broke, would leave
    // a reader believing Spellbook had published something it had not.
    if (v.unofficial) {
      const u = v.unofficial;
      const wrong = [];
      if (u.rows !== 1) wrong.push(`${u.rows} unofficial rows rendered, expected exactly 1`);
      if (u.count !== '1') wrong.push(`the panel counts "${u.count}"`);
      if (!/unofficial/i.test(u.title || '')) wrong.push(`the panel is titled "${u.title}"`);
      // The heart of it. A row nobody published must not sit in the published list,
      // and must not be read before it.
      if (!u.unofficialIsBelow) wrong.push('the unofficial panel is not below the published one');
      if (u.officialRows) wrong.push(`${u.officialRows} combos leaked into the published panel`);
      if (!u.officialEmpty) wrong.push('the published panel does not say it found nothing');
      // Both panels open with a caption here — the map does not draw for this deck, which
      // has nothing published — and the two have to be the same kind of thing.
      const notes = u.notes || [];
      const want = ['pieces', 'unofficial'];
      for (const id of want) {
        if (!notes.some((n) => n.panel === id)) wrong.push(`the ${id} panel has no opening caption`);
      }
      wrong.push(...captionDrift(notes));
      // ...and it has to show its working, or it is just an assertion on screen.
      if (!['verified', 'derived'].includes(u.badge)) wrong.push(`no confidence badge: "${u.badge}"`);
      if (!(u.badgeClass || '').includes(u.badge)) wrong.push('the badge is not styled by its confidence');
      // And whose row it is, which is the badge that has to survive a merged list: the
      // suggestions and the pieces both draw ours and Spellbook's in one order now, so
      // nothing above a row says which it is.
      if (u.whose !== 'unofficial') wrong.push(`the row does not say it is ours: "${u.whose}"`);
      if (u.whoseFirst !== true) wrong.push('the confidence is read before whose row it is');
      if (u.whoseColour === u.badgeColour) {
        wrong.push('whose row it is and how checked it is are the same colour');
      }
      if (!/in place of/.test(u.note)) wrong.push('the row does not say which card was swapped');
      // A row two swaps deep has to print both. The claim gets weaker with each
      // step, and a reader who is only shown the last one cannot see that.
      const steps = v.steps || 1;
      if (u.steps !== steps) wrong.push(`the note spells out ${u.steps} swap(s), expected ${steps}`);
      if (u.note.length < 60) wrong.push(`the reasoning is missing: "${u.note}"`);
      // The link goes to the published combo it came from, not to a page for this
      // one — there is no such page, and a dead Spellbook link would be worse than
      // no link, because it would look like a citation.
      if (!/came from/.test(u.link || '')) wrong.push(`the link reads "${u.link}"`);
      if (!/commanderspellbook\.com\/combo\/\d+(-\d+)+\//.test(u.href || '')) {
        wrong.push(`the link does not point at a published combo: ${u.href}`);
      }
      if (u.cards.length !== 3) wrong.push(`the row names ${u.cards.length} cards`);
      if (!u.chips) wrong.push('the row shows no results');
      if (u.overflow) wrong.push('the panel overflows horizontally');
      // "Combos in your deck" answers what cutting a card costs, and this deck's
      // cards hold up nothing but our own row — so a panel that counted only
      // Spellbook's would leave every one of them out, or say nothing.
      const pc = v.pieces || {};
      if (pc.rows !== 3) wrong.push(`${pc.rows} cards in "Combos in your deck", expected 3`);
      if (pc.ours !== 3) wrong.push(`${pc.ours} of them break the count down, expected 3`);
      // One total per row, never two for the reader to add up.
      if (pc.totals !== 3) wrong.push(`${pc.totals} totals across 3 rows`);
      if (pc.text !== '1') wrong.push(`the total reads "${pc.text}"`);
      // Nothing published for this deck, so the published half is 0 — and at this
      // width the row says that in words. The accessible name says it either way,
      // which is what the narrow rows rely on.
      if (pc.split !== '0 official · 1 unofficial') wrong.push(`the split reads "${pc.split}"`);
      if (!/none published/.test(pc.spoken || '')) {
        wrong.push(`the split hides that nothing is published: "${pc.spoken}"`);
      }
      if (wrong.length) {
        failed = true;
        console.error(`FAIL ${v.name} — ${wrong.join('; ')}`);
      } else {
        console.log(`ok   ${v.name} — ${u.rows} row [${u.badge}] ${u.cards.join(' + ')}, `
          + `${u.chips} results, cited to ${u.href.split('/combo/')[1]}, published panel empty, `
          + `${notes.length} captions at x=${notes[0].left}px × ${notes[0].width}px ${notes[0].size}, `
          + `margins ${notes[0].marginTop}/${notes[0].marginBottom}, `
          + `${notes.map((n) => n.panel + ' ' + n.lines + ' line(s), ' + n.gapBelow + 'px above its rows').join('; ')}`);
      }
      continue;
    }

    // Whether the list is allowed. Its own run, because a legal deck says nothing at
    // all and the tuning deck is legal — see runLegality() for why this is not just
    // another viewport over the same deck.
    if (v.deck === 'illegal' || v.deck === 'illegalNoCommander') {
      const legal = v.legality;
      const wrong = [];
      if (!legal.shown) {
        wrong.push('an illegal deck said nothing about it');
      } else {
        if (!legal.banned.includes('Murderous Redcap')) {
          wrong.push(`the banned card was not named: ${JSON.stringify(legal.banned)}`);
        }
        if (!/banned in Commander/.test(legal.bannedClaim)) {
          wrong.push(`the ban does not say what it is: "${legal.bannedClaim}"`);
        }
        if (!legal.besideBracket) wrong.push('the legality line is not beside the bracket');
        if (legal.overflow) wrong.push('the legality line overflows horizontally');
        // It never claims more than the two rules that are readable off a card list.
        if (!legal.notes.some((t) => /Singleton, deck size/.test(t))) {
          wrong.push('the legality line does not say what it left unchecked');
        }
        // One card per line. They ran together separated by middots and wrapped into a
        // paragraph on a phone, where two names read as one very long one.
        if (legal.offIdentity.length && legal.cardLines !== legal.offIdentity.length) {
          wrong.push(`${legal.offIdentity.length} off-identity card(s) on ${legal.cardLines} line(s)`);
        }
        if (v.deck === 'illegal') {
          // A commander was named, so both halves are answerable. Heliod is {W}
          // against a {U}{G} commander.
          if (!legal.offIdentity.includes('Heliod, Sun-Crowned')) {
            wrong.push(`the off-identity card was not named: ${JSON.stringify(legal.offIdentity)}`);
          }
          // Drawn as pips, both of them, like every other colour on this page. Asserted
          // as the pips' own letters rather than as text: the sentence said "({U}{G})"
          // in production and this check passed it, because it was written against the
          // same braced string the page was printing.
          if (!legal.colours.includes('W')) {
            wrong.push(`the offending colour was not drawn: ${JSON.stringify(legal.colours)}`);
          }
          if (legal.identityClaimPips !== 'UG') {
            wrong.push(`the commander's identity is not drawn in the claim: `
              + `pips ${JSON.stringify(legal.identityClaimPips)}, text "${legal.identityClaim}"`);
          }
          // And the braces are gone from the words, which is the bug itself.
          if (/[{}]/.test(legal.identityClaim)) {
            wrong.push(`the claim still prints braces: "${legal.identityClaim}"`);
          }
          // Murderous Redcap is banned *and* off-identity. One card, one accusation,
          // and the graver one: two lines about the same card read as two problems.
          if (legal.offIdentity.includes('Murderous Redcap')) {
            wrong.push('a banned card is accused on the colour line as well');
          }
          // Two accusations, two colours, or which one is a ban is unreadable.
          if (legal.bannedColour === legal.identityColour) {
            wrong.push(`both lines are ${legal.bannedColour}`);
          }
        } else {
          // No commander named, so the colour half cannot be answered — and must not
          // fall back on the deck's own colours, which would make every list legal.
          if (legal.offIdentity.length) {
            wrong.push(`a deck with no commander was told ${legal.offIdentity.length} card(s) are off-identity`);
          }
          if (!legal.notes.some((t) => /No commander was named/.test(t))) {
            wrong.push(`nothing said why colours went unchecked: ${JSON.stringify(legal.notes)}`);
          }
        }
      }
      if (wrong.length) {
        failed = true;
        console.error(`FAIL ${v.name} — ${wrong.join('; ')}`);
      } else {
        console.log(`ok   ${v.name} — banned ${JSON.stringify(legal.banned)}, `
          + `off-colour ${JSON.stringify(legal.offIdentity)}${legal.colours.length ? ' ' + legal.colours.join('') : ''}, `
          + `${legal.notes.length} caveat(s)`);
      }
      continue;
    }

    // The share-link run measures a round trip rather than a layout, so it is
    // judged on its own terms.
    if (v.theme) {
      const t = v.theme;
      const wrong = [];

      if (t.initial.hidden !== false) wrong.push('the theme toggle stayed hidden, so the script never dressed it');
      if (!['dark', 'light'].includes(t.initial.attr)) {
        wrong.push(`the page opened with data-theme="${t.initial.attr}"`);
      }
      // The control has to actually repaint the page, not just relabel itself. Read
      // off the computed background, which is the token the whole theme hangs from.
      if (t.afterPress.attr !== (t.initial.attr === 'dark' ? 'light' : 'dark')) {
        wrong.push(`pressing it moved from ${t.initial.attr} to ${t.afterPress.attr}`);
      }
      if (t.afterPress.bg === t.initial.bg) {
        wrong.push(`the page is still ${t.initial.bg} after switching theme`);
      }
      if (t.afterPress.text === t.initial.text) wrong.push('the text colour did not move with the theme');
      // A control naming the theme you are already in sends you the wrong way, and
      // an icon-only button has nothing but its accessible name to say so.
      if (t.afterPress.label === t.initial.label) {
        wrong.push(`the button still says "${t.initial.label}" after being pressed`);
      }
      const wantedName = (theme) => (theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
      [['initial', t.initial], ['afterPress', t.afterPress], ['onReturn', t.onReturn]].forEach(([when, state]) => {
        if (state.label !== wantedName(state.attr)) {
          wrong.push(`a ${state.attr} page (${when}) offers "${state.label}"`);
        }
        // The icon is the whole control now, so "which one is visible" is as much a
        // correctness question as the colours are — and never both at once.
        const wantedIcon = state.attr === 'light' ? 'sun' : 'moon';
        if (state.icon !== wantedIcon) {
          wrong.push(`a ${state.attr} page (${when}) shows ${state.icon || 'no icon'}, not the ${wantedIcon}`);
        }
      });
      if (t.stored !== t.afterPress.attr) {
        wrong.push(`pressed to ${t.afterPress.attr} but stored ${JSON.stringify(t.stored)}`);
      }
      // The reason to store it at all: a fresh document with no query string, and
      // the choice is still in force — over whatever the system asks for.
      if (t.onReturn.attr !== t.afterPress.attr) {
        wrong.push(`the choice of ${t.afterPress.attr} did not survive a reload (came back ${t.onReturn.attr})`);
      }
      if (t.onReturn.bg !== t.afterPress.bg) wrong.push('the remembered theme did not repaint on return');
      // And back again, remembered too — a toggle that only sticks one way is a trap.
      if (t.afterSecondPress.attr !== t.initial.attr) {
        wrong.push(`pressing twice ended on ${t.afterSecondPress.attr}, not back at ${t.initial.attr}`);
      }
      if (t.storedAfterSecond !== t.afterSecondPress.attr) {
        wrong.push(`switching back stored ${JSON.stringify(t.storedAfterSecond)}`);
      }
      if (t.tiersPage.attr !== t.afterSecondPress.attr) {
        wrong.push(`the tiers page opened in ${t.tiersPage.attr} while the choice was ${t.afterSecondPress.attr}`);
      }
      if (t.tiersPage.hidden !== false) wrong.push('the tiers page has no working theme toggle');

      if (wrong.length) {
        failed = true;
        console.error(`FAIL ${v.name} — ${wrong.join('; ')}`);
      } else {
        console.log(`ok   ${v.name} — opened ${t.initial.attr} (${t.initial.bg}, ${t.initial.icon}), pressed to `
          + `${t.afterPress.attr} (${t.afterPress.bg}, ${t.afterPress.icon}), survived a reload, back again, `
          + `and held on the tiers page (${t.tiersPage.icon})`);
      }
      continue;
    }

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
    problems.push(...footerProblems(v.footer));
    // Combos in your deck, how they connect, suggested additions. Three, not four:
    // the panel that listed every combo as its own row is gone and the panel that
    // listed the cards carrying them is what "Combos in your deck" now names. "One
    // slot away" went before that. The bracket check is not among them either — it
    // stopped being a panel and became a line beside the colour identity, which the
    // next check is what keeps true.
    if (v.panels.length !== 3) problems.push(`expected 3 panels, got ${v.panels.length}`);
    if (v.panels.some((p) => /carrying your combos/i.test(p.title))) {
      problems.push('the cards-carrying panel is a second panel again, not the combos panel itself');
    }
    if (v.panels.some((p) => /Bracket check/.test(p.title))) problems.push('the bracket check is a panel again');
    if (v.panels.some((p) => /slot away/i.test(p.title))) problems.push('the one-slot-away panel is back');
    if (!v.topPiece) {
      problems.push('the combo-pieces overview did not render');
    } else if (!/^\d+$/.test(v.topPiece.total)) {
      problems.push(`the combo-pieces total reads "${v.topPiece.total}"`);
    } else if (!/in \d+ combos?/.test(v.topPiece.spoken)) {
      // The word left the row when the number moved into the gutter — under the
      // number rather than beside it — so what it counts has to be readable
      // somewhere that is not a colour and not a position.
      problems.push(`the total does not say what it counts: "${v.topPiece.spoken}"`);
    } else {
      // The breakdown has to be here too, closing the card's column, and it has to
      // add up to the total in the gutter — a breakdown that disagrees with its own
      // total is worse than no breakdown.
      if (!v.topPiece.pills.length) problems.push('a card carrying combos shows no size breakdown');
      if (!v.topPiece.inMain) problems.push("the pieces breakdown is not in the card's own column");
      const claimed = v.topPiece.pills.reduce((sum, t) => {
        const m = t.match(/^(?:(\d+) × )?(\d+)-card$/);
        return sum + (m ? Number(m[1] || 1) : 0);
      }, 0);
      const counted = Number(v.topPiece.total);
      if (claimed !== counted) {
        problems.push(`the pieces breakdown [${v.topPiece.pills.join(', ')}] sums to ${claimed}, not the ${counted} its total claims`);
      }
      const nums = v.topPiece.pills.map((t) => Number((t.match(/(\d+)-card/) || [0, 0])[1]));
      if (nums.some((n, i) => i && n < nums[i - 1])) {
        problems.push(`the pieces breakdown is not smallest-first: [${v.topPiece.pills.join(', ')}]`);
      }
    }

    // The numbers are a column, and this is the only check that can say so: a badge
    // after a card name lands wherever the name ends, and that is invisible in a
    // screenshot of one row. One right edge per panel means a column; two means the
    // gutter has started sizing itself to its content again.
    if (!v.numberColumns.length) {
      problems.push('no row totals rendered at all, so the number column is untested');
    } else if (!v.numberColumns.some((c) => c.rowLinks.length)) {
      problems.push('no card links measured on any row, so which line they sit on is untested');
    } else {
      for (const col of v.numberColumns) {
        if (col.edges.length !== 1) {
          problems.push(`the totals in "${col.panel}" sit at ${col.edges.length} different right edges `
            + `across ${col.rows} rows [${col.edges.join(', ')}]`);
        }
        if (col.wraps.some((w) => w !== 'nowrap')) {
          problems.push(`a total in "${col.panel}" can break across lines`);
        }
        if (col.spoken !== col.rows) {
          problems.push(`${col.rows - col.spoken} total(s) in "${col.panel}" do not say what they count`);
        }
        // Spelled out where the row's column has room for a 12rem gutter, compact
        // where it does not. Checked as the *rule* rather than as a breakpoint
        // restated: if the container declaration were dropped the words would never
        // appear, and if the query were dropped they would appear on a phone. Both
        // fail here. The breakpoint is in style.css and nowhere else.
        // The card's links share its name's line where the row's column has room for
        // both, and take a line of their own where it has not. Checked as the rule and
        // not as a restated breakpoint, the same way the split above is: a run whose
        // column is over the threshold must show one branch and a run under it the
        // other, so dropping either declaration fails here rather than in front of a
        // reader. Both branches are covered by the viewports this tool already runs —
        // a 1440px window puts the column at 982px and a phone at 349px.
        //
        // 750px and not the split's 560px because the line carries `+ Add to deck`
        // as well as the two links; the measurement is in style.css beside the rule.
        const roomForLinks = col.column >= 750;
        for (const row of col.rowLinks) {
          if (row.overflows) {
            problems.push(`the links on "${row.name}" run past the row's column in "${col.panel}"`);
          }
          if (roomForLinks && !row.beside) {
            problems.push(`the links on "${row.name}" are not beside the name in a ${col.column}px column`);
          }
          if (!roomForLinks && !row.below) {
            problems.push(`the links on "${row.name}" share the name's line in a ${col.column}px column`);
          }
        }
        const roomForWords = col.column >= 560;
        for (const split of col.splits) {
          // "17+7" is numerals and two colours. Neither is available to a screen
          // reader, so the sentence has to be, and role="img" is what makes the
          // label be read in place of the digits.
          const shape = roomForWords ? /^\d+ official · \d+ unofficial$/ : /^\d+\+\d+$/;
          if (!shape.test(split.text)) {
            problems.push(`a split in "${col.panel}" reads "${split.text}" in a ${col.column}px column`);
          }
          if (split.role !== 'img') problems.push(`a split is not labelled for a screen reader: role="${split.role}"`);
          if (!/unofficial/.test(split.spoken)) problems.push(`a split has no spoken claim: "${split.spoken}"`);
          // Whose half is whose rests on the colour now, so the two halves must not
          // compute to the same one.
          if (split.ours === split.official) {
            problems.push(`both halves of a split are ${split.ours}, so which is ours is unreadable`);
          }
        }
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
          problems.push(`a suggestion (${row.total}) shows no combo sizes`);
          continue;
        }
        const claimed = Number((row.total.match(/\d+/) || [0])[0]);
        const counted = row.pills.reduce((n, text) => {
          const m = text.match(/^(\d+) × (\d+)-card$/);
          return n + (m ? Number(m[1]) : 1); // the single-combo row reads "N-card combo"
        }, 0);
        if (claimed !== counted) {
          problems.push(`"${row.total}" but its sizes total ${counted} [${row.pills.join(', ')}]`);
        }
        // Only a two-card pill is marked — that is the floor, and a row with
        // nothing that easy should light nothing up.
        const hasTwo = row.pills.some((t) => /(^|\s)2-card$/.test(t));
        if (hasTwo && !row.easiest.length) problems.push(`a two-card combo is not marked on "${row.total}"`);
        if (!hasTwo && row.easiest.length) problems.push(`"${row.easiest[0]}" is marked as easiest but is not a two-card combo`);
      }
      // The combos inside a suggestion are ordered the same way the pills above them
      // are: smallest first. Two orderings of one set of combos, one panel apart, is
      // the page contradicting itself — and the fixture's most-played combo is also
      // its largest, so sorting on popularity alone fails this.
      for (const row of v.sizes) {
        const u = row.unlockSizes;
        if (!u.length) problems.push(`a suggestion (${row.total}) listed no combos`);
        for (let i = 1; i < u.length; i++) {
          if (u[i] < u[i - 1]) {
            problems.push(`"Combos this unlocks" on ${row.total} runs [${u.join(', ')}] — not smallest first`);
            break;
          }
        }
        // The nested list has to be the whole set, or its order is beside the point.
        const claimed = row.pills.reduce((sum, t) => {
          const m = t.match(/^(?:(\d+) × )?(\d+)-card$/);
          return sum + (m ? Number(m[1] || 1) : 0);
        }, 0);
        if (claimed && claimed !== u.length) {
          problems.push(`${row.total} claims ${claimed} combos in its pills but lists ${u.length}`);
        }
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
        // The pills close the card's own column, under the name and the links. They
        // used to share the name's line to save the row a line; the split moving into
        // the gutter paid for one, and on any row with three pills they wrapped
        // anyway. What still matters is that they are in the card's column and not
        // in the number gutter, where they would break the one thing it is for.
        if (!mixed.inMain) problems.push('the size pills are not in the card\'s own column');
      }
    }

    // One unbroken divider down every row, with everything below the numbers on the
    // card's side of it — the same shape whether the row offers a choice of card or
    // not, which is the whole claim.
    if (!v.dividers.length) {
      problems.push('no suggestion or piece row rendered, so the row divider is untested');
    } else {
      for (const d of v.dividers) {
        if (d.summaryLeft !== d.mainLeft) {
          problems.push(`"${d.name}"'s disclosure starts at ${d.summaryLeft}px, its name at ${d.mainLeft}px — not in the card's column`);
        }
        // The gutter draws none of it. A border here is the old design creeping
        // back, and it would cost the alignment the span buys without looking wrong.
        if (d.gutterWidth) {
          problems.push(`"${d.name}"'s gutter draws a divider of its own, so the numbers are sizing the card's column again`);
        }
        if (d.blocks.length < 2) problems.push(`"${d.name}" has nothing below its name, so the divider ends there`);
        // Each piece picks up where the one above left off, and all of them are drawn
        // at the same x. Walked in order, so the report names the block that broke it.
        // The first block sets the x rather than the gutter: it is the top of the line.
        const line = d.blocks.length ? d.blocks[0].line : 0;
        let end = null;
        for (const b of d.blocks) {
          if (!b.width) problems.push(`"${d.name}" draws no divider beside ${b.what}`);
          if (b.line !== line) {
            problems.push(`"${d.name}"'s divider steps sideways at ${b.what}: ${line}px then ${b.line}px`);
          }
          if (end !== null && b.top !== end) {
            problems.push(`"${d.name}"'s divider breaks above ${b.what}: the piece before it ends at ${end}px and it starts at ${b.top}px`);
          }
          end = b.bottom;
        }
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
      // And each one has its symbol drawn in it. The glyphs replaced the letters, so a
      // pip that draws nothing is a coloured dot that says which colour only to somebody
      // who already knows the palette.
      const blank = h.pips.filter((p) => p.art < 8).map((p) => p.letter);
      if (blank.length) problems.push(`mana pips with no symbol drawn: ${JSON.stringify(blank)}`);
    }
    if (h.commanderLines) problems.push(`${h.commanderLines} commander line(s) rendered; colours come from the cards now`);
    if (h.pickers) problems.push(`${h.pickers} commander picker(s) rendered; the shortlist was removed`);

    // A heading pill is joined to the cards before it, the same way the cards are joined
    // to each other. A heading reading "A + B a Persist Creature" is not a list of three
    // things. The pill is the template slot — the "any of N" one went with the panel that
    // listed combos row by row, and so did the assertions about it.
    const g = v.grouped;
    if (!g.slotSeps.length) problems.push('no heading pill with a card before it, so its separator is unchecked');
    g.slotSeps.forEach((sep, i) => {
      if (!/\+/.test(sep)) {
        problems.push(`a heading pill has no separator in front of it (row ${i + 1}, saw "${sep}")`);
      }
    });
    // …and in front of it means outside its outline, not inside.
    if (!g.pillInset.length) problems.push('no heading pill on screen, so its outline is unchecked');
    g.pillInset.forEach((p) => {
      if (p.inset === null) {
        problems.push(`a .${p.kind} heading pill has no inner .pill to carry its outline`);
      } else if (p.inset <= 0) {
        problems.push(`the .${p.kind} outline encloses its own "+" (pill starts ${p.inset}px into the item)`);
      } else if (p.outerRinged) {
        problems.push(`the .${p.kind} flex item is outlined, so the outline contains its own "+"`);
      } else if (!p.innerRinged) {
        problems.push(`the .${p.kind} pill has lost its outline`);
      }
    });
    if (!g.altGroups.length) problems.push('no suggestion offered interchangeable alternatives');
    if (g.altGroups.some((t) => !/or (these \d+|this one), same combos?:/.test(t))) problems.push(`an alternatives label reads "${g.altGroups[0]}"`);
    // The choice of card lives in the card's column like everything else in the row,
    // so it has that column's width and not the row's: 233px of the 334px this panel
    // gets at 390px, against 454px of 689px at 768px. Both shapes are asserted,
    // because a rule that only holds at one end of the range is not the rule — and
    // the threshold is read off the column rather than written twice, so a change to
    // the stylesheet's 420px fails here instead of being quietly agreed with.
    //
    // The wording has to fit that column on one line either way — "or any one of
    // these N instead — same combos:" is what this replaced, and it took two lines
    // in a column half again as wide.
    const roomy = g.column >= 420;
    if (g.altLabel && g.altLabel.sentenceLines !== 1) {
      problems.push(`the alternatives label breaks across ${g.altLabel.sentenceLines} lines: "${g.altLabel.text}" in ${g.altLabel.boxWidth}px`);
    }
    // And the Compare pill beside it exactly where there is room for it. Below that
    // the two together needed 277px of a 233px column, which broke the sentence
    // itself — so the pill takes its own line and the sentence stays whole.
    if (g.altLabel && g.altLabel.pillBeside !== roomy) {
      problems.push(roomy
        ? `the Compare pill is not on the label's line, and the column is ${g.column}px`
        : `the Compare pill shares the label's line in a ${g.column}px column, where the two need ${g.altLabel.sentenceWidth + g.altLabel.pillWidth}px`);
    }
    if (g.altNames < 1) problems.push('the alternatives list named no cards');

    // Every + Add on the same right edge, whichever shape the list is in. That is the
    // point of it: buttons that each start wherever the name before them happened to
    // end make a list of four look like a mistake.
    if (!g.altRows.length) problems.push('no interchangeable row offered a + Add to measure');
    const edges = [...new Set(g.altRows.map((r) => r.addRight))];
    if (edges.length > 1) {
      problems.push(`the + Add buttons sit on ${edges.length} different edges (${edges.join('px, ')}px), so they do not line up`);
    }
    // Whether a button shares its card's line is the width's decision and not the
    // name's, which is the difference between the two shapes and a wrapping row: in
    // a narrow column every entry takes two lines, not the ones with long names.
    const strays = g.altRows.filter((r) => r.sameLine !== roomy);
    if (strays.length) {
      problems.push(roomy
        ? `${strays.length} + Add button(s) wrapped off their card's line in a ${g.column}px column, e.g. ${strays[0].name}`
        : `${strays.length} + Add button(s) share their card's line in a ${g.column}px column, which leaves the name ${g.altRows[0].nameWidth}px`);
    }
    // The name gets the whole column on the two-line shape, which is the only reason
    // that shape exists — an ellipsis at 81px is not a card name. Where it is clipped
    // anyway it must still be readable some other way, or the row has lost
    // information rather than just space.
    const cut = g.altRows.filter((r) => r.clipped);
    if (cut.length && !roomy) {
      problems.push(`${cut.length} name(s) still clipped with the column to themselves, e.g. ${cut[0].name} at ${cut[0].nameWidth}px`);
    }
    const mute = g.altRows.filter((r) => !r.titled);
    if (mute.length) problems.push(`${mute.length} clipped name(s) carry no title, e.g. ${mute[0].name}`);

    // The gutter's width is a measurement, so this is where it stays one: the widest thing
    // actually in it, and the worst case the page will ever have to draw, both against the
    // column they have to fit in. A gutter that has quietly stopped fitting shows up as a
    // wrapped label or a number over the divider, which is exactly the class of thing a
    // screenshot catches and nothing else does.
    // The sign between two numbers sits on their centre, not on their baseline. Asserted
    // against the ink measurement rather than against the value in the stylesheet, so this
    // stays true if either font size moves.
    // Both sizes the sign is drawn at, since one value in the stylesheet has to be right for
    // both: the "+" in front of a total, and the one between a split's halves. The second
    // only exists in the narrow reading — where the column has room, the split spells itself
    // out in words and shows a "·" instead — so expecting two everywhere failed the wide
    // viewports on a page doing exactly the right thing.
    //
    // Read off the panel body and *not* off the heading shape, which is the same number
    // for a row's gutter and a stopped being the same number for a combo heading: a combo
    // row sits inside a card's disclosure and answers a container of its own, so at 768px
    // the heading is in 450px while the split beside it is in 689px. Keyed on the heading,
    // this demanded the narrow reading of a split that had the room to spell itself out.
    const rowColumn = v.numberColumns.length ? v.numberColumns[0].column : 0;
    const wantSigns = rowColumn && rowColumn < HEADING_INLINE_AT ? 2 : 1;
    if (v.signAlign.length < wantSigns) {
      problems.push(`${v.signAlign.length} sign(s) measured where ${wantSigns} are drawn`);
    }
    for (const sg of v.signAlign) {
      if (Math.abs(sg.raised - sg.ideal) > 1) {
        problems.push(`the "+" in a ${sg.where} is raised ${sg.raised}px where ${sg.ideal}px centres it`);
      }
    }

    const gut = v.gutterNeeds;
    if (!gut || !gut.column) {
      problems.push('no gutter to measure');
    } else {
      if (gut.widest + gut.pad > gut.column) {
        problems.push(`the gutter holds ${gut.widest}px + ${gut.pad}px of clearance in ${gut.column}px (${gut.what})`);
      }
      if (gut.worst && gut.worst + gut.pad > gut.column) {
        problems.push(`a 0+1889 row needs ${gut.worst}px + ${gut.pad}px in a ${gut.column}px gutter`);
      }
    }

    // ---- one card per line, and no dot separating things that are not side by side ----
    //
    // Both are geometry, and both are invisible to textContent: a heading whose cards
    // wrap mid-name reads identically as a string, and a stranded separator is a dot in
    // the DOM either way. The threshold is `rows` container width, so which shape is
    // expected follows from the column this viewport gives, not from the viewport.
    const heads = v.headingShape;
    const inlineHeads = Boolean(heads) && heads.column >= HEADING_INLINE_AT;
    if (!heads || !heads.rows) {
      problems.push('no combo headings to check the card layout of');
    } else if (!heads.rendered) {
      problems.push(`${heads.rows} combo heading(s) in the page and none of them laid out, `
        + 'so the card layout is unchecked — every combo row is inside a disclosure, and '
        + 'the run has to open them before it measures anything');
    } else if (inlineHeads) {
      if (heads.stacked && !heads.sharing) {
        problems.push('every heading is stacked in a column with room to sit inline');
      }
    } else {
      if (heads.sharing) {
        problems.push(`${heads.sharing} heading(s) still put two cards on one line in a `
          + `${heads.column}px column, e.g. "${heads.example}"`);
      }
    }
    // At every width, not only the narrow one: a card is a flex item in both shapes, so a
    // name splitting across two lines means the shape has been lost rather than that the
    // column is tight. This is the whole guarantee the stacking was asked for.
    if (heads && heads.split) {
      problems.push(`${heads.split} heading(s) broke a card name across two lines: ${heads.splitExample}`);
    }
    if (v.linkLine) {
      if (!inlineHeads && v.linkLine.seps) {
        problems.push(`${v.linkLine.seps} separator(s) still drawn where the offers stack`);
      }
      if (inlineHeads && v.linkLine.offers > 1 && !v.linkLine.seps) {
        problems.push('the offers sit on one line with nothing separating them');
      }
    }

    // Every combo row offers one link that opens all its cards at once — the point
    // being a quick look at what a combo asks for before committing to it. One link
    // and not one per name: a four-card row would carry four, and reading the cards is
    // a single action.
    if (!v.comboCompare.length) problems.push('no combo rows to check the comparison link on');
    v.comboCompare.forEach((row) => {
      const whose = row.names.join(' + ') || 'a combo';
      // Where a reader gets to the combo itself: the Spellbook link and the steps control.
      // `hasSpellbook` was collected here and read by nothing at all, which is the same
      // vacuum as an assertion that matches nothing — it just looks like coverage in the
      // capture instead of in the check.
      //
      // Every row stands for exactly one combo now — there is no collapsed row to make
      // an exception for — so every row carries both. The steps assertion is load-bearing
      // in a way it was not before: this panel is the only place a published combo is
      // drawn, so if the control is not here it is nowhere.
      if (!row.hasSpellbook) problems.push(`${whose} has no link to its combo on Spellbook`);
      if (!row.hasSteps) problems.push(`${whose} has no "How it works" control`);
      if (!row.names.length) return; // a row of nothing but slots has no cards to open
      const wanted = row.names;
      if (!row.href) { problems.push(`${whose} offers no way to open its cards`); return; }
      if (!row.href.startsWith('https://scryfall.com/search?q=')) {
        problems.push(`${whose}'s comparison link does not go to Scryfall: ${row.href}`);
        return;
      }
      const terms = decodeURIComponent(row.href.slice('https://scryfall.com/search?q='.length)).split(' or ');
      wanted.forEach((n) => {
        if (!terms.includes('!"' + n + '"')) problems.push(`${whose}'s comparison link leaves out ${n}`);
      });
      // A slot is not a card and cannot be opened, so it must not be asked for.
      if (terms.length !== wanted.length) {
        problems.push(`${whose} names ${wanted.length} cards but its link asks for ${terms.length}`);
      }
      // "Compare" would be wrong here: a combo's cards are not alternatives to weigh,
      // they are all required, and the verb has to say so.
      if (/compare/i.test(row.label || '')) {
        problems.push(`${whose}'s link says "${row.label}" — its cards are required, not alternatives`);
      }
      const claimed = Number((/^See all (\d+) cards?$/.exec(row.label || '') || [])[1]);
      if (claimed !== wanted.length) problems.push(`${whose}'s link reads "${row.label}" for ${wanted.length} cards`);
      if (row.beforeChips === false) {
        problems.push(`${whose} puts its links below the result chips instead of above them`);
      }
      // A collapsed row links its versions to Spellbook individually rather than as a
      // group, so only the ungrouped rows carry both links.
    });

    // Sixteen interchangeable cards is one decision, and making it means looking at
    // all sixteen. The link that does that in one press is only worth having if the
    // query behind it really carries every card in the choice — a query short by
    // one is a comparison missing an option, and nothing on screen would show it.
    if (!g.compare.length) problems.push('a suggestion offered alternatives but no way to compare them');
    g.compare.forEach((c) => {
      const whose = c.headline || 'a suggestion';
      if (!c.href) { problems.push(`${whose} offered alternatives with no Scryfall comparison link`); return; }
      if (!c.href.startsWith('https://scryfall.com/search?q=')) {
        problems.push(`${whose}'s comparison link does not go to a Scryfall search: ${c.href}`);
        return;
      }
      if (!c.opensAway) problems.push(`${whose}'s comparison link would navigate away from the deck`);

      const query = decodeURIComponent(c.href.slice('https://scryfall.com/search?q='.length));
      const terms = query.split(' or ');
      // The recommended card is one of the options being weighed, so a comparison
      // without it is the wrong comparison.
      const wanted = [c.headline].concat(c.alts).filter(Boolean);
      wanted.forEach((name) => {
        if (!terms.includes('!"' + name + '"')) {
          problems.push(`${whose}'s comparison link leaves out ${name}`);
        }
      });
      // Anchored, or Scryfall reads the words as a substring search and returns a
      // different set of cards than the one being offered.
      terms.forEach((t) => {
        if (!/^!".+"$/.test(t)) problems.push(`${whose}'s comparison query is not exact: ${t}`);
      });
      // What the label promises has to be what the query asks for, since the number
      // is the only part of this a reader can check.
      const claimed = Number((/^Compare all (\d+)$/.exec(c.label || '') || [])[1]);
      if (!claimed) problems.push(`${whose}'s comparison link reads "${c.label}"`);
      else if (claimed !== terms.length) {
        problems.push(`${whose}'s link offers ${claimed} cards but asks Scryfall for ${terms.length}`);
      }
    });

    // "Combos in your deck": the badge counts combos, the rows are cards, and the two
    // numbers therefore disagree. Every assertion here is about that disagreement being
    // stated rather than left for a reader to take as a miscount.
    const inc = v.included;
    if (inc.title !== 'Combos in your deck') problems.push(`the leading panel is titled "${inc.title}"`);
    if (!inc.isFirst) problems.push('the combos panel is not the first thing in the results');
    if (!inc.rows) problems.push('the combos panel drew no cards');
    if (!Number(inc.badge)) problems.push(`the combo count reads "${inc.badge}"`);
    // The badge against what the panel actually reaches. A combo appears under each of
    // its cards, so this is the set of distinct published combos behind the rows — the
    // one thing that can catch a badge counting something other than combos.
    if (Number(inc.badge) !== inc.reached) {
      problems.push(`the badge says ${inc.badge} combos and the panel reaches ${inc.reached}`);
    }
    // And both numbers written out, because they are different numbers and only the
    // sentence says which is which.
    if (!inc.note.includes(`${inc.badge} combo`)) {
      problems.push(`the panel does not say what its ${inc.badge} counts: "${inc.note}"`);
    }
    if (!inc.note.includes(`carried by ${inc.rows} of your card`)) {
      problems.push(`the panel draws ${inc.rows} cards and its note does not say so: "${inc.note}"`);
    }
    // All three captions on one page, measured against each other. The map draws here, so
    // this is the run where the full set is available — see captionDrift().
    const captions = inc.notes || [];
    // The two this deck always draws. The unofficial panel is absent for decks with no
    // rows of ours, so it is not required here — but if it is on the page, captionDrift()
    // has already measured it with the others.
    for (const id of ['graph', 'pieces']) {
      if (!captions.some((n) => n.panel === id)) problems.push(`the ${id} panel has no opening caption`);
    }
    problems.push(...captionDrift(captions));

    // Ranked by what cutting a card costs, which is the reason these rows are in this
    // order and the only thing on the page that says so is the order itself.
    for (let i = 1; i < inc.ranking.length; i += 1) {
      if (inc.ranking[i] > inc.ranking[i - 1]) {
        problems.push(`the cards are not ordered by how many combos they carry: ${JSON.stringify(inc.ranking)}`);
        break;
      }
    }

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

    // Combo 13 in the fixture is one slot short: the deck holds the card it names
    // and nothing fills its Persist Creature slot. It used to have a panel of its
    // own; now it must appear nowhere on the page at all. Asserted across every
    // combo link in the results rather than only inside "Combos in your deck",
    // because the failure the removal could introduce is it surfacing somewhere
    // else — a suggestion, a piece row's disclosure — where it would read as a
    // combo the deck has.
    if (v.stuckSlot.anywhere) {
      problems.push('a combo the deck cannot assemble for want of a slot is on the page');
    }
    if (!v.stuckSlot.links) problems.push('no combo links found at all, so that check proves nothing');
    // And no dashed missing-slot pill survives anywhere, which is the other half:
    // every slot on the page now is a slot the deck fills.
    if (v.stuckSlot.missingPills) problems.push(`${v.stuckSlot.missingPills} missing-slot pill(s) still rendered`);

    // Cards the snapshot has never heard of. Keyed on the deck that was pasted and
    // not on whether the section rendered, which would be circular: the decks with
    // nothing wrong must produce no section at all, and the one with a misspelling
    // must name it. The fixture's identity map is small, so this is also the check
    // that the thin-map rule is not swallowing a real answer — 2 unknown of 10 is
    // under the limit and has to speak.
    const unknown = v.unknownCards;
    if (v.deck === 'misspelled') {
      if (!unknown.shown) {
        problems.push('a deck with a misspelled card said nothing about it');
      } else {
        if (!unknown.names.includes('Sol Rimg')) {
          problems.push(`the misspelled card was not named: ${JSON.stringify(unknown.names)}`);
        }
        if (!unknown.names.includes('Treasure')) {
          problems.push(`the token line was not named: ${JSON.stringify(unknown.names)}`);
        }
        if (!/2 cards/.test(unknown.head)) problems.push(`the notice reads "${unknown.head}"`);
        // The claim is about the snapshot, not about the card.
        if (!/this snapshot/.test(unknown.head)) problems.push(`the notice overclaims: "${unknown.head}"`);
        if (!/token/.test(unknown.why)) problems.push('the notice does not say a token line lands here too');
        if (!unknown.aboveResults) problems.push('the unrecognized-cards notice is below the results it qualifies');
      }
    } else if (unknown.shown) {
      problems.push(`a clean deck was told ${unknown.names.length} of its cards are unrecognized`);
    }

    // THE DECK SUMMARY. One box, five rows: colours and bracket first — what the deck
    // *is* — then a row per number. It replaced a one-line strip that had to hide the
    // label and the basic/nonbasic split on a phone; the point of the rows is that
    // nothing is hidden at any width, so what is checked is that every row says its
    // whole piece and none of them wrapped.
    //
    // The misspelled deck carries three cards the tuning deck does not: two the fixture
    // map has never heard of, and Bala Ged Recovery, an MDFC. So it is the run that
    // exercises every row the box has.
    const extra = { misspelled: 3, illegal: 2, illegalNoCommander: 2 }[v.deck] || 0;
    const unread = v.deck === 'misspelled' ? 2 : 0;
    const spells = 7 + (extra - unread);
    const summary = v.deckSummary;
    const wantRows = [
      { key: 'Colour identity', n: '', sub: '' },
      { key: 'Bracket', n: '', sub: '' },
      { key: 'cards', n: String(17 + extra), sub: '' },
      // All ten lands are Islands, so there is nothing to say about nonbasics -- and the
      // aside must not invent "0 nonbasic" to say it with. The MDFC count is an aside on
      // the *spells*, because that is where such a card is counted.
      { key: 'spells', n: String(spells), sub: v.deck === 'misspelled' ? '1 MDFC' : '' },
      { key: 'lands', n: '10', sub: '10 basic' },
    ].concat(unread ? [{ key: 'unread', n: String(unread), sub: 'not in this snapshot' }] : []);

    if (!summary.shown) {
      problems.push('no deck summary after a search');
    } else {
      const got = summary.rows.map((r) => ({ key: r.key, n: r.n, sub: r.sub }));
      if (JSON.stringify(got) !== JSON.stringify(wantRows)) {
        problems.push(`the summary rows read ${JSON.stringify(got)}, expected ${JSON.stringify(wantRows)}`);
      }
      // Nothing wraps. A row twice the height of its neighbours is the failure the box
      // exists to avoid, and it is invisible in a screenshot of a short fixture deck.
      const wrapped = summary.rows.filter((r) => r.lines > 1).map((r) => r.key);
      if (wrapped.length) {
        problems.push(`${JSON.stringify(wrapped)} wrapped in a ${summary.column}px box`);
      }
      // The keys are a column at every width -- that is what makes five facts read as
      // one answer rather than five sentences.
      if (summary.keyLefts.length !== 1) {
        problems.push(`the keys start at ${JSON.stringify(summary.keyLefts)}, expected one x`);
      }
      // And the figures line up too, while the key column is fixed. Under 18.5rem of the
      // box's CONTENT width -- 296px, which a 320px phone is under at 270px and a 390px
      // phone is not at 325px -- the keys size to their own text and the figures are
      // expected to spread. Compared against the inner width for the same reason the CSS
      // is written against it: the container query never sees the padding.
      const alignedFigures = summary.inner >= 296;
      if (alignedFigures && summary.valueLefts.length !== 1) {
        problems.push(`the figures start at ${JSON.stringify(summary.valueLefts)} in a `
          + `${summary.column}px box (${summary.inner}px inside), expected one x`);
      }
      if (!alignedFigures && summary.valueLefts.length === 1 && summary.rows.length > 2) {
        problems.push(`the figures still share one x in a ${summary.column}px box (${summary.inner}px inside) — the narrow `
          + 'rule that lets the keys size to their text is not applying');
      }
      if (summary.identityPips < 1) problems.push('the colour identity is not in the summary box');
      if (summary.bracketPips !== 5) {
        problems.push(`${summary.bracketPips} bracket pips inside the summary box, expected 5`);
      }
      if (!summary.aboveResults) problems.push('the deck summary is below the results it describes');
    }

    // A deck with nothing wrong is told nothing. The two illegal decks have their own
    // run below, because the full battery here is about the tuning deck: adding an
    // off-colour card to it changes its colour identity, its combo list and its
    // ordering, and every one of those has an assertion of its own.
    if (v.legality.shown) {
      problems.push('a legal deck was given a legality line saying '
        + `${JSON.stringify(v.legality.banned)} / ${JSON.stringify(v.legality.offIdentity)}`);
    }

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
    // Five pips, one per bracket: 1 and 2 ruled out, 3 the floor, 4 and 5 still
    // open. The states are the claim — a scale that dims the wrong end says the
    // deck cannot be something it can.
    if (bracket.pips.length !== 5) problems.push(`${bracket.pips.length} bracket pips, expected 5`);
    const pipState = bracket.pips.map((p) => p.n + ':' + p.state).join(' ');
    if (pipState !== '1:out 2:out 3:floor 4:open 5:open') {
      problems.push(`the bracket scale reads "${pipState}", expected 1 and 2 out, 3 the floor, 4 and 5 open`);
    }
    // The pips are decorative, so this is the entire answer for anyone not looking
    // at them.
    if (!/Bracket 3 at the earliest/.test(bracket.spoken) || !/Upgraded/.test(bracket.spoken)) {
      problems.push(`the bracket scale is announced as "${bracket.spoken}"`);
    }
    if (!/Bracket 3 at the earliest/.test(bracket.floor)) {
      problems.push(`the bracket floor reads "${bracket.floor}", expected bracket 3`);
    }
    if (!/Upgraded/.test(bracket.floor)) problems.push('the bracket number is not followed by its name');
    if (bracket.changers.length < 3) {
      problems.push(`${bracket.changers.length} cards named behind the pips, expected 2 Game Changers and the two-card wins`);
    }
    if (bracket.changers.includes('Bloom Tender')) {
      problems.push('a Game Changer the deck does not play was counted');
    }
    // Cutting the prose must not cut the links with it: a card named without one is
    // a claim the reader cannot check.
    if (bracket.changerLinks < 4) {
      problems.push(`${bracket.changerLinks} card links behind the pips, expected EDHREC and Scryfall for both Game Changers`);
    }
    if (!/2 Game Changers/.test(bracket.why)) problems.push(`the bracket reason reads "${bracket.why}"`);
    if (!/two-card combo/.test(bracket.why)) problems.push('the two-card win was not given as a reason');
    // The line is a number and nothing else until asked — that is the whole point of
    // the change — and the ways of asking have to work. Hover cannot be simulated,
    // so the press path stands in: it is the one a phone has.
    if (!bracket.closed) problems.push('the bracket explanation is on screen without being asked for');
    if (!bracket.opensOnPress) problems.push('pressing the bracket scale did not open the explanation');
    if (!bracket.closesOnSecondPress) problems.push('a second press did not close the bracket explanation again');
    // And that opening it does not cost the reader the page. An absolutely positioned
    // panel hanging off a control two paddings into the window is the one thing here
    // that can widen the document, and a document wider than the screen is not a
    // scrollbar on a phone — it is the browser zooming everything out to fit, which is
    // how this was reported. Three numbers because they go red in that order: past the
    // box first on a desktop, past the window next, document overflow last.
    const open = bracket.whileOpen;
    if (!open) {
      problems.push('the bracket explanation was never measured open');
    } else {
      if (open.pastBox > 1) {
        problems.push(`the open bracket explanation is ${open.pastBox}px wider than the summary box it explains `
          + `(${open.width}px) — bound it to the line it hangs off, never to the viewport`);
      }
      if (open.pastWindow > 0) problems.push(`the open bracket explanation is ${open.pastWindow}px off the right of the screen`);
      if (open.overflow > 0) {
        problems.push(`opening the bracket explanation gives the page ${open.overflow}px of horizontal overflow — `
          + 'a phone answers that by zooming the whole page out');
      }
    }
    // The caveat is the reason a bracket number here is honest at all.
    if (!/Mass land denial/.test(bracket.caveat)) problems.push('the bracket explanation does not say what it did not check');

    // "Combos in your deck" reaches the screen before the panels below it are built. See
    // the note beside firstFrame in the harness: this is the difference between a reader
    // waiting 797ms and 3,094ms on a phone, and the finished page is identical either
    // way, so the first frame is the only place it can be seen.
    //
    // Asserted in both directions on purpose. "The answer is there" alone would pass if
    // the yield were removed and everything arrived at once, which is the regression;
    // "the suggestions are not there" alone would pass on a page that painted nothing.
    const frame1 = v.firstFrame || {};
    if (!frame1.included) {
      problems.push('the first painted frame after a search has no combos in it — the reader '
        + 'waits for the whole render before seeing anything');
    }
    if (frame1.suggestions || frame1.graph) {
      problems.push('the first painted frame already holds '
        + [frame1.graph && 'the map', frame1.suggestions && 'the suggestions panel']
          .filter(Boolean).join(' and ')
        + ' — those are built after the yield in renderResults(), so this means the render '
        + 'is one task again and the answer waits for panels several screens down');
    }

    // Taking a suggestion: the card lands in the decklist, the list is kept, and
    // the search runs again — proved by the deck holding more combos than it did.
    const added = v.afterAdd;
    if (!added.present) {
      problems.push('no suggestion offered a way to add the card');
    } else {
      if (added.cardLine === -1) {
        problems.push(`Add to deck did not write "1 ${added.card}" into the box (last line "${added.lastLine}")`);
      } else if (added.sectionLine !== -1 && added.cardLine > added.sectionLine) {
        problems.push(`Add to deck put "${added.card}" below the sideboard heading, where it is not in the deck`);
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
      // And the map was redrawn with it, rather than left showing the deck as it
      // was one search ago.
      if (!(added.mapAfter > added.mapBefore)) {
        problems.push(`the map drew ${added.mapBefore} cards before adding ${added.card} and `
          + `${added.mapAfter} after — it was not rebuilt`);
      }
      if (!added.mapHasCard) problems.push(`${added.card} was added but is not on the map`);
      // And the strip, which is the one thing on the page describing the decklist rather
      // than the search — so a render that rebuilt every panel and left it alone would
      // look entirely correct while telling the reader their deck is a card smaller than
      // it is. Compared as text rather than parsed: whichever number moved, it has to
      // have moved.
      if (added.countsAfter === added.countsBefore) {
        problems.push(`the deck-counts strip still reads "${added.countsBefore}" after adding `
          + `${added.card} — it was not recalculated`);
      }
      // …and it was redrawn without forcing a layout to find out how wide to draw.
      // See the note beside widthReads in the harness: the old read cost 601ms of a
      // 3,620ms search on a phone, and nothing about the picture says whether it is
      // back. Any number above zero here means a synchronous geometry read has
      // returned to the render path.
      if (added.widthReads !== 0) {
        problems.push(`redrawing the map read clientWidth ${added.widthReads} time(s) during the `
          + 'search — that flushes layout for the whole document; see columnWidth() in render-map.js');
      }
    }

    // The decklist is the whole input; losing it on reload is the one thing a
    // page like this must not do. And Clear has to actually clear.
    if (!v.storedDeck || !/Basalt Monolith/.test(v.storedDeck)) problems.push('the decklist was not kept for the next visit');
    const cleared = v.afterClear;
    if (cleared.decklist || cleared.commanders) problems.push('Clear left the decklist behind');
    if (cleared.stored) problems.push('Clear left the stored decklist behind');
    if (!cleared.resultsHidden) problems.push('Clear left the results on screen');

    // There were three assertions here over the top-level combo rows: easiest first,
    // what a row shares before what changes, and a family landing in one place. They went
    // with the panel that drew those rows. The rule survives one layer in — the combos
    // under a card are held to exactly that shape by the `leads` check below, which reads
    // the lists this panel actually draws.

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
          // Three bands: the card the list is under, the cards this row shares with its
          // neighbours, then the card that makes it this row. Checked as the shape rather
          // than against the families, which the DOM does not carry — there has to be some
          // split of the tail into two sorted runs. Plain alphabetical satisfies it with an
          // empty second run, which is right: that is what a row with no family draws.
          //
          // This replaces "everything after the focal is alphabetical", which was the rule
          // before the card that changes started going last, and which passed here only
          // because no nested list in this deck holds two rows a card apart.
          const rest = names.slice(1);
          const sortedRun = (xs) => xs.every((x, i) => i === 0 || xs[i - 1].localeCompare(x) <= 0);
          const banded = rest.some((_, k) => sortedRun(rest.slice(0, k + 1)) && sortedRun(rest.slice(k + 1)));
          if (rest.length && !banded) {
            problems.push(`${where}: "${names.join(' + ')}" is not the lead, then what it shares, then what changes`);
          }
        }
      }
      if (!checked) problems.push(`no ${where} combo lists the cards of, so the lead order is untested`);

      // And the rows themselves: smallest first, then the blocks of versions, biggest first,
      // then alphabetically. Play count used to order these, which scatters every repeated
      // partner down the list — the reported symptom was one row sitting third of eleven
      // because it had more plays than the two above it, in a list where no play count is on
      // screen.
      //
      // Two claims, and neither is "alphabetical by the sorted names", which is what this
      // checked until the rows started sorting on what they draw. Size still leads; and a
      // family lands together, which is the property the whole ordering exists for and the
      // one a reader actually sees. Contiguity is checked instead of the sequence itself
      // because the DOM does not carry the family sizes the order also turns on.
      //
      // Say plainly what this is worth today: **the contiguity half cannot fail on this
      // fixture**, because no nested list in this deck holds two rows a card apart. Mutation
      // tested, which is the only way to know: reversing the row order inside a size tier
      // leaves this run green and fails test/combos.test.js, where the same property is
      // pinned on a built list. The band check above does bite here — the same mutation
      // applied to the card order fails nine viewport cases. This stays because it costs
      // nothing and starts biting the day a fixture holds a family, and it is written down so
      // that nobody reads a green run as proof of the half it cannot see.
      for (const row of rows) {
        const order = row.order || [];
        for (let i = 1; i < order.length; i++) {
          if (order[i].size < order[i - 1].size) {
            problems.push(`${where}: under ${row.focal}, a ${order[i].size}-card combo follows a ${order[i - 1].size}-card one`);
            break;
          }
        }
        const seen = new Map();
        for (let i = 0; i < order.length; i++) {
          const key = order[i].size + '@' + order[i].prefix;
          if (!seen.has(key)) { seen.set(key, i); continue; }
          if (seen.get(key) !== i - 1) {
            problems.push(`${where}: under ${row.focal}, rows sharing "${order[i].prefix}" are split apart`);
            break;
          }
          seen.set(key, i);
        }
      }
    }
    // ---- the combo map ----
    //
    // Every claim here is geometric, and every failure of it is silent: a graph
    // whose nodes all landed on one point, or outside the box it is drawn in, is
    // perfectly valid SVG and an empty panel to look at.
    if (!v.map) {
      problems.push('the combo map did not render');
    } else {
      const m = v.map;
      if (m.role !== 'group' || !/\d+ cards, \d+ pairs .* and \d+ pairs /.test(m.described)) {
        problems.push(`the map is not described to a screen reader: "${m.described}"`);
      }
      if (m.dots.length < 5) problems.push(`the map drew only ${m.dots.length} cards`);
      if (!m.edges) problems.push('the map drew no lines between the cards');
      // The second relation. Rings of Brighthearth and Sword of the Meek are
      // never in a combo together and each completes two of the same combos, so
      // the map has to join them — that pair is the whole reason the map is laid
      // out from both relations rather than from shared combos alone.
      if (!m.swapEdges) problems.push('no interchangeable pair was drawn');
      if (!/\d/.test(m.swapDashed)) {
        problems.push(`an interchangeable line is not dashed (${m.swapDashed || 'no dashes'})`);
      }
      if (!m.lineTitles.some((t) => /either one works in \d+ of your combos/.test(t))) {
        problems.push('an interchangeable line does not say what it means on hover');
      }
      // The explicit count, which is the half of "how much overlap" that
      // thickness alone cannot carry.
      if (!m.counts.length) problems.push('no line carries its count');
      if (!m.counts.every((t) => /^\d+$/.test(t))) problems.push(`a count reads "${m.counts.join(',')}"`);
      if (!m.countsOnLines) problems.push('a count is drawn away from the line it belongs to');
      if (m.legend < 4) problems.push(`the legend explains only ${m.legend} of the line kinds`);
      // Either question on its own, with the cards staying exactly where they are
      // — a filter that re-laid the map out would move every card the reader had
      // just found.
      if (m.filtered.swap.combos || !m.filtered.swap.swaps) {
        problems.push(`"interchangeable" left ${m.filtered.swap.combos} combo lines `
          + `and ${m.filtered.swap.swaps} interchangeable ones on screen`);
      }
      if (m.filtered.combo.swaps || !m.filtered.combo.combos) {
        problems.push(`"works together" left ${m.filtered.combo.swaps} interchangeable lines on screen`);
      }
      // A view that hides every number is a view with no counts, which is what an early
      // version did — the class was on the line and not on the text beside it. Asked of
      // both relation views, since both filter counts the same way.
      // The highlight follows the view, which the lines being right does not imply.
      const sl = m.swapLit;
      if (!sl) problems.push('no interchangeable chip, so the view-scoped highlight is unchecked');
      else if (!sl.usable) {
        problems.push('no card on this map has both a stand-in and a combo-only partner, '
          + 'so the swap view\'s highlight cannot be told apart from the combo view\'s');
      } else {
        if (!sl.standInLit) problems.push(`hovering ${sl.subject} in the swap view left its stand-in dim`);
        if (sl.comboOnlyLit) problems.push(`hovering ${sl.subject} in the swap view lit a combo-only partner`);
      }
      if (!m.filtered.swap.countsShown) problems.push('"interchangeable" hid every count on the map');
      if (!m.filtered.combo.countsShown) problems.push('"works together" hid every count on the map');
      if (m.filtered.swap.pressed !== 'true') problems.push('the filter does not report which view is on');
      if (m.filtered.swap.moved || m.filtered.combo.moved) {
        problems.push('filtering the lines moved the cards');
      }
      // Picking two cards out and comparing them. Every number in that sentence
      // is counted from the combos, and the sentence is the only place they are
      // said — so a press that changes nothing, or says nothing, is the failure.
      if (!m.picked) {
        problems.push('the map has nothing to pick out, or nowhere to say what was picked');
      } else {
        const p = m.picked;
        if (p.role !== 'button' || p.focusable !== '0') {
          problems.push(`a card on the map is a ${p.role || 'shape'}, not a button`);
        }
        if (!/in \d+ combos?\. Pick to compare\.$/.test(p.named)) {
          problems.push(`a card's spoken name reads "${p.named}"`);
        }
        if (p.live !== 'status') problems.push('the comparison is not announced when it changes');
        if (!/Press a card/i.test(p.empty || '') && p.empty) {
          problems.push(`the comparison line starts with "${p.empty}"`);
        }
        if (!/is in \d+ of your combos/.test(p.one)) {
          problems.push(`picking one card said "${p.one}"`);
        }
        // The two-card sentence has to be about the pair, and has to carry the
        // cost of cutting them — the number nothing else on the page says.
        if (!/\+|,| and /.test(p.two) || !/combos they appear in/.test(p.two)) {
          problems.push(`picking two cards said "${p.two}"`);
        }
        if (p.ringed !== 2) problems.push(`${p.ringed} cards are ringed after picking two`);
        if (p.pressed !== 'true') problems.push('a picked card does not report itself as pressed');
        if (p.litNodes < 2) problems.push(`only ${p.litNodes} cards stayed lit for the comparison`);
        if (p.afterSecondPress !== 1) {
          problems.push(`pressing a picked card again left ${p.afterSecondPress} picked`);
        }
        if (p.afterBackground !== 0) problems.push('pressing the background did not clear the picks');
        if (!/Press a card/i.test(p.cleared) && p.cleared) {
          problems.push(`the comparison line was left reading "${p.cleared}"`);
        }
      }
      // The fixture has a game-winning combo, a mana one and a plumbing one, so
      // all three tiers must be on the map and in three different colours — a
      // single-colour map is one where the tier classes stopped reaching the CSS.
      if (m.tiers.length !== 3) problems.push(`the map's lines cover ${m.tiers.length} tier(s): ${m.tiers.join('/')}`);
      if (m.edgeColours < 3) problems.push(`the map drew its three tiers in ${m.edgeColours} colour(s)`);
      // Inside its own viewBox, with nothing sitting on top of anything else.
      const [vw, vh] = m.viewBox;
      const outside = m.dots.filter((d) => d.x < 0 || d.y < 0 || d.x > vw || d.y > vh);
      if (outside.length) problems.push(`${outside.length} card(s) drawn outside the map`);
      const collided = m.dots.some((a, i) => m.dots.slice(i + 1).some(
        (b) => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r
      ));
      if (collided) problems.push('two cards are drawn on top of each other');
      // Busier cards are drawn bigger, which is the only thing the sizes say.
      if (new Set(m.dots.map((d) => d.r)).size < 2) problems.push('every card on the map is the same size');
      if (m.labels.some((t) => !t)) problems.push('a card on the map is unlabelled');
      // Named, not just counted. This said only "a card on the map has no hover text",
      // which reddened a CI run at 390px that six local runs could not reproduce — and
      // left nothing to go on, because the one thing worth knowing is which card and what
      // its title actually said. A check that cannot be diagnosed from its own message
      // costs a run per guess.
      const untitled = m.titled.filter((t) => !/ — in \d+ combos?$/.test(t));
      if (untitled.length) {
        problems.push(`${untitled.length} of ${m.titled.length} cards on the map have no `
          + `hover text: ${JSON.stringify(untitled.slice(0, 3))}`);
      }
      // And that there is one per card. A title missing entirely is invisible to the test
      // above, which only reads the titles that exist.
      if (m.titled.length !== m.dots.length) {
        problems.push(`the map drew ${m.dots.length} cards and ${m.titled.length} hover texts`);
      }
      // And it scales with the column rather than overflowing it — the panel is
      // 760px wide by design and the phone viewport is 390.
      if (m.width > v.outWidth + 1) problems.push(`the map is ${m.width}px wide in a ${v.outWidth}px column`);
      if (m.height < 100) problems.push(`the map rendered ${m.height}px tall`);
      // Hovering a card lights it, its neighbours and the lines between them, and
      // pushes the rest back. Without the dimming the highlight is invisible.
      if (m.lit.nodes < 2 || !m.lit.edges) {
        problems.push(`hovering a card lit ${m.lit.nodes} card(s) and ${m.lit.edges} line(s)`);
      }
      if (!m.lit.dimmed) problems.push('hovering a card did not dim the map');
      if (m.lit.faded == null) {
        problems.push('hovering the quietest card lit the whole map, so the dimming is untested');
      } else if (Number(m.lit.faded) > 0.5) {
        problems.push(`a card the hovered one does not touch is still at opacity ${m.lit.faded}`);
      }
      if (m.stillLit) problems.push('the map stayed lit after the pointer left it');
    }
    if (v.panels.some((p) => !p.bodyVisible)) problems.push('a panel rendered with no visible body');
    if (v.panels.some((p) => p.headHeight < 44)) problems.push('a collapse control is under 44px tall');
    // Empty chips must fail: otherwise every assertion below passes vacuously.
    if (!v.chips.length) problems.push('the first combo listed no results at all');
    if (v.chips.length && v.chips[0].win !== true) problems.push('a game-winning result was not listed first');
    if (v.chips.some((c) => c.decisive && !c.title)) problems.push('a yellow result carries no explanation on hover');
    if (!v.chips.some((c) => c.more)) problems.push('the fixture no longer folds anything, so the fold is untested');
    // Grey folds, and this is where that is enforced rather than hoped for: it is the
    // plumbing a loop runs on, the same handful of entries under combo after combo, and
    // four of them on a phone row is most of its height. The assertion here used to be
    // the opposite one — "grey is quieter, not hidden" — so it is worth being explicit
    // that the reversal was measured rather than drifted into.
    if (v.chips.some((c) => c.grey)) {
      problems.push('a grey result is on screen before the fold is opened');
    }
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
    // What the fold is worth, in the only unit that matters here: the height it saves on
    // the row. Printed rather than asserted against a number — the fixture is small, and a
    // real deck's rows carry more grey than it does.
    //
    // Two assertions, and the split between them is the width. Everywhere: opening must
    // never make the row *shorter*, which is the direction a broken fold would go. On a
    // phone: it must save height, because that is where the claim was made and measured —
    // four grey chips on a 390px row is most of its height.
    //
    // It used to demand a strict saving at every width, and that stopped being a fact
    // about the fold when the combo rows moved inside a card's disclosure. In a narrower
    // column the folded chips already wrap, so the three that come back land on the line
    // below and the row does not grow: 56px saved at 390px, 27px at 1440px, 0 at 1920px,
    // where two lines hold all ten either way. A width threshold fitted between the last
    // two would be a measurement of this fixture's columns rather than of the fold.
    const saves = v.resultsHeight && v.resultsHeight.open - v.resultsHeight.folded;
    if (v.resultsHeight && saves < 0) {
      problems.push(`opening the results made the row shorter (${v.resultsHeight.folded}px folded, ${v.resultsHeight.open}px open)`);
    } else if (v.resultsHeight && !saves && v.width <= 480) {
      problems.push(`folding the results saved no height on a ${v.width}px screen `
        + `(${v.resultsHeight.folded}px folded, ${v.resultsHeight.open}px open)`);
    }
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
    const pieceNote = v.topPiece
      ? `top piece ${v.topPiece.card} ${v.topPiece.total} ${JSON.stringify(v.topPiece.pills)}`
      : 'no pieces';
    const tabNote = v.tabs.map((t) => `${t.active ? '[' : ''}${t.label}:${t.count}${t.active ? ']' : ''}`).join(' ');
    const chipNote = `${v.chips.length} folded (${v.resultsHeight.folded}px) / ${v.expandedChips.length} open (${v.resultsHeight.open}px), ${new Set(v.expandedChips.map((c) => c.colour)).size} colours [${v.expandedChips.map((c) => (c.win ? 'G:' : c.decisive ? 'Y:' : 'x:') + c.text).join(', ')}]`;
    if (problems.length) {
      failed = true;
      console.error(`FAIL ${v.name} @${v.width}px — ${problems.join('; ')}`);
    } else {
      const headNote = `{${v.header.pips.map((p) => p.letter).join('}{')}} from the cards`;
      // The shape the headings took and the two numbers that chose it, so a changed
      // threshold is visible in a passing run rather than only in a failure.
      const signNote = v.signAlign.length
        ? 'signs ' + v.signAlign.map((sg) => `${sg.where} raised ${sg.raised}px of ${sg.ideal}px`
          + ` (${sg.idealEm}em of ${sg.signSize}px)`).join(', ')
        : 'no sign measured';
      const gutterNote = v.gutterNeeds
        ? `gutter ${v.gutterNeeds.column}px holds ${v.gutterNeeds.widest}px (${v.gutterNeeds.what})`
          + `, worst case 0+1889 is ${v.gutterNeeds.worst}px, pad ${v.gutterNeeds.pad}px`
        : 'no gutter measured';
      const cardsNote = v.headingShape && v.headingShape.rows
        ? `headings ${v.headingShape.sharing ? 'inline' : 'one card per line'} in `
          + `${v.headingShape.column}px (needs ${v.headingShape.wants}px inline), `
          + `${v.linkLine ? v.linkLine.seps : 0} link separator(s), text ${v.headingShape.text}px `
          + `with ${v.headingShape.air}px of air`
        : 'no headings measured';
      const compareNote = v.grouped.compare.length
        ? `, compare ${v.grouped.compare.map((c) => c.label.replace(/Compare all (\d+)/, '$1 cards')).join(' / ')}`
        : '';
      const groupNote = `grouped: ${v.grouped.altGroups.length} suggestion choice(s)${compareNote}`;
      const mixedRow = v.sizes.find((r) => r.pills.length > 1) || v.sizes[0];
      const sizeNote = `sizes ${JSON.stringify(mixedRow.pills)} unlocking [${mixedRow.unlockSizes.join(',')}]`
        + `, ${v.included.badge} combos across ${v.included.rows} cards`;
      // Which branch the rows took, and the width that chose it: the pair is what
      // makes a changed threshold visible in the output rather than only in a failure.
      const legalNote = v.legality.shown
        ? `illegal [banned ${JSON.stringify(v.legality.banned)}, off-colour ${JSON.stringify(v.legality.offIdentity)}]`
        : 'nothing illegal';
      const unknownNote = v.unknownCards.shown
        ? `unrecognized [${v.unknownCards.names.join(', ')}]`
        : 'every card recognized';
      // The summary box as a reader sees it, row by row, with the box width that decides
      // whether the keys hold a column — the pair that makes a changed threshold visible
      // in a passing run rather than only in a failure.
      const stripNote = 'summary ' + v.deckSummary.rows
        .map((r) => `${r.key} ${r.n}${r.sub ? ' (' + r.sub + ')' : ''}`.trim())
        .join(' / ') + ` in ${v.deckSummary.column}px`;
      const linked = v.numberColumns.filter((c) => c.rowLinks.length);
      const linkNote = `links ${linked.some((c) => c.rowLinks.every((r) => r.beside)) ? 'beside' : 'below'} the name `
        + `in ${linked.map((c) => c.column + 'px').join('/')} column(s)`;
      // The x the row's divider is drawn at, and where the blocks beside it start.
      // One number for the line because every piece of it agrees, which is the thing
      // being asserted; and the shape the choice of card took in the column it had,
      // because that is the half of this the width decides.
      const shape = v.grouped.altLabel
        ? `, choice in ${v.grouped.column}px: pill ${v.grouped.altLabel.pillBeside ? 'beside' : 'below'} the label, `
          + `${v.grouped.altRows[0] && v.grouped.altRows[0].sameLine ? 'one line' : 'two lines'} per card`
        : '';
      const dividerNote = `divider at ${v.dividers[0].blocks[0].line}px, ${v.dividers[0].blocks.length} pieces,`
        + ` blocks from ${v.dividers[0].summaryLeft}px${shape}`;
      const bracketNote = `bracket [${v.bracket.pips.map((p) => (p.state === 'floor' ? `(${p.n})` : p.state === 'out' ? '·' : p.n)).join('')}] `
        + `${v.bracket.floor.replace(/ — .*/, '')}, why on press (${v.bracket.changerLinks} card links) `
        // The panel's width and the room it has left, printed in a passing run: the whole
        // bug was that it read fine and measured 123px off the screen, and the bound is
        // the box now rather than the window, so what the box gives it is worth seeing.
        + `${v.bracket.whileOpen.width}px wide, ${-v.bracket.whileOpen.pastBox}px inside the box`;
      const addNote = `+${v.afterAdd.card} took combos ${v.afterAdd.combosBefore}→${v.afterAdd.combosAfter}`
        + ` and the map ${v.afterAdd.mapBefore}→${v.afterAdd.mapAfter} cards`
        + `, strip "${v.afterAdd.countsBefore}" → "${v.afterAdd.countsAfter}"`;
      const mapNote = `map ${v.map.dots.length} cards / ${v.map.edges} combo lines `
        + `(${v.map.tiers.join(',')}) + ${v.map.swapEdges} interchangeable, counts `
        + `[${v.map.counts.join(',')}] and ${v.map.hiddenCounts} on hover, at ${v.map.width}×${v.map.height}, `
        + `hover lights ${v.map.lit.nodes}+${v.map.lit.edges}, `
        + `picking two: "${(v.map.picked ? v.map.picked.two : '').slice(0, 90)}…"`;
      console.log(`ok   ${v.name} @${v.width}px — ${layout}, ${headNote}, ${v.panels.length} panels, tabs ${tabNote}, ${pieceNote}, ${groupNote}, ${sizeNote}, ${dividerNote}, ${gutterNote}, ${signNote}, ${linkNote}, ${cardsNote}, ${stripNote}, ${unknownNote}, ${legalNote}, ${bracketNote}, ${addNote}, ${mapNote}, data from ${v.dataAge.source}, ${chipNote}, ${footerNote(v.footer)}`);
    }
  }

  // ---- the tier review page ----
  for (const t of await collect(asPublished(TIERS_FIXTURE), TIERS_HARNESS, 'The tier page')) {
    if (!t.ok) {
      console.error(`FAIL ${t.name} — ${t.error}`);
      failed = true;
      continue;
    }
    const problems = [];
    if (Math.abs(t.width - t.requested) > 20) problems.push(`rendered at ${t.width}px, not ${t.requested}px`);
    if (t.overflow > 0) problems.push(`horizontal overflow of ${t.overflow}px`);
    problems.push(...footerProblems(t.footer));
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
      console.log(`ok   ${t.name} @${t.width}px — ${t.rows} results, chips ${t.chipCounts.join('/')}, flagged: ${t.flagText}, ${footerNote(t.footer)}`);
    }
  }

  if (failed) process.exit(1);
  console.log('Layout verified at all viewports.');
})().catch((err) => {
  console.error('verify-layout crashed:', err);
  process.exit(1);
});
