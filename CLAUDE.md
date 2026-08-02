# CLAUDE.md

Working notes for Claude Code in this repository. The **README is the reference** —
it explains *why* nearly every decision here is the way it is, and it is kept
current on purpose. This file is the short version: what to run, where things
live, and the mistakes that are easy to make.

## What this is

A static page. Paste a Magic: The Gathering decklist, get the combos in it and a
ranked list of single cards that would unlock more. No build step, no framework,
no `node_modules` — the files in the repo root *are* what GitHub Pages serves.
Combo data comes from a nightly snapshot of Commander Spellbook published to the
`data` branch.

## Commands

```bash
npm test                  # unit tests, node:test, zero deps (~370 tests, ~1s)
npm run test:coverage     # the same with the coverage floors CI enforces (Node 22.8+)
npm run lint              # ESLint, fetched for the run — no lint dependency installed
npm run verify            # layout smoke test — REQUIRED after any UI change
npm run test:ui           # Playwright browser tests (desktop + phone profiles)
npm run verify:unofficial # every unofficial row still cites a real published combo

node tools/try-deck.js [deck.txt]              # what would the page show for this deck?
node tools/combos-with.js "Card A" "Card B"    # why isn't this a combo?
node tools/template-users.js ["Persist Creature"]
node tools/lookup-card.js "Card name"          # oracle text, from Scryfall

npx serve .               # run it locally; any static file server works
```

`npm run verify` is not optional after a UI change. It renders the real page at
390/768/1440/1920px and catches the class of breakage that is invisible in a
screenshot — a map with every node at one point is valid SVG and an empty panel.

CI (`checks`) runs: syntax check → lint → `test:coverage` → `verify` → `test:ui`.

## Layout of the code

Every module is the same shape: an IIFE that exports a `module.exports` under
Node and a named global in a browser, so the logic is unit-testable without a DOM.

| File | Global | What it owns |
|---|---|---|
| `parser.js` | `DeckParser` | decklist text, Moxfield/Arena/MTGO exports, deck URLs |
| `result-tiers.js` | `ResultTiers` | the tier inventory — hand-maintained data, no logic |
| `combos.js` | `DeckCombos` | matching, suggestions, template slots, bracket, `standInRows()` |
| `unofficial.js` | `UnofficialCombos` | `COMBOS` (hand-written rows) + `STAND_INS` (rules) — data |
| `search.js` | `ComboSearch` | download, Cache Storage, running a search |
| `graph.js` | `ComboGraph` | the combo map's arithmetic — no DOM |
| `theme.js` | `DeckTheme` | light/dark resolution, loaded from `<head>` |
| `app.js` | — | the only file that touches the DOM of `index.html` |
| `tiers-page.js` | — | the same for `tiers.html` |

`search-worker.js` `importScripts` result-tiers → combos → unofficial → search,
in that order (each reads the previous at load time). It does **not** load
`parser.js` (the page parses before posting) or `graph.js` (drawn from the result).

`templates.json` and `combos.json` are data: the first is generated and checked in,
the second is built by CI and lives on the `data` branch. Never commit `combos.json`.

## Things that will bite you

- **`app.js` and `tiers-page.js` are not covered by the unit tests** — by design.
  They are the layout test's job. Logic you want tested belongs in one of the
  DOM-free modules.
- **Load order is load-bearing.** `combos.js` reads the tier inventory at load time
  and `search.js` reads `combos.js` the same way. Adding a script means adding it in
  the right place in `index.html` *and* in `search-worker.js`.
- **The deploy stamps `?v=<sha>` onto asset URLs**, via `tools/stamp-assets.js`, which
  reads whatever the page references rather than a list — so adding a `<script>` to a
  page is just adding a `<script>` to a page. It fails the deploy if anything local is
  left unstamped, which is the check that matters: an unstamped URL resolves fine and
  serves whatever the CDN cached, so the bug is invisible outside production.
  `unofficial.js`, `graph.js`, and for a long time `theme.js`, all shipped that way.
  The worker is not in the HTML and stamps its own imports from its query string.
  `tools/verify-layout.js` builds its stamped fixture from the same `rewriteAssets()`,
  so the test and the deploy cannot disagree — they did, for a while.
- **Both HTML files carry a CSP** (`default-src 'none'`, `script-src 'self'`). No
  inline scripts, no CDN, no remote fonts or icons. `connect-src` names only
  `raw.githubusercontent.com` and Archidekt.
- **The unofficial panel is never counted as published data.** Its rows stay out of
  the combo count and the bracket check, and every row has to name the published
  combo it came from. `test/unofficial.test.js` enforces that shape.
- **Row and result counts in the README are real measurements.** If you add rows to
  `unofficial.js` or entries to `result-tiers.js`, the numbers in the prose move too.
- **Don't page Spellbook's `/variants` API.** Their rate limit is a cumulative quota;
  the fetcher streams the bulk export instead. The README explains what happens if
  you try.
- **The `data` branch is a build artifact.** Never branch from it or PR into it.

## Conventions

- Comments explain *why*, not what — the existing code is dense with rationale, and
  a change that removes a reason without replacing it reads as a regression.
- No dependencies. ESLint and Playwright are fetched per run rather than installed;
  a `node_modules` here would be the first one.
- No style rules in the lint config on purpose. Match the surrounding code.
- Trunk-based: short-lived `feat/…` / `fix/…` branches off `main`, PR, auto-merge
  when green. Merging to `main` *is* the release.
