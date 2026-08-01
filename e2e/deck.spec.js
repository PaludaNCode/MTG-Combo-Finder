// The journey: a decklist goes in, combos come out, and the list is still there
// tomorrow. Every step here is one a person performs — typing, pressing,
// reloading, opening a link in a new tab — which is the half tools/verify-layout.js
// cannot do, because it dispatches events rather than driving input.
'use strict';

const { test, expect } = require('@playwright/test');
const { DECKS } = require('../test/fixtures/dataset.js');

// Typing 8 lines a character at a time costs seconds per test and proves
// nothing; the decklist box is a textarea and people paste into it.
async function pasteDeck(page, deck) {
  await page.locator('#decklist').fill(deck || DECKS.marked);
}

async function search(page) {
  await page.getByRole('button', { name: 'Find combos' }).click();
  // The results section is hidden until a search lands, so this is the wait —
  // no timeout guessing, and a search that never finishes fails here rather
  // than three assertions later.
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#included .combo').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
});

test('a pasted decklist produces the combos in it', async ({ page }) => {
  await pasteDeck(page);
  await search(page);

  // The panel headings, as a reader would name them.
  await expect(page.getByRole('heading', { name: 'Combos in your deck' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How your combos connect' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cards carrying your combos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Suggested additions' })).toBeVisible();

  // The deck's colours are read off the cards, so they are on screen without a
  // commander having been typed anywhere.
  await expect(page.locator('.identity-line .pip')).toHaveCount(2);

  // A combo row names its cards and links to the combo on Spellbook.
  const first = page.locator('#included .panel-body > .combo').first();
  await expect(first.locator('.card-name').first()).not.toBeEmpty();
  await expect(first.locator('.combo-link a[href*="commanderspellbook.com"]')).toBeVisible();
});

test('the decklist survives a reload', async ({ page }) => {
  await pasteDeck(page);
  await search(page);

  await page.reload();
  // Kept in localStorage rather than re-searched, so the box is full and the
  // results are not: losing the list to a refresh is the one thing this page
  // must not do.
  await expect(page.locator('#decklist')).toHaveValue(/Basalt Monolith/);
});

test('Clear empties the box, the results and the stored copy', async ({ page }) => {
  await pasteDeck(page);
  await search(page);

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('#decklist')).toHaveValue('');
  await expect(page.locator('#results')).toBeHidden();

  await page.reload();
  await expect(page.locator('#decklist')).toHaveValue('');
});

test('Copy link carries the deck to a page that has never seen it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await pasteDeck(page);
  await search(page);

  await page.getByRole('button', { name: 'Copy link' }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain('deck=');

  // A second tab, with the first tab's deck still in storage: the link has to
  // win, or a shared deck shows the reader their own.
  const other = await context.newPage();
  await other.goto(link);
  await expect(other.locator('#decklist')).toHaveValue(/Basalt Monolith/);
  await expect(other.locator('#status')).toContainText(/link/i);
});

test('taking a suggestion adds the card and searches again', async ({ page }) => {
  await pasteDeck(page);
  await search(page);

  const before = await page.locator('#included .panel-count').textContent();
  const suggestion = page.locator('.tab-pane:not([hidden]) .combo.suggestion').first();
  const card = await suggestion.locator('h3 .card-name').first().textContent();
  await suggestion.getByRole('button', { name: /^Add / }).click();

  // The card lands in the box and the deck holds more combos than it did — an
  // append that forgot to search again would pass the first of those and fail
  // the second.
  await expect(page.locator('#decklist')).toHaveValue(new RegExp(card.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await expect(page.locator('#included .panel-count')).not.toHaveText(before);
});

test('a section stays closed across a search', async ({ page }) => {
  await pasteDeck(page);
  await search(page);

  const head = page.getByRole('button', { name: /Cards carrying your combos/ });
  await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'false');

  await page.getByRole('button', { name: 'Find combos' }).click();
  await expect(page.locator('#included .combo').first()).toBeVisible();
  // Closed sections are remembered, so a new search does not reopen everything
  // the reader just tidied away.
  await expect(page.getByRole('button', { name: /Cards carrying your combos/ }))
    .toHaveAttribute('aria-expanded', 'false');
});

test('the theme control overrules the system and holds on the tiers page', async ({ page }) => {
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  const toggle = page.locator('#theme-toggle');
  await expect(toggle).toBeVisible();

  const before = await theme();
  await toggle.click();
  const after = await theme();
  expect(after).not.toBe(before);

  await page.reload();
  expect(await theme()).toBe(after);

  // The second page reads the same stored answer, so the site does not change
  // colour when you follow a link inside it.
  await page.getByRole('link', { name: /how every result is classified/i }).click();
  await expect(page).toHaveURL(/tiers\.html/);
  expect(await theme()).toBe(after);
});

test('a decklist the parser cannot use says so instead of failing quietly', async ({ page }) => {
  await page.locator('#decklist').fill('¯\\_(ツ)_/¯\n???');
  await page.getByRole('button', { name: 'Find combos' }).click();
  // Either a status line or the diagnostics report — what matters is that the
  // page says something rather than sitting there.
  await expect(page.locator('#status')).not.toBeEmpty();
});
