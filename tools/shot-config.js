#!/usr/bin/env node
// What `npm run shot` is being asked to photograph, worked out from the environment.
//
// It is a separate file for the reason the workflow `run:` blocks are: e2e/shot.spec.js
// cannot be loaded by a unit test — requiring it pulls in @playwright/test, which is
// fetched per run and is not here — so every decision inside it was unwatched. Three of
// them were wrong at once (see the header of that file), and the one that mattered most
// was a default nobody would think to question: pictures were written into
// `test-results/`, which Playwright empties at the start of the next run, so a shot
// survived only until somebody ran `npm run test:ui`.
//
// So the spec keeps the gestures and this keeps the decisions. Everything here is a
// string in and a plan out — no page, no filesystem.
'use strict';

const path = require('node:path');

// Where a picture goes. Not `test-results/`: that is Playwright's own output directory
// and it is cleared per run, which made the tool quietly lossy exactly when it was used
// twice. `shots/` is gitignored and nothing else writes there.
const DEFAULT_OUT = 'shots';

// The page a shot lands on unless asked otherwise. A leading slash because it is a URL
// path handed to page.goto() against the harness's baseURL, not a file.
const DEFAULT_PAGE = '/index.html';

// Which pages hold a decklist box worth filling. `tiers.html` has none, so a shot of it
// that tried to search would fail on a missing selector rather than photograph anything —
// the reason page and search are one decision here instead of two flags in the spec.
const SEARCHABLE = ['/index.html', '/'];

function shotPlan(env) {
  const e = env || {};
  const page = normalisePage(e.SHOT_PAGE);
  // `SHOT_SEARCH=0` is how the empty state is reached: the page as it looks before
  // anybody has pasted anything, which has shipped bugs of its own and was
  // unphotographable while a search was unconditional.
  const search = SEARCHABLE.includes(page) && e.SHOT_SEARCH !== '0';
  return {
    page,
    search,
    deck: e.SHOT_DECK || 'marked',
    // #results is the default target and is meaningless without a search — so when the
    // search is off the target falls back to the whole page rather than to a selector
    // that will never appear.
    selector: e.SHOT_SELECTOR || (search ? '#results' : 'body'),
    open: e.SHOT_OPEN || '',
    // What to wait for after pressing. Optional, because the spec can usually work it out
    // from the control itself — this is the override for a control that opens something
    // it does not name.
    waitFor: e.SHOT_WAIT || '',
    commanders: e.SHOT_COMMANDERS || '',
    width: Number(e.SHOT_WIDTH) || 0,
    height: Number(e.SHOT_HEIGHT) || 900,
    out: e.SHOT_OUT || path.join(__dirname, '..', DEFAULT_OUT),
  };
}

function normalisePage(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_PAGE;
  return raw.startsWith('/') ? raw : '/' + raw;
}

module.exports = { shotPlan, DEFAULT_OUT, DEFAULT_PAGE, SEARCHABLE };
