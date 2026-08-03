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
npm run test:ui           # Playwright browser tests + axe a11y (desktop + phone)
npm run verify:unofficial # every unofficial row still cites a real published combo
npm run check:readme      # the README's countable numbers still match the files

node tools/fetch-combos.js out.json [steps/]   # add --no-steps to skip the 103,737 files
node tools/try-deck.js [deck.txt]              # what would the page show for this deck?
node tools/combos-with.js "Card A" "Card B"    # why isn't this a combo?
node tools/template-users.js ["Persist Creature"]
node tools/lookup-card.js "Card name"          # oracle text, from Scryfall (see below if it 403s)
node tools/substitution-scope.js               # how much of the substitution space is unread
node tools/probe-cors.js [site]                # can a browser read a deck from this site?

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
| `combo-steps.js` | `ComboSteps` | a combo's prerequisites and steps: `normalize()` for the page, `pick()` for the publisher |
| `steps-source.js` | `StepsSource` | where a combo's steps live — the id → URL rule both ends share |
| `view-model.js` | `DeckView` | what a sentence says and how a number is phrased — no DOM |
| `app.js` | — | the only file that touches the DOM of `index.html` |
| `tiers-page.js` | — | the same for `tiers.html` |

`search-worker.js` `importScripts` result-tiers → combos → unofficial → search,
in that order (each reads the previous at load time). It does **not** load
`parser.js` (the page parses before posting) or `graph.js` (drawn from the result).

## Researching a card, and recording that you did

`research-log.js` is the index of what has been swept. **Before starting a deep dive,
read it; after finishing one, add to it.** A pass that is not in it did not happen as
far as anyone can tell, which is exactly the state the file was written to end —
"nothing remains open" was once written under an audit of 44 candidates and read as a
statement about 103,737 combos.

```bash
node tools/substitution-scope.js            # how much is unread, and which cards
node tools/substitution-scope.js 0.8 3      # looser bar, more candidates
```

The bottom table is the work queue: cards proposing many unpublished combos that no
recorded pass has swept. The top is the size of the space.

**The pass itself, in the order that avoids wasted reading:**

1. **Find the true peers, from card text, not from a score.** Two cards are peers when
   they do the same job in a loop. A high substitution score only says they fill the
   same slot *somewhere*. Stridehangar Automaton scored as Chatterfang's closest peer
   and is not one — it reads only *artifact* tokens — and that single fact ruled out
   1,197 of his 1,202 candidates.
2. **Take every shape a peer is published in and the subject is not.**
3. **Drop the subsumed.** If the subject already has a combo whose cards are a subset,
   the candidate is a strict superset and Spellbook does not publish those. Chatterfang
   + Pitiless Plunderer being a published *two-card* combo killed every "Pitiless
   Plunderer and an outlet" shape at once.
4. **Drop what is already published, and what is already a row.**
5. **Read the survivors against the cards** — the published steps for the peer's version
   are the best evidence, since they say what the loop actually does. Rosie's nine were
   settled that way: her step-for-step twin was already published with Mighty Mutanimals.
6. **Write the rows**, citing the peer combo, and **log the pass** with its rule-outs.
   The rule-outs are the valuable part; the README's oldest audit is more useful for its
   35 rejections than its 9 survivors.

Confidence is not a formality. `verified` means somebody read both cards; `derived`
means both halves are published and the pairing was reasoned, not read. Use `derived`
rather than reading loosely and claiming `verified`.

### Asking the question of one deck

There is no tool for this yet — it is the obvious next one. The method is the pass above
with step 2 restricted to shapes whose cards the deck already holds, which is how the
lifegain pass found 51 candidates nobody had looked for. Until it exists, the deck-level
question the page *does* answer is the different one of which existing rows a deck can
assemble: `matchUnofficial()`, exercised in `test/unofficial.test.js` against the deck
below. `tools/try-deck.js` does **not** cover the unofficial panel.

### The two fixture decks

| deck | what it is for |
|---|---|
| `test/fixtures/deck.txt` | the tuning deck. What `try-deck.js` and `verify-layout.js` default to, and what the README's measurements are taken on. |
| `test/fixtures/chatterfang-deck.txt` | **the standing deck for `unofficial.js`.** 103 maindeck cards plus a sideboard that must stay ignored, built to sit on top of the unofficial rows. |

Use the Chatterfang deck whenever a change touches `unofficial.js`. `test/unofficial.test.js`
pins the exact rows it unlocks — an exact list, not a count, because a count moves when a
row is added and says nothing about which. **A diff there is a prompt to read the list, not
a failure**: adding rows is supposed to change it. It went 39 → 44 when the Necrosynthesis
rows landed. The same test also holds the Chatterfang rows to being *one card away* from
this deck, which is how a row that matches on something too loose gets caught.

The nightly job publishes `steps/` beside `combos.json`: one small file per combo, in
256 buckets, written by `tools/fetch-combos.js` in the same pass. Gitignored, like
`combos.json`, and for the same reason.

`templates.json` and `combos.json` are data: the first is generated and checked in,
the second is built by CI and lives on the `data` branch. Never commit `combos.json`.

`tiers.html` loads `combos.js` too, for one function: `DeckCombos.decode()`. It reads
`combos.json` directly, so it needs the decoder exactly as much as the deck page does.

## Things that will bite you

- **`app.js` and `tiers-page.js` are not covered by the unit tests** — by design.
  They are the layout test's job. Logic you want tested belongs in one of the
  DOM-free modules. If getting it wrong would produce a page that looks right and
  says something false — a count, a pluralisation, a bracket's reasoning — it is a
  decision, and it belongs in `view-model.js`, where `node --test` can reach it.
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
- **Colour is a token, and `opacity` is not a way to make one quieter.** Opacity is
  applied after the colour is chosen, so it spends a contrast budget already
  allocated, invisibly — four rules did exactly that and three were a couple of
  hundredths under AA. `e2e/a11y.spec.js` catches it now. `--faint` exists for text
  below `--muted`, and is only safe on `--bg`.
- **Both HTML files carry a CSP** (`default-src 'none'`, `script-src 'self'`). No
  inline scripts, no CDN, no remote fonts or icons. `connect-src` names only
  `raw.githubusercontent.com` and Archidekt.
- **The unofficial panel is never counted as published data.** Its rows stay out of
  the combo count and the bracket check, and every row has to name the published
  combo it came from. `test/unofficial.test.js` enforces that shape.
- **Row and result counts in the README are real measurements.** If you add rows to
  `unofficial.js` or entries to `result-tiers.js`, the numbers in the prose move too —
  `npm run check:readme` says which, and CI runs it. It also fails if a sentence it
  anchors on has been reworded, because a check that matches nothing is a check
  reporting success for work it did not do.
- **Don't page Spellbook's `/variants` API.** Their rate limit is a cumulative quota;
  the fetcher streams the bulk export instead. The README explains what happens if
  you try.
- **The published payload interns `c` and `p`** into `names`/`results` tables, and
  most rows carry no `id` at all — it is rebuilt from a `cardIds` table. The browser
  harnesses serve the fixture through `asPublished()` so they receive that shape too;
  a page that forgets to decode now fails in CI rather than in front of a reader,
  which is how `tiers.html` reached production stuck on "Loading the combo database…".
  `DeckCombos.decode()` does all of it right after the parse, and every other line
  goes on reading strings. Anything that loads `combos.json` has to call it
  (`search.js` and four tools do). It is a no-op on a payload without the tables,
  which is why the fixtures still work.
- **A wrong permalink is the one failure worth engineering against.** The fetcher
  drops a row's `id` only after rebuilding it and checking it matches; anything that
  does not rebuild keeps its literal id. Never make that path guess — a link that
  works and shows a different combo is invisible to every test we run.
- **`raw.githubusercontent.com` gzips almost everything, which breaks byte ranges.**
  They serve 24 of 25 probed extensions as `text/plain`, and Fastly compresses it — so
  a browser `Range: bytes=1000-1099` gets bytes 1000-1099 *of the gzip stream*, and a
  100 KB file reports a total size of 133. `Accept-Encoding` is a forbidden header, so
  `fetch()` cannot opt out. Only `.zip` came back as `application/zip` with honest
  ranges. Any design here that wants a slice of a file has to start from that.
- **`tools/lookup-card.js` saying "HTTP 403 — check the spelling" may mean the sandbox,
  not the spelling.** An agent sandbox whose proxy allowlists `raw.githubusercontent.com`
  403s every Scryfall host at CONNECT, and mtgjson, gatherer and the Spellbook API with
  them; the tool cannot tell that from a typo. Card text is still reachable, because
  Forge ships its card scripts as files in a GitHub repo and each has an `Oracle:` line:
  `…/Card-Forge/forge/master/forge-gui/res/cardsfolder/<first letter>/<slug>.txt`.
  The slug: strip accents, lowercase, drop apostrophes, every other run of
  non-alphanumerics becomes one `_` (so `M.O.D.O.K.` → `m_o_d_o_k`), split cards join
  **both** faces, and recent sets live in `cardsfolder/upcoming/` instead of the letter
  directory. Probed at 454 of 454 names from the combo data. It is a second opinion, not
  Scryfall — no colour identity, no legalities — so cross-check anything a reading turns
  on against XMage, whose path is the same idea in PascalCase with the punctuation gone:
  `…/magefree/mage/master/Mage.Sets/src/mage/cards/b/BartolomeDelPresidio.java`.
  The README's *Reading a card when Scryfall is unreachable* has the probe.
- **The steps tree has no manifest, on purpose — so CI computes one.** The id *is* the
  URL and a 404 means "none recorded", which is what makes it cheap and also what makes
  a wrong tree invisible: a reader is told there are no steps and believes it.
  `tools/check-snapshot.js --steps` walks every file against `StepsSource.pathFor()` and
  today's combo ids. Publishing the two out of step is the one way they can drift.
- **A deck site's CORS behaviour is never assumed.** Moxfield is unsupported because
  somebody assumed and was wrong. `tools/probe-cors.js` asks for the one header that
  decides it, with the deployed page's Origin, and carries Archidekt and Moxfield as
  controls so a broken run cannot be mistaken for a refusal. It has to run on a runner:
  the usual sandbox cannot reach any of those hosts, and a proxy 403 looks exactly like
  a site saying no. `curl` proves nothing either — it does not enforce CORS.
- **Archidekt may already be unreadable, and nobody has confirmed it.** The probe's own
  control failed on 2 Aug 2026: Archidekt echo their allowlist (`https://archidekt.com`
  asked as themselves) and answer everyone else with `http://localhost:3000`, so a
  browser on `paludancode.github.io` discards the response. `SITES.archidekt` still says
  `browserImport: true`. Settle it by pasting an Archidekt URL into the live page before
  changing anything — the README section says what the fix is if it holds.
- **The `data` branch is a build artifact.** Never branch from it or PR into it.

## Conventions

- Comments explain *why*, not what — the existing code is dense with rationale, and
  a change that removes a reason without replacing it reads as a regression.
- No dependencies. ESLint and Playwright are fetched per run rather than installed;
  a `node_modules` here would be the first one.
- No style rules in the lint config on purpose. Match the surrounding code.
- Trunk-based: short-lived `feat/…` / `fix/…` branches off `main`, PR, auto-merge
  when green. Merging to `main` *is* the release.
