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
npm test                  # unit tests, node:test, zero deps — a couple of seconds
                          # No count here on purpose: it was wrong by 17 within a
                          # fortnight, and `check:readme` anchors on the README, so
                          # nothing was watching it. `npm test` prints the real one.
npm run test:coverage     # the same with the coverage floors CI enforces (Node 22.8+)
npm run lint              # ESLint, fetched for the run — no lint dependency installed
npm run verify            # layout smoke test — REQUIRED after any UI change
npm run test:ui           # Playwright browser tests + axe a11y (desktop + phone)
npm run verify:unofficial # every unofficial row still cites a real published combo
                          # --graduated out.json also lists the rows Spellbook now
                          # publishes, which is what the nightly job turns into an issue
npm run check:readme      # the README's countable numbers still match the files

node tools/fetch-combos.js out.json [steps/]   # add --no-steps to skip the 103,737 files
node tools/fetch-combos.js out.json --fixture test/fixtures/export.json
                          # the whole publisher over a canned export, no network.
                          # What test/fetch-combos-fixture.test.js runs, so `npm test`
                          # already covers it — this is for looking at the output.
node tools/try-deck.js [deck.txt]              # what would the page show for this deck?
node tools/combos-with.js "Card A" "Card B"    # why isn't this a combo?
node tools/template-users.js ["Persist Creature"]
node tools/lookup-card.js "Card name"          # oracle text: cache, else Scryfall, else Forge
node tools/cache-card-text.js "Card name"      # fetch it from Scryfall into card-text.json.
                          # Needs a runner — see the "Cache card text" workflow. Never
                          # hand-edit that file; the point is that it is not recollection.
node tools/substitution-scope.js               # how much of the substitution space is unread
node tools/deck-cards.js [deck.txt] --unswept  # which of a deck's cards carry its combos
node tools/deck-gaps.js [deck.txt]             # which gaps THIS deck exposes
node tools/probe-cors.js [site]                # can a browser read a deck from this site?

npx serve .               # run it locally; any static file server works
```

`npm run verify` is not optional after a UI change. It renders the real page at
390/768/1440/1920px and catches the class of breakage that is invisible in a
screenshot — a map with every node at one point is valid SVG and an empty panel.

CI (`checks`) runs: syntax check → lint → `test:coverage` → `check:readme` → `verify` →
`test:ui`.

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
| `page-dom.js` | `PageDom` | the DOM helpers, `setStatus`, and the collapsible `panel` |
| `render-rows.js` | `RenderRows` | the shared vocabulary every result row is built from |
| `render-combos.js` | `RenderCombos` | a combo as a row, and its steps disclosure |
| `render-suggestions.js` | `RenderSuggestions` | the suggestions, pieces, slots and unofficial panels |
| `render-map.js` | `RenderMap` | the combo map's drawing half — `graph.js` is its arithmetic |
| `deck-io.js` | `DeckIO` | keeping the decklist, the share link, the dropped file |
| `app.js` | — | wiring, the search, the bracket panel — what is left after the split |
| `tiers-page.js` | — | the DOM of `tiers.html` |
| `research-log.js` | — | **not page data.** Which cards have been swept, what each pass found, and the oracle text it read |

`research-log.js` is the one file that breaks the shape above: the browser never loads it,
so it is a plain CommonJS module and is linted with the tools rather than with the shipped
files. `test/lint-config.test.js` fails if a script matches no block, which is how that gets
noticed.

`search-worker.js` `importScripts` result-tiers → combos → unofficial → search,
in that order (each reads the previous at load time). It does **not** load
`parser.js` (the page parses before posting) or `graph.js` (drawn from the result).

## Researching a card, and recording that you did

> ### Read the oracle text. Every card. Before reasoning about any of it.
>
> **Not "recall it". Not "it's obviously". Fetch it and paste it into the log.**
>
> This rule exists because it was broken twice in the session that wrote it, and the
> second time survived review and got committed:
>
> - Chatterfang was reasoned about as `{2}{B}{G}`, a Fox Rogue, with a `-X/-X` outlet.
>   He is `{2}{G}`, a Squirrel Warrior, with `+X/-X`.
> - Camellia and Experimental Confectioner were ruled out — **all 37 candidates** — on
>   "they answer *a nontoken creature died* with different tokens, Food against
>   Squirrel". Both trigger on *sacrificing a Food*; Confectioner makes a **Rat**. The
>   real difference is that Camellia batches ("one or more Foods") where Confectioner
>   counts ("a Food"), which rules out **2** of the 37. Thirty-five were thrown away on
>   a card text nobody had looked at.
>
> A wrong rule-out is invisible. It produces no row, no test failure and no complaint —
> only a card that quietly looks well-covered. It is the single cheapest mistake to make
> here and the most expensive to find, and remembering a card is how it happens every
> time.
>
> **`research-log.js` will not accept a pass without the text.** Every card in `cards`
> needs a verbatim entry in `read`, and `test/research-log.test.js` fails without it.
> That is deliberate: an instruction was already here saying to work from card text, and
> it was not enough.
>
> **Getting the text in this sandbox:** `tools/lookup-card.js` asks three sources in
> order, and the first is the one to reach for.
>
> 1. **`card-text.json`, the committed cache.** Scryfall's own wording, fetched on a
>    runner by the *Cache card text* workflow and committed. No request, so it works here,
>    and no banner, because it *is* Scryfall. Every entry carries the date it was read and
>    the tool prints how old that makes it. **If the cards you need are not in it, run that
>    workflow first** — it takes a semicolon-separated list, commits to your branch, and
>    turns the expensive half of a research pass into a diff somebody reads once.
> 2. **Scryfall live**, which is refused by the network policy here — `api.scryfall.com`
>    403s at CONNECT, and so does WebFetch — but works on a runner.
> 3. **Forge's card scripts** on `raw.githubusercontent.com`, which the policy does allow.
>    Everything it answers is banner-marked as Forge's wording. **Cross-check anything the
>    reasoning turns on against XMage**, whose implementation is on the same host.
>
> WebSearch and a card the user pastes are both still fine. Published Spellbook steps
> (`steps/` on the data branch) are good corroboration for what a loop *does*, but they are
> not oracle text and do not satisfy this rule.
>
> **Never hand-write an entry into `card-text.json`.** It exists so that a reading is
> Scryfall's word rather than somebody's recollection; a typed entry makes it a source of
> exactly the unverified text the rule above was written to stop, and one that now looks
> authoritative. Only the workflow writes that file.

`research-log.js` is the index of what has been swept. **Before starting a deep dive,
read it; after finishing one, add to it.** A pass that is not in it did not happen as
far as anyone can tell, which is exactly the state the file was written to end —
"nothing remains open" was once written under an audit of 44 candidates and read as a
statement about 103,737 combos.

```bash
node tools/substitution-scope.js            # how much is unread, and which cards
node tools/substitution-scope.js 0.8 3      # looser bar, more candidates
node tools/deck-cards.js deck.txt --unswept # the same question, asked of one deck
```

The bottom table of the first is the work queue: cards proposing many unpublished
combos that no recorded pass has swept. The top is the size of the space. `deck-cards.js`
narrows it to the cards one deck actually holds, ranked by how many published combos name
them — which is what the substitution method consumes — and flags what the log already
covers. `/deck-deep-dive` runs the whole pass below against that list.

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

Three different questions, and it is worth not confusing them:

| question | what answers it |
|---|---|
| which existing rows can this deck assemble? | `matchUnofficial()`, pinned in `test/unofficial.test.js`. **`try-deck.js` does not cover the unofficial panel.** |
| which of this deck's cards are worth sweeping? | `tools/deck-cards.js --unswept`, and `/deck-deep-dive` on top of it |
| which gaps does *this deck* expose? | `tools/deck-gaps.js` |

The third is the pass above with step 2 restricted to shapes whose cards the deck already
holds — how the lifegain pass found 51 candidates nobody had looked for. It is genuinely
different from the second: `deck-cards.js` chooses *subjects* from a deck and then sweeps
each across the whole database, where `deck-gaps.js` bounds the candidate shapes too, so
every hit is a combo the deck could cast tonight.

**It used to re-propose what had already been ruled out**, and no longer does for the
decisions somebody wrote down as cards. A rule-out in `research-log.js` may carry `sets`
— the exact card combinations that reason killed — and `deck-gaps.js` drops them, then
prints what it dropped and why. `Scurry Oak + Sadistic Glee` was the case that named the
problem: the Squirrel cannot sacrifice itself where Broodscale's Spawn can, the first
sweep threw it out, and the tool offered it again every run.

**`sets` is a subset of its reason, always.** Most rule-outs are categorical — "the loop
needs a *token* out of the sacrifice" — and cover shapes nobody enumerated, so they have
no card set to record. `ruledOutSets()` answers *has this been ruled out?* with **yes** or
**nothing recorded**, and never with *no*. A surviving candidate means nothing has been
recorded about it in a form a tool can read; it does not mean nobody has decided. Still
read the log.

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

- **The DOM files are not covered by the unit tests** — by design. `app.js`,
  `tiers-page.js`, `page-dom.js` and the four `render-*.js` are the layout test's job
  (`npm run verify`) and the browser suite's (`npm run test:ui`). A green `npm test` says
  nothing about any of them, which is worth remembering before trusting one. Logic you want tested belongs in one of the
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
- **The line down a suggestion row is not one element.** It is the gutter's
  `border-right` plus a `border-left` on every block beside it, each reaching back over
  the column gap with a negative margin to meet the piece above. So the gap is a
  variable (`--col-gap`) rather than a number, spacing inside those blocks is padding
  and never margin, and a new block in the card's column has to carry its own piece or
  the line stops at it. `npm run verify` walks the pieces and names the one that broke
  it. The same rule decides two shapes for the interchangeable cards, keyed on the
  card's column rather than the viewport — the README's *Where the second number goes*
  has the measurements.
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
- **Rows leave the file because the nightly job noticed, not because somebody
  remembered.** `update-data.yml` verifies every citation against the snapshot it just
  published: a broken one fails the job, and a row Spellbook has *since published*
  goes into a standing issue that the job rewrites nightly and closes itself once the
  list empties. Adding a row is a decision; removing one should not have to be. Don't
  hand-edit that issue's body — it is regenerated, and `npm run verify:unofficial` is
  the live answer.
- **`unofficial.js` is the biggest script here, and it only grows.** Not "the biggest the
  page loads" — the page does not load it at all. It is `importScripts`'d by
  `search-worker.js` and by nothing else, so it is never parsed on the main thread, and
  what it delays is the first search rather than first paint. That is the fact the
  threshold rests on. Rows go in by hand and leave only by graduation, so watch the
  gzipped size rather than the row count: `gzip -9 -c unofficial.js | wc -c`. The
  threshold is written down — **at 200 KB gzipped `COMBOS` moves to the `data` branch as
  JSON** (raised from 50 KB on purpose; the README says on what) — along with what that
  costs, which is mostly the exact-row assertion in `test/unofficial.test.js`. See the
  README's *What the file costs, and the size at which it stops being source*. Do not move
  it early and do not let it drift past without noticing: one four-card sweep has put on
  14 KB gzipped, so the headroom is a dozen passes and not a hundred.
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
- **`tools/lookup-card.js` falls back to Forge, and says when it did.** An agent sandbox
  whose proxy allowlists `raw.githubusercontent.com` 403s every Scryfall host at CONNECT,
  and mtgjson, gatherer and the Spellbook API with them — so the tool asks Scryfall first
  and Forge second, because Forge ships its card scripts as files in a GitHub repo and
  each has an `Oracle:` line:
  `…/Card-Forge/forge/master/forge-gui/res/cardsfolder/<first letter>/<slug>.txt`.
  The slug: strip accents, lowercase, drop apostrophes, every other run of
  non-alphanumerics becomes one `_` (so `M.O.D.O.K.` → `m_o_d_o_k`), split cards join
  **both** faces, and recent sets live in `cardsfolder/upcoming/` instead of the letter
  directory. Probed at 454 of 454 names from the combo data. **Anything Forge answered is
  printed under a banner** — it is a second opinion, not Scryfall: no colour identity, no
  legalities, no printings, and the wording is Forge's. Cross-check anything a reading
  turns on against XMage, the same idea in PascalCase with the punctuation gone:
  `…/magefree/mage/master/Mage.Sets/src/mage/cards/b/BartolomeDelPresidio.java`.
  The old behaviour is the trap worth remembering: it printed *"HTTP 403 — check the
  spelling"* and stopped, which is a diagnosis it cannot make — a blocked host and a typo
  are identical from inside the tool. It now only says "check the spelling" when Scryfall
  was reachable enough to say the name is unknown. `test/lookup-card.test.js` pins that,
  and the README's *Reading a card when Scryfall is unreachable* has the probe.
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
  when green. Merging to `main` *is* the release. **Short-lived is the load-bearing
  word** — see below for what a branch that outlives a day costs.
- **A ruleset enforces that, so a direct push to `main` is refused** — PR required,
  `checks` green, no force-push, no deletion. Nothing to work around: branch and open a
  PR. Two rules are left off on purpose, and both read as oversights: *require linear
  history* would forbid the merge commits `main` already uses, and any required-approval
  count above zero makes every PR unmergeable on a solo repository. If a ruleset is ever
  added for `data`, it must not block force-pushes — `update-data.yml` force-pushes that
  branch nightly.
- **Push protection is on**, so a push carrying anything that looks like a credential is
  rejected outright rather than reported later. If a push fails on a file you were only
  quoting a token *shape* into — a fixture, a comment, a test — that is what happened.
- **Outstanding work is a GitHub issue, and nothing else.** There is no backlog file here,
  on purpose: two review documents used to carry one, and both were deleted once their
  items had shipped — a document that reads as a queue and is not one costs more than it
  says. Anything still to do goes in an issue so it can be closed, assigned and linked from
  the PR that finishes it, and the reasoning behind anything that *did* ship lives in the
  README section that owns it.

### Merging back into `main`

**Base on `origin/main`, and never trust a local `main`.** A fresh sandbox's clone can
carry a `main` ref that is not the `main` anybody else means — one of them pointed at the
project's original unsquashed history (`#1`–`#35`, back to *Initial commit*), sharing no
recent ancestor with the remote at all, so `git checkout main` landed on a tree 148
commits stale and `git pull` refused as divergent. Nothing was wrong with the repository.
So: `git fetch origin main` and compare against `origin/main`, always. If a local `main`
is already wrong, `git reset --hard origin/main` fixes it — archive the old tip in a
branch first if it might not be junk.

**This repository generates exactly two kinds of merge conflict, by construction.**
Neither is a judgement call, and both look worse than they are:

1. **Append-only data tails** — `COMBOS` in `unofficial.js`, `PASSES` in
   `research-log.js`. Two branches both add entries at the end, so both edit the line
   before the same closing bracket. **The resolution is always "keep both".** The trap is
   that the markers land *mid-object*: each side's last entry is left unclosed, and the
   shared text after the conflict closes exactly one of them. Take side A's lines, close
   A's final entry by hand, then let the existing tail close B's. `node -e
   "require('./unofficial.js')"` is the one-second check that the syntax survived.
2. **Counted prose in the README** — both sides bump the same numbers, so both conflict.
   **The resolution is never "pick a side": recompute.** `npm run check:readme` prints
   every real measurement, so resolve to whatever it says and run it again.

**A long-lived branch pays for both of these twice**, and pays a third cost that no
conflict marker shows: a rule added to `main` while the branch was out. One branch came
back to find `test/research-log.test.js` had started requiring every pass to record the
oracle text it read — which is a good rule the branch had to satisfy retroactively, and
which caught two cards that had only been read through published Spellbook steps. Merging
the same day makes all three cheap; the fix is not better conflict handling, it is a
shorter branch.

### Writing an issue here: point, do not restate

An issue that copies the current state becomes a second source of truth, and the
unchecked copy is the one that rots. "16 cards are unread" is wrong the moment somebody
reads one, and then the log and the issue disagree — which is the exact shape of the
failure this repository spent a day fixing, where prose said *nothing remains open* and
the data said otherwise.

So an issue names **where the live answer lives** and **what finishing looks like**:

> The live list is in `research-log.js` — do not restate it here. Grep for `UNREAD`.
> Finish condition: `UNREAD_DEBT` in `test/research-log.test.js` reaches 0.

Carry detail in the issue only when it exists nowhere else machine-readable — a design
constraint, a specific failing case, a decision somebody has to make. Never a count that
a file already holds and a test already checks.
