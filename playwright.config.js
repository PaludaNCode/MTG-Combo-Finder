// Playwright: the browser tests that press the page the way a person does.
//
// This repository has two browser harnesses and they are not the same job.
// tools/verify-layout.js measures — it renders the real pages at four widths and
// reads geometry back out: overflow, column splits, where a dot landed, whether
// a number is on its line. It is zero-dependency and fast, and it fakes the
// input: it dispatches `pointerenter` rather than moving a pointer.
//
// This suite does the opposite. It moves a real mouse, presses real keys, taps
// with a real touchscreen, reloads, opens a second tab with a shared link — the
// things that either work for a person or do not, and that a synthetic event
// cannot tell you about. Where the two overlap, the geometry belongs over there
// and the gesture belongs here.
//
// No node_modules in the repository, the same way the linter has none: both are
// fetched for the run. See the `test:ui` script in package.json.
'use strict';

const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.PORT || 4173);

// Where Chromium is. Playwright finds its own installation normally; this is for
// an environment that already has one and would rather not download a second
// copy — set CHROMIUM_PATH and it is used as-is.
const executablePath = process.env.CHROMIUM_PATH || undefined;

module.exports = defineConfig({
  testDir: './e2e',
  // The suite drives one page against a fixed dataset, so a test that only
  // passes on the second attempt is a test that found something.
  retries: 0,
  // Every test opens its own page and types its own deck, so they do not share
  // state — but they do share the one server, and the deck search is CPU-bound
  // parsing.
  //
  // 2 on CI, and 4 was tried and reverted — **do not raise this on a local measurement.**
  //
  // A GitHub-hosted Linux runner has 4 vCPU (this repo is public), and on a 4-core box
  // here 4 workers were a clear win: 80 tests in 44.4s at 2, 34.3s at 4, 32.1s at 6, the
  // shape you expect once every core is busy. It was run three times before being
  // believed. On the runner it bought nothing at all — **41s at 2 workers, 43s at 4** —
  // so the bottleneck there is not idle cores. The single `webServer` process every
  // worker shares is the likeliest candidate and was not proved; the runner's job log
  // redirects to a host a sandboxed session cannot reach.
  //
  // What generalises is the method, not the number: a browser suite's worker count is a
  // property of the machine it runs on, and this repository's machine is the runner. Two
  // cores' worth of local headroom said nothing about it.
  //
  // Left `undefined` off CI so a laptop decides for itself, where 4 genuinely does help.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // A search that has not finished in 15s has not failed slowly, it has failed.
  expect: { timeout: 10_000 },
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:' + PORT,
    // Kept only for a failure, which is when anyone wants them.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
    {
      // The map is drawn for a pointer and the page is mostly read on a phone,
      // so the touch path is its own run rather than a note in the README:
      // hovering does not exist here, and a tap has to do the same work.
      name: 'phone',
      use: { ...devices['Pixel 7'], launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: 'node e2e/server.js',
    url: 'http://127.0.0.1:' + PORT + '/index.html',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 30_000,
    env: { PORT: String(PORT) },
  },
});
