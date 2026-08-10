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
//
// **Where the plan comes from, and why not from here.** Nothing in this file can be unit
// tested — requiring it pulls in @playwright/test, which is fetched per run — so the
// defaults it used to hold were unwatched, and three were wrong at once: no wait after
// pressing a control, `index.html` hard-coded, and pictures written where the next
// `test:ui` deletes them. The decisions live in tools/shot-config.js now and the gestures
// live here. Issue #206.
'use strict';

const { test } = require('@playwright/test');
const fs = require('node:fs');
const { DECKS } = require('../test/fixtures/dataset.js');
const { shotPlan } = require('../tools/shot-config.js');

if (process.env.SHOT) {
  const plan = shotPlan(process.env);
  const deck = DECKS[plan.deck] || DECKS.marked;

  test('shot', async ({ page }, info) => {
    if (plan.width) await page.setViewportSize({ width: plan.width, height: plan.height });
    await page.goto(plan.page);

    if (plan.search) {
      if (plan.commanders) await page.locator('#commanders').fill(plan.commanders);
      await page.locator('#decklist').fill(deck);
      await page.getByRole('button', { name: 'Find combos' }).click();
      await page.locator('#results').waitFor();
      // The search paints in two tasks — combos first, panels after a yield — so a picture
      // taken on #results alone can catch the half-drawn page. See renderResults() in app.js.
      await page.locator('#pieces .combo').first().waitFor();
    }

    if (plan.open) {
      const control = page.locator(plan.open).first();
      await control.click();
      // The wait that was missing. Clicking and screenshotting on the next line catches the
      // one thing the picture is being taken of mid-transition, which is the tool being
      // least reliable at its own job.
      //
      // Asked of the control rather than configured, because this page says what it opens:
      // every disclosure here sets `aria-controls` (app.js for the bracket, page-dom.js for
      // a panel, render-combos.js for a steps row). SHOT_WAIT is the override for a control
      // that does not — and a `<details>` is neither, so its content is waited for through
      // the screenshot target itself, which Playwright already holds still before shooting.
      const target = plan.waitFor || await control.getAttribute('aria-controls');
      if (target) {
        const opened = plan.waitFor ? page.locator(plan.waitFor) : page.locator('#' + target);
        await opened.first().waitFor({ state: 'visible' });
      }
    }

    fs.mkdirSync(plan.out, { recursive: true });
    const file = `${plan.out}/shot-${info.project.name}.png`;
    await page.locator(plan.selector).first().screenshot({ path: file });
    console.log(`shot: ${plan.selector} at ${info.project.name} -> ${file}`);
  });
}
