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
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  console: 'readonly',
  getComputedStyle: 'readonly',
  // A monotonic clock, in the window and in the worker. search.js times the
  // three phases of a search with it.
  performance: 'readonly',
  globalThis: 'readonly',
  // Worker scope.
  self: 'readonly',
  importScripts: 'readonly',
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
  DeckView: 'readonly',
  ComboSearch: 'readonly',
  ResultTiers: 'readonly',
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
      'app.js', 'combos.js', 'parser.js', 'search.js', 'search-worker.js',
      'result-tiers.js', 'tiers-page.js', 'theme.js', 'unofficial.js', 'graph.js',
      'combo-steps.js', 'view-model.js',
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
    files: ['tools/**/*.js', 'test/**/*.js', 'playwright.config.js', 'e2e/server.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: NODE,
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: RULES,
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
