# CLAUDE.md

Operating notes for Claude Code here. **The README is the reference** — ~1,500 lines, kept
current, holding the *why* and the measurement behind every rule below. This file is
the index: what to run, where things live, what fails silently. `README § X` means read that
section before changing what it names, and its `## Contents` table is the map.

**It was cut from ~4,900 lines to an upper-level reference on 4 Aug 2026**, so it now states the
rule and the figure it rests on rather than the full argument. Where a section names a command
(`npm run verify`, `gzip -9 -c unofficial.js | wc -c`, `node tools/substitution-scope.js`), **that
command is the live answer** — the prose around it is the reasoning, not the number. The removed
history is in the git log if a decision needs re-litigating.

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
                          # --graduated out.json = rows Spellbook now publishes
npm run check:readme      # the README's countable numbers still match the files

node tools/fetch-combos.js out.json [steps/]      # --no-steps skips the 103,737 files
node tools/fetch-combos.js out.json --fixture test/fixtures/export.json   # no network
node tools/try-deck.js [deck.txt]                 # what the page would show
node tools/combos-with.js "Card A" "Card B"        # why isn't this a combo?
node tools/template-users.js ["Persist Creature"]
node tools/lookup-card.js "Card name"             # oracle text: cache → Scryfall → Forge
node tools/cache-card-text.js "Card name"         # runner only; "Cache card text" workflow
node tools/cache-card-text.js --all               # ditto; EVERY card, from Scryfall bulk data
node tools/sweep-impact.js old.json new.json      # which cited cards a sweep moved
node tools/substitution-scope.js                  # how much of the space is unread
node tools/deck-cards.js [deck.txt] --unswept     # which cards carry a deck's combos
node tools/deck-gaps.js [deck.txt]                # which gaps THIS deck exposes
node tools/probe-cors.js [site]                   # can a browser read a deck from this site?
node tools/check-branch-rules.js                  # does GitHub enforce what this file claims?
node tools/check-branch-rules.js --fixture test/fixtures/branch-rules.json  # replay; 403s live here
npx serve .                                       # any static file server works
```

- CI: two parallel jobs — `static` (syntax → lint → `test:coverage` → `check:readme` → `verify`) and
  `browser` (Chromium → `test:ui`) — plus **`checks`, which runs nothing and needs both**, so the one name
  the ruleset requires survived the split. Its `if: always()` is load-bearing: without it a failed
  dependency **skips** it and GitHub reads a skipped required check as neutral, not failed →
  `test/workflow-pins.test.js`.
- **CI runs on a pull request AND on a push to any branch but `main`.** The push half is not
  belt-and-braces testing, it is the release path: **a required check is only credited from the PR's own
  event, so one dropped webhook strands a pull request that nothing is wrong with.** #187 sat unmergeable
  for two hours with `checks`, `static` and `browser` green on its exact head SHA, and neither a
  `workflow_dispatch` run nor closing and reopening the PR produced anything the ruleset would look at —
  both tried, both refused with `Required status check "checks" is expected`. The cost is a duplicate run
  per push while a PR is open, ~84s each → `test/workflow-pins.test.js`, which also pins that `main`
  stays excluded and that the pair is **not** deduplicated with `cancel-in-progress`: a cancelled
  `checks` is what blocked #187 in the first place.
- **`main` itself is still excluded, and that rests on "Require branches to be up to date".** That
  setting is what makes the pull-request run a statement about the tree that lands — `checkout` on a
  `pull_request` event takes the *merge*, identical to the branch tip in 36 of the last 39 merges. **Turn
  it off and `main` belongs in that trigger too.** README § *What the release pipeline costs*.
- **The Chromium cache is warmed on `main` by `warm-cache.yml`, and that is the only place it
  works.** A cache written on a branch is restorable by that branch alone and is never visible to a
  sibling — measured: a second run of the same branch hits (install-deps only, 14s),
  a *fresh* branch misses (full install, 21–27s), so a new branch name always starts cold no matter how
  long branches live. **Worth ~6s against a ±12s run-to-run spread**, which is why it took three
  attempts to measure honestly → `test/workflow-pins.test.js` pins the two workflows to one key,
  because a mismatched key just misses and both stay green. **It also runs weekly**, because the push
  trigger watches three rarely-edited paths and so has no way back from a cache that has stopped
  existing — a leak nobody notices, since CI stays green and only gets slower.
- **`verify` is not optional after a UI change** — it renders the real page at 390/768/1440/1920px
  and catches what a screenshot cannot: a map with every node at one point is valid SVG and an
  empty panel.
- **Skip `verify` when the diff is docs only.** "Docs only" = every changed path is `*.md`; one
  `.js`, `.css`, `.html`, `.yml` or fixture, comment-only included, and it is not. Test:
  `git diff --name-only origin/main... | grep -v '\.md$'` is empty. If in doubt, run it.
- **Don't sleep waiting for CI.** Runs took 102–112s as one job and now land at **84s** median
  (78–87s); sleeping 190–240s wasted 12.4 minutes over six PRs, and a shorter run makes that worse.
  Poll at ~80s. **Time it from the jobs, not the run** — a run's `updated_at` moves after its jobs
  finish, and read a flat 121s for three PRs whose jobs took 78/84/87s.
- **A `README §` or `CLAUDE.md, "…"` pointer must name a heading that exists** →
  `test/doc-pointers.test.js`. Renaming a section leaves every pointer at it reading as authoritative
  and going nowhere, which nothing looks wrong about — it happened inside `.githooks/pre-push`'s error
  message, the one moment somebody is actually following the pointer.
- **Read a test summary from the END of the output, never the start.** `node --test` emits a TAP block
  per file *and* one for the run, so `grep '^# pass' | head` can report a passing *file* while the run
  failed. That is how a red commit was pushed with a passing count in its message — CI caught it, the
  local check did not. `tail -4`, or just trust the exit code.
- **Never state a suite count in this file** — one was, wrong by 17 inside a fortnight, and
  nothing watched it → `test/check-readme-numbers.test.js` rejects a bare `<number> tests` here.

## Layout of the code

Every module is an IIFE exporting `module.exports` under Node and a named global in a browser, so
logic is unit-testable without a DOM.

| File | Global | Owns |
|---|---|---|
| `parser.js` | `DeckParser` | decklist text, Moxfield/Arena/MTGO exports, deck URLs |
| `result-tiers.js` | `ResultTiers` | the tier inventory — data, no logic |
| `combos.js` | `DeckCombos` | matching, suggestions, slots, bracket, `standInRows()`, `decode()` |
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
| `render-suggestions.js` | `RenderSuggestions` | *Combos in your deck* (a row per card), suggestions, unofficial |
| `render-map.js` | `RenderMap` | the map's drawing half |
| `deck-io.js` | `DeckIO` | the decklist, the share link, the dropped file |
| `app.js` | — | wiring, the search, bracket and legality lines |
| `sw.js` | `ServiceWorkerShell` | network-first HTML, cache-first for stamped URLs only |
| `tiers-page.js` | — | the DOM of `tiers.html` |
| `research-log.js` | — | **not page data.** Swept cards, what each pass found, the text it read |
| `tools/scryfall-bulk.js` | — | picking a bulk file and streaming cards out of it — no cache logic |
| `tools/sweep-impact.js` | — | which of a sweep's changes land on a card this repo cites |

- `research-log.js` breaks that shape — never loaded by a browser, so plain CommonJS, linted with
  the tools → `test/lint-config.test.js` fails if a script matches no lint block.
- `search-worker.js` `importScripts` result-tiers → combos → unofficial → search, **in that
  order** (each reads the previous at load time). Not `parser.js`, not `graph.js`.
- `tiers.html` loads `combos.js` for one function, `DeckCombos.decode()`.
- `templates.json` is generated and checked in. `combos.json` is built by CI on the `data` branch
  — **never commit it.** `steps/` ships beside it: one file per combo, 256 buckets, gitignored.

## Researching a card, and recording that you did

> ### Read the oracle text. Every card. Before reasoning about any of it.
>
> **Not "recall it". Not "it's obviously". Fetch it and paste it into the log.** A wrong rule-out
> produces no row, no test failure and no complaint — only a card that looks well-covered.
> Cheapest mistake here, most expensive to find, and recollection is how it happens every time.
> Twice in the session that wrote this rule: Chatterfang reasoned about as a `{2}{B}{G}` Fox Rogue
> with a `-X/-X` outlet (he is a `{2}{G}` Squirrel Warrior, `+X/-X`), and **all 37** Camellia /
> Experimental Confectioner candidates thrown out on "Food against Squirrel" when both trigger on
> *sacrificing a Food* — the real difference rules out **2**. The second passed review and shipped.
>
> **`research-log.js` will not accept a pass without the text**: every card in `cards` needs a
> verbatim entry in `read` → `test/research-log.test.js`. An instruction to work from card text was
> already here and was not enough.
>
> **Sources, in order** — `tools/lookup-card.js` walks all three and says which answered:
>
> 1. **`card-text.json`** answers, and in practice that is the end of it. It holds **every** card
>    — `c.count` is the live number — so 2 and 3 below are the exception now rather than the
>    fallback, and **a pass should expect to read its cards with no network at all.** Check
>    coverage before assuming otherwise: `node -e "console.log(require('./card-text.json').count)"`.
>    **Never hand-write into it** — only the workflow does, or it becomes the unverified
>    recollection this rule exists to stop, wearing authority.
>
>    A miss means a card published since the last sweep, not a reason to reach for the network.
>    Re-sweep: dispatch *Cache card text* **from a branch** with `sweep` ticked — one request for
>    every card, ~4 seconds. Names are still right for two or three cards; the per-name path is
>    ~40 minutes across the whole space and dies against the timeout. **It commits to the branch
>    you dispatch it on**, and dispatched on `main` it commits to `card-text/run-<n>` and prints a
>    PR link — which nothing opens, so dispatch from a branch. It used to *refuse* a dispatch from
>    `main` and two hours went on reading a red X as a broken workflow. A dispatch that changes
>    anything also reports which cited cards moved → `tools/sweep-impact.js`.
> 2. **Scryfall live** — 403s at CONNECT here; fine on a runner.
> 3. **Forge card scripts** on `raw.githubusercontent.com`, banner-marked as Forge's wording, not
>    Scryfall's: no colour identity, legalities or printings. **Cross-check anything the reasoning
>    turns on against XMage.** README § *Reading a card when Scryfall is unreachable*.
>
> WebSearch and a card the user pastes are fine. Published Spellbook steps corroborate what a loop
> *does* but are not oracle text and do not satisfy this rule.

- **A sweep only writes what moved, and that is load-bearing.** The per-entry date in
  `card-text.json` says when a wording last *changed*; the file-level `generated` says when
  everything was last confirmed. Conflate them and a re-sweep rewrites all ~30,000 dates as one
  unreadable diff, which is the property the file's normalisation exists to protect. So **a sweep's
  diff is the errata report** — a card listed there may sit under a row in `unofficial.js` or a
  rule-out in `research-log.js`, and nothing else here would notice. → `test/card-text-merge.test.js`.
- **The cache covers every card, and a pass should never need the network.** 34,422 cards, 13.9 MB, swept
  in 4s. All 178 names across `unofficial.js` and `research-log.js` resolve from it →
  `test/card-text-merge.test.js` fails if one does not, and the fix is a sweep rather than an exception.
- **A card is found by `oracleId`, then by name.** Names are not stable identifiers and every
  citation is a name, so a rename used to land as an add plus an `absent` — the same shape as a new
  card plus a retired one — leaving the citations pointing at a name the cache no longer answered
  for. It is reported as a rename now. `sameReading()` compares **wording only**: date, name and id
  are all stripped, because whether two entries are the same *card* is `merge()`'s business and it
  has already decided before asking.
- **A short sweep fails rather than shrinking the cache** (`SWEEP_FLOOR`). A truncated download or a
  moved field otherwise exits 0 having thrown the file away, and "it worked, 40 cards" reads exactly
  like "it worked". Cards a sweep does not see are **kept and reported, never deleted** — a rename
  wants a person.

`research-log.js` is the index of what has been swept. **Read it before a deep dive, add to it
after.** A pass not in it did not happen as far as anyone can tell — "nothing remains open" was
once written under an audit of 44 candidates and read as a statement about 103,737 combos.

```bash
node tools/substitution-scope.js            # top = size of the space, bottom = the work queue
node tools/substitution-scope.js 0.8 3      # looser bar, more candidates
node tools/deck-cards.js deck.txt --unswept # the same question asked of one deck
```

**The pass, ordered to avoid wasted reading.** `/deck-deep-dive` runs it against `deck-cards.js`,
which ranks a deck's cards by how many published combos name them — what substitution consumes.

**The ordering survives the cache, for a different reason than it was written for.** It existed
because every card read cost a workflow round trip, and that cost is gone — the cache holds all of
them and `lookup-card.js` needs no network. What has not changed is that **reading is the cheap half
and deciding what to read is the expensive one**: step 1 ruled out 1,197 of 1,202 candidates, and no
amount of free lookups substitutes for getting that judgement right. Read more freely now; do not
skip the narrowing.

1. **Find the true peers from card text, not from a score.** Peers do the same job in a loop; a
   high score only says they fill the same slot *somewhere*. Stridehangar Automaton scored as
   Chatterfang's closest peer and is not one — it reads only *artifact* tokens — which ruled out
   1,197 of his 1,202 candidates.
2. Take every shape a peer is published in and the subject is not.
3. **Drop the subsumed** — if the subject already has a combo whose cards are a subset, the
   candidate is a strict superset and Spellbook does not publish those.
4. Drop what is already published, and what is already a row.
5. **Read the survivors against the cards** — the peer version's published steps are the best
   evidence, since they say what the loop actually does.
6. **Write the rows** citing the peer combo, and **log the pass with its rule-outs.** The
   rule-outs are the valuable part: the README's oldest audit is more useful for the 35 it ruled
   out than for what survived.

`verified` = somebody read both cards. `derived` = both halves are published and the pairing was
reasoned. **Use `derived` rather than reading loosely and claiming `verified`.**

### Asking the question of one deck

| question | what answers it |
|---|---|
| which existing rows can this deck assemble? | `matchUnofficial()`, pinned in `test/unofficial.test.js`. **`try-deck.js` does not cover the unofficial panel.** |
| which of this deck's cards are worth sweeping? | `tools/deck-cards.js --unswept`, then `/deck-deep-dive` |
| which gaps does *this deck* expose? | `tools/deck-gaps.js` |

Rows 2 and 3 differ: `deck-cards.js` picks *subjects* and sweeps each across the whole database;
`deck-gaps.js` also bounds candidate shapes to cards the deck holds, so every hit is castable
tonight. It drops rule-outs recorded as `sets` and prints what it dropped.

**`deck-gaps.js` checks a candidate against `COMBOS` *and* against what a stand-in rule draws
for that deck.** Only the first half existed until 7 Aug 2026, and on a deck holding Elas
il-Kor it offered **6 of 34** shapes as unwritten gaps while the browser was rendering every
one of them — a wrong answer that reads as work to do rather than work already done, and it
survived a whole reading pass before anyone asked the page → `test/deck-gaps.test.js`.

**`sets` is always a subset of its reason.** Most rule-outs are categorical ("the loop needs a
*token* out of the sacrifice") and enumerate no cards, so `ruledOutSets()` answers *has this been
ruled out?* with **yes** or **nothing recorded** — never with *no*. A surviving candidate means
nothing machine-readable was recorded, not that nobody decided. Still read the log.

### The two fixture decks

| deck | for |
|---|---|
| `test/fixtures/deck.txt` | the tuning deck — what `try-deck.js` and `verify-layout.js` default to, and where the README's measurements are taken |
| `test/fixtures/chatterfang-deck.txt` | **the standing deck for `unofficial.js`** — 103 maindeck cards plus a sideboard that must stay ignored |

Use the Chatterfang deck whenever a change touches `unofficial.js`. `test/unofficial.test.js` pins
the **exact rows** it unlocks — a list, not a count, since a count moves when a row is added and
says nothing about which, so **a diff there is a prompt to read the list, not a failure.** The same
test holds those rows to being *one card away* from this deck, catching a row that matches too
loosely.

## Things that will bite you

### Tests, and what a tool says about itself

- **The DOM files are not unit-tested, by design** — `app.js`, `tiers-page.js`, `page-dom.js` and
  the four `render-*.js` belong to `verify` and `test:ui`. Anything that could make the page look
  right and say something false — a count, a pluralisation, a bracket's reasoning — is a decision
  and belongs in `view-model.js`.
- **A tool's own summary is unwatched too, and gets believed once.** `deck-cards.js --unswept`
  summarised already-filtered rows: *0 of 33* swept where the log held **27 of 60**. → count
  before you filter, and put the decision in an exported function (`sweepStatus()`,
  `skippedLines()`) → `test/deck-tools.test.js`.
  README § *What a tool says about itself is not exempt*.
- **Shell inside a workflow's `run:` block is the only code here nothing can test**, so a
  decision must not live there. Exercising it means dispatching the workflow, and exercising a
  path that only fires on the default branch means merging the workflow to the default branch
  *first* — a round trip per attempt, which is why one wrong `if` in *Cache card text* survived
  as long as it did. The decision goes in a tool and the `run:` block calls it →
  `tools/cache-target-branch.js`, `test/cache-target-branch.test.js` covers both paths in
  milliseconds. **Patching that YAML also deleted `setup-node` once** and the step needed
  `node`: read back the parsed step list, not the diff.
- **`HARNESS` in `verify-layout.js` is a template literal**, so a regex loses its backslashes:
  `/\d+ combos/` becomes `/d+ combos/` and matches nothing, which passes → write `\\d`. **A
  backtick anywhere in it, comments included, ends the literal** — ~1,500 lines from
  `const HARNESS =` to past `runOne()`.
- **Never pin a check to "the first row"** — `.combo:first-child` reddened three checks about tier
  order, the fold and colours when the panel was reordered. Ask by the shape the check needs (`:not(:has(> h3 .either))`, "a row
  with a `.tier-win` chip") **and scope both halves of the assertion to that row**: one a11y test
  pressed one row's control and read another's panel.
- **Assert what a reader sees, not `textContent`** — the official/unofficial split is in the DOM
  twice, `17+7` narrow and `17 official · 7 unofficial` wide. → `visibleTextIn()`.
- **`boundingBox()` coordinates do not scroll** → `locator.click({ position })`.
- **A check nobody has seen fail is a check nobody has seen work.** Break every new one on purpose
  and watch it go red; every entry above once passed while measuring nothing.

### Data shapes

- **A combo has two shapes, and the ordering code sees the wrong one if you let it.** Compact rows
  carry `c` (strings), `expand()`ed rows carry `uses` (objects), and **sorting happens before
  expansion, rendering after.** `variantCardNames()` handles both; when it did not, compact-row
  callers got an empty list — which no ordering rule objects to — and the unofficial panel shipped
  in file order. **Never work around the shape at a call site; fix the contract.**
  README § *The unofficial panel was sorted on nothing at all*.
- **Anything loading `combos.json` must call `DeckCombos.decode()`** right after the parse: the
  payload interns `c`/`p` into `names`/`results` and rebuilds most ids from `cardIds`. A no-op
  without those tables, so fixtures work; harnesses serve through `asPublished()`, so a missed
  decode fails in CI rather than in production.
- **Never let the permalink path guess.** The fetcher drops a row's `id` only after rebuilding it
  and checking it matches — a link that works and shows a different combo is invisible to every
  test we run.
- **The steps tree has no manifest, so CI computes one.** The id *is* the URL and a 404 reads as
  "none recorded", which is also why a wrong tree is invisible: the reader is told there are no
  steps and believes it. → `tools/check-snapshot.js --steps`, against `StepsSource.pathFor()`.
- **The database is indexed, not walked.** `matchDeck()` and `standInRows()` go through
  `candidateCombos()`, which reads a card → combo-positions index kept on the combos array in a
  `WeakMap` — `matchDeck` 71.1ms → 5.4ms and `standInRows` 78.4ms → 10.2ms on the standing deck, identical
  output, verified against the pre-index code over 32 decks. **Four traps, each with a test**: candidates
  must be re-sorted into **database order** or the stable sorts downstream break ties differently and the
  page reorders (42% of combos have no `pop`, so ties are the common case); the index stores **one posting
  per occurrence**, because the old walk counted a *name* it could not find and counting distinct cards is
  a silent behaviour change; a combo naming ≤1 card can never be reached through a deck card, so the 7 of
  them are carried separately; and the postings are **one flat `Int32Array`**, because a `Map` of small
  arrays cost **6.3 MB of worker heap against 2.0 MB** — which is what makes the build read the database
  **twice**, so the pass counter in `test/unofficial.test.js` says two. Nothing in the *results* says which
  walk ran → `test/scan-index.test.js` pins the count examined. README § *The database is indexed once,
  not walked on every search*.
- **Load order is load-bearing** — `combos.js` reads the tier inventory at load time, `search.js`
  reads `combos.js`. A new script goes into `index.html` **and** `search-worker.js`.

### Layout and CSS

- **`groupVariants()` / `COLLAPSE_FROM = 4` draw nothing on the page any more.** The `any of N` fold
  belonged to the panel that listed every combo as its own row, and that panel is gone: *Combos in your
  deck* is one row per card. The only caller left is `tools/try-deck.js`, which groups a deck's combos into
  families as a text summary. Tests read the exported constant, exactly one pinning it.
- **The 149-of-233 measurement that justified the fold does not transfer, and comes back with the panel.**
  It counted rows repeating a block of chips *side by side in one panel*; combos are now written out under
  the card that carries them, behind a disclosure. If a list of combo rows ever returns, so does the
  figure. README § *The fold was taken out twice*.
- **A combo row only renders inside a card's disclosure**, so `verify` opens every one before it measures
  anything — every rect inside a closed `<details>` is 0, and the heading, chip, pill and divider checks
  all pass against boxes the browser never laid out.
- **A row's own column is the disclosure, not the panel body** — 450px of a 689px body at 768px, because
  `.combo.suggestion > details` is a nested `rows` container. The row's *gutter* still answers the panel
  body, so the two are measured separately → `headingShape.column` vs `numberColumns[].column`.
- **A count beside a panel heading may not count the panel's rows.** *Combos in your deck* is headed with a
  combo count and lists *cards*, so the two disagree by design and the panel has to say so →
  `DeckView.deckCombosNote()`, and `verify` checks the badge against the distinct combos the panel reaches.
- **Row layout keys on the row's own column, not the viewport, and the two disagree** — 704px at a
  768px window but **442px at 900px**, where the shell hands 370px to the decklist, so
  `min-width: 900px` styles the narrower case as though it were roomier. → `@container rows (min-width: …)`
  on the two panel bodies. Thresholds are measured against what they cost the card
  name, never matched to each other: the split spells itself out at 560px of column, the links join
  the name at 750px. `verify` prints the column width per viewport.
- **The line down a suggestion row is many `border-left`s** — one per block in the card's column
  (`.row-main`, `.alternatives`, the disclosure), each reaching back over `--col-gap` with a
  negative margin. So spacing inside them is padding never margin, and **a new block there must
  carry its own piece** or the line stops at it. **The gutter draws none of it** and spans the rows
  rather than sizing one; `verify` fails if a `border-right` reappears, since a second line at the
  same x is invisible and undoes the whole thing. README § *Where the second number goes*.
- **A translucent fill is a contrast bug waiting for a background to move.** The result chips were a
  10%-alpha tint; on `--panel` that measured 4.97:1 in the light theme and on the `--panel-2` a nested
  combo sits on, 4.19:1 — a fail. They are flat `--win-fill` / `--decisive-fill` tokens now, the same
  colour wherever the chip lands → `e2e/a11y.spec.js`, which had never opened one of those disclosures.
- **`opacity` is not a way to make a colour quieter** — it applies after the colour is chosen and
  spends an already-allocated contrast budget invisibly; three of four rules that did it were
  hundredths under AA. `--faint` is the token for text below `--muted`, **only safe on `--bg`** →
  `e2e/a11y.spec.js`.
- **The mana pips are drawn, not fetched, and they are ours rather than Wizards'.** Inline SVG in
  `render-rows.js`, `currentColor`-filled, one glyph per colour — the CSP allows no remote image or font,
  and the printed symbols are somebody else's artwork. The letter lives in `data-colour` now, which is
  what checks read: `pip.textContent` is empty and compares clean against another empty string →
  `verify` also measures the glyph's box, because `display: none` on it leaves every other pip assertion
  passing over five blank circles. README § *The mana symbols are drawn here, and they are not Wizards' art*.
- **Both HTML files carry a CSP** (`default-src 'none'`, `script-src 'self'`): no inline scripts,
  no CDN, no remote fonts or icons. `connect-src` is `raw.githubusercontent.com` and Archidekt.

### Assets, offline, and the footer

- **The deploy stamps `?v=<sha>` onto asset URLs** via `tools/stamp-assets.js`, which reads what
  each page references rather than a list and fails the deploy on anything left bare — because **an
  unstamped URL resolves fine and serves whatever the CDN cached, so the bug is invisible outside
  production** (`unofficial.js`, `graph.js` and long-term `theme.js` all shipped it). The worker is
  not in the HTML and stamps its own imports from its query string. The same run writes `sw.js`'s
  precache list (`--worker sw.js`), so the shell cannot drift from what the pages ask for, and
  **`sw.js` is cache-first only for stamped URLs** since local work, `verify` and `test:ui` all
  serve unstamped. `verify-layout.js` builds its stamped fixture from the same `rewriteAssets()`.
- **The artifact is pruned to what the site serves**, as the last step before the upload —
  `tools/prune-artifact.js --apply`. `path: .` had been publishing the whole checkout: 17.5 MB of an
  18.5 MB artifact against a site of 1.06 MB, `card-text.json` alone being 16.5 MB. **Not a speed
  fix — `upload-pages-artifact` measured 2s and 3s inside jobs of 238s and 17s**, and saying otherwise
  is how a correctness change gets reverted for not paying. What survives is **computed from what the
  pages reference**, sharing `localAssets()` with the stamping, and the runtime-only files come from
  `sw.js`'s `NOT_IN_THE_HTML` so there is one list rather than two. It runs last because it deletes
  `tools/`. README § *The artifact carries the site and nothing else*.
- **The footer says which build and when** — `Build <sha> · deployed <YYYY-MM-DD HH:MM:SS UTC>`,
  both pages, one step, one `grep -q` guard per marker. Anything measuring that line must
  substitute the **deployed** string: unstamped it is 20 characters shorter, so measuring what a
  test serves passes a footer that overflows only in production (`DEPLOYED_BUILD_LINE`).
  README § *The footer says which build it is and when that build arrived*.

### The unofficial panel

- **Its rows are never counted as published data** — out of the combo count and the bracket check,
  each naming the published combo it came from → `test/unofficial.test.js`.
  README § *What each row has to carry*.
- **Ours and Spellbook's share one order** in the suggestions and pieces panels, so the `unofficial`
  pin — before the confidence pin — is what marks a row as ours. It is drawn on every such row and
  never behind a flag, because a missing pin in a merged list credits our work to Spellbook and
  nothing on screen would say otherwise. Counts stay apart (`+3 official · +1 unofficial`).
- **Rows leave only by graduation, noticed by the nightly job**, which fails on a broken citation
  and maintains a standing issue itself. **Don't hand-edit that issue** — `npm run verify:unofficial`
  is the live answer. README § *They graduate rather than accumulate*.
- **Watch `unofficial.js`'s gzipped size, not its row count** — `gzip -9 -c unofficial.js | wc -c`.
  **At 200 KB gzipped, `COMBOS` moves to the `data` branch as JSON**; one four-card sweep put on
  14 KB, so headroom is a dozen passes, not a hundred. It is never parsed on the main thread — only
  `search-worker.js` imports it — so it delays the first search, not first paint, which is what the
  threshold rests on. README § *What the file costs, and the size at which it stops being source*.
- **README counts are real measurements**: adding rows moves the prose → `check:readme`, which also
  fails on a reworded anchor, since a check matching nothing reports success for work it did not do.

### Network, and this sandbox

- **The proxy 403s at CONNECT** for every Scryfall host, mtgjson, gatherer and the Spellbook API;
  `raw.githubusercontent.com` is allowed. **A blocked host and a typo are identical from inside a
  tool** — `lookup-card.js` says "check the spelling" only when Scryfall was reachable enough to
  say the name is unknown → `test/lookup-card.test.js`.
- **`raw.githubusercontent.com` gzips almost everything, so byte ranges lie.** 24 of 25 probed
  extensions serve as `text/plain` and Fastly compresses them, so a `Range` gets those bytes *of
  the gzip stream* and a 100 KB file reports a total size of 133. `Accept-Encoding` is forbidden to
  `fetch()`. Only `.zip` was honest. Any design wanting a slice of a file starts there.
- **Don't page Spellbook's `/variants` API** — cumulative quota; stream the bulk export.
  README § *Use the bulk export, never the paged API*.
- **Never assume a deck site's CORS behaviour** — Moxfield is unsupported because somebody did.
  `tools/probe-cors.js` asks for the one deciding header with the deployed page's Origin, carrying
  two controls so a broken run cannot be mistaken for a refusal. **It must run on a runner**: a
  proxy 403 here is indistinguishable from a refusal, and `curl` does not enforce CORS.
- **Archidekt may already be unreadable and nobody has confirmed it.** On 2 Aug 2026 the control
  failed: they answer non-Archidekt origins with `http://localhost:3000`, so the live page discards
  the response, while `SITES.archidekt` still says `browserImport: true`. Settle it by pasting an
  Archidekt URL into the live page. README § *Archidekt may no longer be readable either*.

## Conventions

- Comments explain *why*, not what. Removing a reason without replacing it reads as a regression.
- **No dependencies.** ESLint and Playwright are fetched per run; a `node_modules` here would be
  the first. No style rules in the lint config either — match the surrounding code.
- Trunk-based: a branch off `main`, PR, auto-merge when green. Merging to `main` *is* the release.
  **What is load-bearing is that a branch is restarted from `main`, not that its name is new** —
  every branch here is a harness-assigned `claude/<topic>-<suffix>` and they get **reused**:
  `claude/release-process-breakdown-qupy5t` carried **11 PRs (#161–#173) over 4.5 hours** while each
  individual PR lived about two minutes. What that name must never accumulate is divergence, which the
  restart below handles. (This bullet said `feat/…` / `fix/…` until 5 Aug 2026, and **0 of the last 40
  branches** had ever used either — a convention describing nothing, next to a rule it made sound like
  it was about naming.)
- **Batch a session's small changes into one PR.** Every merge is a release: 52 merges in three days,
  and on 5 Aug alone **22 CI runs, 34.6 minutes of runner time and 14 deploys**. #170–#173 were four
  PRs in 50 minutes all editing `README.md`/`CLAUDE.md`, and #173 spent a 95s CI run plus a full
  production deploy on **17 lines of one file**. Nothing is gained by splitting them: with 0 required
  approvals the PR reviews nothing, it is the only way through the ruleset. Open one per *piece of
  work*, not per commit. **The exception is a change you want bisectable** — a behaviour change that
  could need reverting on its own is worth its own PR at the same price.
- **A ruleset refuses direct pushes to `main`**: PR required, `checks` green, **branches up to date**,
  no force-push, no deletion. **Repository admin is in the bypass list as of 6 Aug 2026, and that is what
  makes a merge from an agent session possible at all** — see the paragraph after this list. It does not
  help anything *automated*: **GitHub Actions is not an available bypass actor** — the list offers Deploy
  keys, Repository admin, Maintain, Write and installed Apps, nothing for `github-actions[bot]`. And **a PR opened with
  `GITHUB_TOKEN` does not trigger workflows**, so an auto-opened PR never runs `checks` and is
  unmergeable rather than auto-merging. An unattended job that wants to land on `main` therefore needs
  a stored credential — a write deploy key or a PAT — which is a decision about a long-lived secret,
  not a config line. A weekly card-text sweep was tried and removed over exactly this. Two omissions are deliberate and read as oversights — linear history
  would forbid the merge commits `main` already uses, and any required-approval count above zero makes
  every PR unmergeable on a solo repo. **A ruleset for `data` must not block force-pushes**:
  `update-data.yml` force-pushes it nightly.
- **Only a `pull_request`-event run satisfies the required check, so a session that cannot make GitHub
  fire one cannot merge — no matter how green the suite is.** #187 sat blocked with `checks`, `static`
  and `browser` all success on the exact head SHA, because they came from a `workflow_dispatch`: GitHub
  answers `Required status check "checks" is expected` and there are **no bypass actors**, so nobody can
  click past it either. **A dispatch is not the recovery and neither is closing and reopening the PR** —
  both were tried on #187 and neither produced a run → the comment on `workflow_dispatch` in `ci.yml`
  says so now. The only remedy is a new commit on the branch, which fires `synchronize`.
  **And that too depends on GitHub being healthy**: on 6 Aug 2026 nothing this session pushed fired an
  event after 15:10 UTC, Pages deployments had been timing out in their own queue since 12:11, and
  dispatched jobs were being cancelled while queued. Three symptoms, one outage, and none of them worth
  a workaround — the work waits.
- **The bypass exists because a required check is only credited from the PR's own event, and nothing
  here can make GitHub send one.** #187 was unmergeable for two hours with `checks`, `static` and
  `browser` green on its exact head SHA. With **Repository admin** in the bypass list,
  `mcp__github__merge_pull_request` merged it in one call — so the release path no longer depends on a
  webhook. **The gate is now a rule I keep rather than one the repository enforces on me:** never merge
  without a completed, green run on the exact head SHA — dispatch one if events are slow, since a
  dispatched run is perfectly readable even though the ruleset will not count it.
- **The API cannot verify that bypass, and said the opposite.** `/rulesets/20465218` answered
  `bypass_actors: null` and `current_user_can_bypass: "never"`, and the merge attempted immediately
  afterwards succeeded. `/repos/{owner}/{repo}` also reports this session with **no permissions at all**
  (`admin: false, push: false`) while its calls are attributed to `PaludaNCode`. So: **`null` here means
  "you cannot see it", never "it is empty", and `current_user_can_bypass` is not a second opinion —
  it was wrong about the caller asking it.** The only proof is attempting the operation →
  `tools/check-branch-rules.js` reports this claim UNKNOWN and says why, which is the honest answer
  rather than a passing check.
- **Never assume that ruleset is in force. On 5 Aug 2026 it did not exist at all**, while this file, the
  README and a session's reasoning all said it did — and **a missing gate is indistinguishable from a
  working one**, since PRs merge and CI goes green either way. It exists again as of 15:34 UTC that day
  (ruleset 20465218, `~DEFAULT_BRANCH`, enforcement active), which means **#1–#160 merged ungated** and
  nothing about them says so. No test here can reach it (`metadata=read` →
  `/branches/main/protection` is 403), so → **`node tools/check-branch-rules.js`**, which reads
  `/rules/branches/main` and the repo settings anonymously and checks every claim this file makes
  against them. It cannot run live from this sandbox (`api.github.com` is off the proxy allowlist and
  `fetch()` ignores `HTTPS_PROXY`) — dispatch *Check the branch rules are real*, or replay the
  fixture. **A runner can only answer ten of the thirteen.** The three repository settings — merge
  methods, auto-merge, branch retention — come back **only to a caller with push access**, and
  Actions has no repository-administration permission, so `github.token` sees what an anonymous
  caller sees. They read UNKNOWN there; to check them, replay a fixture recorded from a session
  (**every request from this sandbox is authenticated — the proxy injects a credential, and
  `/rate_limit` says 5,000 an hour, not the anonymous 60**) or set `GITHUB_API_TOKEN` to a PAT.
  **Absent is not false and not empty** — a setting the response does not carry is UNKNOWN →
  `test/branch-rules.test.js`. Its first live run called three of them FALSE, one being auto-merge
  four minutes after auto-merge merged the PR that added the tool; **the token was then blamed for
  it twice and was never the cause.**
- **Merge-only is locked twice, as of 6 Aug 2026**: `allowed_merge_methods` on the ruleset is
  `["merge"]`, and squash and rebase are off as *repository* settings. That invariant — `main`'s tip
  is always a descendant of the PR head — is what the whole *designated branch* section and
  `.githooks/pre-push` rest on, and it spent its first 173 PRs held by one repository checkbox with
  nothing else watching (`check-branch-rules.js` called that **FRAGILE**). **The pin is what makes it
  checkable**: the effective set is an intersection, so no repository field can widen it back, and
  the claim is now answerable by a caller with no push access — which is to say by the runner, rather
  than by somebody opening a settings page.
- **Up to date costs a click when it bites**: auto-merge does not update a stale branch, so a PR whose base
  moved waits for **Update branch**, which re-runs CI. *Always suggest updating pull request branches*
  is off, so nothing volunteers the button — with strict checks on it appears anyway once the PR is
  behind. Serialisation is the real price and it is invisible on a solo repo: every merge makes every
  other open PR stale, so two concurrent streams would each pay a re-run per merge. Batching is what
  keeps that theoretical.
- **Push protection is on.** A push carrying anything credential-shaped is rejected outright — if
  it fails on a fixture, comment or test where you were only quoting a token *shape*, that is why.
- **The `data` branch is a build artifact.** Never branch from it or PR into it.
- **Outstanding work is a GitHub issue and nothing else.** No backlog file, on purpose: a document
  that reads as a queue and is not one costs more than it says.

### Reporting what you did

**Check it yourself, then say what you checked.** A claim with a command behind it beats a
confident sentence, and most rules in this file exist because something untested read as fine.

**Never confirm a deploy from the Actions API** — `actions_list` returns ~395 KB a call, and
**scoping it does not save you**: one workflow with `per_page: 3` still came back 136 KB and had to
be read off disk with `python3 -c` instead. Name the SHA that went out and point at the footer:
deploys are asynchronous and do not need waiting on. To ask *why a run failed*, go straight to
`get_job_logs` with the job id — `failed_only` plus a `run_id` works too, and `tail_lines` under a
few hundred returns the cleanup epilogue rather than the failure.

**And you cannot read the footer from here.** `paludancode.github.io` is 403 at CONNECT like every
other blocked host — `raw.githubusercontent.com` is the only one allowed — and the deploy publishes
through `actions/deploy-pages`, an artifact, so there is no branch to read it off either. That left
the Actions API as the only signal available in a sandbox, which is why this rule kept being broken.

**The deploy checks it for you now.** Its last step reads the live page from the runner, which can
reach it, and fails if the CDN never serves the SHA it just stamped into the footer — twelve tries,
10s apart. So "the deploy job is green" now means what reading the footer used to mean, and is the
one case where the job's conclusion is enough. It was not before: `deploy-pages` succeeding means
the artifact was accepted, not that anyone is being served it.

**A failed deploy burns its commit, and the same commit can never be deployed again.** The Pages
deployment id **is** the commit SHA, so when `deploy-pages` gives up — its own timeout is 10 minutes —
it cancels that deployment, and every later attempt on that SHA fails in about five seconds with
`Deployment cancelled` rather than queueing. **Re-dispatching is therefore not the recovery; a new
commit on `main` is**, which on this repository means a PR, so give it something worth committing.
Two adjacent traps, both met on 6 Aug 2026 (five failed deploys, `d4220ad` and `02773c8` both burnt):
**`rerun_failed_jobs` is never the recovery either** — the re-run uploads a *second* artifact named
`github-pages` into the same run and `deploy-pages` refuses with `Multiple artifacts … count is 2`;
and a run stuck in `deployment_queued` is **GitHub's queue, not this repository** — every step before
it succeeds, so read the poll lines rather than the conclusion before changing anything here.
README § *Deploying*.

**Report the feature, not the code.** What changed for someone using the page, in the words
on screen — panel names, chip labels, button text — with a number they can check rather than
an adjective. Files and functions when the question is *where does this live*; never a diff
pasted into chat, because the commit is the diff. `.claude/output-styles/terse.md` is that
rule as an output style, on by default via `.claude/settings.json`, and it names the four
things terseness does **not** reach: code comments, the README, commit bodies, and any
caveat that changes what somebody would do.

**A closing report, in order:** what changed and where the reasoning lives (a `README §`, an issue
number) · what was run and what it said, in real numbers rather than "tests pass" · what was
*proved* rather than assumed, meaning which check you broke on purpose to watch it fail · what to
look at, the SHA and the footer · what you skipped and why. **A check not run is not a check
passed**, and "CI is green" cannot stand in for one CI does not run: `checks` never runs the deploy
workflow.

### Merging back into `main`

**Compare against `origin/main`, never a local `main`.** A fresh sandbox's clone can carry a `main`
pointing at the project's original unsquashed history, sharing no recent ancestor with the remote —
one landed 148 commits stale with `git pull` refusing as divergent, and nothing was wrong with the
repository. So `git fetch origin main`, always. A remote-only `SessionStart` hook realigns it and
archives what it moved as `archive/main-<sha>`, but it skips silently when `origin` is unreachable
and will not move `main` while `main` is checked out, so the rule stands; if you meet the fossil,
`git reset --hard origin/main`. Anything else wanting to run at session start goes in
`.claude/hooks/session-start.sh`, which is latency on every session, so keep it git hygiene only.
README § *A fresh session's `main` is realigned before anything reads it*.

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

### Ask before merging. Every time.

**This is the only thing standing between a session and production now.** Until 6 Aug 2026 the ruleset
was also in the way — a merge needed a `checks` run the session could not conjure — and that was never a
safeguard, just friction that happened to point the right way. Repository admin is in the bypass list
now, so `merge_pull_request` succeeds on the first call whenever the caller decides to make it.

**Open the pull request, report it, and stop.** Enabling auto-merge is the user's call, not a step in
finishing the work, and "do X" never means "do X and ship it" — merging to `main` *is* the release, so
that is a decision about production rather than a formality.

It is written here because it was got wrong, repeatedly and in one afternoon. Two explicit instructions
— "squash it, then move to prod" and "do a couple of redeploys if needed" — became a standing habit, and
ten pull requests went to production, several of them on nothing firmer than "go ahead" said about the
*work*. Nothing broke, `checks` was green on all ten, and that is luck about the content rather than
anything about the process.

**This rule has no check behind it and cannot have one** — no test can ask whether a person agreed. By
the standard of every other rule in this file, that means it will eventually be broken again. The only
mitigation available is that shipping takes a deliberate act: `enable_pr_auto_merge` is never part of
"finish the task", so the failure needs a decision rather than a lapse.

### The designated branch after its PR merges

**Branches survive a merge** — *Automatically delete head branches* is off, deliberately, and that
setting is what makes this section short. Follow-up work restarts the branch from the default branch
rather than stacking on merged history:

```bash
git fetch origin main && git checkout -B <branch> origin/main && git push -u origin <branch>
```

**That is a fast-forward, so no force and no prune** — and it has no exception, because **squash and
rebase merging are off in both places that can allow them**: the repository settings, and the `main`
ruleset's `allowed_merge_methods` → `node tools/check-branch-rules.js`. `main`'s merge commit always
has the PR head as a parent, so a branch
restarted from `main` is always a *descendant* of what the remote has and always pushes cleanly. Six of
the last six merges check out that way.

Squash merging is what would break it: it produces no such parent, so the branch genuinely diverges and
needs a force-push. That was a documented exception until the setting was turned off, and turning it off
is what deleted the exception. **Two settings now carry this whole section** — keep merge commits, keep
branches.

**Why this used to be three paragraphs.** With auto-delete on, a merged PR left the name free and the
remote ref gone, so `--force-with-lease` failed `! [rejected] … (stale info)` — a lease against a ref
that no longer exists, which reads as a protection working and is nothing of the kind. The fix was
`fetch --prune` then a plain push, and the ritual had to be remembered on every follow-up. Two
checkboxes deleted the whole class of mistake and an exception with it. **Reach for a setting before
reaching for a rule** — a rule needs remembering, a setting does not.

**`.githooks/pre-push` still refuses that force-push**, and is kept rather than retired: the case is
rarer now (a genuinely new branch pushed with `--force`) but it costs nothing and it is the only rule
in this file I could not break. It was written because the paragraph above was written and then broken
an hour later with the text in context. `core.hooksPath` is set by `.claude/hooks/session-start.sh`.
**Prose is not a check** — every rule here that stuck has a `→` after it, and the ones that did not are
the ones that got broken.

**Never `git stash` to run a check while work is staged.** `--keep-index` stashes the working tree,
and the `pop` then conflicts with the index copy and leaves conflict markers inside the files that
were about to be committed — recovering means reading each one back out of `stash@{0}`. Copy to the
scratchpad instead; there is never a reason to move the work to look at it.

### Writing an issue here: point, do not restate

An issue that copies current state becomes a second source of truth, and the unchecked copy rots.
"16 cards are unread" is wrong the moment somebody reads one — the exact failure this repo spent a
day fixing, where prose said *nothing remains open* and the data said otherwise. So name **where
the live answer lives** and **what finishing looks like**:

> The live list is in `research-log.js` — do not restate it here. Grep for `UNREAD`.
> Finish condition: `UNREAD_DEBT` in `test/research-log.test.js` reaches 0.

Carry detail only where it exists nowhere else machine-readable — a design constraint, a specific
failing case, a decision somebody has to make. Never a count a file already holds and a test
already checks.
