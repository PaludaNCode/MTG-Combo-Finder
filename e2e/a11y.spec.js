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
  await expect(page.locator('#pieces .combo').first()).toBeVisible();
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

// The notice above the results naming cards the snapshot did not recognise. It is
// the newest block of colour on the page — --text and --muted on --panel, with an
// accent rule down its left edge — and the deck above is clean, so nothing else here
// ever renders it. Contrast is exactly the kind of thing that breaks quietly when a
// token moves.
test('the notice about unrecognized cards is clean', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#decklist').fill(DECKS.misspelled);
  await page.getByRole('button', { name: 'Find combos' }).click();
  await expect(page.locator('#unrecognized .unknown-cards')).toBeVisible();
  await expect(page.locator('#unrecognized .unknown-list li').first()).toContainText('Sol Rimg');
  await expectClean(page);
});

// The legality line, which is the one place --error is used on a claim rather than
// on an error report — a banned card is the format refusing the deck. Contrast on
// that pairing is checked here, and so is the off-colour line beside it, which is
// deliberately *not* --error and so a different colour on the same background.
test('the legality line is clean', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#decklist').fill(DECKS.illegal);
  await page.getByRole('button', { name: 'Find combos' }).click();
  await expect(page.locator('#legality .is-banned')).toBeVisible();
  await expect(page.locator('#legality .is-off-identity')).toBeVisible();
  await expectClean(page);
});

// The three controls that build DOM when pressed, so their opened state is
// checked rather than assumed: the bracket explanation, a steps disclosure, and
// the map's own filter.
test('what the page opens on press is clean', async ({ page }) => {
  await page.goto('/index.html');
  await search(page);

  // A steps control lives on a combo, and a combo lives inside one of your cards, so
  // getting to a pressable one is two presses: open the card, then open the steps. The
  // first .steps-toggle on the page is inside a closed disclosure and not something a
  // reader can reach.
  //
  // Both halves are scoped to the one row. Pressing one row's control and then reading
  // ".steps on the page, first" is two rows, and it passed only while they happened to
  // be the same one — the panel is full of steps panels that belong to rows nobody
  // pressed, every one of them legitimately hidden.
  const card = page.locator('#pieces .panel-body > .combo.suggestion').first();
  await card.locator('> details > summary').click();
  const row = card.locator('details > .combo').first();
  await row.locator('.steps-toggle').first().click();
  await expect(row.locator('.steps').first()).toBeVisible();
  await expectClean(page);

  await page.getByRole('button', { name: 'Interchangeable' }).click();
  await expectClean(page);

  // The bracket explanation goes last, because it is a real popover — absolutely
  // positioned, z-index 20 — so anything pressed after it lands on it instead. It
  // is left open on purpose: axe is being asked about the panel, and a second press
  // now genuinely puts it away (see e2e/deck.spec.js). This comment used to say a
  // second press did not close it, stated as a fact about the CSS rather than as the
  // bug it was — a phone had no way at all to dismiss it.
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

// "Cards you've added" is absent until a card is added, so a test that only searches
// never sees it — which is exactly how the result chips shipped at 4.19:1 on a nested
// panel that no a11y run had ever opened. Its controls are all new: a quiet Copy button,
// an outlined store link that leaves the site, and the cut pill borrowed from the panel
// above. Both themes, because contrast is a property of the theme rather than the markup.
for (const theme of ['dark', 'light']) {
  test(`the basket is clean in ${theme}`, async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate((t) => localStorage.setItem('mtg-combo-finder.theme', t), theme);
    await page.reload();
    await search(page);

    // Through the page's own button, not by typing into the box: the baseline that
    // decides what is in this panel is set by a search that no add started, so a deck
    // edited and re-searched by hand produces an empty basket and a test that would
    // pass while checking nothing.
    await page.locator('#suggestions .tab-pane:not([hidden]) .combo.suggestion .add-card').first().click();
    await expect(page.locator('#basket .panel')).toBeVisible();
    await expect(page.locator('#basket .basket-row')).toHaveCount(1);
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
