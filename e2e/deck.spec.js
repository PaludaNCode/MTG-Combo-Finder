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
  await expect(page.locator('#pieces .combo').first()).toBeVisible();
}

// A combo row lives inside one of your cards now, so getting at one is two steps:
// find the card that carries the combo, then open it. Returns the row itself.
async function openCombo(page, hrefFragment) {
  const card = page.locator('#pieces .panel-body > .combo.suggestion')
    .filter({ has: page.locator(`a[href*="${hrefFragment}"]`) })
    .first();
  await card.locator('> details > summary').click();
  return card.locator('details > .combo')
    .filter({ has: page.locator(`a[href*="${hrefFragment}"]`) })
    .first();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
});

test('a pasted decklist produces the combos in it', async ({ page }) => {
  await pasteDeck(page);
  await search(page);

  // The panel headings, as a reader would name them. Three, and the first of them is
  // the answer: "Combos in your deck" is the list of your cards that carry one.
  await expect(page.getByRole('heading', { name: 'Combos in your deck' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How your combos connect' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Suggested additions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cards carrying your combos' })).toHaveCount(0);

  // The badge counts combos and the rows are cards, so the panel has to say which is
  // which — a badge of 10 over 7 rows reads as a miscount otherwise.
  await expect(page.locator('#pieces .panel-note')).toContainText(/\d+ combos? published by Commander Spellbook/);
  await expect(page.locator('#pieces .panel-note')).toContainText(/carried by \d+ of your cards/);

  // The deck's colours are read off the cards, so they are on screen without a
  // commander having been typed anywhere.
  await expect(page.locator('.identity-line .pip')).toHaveCount(2);

  // A card row names the card and says how many combos hang off it; opening it names
  // those combos and links each to Spellbook. Asked for by the combo it holds rather
  // than by being first: which card leads is an ordering decision made in combos.js,
  // and this assertion is not about it.
  const first = page.locator('#pieces .panel-body > .combo.suggestion').first();
  await expect(first.locator('.row-name .card-name').first()).not.toBeEmpty();
  await expect(first.locator('.row-total')).toContainText(/^\d+$/);
  const row = await openCombo(page, '/combo/1/');
  await expect(row.locator('.combo-link a[href*="commanderspellbook.com"]')).toBeVisible();
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

  const before = await page.locator('#pieces .panel-count').textContent();
  const suggestion = page.locator('.tab-pane:not([hidden]) .combo.suggestion').first();
  const card = await suggestion.locator('h3 .card-name').first().textContent();
  await suggestion.getByRole('button', { name: /^Add / }).click();

  // The card lands in the box and the deck holds more combos than it did — an
  // append that forgot to search again would pass the first of those and fail
  // the second.
  await expect(page.locator('#decklist')).toHaveValue(new RegExp(card.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await expect(page.locator('#pieces .panel-count')).not.toHaveText(before);
});

// The other direction, and the reason it is a button rather than a note: the panel is
// ranked by what cutting a card would cost, so every row is already an argument about
// keeping it. Every step here is ours — editing the box, keeping it, searching again —
// and the proof the cut landed is the deck holding fewer combos than it did.
test('cutting a card removes it and searches again', async ({ page }) => {
  await pasteDeck(page);
  await search(page);

  const before = await page.locator('#pieces .panel-count').textContent();
  const row = page.locator('#pieces .panel-body > .combo.suggestion').first();
  const card = await row.locator('.row-name .card-name').textContent();
  await row.getByRole('button', { name: /^Remove / }).click();

  // Gone from the box, and the search ran again with it gone. A button that edited the
  // box and forgot to search would pass the first of these and fail the second.
  await expect(page.locator('#decklist'))
    .not.toHaveValue(new RegExp(card.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await expect(page.locator('#status')).toContainText(`Removed ${card}`);
  await expect(page.locator('#pieces .panel-count')).not.toHaveText(before);

  // …and the cut survives a reload, like every other edit to the list.
  await page.reload();
  await expect(page.locator('#decklist'))
    .not.toHaveValue(new RegExp(card.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

// A press opens the bracket explanation and a second press has to put it away
// again, which is the only way a phone has: there is no pointer to move off the
// control and no Escape key to reach for. It stayed open through both presses for
// as long as the panel existed — `aria-expanded` went back to `false` and
// `.bracket-wrap:focus-within` held it open anyway, because the press leaves focus
// on the button. Two states in the CSS, one of them unreachable, and the button
// announced itself as collapsed over an open panel.
//
// Driven with the real input rather than `element.click()`: this is exactly the
// difference between the two, and it is why `closesOnSecondPress` in
// verify-layout.js passed for the whole life of the bug. A dispatched click does
// not move focus, so the harness only ever exercised the state a reader is never in.
test('a second press puts the bracket explanation away', async ({ page }) => {
  await pasteDeck(page);
  await search(page);

  const pips = page.locator('.bracket-scale');
  const why = page.locator('#bracket-why');
  await expect(why).toBeHidden();

  await pips.click();
  await expect(why).toBeVisible();
  await expect(pips).toHaveAttribute('aria-expanded', 'true');

  await pips.click();
  // Both halves, because they disagreed: the attribute is what a screen reader is
  // told and the panel is what everyone else sees, and only one of them changed.
  await expect(pips).toHaveAttribute('aria-expanded', 'false');

  // What happens to the panel itself depends on the pointer, and the two cases are
  // asserted apart rather than reduced to whichever is weaker. With a mouse the
  // cursor is still sitting on the pips after the click, so the hover rule is
  // legitimately holding the panel open and moving away is what closes it. With no
  // hover at all — the phone project — the press is the only signal there is, and
  // the panel has to be gone the moment the attribute says it is.
  if (await page.evaluate(() => window.matchMedia('(hover: hover)').matches)) {
    await expect(why).toBeVisible();
    await page.mouse.move(0, 0);
  }
  await expect(why).toBeHidden();
});

test('a section stays closed across a search', async ({ page }) => {
  await pasteDeck(page);
  await search(page);

  const head = page.getByRole('button', { name: /Suggested additions/ });
  await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'false');

  await page.getByRole('button', { name: 'Find combos' }).click();
  await expect(page.locator('#pieces .combo').first()).toBeVisible();
  // Closed sections are remembered, so a new search does not reopen everything
  // the reader just tidied away.
  await expect(page.getByRole('button', { name: /Suggested additions/ }))
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

// ---- the steps, which are the only thing fetched after the search -----------
//
// Every other panel is drawn from what the search already returned. The steps are
// not: they are one small file per combo on the data branch, fetched when someone
// presses the disclosure and never before (steps-source.js explains why that shape
// beat the four alternatives that were measured).
//
// Which makes this the only test that can catch the publisher and the reader
// disagreeing about where a combo's steps live. The fixture files are produced by
// the real ComboSteps.pick() and served at the real StepsSource.pathFor(), so a
// change to either end that the other does not follow fails here.
test('a combo row fetches and shows how the combo is actually executed', async ({ page }) => {
  await pasteDeck(page);
  await search(page);

  const row = await openCombo(page, '/combo/1/');

  // Nothing is fetched until it is asked for — the entire reason the steps are
  // not in the download.
  await expect(row.locator('.steps')).toBeHidden();
  const toggle = row.locator('.steps-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  const panel = row.locator('.steps');
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  // Mana leads the prerequisites, the prose one follows, and the per-card lines
  // come last — the order normalize() puts them in, all the way through a real
  // published file rather than an object handed to it in a unit test.
  await expect(panel).toContainText('Mana available: {2}');
  await expect(panel).toContainText('Basalt Monolith is untapped.');
  await expect(panel).toContainText('Kinnan, Bonder Prodigy — on the battlefield');
  await expect(panel).toContainText('Basalt Monolith — on the battlefield, untapped');

  // A real <ol>: the steps are a sequence and the numbers carry the order.
  const steps = panel.locator('ol.steps-list li');
  await expect(steps).toHaveCount(3);
  await expect(steps.first()).toContainText('Tap Basalt Monolith for three colourless mana.');

  // Collapsing and reopening must not refetch — the answer cannot change
  // mid-session, and combo-steps.js holds it for the life of the page.
  await toggle.click();
  await expect(panel).toBeHidden();
  await toggle.click();
  await expect(panel).toContainText('Mana available: {2}');
});

// A combo Commander Spellbook records nothing for has no file at all: the 404 is
// the answer, and it is what stands in for the index this design does not have.
// The panel has to draw that as a note, not as a failure, and keep the link.
test('a combo with no published steps says so and keeps the link', async ({ page }) => {
  await pasteDeck(page);
  await search(page);

  const row = await openCombo(page, '/combo/6/');

  await row.locator('.steps-toggle').click();
  const panel = row.locator('.steps');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('No steps recorded for this combo yet.');
  await expect(panel).toHaveClass(/is-note/);
  await expect(row.getByRole('link', { name: /View on Commander Spellbook/ })).toBeVisible();
});

// ---- decks that arrive as a file -------------------------------------------
//
// The import path that works for every deck site, including the ones whose API a
// browser can never read. Two entry points, tested separately because they are
// separate code: the picker is what a keyboard and a phone can drive, dragging is
// what a desktop reaches for first.

const MOXFIELD_EXPORT = [
  '1 Kinnan, Bonder Prodigy (C21) 3 *CMDR*',
  '1 Basalt Monolith (MH2) 220',
  '1 Rings of Brighthearth (LRW) 258',
  '1 Walking Ballista (DOM) 213',
  '10 Island (UNF) 240',
].join('\n');

test('choosing a deck file fills the box and says what arrived', async ({ page }) => {
  await page.locator('#deck-file').setInputFiles({
    name: 'moxfield-export.txt', mimeType: 'text/plain', buffer: Buffer.from(MOXFIELD_EXPORT),
  });

  await expect(page.locator('#decklist')).toHaveValue(/Basalt Monolith/);
  await expect(page.locator('#status')).toContainText('from “moxfield-export.txt”');
  await expect(page.locator('#status')).not.toHaveClass(/error/);

  // And it behaves exactly like a paste from here on — the point of putting the
  // text in the box rather than searching straight off the file.
  await search(page);
  await expect(page.locator('#pieces .combo').first()).toBeVisible();
});

// A .txt extension is a claim; the contents are the evidence. A binary file read
// as text would otherwise land in the box as a wall of skipped lines.
test('a file that is not a decklist is refused, and the box is left alone', async ({ page }) => {
  await page.locator('#decklist').fill('1 Sol Ring');
  await page.locator('#deck-file').setInputFiles({
    name: 'screenshot.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]),
  });

  await expect(page.locator('#status')).toHaveClass(/error/);
  await expect(page.locator('#status')).toContainText('isn’t a text file');
  await expect(page.locator('#status')).toContainText('screenshot.png');
  await expect(page.locator('#decklist')).toHaveValue('1 Sol Ring', 'the deck they had is untouched');
});

// A narrow case, deliberately: the parser treats any bare line as a card name,
// because "plain names, one per line" is the format most people paste. So this
// only fires for a file with nothing but comments and blank lines — a README
// dropped by mistake, say — and not for a line that merely isn't a real card,
// which the search reports far better than a guess here could.
test('a text file with nothing but comments says so rather than loading nothing', async ({ page }) => {
  await page.locator('#deck-file').setInputFiles({
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('# just some notes\n\n#  and more\n'),
  });
  await expect(page.locator('#status')).toHaveClass(/error/);
  await expect(page.locator('#status')).toContainText('No card lines found');
  await expect(page.locator('#status')).toContainText('notes.txt');
});

// Dragging is the other half, and it has its own hazard: a `drop` the page does
// not cancel makes the browser navigate to the file, losing the deck entirely.
test('dropping a deck file on the form loads it without navigating away', async ({ page }) => {
  const url = page.url();

  await page.evaluate((text) => {
    const dt = new DataTransfer();
    dt.items.add(new File([text], 'dropped.txt', { type: 'text/plain' }));
    const form = document.getElementById('deck-form');
    form.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    form.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, MOXFIELD_EXPORT);

  await expect(page.locator('#status')).toContainText('from “dropped.txt”');
  await expect(page.locator('#decklist')).toHaveValue(/Rings of Brighthearth/);
  expect(page.url()).toBe(url);
  // The drag affordance has to come back off, or the box stays outlined for good.
  await expect(page.locator('#decklist')).not.toHaveClass(/dropping/);
});

// Reading the first of five silently would look like the other four failed.
test('dropping several files at once asks for one', async ({ page }) => {
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['1 Sol Ring'], 'a.txt', { type: 'text/plain' }));
    dt.items.add(new File(['1 Mox Opal'], 'b.txt', { type: 'text/plain' }));
    document.getElementById('deck-form')
      .dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('#status')).toHaveClass(/error/);
  await expect(page.locator('#status')).toContainText('one decklist at a time');
});

// Choosing the same file twice must fire again — otherwise fixing the file and
// re-picking it does nothing at all, with no message to explain why.
test('the same file can be chosen twice', async ({ page }) => {
  const file = { name: 'deck.txt', mimeType: 'text/plain', buffer: Buffer.from(MOXFIELD_EXPORT) };
  await page.locator('#deck-file').setInputFiles(file);
  await expect(page.locator('#status')).toContainText('from “deck.txt”');

  await page.locator('#clear-deck').click();
  await expect(page.locator('#decklist')).toHaveValue('');

  await page.locator('#deck-file').setInputFiles(file);
  await expect(page.locator('#decklist')).toHaveValue(/Basalt Monolith/);
});

// The basket's number counts both halves — Spellbook's combos and ours.
//
// It needs the one deck where an added card's combos are *entirely* unofficial:
// `unofficialAlmost` is one card short of a row of ours and of nothing else, so the
// card that completes it carries a count no published data would produce. Every other
// fixture here has no unofficial combos at all, so on any of them a basket counting
// only the published half would read exactly the same and this would pass measuring
// nothing — the same reason WIDTHS carries a phone run of this deck in verify-layout.js.
//
// Driven through the page's own button rather than by typing the card in, because the
// baseline that decides what is in the basket is set by a search that no add started.
test('the basket counts our combos as well as Spellbook’s', async ({ page }) => {
  await pasteDeck(page, DECKS.unofficialAlmost);
  await page.getByRole('button', { name: 'Find combos' }).click();
  await expect(page.locator('#results')).toBeVisible();
  // Not the shared search() helper, which waits on "#pieces .combo": this deck holds no
  // *complete* combo at all, so that panel legitimately renders its empty line and the
  // wait would time out. The suggestions are what this deck has, and they are built a
  // frame after the combos, so this is the wait that means "the page is finished".
  const suggestion = page.locator('#suggestions .tab-pane:not([hidden]) .combo.suggestion').first();
  await expect(suggestion).toBeVisible();

  await suggestion.locator('.add-card').first().click();
  const row = page.locator('#basket .combo.suggestion').first();
  await expect(row).toBeVisible();

  // The total is the sum, and the split under it is whose. Read as the spoken label
  // rather than as text: the split is in the DOM twice, "0 official · 1 unofficial"
  // wide and a bare "0+1" narrow, and only one of them is showing at any width.
  await expect(row.locator('.row-total')).toHaveText('1');
  await expect(row.locator('.row-split')).toHaveAttribute('aria-label', /1 unofficial/);

  // …and the row is the one "Combos in your deck" draws, links and all.
  await expect(row.locator('.row-main .card-links a')).toHaveText([/EDHREC/, /Scryfall/, /Buy/]);

  // The caption has to agree with the row above it. Counting only the published half
  // put "this deck still has 0 combos — none of them changed that" directly over a row
  // reading "1 combo · 0 official · 1 unofficial", which is the page contradicting
  // itself in exactly the case the unofficial rows exist for.
  const note = page.locator('#basket .panel-note');
  await expect(note).not.toContainText('none of them changed that');
  await expect(note).toContainText('1 of ours');
});
