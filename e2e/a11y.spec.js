// The accessibility work here is done by hand and, until now, checked by hand:
// aria-pressed on every map node, a tablist with roving tabindex, role="status"
// on the summary, labelled mana pips, a <title> inside the SVG, a theme toggle
// that hides itself if its own script never arrived. That is a lot of correct
// detail with nothing guarding it, and the failures are the quiet kind — a
// contrast ratio a theme-token change broke, a control that lost its accessible
// name. Neither shows up in a screenshot and neither fails any other test here.
//
// axe-core is fetched for the run, like Playwright and ESLint, and pinned for the
// same reason: a new rule in a release nobody here decided to take should not turn
// a day nobody touched this repository into a red build.
//
// Injected with page.evaluate() rather than page.addScriptTag(). Both pages carry
// `script-src 'self'`, so a tag would be refused — correctly, that is the policy
// doing its job. evaluate() runs through the debugging protocol, which is not
// subject to it, so the page under test keeps the exact CSP it ships with.
'use strict';

const { test, expect } = require('@playwright/test');
const { source: axeSource } = require('axe-core');
const { DECKS } = require('../test/fixtures/dataset.js');

// WCAG 2.1 AA and nothing else. axe ships "best-practice" rules too, which are
// advice rather than conformance — worth reading once, not worth failing a build
// over, and a suite that cries wolf gets muted.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function violations(page, context) {
  await page.evaluate(axeSource);
  return page.evaluate(
    ([tags, ctx]) => window.axe
      .run(ctx || document, { runOnly: { type: 'tag', values: tags } })
      .then((r) => r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        // The selector of each offending node, because "colour-contrast failed"
        // somewhere on a page with 40 combo rows is not a bug report.
        nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
      }))),
    [TAGS, context]
  );
}

// Playwright compares deep-equal and prints the whole object on failure, so an
// empty array is the assertion *and* the report: a violation arrives with its
// rule id, its impact, and where it is.
const expectClean = async (page, context) => expect(await violations(page, context)).toEqual([]);

async function search(page) {
  await page.locator('#decklist').fill(DECKS.marked);
  await page.getByRole('button', { name: 'Find combos' }).click();
  await expect(page.locator('#included .combo').first()).toBeVisible();
}

test('the empty page is clean', async ({ page }) => {
  await page.goto('/index.html');
  await expectClean(page);
});

// The page as it actually gets read: every panel drawn, the map rendered, the
// tabs live. Almost none of this markup exists before a search, so checking only
// the form would be checking the least of it.
test('the page after a search is clean', async ({ page }) => {
  await page.goto('/index.html');
  await search(page);
  await expectClean(page);
});

// The three controls that build DOM when pressed, so their opened state is
// checked rather than assumed: the bracket explanation, a steps disclosure, and
// the map's own filter.
test('what the page opens on press is clean', async ({ page }) => {
  await page.goto('/index.html');
  await search(page);

  const steps = page.locator('#included .steps-toggle').first();
  await steps.click();
  await expect(page.locator('#included .steps').first()).toBeVisible();
  await expectClean(page);

  await page.getByRole('button', { name: 'Interchangeable' }).click();
  await expectClean(page);

  // The bracket explanation goes last, and stays open. It is a real popover —
  // absolutely positioned, z-index 20 — so anything pressed after it lands on it
  // instead. A second press does not close it either: it is opened by hover and
  // focus in CSS, and after a click the pointer is still on the control.
  await page.locator('.bracket-scale').click();
  await expect(page.locator('#bracket-why')).toBeVisible();
  await expectClean(page);
});

// Contrast is a property of the theme, not of the markup, so the same page has to
// be checked in both. This is the rule most likely to catch a future token change,
// and the one no other test in this repository could notice.
for (const theme of ['dark', 'light']) {
  test(`the results are clean in ${theme}`, async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate((t) => localStorage.setItem('mtg-combo-finder.theme', t), theme);
    await page.reload();
    await search(page);
    await expectClean(page);
  });
}

test('the tiers page is clean', async ({ page }) => {
  await page.goto('/tiers.html');
  // The filter row is hidden until the database has loaded and the table is
  // built, so it is the page's own signal that there is something to check.
  await expect(page.locator('#controls')).toBeVisible();
  await expectClean(page);

  // And with a filter switched off. All three chips ship pressed, so the off
  // state is the one a test that only loads the page never reaches — which is
  // exactly how it went unnoticed that it was drawn at 2.5:1.
  await page.locator('.chip[data-tier="other"]').click();
  await expect(page.locator('.chip[data-tier="other"]')).toHaveAttribute('aria-pressed', 'false');
  await expectClean(page);
});
