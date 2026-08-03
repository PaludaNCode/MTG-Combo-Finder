// The shell offline. This is the only harness that can run a real service worker —
// tools/verify-layout.js drives a page inside an iframe in a sandbox and asserts the
// worker's *decision* as a pure function instead (test/service-worker.test.js).
//
// What is being checked is the thing the issue this closes was about: the data already
// survived going offline and the page did not, so a reader who had searched once was
// holding the whole snapshot on the device and could not reach any of it.
'use strict';

const { test, expect } = require('@playwright/test');
const { DECKS } = require('../test/fixtures/dataset.js');

// The worker installs after the page is wired, so nothing on the page waits for it —
// which means a test that wants it has to.
async function serviceWorkerReady(page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  // Active is not the same as controlling: the first load of a session is not
  // controlled by the worker it just installed unless it claims the client, which
  // ours does. Waiting for that is what makes the offline reload meaningful.
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

async function search(page, deck) {
  await page.locator('#decklist').fill(deck || DECKS.marked);
  await page.getByRole('button', { name: 'Find combos' }).click();
  await expect(page.locator('#included .combo').first()).toBeVisible();
}

test('a second visit works with the network off, and can still search', async ({ page, context }) => {
  await page.goto('/index.html');
  await serviceWorkerReady(page);
  await search(page);

  // Everything the page needs is now on the device: the shell in the worker's cache,
  // the snapshot in search.js's own.
  await context.setOffline(true);
  await page.reload();

  // The page itself, rather than the browser's offline screen.
  await expect(page.locator('h1')).toHaveText('MTG Combo Finder');
  await expect(page.getByRole('button', { name: 'Find combos' })).toBeVisible();
  // The decklist comes back from localStorage, so there is something to search.
  await expect(page.locator('#decklist')).not.toBeEmpty();

  // And the answer comes back, from the snapshot already in hand.
  await page.getByRole('button', { name: 'Find combos' }).click();
  await expect(page.locator('#included .combo').first()).toBeVisible();
  await expect(page.locator('#status')).toContainText('known combos');
});

// The other half of the asymmetry, and the failure a service worker classically
// ships: an update nobody receives. The document is network-first, so a page load
// with the network on always asks — which is what makes a fresh deploy visible at
// all. Asserted by editing what the server sends and reloading: a cache-first shell
// would keep showing the old copy.
test('a changed page is picked up on the next load, with no hard refresh', async ({ page }) => {
  await page.goto('/index.html');
  await serviceWorkerReady(page);

  // Stand in for a deploy: the same URL, different bytes. Asked of the server rather
  // than routed in the browser, because Playwright's interception does not apply to
  // requests a service worker makes — and the navigation goes through the worker,
  // which is the whole point of the test. See /__deploy in e2e/server.js.
  await page.request.get('/__deploy?h1=Deployed+Again');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Deployed Again');

  // And put it back, so the one mutable thing in this suite does not leak into
  // whatever runs next against the same server.
  await page.request.get('/__deploy');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('MTG Combo Finder');
});

// A worker that failed to install must not take the page with it. Registration is
// wrapped and ignored for exactly that reason — an insecure origin refuses one by
// design, and every browser without support refuses too.
test('the page works when the worker is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'serviceWorker', { get() { throw new Error('nope'); } });
  });
  await page.goto('/index.html');
  await search(page);
  await expect(page.locator('#included .combo').first()).toBeVisible();
});
