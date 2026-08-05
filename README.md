# MTG Combo Finder

**▶ Live site: https://paludancode.github.io/MTG-Combo-Finder/**

Paste a Magic: The Gathering decklist and find the combos hiding in it — plus
**ranked suggestions for which single card to add to unlock the most new combos**.
A bit like [Commander Spellbook](https://commanderspellbook.com/)'s "Find My Combos",
but the matching happens in your browser against a published copy of their
database — see [Why the data is published, not queried live](#why-the-data-is-published-not-queried-live).

Static page, no build step, no framework, no `node_modules`. The repository root *is* what
GitHub Pages serves. Combo data is a nightly Commander Spellbook snapshot on the `data`
branch.

> **This file is a reference, not a history.** It states the rules and the figure each one
> rests on, and no longer carries the full reasoning behind every decision. Where a number
> matters, the command that produces it is named, and **that command is the live answer**.
> `CLAUDE.md` is the operating index: what to run, where things live, what fails silently.

## Contents

| Area | Covers |
| --- | --- |
| [Features](#features) · [Results and ranking](#results-and-ranking) | what the page does; tiers, row order, size breakdowns, collapsing, template slots |
| [How a combo is executed](#how-a-combo-is-executed) · [The combo map](#the-combo-map) | the steps disclosure and how steps are published; the picture under *Combos in your deck* |
| [Rendering order](#rendering-order-the-combos-come-first) · [Adding a card](#adding-a-card-and-searching-again) · [Bracket and legality](#classifying-the-decklist-which-bracket-is-it) | why the page yields after the combos; `+ Add to deck`; the five pips, colour identity, bans |
| [Layout and the test suites](#layout-and-the-test-suites) · [How it works](#how-it-works) | themes, `verify` vs `test:ui`, what each proves; every file and what it owns |
| [The published data](#why-the-data-is-published-not-queried-live) | the payload, the worker, caching, the publish gate |
| [Unofficial combos](#unofficial-combos-the-pages-own-second-opinion) · [Deck import](#deck-import) | `unofficial.js` and the rules behind it; URLs, file drop, what a browser may read |
| [Commands](#commands) · [Branching](#branching-strategy) · [Deploying](#deploying) | everything runnable; how work lands and how it ships |

## Features

- **Combos in your deck** — every known combo your current 99 (or 60) can already pull off, read **one
  card at a time**: a row per card that carries one, ranked by how many, so you see what cutting a card
  costs before you cut it. Open a row for its combos, each with what it produces, a link to Spellbook and
  **How it works** — the prerequisites and steps, fetched for the one combo you open. **− Remove** takes
  the card out of the list and searches again. Under it, **[the combo map](#the-combo-map)**: the same
  combos as a picture.
- **Suggested additions** — every combo you're *one card away* from, aggregated per missing card and
  ranked ("add Rings of Brighthearth → unlocks 4 combos"), ties broken on popularity. **+ Add to deck**
  appends the card and re-runs the search against the database already in memory.
- **Size breakdowns** everywhere a count appears: a `+3` reads *1 × 2-card · 1 × 3-card · 1 × 4-card*.
- **Which bracket the list is in** — five pips under the colour identity. A floor, never a verdict, with
  the reasoning and the unchecked criteria one hover away. Beside it, **whether the list is *allowed***:
  off-identity cards and Commander bans, and nothing at all when there is neither.
- **Interchangeable cards are one decision, not many.** On a real 99-card deck that took 141 suggestions
  to 81. **Compare all N on Scryfall** opens a whole choice on one page.
- **It works with the network off**, **cards it did not recognise are named**, suggestions **split by
  colour**, and deck import from an Archidekt URL, a dropped export file, or any site's text export.
- **Collapsible results**, **light or dark**, a **decklist that survives a reload**, **Copy link**, and a
  footer saying which snapshot you have and what the search cost.

## Results and ranking

### Cleaning up combo results

Two steps, because the raw data is noisy in two ways:

1. **At fetch time**, results whose `Feature.status` is `HU`/`PU` are dropped — Spellbook's internal
   *utilities* ("mana abilities can be activated"). A variant listing nothing but utilities keeps
   them; a combo with no stated result is worse than a vague one.
2. **At render time**, `summarizeResults()` dedupes case- and whitespace-insensitively and sorts into
   three tiers.

Wording is left intact — rewriting "Infinite ETB triggers" into something snappier risks claiming the
combo does something it does not.

### Three tiers, three colours

| Colour | Tier | Meaning |
|---|---|---|
| 🟩 Green | `win` | This ends the game |
| 🟨 Greyish-yellow | `decisive` | Real value that something else still has to convert |
| ⬜ Grey | `other` | The plumbing a loop runs on — relevant, but not a way to win |

**Which outcome sits in which tier is written down, not worked out.** `result-tiers.js` lists all 1,079
results Commander Spellbook publishes, by exact name, so moving one outcome between tiers means moving one
string between lists. That replaced pattern matching, which needed an exception list for every rule
(`Infinite turns` is a win; `Infinite turns for each opponent` is the opposite of one). Two consequences,
both intended — **an outcome nobody has classified is grey** rather than guessed at, and **nothing can be
reclassified by accident**, because no rule spans outcomes. Yellow keeps a per-outcome reason on hover,
because the caveat is the point.

**Grey folds**, behind "+N more" with the count on the control. It is the four biggest outcomes in the
database — ETB, LTB, death triggers, sacrifice triggers — so a row whose real payoff is one green chip was
spending four lines on plumbing: 76px folded against 129px open on a 390px phone, on rows a deck has
eighty of. **One exception: a combo whose results are all grey shows them**, since folding would leave the
row saying nothing.

An unclassified result is reported in two places, because a silent one would be dangerous:
**[tiers.html](https://paludancode.github.io/MTG-Combo-Finder/tiers.html)** puts anything the inventory
does not list at the top in red with the lines to paste in, and `reportUnclassified()` prints it in the
data workflow log. `verify` renders `tiers.html` against a fixture holding a deliberately unknown result.

### The combos you have: one row per card, most carried first

**Combos in your deck** is a list of *your cards*, ranked by how many combos each one carries — the
number in the gutter is what cutting it would cost. Open a card and its combos are written out
underneath, easiest first: every 2-card combo, then every 3-card, then every 4-card, because two cards on
the table is a different proposition from four.

**This panel used to be a list of combos**, one row per combo, with families of interchangeable versions
folded into an "any of N" row. It was 233 rows on the standing Chatterfang deck, and the thing they could
not say is the thing the deck's owner is deciding: that six of those combos all hang off the same two
cards. `byDrawnRow()` and `comboRowNames()` ordered those rows and are gone with them, and so is the
`+ any of N` fold — see [Collapsing interchangeable cards](#collapsing-interchangeable-cards) for what
that measurement was and why it does not transfer.

**The badge counts combos and the rows are cards, so the two numbers disagree**: the standing Chatterfang
deck's 233 combos hang off at most the 103 cards in its main deck, and in practice far fewer. The panel
says both numbers in a sentence under the heading, from `DeckView.deckCombosNote()` — the only thing
standing between a reader and "233 rows, most of them missing". `verify` checks the badge against the set
of distinct combos the panel actually reaches, and that both numbers appear in the sentence. **The row
count itself is not a figure recorded here**: it needs `combos.json`, which is a build artifact, so
`node tools/deck-cards.js test/fixtures/chatterfang-deck.txt` is the live answer.

**The cards in a row are alphabetical**, sorted at render time only; matching, grouping and slot
assignment keep Spellbook's published order, since `groupVariants()` reasons about a card's position.

Three ordering rules for the cards inside a row, all in
`DeckCombos.orderComboNames(names, {lead, trail})`:

- **Where a combo is listed under a card, that card goes first.** For a suggestion the lead is read
  **per variant**, not from the group.
- **Where a row differs from its neighbours by one card, that card goes last**, wherever combos are
  listed side by side, so the difference lands in the same place every time.
- **A row can sit in two families at once**, so a family **claims** the rows it orders, biggest first;
  crossing families are left holding one unclaimed row each and are skipped.

Both are orderings and never filters — a pin naming nothing leaves the row alphabetical rather than
throwing — and which rows count as a family *for ordering* is decided from the cards alone, deliberately
unlike [collapsing](#collapsing-interchangeable-cards), which also requires the same results.

**Blocks are ordered by how many rows they hold, largest first, then alphabetically**, since a block is a
choice the reader is making; a row with no family counts as a family of one, and combo size outranks
both. **All of this orders rows and never cards** — a test holds that every row's drawn cards are
identical before and after sorting, and that the answer cannot depend on arrival order.

#### The unofficial panel was sorted on nothing at all

**The rule: `variantCardNames()` takes a combo in either shape, and every ordering caller goes through
it. Never work around the shape at a call site.**

A combo exists in two shapes — a compact row from the dataset (`c`, strings) and one that has been
through `expand()` (`uses`, objects) — and **sorting happens before expansion, rendering after**.
`variantCardNames()` once read `uses` alone, so compact-row callers got an empty list back: not an
error, not a zero, an empty list, which every ordering rule accepts. Every unofficial row compared as
`''` against `''` and the panel shipped in file order.

The workaround was the tell. `comboSize()` had worked around the same shape at its own call site,
which kept the panel looking ordered by size while it was unordered within a size, and no test asked
because every test that orders combos builds rows already expanded. `test/unofficial.test.js` now pins
the panel's order on rows in the pre-expansion shape.

### Ranking, and what popularity is for

**Cards are ranked on combos unlocked first, then popularity (`pop`), then alphabetically.** Count
leads because "+N combos" is what the page claims. Popularity decides between cards making the same
claim.

**Inside a list of combos, size leads and the card names break the tie — not popularity.** Sorting
those lists on play count put a 4-card line at the top of a list whose own heading read
*1 × 2-card · 4 × 3-card · 7 × 4-card*, and scattered every repeated partner down the page for a
reason that is not on screen.

So **play count no longer decides the position of a single row a reader sees.** A missing `pop` counts
as zero, so ordering never depends on whether a field is there.

### What the count is made of

A count says nothing about how hard a combo is to assemble, so every recommendation carries its own
breakdown on the last line of its own column:

```
  +3    │ Thassa's Oracle
COMBOS  │ EDHREC · Scryfall · + Add to deck
  2+1   │ 1 × 2-card   1 × 3-card   1 × 4-card
```

**And so does every card in *Combos in your deck***, where the argument runs in reverse: a card
holding up three two-card lines is a very different card to cut than one holding up nine four-card ones.
The case that settles it — **Pitiless Plunderer** ranks 5th on "+6 combos" and five of those six need four
cards, while **Ashnod's Altar** outranks it on "+7", every one of them three.

- **A slot counts as a card.** `Rings of Brighthearth + a Persist Creature` is a two-card combo.
- **Per card, not per panel.** An aggregate needs a denominator and there are two defensible ones. A
  per-row breakdown sums to the total in the gutter, which the layout test asserts.
- **Only a two-card pill is filled.** Two is the floor, so it is the one worth marking.
- **Slate, not the tier colours.** A size pill in green would read as "this wins the game".

### Collapsing interchangeable cards

Two cards are interchangeable **for your deck** when adding either completes exactly the same set of
combos — read off the data, so no wording is interpreted. It matters because the flat list misleads:
four cards each claiming "+7 combos" look like four options worth seven apiece; they are one option
worth seven, described four times.

**`groupVariants()` and `COLLAPSE_FROM = 4` no longer draw anything.** They folded families of versions
into an `any of N` row in the panel that listed every combo, and that panel is gone: *Combos in your deck*
is one row per card and writes every version out inside it. What remains of them is
`tools/try-deck.js`, which groups a deck's combos into families as a text summary — a useful unit when
reading 233 combos as a list, and the only caller left.

The threshold's reasoning, kept because it is the argument for the number rather than for the fold: pairs
and triples were written out and four and up folded, because a folded triple prints every choice card on
the line under its heading and so hides nothing — it asks the reader to assemble three combos in their
head and puts each one's link behind a disclosure. Four is where it stops being an indirection and starts
being a summary:

```
fold from        2      3      4      5    never
Chatterfang     84    116    120    126      233
fixture deck    22     23     33     33       33
```

`groupVariants()` counts on the members still **free**, not on the bucket, so a family that loses
members to a larger one and drops below the threshold is written out too. Tests read the exported
constant, with exactly one pinning the number.

**Identical results are required, and that is deliberate.** This under-groups, and the tempting repair
is to compare results loosely. **Don't.** Kiki-Jiki pairs with a hundred partners producing everything
from infinite turns to infinite combat damage, and any "close enough" rule eventually eats those. If it
is ever worth fixing, the fix is exact rather than fuzzy: Spellbook *authors* a combo and *generates*
variants from it, so the parent recipe would group them with nothing inferred. `compact()` keeps none.

- **Grouping must not reorder.** A function that both merges rows and moves them can only be reasoned
  about as a whole, so grouping merges and the caller orders. **Nothing is lost** — every variant lands in
  exactly one group, asserted in `test/grouping.test.js`.
- **Each option is a grid, never a wrapping line** — *name · links · + Add* on one row where there is
  room, *name* above *links · + Add* where there is not. As a wrapping flex row a long name pushed its
  **+ Add** onto a second line and no two buttons shared an edge. The *width* decides, not the name.
- **The name is clipped, not shortened.** The full text stays in the DOM for screen readers,
  find-in-page and copying.

#### The fold was taken out twice: once wrongly, once with the panel

**Current rule: there is no fold, because there is no panel of combo rows to fold.** The history is worth
keeping, because the two removals are not the same removal and the second must not be read as vindicating
the first.

**The first was wrong.** A version of this section arguing for removal was on `main` for about an hour and
read as settled. The measurement that reversed it: **149 of the Chatterfang deck's 233 unfolded rows
repeated a block of result chips already on screen**, against 36 of 120 folded. A family's versions produce
identical results by construction — that is what merging them requires — so writing them out adds copies,
not information. The honest counter-argument, which stood: a collapsed row shows its chips **N+1** times if
you open it, so the fold reduced the repetition a reader *scrolls past* rather than the repetition in the
DOM — which is the one that costs them anything.

**The second took the panel with it.** That measurement is about 233 rows side by side in one panel, and
that arrangement no longer exists: the combos are written out under the card that carries them, a dozen or
so at a time, behind a disclosure a reader opened on purpose. The repetition the fold was buying back is
not repetition on screen any more. **If a panel of combo rows ever returns, the 149-of-233 figure returns
with it** — `node tools/try-deck.js test/fixtures/chatterfang-deck.txt` still prints the families.

#### Comparing a whole choice at once

Grouping sixteen cards into one decision is half the job; **making** it means looking at sixteen cards. So
a choice carries **Compare all 16**, opening every card on one Scryfall page, and **every combo row
carries the same link under a different verb** — **See all N cards**. A choice between interchangeable
cards is a comparison; the cards a combo needs are all required, so inviting a comparison invites the
wrong idea. One query builder, two callers, two verbs; the layout test fails if a combo row's link says
"compare".

**Both links sit above the result chips**, because what a combo *needs* is read before what it *does*.
Named cards only — a template slot has no card to open.

- **The query is exact.** `scryfallSetQuery()` builds `!"Blood Artist" or …`. Without the `!` Scryfall
  reads the words as a substring search and returns a larger set — which would look like it worked.
- **The recommended card is included**; a comparison missing it is the wrong comparison.
- **Whitespace is collapsed**, which `nameKey()` deliberately does not do, since `!"Blood   Artist"`
  matches nothing.

The label's wording is cut to fit the column, and the layout test measures the **sentence** over its own
text node rather than the label's box, because the box holds the link too.

### Template slots ("a Persist Creature")

Some combos have a slot naming a property rather than a card, and matching works on names — so every
one of them used to be dropped. That was **3,860 combos**, 64% of which show green.

Spellbook attaches a Scryfall query to most templates, so `tools/templates.js` turns each slot into
the list of cards that fill it, stored as `card -> template ids`. Nothing interprets wording:
Spellbook authors the query, Scryfall evaluates it, we record the answer.

**`templates.json` is generated by hand and checked in**, not resolved on every refresh — that costs
465 Scryfall requests and a quarter of an hour, and templates change a few times a year. Staleness is
invisible, so the daily refresh compares the ids every combo names against the file and prints anything
new; the 29 query-less templates are recorded separately, because a warning that always fires is one
nobody reads. When it fires, run the **Regenerate template card lists** workflow from a branch — it
refuses to write at all if any template failed, since a file half-written by a 503 would look complete.

**Only templates a combo actually asks for get resolved** — Spellbook defines 178 and just 157 ids
appear anywhere in the data:

| | all | used only |
|---|---:|---:|
| Templates resolved | 148 | **134** (14 skipped) |
| Cards in the file | 21,769 | **12,472** |
| File size | 0.62 MB | **0.35 MB** |
| Wall time | 16.2 min | **12.9 min** |

Skipped templates are kept apart from `unresolvable` because the two differ: a query-less template is
permanently out of reach, a skipped one could be resolved the moment something needs it.

Four rules, all about not overclaiming:

- **A slot is filled or the combo is not counted.** There is no one card to suggest for "a Creature
  with Haste", so a template combo only counts once the deck fills every slot it has.
- **Every slot gets its own card.** Assignment is a real matching (Kuhn's algorithm), not a greedy
  pass: taking the first candidate for each slot can strand a later one.
- **The page says which card filled which slot.** A combo that appears because of a slot and cannot
  show why reads as invented.
- **Unreadable data excludes rather than includes.** A requirement with no id is `null` and matches no
  template; data recording only a slot *count* is treated the same way, because a stale `combos.json`
  must never start claiming combos.

**Resolving locally against the Scryfall bulk file was considered and rejected**: it means
reimplementing Scryfall's query language, and `is:permanent` and `is:tdfc` are their own derived
definitions rather than fields — so it would be a reconstruction, and a wrong reconstruction does not
error, it silently yields a slightly wrong card list.

### The panel that could not answer its own question

**Current rule: there are three result panels, and a combo whose slot the deck cannot fill appears
nowhere at all.** Template slots themselves are untouched — a *filled* slot still renders, still names
the card credited with filling it, and still counts as a card.

There used to be five. **One slot away** went first, because it is the one section that could not
answer its own question: a slot 394 cards fill has no card to recommend, so every row reduced to a
slot name, a count and a handful of examples. The panels around it each end in something you can
act on; this one ended in a research task. The list of combo rows went later, folded into the cards
that carry them — see [the combos you have](#the-combos-you-have-one-row-per-card-most-carried-first).

**What was given up, plainly:** the fact itself. `node tools/deck-gaps.js deck.txt` answers it from a
terminal, which is a different audience from somebody pasting a decklist into a page.

`slotCandidates()` went with the panel; `resolveSlots()`, `assignSlots()` and `templates.json` stayed.
`npm run verify` expects three panels and asserts the fixture's one-slot-short combo appears
**nowhere**, across every combo link on the page. **One field outlived it** — `unresolvable`, the
names for the query-less templates, is still published because the tools read it and because a
template with no card list must still be a slot the deck cannot fill rather than an unnamed one.

## How a combo is executed

Every combo row answers *what this does* with result chips and offers *how you do it* on the same
line: **How it works · View on Commander Spellbook → · See all 3 cards**.

**The steps are not in the download, and that is the whole design.** The database is 103,737 combos
and 27.65 MB parsed; the steps add **51.70 MB** on top — twice the whole rest of it — to answer a
question a reader asks about two or three combos out of thirty-three. They are fetched for the one
combo somebody stopped on and held for the session. **Collapsed on every row, always.**

**Four states.** Waiting says so; a failure names what went wrong and points at the link beside it;
"no steps recorded for this combo yet" is an answer rather than an empty box. A failure is **not
cached**, unlike the other two — the network being down says nothing about whether the combo has
steps.

**An unofficial row borrows the published combo's steps, and says so** — *"These are the published
combo's steps. Read Sadistic Glee as Necrosynthesis"*. Unattributed, the page would be printing
instructions for somebody else's deck.

**Fetching from Spellbook directly is ruled out** by the same CORS allowlist that made this project
publish data instead of querying it. `setSource()` stays a seam anyway.

### One file per combo

Five publish shapes were built and measured with `tools/measure-steps.js`. What each costs to open one
combo:

| | requests | downloaded | |
| --- | --- | --- | --- |
| **one file per combo** | **1** | **0.5 KB** | 103,737 files on the branch |
| blob + offset table | 1 | 0.5 KB | after a 126.9 KB index |
| sharded JSON, 512 ways | 1 | 21.7 KB | |
| SQLite over byte ranges | 4 | 16.0 KB | sequential — each trip decides the next |
| Parquet, best of three tunings | 2 | 76.0 KB | 51 row groups |

The blob tied on paper and lost against the real host. **`raw.githubusercontent.com` gzips almost
everything, so byte ranges lie** — a `Range` gets those bytes *of the gzip stream*, and a browser cannot
opt out since `Accept-Encoding` is a forbidden header. Of 25 extensions probed only `.zip` was honest.
**Any design wanting a slice of a file starts there.** And an offset table has to be keyed on something:
by row number it breaks every morning, since `search.js` serves a cached payload while revalidating, and
by combo id it grows big enough to want sharding — the round trip the blob existed to avoid.

Follow that to the end and **the index disappears into the filename**: nothing to look up, and a 404 is a
complete answer meaning "no steps recorded". Ids are hashed into **256 directories** for git's sake rather
than the reader's, and every record is **stamped with its own id**, checked against the one asked for.

**The steps tree has no manifest, so CI computes one.** A wrong tree is invisible: the reader is told
there are no steps and believes it. `tools/check-snapshot.js --steps` refuses the publish over coverage
collapsing, a file in the wrong bucket, a record stamped with someone else's id, or a file for a combo not
in today's snapshot. Every file, not a sample.

### What a variant actually contains

`normalize()` was written against field names guessed from Spellbook's website, and **a guessed field name
does not fail loudly** — it comes back `undefined` and the panel shows one fewer line. (**One guess was
wrong**: `otherPrerequisites` does not exist, so `normalize()` had been reading nothing.) Their API refuses
browser requests, but `update-data.yml` streams the bulk export on a runner, so `tools/peek-variant.js`
prints one variant whole via `peek-variant.yml` — the real fields being `description` (the steps),
`notablePrerequisites` / `easyPrerequisites`, `manaNeeded` / `manaValueNeeded`, `uses[].zoneLocations`, the
four per-zone `…CardState` fields, `mustBeCommander`, `quantity`, `notes`, `spoiler`, `popularity` and
`identity`.

**What gets published is a subset of what they send, not a format of our own.** `ComboSteps.pick()` selects
exactly the fields `normalize()` reads, and the test is an equality rather than a spot check —
`normalize(pick(v))` must deep-equal `normalize(v)` — so whatever `pick()` drops provably cannot change a
line the reader would have seen. `peek-variant` is deliberately a tool run on demand rather than a test: it
asks a live third party a question, and a check that fails during somebody else's outage gets muted.

## The combo map

*A prototype.* Under "Combos in your deck" sits the same set of combos as a picture: **a dot per card, and
a line between two cards that overlap.**

| | What it means |
| --- | --- |
| **Solid line** | *a combo needs both.* A three-card combo is a triangle, not a chain |
| **Dashed line** | *they do the same job.* Your sacrifice outlets are never in a combo together — they are alternatives — so this is the only line that will ever join them |
| **Dot size** | how many of your combos that card is in, sized by area |
| **Line weight** | how much the pair overlaps, capped so one busy pair does not draw a bar across the map |
| **Line colour** | on a solid line, the best result behind it, in the same three tiers |

What it adds over the panel is shape: *Combos in your deck* will tell you Basalt Monolith is in five
combos, and cannot tell you the deck is one artifact-mana engine with a Heliod cluster bolted on.

**Three chips — *Both*, *Works together*, *Interchangeable* — filter lines, and nothing moves when you
switch**: the layout is worked out from both relations at once, so the filter only takes lines away. There
was a fourth, *Game-ending*, and it is gone — a tier is a property of the combo behind an edge rather than
a relation between two cards, so it could not include interchangeable lines at all.

**The highlight follows the chip**, scoped by `ComboGraph.litFor()` rather than by the renderer, because
it is a decision about what the picture claims and `node --test` cannot reach `render-map.js`. **The
sentence under the map is deliberately not scoped** — it answers "what would cutting these cost", a fact
about the deck rather than about which lines are on screen.

**A card filling a template slot is on the map like any other**, and a test pins the map and *Combos in
your deck* to the same set of cards so they cannot drift.

### Picking two or three cards out

Pressing cards pins them, and what lights is what they have **in common**, with a line under the map
counting it out — *"Cut all three and 7 of the 17 combos they appear in would go; the other 10 have a
stand-in."* That last number is the one worth the feature: **cutting a card does not cost you its combos
when another card fills the same slot**, which is what the interchangeable relation knows and a combo
count does not. The arithmetic is `compare()` in `graph.js`, counted from the combos rather than from the
graph. **The cards are buttons** — focusable, named, reporting whether they are pinned — which is also why
the map is a `group` and not an `img`.

**Crowding is what a real deck does to it**, and none of it shows on a small one: a separation pass pushes
overlapping dots apart (the re-fit only ever scales up, so it cannot reintroduce an overlap), every dot is
occupied ground before a label is placed, and past **sixty cards** the busiest are kept and the panel says
how many were left out. A narrow column gets its own preset rather than the same map shrunk, since canvas
units against column width *are* the scale.

**The placement is deterministic**, seeded from a ring in a fixed order, because the map is rebuilt by
*every* search — with random seeding, adding one card would appear to move every card. **No charting
library**, because the CSP allows scripts from nowhere but this origin.

**The render path never reads geometry.** `body.clientWidth` mid-render was the single most expensive line
on the page — reading it flushes style and layout for the whole document, **601ms of a 3,620ms search** on
a throttled phone — so a `ResizeObserver` keeps the width in a variable instead, taking `borderBoxSize`
rather than `contentRect`. **The guard is a count, not a duration**: `verify` counts reads of
`clientWidth` during a re-search and fails if there are any.

**What it does not do yet.** No dragging, no zoom, no click-through, and the layout is worked out once per
search. The map is one image to a screen reader.

## Rendering order: the combos come first

`renderResults()` was one synchronous task, and a browser cannot paint in the middle of one — so on a
520-combo deck at 390px throttled 4× the reader watched a dead page for **3,094ms**, though the answer had
been built after about 800ms. Yielding after it puts it on screen in **797ms**. **This is a trade, not a
free win**: total building goes up, and what changes is that the reader is not made to watch it. **The
deferred panels are emptied immediately and filled a frame later** — a panel visibly absent beats a panel
quietly a search out of date, and clearing them was most of the win anyway.

**The cut is after "Combos in your deck"**, which is the answer and the first thing on screen; the map and
the suggestions wait a frame. Those figures were measured when the answer was a list of combo rows and have
not been re-measured for a list of cards, so read them as why the split exists rather than as what it costs
today.

Two things that are easy to get wrong: the suggestion panel's work is called *inside* the deferred callback
rather than passed to it, since arguments are evaluated immediately; and every deferred callback carries
the token of the render that booked it, because **+ Add to deck** fires a search straight away.
`tools/verify-layout.js` asserts in both directions — the answer is in that first frame, and the other
panels are not.

## Adding a card, and searching again

**+ Add to deck** writes `1 <card>` into the decklist, keeps the list, and submits the form. **− Remove**,
on every row of *Combos in your deck*, is the same journey backwards.

**The card goes into the main deck, not onto the end of the box.** Appended below a `Sideboard:`
heading it parses as a sideboard card, so the next search suggests it again and the button looks like
it did nothing; `Commander:` was quieter and worse.

`DeckParser.addMainDeckCard()` writes at the **end of the biggest main-deck run**. Biggest rather than
last, because a section can split the deck in two and then "the deck" is a question about weight of
cards. Ties keep the later run; MTGO's `SB:` lines are stepped over. The insertion point is the same
walk `parseDecklist()` does, kept in the parser so two notions of "where the main deck ends" cannot
drift.

### When the heading and the card count disagree

A whole deck pasted under a `Commander` heading with no `Deck` heading reads literally as a
hundred-card command zone — and since colour identity is taken from the command zone, the deck is
filtered against itself. So **a command zone holding more than `DECK_SIZED_RUN = 15` cards is not a
command zone**, and its cards fold into the main deck. `test/parser.test.js` pins the threshold from
both sides rather than deriving it from the constant.

### Why the same argument does not extend to the sideboard

Tempting, and an earlier version did it. **It does not hold, because this sideboard is not the game's
sideboard** — on Moxfield it is where people park cards they are considering, with no size limit. Folding
a stash of forty into the deck would invent combos the deck cannot make, which is a worse and much
quieter failure than the one it fixes: a deck that finds nothing is obviously wrong, while a deck that
finds four combos it cannot assemble looks like a good result. Pinned at 1, 15, 16, 40 and 120 cards so
the argument has to be re-made rather than re-discovered.

Three details, each invisible when wrong: **it goes through the form**, so `requestSubmit()` is what
disables the button and re-reads both boxes; **the list is saved before the search**, not on the typing
debounce; and **the status line survives the search**, handed to the next one rather than replaced 200ms
later. The layout test presses the button and asserts the deck ends up holding **more combos than it
did**, because an append that forgets to search again looks fine on screen.

### Taking one back out

**− Remove** sits on every row of *Combos in your deck*, because that panel is ranked by what cutting a
card would cost — every row is already an argument about keeping it, and the next step was to go and find
the line in the box by hand.

`DeckParser.removeDeckCard(text, name, key)` takes the whole line out, quantity and all: the row promises
that the card's combos go with it, and decrementing `2 Sol Ring` to `1` would leave every one of them
where it was. **Both boxes are edited**, since a commander is a card in the deck and the panel lists it as
one. **A sideboard copy is left alone** — it is not in the deck, so nothing on the page rests on it.

**`key` is required rather than defaulted, and that is the interesting part.** The name on the button is
Commander Spellbook's spelling; the line is whatever the reader pasted, set codes and all. The page passes
`DeckCombos.nameKey`, which `parser.js` must not depend on — so a default here would be that rule written
out a second time, and the failure when the two drifted would be a button that silently removes nothing.
Nothing matched is reported as an error rather than swallowed, for the same reason.

## Classifying the decklist: which bracket is it?

Two of Wizards' criteria are properties of a card list; the rest are judgements about how a deck
plays, so the page checks the two and **names the ones it did not check**:

| | |
|---|---|
| 1 Exhibition / 2 Core | no Game Changers, no two-card infinite combos |
| 3 Upgraded | up to three Game Changers, no early two-card combo |
| 4 Optimized | no limit on either |
| 5 cEDH | a choice about how you play, not a fact about the list |

**Checked against Wizards' own Commander Brackets Beta chart**, including the line that matters most:
bracket 3 permits *late-game* two-card infinite combos, which is why a two-card win puts a list at 3
rather than 4. So the page reports a **floor** and never a verdict.

**The check is a label and five pips**, under Colour identity and built from the same geometry.
Ruled-out brackets are struck through, the floor is filled, open ones are outlined — three states,
because "could be this" is not a milder version of either. **Everything else is one hover, focus or
tap away**, reachable three ways because a phone has no hover.

The pips are `aria-hidden` — five numbered circles read out as "1 2 3 4 5" is worse than nothing — so
the button carries the whole answer as its accessible name.

**"Two-card infinite combo" means a two-card line that wins**, by the same written-down inventory the
result chips use. Basalt Monolith + Rings of Brighthearth loops all day and wins nothing. A filled
template slot counts as one of the two cards.

### Whether the list is allowed is a different question from how strong it is

Two neighbouring questions come nearly free, on a line under the bracket: **cards outside the
commander's colour identity** (no new data — `cardIdentity` covers every card in Scryfall's oracle
file) and **cards banned in Commander**, read in the same pass over the same bulk file.

**Only `banned`, not `not_legal`** — that value covers everything never in the format, and reporting
it would flag a lot of fine paper decks.

**The identity is the commander's, not the deck's.** Reading it off the cards here would make every
list legal by construction, since the union of a deck's colours always contains them.

**Two accusations, kept apart** — a wrong-colour card is a decklist mistake, a banned card is the
format saying no — but **one card only ever collects one accusation**, and the ban wins.

**Silence is not a clean bill of health, so silence is what a legal deck gets.** A tick would read as
covering singleton, deck size and everything else nobody checked.

`tooMuchOfTheDeck()` in `view-model.js` is shared with the unrecognised-card rule: more than half the
deck reading as off-identity is a claim about the data, so the colour half goes quiet.

### The Game Changer list is read, not kept

Published off **Scryfall's own `game_changer` flag**, in the pass that already streams the oracle
file. Deliberately not a list in this repository: Wizards revises it with each bracket update and a
copy here would go stale silently.

The one way that breaks is the flag being renamed, and the consequence is nothing — `bracketCheck()`
returns null and the line is not drawn, which looks exactly like a deck with nothing to report. So the
refresh warns when fewer than **30** cards are flagged. Wizards' infographic lists 40 and secondary
sources report 53; 30 keeps headroom under both while still catching a half-broken flag, and both
numbers are asserted in `test/bracket.test.js`. Half a check is worse than none, which is why a
missing list draws nothing rather than a bracket based on combos alone.

## Layout and the test suites

One column on phones and tablets; from 900px the decklist sits in a sticky left column beside the
results. Section headers are 48px for thumbs.

**The page uses the desktop it is on, up to 1500px.** The shell was capped at 1140px from a time when
this was one column of prose; at 1920px that left **780px of the screen empty** while combo names
wrapped in a 714px column. Capped rather than fluid, because these rows are not prose but are not
tables either.

**Row layout keys on the row's own column, not the viewport, and the two disagree** — 704px at a 768px
window but **442px at 900px**, where the shell hands 370px to the decklist. So thresholds are
`@container rows (min-width: …)` on the two panel bodies, never media queries. `npm run verify` prints
the column width per viewport.

The layout test loads the page in a **sized iframe** rather than resizing the window: media queries
follow the iframe, and full Chrome silently clamps `--window-size` to 500px. It also runs on the **real
clock** and has the page POST its verdict back — under `--virtual-time-budget`, `caches.open()` and a
worker's `fetch` both return promises that never settle.

### Light and dark, from one set of tokens

Dark is the base. A `:root\[data-theme='light'\]` block **restates the tokens and nothing else** — every
colour is a custom property, so supporting light meant naming eight more rather than auditing 600 lines of
rules. Brass, green and red are **darkened for light rather than reused**.

- **`theme.js` resolves the two inputs into one answer** — a stored choice, else what the browser asks for
  — and writes `data-theme` on `<html>`. The CSS keys on the attribute, not a media query, so the tokens
  do not live in two places kept in sync by hand.
- **It loads from `<head>`, synchronously, ahead of the stylesheet.** A theme applied after first paint is
  a white flash. A file rather than an inline script, because `script-src 'self'`.
- **Both icons ship in the markup and CSS shows one**, keyed on the same attribute, so the icon cannot
  disagree with the colours. Nothing in JS touches the button's contents — writing text into it would
  delete the two SVGs that *are* the control.

**`opacity` is not a way to make a colour quieter** — it applies after the colour is chosen and spends an
already-allocated contrast budget invisibly. `--faint` is the token for text below `--muted`, and it is
**only safe on `--bg`**.

### Two browser test suites, and which check belongs in which

| | `tools/verify-layout.js` (`npm run verify`) | `e2e/` (`npm run test:ui`) |
| --- | --- | --- |
| **What it does** | *measures* the rendered page | *uses* the rendered page |
| Typical assertion | "no dot is drawn outside the viewBox" | "hovering a card dims the rest" |
| Input | synthetic: it dispatches `pointerenter` | real: a pointer that moves, a finger that taps |
| Dependencies | none — it drives headless Chrome directly | Playwright, fetched for the run |
| Widths | four, in an iframe sized per viewport | two device profiles |
| Runs in | ~6s | ~20s |

**Geometry goes left, gestures go right.** A dispatched event will happily light a card a real mouse
could never reach — the Playwright suite is what noticed that a map card's press target is its dot
rather than the middle of its label box.

Both drive the real files against the same deck in `test/fixtures/dataset.js`. One fixture, because a
case added to one copy and not the other is a claim only half the tests make.

### The numbers in this file are checked

`npm run check:readme` compares countable claims in this prose to the files they describe, and CI runs
it. **No count of the claims is written here on purpose** — it would be an unchecked number in the one
section about unchecked numbers, and it had already drifted once.

| claim | counted from |
| --- | --- |
| `lists all 1,079 results Commander Spellbook publishes` | `result-tiers.js` |
| `All 451 hand-written rows` | `unofficial.js` `COMBOS` |
| `and the three stand-in rules` | `unofficial.js` `STAND_INS` |
| `**<count>** candidates have been read`, in *The audit* | `research-log.js` `PASSES` |
| `Templates resolved \| 148 \| **134**` | `templates.json` |
| `**134** (14 skipped)` | `templates.json` |
| `Cards in the file \| 21,769 \| **12,472**` | `templates.json` |
| `29 query-less templates are recorded` | `templates.json` |

**A pattern that matches nothing is a failure, not a pass.** A checker that finds no claim and exits 0
turns "nobody verified this" into "this was verified", so rewording a sentence out from under a check
fails the build and names which claim to re-anchor. A matched claim also has to survive its own sentence:
English restates a figure with "which N", "those N", "all N", and the checker scans for those inside the
anchor's sentence. The stand-in rules are the interesting anchor — the count is spelled as a word,
because the day there were two the sentence that had to change was "the one stand-in rule", which no
digit-matching check would have noticed.

**Only what this repository can count.** Everything measured against the published database is a snapshot
of somebody else's data, so it stays prose and stays the kind of number to re-measure rather than trust.

### The decisions live where a test can reach them

The layout test proves a panel is not empty. It cannot prove the panel is telling the truth, because **a
wrong number renders exactly as happily as a right one**. So `view-model.js` holds the decisions — pure
functions of a search result, no `document` anywhere in the file: `pickedSentence()`, `bracketProse()`,
`sizePills()`, `splitParts()` and `timingSentence()`. **If getting it wrong would produce a page that looks
right and says something false, it is a decision.** `app.js`, `tiers-page.js`, `page-dom.js` and the four
`render-*.js` are not unit-tested by design — they belong to `verify` and `test:ui`.

### What the layout test proves

Fifteen runs: four viewports (390/768/1440/1920px), two tier-page runs, three that exist because the thing
they check fails *silently*, three that press the unofficial panel, and three for a deck with no commander
marker, a sideboarded deck and the theme toggle.

The three silent ones: **`desktop (no worker)`** deletes `Worker` and asserts the in-page fallback
answered — via `data-via`, since "something answered" proves nothing; **`share link`** opens the copied URL
in a fresh page holding a *different* deck in `localStorage`; and **`desktop (asset-stamped)`** serves
every asset with `?v=` from a path that **refuses unstamped `.js`**, because on a real host an unstamped
URL loads fine and a dropped stamp is otherwise unobservable.

Assertions riding along inside the layout runs, each because the failure is invisible: **+ Add to deck**
leaves the deck holding *more combos than it did*; **the bracket line** strikes the right pips and
announces the whole answer through the button's accessible name; **the theme toggle** repaints, beats the
system preference and shows exactly one icon; **Compare all N** is read as a real `href` naming every card;
**every unofficial row carries its pin**, counted against the rows of ours in the merged list, since a lost
pin credits our work to Spellbook; and **the combo map** is read back as real circles inside the viewBox,
in three computed colours, growing a card when one is added.

Three habits the suite enforces:

- **Never pin a check to "the first row".** `.combo:first-child` reddened three checks about tier order
  and the fold when the panel was reordered — ask by the shape the check needs, and **scope both halves of
  the assertion to that row**. The same trap in a new place: a combo row now only renders inside a card's
  disclosure, so `verify` **opens them all before it measures anything**. Left shut, every rect is zero,
  the heading, chip, pill and divider checks read boxes the browser never laid out, and they pass.
- **Assert what a reader sees, not `textContent`** — the official/unofficial split is in the DOM twice, so
  `visibleTextIn()`. And `boundingBox()` coordinates do not scroll, so use `locator.click({ position })`.
- **A check nobody has seen fail is a check nobody has seen work.** A fixture can also stop supplying the
  case a check needs — when `COLLAPSE_FROM` moved, the page drew no collapsed row and every assertion about
  that shape would have passed while checking nothing, so the run says so instead. When that shape left the
  page for good, the checks left with it rather than being kept green against nothing.

## How it works

Static site, zero dependencies, no build step. Every module is an IIFE exporting `module.exports`
under Node and a named global in a browser, so logic is unit-testable without a DOM.

| File | Global | Owns |
|---|---|---|
| `index.html` / `style.css` | — | the page. Both HTML files carry a CSP: `default-src 'none'`, scripts and styles `'self'`, `connect-src` naming only `raw.githubusercontent.com` and Archidekt, `form-action 'none'` |
| `parser.js` | `DeckParser` | decklist text, Moxfield/Arena/MTGO exports, deck URLs, dropped files |
| `result-tiers.js` | `ResultTiers` | the tier inventory — data, no logic |
| `combos.js` | `DeckCombos` | matching, suggestions, slots, bracket, `standInRows()`, `decode()`, the ordering helpers |
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
| `render-suggestions.js` | `RenderSuggestions` | *Combos in your deck*, suggestions, unofficial panel |
| `render-map.js` | `RenderMap` | the map's drawing half |
| `deck-io.js` | `DeckIO` | the decklist, the share link, the dropped file |
| `app.js` | — | wiring, the search, bracket and legality lines |
| `sw.js` | `ServiceWorkerShell` | network-first HTML, cache-first for stamped URLs only |
| `tiers.html` / `tiers-page.js` | — | the review page for the tier inventory |
| `research-log.js` | — | **not page data** — which cards have been swept and what each pass found |
| `templates.json` | — | generated card list behind every template slot, checked in |

- **`search-worker.js` `importScripts` result-tiers → combos → unofficial → search, in that order**
  (each reads the previous at load time). Not `parser.js`, not `graph.js`, not `combo-steps.js`.
- **Load order is load-bearing.** A new script goes into `index.html` **and** `search-worker.js`.
- `tiers.html` loads `combos.js` for one function, `DeckCombos.decode()`.
- `research-log.js` breaks the module shape — the browser never loads it, so it is plain CommonJS,
  linted with the tools. `test/lint-config.test.js` fails if a script matches no lint block.
- **`combos.json` is built by CI on the `data` branch — never commit it.** `steps/` ships beside it,
  gitignored.
- `e2e/server.js` serves the repository as it deploys with `combos.json` answered from the fixture.

## Why the data is published, not queried live

Commander Spellbook's API only accepts **browser** requests from their own site and localhost:

```python
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^https://(\w+\.)?commanderspellbook\.com$',
    r'https?://localhost:\d+',
]
```

CORS applies to browsers, not servers, so `.github/workflows/update-data.yml` fetches the database in
CI and force-pushes `combos.json` as a single orphan commit to the **`data` branch**. The page reads it
from `raw.githubusercontent.com` and matches in `combos.js`. **The `data` branch is a build artifact —
never branch from it or PR into it.**

Consequences worth knowing: combo data is as fresh as the last workflow run (daily cron + manual
dispatch), and which snapshot you have is printed at the bottom of the page; combos requiring a
*template* are excluded from suggestions but not from results; and if no pasted card is recognised,
colour filtering is switched off rather than guessed at.

**The matching runs in a worker.** Downloading, parsing and walking ~100k combos touches no DOM, so
`search-worker.js` does all three off-thread and posts back only what gets drawn, keeping the parsed
dataset for the session — the second search is a walk over data already in memory (~115 ms for a
100-card deck). A browser with no `Worker`, or one that dies mid-search, falls back to searching in the
page: same code either way, `search.js` loaded both ways rather than duplicated.

### What the payload does to keep its size down

**Two fields that repeat are published once each.** Across 103,737 combos there are 1,079 distinct
result strings and 7,364 distinct card names — `"Infinite ETB"` was written to the file some forty
thousand times. Both are now indices into `names` and `results` tables at the top of the payload.

| | file | on the wire | heap | parse |
| --- | --- | --- | --- | --- |
| before | 26.37 MB | 2.73 MB | 69 MB | 170 ms |
| after | **9.37 MB** | **1.72 MB** | **35 MB** | 165 ms |

**The heap number is the one that matters.** `JSON.parse` builds a separate string per occurrence, so
the old payload landed as roughly half a million short strings the worker then holds for the session.
`DeckCombos.decode()` resolves the indices once and hands back **the same string object** for every
occurrence. Keeping the indices and teaching thirty-odd call sites to compare integers was measured at
the same 35 MB — the saving is in the sharing, not the integers.

**Anything loading `combos.json` must call `DeckCombos.decode()`** right after the parse. It is a no-op
without the tables, so fixtures work — which is why harnesses serve through `asPublished()`.

### The combo id is not published, because it is derivable

A Spellbook variant id is the combo's card ids in ascending order joined with `-`, then each distinct
template id prefixed with `--` (`1110-4694-7839--112`). So the payload ships **one card id per distinct
card** in a `cardIds` table aligned to `names`, and `DeckCombos.rebuildId()` puts them back. With the
interning, that is **26.37 MB → 7.00 MB** on disk and **2.73 MB → 1.27 MB** on the wire.

**Where the card ids come from is the careful part, and it is not upstream.** A field they rename would
arrive as `undefined` inside a URL rather than as an error. They are recovered from the combo ids we
already hold: a card's id must appear in the id of *every* combo it is in, so intersecting those sets
narrows each card, and a solved card frees its id from every other candidate set. Three rounds settles
7,241 of 7,364.

**Nothing is trusted on the strength of that.** The fetcher rebuilds every id, compares it to the real
one, and **a row that does not rebuild exactly keeps its literal id** — 162 rows on the current
snapshot. **Never let the permalink path guess:** a broken page announces itself, and a link that works
and shows a different combo does not. `tools/check-snapshot.js` refuses a row with no `id` and no way
to rebuild one, calling the page's own `rebuildId()` rather than a copy.

### The shell offline, and why the HTML is the one thing not cached first

A reader who has searched once holds the whole snapshot on the device, and plane mode still failed on
`index.html`. A service worker is safe here because `tools/stamp-assets.js` already rewrites every local
`src=`/`href=` to carry `?v=<sha>` at deploy time, so every asset URL is immutable.

**The asymmetry is not a simplification waiting to be made.** `index.html` is deliberately *not* stamped —
it is the document carrying the new stamps — so the worker is **network-first for the document and
cache-first for everything else**. **And cache-first is only for URLs that carry a stamp**: a bare
`app.js` is what local work, `verify` and `test:ui` all serve. Both are *stored* either way, which is what
makes an unstamped local page work offline too.

**The precache list is not maintained by hand** — `stamp-assets.js` writes it into `sw.js` from the same
walk that stamps the pages. **The exception, named out loud:** five files no `src=` references, because
`app.js` constructs the worker and both it and the fallback load their scripts themselves;
`test/service-worker.test.js` reads those names back out, asserts the worker's strategy directly as the
pure function it is, and fails if either stops holding. **The payload is not the worker's business** —
`search.js` owns that URL, and two caching layers over one disagree eventually. Real-worker behaviour is
`e2e/offline.spec.js`.

### Downloading the database once, not once a visit

The published file is **1.7 MB on the wire** (~9 MB parsed, 35 MB decoded), served with `max-age=300`
— so every visit downloaded the whole database again.

It is now kept in **Cache Storage**, keyed on the URL. A visit that finds a copy uses it and
revalidates **in the background** with `If-None-Match`, so a 304 costs a few hundred bytes. A newer
copy is stored for next time rather than swapped in mid-session.

**An abandoned cache version is deleted, not just ignored.** Bumping `CACHE_NAME` stops the page
*reading* an old copy; every cache matching `mtg-combo-finder-data-` that is not current is now
dropped, once per session, never awaited, every failure ignored.

**Nothing ever waits on the cache.** Every call is raced against a 1.5s deadline, because Cache Storage
can do worse than fail: under a virtual clock `caches.open()` returns a promise that never settles,
giving you a page stuck on "Downloading the combo database…" forever. Writes are never awaited either.
`test/search.test.js` covers a cache that hangs, one that throws, one returning a stale copy, and a 304
against a 200.

### What the search cost, in the footer

**`ready in 1.4s (download 0.9s · parse 0.4s · match 0.1s)`**, beside the snapshot date. In the footer
rather than a devtools trace on purpose: the machine worth measuring belongs to somebody who will never
open one.

**The first phase is named for where the bytes came from.** `msFetch` times `fetchDatabase()`, which
either downloads or reads the copy on disk — two operations three orders of magnitude apart, both once
called "download". It reads `cache 39ms` on a cached load now. **Only the phases that happened**: a
second search within a session has no fetch and no parse, and the line falls back to `ready in 0.1s`,
because printing `download 0ms` would report a skipped phase as an instant one.

**This is what the data-side decisions were missing.** A review argued for sharding the payload and
keeping a decoded copy in IndexedDB, both justified by numbers nobody had collected. The first cold
reading off a real phone was `download 1.5s · parse 61ms · match 64ms` — **the parse was 61 ms**, closing
the IndexedDB idea by a number rather than an argument, and **the download was 94% of the search**, which
is why the combo id stopped being published.

### Colours come from the cards, not from a commander

The commander used to decide the deck's colours, which meant finding one when the box was left empty —
three signals and a shortlist. All of it is gone (`detectCommanders()`, the sorted-export heuristic, the
published `commanderNames` list): **every card in the list is a card the deck plays**, so the union of
their colour identities is the deck's, and no card can be wrong about its own colours. The commander box
stays, because a commander is a card in the deck. **One consequence, accepted:** a Mardu commander over a
list with no red card reads as the colours actually present.

### Use the bulk export, never the paged API

The fetcher reads **`https://json.commanderspellbook.com/variants.json`**, the same bulk file
Spellbook's own frontend uses. One request for the whole database.

That file is **over 512 MB**, past the longest string V8 will build, so `res.json()` dies.
`tools/fetch-combos.js` streams the response and pulls out one variant at a time with a small
hand-written scanner; `test/scanner.test.js` feeds it chunk sizes down to a single byte.

Do not "improve" this by paging `/variants`. That needs ~300 requests and their rate limit is a
**cumulative quota, not a per-second throttle**: 4 req/s was cut off after 120 pages, and slowing to
1 req/s was cut off *earlier*, at 78, with two minutes of backoff never clearing it.

### The publish is gated on yesterday's snapshot

The `data` branch is a single orphan commit, force-pushed — so **there is nothing to roll back to**.
The fetcher's own guards (refuse zero combos, refuse fewer than 1,000 card identities) do not compare
today against yesterday, so a half-published upstream export passes both and overwrites the good one.

`tools/check-snapshot.js` runs between the fetch and the publish and compares four counts against the
published copy: combos, card identities, Game Changers, and template cards. Each is a subsystem that
goes quietly dark rather than loudly wrong. **A fall of more than 10% in any of them stops the
publish.** It also checks the shape of every row, not a sample — an upstream rename does not error, it
produces rows the page renders blank.

Three things it deliberately does **not** do: block the first publish, fail when it cannot reach the
published copy, or decide that a real shrink is impossible — re-run with **allow_shrink** ticked when
Spellbook has genuinely retired a family of combos.

**It runs before the publish, unlike `verify-unofficial.js`, which runs after.** That one checks our own
citations, and holding today's combos back over a stale citation is the wrong end of the stick.

### Colour identity comes from Scryfall

Spellbook's `CardSerializer` exposes name, images and type line but **not** colour identity, so
`tools/fetch-combos.js` also streams
[Scryfall's oracle-cards bulk file](https://scryfall.com/docs/api/bulk-data) and publishes a
name → identity map, reading the `game_changer` flag in the same pass. **That map is the only thing colour
filtering rests on**, and it is the most load-bearing external data here — the first published dataset had
`cardIdentity: {}` because the fetcher looked for a field that does not exist and the guard turned that
into an empty map rather than an error.

**Tokens must not be published.** Scryfall's file contains tokens whose names match real cards on the front
face, which once zeroed the identity of **1,901 real cards** in a published snapshot and silently
mis-sorted them into "Other colours". The fetcher drops `token` / `double_faced_token` / `emblem` /
`art_series` / `vanguard` layouts, and `identityIndex()` additionally refuses to let a colourless entry
displace a coloured one.

### Telling the reader which cards were not recognised

`1 Sol Rimg` is a card line by every rule in `parser.js`, so it lands in the deck, matches no combo, and
used to be never mentioned again. An old spelling, a card printed since the snapshot, and a token line
out of an export all failed the same silent way.

**The signal already existed and was thrown away.** `unrecognizedCards()` is the walk `deckIdentity()`
already did against `cardIdentity`, keeping the misses — no new download, no new pass. **It says so above
the results, not in a disclosure**, in the reader's own spelling, and **claims what is known and no
more**: *this snapshot* has no card by that name.

**The constraint that decides the whole feature: a thin map must produce silence.** An absent or empty
map says nothing, and more than **half the deck** unknown says nothing either — the answer is then about
the data rather than the deck. Half, and not something tighter, because a reader checking three cards
with one typo is 33% unknown and deserves to be told.

`combos.js` returns facts only; `view-model.js` decides whether any of it is worth saying and how it is
phrased; `app.js` draws it.

### Known gaps in the published data

Spellbook authors a combo and generates variants from it, and that generation is uneven: a combo published
for one card is sometimes missing for a functionally identical one. The page reports the data faithfully,
so the gap shows up as a card appearing in fewer combos than its twin — which reads as a bug here and is
not one. Soul Warden appears in 149 combos, Essence Warden 121 and Lunarch Veteran 90, three cards that do
the same thing.

**A high substitution score is not a verdict.** Two cards filling the same slot in 1,384 other contexts
says they are interchangeable *somewhere*, not here: Camellia + Peregrin Took looks like it should combo
with any sacrifice outlet and does not, because that loop pays `{2}` and the outlet has to produce mana or
eat the Food itself. Whether a substitution holds is a question about the cards, and this database cannot
answer it either way.

## Unofficial combos: the page's own second opinion

Everything above comes from Spellbook and is shown on their authority. `unofficial.js` is the one
exception — the surviving output of a substitution audit, rendered in its own panel below **Combos in
your deck** and **never counted among them**.

### The row says whose it is, so the list does not have to

Two panels list ours and Spellbook's together. **Suggested additions** used to draw two lists with a
heading between them, which made "did somebody publish this" the property that decided where a row
*sat* — so a row of ours went below the fold and away from the family it belongs to.

So the row carries it instead: **an `unofficial` pin before the confidence pin**, reading *unofficial ·
verified*. Those are separate claims and the second does not imply the first. **The counts stay apart**
— `+3 official · +1 unofficial` was never about ordering, and "+4" and "+4 of our own" remain different
claims. So does the panel.

The pin is drawn on **every** unofficial row, including the ones in that panel where it agrees with the
heading. That redundancy is deliberate: the alternative is a flag whose two states have to stay right at
six call sites, and whose failure mode is a missing pin in a merged list — which silently credits our
work to Spellbook.

### Reading a card when Scryfall is unreachable

> ### Read the oracle text. Every card. Before reasoning about any of it.
>
> Not "recall it". Fetch it and paste it into the log. A wrong rule-out produces no row, no test failure
> and no complaint — only a card that looks well-covered. `research-log.js` will not accept a pass without
> verbatim text for every card in `cards`.

**`tools/lookup-card.js` asks three sources in this order and says which one answered:**

1. **`card-text.json`**, the committed cache of Scryfall's wording, filled on a runner by the *Cache card
   text* workflow. No request, so it works from a sandboxed session. **Never hand-write into it** — only
   the workflow does, or it becomes the unverified recollection this rule exists to stop, wearing
   authority.
2. **Scryfall live** — 403s at CONNECT from an agent sandbox; fine on a runner.
3. **Forge card scripts** on `raw.githubusercontent.com`, banner-marked as Forge's wording: no colour
   identity, legalities or printings. **Cross-check anything the reasoning turns on against
   [XMage](https://github.com/magefree/mage)**.

**The ordering is the whole design.** If a live fetch outranked the cache, every pass run from a sandbox
would fall through to Forge exactly as before and the cache would be dead weight that looked like it was
working. `test/lookup-card.test.js` pins it.

The cache is **normalised, not raw** — about 300 bytes of a 3–5 KB Scryfall object — because "a card's
oracle text arrives as a diff somebody reads" is the argument for keeping it in the repository. Written
sorted, and every entry carries the **day** it was read rather than a timestamp, so a re-fetch of unchanged
text is not a diff. Forge's path rule was **derived by probing, not guessed**, and resolves 454 of 454
names chosen for accents, apostrophes, dots and `//`.

**Every card Forge answers is printed under a banner saying so**, because this tool's output gets pasted
into `unofficial.js` rows that exist to cite their evidence. `verdict()` decides which of four outcomes
applies as a function of the two answers rather than branches buried in the printing, because both ways of
getting it wrong are invisible: Forge's wording passed off as Scryfall's, and a refused network reported as
a typo. **A blocked host and a typo are identical from inside a tool**, so it says "check the spelling"
only when Scryfall was reachable enough to say the name is unknown.

**And the file-per-card shape has a use nothing else does**: the whole snapshot fetches at once, every
distinct card name in **72 seconds at twelve concurrent requests**. Given every card's text a slot can be
*enumerated* rather than sampled, because Forge's cost line is structured. **The filter proposes; it does
not decide** — two of the eight that pass turned up died on reading, both in the *effect* column where no
cost filter can see.

### What this cannot find: a card Spellbook has never used

The audit works by substitution *between two published cards*, so both halves have to be in the data.

A card the database has **never used at all** is therefore invisible to it, and not by accident.
Hammerhead, Maggia Boss is named by **zero** of 103,675 combos, which closes three doors at once:
nothing to list; **nothing to substitute**, so the method has no opinion about him rather than a negative
one; and no slot to arrive through, since Spellbook enumerates sacrifice outlets by name rather than
templating them — `tools/research-coverage.js` checks that against live data and reports that not one
template name mentions sacrificing.

**So the only way in is to read the card.** Hammerhead says *"Sacrifice another creature or artifact:
Put a +1/+1 counter on Hammerhead"* — and Bartolomé del Presidio has one ability, the same sentence, the
same body. Spellbook publishes **1,674** combos naming Bartolomé and none naming Hammerhead. The colour
is what earns its keep: Hammerhead is mono-black where Bartolomé is white-black, so every one of those
lines is an Orzhov combo a Golgari deck can actually run.

### One card, 1,893 combos: why this one is a rule and not rows

Four rows can be written by hand; nearly nineteen hundred cannot, and a file with 1,893 copies of a
published combo with one word changed is not evidence anybody can check. (That is Spellbook's data on
the morning it was read — `npm run verify:unofficial` is the live figure, and it moves.) So `unofficial.js` has a second
export, `STAND_INS` — a `card`, a `confidence`, and a `for` list of the cards it stands in for with a `why`
on each. `standInRows()` in `combos.js` works the rows out against live data, so the evidence is *looked
up* rather than typed and cannot cite a retired combo. Order in `for` is preference, not membership, and
rows with a template slot resolve it against your deck *minus the swapped-in card*, since a card cannot
both be the swap and fill a slot beside itself.

**What the rule deliberately does not reach**, reported by `tools/verify-unofficial.js` on every refresh:
loops that sacrifice the outlet itself, and **our own rows** — a rule reads published combos only, since
generating from an unofficial row would be a swap on top of a swap. Where that second step is worth taking
it is written out by hand with both swaps named, and a test holds that nothing goes deeper than two steps
and that the second step is a declared stand-in rather than another judgement.

**And the evidence is checked, both kinds.** `verify-unofficial.js` reads every hand-written row's
`from.id` against live data and fails if it does not resolve or names different cards. A stand-in rule
fails a quieter way instead — a source card misspelled by one accent matches nothing, generates nothing,
and says nothing about it — so the tool counts what each rule reached. **The card swapped *in* carries an
id** for the same reason, and `inId: null` is a claim in its own right: *the published data has no such
card*.

**Names stayed the key, and that was measured.** All 7,364 card names are distinct and `nameKey()` produces
**zero** collisions, while **123 cards (1.7%) have no id at all**, every one a real combo piece — the id is
the *less* complete identifier here, and a decklist is names in any case. `nameKey()` matches the front
face exactly, so `Chatterfang` is not `Chatterfang, Squirrel General`; `tools/combos-with.js` refuses an
unknown name and prints its nearest matches, rather than reporting zero combos and blaming Spellbook.

### Why it is a separate panel and not a badge

The difference is not a property of a row — it is the difference between *somebody published this* and
*we worked this out*, and a reader deciding whether to trust a line needs that before they read the
cards. The same reasoning keeps these rows out of the combo count and the bracket check; the bracket in
particular is a claim about what a deck is *allowed to be*.

### A combo heading is a list of cards, so it breaks between them

Inline text breaks wherever it runs out of room, which on a phone is mid-name. Each card is a flex item in
**both** shapes, so a heading too wide for its column breaks *between* cards and never inside a name.
Below **560px of the row's own column** every card takes its own line — the same 560px the row's other
narrow/wide decision uses, rather than a third measured number.

- **Cards must not shrink.** Flex items shrink by default, so headings still split a name in a column wide
  enough for the whole thing: nothing was too wide to place, the items were being squeezed.
  `flex: 0 0 auto` moves a card to the next line instead.
- **The `+` belongs to the item it introduces**, drawn as a `::before`. As its own span it was a flex item
  free to end a line alone. `display: none` rather than an emptied span, so it leaves the a11y tree.
- **One heading item is not a card** — a template slot, an outlined pill. **The outline goes on an inner
  element, never on the flex item itself**, or the separator lands inside the outline it should sit beside.
  Geometry alone cannot check that, so the run asserts it structurally. There were two of these; the
  `any of N` fold was the other.
- **The link line's separators only exist between two offers on one line.** As flex items of their own, a
  wrap moved the chip to the next line and left the dot behind.

`npm run verify` asserts both shapes from geometry rather than `textContent`, and skips headings inside a
closed disclosure — every rect there is zero, so a perfectly laid-out page would report as broken.

**The column a row is measured against is the container the query actually answers, not the panel body.**
A combo row sits inside a card's disclosure, which is a `rows` container of its own — 450px of a 689px
body at 768px. Read off the body, the run demanded the inline shape of a column too narrow to hold it and
called a correct page broken; and the row's *gutter* still answers the body, so the two are read
separately.

### Where the second number goes, and why it is a second number

Leaving our rows out of two panels answered their own questions wrong: **Combos in your deck**
omitted Hammerhead entirely, and a panel that exists to price a cut cannot price it at zero. So both count
both — **the total, and whose it is underneath**, in a gutter down the left:

```
   15   │ Scurry Oak                    ← 10 of Spellbook's, 5 of ours
COMBOS  │ EDHREC · Scryfall · − Remove
 10+5   │ 2 × 2-card   13 × 3-card
        │ ▾ Combos this unlocks         ← the fold is the card's, not the row's
```

**A column and not a badge after the card name**: a badge lands wherever the name ends, so eighty totals
sat at eighty offsets. The gutter is one fixed `calc(3.8rem - 2px)`, sized against the worst real split
(`0+1889`), which `npm run verify` builds as a **fixed four-digit probe** rather than hoping the fixture
contains it — so it stays put while Hammerhead's own count drifts with the snapshot. It also **sizes
nothing** — while it shared a grid row with the card's name, a row carrying a split pushed everything below
it down. **Absolute divider positions are deliberately not written down here**; `npm run verify` prints
them per viewport on every run.

**The divider down a suggestion row is many `border-left`s** — one per block in the card's column
(`.row-main`, `.alternatives`, the disclosure), each reaching back over `--col-gap` with a negative margin
to land on the same pixel. Three consequences: **the gutter draws none of it**, and `verify` fails if a
`border-right` reappears there, since a second line at the same x is invisible and undoes the whole thing;
**spacing inside those blocks is padding, never margin**, because a margin opens a hole in the line; and
**a new block there must carry its own piece**, or the line stops at it. The layout test walks the pieces
in order and reports the one that stepped sideways, lost its border, or left a gap.

**The words "official" and "unofficial" are dropped where the row is narrow**, and the claim went into the
split's **accessible name** rather than a tooltip — `role="img"` with an `aria-label` spelling both halves
out. Cutting the words *without* that would hide half the answer.

**Two thresholds, both on the row's own column and never on the window**, because they answer different
questions:

| | at | why |
|---|---|---|
| the split spells itself out | **560px** of column | a 12rem gutter still leaves the card name 325px |
| the links join the name's line | **750px** of column | the links *and* the add button are 245px; at 560px that left the name 80px, and only 2 of 198 real names kept their links inline |

**Thresholds are measured against what they cost the card name, never matched to each other.** The column
is **wider at 768px (689px) than at 900px (427px)**, because 900 is where the two-column shell starts and
hands 370px to the decklist — so a `min-width: 900px` media query would spell the words out in the
narrower of the two. Both are checked as a rule rather than as repeated breakpoints: the run reads the
column's width and the *visible* text, since both readings are in the DOM.

### Matching the unofficial rows costs one pass, however many rules there are

Rows are matched after the published ones, with one card of slack, out of one call.

The part written for scale is `standInRows()`. A rule could be "scan the combo list for this card", and
with twenty rules that is twenty sweeps of a 100,000-row database per search. So every rule's source
cards go into one index first and the list is walked **once**. `test/unofficial.test.js` counts the passes
with a counting iterator and holds them at one for ten rules as well as for one.

That work also exposed a bug that made the whole search faster: `identityIndex()` rebuilt an index over
all 34,715 cards Spellbook knows **on every call**, and callers ask once per row. Memoised on the dataset,
the worked deck's whole search went ~470 ms → **~180 ms**.

### What each row has to carry

Every row prints the published combo it came from, which card was swapped for which, and how far the
checking went:

| | |
|---|---|
| `verified` | the swap was read against both cards' oracle text |
| `derived` | both halves of the swap are separately published, but the specific pairing has not been read against the cards |

All 451 hand-written rows cite a published combo, and **all 451 are `verified`** — every swap read
against both cards' oracle text. `derived` is not deprecated by that and the label is not going
anywhere: **use `derived` rather than reading loosely and claiming `verified`.** The next sweep that
reasons faster than it reads will add some, which is what it is for.

`test/unofficial.test.js` enforces the shape of both halves — every row cites a real combo id, every swap
is genuinely one card in and one out against the cited combo, and every row gives a reason; every rule
names something other than itself and says why. A row that cannot say where it came from cannot ship.
Where a rule and a hand-written row produce the same cards, `matchUnofficial()` keeps the hand-written
one.

`test/fixtures/chatterfang-deck.txt` is **the standing deck for `unofficial.js`** — 103 maindeck cards
plus a sideboard that must stay ignored. The test pins the **exact rows** it unlocks, a list rather than
a count, so **a diff there is a prompt to read the list, not a failure**. It also holds those rows to
being *one card away* from the deck, catching a row that matches too loosely.

### They graduate rather than accumulate

The day a row is published it arrives in the official list on its own authority, so `matchUnofficial()`
drops any row whose card set already appears there.

**And somebody is told, which is the part that used to be missing.** The page dropping a row silently is
right for the reader and wrong for the file: the row stays in `unofficial.js` carrying a claim that is no
longer ours to make. The nightly job runs `tools/verify-unofficial.js` against the snapshot it just
published. A **broken citation** fails the job. A **graduation** is not a failure and now opens a standing
issue listing the rows that can come out, updated nightly and closed by the job once the list empties.
**Don't hand-edit that issue** — `npm run verify:unofficial` is the live answer.

### What the file costs, and the size at which it stops being source

`unofficial.js` is the largest single script the page loads and almost all of it is data. Graduation is
the only thing that takes a row out and research passes put them in faster, so the trend is up.

**No figure for today's size is written here on purpose.** It would be stale within a research pass, and
pinning a compressed size in CI is a check that can fail on a zlib version.
`gzip -9 -c unofficial.js | wc -c` is the live answer.

**At 200 KB gzipped, `COMBOS` moves to the `data` branch as JSON**, fetched by the worker and nothing
else. The mechanics are already paid for. It rests on this: `unofficial.js` is loaded by
`search-worker.js` and by nothing else, so it is never parsed on the main thread and cannot delay first
paint — what it delays is the first search on a cold load, in a worker already waiting on a 1.28 MB
database.

**That ceiling is not a licence to stop watching.** It used to say "roughly double today's rows, so this
is not close", and that stopped being true in a single pass: one four-card sweep put on 156 rows and
about 14 KB gzipped at once. Headroom is a dozen passes, not a hundred.

**And what it would cost, in the same breath:** rows stop being versioned with the code, so a row and the
matching logic it needs can ship apart — the failure being a row that matches nothing, silently;
`verify:unofficial` becomes a publish-time gate, moving a broken citation from "before merge" to "after
somebody is already reading it"; and the exact-row assertion in `test/unofficial.test.js` needs somewhere
to live that is still a unit test. **That last one is the real cost** — the first two are inconveniences,
that one deletes a check which has already caught a row matching on something too loose.

### The audit, and what it ruled out

The first sweep took 44 candidates from pairs Spellbook itself treats as interchangeable elsewhere. **35
were ruled out**, and the rule-outs are the valuable half — each is a way a "functionally identical" card
turns out not to be: the loop needs *mana* out of the sacrifice and not just a sacrifice (18); the
candidate is a strict **superset** of a combo already published (5); the loop needs a *token* out of it
(4); the token has no sacrifice ability of its own (4); the outlet has to eat artifacts (2); the partner
doubles nothing (2).

**The pass, ordered to avoid wasted reading.** `/deck-deep-dive` runs it against `tools/deck-cards.js`:

1. **Find the true peers from card text, not from a score.** A high score only says two cards fill the
   same slot *somewhere*. Stridehangar Automaton scored as Chatterfang's closest peer and is not one —
   it reads only *artifact* tokens — which ruled out 1,197 of his 1,202 candidates.
2. Take every shape a peer is published in and the subject is not, then **drop the subsumed** (a strict
   superset of a published combo is one Spellbook would never print), what is published, and existing rows.
3. **Read the survivors against the cards**, using the peer version's published steps as evidence.
4. **Write the rows citing the peer combo, and log the pass with its rule-outs.**

**Which cards have been swept is written down.** `research-log.js` carries one entry per pass — the cards,
how candidates were generated, how many were proposed, examined and kept, why each rule-out was one, and
the verbatim oracle text read. **Read it before a deep dive, add to it after**; a pass not in it did not
happen as far as anyone can tell. `test/research-log.test.js` fails the build on a row whose cards no
recorded pass covers, and on an `UNREAD` marker anywhere.

**The card-text rule is enforced because prose was not enough.** It was broken twice — once reasoning
about Chatterfang's mana cost and outlet from memory, and once ruling out **all 37** Camellia candidates
on a trigger neither card has, where the real difference rules out **2**. Thirty-five were thrown away on
a text nobody had opened, and that pass passed review and shipped.

**A pass that finds nothing is still a pass**, but **a zero has to be earned**. A *provisional* zero —
candidates filtered but not read — is the most dangerous entry the log can hold, because "found nothing"
reads as diligence and nobody audits it. A card can also be invisible to the score entirely: Academy
Manufactor's only peer sits at a jaccard of 0.05, which the 0.90 bar will never reach because the score
is a ratio. *Read the pair count, not the score, for a card this widely published.*

**Which makes the log a record of the cards somebody asked about, and nothing wider.**
`tools/substitution-scope.js` points the same method at every card: at the strict bar, **1,779
interchangeable pairs implying 4,835 combos Spellbook has not published**. Those are candidates, not owed
rows. **1,006 candidates have been read.**

**A rule-out can also be written as cards, and then a tool can act on it** — a rule-out may carry `sets`,
the exact combinations it killed, which `tools/deck-gaps.js` drops and prints. **`sets` is always a
subset of its reason**: most rule-outs are categorical and enumerate no cards, so the index answers *has
this been ruled out?* with **yes** or **nothing recorded**, and never with *no*.

**Reporting upstream is still the better fix.** When Spellbook adds a variant the next snapshot picks it
up and the row graduates on its own.

## Deck import

Commander Spellbook is *the* community combo database — other combo sites are fronts for the same data.
[EDHREC's combo feature](https://edhrec.com/combos) is officially powered by it. So "multi-site" here
means multi-site **deck import**, not multiple databases.

### Why Moxfield URLs can't be loaded

Moxfield has no public API and deliberately gates `api2.moxfield.com`: requests need a User-Agent they
whitelist, behind Cloudflare bot protection. A browser can satisfy neither — `fetch` forbids setting
`User-Agent`, and a Cloudflare challenge cannot be answered cross-origin. That is a deliberate access
policy, not a bug to work around, so the app detects Moxfield links and points at the deck's Export.
Routing through a public CORS proxy would circumvent that policy and put decklists through an unrelated
third party.

### Getting a deck in from a site we can't read

Every deck site exports a text file, and a file needs no CORS, no API and no new origin in the CSP — so
**dropping an exported deck on the form, or picking it with the button, works for every site**. Both entry
points, because they are not interchangeable: dragging is impossible on a phone or from a keyboard, and the
file picker is the one a screen reader can drive.

The care is all in refusing well. An extension is a claim, so the contents are the evidence: a file is read,
then checked for the replacement characters and control bytes that mean *this was binary and we decoded it
anyway*. Files over 1 MB are refused unread, so dropping a video fails as a sentence rather than a locked-up
tab. Every refusal names the file, says what is wrong, and ends with the way out — and the text goes *into
the box* rather than straight into a search. Decisions live in `acceptDeckFile()` / `looksLikeText()`
(`parser.js`) and `fileLoaded()` / `fileRefusal()` (`view-model.js`); `app.js` only wires them up.

### Whether another site could be a URL, and how that gets decided

Each site is one adapter plus one `connect-src` entry — *if* a browser may read it. That is one header,
and **it is not a thing to guess at: Moxfield is unsupported precisely because somebody guessed.** It
cannot be answered from a terminal either, since `curl` does not enforce CORS.

`tools/probe-cors.js` asks each site with the deployed page's `Origin` and reports the one header that
decides it, **carrying Archidekt and Moxfield as controls** so a broken run cannot be mistaken for a
refusal. **It must run on a runner** — `.github/workflows/probe-cors.yml`, on demand.

**Asked, on 2 August 2026.** The answer is that there is nothing to add:

| site | HTTP | `Access-Control-Allow-Origin` | |
| --- | --- | --- | --- |
| Scryfall | 200 | `*` | readable — *and the run's evidence that the probe works* |
| Archidekt | 200 | `http://localhost:3000` | **refused** — see below |
| Moxfield | 403 | absent | refused, as documented above |
| Deckstats | 403 | absent | refused |
| TappedOut (`/api/`) | 401 | `*` | CORS fine, but it needs a login |
| TappedOut (`?fmt=txt`) | 404 | absent | refused |
| MTGGoldfish (download) | 404 | absent | refused |

TappedOut's API allows the read but demands authentication a static page has no way to hold: every byte
this site ships is public, so a credential in it is a published credential.

### Archidekt may no longer be readable either

The Archidekt row is the control that was supposed to come back allowed. Asked as `https://archidekt.com`
they answer with that origin; asked as us they answer `http://localhost:3000`. With `Vary: Origin`, that
is a server echoing origins on an allowlist and falling back to a default. **We are not on the list**, and
a browser discards a response whose `Access-Control-Allow-Origin` names somebody else.

Measured, not confirmed against the live page — this repository is usually edited from a sandbox that
cannot reach `paludancode.github.io`. **Settle it by pasting an Archidekt URL into the live page.** If it
holds, `SITES.archidekt` in `parser.js` says `browserImport: true` about something that cannot work. The
page fails gracefully meanwhile: `describeLoadFailure()` reports a blocked cross-origin read and offers
the export hint.

## Commands

```bash
npm test                  # unit tests, node:test, zero deps — a couple of seconds
npm run test:coverage     # + the coverage floors CI enforces (Node 22.8+)
npm run lint              # ESLint, fetched per run — not installed
npm run verify            # layout smoke test — REQUIRED after any UI change
npm run test:ui           # Playwright + axe a11y (desktop + phone)
npm run verify:unofficial # every unofficial row still cites a real published combo
npm run check:readme      # the README's countable numbers still match the files

node tools/fetch-combos.js out.json [steps/]      # --no-steps skips the 103,737 files
node tools/fetch-combos.js out.json --fixture test/fixtures/export.json   # no network
node tools/templates.js templates.json            # ~13 min; --all is ~16 and only for measuring

for f in $(git ls-files '*.js'); do node --check "$f"; done   # same as CI
npx serve .                                                   # any static server works
```

- **CI**: two parallel jobs behind one required check — `static` (syntax → lint → `test:coverage` →
  `check:readme` → `verify`) and `browser` (Chromium → `test:ui`), with **`checks` needing both** so the
  name the ruleset requires never had to change. See *What the release pipeline costs*.
- **Coverage floors** sit under what the suite manages (94% lines / 90% branches / 95% functions), so
  they catch a module arriving untested rather than bickering over a line. Only files the tests load are
  measured; `theme.js` is excluded by name because its DOM half cannot run in node.
- **`verify` is not optional after a UI change.** **Skip it when the diff is docs only** — every changed
  path `*.md`; one `.js`, `.css`, `.html`, `.yml` or fixture, comment-only included, and it is not.
- **Don't sleep waiting for CI.** Runs took 102–112s as one job and should now finish in ~50–65s; poll at
  ~60s. Sleeping 190–240s wasted 12.4 minutes over six PRs, and a shorter run makes that worse.
- **`HARNESS` in `verify-layout.js` is a template literal**, so a regex loses its backslashes —
  `/\d+ combos/` becomes `/d+ combos/` and matches nothing, which passes. Write `\\d`, and note that
  **a backtick anywhere in it, comments included, ends the literal**.
- Regenerating `templates.json` is normally the **Regenerate template card lists** workflow, on a branch.

### Answering questions from the data

Seven read-only tools, each also a manual workflow, for the questions that keep coming up.

```bash
node tools/try-deck.js [deck.txt]           # what the page would show. Does NOT cover the
                                            # unofficial panel — that is matchUnofficial(),
                                            # pinned in test/unofficial.test.js
node tools/combos-with.js "Card A" "Card B" # why isn't this a combo? missing cards and slots apart
node tools/template-users.js ["Persist Creature"]   # which combos need a template
node tools/lookup-card.js "Card name"       # oracle text: cache → Scryfall → Forge
node tools/cache-card-text.js "Card name"   # runner only; "Cache card text" workflow
node tools/substitution-scope.js [jaccard] [minShared]   # how much of the space is unread
node tools/deck-cards.js [deck.txt] --unswept            # which cards carry a deck's combos
node tools/deck-gaps.js [deck.txt]          # which gaps THIS deck exposes, castable tonight
node tools/probe-cors.js [site]             # can a browser read a deck from this site?
```

`deck-cards.js` picks *subjects* and sweeps each across the whole database; `deck-gaps.js` bounds
candidate shapes to the deck's own cards and drops the sets a pass ruled out, printing what it dropped.
`.claude/commands/deck-deep-dive.md` is the whole research pass wired to the first.

`tools/research-sources.js` and `tools/research-coverage.js` answer the questions that can change — has a
second combo database appeared, and do Spellbook's templates still carry Scryfall queries.

### What a tool says about itself is not exempt

Two of these were quietly wrong for a while, in the way a tool can be: nothing failed, and a person read
the output once and believed it.

`try-deck.js` reported skipped lines by interpolating `{ line, reason }` objects into a string, so the
report was ten lines of `! [object Object]`. `deck-cards.js --unswept` computed its summary from the
already-filtered rows, so it reported **"0 of those have been swept"** every time: *0 of 33* where
`research-log.js` has **27 of 60**. **Count before you filter.**

Both decisions moved into functions the tests can reach — `skippedLines()` and `sweepStatus()`, pinned by
`test/deck-tools.test.js`. A research tool's numbers feed the queue that decides what gets swept next, so
a wrong one is the sweep going to the wrong card.

## Branching strategy

Trunk-based, short-lived branches. **Short-lived is load-bearing.** Branch off `main` as `feat/…` or
`fix/…`, push, open a PR, and hit **Enable auto-merge** — **merging to `main` is the release**, and the
branch is deleted on merge.

**`main` is protected** by a branch ruleset: a PR is required, `checks` has to be green, **branches have to
be up to date before merging**, and force-pushes and deletion are blocked. Two rules are deliberately
**not** part of it and both look like oversights — **linear history** would forbid the merge commits `main`
already uses, and **any required-approval count above zero** makes every PR unmergeable on a solo repo. The
`data` branch is not covered, and if it ever is, **it must not block force-pushes**: `update-data.yml`
force-pushes an orphan commit there nightly.

**That paragraph was false until 5 Aug 2026, when the ruleset turned out not to exist at all** — and it
read exactly like one that worked, because PRs still merged and CI still went green with nothing saying the
green was advisory. **Nothing here can check it**: a session's token is `metadata=read`, so
`/branches/main/protection` is 403 and `checks` cannot assert its own requiredness. `/rules/branches/main`
lists the effective rules and needs only read access — that, or watching a `--force` push to `main` be
refused, is the answer. Prose asserting it is configured is worth nothing.

**Up to date is load-bearing** — see *What the release pipeline costs* for what rests on it. Its price:
**auto-merge does not update a stale branch**, so a PR whose base moved waits for somebody to press
**Update branch**, which re-runs CI.

**`checks` is a job that runs no checks** — it needs `static` and `browser`, so the one required name
survived the workflow being split. `if: always()` is load-bearing: a `needs:` job without it is **skipped**
when a dependency fails, and GitHub reads a skipped required check as neutral rather than failed →
`test/workflow-pins.test.js`.

**Push protection is on.** A push carrying anything credential-shaped is rejected outright — if it fails
on a fixture or test where you were only quoting a token *shape*, that is why.

**Outstanding work is a GitHub issue and nothing else.** No backlog file, on purpose. **An issue points at
the live answer rather than restating it** — the count of unread card texts belongs in `research-log.js`
where a test caps it, not in an issue body that goes stale the first time somebody reads a card.

**This repository generates exactly two kinds of merge conflict, by construction.** Neither is a judgement
call:

1. **Append-only data tails** — `COMBOS` in `unofficial.js`, `PASSES` in `research-log.js`. Both sides add
   before the same closing bracket, so **resolution is always "keep both"**. The trap: markers land
   *mid-object*, so each side's last entry is left unclosed and the shared text after the conflict closes
   exactly one. Check with `node -e "require('./unofficial.js')"`.
2. **Counted prose in this README** — both sides bump the same numbers. **Resolution is never "pick a
   side": recompute.** `npm run check:readme` prints every real measurement.

### A fresh session's `main` is realigned before anything reads it

`.claude/hooks/session-start.sh`, registered as a `SessionStart` hook.

A remote session's clone can carry a `main` that is not the `main` anybody else means. One did: 38 commits
sharing **no** ancestor with the remote at all, because the upstream history had been rewritten after the
image was built. `git checkout main` landed 187 commits stale and `git pull` refused as divergent — which
does not look like a stale ref while it is happening, it looks like a broken repository.

So: **compare against `origin/main`, never a local `main`.** The hook makes that true rather than
documented — fetch with `--prune`, and if `main` is not checked out and differs from `origin/main`, tag
what the remote does not have as `archive/main-<sha>` and realign. It does nothing when this is not a
remote session, when `origin` is unreachable, when `main` is checked out, or when `main` already matches.

Because it skips silently in those cases the rule still stands; if you meet the fossil,
`git reset --hard origin/main`. **Nothing is installed there, and nothing should be** — it runs
synchronously, so every line is latency on every session.

### What the release pipeline costs

PR opened → live is **~2.9m** median: CI 1.9m, auto-merge 0.5m, merge → live 27s. Queue time is 0s
everywhere, so none of it is contention.

**Nearly all of it is CI, and nearly all of CI is browsers** — as one job, **83 of 96 step-seconds were
three browser steps in a row.** Two of the three share nothing, so they are now two parallel jobs:
`verify` drives the runner's pre-installed google-chrome, `test:ui` drives Playwright's own Chromium.
Playwright also gets 4 workers rather than 2, because a GitHub-hosted runner has 4 vCPU. **What the
Chromium cache saves is unmeasured**: its 22s step was never split between the download and the apt half
of `--with-deps`, because the job log redirects to a host a sandboxed session cannot reach.

**CI does not run on pushes to `main`.** It was 39% of all Actions minutes re-testing a tree already
tested — `actions/checkout` on a `pull_request` event checks out the *merge* of head into base,
byte-identical to the branch tip in **36 of the last 39 merges** — and it never protected the deploy, which
fires on the same push with no `needs`. **What makes those 36 into 39 is *Require branches to be up to
date*; turn that off and the `push` trigger belongs back in `ci.yml`.** Gating the deploy on CI was the
rejected alternative: merge → live would go from 27s to over two minutes.

Every figure above, and the two changes measured and rejected, is in the commit that made them.

## Deploying

`.github/workflows/deploy.yml` publishes the repo root to GitHub Pages on every push to `main`.

**Asset URLs are stamped with the commit SHA, and nothing is listed by name.** Pages' CDN caches by full
URL and a deploy purges nothing, so an unversioned URL can serve a stale file — or new HTML with old JS —
for up to ~20 minutes. `tools/stamp-assets.js` reads whatever each page references, stamps all of it,
re-reads the file, and **fails the deploy if anything local is left bare**.

That inversion is the point. The `sed` it replaces carried a hand-written list and asserted a count, which
catches a *rename* and cannot catch an *addition*: `unofficial.js` and `graph.js` each shipped that bug,
and **it is invisible outside production**, because an unstamped URL resolves perfectly well — it just
serves whatever the CDN cached. Writing it also caught `theme.js` and `favicon.svg`, never stamped at all,
and a `verify-layout.js` fixture built from its own regex that proved a stamped page worked while
production served one that was not. Both go through `rewriteAssets()` now. `search-worker.js` needs no
entry — it stamps its own imports out of its query string.

**Action versions are kept on a supported Node runtime**, and the runtime an action uses is declared in its
own `action.yml` — reading those rather than the release notes is the only way to know. **CI cannot verify
these**: `checks` never runs the deploy workflow, so a wrong version shows up only on the next push to
`main`. A failed deploy leaves the previous deployment serving.

### The footer says which build it is and when that build arrived

`Build 18965e5 · deployed 2026-08-25 15:00:00 UTC`, on both pages, rewritten by one step in `deploy.yml`.

**Deploy time, not commit time** — "am I seeing the new version or a cached one?" is a question about
*time*, and the two come apart exactly when it matters, since a re-run publishes an old commit.
**Fixed-width, and labelled UTC**, because unlabelled, a deploy that landed a minute ago reads as two hours
stale to anyone on UTC+2. **Both markers are guarded**, because an unstamped footer looks completely
normal: the step greps for each substitution it just made and fails the deploy if either matched nothing.

**And the deploy reads it back off the live page.** `deploy-pages` succeeding means the artifact was
accepted, not that anyone visiting gets it. The last step fetches the live URL and looks for the SHA it
stamped — twelve attempts 10s apart, each with a different cache-busting query so a CDN edge cannot answer
every retry from one stale entry. A run that never sees the new SHA **fails the deploy**.

That settles a rule that could not be followed: **never confirm a deploy from the Actions API** — but
reading the footer is impossible from a sandboxed session, where `paludancode.github.io` is 403 at CONNECT
and there is no branch to read it off, since Pages deploys from an artifact. With the check inside the
deploy, **"the deploy job is green" now carries what reading the footer used to**, and is the one case
where a job's conclusion is enough on its own.

**The layout check measures the deployed line, not the one it serves.** Locally the footer reads `Build
local · not deployed`, twenty characters shorter, and measuring that would pass a footer that overflows in
production and nowhere else. `DEPLOYED_BUILD_LINE` in `tools/verify-layout.js` holds the real line and both
harnesses substitute it before measuring — the *widest* the deploy can produce rather than a sample, since
seven SHA characters and a fixed-width timestamp mean there is exactly one production line to check.

## Credits

All combo data and the combo search itself come from the amazing
[Commander Spellbook](https://commanderspellbook.com/) project.
