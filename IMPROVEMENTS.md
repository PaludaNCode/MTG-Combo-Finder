# Improvements: where we are

Started as a review of the repository. Eight of its ten technical items are now
merged and deployed, so this reads top-down as **status first, then the original
proposals** — kept because each one records what was measured and what it traded
away, and the sections below are what the commits were written against.

Every number was measured against the live `data` branch, not estimated, and the
figures in the proposals are the *before* readings taken on 2026-08-02.

Each item carries a rough size (**S** / **M** / **L**) and a note on what it
trades away, because several are in tension with things the README argues for on
purpose.

---

## Where we are — 2026-08-02

**Merged and deployed.** PR [#58](https://github.com/PaludaNCode/MTG-Combo-Finder/pull/58),
twelve commits, `main` at `7edb4a5`. Merging to `main` is the release.

Verified after the merge, from the workflow runs and the `data` branch itself:

| | |
| --- | --- |
| CI on `main` | success |
| Deploy site | success — first run of the derived asset stamping |
| Update combo data | success — and it ran *immediately*, because `tools/fetch-combos.js` changed |
| `check-snapshot.js` | passed, on its first real comparison against a published snapshot |
| The SHA-pinned actions | resolved and ran |

**The interned payload is already live.** The refresh fired on the merge rather than
waiting for the 04:17 cron, so the `data` branch blob is now **9,821,807 bytes**, down
from 27,652,055 — matching the local measurement exactly.

Two things worth knowing about the changeover:

- `raw.githubusercontent.com` served the previous copy for several minutes after the
  publish (`max-age=300`). Nothing breaks in the meantime: `decode()` is a no-op on
  the old shape, so a reader mid-changeover gets correct results either way, and picks
  the new file up on their next visit through the ETag revalidation.
- `CACHE_NAME` moved to `-v3`, so every returning reader downloads the database once
  more. That is the intended cost — the copy they were holding is nearly three times
  the size for the same data.

**Not verified: the live page itself.** The environment this work ran in cannot reach
`paludancode.github.io`, so every claim above comes from workflow conclusions and the
published blob rather than from loading the site. One look in a browser would close
that gap — and the footer now tells you what the search cost while you are there.

### The eight, and what each turned up

| | | |
| --- | --- | --- |
| T1 | done | 26.37 → 9.37 MB, 2.73 → 1.72 MB on the wire, **69 → 35 MB of heap** |
| T4 | done | five decisions under test; three of my own expectations were wrong |
| T5 | done | `theme.js` and `favicon.svg` had **never** been stamped, and the layout test disagreed with the deploy |
| T6 | done | ESLint pinned; SHA pins + Dependabot on the one job with `contents: write` |
| T7 | done | publish gate on four counts and every row's shape |
| T8 | done | seven claims in the README, checked in CI |
| T9 | done | four contrast failures, all `opacity` stacked on a token |
| T10 | done | the footer says what the search cost |
| T2 | **open** | on purpose — see stoppers |
| T3 | **open** | on purpose — see stoppers |

Of the features, only **F7** exists, and only as a prototype.

---

## Stoppers

**1. F7 has no real data source, and one question decides its shape.**
Does Commander Spellbook's per-variant endpoint send CORS headers that allow
`paludancode.github.io`? It could not be answered here — this environment's network
policy blocks their hosts and Scryfall outright. It takes one `fetch()` in the console
on the live site to find out.

- *Yes* → wire `setSource()` to their endpoint, add one `connect-src` entry to both
  pages' CSP, done.
- *No* (the likely answer, and the same restriction that made this project publish
  data in the first place) → publish steps to the `data` branch, sharded by combo id.
  More work, no CORS question, and `normalize()` already takes the payload shape.

Until then the panel answers "no steps recorded" for every combo but the three written
out by hand.

**2. T2 and T3 are blocked on a number from a real phone.**
The instrument shipped — the footer now reads `ready in 1.4s (download 0.9s · parse
0.4s · match 0.1s)`. What is needed is somebody loading the live site on a mid-range
phone and reading it. The decision rule:

- If download and parse still cost seconds *after* T1, **T2** (shard the payload) is
  worth its complexity.
- If they do not, neither T2 nor T3 is, and both should be closed rather than left
  open forever.

Deciding this from a laptop is exactly the mistake the instrument exists to prevent.

**3. Nothing in CI exercises `update-data.yml`.**
It ran on the merge and passed, which is the best evidence available and better than
none — but the daily 04:17 UTC run is unattended, and it is the one job that can
force-push the `data` branch. A failure there is not an outage: the site keeps serving
the last good snapshot, so the symptom is staleness, and the footer's date is where it
shows.

---

## Decisions waiting on you

**Dependabot opened three PRs within a minute of the merge**, and they are not a rubber
stamp:

| | |
| --- | --- |
| [#59](https://github.com/PaludaNCode/MTG-Combo-Finder/pull/59) | `actions/checkout` 5 → 7 |
| [#60](https://github.com/PaludaNCode/MTG-Combo-Finder/pull/60) | `actions/upload-artifact` 5 → 7 |
| [#61](https://github.com/PaludaNCode/MTG-Combo-Finder/pull/61) | `actions/setup-node` 5.0.0 → 7.0.0 |

All three jump two majors past the Node 24 versions the README documents and explains
at length. Worth reading that section before merging any of them. Note also that the
config covers every workflow, not only the SHA-pinned `update-data.yml` — that was the
simple choice, and narrowing it is a one-line change if the noise is unwelcome.

**Whether this file stays.** Most of it has shipped, and the README now carries the
reasoning for each piece in the section that owns it. This is now a status page more
than a proposal.

---

## Watch items

- **`combo-steps.js` ships placeholder text** for three combos. It reads like
  placeholder text, deliberately.
- **The README's numbers are checked in CI now.** Rewording one of the seven anchored
  sentences fails the build and names the claim — that is the design, not a bug.
- **`--faint` is only safe on `--bg`.** 4.8:1 there, 4.3:1 on a panel. Anything quieter
  than `--muted` on a panel has nowhere to go.

---

## What is next

Nine features remain untouched. The ranking from the original review still holds, and
**F1** is still the recommendation: `tools/combos-with.js` already answers the question
players actually ask, it is CLI-only, and the worker is holding the whole database in
memory by the time anyone would ask it.

---

## The original review

What follows is the review as written, before any of it was built. The numbers are
the *before* readings; the "what it costs" notes are what the work was judged
against. Where an item shipped, the README section named in its commit is the
current account of it.

## Technical

### T1 — Intern the strings in `combos.json` (**M**, the biggest single win)

The published file is 27.65 MB parsed, and `combos` is 25.23 MB of it. Broken
down by field, across all 103,737 rows:

| field | parsed size | what it is |
|---|---|---|
| `p` | 13.19 MB | the results, e.g. `"Infinite storm count"` |
| `c` | 7.76 MB | card names |
| `id` | 2.30 MB | the Spellbook variant id |
| `i` | 0.84 MB | colour identity |
| `pop` | 0.45 MB | play count |
| `t` | 0.03 MB | template ids |

The results field is over half the database, and there are **1,079 distinct
result strings** in it. `"Infinite ETB"` is stored something like forty thousand
times. Card names are the same story: **7,364 distinct names** across 7.76 MB.

Replacing both with indices into two lookup arrays, published at the top of the
payload:

```
parsed:  25.23 MB  →  6.46 MB   (3.9×)
on wire:  2.30 MB  →  1.24 MB   (1.9× — gzip already found some of this)
```

The heap number is the one that matters most. The worker holds the whole parsed
dataset for the life of the session, deliberately, so the second search is free:

```
$ node --expose-gc -e 'gc(); const a=process.memoryUsage().heapUsed;
  const d=JSON.parse(require("fs").readFileSync("combos.json","utf8"));
  gc(); console.log(((process.memoryUsage().heapUsed-a)/1048576).toFixed(0)+" MB")'
69 MB
```

69 MB of resident objects in a worker, on a phone, is the kind of thing a mobile
browser reclaims without asking. Interning takes it to roughly a quarter of
that, mostly by turning ~500k short strings into integers.

There is a second prize. `matchDeck` currently does `deckNames.has(nameKey(name))`
per card per combo — 400k-odd normalise-and-hash operations per search. With
names already indices, the deck's name set becomes a set of integers and the
inner loop is an integer comparison. Matching is not the bottleneck today
(measured at 43–93 ms for the 85-card fixture deck against the real snapshot),
but it becomes free rather than cheap.

**What it costs.** `tools/fetch-combos.js` builds the two tables; `combos.js`
resolves indices back to names on the way out, in `expand()`, which is already
the one funnel every returned row passes through. The test fixture
(`test/fixtures/dataset.js`) has to move to the new shape. `CACHE_NAME` gets
bumped, which the code already anticipates by name and by design.

**Do this one first.** It is contained, it is the only item here that improves
transfer, parse *and* memory at once, and every other data-side idea below gets
easier once the payload has a dictionary at the top of it.

#### T1a — The `id` field is derivable (optional, **S**, and slightly risky)

A Spellbook variant id turns out to be the combo's card ids in ascending order,
joined with `-`, then `--` and the template ids:

```
{"id":"1110-4694-7839--112","c":[...three cards...],"t":[112]}
```

Checked across the snapshot: the segment count matches cards + templates for
100,021 of 103,737 rows, and the 3,716 that don't are exactly the template rows,
where the `--` produces an empty segment. Ascending order holds for 99,838.

So the field could be replaced by a name → Spellbook-card-id map of 7,364
entries, saving another ~2.2 MB parsed. The reason to hesitate is that the id is
what the "see it on Spellbook" link is built from, and a link to the wrong combo
is a worse outcome than a large file. Only worth doing with a check in the
fetcher that reconstructs every id from the map and compares it to the published
one, failing the refresh on a single mismatch — at which point it is safe, and
cheap to keep safe.

### T2 — Only download the combos the deck could possibly touch (**L**, later)

`matchDeck` discards any combo missing more than one card, and every row in the
snapshot names at least one real card (verified: zero rows with an empty `c`).
So every result the page can ever produce — included, one card away, one slot
away, and every suggestion derived from them — comes from combos that name at
least one card already in the deck. A card → combo-ids index would let a
hundred-card deck fetch tens of kilobytes instead of megabytes.

The reason this is ranked below T1 rather than above it: it trades the property
the README spends a section defending — one file, one cache entry, one ETag
revalidation, one failure mode — for a few hundred range requests or shard
fetches, each with its own cache entry and its own way to be half-present. That
is a real architectural change to a page whose whole design argument is
simplicity.

**Recommendation: don't, yet.** Do T1, then measure (see T10). If a mid-range
phone still spends seconds on the data after T1, this is the next lever. If it
doesn't, this is complexity bought for nothing.

### T3 — Keep the decoded structure, not the raw text (**M**, after T1)

Cache Storage holds the response body, so a repeat visit still pays the JSON
parse — 340 ms on this machine, and phones are several times worse. Storing the
post-decode structure in IndexedDB instead means the structured-clone read, with
no parse at all.

Worth noting the interaction: T1 shrinks the parse by roughly 4×, which may be
enough on its own. Measure before building. The `withDeadline` discipline in
`search.js` — never await a storage call on the way to the data — would have to
extend to IndexedDB, which has the same "can hang forever" behaviour that
motivated it for Cache Storage in the first place.

### T4 — Move the decisions out of `app.js` (**M**, and it compounds)

`app.js` is 1,915 lines and, by design, no unit test loads it. CLAUDE.md says so
plainly and gives the reason: the layout test is its coverage. That reasoning is
sound for DOM wiring. It is much weaker for the parts of `app.js` that are not
DOM wiring at all:

- `pickedSentence()` — counts and phrases what picking cards out of the map found
- `splitLine()` — the "8 official + 3 ours" arithmetic in a heading
- `sizeRow()` — pluralisation and counting over combo sizes
- `renderDataAge()` — how old the snapshot is, in words
- `renderBracket()` — the prose behind a bracket verdict
- `resultChips()` / `comboCardNames()` — which chips and names a row shows

Every one of those is a pure function of the search result. Every one of them
can be wrong in a way a layout test cannot see, because a wrong number renders
just as happily as a right one — the layout test proves a panel is not empty,
not that it says the truth. And the README explicitly treats these counts as
things people read and trust.

Extracting them into a DOM-free `view-model.js`, on the same IIFE pattern as
every other module here, puts them under `npm test` and leaves `app.js` doing
what the file's own header says it does: draw what comes back. No framework, no
build step, no change to how the page loads beyond one more `<script>` — which
is exactly the friction T5 is about.

### T5 — Derive the deploy's asset list instead of counting it by hand (**S**)

CLAUDE.md names this as a mistake that has already happened twice, to
`unofficial.js` and to `graph.js`: a script added to the page and not to the
`assets` list in `deploy.yml` ships unstamped, serves stale from the Pages CDN,
and the failure only ever appears in production. The asserted hit counts (8 and
3) catch a *rename*; they cannot catch an *addition*, which is the half that has
actually bitten.

A short Node script in that step can read each page, find every local `src=` /
`href=`, stamp them all, and then assert that no local asset reference is left
unstamped. That inverts the check from "did we stamp the number we expected" to
"is anything unstamped", which is the property actually wanted, and it deletes a
hand-maintained number from a workflow file. It also removes the tax on T4 and
on any other file split.

### T6 — Pin what CI fetches (**S**)

Playwright is pinned to 1.56.1. ESLint is `npx --yes eslint@9`, which resolves to
whatever 9.x published most recently — so a red build can arrive on a day nobody
changed anything, from a repository nobody here controls. Pin it exactly, the way
Playwright already is.

The actions are on floating majors (`actions/checkout@v5` and friends). That is
normal practice and mostly fine, but `update-data.yml` runs with
`permissions: contents: write` and force-pushes the `data` branch, which is the
one workflow here where a compromised action tag has somewhere interesting to go.
SHA-pinning that workflow's actions specifically, with Dependabot to bump them, is
a cheap closure of the only supply-chain path that matters in this repo.

### T7 — Guard the nightly refresh against a bad snapshot (**S**, high value)

`fetch-combos.js` has two guards — refuse to write zero combos, refuse to publish
with fewer than 1,000 card identities — and the second exists because that failure
already happened once silently. Neither compares today against yesterday.

A half-published upstream export, or a schema change that makes `compact()` drop
most rows, produces a file that passes both guards and then force-pushes over the
good one. The `data` branch is an orphan commit with no history, so the previous
snapshot is gone.

Suggested: before publishing, fetch the current `data` branch copy and refuse if
`combos.length`, `Object.keys(cardIdentity).length` or `gameChangers.length` has
dropped by more than ~10%, with a `workflow_dispatch` input to override when the
drop is real. Add a small shape assertion at the same time — every row has `id`,
`c` and `i`; `p` is an array — so an upstream field rename fails the job rather
than the page.

### T8 — Make the README's measurements checkable (**M**)

The README is 134 KB and is genuinely the reference — but it carries real,
countable numbers in prose (unofficial row counts, tier entries, template counts,
"~100k combos", "2.9 MB on the wire"), and CLAUDE.md warns that these move when
the data files change. Today the only thing keeping them true is remembering to.

The countable ones could be tagged in the prose with a stable phrasing and checked
by a small `tools/check-readme-numbers.js` in CI, the way `verify-unofficial.js`
already checks the citations. Not all of them — "2.9 MB on the wire" depends on
GitHub's gzip and isn't worth pinning — but the ones that are a `length` on a file
in this repo are, and those are the ones a change to `unofficial.js` or
`result-tiers.js` silently invalidates.

### T9 — Automate the accessibility check that is already being done by hand (**S**)

The accessibility work here is unusually careful for a hobby project: `aria-pressed`
on map nodes, a real tablist with roving tabindex, `role="status"` on the summary,
labelled mana pips, `<title>` inside the SVG, a theme toggle that hides itself if
its script never arrived. That is a lot of correct detail to maintain by hand with
nothing checking it.

Playwright is already in CI. An axe-core pass over the rendered result page at one
viewport is about ten lines and catches the regressions the layout test structurally
cannot see — a contrast ratio that a theme-token change broke, a control that lost
its accessible name. It is another fetched-per-run dependency, which is a real cost
in a repo that prides itself on none, but it sits inside the exception ESLint and
Playwright already established.

### T10 — Measure where a search's time actually goes (**S**, do it before T2/T3)

Nothing today reports how long the three phases — download, parse, match — take on
the reader's device. The diagnostics panel exists and already collects "everything
learned about a load"; three `performance.mark` pairs feeding into it would make the
question answerable on a real phone instead of inferred from a laptop.

This is listed last but is close to first in order of operations: T2 and T3 are both
substantial work justified entirely by numbers nobody has collected yet.

---

## Features

### F1 — "Why isn't X a combo with Y?", in the page (**M**, best value here)

`tools/combos-with.js` already answers the single most common question a player
has, and it is available only to someone with a checkout and a terminal. The
worker already holds the entire database in memory after a search. Two card-name
boxes and a result — "these three published combos name both, and here is what
stands between your deck and each one, missing cards and unfilled slots reported
separately" — is a genuinely new capability built almost entirely out of logic
that exists, over data already downloaded.

It also fits the page's existing voice: the whole site is built around explaining
*why* a result is what it is rather than just asserting it.

### F2 — Cut candidates: the inverse of the suggestions panel (**S**)

The page ranks cards to add. It never names a card to remove, though it holds
everything needed to: `comboPieces()` builds a card → combos index over the
included rows, so the deck cards absent from that index are exactly the cards
holding up nothing — appearing in no combo, no near-miss, and filling no template
slot.

The framing has to be careful, and the README's tone is already good at this sort
of caveat: a card can obviously earn its slot without being combo-relevant, and a
tool that says "cut your removal" is a tool nobody trusts twice. Presented as
"these cards are not part of any line this page can see", it is a real deckbuilding
answer and a natural counterpart to the panel that already exists.

### F3 — Prices on the suggestions (**M**, needs a second data source)

The suggestion list is ranked by combos unlocked, with no notion of what a card
costs. In practice that is the second question every reader has, and for a lot of
them it is the deciding one.

The README already names MTG-Pricerunner as the sibling project doing precisely
this publish-as-data trick for prices, so the pattern is established and the
authorship is the same. A price per suggested card plus a budget filter — "show me
what £20 unlocks" — turns a ranked list into a shopping decision. Costs a second
fetch and a `connect-src` entry, or a join in the nightly job if the price data is
already reachable from an Action.

### F4 — More ways to get a deck in (**S** each)

Only Archidekt loads from a URL, and the README explains convincingly why Moxfield
never will. But the structure in `parser.js` — the `SITES` table, `fromMoxfield()`,
`fromArchidekt()` — is already shaped for more entries, and Deckstats, TappedOut and
Scryfall's deck API are each one adapter plus one CSP entry. Each needs its CORS
behaviour verified first, since that is exactly the assumption Moxfield broke.

The cheapest version of this feature, and the one that covers *every* site: accept a
dropped or chosen `.txt` file into the decklist box. One event handler, no new
network origin, no CSP change.

### F5 — Legality alongside the bracket (**S**)

The page already computes colour identity and already reads a curated list of cards
off the dataset for the bracket check. Two neighbouring questions come almost free
from that machinery:

- **Cards in the list that are outside the deck's own colour identity.** A common
  and easy-to-miss decklist error, and `withinIdentity()` already exists.
- **Banned cards.** The Commander ban list is short, changes a few times a year, and
  Scryfall can produce it in the same nightly job that fetches identities.

Both fit the existing bracket panel's shape: a claim about what a deck is allowed to
be, made only where the decklist supports it, honest about what it did not check.

### F6 — Export the answer, not just the deck (**S**)

"Copy link" shares the *input*. There is no way to share the *output*. A button that
puts the found combos and top suggestions on the clipboard as plain text or markdown
— for a Discord message, or the deck's own description field on whatever site it
lives — is one function over the result object that is already in hand.

### F7 — What the combo actually does, without leaving the page (**M**, may not be possible)

Rows carry results (`"Infinite storm count"`) but not prerequisites or steps, so
"how do I actually do this" is a click through to Spellbook. Shipping the steps for
every combo is not an option — the results field alone is 13 MB, and the steps are
longer.

The right shape is fetching detail for one combo on demand. Whether that works at
all depends on Spellbook's CORS allowlist, which is the same restriction that caused
this project to publish data in the first place, so the honest expectation is that
the answer is no. Worth a fifteen-minute spike to find out; if it fails, the current
link-out is the correct design and should stay.

### F8 — Remember more than one deck (**S**)

`localStorage` holds a single decklist under one key. Most players have several
decks, and the share-link encoding needed to store more than one is already
written. A short list of recent decks, each named and restorable, is a small change
against machinery that exists.

### F9 — Compare two decks (**M**)

`matchAgainst()` is a pure function of dataset and entries, so running it twice and
diffing gives "combos gained, combos lost" for free. The natural use is evaluating a
swap before making it, which is the same question the "+ Add to deck" button answers
one card at a time.

### F10 — Filter the map by what a line is worth (**S**)

The map already filters by *relation* — works-together versus interchangeable — and
already colours lines by tier. The missing filter is by tier itself: on a 28-card,
114-line map, "show only the lines that end the game" is the view most people
actually want, and the data and the CSS classes are both already there. It is one
more entry in `MAP_VIEWS` and one more class on the SVG.

---

## Ranked, if only a few get done (as originally written)

1. **T1** — intern the payload. Transfer, parse and memory, in one contained change.
2. **T5** — derive the deploy's asset list. Small, and removes a footgun that has
   already fired twice in production.
3. **F1** — "why isn't X a combo with Y" in the page. The largest new capability per
   line of code, over data already downloaded.
4. **T7** — guard the nightly refresh. Cheap insurance on the one artifact with no
   history to roll back to.
5. **T4** — move the counting and the phrasing out of `app.js` and under test.
6. **T10** — measure the search, then decide whether T2 and T3 are worth their
   complexity. They probably are not, and that is worth knowing before building them.
