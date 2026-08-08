// Look at the page. Not a test — a way of seeing what a change did.
//
// Both harnesses in this repository report *numbers*: `verify` prints geometry and this
// suite asserts behaviour, and neither can answer "does that read right". Three times in
// the session that wrote this file, the answer needed a picture — is the panel covering the
// rows, do 30 card names look like a list or like a column — and each time it meant writing
// a throwaway spec into e2e/, remembering the NODE_PATH incantation from the `test:ui`
// script, running it, and deleting the file. One of those runs was lost to `npx playwright
// test` instead, which resolves a different Playwright and dies on MODULE_NOT_FOUND.
//
// IT REGISTERS NO TESTS UNLESS SHOT IS SET, which is what keeps it out of the suite. Not
// `test.skip()`: a skipped test is still a test, it moves the count `test:ui` reports and it
// reads as something switched off rather than as a tool. With SHOT unset this file
// contributes nothing at all and `npm run test:ui` cannot tell it is here.
//
// Deliberately not asserting anything. A screenshot that fails is a screenshot nobody
// looks at, and the thing being examined is usually mid-change and legitimately wrong.
'use strict';

const { test } = require('@playwright/test');
const path = require('node:path');
const { DECKS } = require('../test/fixtures/dataset.js');

if (process.env.SHOT) {
  const selector = process.env.SHOT_SELECTOR || '#results';
  const deck = DECKS[process.env.SHOT_DECK || 'marked'] || DECKS.marked;
  const out = process.env.SHOT_OUT || path.join(__dirname, '..', 'test-results');
  // A control to press before the picture is taken — the reason this exists at all, since
  // the two things worth photographing in this page's history were both behind one.
  const open = process.env.SHOT_OPEN || '';

  test('shot', async ({ page }, info) => {
    await page.goto('/index.html');
    await page.locator('#decklist').fill(deck);
    await page.getByRole('button', { name: 'Find combos' }).click();
    await page.locator('#results').waitFor();
    // The search paints in two tasks — combos first, panels after a yield — so a picture
    // taken on #results alone can catch the half-drawn page. See renderResults() in app.js.
    await page.locator('#pieces .combo').first().waitFor();
    if (open) await page.locator(open).first().click();

    const file = path.join(out, `shot-${info.project.name}.png`);
    await page.locator(selector).first().screenshot({ path: file });
    console.log(`shot: ${selector} at ${info.project.name} -> ${file}`);
  });
}
