// Lint config, and no lint dependency: CI runs `npx eslint` and npm fetches it for
// that one step. This repo ships with nothing installed and that is worth keeping —
// the page has no build, and a node_modules that only a linter needs would be the
// first entry in it.
//
// The version in package.json is pinned exactly, not to `eslint@9`. Fetching per run
// is a choice about what to install; it should not also be a choice to run whatever
// was published this morning. On a floating major, a new rule or a changed default
// turns a day nobody touched this repository into a red build, from a release nobody
// here decided to take. Playwright is pinned the same way and for the same reason —
// bump both deliberately, in a commit that says so.
//
// `node --check` already catches syntax. What it cannot catch is the class of
// mistake that parses perfectly: a misspelled global (`documnet`), a variable left
// behind by a refactor, a duplicate object key, a `case` that falls through. Those
// are what this is configured for and nothing else — no style rules, because the
// code is already consistent and a formatter argument is not a bug.

// Everything the browser side reaches for. Kept as one list because the three
// dual-environment files — parser.js, combos.js, search.js — genuinely run in a
// tab, in a worker and under Node, and splitting the list three ways would only
// invite a global to be declared in the wrong one.
const BROWSER = {
  window: 'readonly',
  document: 'readonly',
  location: 'readonly',
  navigator: 'readonly',
  localStorage: 'readonly',
  history: 'readonly',
  fetch: 'readonly',
  caches: 'readonly',
  Worker: 'readonly',
  Response: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  Event: 'readonly',
  // How render-map.js learns the map column's width without forcing a layout in
  // the middle of a render. Guarded at the call site, so a browser without one
  // falls back to reading the width directly.
  ResizeObserver: 'readonly',
  // How app.js gets the combos on screen before it builds the three panels below
  // them: the frame boundary is what lets the browser paint in between.
  requestAnimationFrame: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  console: 'readonly',
  getComputedStyle: 'readonly',
  // A monotonic clock, in the window and in the worker. search.js times the
  // three phases of a search with it.
  performance: 'readonly',
  // Reading a dropped decklist. The one browser API here that touches a file the
  // reader chose, and it never leaves the page — no upload, no new origin.
  FileReader: 'readonly',
  // The rest of the drag-and-drop surface. app.js only ever reads `dataTransfer`
  // off an event it was handed, but e2e/deck.spec.js has to *construct* a drop
  // inside page.evaluate() — there is no other way to test that the page cancels
  // it, and an uncancelled drop navigates away and takes the decklist with it.
  DataTransfer: 'readonly',
  DragEvent: 'readonly',
  File: 'readonly',
  // How steps-source.js puts a deadline on a steps request. Feature-detected
  // there rather than assumed, because a request with no way to give up leaves
  // the panel saying "Looking up the steps…" for ever.
  AbortController: 'readonly',
  globalThis: 'readonly',
  // Worker scope.
  self: 'readonly',
  importScripts: 'readonly',
  // Service worker scope, which sw.js is the only file in. `registration` is also
  // what that file tests for to know it is running as one rather than being
  // required under Node.
  registration: 'readonly',
  clients: 'readonly',
  skipWaiting: 'readonly',
  // The dual-export tail every one of these files ends with.
  module: 'writable',
  require: 'readonly',
};

// The page's own globals: each is published by one file at load time and read by
// the next. Declared only here — a tool that does `const DeckCombos = require(…)`
// is not redeclaring anything, and saying otherwise in the shared block made the
// linter complain about the pattern this repo is built on.
const PAGE = {
  DeckParser: 'readonly',
  DeckCombos: 'readonly',
  ComboGraph: 'readonly',
  ComboSteps: 'readonly',
  StepsSource: 'readonly',
  DeckView: 'readonly',
  ComboSearch: 'readonly',
  ResultTiers: 'readonly',
  // The pieces app.js was split into. PageDom holds the DOM helpers and the panel every
  // renderer wanted; RenderMap is the map's drawing half, beside graph.js's arithmetic.
  PageDom: 'readonly',
  RenderMap: 'readonly',
  DeckIO: 'readonly',
  RenderRows: 'readonly',
  RenderCombos: 'readonly',
  // Where to buy a card. Read by render-rows.js and render-suggestions.js, and by
  // neither of them hard: a page without it keeps every panel and loses the Buy links.
  CartLinks: 'readonly',
  RenderSuggestions: 'readonly',
};

const NODE = {
  module: 'writable',
  require: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  Response: 'readonly',
  URL: 'readonly',
  TextDecoder: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  globalThis: 'readonly',
  performance: 'readonly',
  AbortController: 'readonly',
};

// The mistakes worth failing a build over, in both environments.
const RULES = {
  'no-undef': 'error',
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-duplicate-case': 'error',
  'no-func-assign': 'error',
  'no-self-compare': 'error',
  'no-unreachable': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-fallthrough': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  // Written, then not used. `caughtErrors: none` because this codebase writes
  // `catch (err)` with an empty body and a comment for failures it has decided to
  // ignore — a cache that will not store, a localStorage that will not write. The
  // empty block is the point, so it must not be a lint error.
  'no-unused-vars': ['error', {
    args: 'after-used',
    caughtErrors: 'none',
    ignoreRestSiblings: true,
  }],
  eqeqeq: ['error', 'smart'],
  'no-var': 'error',
  'prefer-const': 'error',
};

export default [
  {
    // The page. Real `<script>` files, so a `function` at top level really does
    // land on `window` — which is why no-implicit-globals belongs here and only
    // here. Each of these files wraps itself in an IIFE for exactly that reason.
    // Every script either page loads. Listing them by name is deliberate — see
    // the note on the Node block below for what a file missing from both lists
    // gets, which is nothing.
    files: [
      'app.js', 'combos.js', 'parser.js', 'search.js', 'search-worker.js', 'sw.js',
      'result-tiers.js', 'tiers-page.js', 'theme.js', 'unofficial.js', 'graph.js',
      'combo-steps.js', 'steps-source.js', 'view-model.js',
      'page-dom.js', 'render-map.js', 'deck-io.js', 'cart-links.js',
      'render-rows.js', 'render-combos.js', 'render-suggestions.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...BROWSER, ...PAGE },
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: { ...RULES, 'no-implicit-globals': 'error' },
  },
  {
    // Node: the tools, the unit tests, and the browser tests with their server
    // and config. CommonJS is module scope, not global scope, so a top-level
    // function here leaks nowhere and no-implicit-globals would be reporting the
    // language rather than a mistake.
    //
    // Between these two lists they have to cover every .js in the repository. A
    // file in neither is not linted leniently — it is not linted *at all*: flat
    // config applies no rules to a file no block matches, and it passes in
    // silence. theme.js, unofficial.js and graph.js sat outside both for a while
    // and a misspelled global in any of them would have gone to production
    // green. There is a test below that fails if a file is orphaned again.
    // research-log.js sits with the tools rather than with the shipped files above:
    // the browser never loads it, so it is a plain CommonJS module and is linted as one.
    files: [
      'tools/**/*.js', 'test/**/*.js', 'playwright.config.js', 'e2e/server.js',
      'research-log.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: NODE,
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: RULES,
  },
  {
    // The prototypes. Browser scripts like the page's own, and linted with the same
    // rules for the same reason: a `<script>` file's top-level function really does
    // land on `window`, so no-implicit-globals is reporting a mistake here too.
    //
    // They are not the site — `tools/prune-artifact.js` keeps them out of the Pages
    // artifact, since no page references them — but they are the drawings a design
    // decision gets made from, and a prototype with a misspelled global that silently
    // does nothing is a drawing of something that was never true. `PAGE` is included
    // because a prototype reproduces shipped markup and reaches for the same globals
    // the real scripts do.
    files: ['prototypes/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...BROWSER, ...PAGE },
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: { ...RULES, 'no-implicit-globals': 'error' },
  },
  {
    // The browser tests. Node files that contain browser code: everything inside
    // a `page.evaluate()` callback is serialised and run in the tab, so `window`
    // and `document` are as real there as `require` is around them. Both sets of
    // globals, or half of every spec is a false positive.
    files: ['e2e/**/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...NODE, ...BROWSER },
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: RULES,
  },
];
