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
function visibleTextIn(win, node) {
  return [...node.childNodes].map((n) => {
    if (n.nodeType === 3) return n.textContent;
    if (n.nodeType !== 1) return '';
    return win.getComputedStyle(n).display === 'none' ? '' : visibleTextIn(win, n);
  }).join('');
}

function measure(win, doc) {
  const visibleText = (node) => visibleTextIn(win, node);
  const panels = [...doc.querySelectorAll('.panel')].map((p) => ({
    title: p.querySelector('.panel-title').textContent,
    count: (p.querySelector('.panel-count') || {}).textContent || null,
    bodyVisible: p.querySelector('.panel-body').offsetHeight > 0,
    headHeight: p.querySelector('.panel-head').offsetHeight,
  }));
  const piecesPanel = [...doc.querySelectorAll('.panel')].find((x) => /carrying/i.test(x.querySelector('.panel-title').textContent));
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
  const grouped = {
    // A combo row offering a choice of part, and a suggestion offering a choice
    // of card. Both exist in the fixture, so both must render.
    eitherRows: [...doc.querySelectorAll('#included .either')].map((e) => e.textContent),
    choiceRows: doc.querySelectorAll('#included .choices').length,
    altGroups: [...doc.querySelectorAll('.alternatives .alt-label')].map((e) => e.textContent),
    // Does the label and its comparison link fit on one row? Measured in lines, not
    // characters: the wording, the font and the width all decide it together.
    altLabel: (() => {
      const label = doc.querySelector('.alternatives .alt-label');
      if (!label) return null;
      const lineHeight = parseFloat(win.getComputedStyle(label).lineHeight) || 16;
      const pill = label.querySelector('.alt-all');
      const box = label.getBoundingClientRect();
      return {
        lines: Math.round(box.height / lineHeight),
        boxWidth: Math.round(box.width),
        pillWidth: pill ? Math.round(pill.getBoundingClientRect().width) : 0,
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
  const comboCompare = [...doc.querySelectorAll('#included .panel-body > .combo')].slice(0, 4).map((row) => {
    const head = row.querySelector(':scope > h3');
    const a = row.querySelector(':scope > .combo-link .alt-all');
    const spellbook = row.querySelector(':scope > .combo-link a:not(.alt-all)');
    return {
      names: head ? [...head.querySelectorAll(':scope > .card-name')].map((n) => n.textContent) : [],
      slots: head ? head.querySelectorAll(':scope > .slot').length : 0,
      // A collapsed row names its shared cards in the heading and its interchangeable
      // ones underneath, and the comparison has to cover both — that whole set is what
      // the reader is choosing between.
      choices: [...row.querySelectorAll(':scope > .choices .card-name')].map((n) => n.textContent),
      label: a ? a.textContent : null,
      href: a ? a.getAttribute('href') : null,
      hasSpellbook: Boolean(spellbook),
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
    // The order these are listed in: size first, then alphabetically by the cards.
    // Sizes count a slot and an "any of N" too, since something has to occupy them —
    // without that a two-card-plus-slot row looks smaller than it is and the size
    // sequence appears to go backwards.
    const order = [...row.querySelectorAll('details > .combo > h3')].map((h) => {
      const names = [...h.querySelectorAll(':scope > .card-name')].map((n) => n.textContent);
      return {
        size: names.length + h.querySelectorAll(':scope > .slot').length
          + (h.querySelector(':scope > .either') ? 1 : 0),
        // Compared on the names sorted, not as drawn: the focal card is pulled to the
        // front on screen, and it is the same card on every row here.
        sig: names.slice().sort().join(' + '),
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
    opensOnPress: (() => {
      if (!scaleButton || !whyPanel) return false;
      scaleButton.click();
      const open = win.getComputedStyle(whyPanel).display !== 'none';
      scaleButton.click(); // put it back, so nothing measured after this sees it open
      return open;
    })(),
    closesOnSecondPress: Boolean(whyPanel) && win.getComputedStyle(whyPanel).display === 'none',
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
    const winEdges = [...svg.querySelectorAll('.edge.tier-win')];
    const counts = [...svg.querySelectorAll('.count')];
    for (const view of ['swap', 'combo', 'win']) {
      if (chip(view)) chip(view).click();
      filtered[view] = {
        combos: combos.filter((e) => win.getComputedStyle(e).display !== 'none').length,
        swaps: swapEdges.filter((e) => win.getComputedStyle(e).display !== 'none').length,
        // What the game-ending view is for, and the thing that made it worth a test:
        // the numbers on the lines carry the tier too, and without that the view hid
        // every count including the ones belonging to the lines it was showing.
        wins: winEdges.filter((e) => win.getComputedStyle(e).display !== 'none').length,
        countsShown: counts.filter((e) => win.getComputedStyle(e).display !== 'none').length,
        pressed: chip(view) ? chip(view).getAttribute('aria-pressed') : null,
        moved: [...svg.querySelectorAll('.node .dot')]
          .some((c, i) => c.cx.baseVal.value !== before[i][0] || c.cy.baseVal.value !== before[i][1]),
      };
    }
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
      labels: [...svg.querySelectorAll('.node .label')].map((t) => t.textContent),
      titled: [...svg.querySelectorAll('.node > title')].map((t) => t.textContent),
      lineTitles: [...svg.querySelectorAll('.edge > title')].map((t) => t.textContent),
      described: (svg.querySelector(':scope > title') || {}).textContent || '',
      role: svg.getAttribute('role'),
      lit,
      stillLit: svg.classList.contains('is-lit'),
    };
  })();

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
    comboCompare,
    stuck,
    order,
    leads,
    bracket,
    dataAge,
    numberColumns,
    sizes,
    included,
    map,
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
        stuckRows: doc.querySelectorAll('#slots .combo').length,
        // Read after the search, so the two scripts app.js injects are in the DOM by
        // now and their URLs are part of what gets checked for the stamp.
        scripts: [...doc.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')),
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
    const badge = row && row.querySelector('.derived-badge');
    const link = row && row.querySelector('.combo-link a');
    const included = doc.getElementById('included');
    const unofficial = doc.getElementById('unofficial');
    // Which comes first on the page. Published combos have to be read before ours.
    const order = included.compareDocumentPosition(unofficial);

    return {
      ok: true,
      name: vp.name,
      requested: vp.width,
      steps: vp.steps || 1,
      // "Cards carrying your combos" counts both now, in two numbers rather than
      // one. This deck has no published combos at all, so every card in that
      // panel is there on our authority — which is precisely the case the panel
      // used to answer by leaving the card out.
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
        note: row && row.querySelector('.derived-note') ? row.querySelector('.derived-note').textContent : '',
        link: link ? link.textContent : null,
        href: link ? link.getAttribute('href') : null,
        chips: row ? row.querySelectorAll('.results .result').length : 0,
        officialEmpty: !!included.querySelector('.empty'),
        officialRows: doc.querySelectorAll('#included .combo').length,
        // DOCUMENT_POSITION_FOLLOWING is 4.
        unofficialIsBelow: (order & 4) === 4,
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
        // ...and the combos behind them are listed under a heading that says so.
        heading: row && row.querySelector('.ours-head') ? row.querySelector('.ours-head').textContent : null,
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
        await settled(doc, '.combo');

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
          // The map is drawn from the search's own results, so it has to move
          // with them. A picture that is one search behind the list beside it is
          // worse than no picture — it says the added card is in no combos.
          mapBefore: before.map ? before.map.dots.length : 0,
        };
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
            const nowBadge = (doc.querySelector('#included .panel-count') || {}).textContent;
            if (nowBadge && nowBadge !== wasBadge) break;
            await new Promise((r) => setTimeout(r, 50));
          }
          await new Promise((r) => setTimeout(r, 120));
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
      if (s.panels < 4) wrong.push(`only ${s.panels} panels rendered from a stamped page`);
      if (s.stuckRows < 2) wrong.push(`the one-slot-away rows did not render from a stamped page`);
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
      if (!/Spellbook has not published/.test(g.heading || '')) {
        wrong.push(`the combos are not marked as ours: "${g.heading}"`);
      }
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
      // ...and it has to show its working, or it is just an assertion on screen.
      if (!['verified', 'derived'].includes(u.badge)) wrong.push(`no confidence badge: "${u.badge}"`);
      if (!(u.badgeClass || '').includes(u.badge)) wrong.push('the badge is not styled by its confidence');
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
      // "Cards carrying your combos" answers what cutting a card costs, and this
      // deck's cards hold up nothing but our own row — so a panel that counted
      // only Spellbook's would leave every one of them out, or say nothing.
      const pc = v.pieces || {};
      if (pc.rows !== 3) wrong.push(`${pc.rows} cards in "carrying your combos", expected 3`);
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
          + `${u.chips} results, cited to ${u.href.split('/combo/')[1]}, published panel empty`);
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
    // Combos in your deck, how they connect, one slot away, cards carrying them,
    // suggested additions. The bracket check is not among them — it stopped being
    // a panel and became a line beside the colour identity, which the next check
    // is what keeps true.
    if (v.panels.length !== 5) problems.push(`expected 5 panels, got ${v.panels.length}`);
    if (v.panels.some((p) => /Bracket check/.test(p.title))) problems.push('the bracket check is a panel again');
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
    if (g.altGroups.some((t) => !/or (these \d+|this one), same combos?:/.test(t))) problems.push(`an alternatives label reads "${g.altGroups[0]}"`);
    // One row, label and comparison link together. At 390px there is 298px for both
    // and the link takes 108 of it, so the wording has to stay short — the previous
    // "or any one of these N instead — same combos:" took two lines and pushed the
    // link onto its own.
    if (g.altLabel && g.altLabel.lines !== 1) {
      problems.push(`the alternatives label needs ${g.altLabel.lines} rows for "${g.altLabel.text}" in ${g.altLabel.boxWidth}px`);
    }
    if (g.altNames < 1) problems.push('the alternatives list named no cards');

    // Every + Add in a choice on the same line as its card, and every one of them on
    // the same right edge. The second is the point: buttons that each start wherever
    // the name before them happened to end make a list of four look like a mistake.
    if (!g.altRows.length) problems.push('no interchangeable row offered a + Add to measure');
    const strays = g.altRows.filter((r) => !r.sameLine);
    if (strays.length) {
      problems.push(`${strays.length} + Add button(s) wrapped off their card's line, e.g. ${strays[0].name}`);
    }
    const edges = [...new Set(g.altRows.map((r) => r.addRight))];
    if (edges.length > 1) {
      problems.push(`the + Add buttons sit on ${edges.length} different edges (${edges.join('px, ')}px), so they do not line up`);
    }
    // A clipped name must still be readable some other way, or the row has lost
    // information rather than just space.
    const mute = g.altRows.filter((r) => !r.titled);
    if (mute.length) problems.push(`${mute.length} clipped name(s) carry no title, e.g. ${mute[0].name}`);

    // Every combo row offers one link that opens all its cards at once — the point
    // being a quick look at what a combo asks for before committing to it. One link
    // and not one per name: a four-card row would carry four, and reading the cards is
    // a single action.
    if (!v.comboCompare.length) problems.push('no combo rows to check the comparison link on');
    v.comboCompare.forEach((row) => {
      const whose = row.names.join(' + ') || 'a combo';
      if (!row.names.length) return; // a row of nothing but slots has no cards to open
      const wanted = row.names.concat(row.choices);
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
    // The caveat is the reason a bracket number here is honest at all.
    if (!/Mass land denial/.test(bracket.caveat)) problems.push('the bracket explanation does not say what it did not check');

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

      // And the rows themselves: smallest first, then alphabetically by their cards.
      // Play count used to order these, which scatters every repeated partner down the
      // list — the reported symptom was one row sitting third of eleven because it had
      // more plays than the two above it, in a list where no play count is on screen.
      for (const row of rows) {
        const order = row.order || [];
        for (let i = 1; i < order.length; i++) {
          const prev = order[i - 1];
          const cur = order[i];
          if (cur.size < prev.size) {
            problems.push(`${where}: under ${row.focal}, a ${cur.size}-card combo follows a ${prev.size}-card one`);
            break;
          }
          if (cur.size === prev.size && cur.sig.localeCompare(prev.sig) < 0) {
            problems.push(`${where}: under ${row.focal}, "${cur.sig}" is listed after "${prev.sig}"`);
            break;
          }
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
      // Only the game-enders, and no interchangeable lines — which is a decision, not
      // a side effect: a swap line has no combo behind it and so no tier to filter by.
      const w = m.filtered.win;
      if (!w.wins) problems.push('"game-ending" left no game-ending lines on screen at all');
      if (w.combos !== w.wins) {
        problems.push(`"game-ending" left ${w.combos} combo lines on screen but only ${w.wins} of them end the game`);
      }
      if (w.swaps) problems.push(`"game-ending" left ${w.swaps} interchangeable lines on screen`);
      // A view that hides every number is a view with no counts, which is what the
      // first version of this did — the tier class was on the line and not the text.
      if (!w.countsShown) problems.push('"game-ending" hid every count on the map');
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
      if (m.titled.some((t) => !/ — in \d+ combos?$/.test(t))) problems.push('a card on the map has no hover text');
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
    const pieceNote = v.topPiece
      ? `top piece ${v.topPiece.card} ${v.topPiece.total} ${JSON.stringify(v.topPiece.pills)}`
      : 'no pieces';
    const tabNote = v.tabs.map((t) => `${t.active ? '[' : ''}${t.label}:${t.count}${t.active ? ']' : ''}`).join(' ');
    const chipNote = `${v.chips.length} folded / ${v.expandedChips.length} open, ${new Set(v.expandedChips.map((c) => c.colour)).size} colours [${v.expandedChips.map((c) => (c.win ? 'G:' : c.decisive ? 'Y:' : 'x:') + c.text).join(', ')}]`;
    if (problems.length) {
      failed = true;
      console.error(`FAIL ${v.name} @${v.width}px — ${problems.join('; ')}`);
    } else {
      const headNote = `{${v.header.pips.map((p) => p.letter).join('}{')}} from the cards`;
      const compareNote = v.grouped.compare.length
        ? `, compare ${v.grouped.compare.map((c) => c.label.replace(/Compare all (\d+)/, '$1 cards')).join(' / ')}`
        : '';
      const groupNote = `grouped: ${v.grouped.eitherRows.length} combo row(s) ${JSON.stringify(v.grouped.eitherRows)}, ${v.grouped.altGroups.length} suggestion choice(s)${compareNote}`;
      const stuckNote = `${v.stuck.rows} one slot away (${v.stuck.missing.join(', ')})`;
      const mixedRow = v.sizes.find((r) => r.pills.length > 1) || v.sizes[0];
      const sizeNote = `sizes ${JSON.stringify(mixedRow.pills)} unlocking [${mixedRow.unlockSizes.join(',')}]`
        + `, rows ${JSON.stringify(v.order.map((r) => r.size))}`;
      // Which branch the rows took, and the width that chose it: the pair is what
      // makes a changed threshold visible in the output rather than only in a failure.
      const linked = v.numberColumns.filter((c) => c.rowLinks.length);
      const linkNote = `links ${linked.some((c) => c.rowLinks.every((r) => r.beside)) ? 'beside' : 'below'} the name `
        + `in ${linked.map((c) => c.column + 'px').join('/')} column(s)`;
      const bracketNote = `bracket [${v.bracket.pips.map((p) => (p.state === 'floor' ? `(${p.n})` : p.state === 'out' ? '·' : p.n)).join('')}] `
        + `${v.bracket.floor.replace(/ — .*/, '')}, why on press (${v.bracket.changerLinks} card links)`;
      const addNote = `+${v.afterAdd.card} took combos ${v.afterAdd.combosBefore}→${v.afterAdd.combosAfter}`
        + ` and the map ${v.afterAdd.mapBefore}→${v.afterAdd.mapAfter} cards`;
      const mapNote = `map ${v.map.dots.length} cards / ${v.map.edges} combo lines `
        + `(${v.map.tiers.join(',')}) + ${v.map.swapEdges} interchangeable, counts `
        + `[${v.map.counts.join(',')}] and ${v.map.hiddenCounts} on hover, at ${v.map.width}×${v.map.height}, `
        + `hover lights ${v.map.lit.nodes}+${v.map.lit.edges}, `
        + `picking two: "${(v.map.picked ? v.map.picked.two : '').slice(0, 90)}…"`;
      console.log(`ok   ${v.name} @${v.width}px — ${layout}, ${headNote}, ${v.panels.length} panels, tabs ${tabNote}, ${pieceNote}, ${groupNote}, ${stuckNote}, ${sizeNote}, ${linkNote}, ${bracketNote}, ${addNote}, ${mapNote}, data from ${v.dataAge.source}, ${chipNote}`);
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
