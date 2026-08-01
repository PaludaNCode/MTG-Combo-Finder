// Lint config, and no lint dependency: CI runs `npx eslint` and npm fetches it for
// that one step. This repo ships with nothing installed and that is worth keeping —
// the page has no build, and a node_modules that only a linter needs would be the
// first entry in it.
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
    files: [
      'app.js', 'combos.js', 'parser.js', 'search.js', 'search-worker.js',
      'result-tiers.js', 'tiers-page.js',
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
    // Node: the tools and the tests. CommonJS is module scope, not global scope,
    // so a top-level function here leaks nowhere and no-implicit-globals would be
    // reporting the language rather than a mistake.
    files: ['tools/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: NODE,
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: RULES,
  },
];
