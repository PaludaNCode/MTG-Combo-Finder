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
node tools/substitution-scope.js                  # how much of the space is unread
node tools/deck-cards.js [deck.txt] --unswept     # which cards carry a deck's combos
node tools/deck-gaps.js [deck.txt]                # which gaps THIS deck exposes
node tools/probe-cors.js [site]                   # can a browser read a deck from this site?
npx serve .                                       # any static file server works
```

- CI (`checks`): syntax → lint → `test:coverage` → `check:readme` → `verify` → `test:ui`.
- **`verify` is not optional after a UI change** — it renders the real page at 390/768/1440/1920px
  and catches what a screenshot cannot: a map with every node at one point is valid SVG and an
  empty panel.
- **Skip `verify` when the diff is docs only.** "Docs only" = every changed path is `*.md`; one
  `.js`, `.css`, `.html`, `.yml` or fixture, comment-only included, and it is not. Test:
  `git diff --name-only origin/main... | grep -v '\.md$'` is empty. If in doubt, run it.
- **Don't sleep waiting for CI.** Runs take 102–112s; sleeping 190–240s wasted 12.4 minutes over
  six PRs. Poll at ~110s.
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
> 1. **`card-text.json`**, the committed cache of Scryfall's wording, filled on a runner by the
>    *Cache card text* workflow. No request, so it works here. **If your cards are missing, run
>    that workflow first.** **Never hand-write into it** — only the workflow does, or it becomes
>    the unverified recollection this rule exists to stop, wearing authority.
> 2. **Scryfall live** — 403s at CONNECT here; fine on a runner.
> 3. **Forge card scripts** on `raw.githubusercontent.com`, banner-marked as Forge's wording, not
>    Scryfall's: no colour identity, legalities or printings. **Cross-check anything the reasoning
>    turns on against XMage.** README § *Reading a card when Scryfall is unreachable*.
>
> WebSearch and a card the user pastes are fine. Published Spellbook steps corroborate what a loop
> *does* but are not oracle text and do not satisfy this rule.

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
- **Load order is load-bearing** — `combos.js` reads the tier inventory at load time, `search.js`
  reads `combos.js`. A new script goes into `index.html` **and** `search-worker.js`.

### Layout and CSS

- **`COLLAPSE_FROM = 4`: pairs and triples of interchangeable cards do not collapse.** That is the
  rule, not a bug. `groupVariants()` counts the members still *free*, so a family cut below the
  threshold by a bigger one is written out too; **a fixture whose families are all smaller draws no
  collapsed row at all**, so `test/fixtures/dataset.js` carries enough versions and raising the
  number means adding one; tests read the exported constant, exactly one pinning it.
- **Do not remove the fold without answering the measurement**: **149 of the Chatterfang deck's 233
  rows** repeat a block of chips already on screen, because a family's versions produce identical
  results by construction. README § *The fold was taken out once, and put back*.
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
- **`opacity` is not a way to make a colour quieter** — it applies after the colour is chosen and
  spends an already-allocated contrast budget invisibly; three of four rules that did it were
  hundredths under AA. `--faint` is the token for text below `--muted`, **only safe on `--bg`** →
  `e2e/a11y.spec.js`.
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
- Trunk-based: short-lived `feat/…` / `fix/…` off `main`, PR, auto-merge when green. Merging to
  `main` *is* the release. **Short-lived is load-bearing** — see below.
- **A ruleset refuses direct pushes to `main`**: PR required, `checks` green, no force-push, no
  deletion. Two omissions are deliberate and read as oversights — linear history would forbid the
  merge commits `main` already uses, and any required-approval count above zero makes every PR
  unmergeable on a solo repo. **A ruleset for `data` must not block force-pushes**:
  `update-data.yml` force-pushes it nightly.
- **Push protection is on.** A push carrying anything credential-shaped is rejected outright — if
  it fails on a fixture, comment or test where you were only quoting a token *shape*, that is why.
- **The `data` branch is a build artifact.** Never branch from it or PR into it.
- **Outstanding work is a GitHub issue and nothing else.** No backlog file, on purpose: a document
  that reads as a queue and is not one costs more than it says.

### Reporting what you did

**Check it yourself, then say what you checked.** A claim with a command behind it beats a
confident sentence, and most rules in this file exist because something untested read as fine.

**Never confirm a deploy from the Actions API** — `actions_list` returns ~395 KB a call. Name the
SHA that went out and point at the footer: deploys are asynchronous and do not need waiting on.

**And you cannot read the footer from here.** `paludancode.github.io` is 403 at CONNECT like every
other blocked host — `raw.githubusercontent.com` is the only one allowed — and the deploy publishes
through `actions/deploy-pages`, an artifact, so there is no branch to read it off either. That left
the Actions API as the only signal available in a sandbox, which is why this rule kept being broken.

**The deploy checks it for you now.** Its last step reads the live page from the runner, which can
reach it, and fails if the CDN never serves the SHA it just stamped into the footer — twelve tries,
10s apart. So "the deploy job is green" now means what reading the footer used to mean, and is the
one case where the job's conclusion is enough. It was not before: `deploy-pages` succeeding means
the artifact was accepted, not that anyone is being served it.

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
