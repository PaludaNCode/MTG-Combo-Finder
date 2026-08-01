// The combo map, pressed the way a person presses it.
//
// tools/verify-layout.js already measures this map — where every dot landed,
// that no two overlap, that a number sits on its line. What it cannot do is
// *use* it: it dispatches `pointerenter` at an element rather than moving a
// pointer across a page, and a synthetic event will happily light a card that a
// real mouse could never reach. So this file hovers, presses, tabs, types
// Escape and taps, and asserts what the reader is left looking at.
'use strict';

const { test, expect } = require('@playwright/test');
const { DECKS } = require('../test/fixtures/dataset.js');

// A card's <g> spans its dot *and* its label, and the layout puts some labels
// well off to one side — so the middle of that box can be empty canvas, and a
// press aimed there hits nothing. Nobody aims there: they aim at the dot. These
// helpers do the same.
const card = (map, n) => map.locator('.node').nth(n);
const press = (map, n) => card(map, n).locator('.dot').click();

async function searched(page) {
  await page.goto('/index.html');
  await page.locator('#decklist').fill(DECKS.marked);
  await page.getByRole('button', { name: 'Find combos' }).click();
  await expect(page.locator('#graph .combo-map')).toBeVisible();
  await expect(page.locator('#graph .node').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await searched(page);
});

test('the map draws a card per dot and both kinds of line', async ({ page }) => {
  const map = page.locator('#graph .combo-map');
  await expect(map.locator('.node')).not.toHaveCount(0);
  // Solid lines are combos needing both cards; dashed ones are cards that stand
  // in for each other. The fixture has both, and the second is the half a list
  // cannot show.
  await expect(map.locator('.edge:not(.swap)')).not.toHaveCount(0);
  await expect(map.locator('.edge.swap')).not.toHaveCount(0);
  // The count on a line is the explicit half of "how much do these overlap".
  await expect(map.locator('.count:not(.is-crowded)').first()).toHaveText(/^\d+$/);

  // The panel's own count is the number of cards drawn.
  const dots = await map.locator('.node').count();
  await expect(page.locator('#graph .panel-count')).toHaveText(String(dots));
});

test('hovering a card picks out what it touches', async ({ page }) => {
  const map = page.locator('#graph .combo-map');
  // A real pointer move, not a dispatched event: hover() puts the mouse where
  // the dot actually is, so a card covered by something else fails here.
  await card(map, 0).locator('.dot').hover();
  await expect(map).toHaveClass(/is-lit/);
  await expect(map.locator('.node.is-lit')).not.toHaveCount(0);
  await expect(map.locator('.edge.is-lit')).not.toHaveCount(0);

  // Dimming is what makes the highlight readable, so it is measured rather than
  // assumed: something the hovered card does not touch has to fade.
  const faded = map.locator('.node:not(.is-lit)').first();
  if (await faded.count()) {
    const opacity = await faded.evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBeLessThan(0.5);
  }

  // And the map goes back to normal when the pointer leaves it.
  await page.mouse.move(5, 5);
  await expect(map).not.toHaveClass(/is-lit/);
});

test('pressing two cards compares them', async ({ page }) => {
  const map = page.locator('#graph .combo-map');
  const summary = page.locator('#graph .map-picked');
  await expect(summary).toHaveClass(/is-empty/);

  const first = card(map, 0);
  const firstName = await first.getAttribute('aria-label');

  await press(map, 0);
  await expect(summary).not.toHaveClass(/is-empty/);
  await expect(summary).toContainText(firstName.split(',')[0]);
  await expect(first).toHaveAttribute('aria-pressed', 'true');

  await press(map, 1);
  await expect(map.locator('.node.is-picked')).toHaveCount(2);
  // The sentence is about the pair and carries the number nothing else on the
  // page says: what cutting them would actually cost.
  await expect(summary).toContainText(/combos they appear in/);

  // A pinned card stays lit with the pointer somewhere else entirely — a
  // selection is a decision, a hover is a look.
  await page.mouse.move(5, 5);
  await expect(map.locator('.node.is-picked')).toHaveCount(2);
  await expect(map).toHaveClass(/is-lit/);
});

test('a third card is a three-way comparison, and pressing again undoes it', async ({ page }) => {
  const map = page.locator('#graph .combo-map');
  const summary = page.locator('#graph .map-picked');
  const cards = map.locator('.node');

  await press(map, 0);
  await press(map, 1);
  await press(map, 2);
  await expect(map.locator('.node.is-picked')).toHaveCount(3);
  await expect(summary).toContainText(/all three/i);

  await press(map, 2);
  await expect(map.locator('.node.is-picked')).toHaveCount(2);
  await expect(cards.nth(2)).toHaveAttribute('aria-pressed', 'false');
});

test('pressing the background clears the comparison', async ({ page }) => {
  const map = page.locator('#graph .combo-map');
  await press(map, 0);
  await expect(map.locator('.node.is-picked')).toHaveCount(1);

  // A corner of the map, which is canvas rather than any card.
  const box = await map.boundingBox();
  await page.mouse.click(box.x + 4, box.y + 4);
  await expect(map.locator('.node.is-picked')).toHaveCount(0);
  await expect(page.locator('#graph .map-picked')).toHaveClass(/is-empty/);
});

test('the map can be driven from the keyboard alone', async ({ page }) => {
  const map = page.locator('#graph .combo-map');
  const first = map.locator('.node').first();

  // Focus without touching the mouse, then press it the way a button is pressed.
  await first.focus();
  await expect(first).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#graph .map-picked')).not.toHaveClass(/is-empty/);

  // Space is the other way to press a button, and must not scroll the page.
  // Measured across the keypress alone: focusing a card is *allowed* to scroll,
  // because bringing the focused thing into view is what a browser should do,
  // and on a tall map it does. What Space must not do is page down.
  await map.locator('.node').nth(1).focus();
  const scrolled = await page.evaluate(() => window.scrollY);
  await page.keyboard.press(' ');
  await expect(map.locator('.node.is-picked')).toHaveCount(2);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);

  await page.keyboard.press('Escape');
  await expect(map.locator('.node.is-picked')).toHaveCount(0);
});

test('each card announces itself and its comparison', async ({ page }) => {
  const first = page.locator('#graph .combo-map .node').first();
  // A shape you press to change what the page says is a button, and has to be
  // one to a screen reader too.
  await expect(first).toHaveRole('button');
  await expect(first).toHaveAttribute('aria-label', /in \d+ combos?\. Pick to compare\./);
  // The answer to a press is announced rather than only drawn.
  await expect(page.locator('#graph .map-picked')).toHaveAttribute('role', 'status');
});

test('the filter shows either relation without moving a card', async ({ page }) => {
  const map = page.locator('#graph .combo-map');
  const at = () => map.locator('.node .dot').evaluateAll(
    (dots) => dots.map((d) => d.getAttribute('cx') + ',' + d.getAttribute('cy'))
  );
  const before = await at();

  await page.getByRole('button', { name: 'Interchangeable' }).click();
  await expect(map.locator('.edge:not(.swap)').first()).toBeHidden();
  await expect(map.locator('.edge.swap').first()).toBeVisible();

  await page.getByRole('button', { name: 'Works together' }).click();
  await expect(map.locator('.edge.swap').first()).toBeHidden();
  await expect(map.locator('.edge:not(.swap)').first()).toBeVisible();

  await page.getByRole('button', { name: 'Both' }).click();
  await expect(map.locator('.edge.swap').first()).toBeVisible();

  // The filter takes lines away; it does not re-lay the map out. A card the
  // reader had just found must not move under them.
  expect(await at()).toEqual(before);
});

test('adding a card redraws the map with it on', async ({ page }) => {
  const map = page.locator('#graph .combo-map');
  const before = await map.locator('.node').count();

  const suggestion = page.locator('.tab-pane:not([hidden]) .combo.suggestion').first();
  const card = await suggestion.locator('h3 .card-name').first().textContent();
  await suggestion.getByRole('button', { name: /^Add / }).click();

  // A map one search behind the list beside it would say the added card is in
  // no combos at all.
  await expect(page.locator('#graph .combo-map .node')).toHaveCount(before + 1);
  await expect(page.locator('#graph .combo-map .node[aria-label^="' + card + ',"]')).toHaveCount(1);
});

test('nothing on the page scrolls sideways', async ({ page }) => {
  // Checked here as well as in the layout test because this is the run with a
  // real scrollbar and a real device pixel ratio.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

// The map is drawn in canvas units and scaled into whatever column it lands in,
// so "is it readable" is a question about the ratio between the two — and the
// only place to ask it is in a browser at a real width, with the real
// stylesheet. On a phone it was 4px type in a letterbox; this is the check that
// it stays a map rather than a decoration.
test('the map is legible at this width', async ({ page }) => {
  const map = page.locator('#graph .combo-map');
  const drawn = await map.evaluate((svg) => {
    const box = svg.getBoundingClientRect();
    const view = svg.viewBox.baseVal;
    const scale = box.width / view.width;
    const label = svg.querySelector('.label');
    const dot = svg.querySelector('.dot');
    return {
      scale,
      // The type size the stylesheet is using, in canvas units, times the scale
      // — which is what the eye gets.
      type: parseFloat(getComputedStyle(label).fontSize) * scale,
      smallestDot: Math.min(...[...svg.querySelectorAll('.dot')].map((d) => d.r.baseVal.value)) * scale,
      height: box.height,
      // Nothing may hang outside the viewBox: the box is trimmed to the drawing,
      // and a name past the edge is a name cut in half.
      clipped: [...svg.querySelectorAll('.label')].filter((t) => {
        const b = t.getBBox();
        return b.x < -1 || b.x + b.width > view.width + 1;
      }).length,
      // ...and no band of empty canvas either, which is what the trim is for.
      waste: (() => {
        const dots = [...svg.querySelectorAll('.dot')];
        const bottom = Math.max(...dots.map((d) => d.cy.baseVal.value + d.r.baseVal.value));
        return view.height - bottom;
      })(),
      dotPresent: Boolean(dot),
    };
  });

  expect(drawn.dotPresent).toBe(true);
  expect(drawn.clipped, 'card names are being cut off at the edge of the map').toBe(0);
  expect(drawn.type, `card names render at ${drawn.type.toFixed(1)}px`).toBeGreaterThan(9.5);
  expect(drawn.smallestDot, 'the smallest card is smaller than 3px').toBeGreaterThan(3);
  expect(drawn.waste, `${Math.round(drawn.waste)} units of empty canvas below the map`).toBeLessThan(150);
  // A map worth scrolling to is a map worth some height.
  expect(drawn.height).toBeGreaterThan(220);
});
