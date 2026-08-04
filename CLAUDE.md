# CLAUDE.md

Operating notes for Claude Code here. **The README is the reference** — ~4,500 lines, kept
current, holding the *why* and the full history behind every rule below. This file is the index:
what to run, where things live, what fails silently. `README § X` means read that section before
changing what it names.

`→` introduces the check that catches the mistake. Every number is a measurement.

## What this is

Static page, no build step, no framework, no `node_modules` — the repo root *is* what GitHub
Pages serves. Paste an MTG decklist, get its combos plus a ranked list of single cards that would
unlock more. Combo data is a nightly Commander Spellbook snapshot on the `data` branch.

## Commands

```bash
npm test                  # unit tests, node:test, zero deps — a couple of seconds
npm run test:coverage     # + the coverage floors CI enforces (Node 22.8+)
npm run lint              # ESLint, fetched per run — not installed
npm run verify            # layout smoke test — REQUIRED after any UI change
npm run test:ui           # Playwright + axe a11y (desktop + phone)
npm run verify:unofficial # every unofficial row still cites a real published combo
                          # --graduated out.json = rows Spellbook now publishes, which the
                          # nightly job turns into an issue
npm run check:readme      # the README's countable numbers still match the files

node tools/fetch-combos.js out.json [steps/]     # --no-steps skips the 103,737 files
node tools/fetch-combos.js out.json --fixture test/fixtures/export.json
                                                 # publisher, no network; what
                                                 # test/fetch-combos-fixture.test.js runs
node tools/try-deck.js [deck.txt]                # what the page would show
node tools/combos-with.js "Card A" "Card B"       # why isn't this a combo?
node tools/template-users.js ["Persist Creature"]
node tools/lookup-card.js "Card name"            # oracle text: cache → Scryfall → Forge
node tools/cache-card-text.js "Card name"        # runner only; "Cache card text" workflow
node tools/substitution-scope.js                 # how much of the space is unread
node tools/deck-cards.js [deck.txt] --unswept    # which cards carry a deck's combos
node tools/deck-gaps.js [deck.txt]               # which gaps THIS deck exposes
node tools/probe-cors.js [site]                  # can a browser read a deck from this site?
npx serve .                                      # any static file server works
```

- CI (`checks`): syntax → lint → `test:coverage` → `check:readme` → `verify` → `test:ui`.
- **`npm run verify` is not optional after a UI change.** It renders the real page at
  390/768/1440/1920px and catches what a screenshot cannot: a map with every node at one point is
  valid SVG and an empty panel.
- **Skip `verify` when the diff is docs only** — it costs ~2 minutes and it launches a browser to
  re-measure a page the diff cannot have touched. "Docs only" means every changed path is `*.md`:
  one `.js`, `.css`, `.html`, `.yml` or fixture in the diff and it is not docs only, including a
  comment-only change to one. `git diff --name-only origin/main... | grep -v '\.md$'` empty is the
  test. CI runs it regardless, so this is about not paying twice, and if in doubt run it.
- **Don't sleep waiting for CI.** Runs here take 102–112s; sleeping 190–240s wasted 12.4 minutes
  across six PRs. Poll at ~110s.
- **Never state a suite count in this file** — one was, wrong by 17 inside a fortnight, and
  `check:readme` anchors on the README so nothing watched it →
  `test/check-readme-numbers.test.js` rejects a bare `<number> tests` here.

## Layout of the code

Every module is an IIFE exporting `module.exports` under Node and a named global in a browser, so
logic is unit-testable without a DOM.

| File | Global | Owns |
|---|---|---|
| `parser.js` | `DeckParser` | decklist text, Moxfield/Arena/MTGO exports, deck URLs |
| `result-tiers.js` | `ResultTiers` | the tier inventory — data, no logic |
| `combos.js` | `DeckCombos` | matching, suggestions, template slots, bracket, `standInRows()`, `decode()` |
| `unofficial.js` | `UnofficialCombos` | `COMBOS` (hand-written rows) + `STAND_INS` (rules) — data |
| `search.js` | `ComboSearch` | download, Cache Storage, running a search |
| `graph.js` | `ComboGraph` | the map's arithmetic — no DOM |
| `theme.js` | `DeckTheme` | light/dark resolution, loaded from `<head>` |
| `combo-steps.js` | `ComboSteps` | `normalize()` for the page, `pick()` for the publisher |
| `steps-source.js` | `StepsSource` | the id → URL rule both ends share |
| `view-model.js` | `DeckView` | what a sentence says, how a number is phrased — no DOM |
| `page-dom.js` | `PageDom` | DOM helpers, `setStatus`, the collapsible `panel` |
| `render-rows.js` | `RenderRows` | the vocabulary every result row is built from |
| `render-combos.js` | `RenderCombos` | a combo as a row + its steps disclosure |
| `render-suggestions.js` | `RenderSuggestions` | suggestions, pieces, slots, unofficial panels |
| `render-map.js` | `RenderMap` | the map's drawing half |
| `deck-io.js` | `DeckIO` | the decklist, the share link, the dropped file |
| `app.js` | — | wiring, the search, bracket and legality lines |
| `sw.js` | `ServiceWorkerShell` | network-first HTML, cache-first for stamped URLs only |
| `tiers-page.js` | — | the DOM of `tiers.html` |
| `research-log.js` | — | **not page data.** Swept cards, what each pass found, the text it read |

- `research-log.js` breaks that shape — never loaded by a browser, so plain CommonJS, linted with
  the tools → `test/lint-config.test.js` fails if a script matches no lint block.
- `search-worker.js` `importScripts` result-tiers → combos → unofficial → search, **in that
  order** (each reads the previous at load time). Not `parser.js` (the page parses before
  posting), not `graph.js` (drawn from the result).
- `tiers.html` loads `combos.js` for one function, `DeckCombos.decode()` — it reads `combos.json`
  directly.
- `templates.json` is generated and checked in. `combos.json` is built by CI on the `data` branch
  — **never commit it.** `steps/` ships beside it: one file per combo, 256 buckets, same pass of
  `tools/fetch-combos.js`, gitignored for the same reason.

## Researching a card, and recording that you did

> ### Read the oracle text. Every card. Before reasoning about any of it.
>
> **Not "recall it". Not "it's obviously". Fetch it and paste it into the log.** A wrong rule-out
> produces no row, no test failure and no complaint — only a card that looks well-covered.
> Cheapest mistake here, most expensive to find, and recollection is how it happens every time.
> Both of these are from the session that wrote the rule; the second passed review and shipped:
>
> - Chatterfang reasoned about as `{2}{B}{G}`, a Fox Rogue with a `-X/-X` outlet. He is `{2}{G}`,
>   a Squirrel Warrior, `+X/-X`.
> - **All 37** Camellia / Experimental Confectioner candidates ruled out on "Food against
>   Squirrel". Both trigger on *sacrificing a Food*; Confectioner makes a **Rat**. The real
>   difference — Camellia batches, Confectioner counts — rules out **2**.
>
> **`research-log.js` will not accept a pass without the text**: every card in `cards` needs a
> verbatim entry in `read` → `test/research-log.test.js`. An instruction to work from card text
> was already here and was not enough.
>
> **Sources, in order** (`tools/lookup-card.js` walks all three):
>
> 1. **`card-text.json`** — committed cache of Scryfall's wording, filled on a runner by the
>    *Cache card text* workflow; no request, so it works here, and each entry carries its read
>    date. **If your cards are missing, run that workflow first** — semicolon-separated list,
>    commits to your branch.
> 2. **Scryfall live** — 403s at CONNECT here (`api.scryfall.com`, and WebFetch); fine on a runner.
> 3. **Forge card scripts** on `raw.githubusercontent.com` — allowed here, banner-marked as
>    Forge's wording. **Cross-check anything the reasoning turns on against XMage.**
>
> WebSearch and a card the user pastes are fine. Published Spellbook steps corroborate what a loop
> *does* but are not oracle text and do not satisfy this rule.
>
> **Never hand-write into `card-text.json`** — only the workflow writes it. A typed entry is
> exactly the unverified recollection this rule exists to stop, wearing authority.

`research-log.js` is the index of what has been swept. **Read it before a deep dive, add to it
after.** A pass not in it did not happen as far as anyone can tell — "nothing remains open" was
once written under an audit of 44 candidates and read as a statement about 103,737 combos.

```bash
node tools/substitution-scope.js            # top table = size of the space
                                            # bottom table = the work queue
node tools/substitution-scope.js 0.8 3      # looser bar, more candidates
node tools/deck-cards.js deck.txt --unswept # the same question asked of one deck
```

`deck-cards.js` ranks a deck's cards by how many published combos name them — what the
substitution method consumes — and flags what the log covers. `/deck-deep-dive` runs the pass
below against that list.

**The pass, ordered to avoid wasted reading:**

1. **Find the true peers from card text, not from a score.** Peers do the same job in a loop; a
   high substitution score only says they fill the same slot *somewhere*. Stridehangar Automaton
   scored as Chatterfang's closest peer and is not one — it reads only *artifact* tokens — which
   ruled out 1,197 of his 1,202 candidates.
2. Take every shape a peer is published in and the subject is not.
3. **Drop the subsumed** — if the subject already has a combo whose cards are a subset, the
   candidate is a strict superset and Spellbook does not publish those.
4. Drop what is already published, and what is already a row.
5. **Read the survivors against the cards.** The peer version's published steps are the best
   evidence, since they say what the loop actually does.
6. **Write the rows** citing the peer combo, and **log the pass with its rule-outs.** The
   rule-outs are the valuable part: the README's oldest audit is more useful for its 35 rejections
   than its 9 survivors.

`verified` = somebody read both cards. `derived` = both halves are published and the pairing was
reasoned. **Use `derived` rather than reading loosely and claiming `verified`.**

### Asking the question of one deck

| question | what answers it |
|---|---|
| which existing rows can this deck assemble? | `matchUnofficial()`, pinned in `test/unofficial.test.js`. **`try-deck.js` does not cover the unofficial panel.** |
| which of this deck's cards are worth sweeping? | `tools/deck-cards.js --unswept`, then `/deck-deep-dive` |
| which gaps does *this deck* expose? | `tools/deck-gaps.js` |

Rows 2 and 3 differ: `deck-cards.js` picks *subjects* from a deck and sweeps each across the whole
database, where `deck-gaps.js` also bounds candidate shapes to cards the deck holds, so every hit
is castable tonight (that framing found the lifegain pass's 51).

- **`deck-gaps.js` no longer re-proposes what was ruled out**, for decisions recorded as cards: a
  rule-out may carry `sets`, which the tool drops and prints.
- **`sets` is always a subset of its reason.** Most rule-outs are categorical ("the loop needs a
  *token* out of the sacrifice") and enumerate no cards. `ruledOutSets()` answers *has this been
  ruled out?* with **yes** or **nothing recorded** — never with *no*. A surviving candidate means
  nothing machine-readable was recorded, not that nobody decided. Still read the log.

### The two fixture decks

| deck | for |
|---|---|
| `test/fixtures/deck.txt` | the tuning deck — `try-deck.js` and `verify-layout.js` default, and where the README's measurements are taken |
| `test/fixtures/chatterfang-deck.txt` | **the standing deck for `unofficial.js`** — 103 maindeck cards plus a sideboard that must stay ignored |

Use the Chatterfang deck whenever a change touches `unofficial.js`. `test/unofficial.test.js` pins
the **exact rows** it unlocks — a list, not a count, since a count moves when a row is added and
says nothing about which. **A diff there is a prompt to read the list, not a failure.** The same
test holds Chatterfang rows to being *one card away* from this deck, catching a row that matches
on something too loose.

## Things that will bite you

### Tests, and what a tool says about itself

- **The DOM files are not unit-tested, by design.** `app.js`, `tiers-page.js`, `page-dom.js` and
  the four `render-*.js` belong to `verify` and `test:ui`; a green `npm test` says nothing about
  them. Anything that could make a page look right and say something false — a count, a
  pluralisation, a bracket's reasoning — is a decision and belongs in `view-model.js`.
- **A tool's own summary is unwatched too, and gets believed once.** `deck-cards.js --unswept`
  summarised already-filtered rows: *0 of 33* swept where the log held **27 of 60**. → count
  before you filter, and put the decision in an exported function (`sweepStatus()`,
  `skippedLines()`) → `test/deck-tools.test.js`.
  README § *What a tool says about itself is not exempt*.
- **`verify-layout.js`'s `HARNESS` is a template literal**, so a regex loses its backslashes:
  `/\d+ combos/` becomes `/d+ combos/`, and an assertion matching nothing passes → write `\\d`.
  **A backtick anywhere in it, comments included, ends the literal** — which runs ~1,500 lines
  from `const HARNESS =` to past `runOne()` — with `SyntaxError: Unexpected token ':'`. That one
  at least fails at parse; the backslash does not.
- **"The first row" pins a check to somebody else's decision.** `.combo:first-child` reddened
  three checks about tier order, the fold and colours when the order changed, and two browser
  tests lost the Spellbook link and steps control once a collapsed row led. Ask by the shape the
  check needs (`:not(:has(> h3 .either))`, "a row with a `.tier-win` chip") **and scope both
  halves of the assertion to that row** — an a11y test pressed one row's control and read
  another's panel, passing only while they coincided.
- **Assert what a reader sees, not `textContent`.** Row text can be in the DOM twice with CSS
  showing one: the split is `17+7` narrow and `17 official · 7 unofficial` wide, both always
  present. → `visibleTextIn()` in `verify-layout.js`, which skips `display: none`.
- **`boundingBox()` coordinates do not scroll**, so `page.mouse.click(box.x + 4, …)` lands on
  nothing if an earlier press scrolled the element out. → `locator.click({ position })`.

### Data shapes

- **A combo has two shapes and the ordering code sees the wrong one if you let it.** Compact rows
  carry `c` (strings); rows through `expand()` carry `uses` (objects). **Sorting happens before
  expansion, rendering after.** `variantCardNames()` handles both — it did not, so compact-row
  callers got an empty list, which no ordering rule objects to, and the unofficial panel shipped
  in file order. `comboSize()` had worked around the shape at *its* call site: **never re-add that
  workaround — fix the contract.** README § *The unofficial panel was sorted on nothing at all*.
- **The published payload interns `c` and `p`** into `names`/`results`, and most rows carry no
  `id` — it is rebuilt from `cardIds`. **Anything loading `combos.json` must call
  `DeckCombos.decode()`** right after the parse (`search.js` and four tools do); everything
  downstream reads strings. No-op without the tables, so fixtures still work. Harnesses serve the
  fixture through `asPublished()`, so forgetting to decode fails in CI rather than in production.
- **A wrong permalink is the one failure worth engineering against.** The fetcher drops a row's
  `id` only after rebuilding it and checking it matches; anything that does not rebuild keeps its
  literal id. **Never let that path guess** — a link that works and shows a different combo is
  invisible to every test we run.
- **The steps tree has no manifest on purpose, so CI computes one.** The id *is* the URL and a 404
  means "none recorded" — cheap, and also why a wrong tree is invisible: the reader is told there
  are no steps and believes it. → `tools/check-snapshot.js --steps`, against
  `StepsSource.pathFor()` and today's ids. Publishing the two out of step is the one drift.
- **Load order is load-bearing.** `combos.js` reads the tier inventory at load time; `search.js`
  reads `combos.js` the same way. Adding a script means adding it in the right place in
  `index.html` **and** in `search-worker.js`.

### Layout and CSS

- **`COLLAPSE_FROM = 4` in `combos.js`: a pair or triple of interchangeable cards does not
  collapse.** That is the rule, not a bug. Three consequences: `groupVariants()` counts members
  still *free*, so a family cut below the threshold by a bigger one is written out too; **a
  fixture whose families are all smaller draws no collapsed row at all**, so
  `test/fixtures/dataset.js` carries enough versions to keep the "any of N" shape covered, and
  raising the number means adding another there; tests read the exported constant, exactly one
  pinning the number.
- **Do not remove the fold again without answering the measurement.** The case for removing it is
  real and in README § *The fold was taken out once, and put back*. What it does not weigh:
  **149 of the Chatterfang deck's 233 rows repeat a block of result chips already on screen**,
  because a family's versions produce identical results by construction.
- **Row layout is keyed on the row's own column, not the viewport, and the two disagree.** The
  results column is 704px at a 768px window and **442px at 900px**, because 900 is where the
  two-column shell hands 370px to the decklist — so `min-width: 900px` styles the *narrower* case
  as though it were roomier. → `@container rows (min-width: …)`, on the two panel bodies. The two
  thresholds differ deliberately, each measured against what it costs the card name: the split
  spells itself out at 560px of column, the links join the name at 750px. Only measured numbers go
  there; `verify` prints the column width per viewport.
- **The line down a suggestion row is not one element.** It is a `border-left` on every block in
  the card's column (`.row-main`, `.alternatives`, the disclosure), each reaching back over the
  column gap with a negative margin. So the gap is `--col-gap` not a number, spacing inside those
  blocks is padding never margin, and **a new block there must carry its own piece** or the line
  stops at it — `verify` names the piece that broke it.
  **The gutter draws none of it, load-bearingly:** owning the top segment forced it to share a
  grid row with `.row-main`, so a row whose total split into official and unofficial pushed
  everything below down 9px (28px when the split wrapped). It spans the rows now instead of sizing
  one, and `verify` fails if a `border-right` reappears — a second line at the same x is invisible
  on screen and undoes it all. Measurements in README § *Where the second number goes*.
- **Colour is a token, and `opacity` is not a way to make one quieter** — it applies after the
  colour is chosen, spending an already-allocated contrast budget invisibly, and three of four
  rules that did it were hundredths under AA. → `e2e/a11y.spec.js`. `--faint` is the token for
  text below `--muted`, and is **only safe on `--bg`**.
- **Both HTML files carry a CSP** (`default-src 'none'`, `script-src 'self'`): no inline scripts,
  no CDN, no remote fonts or icons. `connect-src` names only `raw.githubusercontent.com` and
  Archidekt.

### Assets and offline

- **The deploy stamps `?v=<sha>` onto asset URLs** via `tools/stamp-assets.js`, which reads what
  the page references rather than a list — so adding a `<script>` is just adding a `<script>`. It
  fails the deploy on any unstamped local URL, and that is the check that matters: an unstamped URL
  resolves fine and serves whatever the CDN cached, so the bug is invisible outside production
  (`unofficial.js`, `graph.js` and long-term `theme.js` all shipped that way).
- The worker is not in the HTML and stamps its own imports from its query string. The same run
  writes `sw.js`'s precache list (`--worker sw.js`) from the same walk, so the shell cannot drift
  from what the pages ask for. **`sw.js` is cache-first only for stamped URLs** — unstamped is not
  immutable, and local work, `verify` and `test:ui` all serve unstamped. `tools/verify-layout.js`
  builds its stamped fixture from the same `rewriteAssets()`, so test and deploy cannot disagree.

### The unofficial panel

- **Its rows are never counted as published data**: out of the combo count and the bracket check,
  and every row names the published combo it came from → `test/unofficial.test.js`.
- **Two panels list ours and Spellbook's in one order** (suggestions, pieces), so what marks a row
  as ours is the `unofficial` pin, before the confidence pin. A heading above a second list made
  "who published this" decide where a row *sat* and split families across it. Counts stay apart
  (`+3 official · +1 unofficial`) and the standalone panel stays; only ordering merged. **The pin
  is on every unofficial row rather than behind a flag** — a missing pin in a merged list
  attributes our work to Spellbook and nothing on screen would say otherwise.
- **Rows leave the file because the nightly job noticed, not because somebody remembered.**
  `update-data.yml` checks every citation against the snapshot it just published: a broken one
  fails the job; a row Spellbook has since published goes into a standing issue the job rewrites
  nightly and closes itself. **Don't hand-edit that issue's body** — it is regenerated, and
  `npm run verify:unofficial` is the live answer.
- **`unofficial.js` only grows, and it is never parsed on the main thread** — `search-worker.js`
  `importScripts` it and nothing else, so it delays the first search, not first paint, which is
  what the threshold rests on. Watch gzipped size, not row count:
  `gzip -9 -c unofficial.js | wc -c`. **At 200 KB gzipped, `COMBOS` moves to the `data` branch as
  JSON** (raised from 50 KB deliberately; the cost is mostly the exact-row assertion in
  `test/unofficial.test.js`). One four-card sweep put on 14 KB, so headroom is a dozen passes, not
  a hundred. README § *What the file costs, and the size at which it stops being source*.
- **README counts are real measurements.** Adding rows to `unofficial.js` or entries to
  `result-tiers.js` moves numbers in the prose → `check:readme` says which. It also fails if a
  sentence it anchors on was reworded, because a check matching nothing reports success for work
  it did not do.

### Network, and this sandbox

- **`raw.githubusercontent.com` gzips almost everything, which breaks byte ranges.** 24 of 25
  probed extensions come back `text/plain` and Fastly compresses them, so `Range: bytes=1000-1099`
  gets those bytes *of the gzip stream* and a 100 KB file reports a total size of 133.
  `Accept-Encoding` is a forbidden header, so `fetch()` cannot opt out. Only `.zip` had honest
  ranges. Any design wanting a slice of a file starts there.
- **`tools/lookup-card.js` falls back to Forge and says when it did.** This sandbox's proxy 403s
  every Scryfall host at CONNECT, plus mtgjson, gatherer and the Spellbook API. Forge ships card
  scripts as files with an `Oracle:` line:
  `…/Card-Forge/forge/master/forge-gui/res/cardsfolder/<first letter>/<slug>.txt` — slug = strip
  accents, lowercase, drop apostrophes, every other run of non-alphanumerics becomes one `_`
  (`M.O.D.O.K.` → `m_o_d_o_k`); split cards join **both** faces; recent sets live in
  `cardsfolder/upcoming/`. Probed at 454 of 454 names. Forge answers print under a banner — no
  colour identity, legalities or printings, and the wording is Forge's. Cross-check against XMage,
  the same idea in PascalCase without punctuation:
  `…/magefree/mage/master/Mage.Sets/src/mage/cards/b/BartolomeDelPresidio.java`.
- **A blocked host and a typo are identical from inside a tool.** `lookup-card.js` used to print
  *"HTTP 403 — check the spelling"*, a diagnosis it cannot make; it now says that only when
  Scryfall was reachable enough to call the name unknown → `test/lookup-card.test.js`.
- **Don't page Spellbook's `/variants` API** — the rate limit is a cumulative quota; the fetcher
  streams the bulk export. README § *Use the bulk export, never the paged API*.
- **A deck site's CORS behaviour is never assumed** — Moxfield is unsupported because somebody
  assumed and was wrong. `tools/probe-cors.js` asks for the one deciding header with the deployed
  page's Origin, carrying Archidekt and Moxfield as controls so a broken run cannot be mistaken
  for a refusal. **It must run on a runner**: this sandbox reaches none of those hosts and a proxy
  403 looks exactly like a site saying no. `curl` proves nothing; it does not enforce CORS.
- **Archidekt may already be unreadable and nobody has confirmed it.** The probe's own control
  failed on 2 Aug 2026: they echo their allowlist when asked as themselves and answer everyone else
  with `http://localhost:3000`, so a browser on `paludancode.github.io` discards the response.
  `SITES.archidekt` still says `browserImport: true`. Settle it by pasting an Archidekt URL into
  the live page before changing anything — README § *Archidekt may no longer be readable either*.

## Conventions

- Comments explain *why*, not what. Removing a reason without replacing it reads as a regression.
- **No dependencies.** ESLint and Playwright are fetched per run; a `node_modules` here would be
  the first.
- No style rules in the lint config, on purpose. Match the surrounding code.
- Trunk-based: short-lived `feat/…` / `fix/…` off `main`, PR, auto-merge when green. Merging to
  `main` *is* the release. **Short-lived is load-bearing** — see below.
- **A ruleset refuses direct pushes to `main`**: PR required, `checks` green, no force-push, no
  deletion. Nothing to work around. Two rules are off on purpose and read as oversights —
  *require linear history* would forbid the merge commits `main` already uses, and any
  required-approval count above zero makes every PR unmergeable on a solo repo. **A ruleset for
  `data` must not block force-pushes**: `update-data.yml` force-pushes it nightly.
- **Push protection is on.** A push carrying anything credential-shaped is rejected outright — if
  it fails on a fixture, comment or test where you were only quoting a token *shape*, that is why.
- **The `data` branch is a build artifact.** Never branch from it or PR into it.
- **Outstanding work is a GitHub issue and nothing else.** No backlog file, on purpose: a document
  that reads as a queue and is not one costs more than it says. Reasoning behind what shipped lives
  in the README section that owns it.

### Reporting what you did

**Check it yourself, then say what you checked.** A claim with a command behind it beats a
confident sentence, and most rules in this file exist because something untested read as fine.

**Never confirm a deploy from the Actions API.** `actions_list` returns ~395 KB a call here —
five of them to read ten lines — and a green deploy job still does not prove the CDN is serving
the new bytes. **The footer does**, on both pages: `Build <sha> · deployed <YYYY-MM-DD HH:MM:SS
UTC>`. So name the SHA that went out and point at the footer. Deploys are asynchronous and do not
need waiting on: the reader compares seven characters on the page they already have open,
whenever it lands. README § *The footer says which build it is and when that build arrived*.

**A closing report, in order:**

1. What changed, and where the reasoning lives — a `README §`, an issue number.
2. What was run and what it said, in real numbers rather than "tests pass".
3. What was *proved* rather than assumed: which check you broke on purpose to watch it fail. A
   check nobody has seen fail is a check nobody has seen work.
4. What to look at — the SHA pushed, and the footer to compare it against.
5. What you skipped or left out, and why. **A check not run is not a check passed**, and
   "CI is green" cannot stand in for a check CI does not run: `checks` never runs the deploy
   workflow, so nothing verifies it until a push to `main`.

### Merging back into `main`

- **Compare against `origin/main`, never a local `main`.** A fresh sandbox's clone can carry a
  `main` pointing at the project's original unsquashed history, sharing no recent ancestor with the
  remote — one landed 148 commits stale with `git pull` refusing as divergent, and nothing was
  wrong with the repository. So: `git fetch origin main`, always.
- **A `SessionStart` hook does that for you in remote sessions** — `.claude/hooks/session-start.sh`,
  registered in `.claude/settings.json`: fetches `--prune` and, if `main` is not checked out and
  differs from `origin/main`, tags what only `main` holds as `archive/main-<sha>` and realigns the
  ref. The rule above still stands: the hook is remote-only by design, skips silently when `origin`
  is unreachable, and will not move `main` while `main` is checked out. If you meet the fossil,
  `git reset --hard origin/main` — archive the old tip first.
- **Anything else wanting to run at session start goes in that script**, but it runs synchronously,
  so every line is latency on every session. Nothing needs installing: keep it git hygiene only.

**This repository generates exactly two kinds of merge conflict, by construction.** Neither is a
judgement call:

1. **Append-only data tails** — `COMBOS` in `unofficial.js`, `PASSES` in `research-log.js`. Both
   sides add at the end, so both edit the line before the same closing bracket. **Resolution is
   always "keep both".** The trap: markers land *mid-object*, so each side's last entry is left
   unclosed and the shared text after the conflict closes exactly one. Take side A's lines, close
   A's final entry by hand, let the existing tail close B's. Check with
   `node -e "require('./unofficial.js')"`.
2. **Counted prose in the README** — both sides bump the same numbers. **Resolution is never "pick
   a side": recompute.** `npm run check:readme` prints every real measurement.

**A long-lived branch pays both twice, plus a cost no conflict marker shows:** a rule added to
`main` while the branch was out, which the branch then has to satisfy retroactively. The fix is not
better conflict handling; it is a shorter branch.

### Writing an issue here: point, do not restate

An issue that copies current state becomes a second source of truth, and the unchecked copy rots.
"16 cards are unread" is wrong the moment somebody reads one — the exact failure this repo spent a
day fixing, where prose said *nothing remains open* and the data said otherwise.

Name **where the live answer lives** and **what finishing looks like**:

> The live list is in `research-log.js` — do not restate it here. Grep for `UNREAD`.
> Finish condition: `UNREAD_DEBT` in `test/research-log.test.js` reaches 0.

Carry detail only where it exists nowhere else machine-readable — a design constraint, a specific
failing case, a decision somebody has to make. Never a count a file already holds and a test
already checks.
