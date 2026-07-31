# MTG Combo Finder

**▶ Live site: https://paludancode.github.io/MTG-Combo-Finder/**

Paste a Magic: The Gathering decklist and find the combos hiding in it — plus
**ranked suggestions for which single card to add to unlock the most new combos**.
A bit like [Commander Spellbook](https://commanderspellbook.com/)'s "Find My Combos",
but the matching happens in your browser against a published copy of their
database — see [Why the data is published, not queried live](#why-the-data-is-published-not-queried-live).

## Features

- **Combos in your deck** — every known combo your current 99 (or 60) can already pull off,
  with what it produces and a link to the combo's Spellbook page for the steps.
- **Suggested additions** — every combo you're *one card away* from, aggregated per missing
  card and ranked: "add Rings of Brighthearth → unlocks 4 combos". Each suggestion links to
  the card's EDHREC and Scryfall pages and expands to show exactly which combos it enables.
  **Ties break on popularity** — see [Ranking, and what popularity is for](#ranking-and-what-popularity-is-for).
- **Take a suggestion without retyping it** — every suggestion (and every
  interchangeable alternative) carries **+ Add to deck**: the card is appended to
  the decklist, kept, and the search runs again against the database already in
  memory. See [Adding a card, and searching again](#adding-a-card-and-searching-again).
- **Which bracket the list is in** — the Game Changers your deck plays and the
  two-card combos it can win with, and the lowest Commander bracket that leaves it
  eligible for. A floor, never a verdict, and it says which criteria it did not
  check — see [Classifying the decklist](#classifying-the-decklist-which-bracket-is-it).
- **What each recommendation's count is made of** — `Thassa's Oracle +3` reads
  *1 × 2-card · 1 × 3-card · 1 × 4-card*, on the card's own line, smallest first. A
  two-card combo is a far easier thing to assemble in a game than a four-card one, and a
  count hides the difference entirely — see
  [What the count is made of](#what-the-count-is-made-of).
- **One slot away** — combos you hold every named card for and cannot assemble because
  nothing in your deck fills their slot ("a Persist Creature"). Reported separately, never
  counted among the combos you have — see [Template slots](#template-slots-a-persist-creature).
- **Interchangeable cards are one decision, not many** — Spellbook stores one variant per
  concrete card list, so a combo its own site shows as *"Spike Feeder + 1 of 8 cards"*
  arrives as eight rows. Cards that unlock **exactly** the same combos for your deck are
  collapsed into a single suggestion — "Cleric Class, or any one of these 3 instead" — and
  combos you can already assemble show their swappable part as *"+ any of 3"*. On a real
  99-card deck that took 141 suggestions down to 81 and 34 combos down to 23 rows, without
  dropping a single card or variant. **The count still says 34** — collapsing is a
  readability choice about rows, and it must not quietly shrink the number of combos the
  deck is credited with.
- **Outside your color identity** — the same ranking for cards that would require changing
  your deck's colors, shown separately.
- **Deck import** — paste an Archidekt deck URL, or paste any site's text export
  (Moxfield, Arena, MTGO `SB:` lines, TappedOut/Deckstats/MTGGoldfish plain exports).
- **Cards carrying your combos** — every card that takes part in a combo you can
  already assemble, ranked by how many. A list of combos hides this: cutting a
  card that turns up in four of them costs four combos, which is exactly what
  you want to know before trimming a deck.
- **Suggestions split by colour** — two tabs, *In your colours* and *Other
  colours*. A red card is noise for a deck that isn't red, so it goes behind a
  tab rather than into the list. **Colours are read off the cards** — every card
  in the list is a card the deck plays, so the list answers the question and
  cannot be wrong about it.
- **Collapsible results** — every section header is a collapse control, and what
  you close stays closed (kept in `localStorage`) across searches and visits.
- **Your decklist survives a reload** — the list is the whole input, and losing it to a
  refresh was a strange thing for this page to do. It's kept in `localStorage` (it never
  leaves the browser), **Clear** empties it in one press, and **Copy link** puts the deck
  in the URL so it can be shared or bookmarked. A link beats the stored list: opening
  someone's deck means seeing theirs, not the one you were last working on.
- **The data's date is on the page** — a footer line says which daily snapshot you're
  looking at, and how it got there. That matters more now a copy is kept between visits;
  see [Downloading the database once, not once a visit](#downloading-the-database-once-not-once-a-visit).
- **What a combo gives you**, as chips rather than a comma-run: game-ending
  results sort first and are highlighted, duplicates collapse, and anything past
  the fourth folds behind "+N more".

### Cleaning up combo results

Two steps, because the raw data is noisy in two different ways:

1. **At fetch time**, results whose `Feature.status` is `HU`/`PU` are dropped.
   Those are Commander Spellbook's *utilities* — internal scaffolding for
   variant generation ("mana abilities can be activated"), not things a player
   cares about. Their own `Feature.is_utility` draws the same line. If a variant
   lists nothing but utilities, they're kept, since a combo with no stated
   result is worse than a vague one.
2. **At render time**, `summarizeResults()` dedupes case- and
   whitespace-insensitively and sorts results into three tiers.

Their wording is left intact — rewriting "Infinite ETB triggers" into something
snappier risks claiming the combo does something it doesn't.

### Three tiers, three colours

| Colour | Tier | Meaning |
|---|---|---|
| 🟩 Green | `win` | This ends the game |
| 🟨 Greyish-yellow | `decisive` | Real value that something else still has to convert |
| ⬜ Grey | `other` | The plumbing a loop runs on — relevant, but not a way to win |

**Which outcome sits in which tier is written down, not worked out.**
`result-tiers.js` lists all 1,079 results Commander Spellbook publishes, by exact
name, grouped under the reason each belongs where it does. Moving one outcome
between tiers means moving one string between lists.

That is a deliberate reversal. This used to be pattern matching — "anything
mentioning damage is lethal", with exceptions bolted on — and the exceptions were
the problem. `Infinite creature tokens` is a win; `Infinite creature tokens for
target opponent` is not. `Infinite turns` is a win; `Infinite turns for each
opponent` is the opposite of one. `Infinite +1/+1 counters on creatures you
control` is a win; `on a creature` is one removal spell. Every rule needed a
list of things it must not match, which is a list either way — so it may as well
be the honest one, where you can read a decision instead of deducing it.

Two consequences, both intended:

- **An outcome nobody has classified is grey.** A result Spellbook adds with a
  new set matches nothing and stays quiet rather than being guessed at.
- **Nothing can be reclassified by accident.** A wording change on one result
  cannot drag forty others with it, because no rule spans them.

### Spotting a result from a new set

The first consequence would be dangerous if it were silent, so it is reported in
two places:

- **[tiers.html](https://paludancode.github.io/MTG-Combo-Finder/tiers.html)** —
  the review page. It loads the same published `combos.json` the deck page does,
  counts every result, and lays the whole classification out searchable. Anything
  the inventory does not list appears **at the top, in red**, with the exact lines
  to paste into `result-tiers.js`. Because it reads live data rather than a
  snapshot, a new set shows up the moment the data refresh runs — nobody has to
  remember to check.
- **The data workflow log** — `reportUnclassified()` in `tools/fetch-combos.js`
  prints unclassified results and how many combos they affect on every refresh.

`tools/verify-layout.js` renders `tiers.html` against a fixture containing a
deliberately unknown result and fails if it is not flagged, so the warning cannot
quietly stop working.

The bar for green is *practical*, not certain. Explicit wins (*Win the game*,
*Each opponent loses the game*) sit alongside results that end games in every
normal case: unbounded damage or life loss, an unbounded board, a whole team made
arbitrarily large, infinite turns, opponents drawing from an empty library. Green
is not "you cannot lose from here" — it is "you have won unless something
unusual is true".

Yellow keeps a per-outcome reason, shown on hover, because the caveat is the
point: infinite mana needs a payoff, infinite mill loses to Thassa's Oracle,
infinite lifegain loses to poison, a pile of Treasure is only mana.

Grey is deliberately the four biggest outcomes in the database — ETB (66k
combos), LTB (57k), death triggers (45k), sacrifice triggers (43k). They explain
*how* a loop works, which is not the same as why you'd run it. Grey is shown, not
hidden: up to eight results are listed before the rest fold behind "+N more", and
`splitResults()` guarantees a tier that exists never disappears entirely into the
fold.

### The combos you have: easiest first, named alphabetically

**Combos in your deck** leads with the ones you can actually pull off: every 2-card combo,
then every 3-card, then every 4-card, most played within each size. Two cards on the table
is a different proposition from four, and popularity alone buried the easy lines among the
hard ones — a well-played four-card combo used to sit above a two-card one nobody has
registered.

Nothing is added to the rows to say so. The size is already on screen, spelled out in the
card names: `Rosie Cotton of South Lane + Scurry Oak` is visibly a two-card combo, and a
label repeating it would be noise. (The *suggestions* do carry pills, because there the row
is a card to add and its combos are hidden behind a fold — see
[What the count is made of](#what-the-count-is-made-of).)

**The cards in a row are alphabetical.** Spellbook lists them in the order the combo was
authored in, so two rows sharing pieces could name them in different orders, and with no
description shown that order carries nothing. Sorting is done at render time only — the
matching, grouping and slot-assignment code keeps the published order, since `groupVariants()`
reasons about the position of a card within a combo.

**Except where a combo is listed under a card: then that card goes first.** Both nested lists
— *Combos this unlocks* under a suggestion, and *The combos it holds together* under one of
your own cards — are about a particular card, and alphabetical order buries it somewhere
different on every line, so the reader has to find it again each time. It leads instead, and
the rest of the combo follows alphabetically:

```
1. Thassa's Oracle  +3   1 × 2-card  1 × 3-card  1 × 4-card
   ▾ Combos this unlocks
       Thassa's Oracle + Demonic Consultation
       Thassa's Oracle + Grinding Station + Memnite + Underworld Breach
       Thassa's Oracle + Mana Severance + Selective Memory
```

For a suggestion the lead is read **per variant**, not from the group: a group of
interchangeable cards has a different one of them in each of its combos, so taking the
group's representative would put the wrong card first on most rows. It is the card the deck
does not hold — which is also why it renders in the "missing" colour, so what you would be
adding reads first and reads differently.

Both orderings reach **Cards carrying your combos**: the cards themselves stay ranked by how
many combos each holds up — that is the panel's whole question, since cutting a card that
appears in four costs four — while the combos under each one are size-ordered and lead with
that card. Measured on the fixture deck, Scurry Oak's ten combos come back as sizes
`2,3,3,3,3,3,3,3,3,3`.

### Ranking, and what popularity is for

Spellbook publishes a `popularity` per variant — how many decks in its own corpus play
that combo — and the fetcher carries it through as `pop`. It used to order the combos
you already have, and nothing else. Two consequences, both of them wrong:

- **Suggestions ranked on count alone, ties broken alphabetically.** Two cards each
  unlocking three combos are not equally good if one of them unlocks three combos nobody
  plays, and `Aetherflux Reservoir` is not a better recommendation than `Basalt Monolith`
  for being earlier in the alphabet.
- **The lists inside a suggestion were never sorted at all.** "Combos this unlocks" opened
  on whatever order the database happened to publish.

Now: **most combos unlocked first, then the most-played of them, then alphabetical.** Count
still leads — a card unlocking four combos beats one unlocking three however popular the
three are — because "+N combos" is what the page claims and the ranking has to match it.
Popularity decides between cards that make the same claim, and orders every list of combos
on the page.

Popularity is a tie-break rather than the ranking, and `pop` is absent from some variants:
a missing one counts as zero, so ordering never depends on whether a field is there. With
no popularity anywhere — old data, or a test fixture — the order falls back to alphabetical
exactly as before.

### What the count is made of

A count of combos says nothing about how hard they are to pull off, and the difference is
large: a two-card combo needs two cards on the table, a four-card one needs four to be
found, cast and kept alive. "+6" reads identically whether it is six two-carders or five
four-carders and a two.

So every recommendation carries its own breakdown, on the card's own line:

```
1. Thassa's Oracle  +3   1 × 2-card   1 × 3-card   1 × 4-card
5. Mana Crypt       +1   3-card
```

Four details, each of them a decision:

- **Inline, not a second line.** A line per row is eighty lines down a list this long, and
  the pills are short enough not to need one. They wrap under the card name on a phone.
- **Unlabelled.** "1 × 2-card" next to a count, under a heading reading *Suggested
  additions*, does not need a caption explaining that it is about combo sizes — and a
  caption would repeat on all eighty rows.
- **The badge is the number alone.** `+3`, not `+3 combos`: the word was said again by
  every row and by the pills beside it. It is not simply dropped, though — the badge carries
  `aria-label="unlocks 3 combos"`, so what a sighted reader infers from context is still
  spoken.
- **Only a two-card pill is filled.** Two is the floor — no combo needs fewer — so it is the
  one worth marking, and the filled pills become the scan target for "what is easy here".
  Filling whichever pill happened to be smallest on its row would light up a card whose
  seven combos all need three cards, which is not a find.

Measured on the deck in `test/fixtures/deck.txt`, this is not a marginal distinction:

| | 2-card | 3-card | 4-card | 5-card |
|---|---:|---:|---:|---:|
| Combos unlocked | 21 | 146 | 28 | 3 |
| Recommendations whose easiest is this | 19 | 47 | 13 | 1 |

The case that settles the design: **Pitiless Plunderer** ranks 5th on "+6 combos", and five
of those six need four cards — but the sixth needs two. **Ashnod's Altar** outranks it on
"+7 combos", every one of them three cards. Nothing in a count can tell you that, and it is
the difference between a card you play and a card you cut.

Three decisions:

- **A slot counts as a card.** Something has to occupy it, so
  `Rings of Brighthearth + a Persist Creature` is a two-card combo. Counting only named
  cards would call it a one-card combo, which is not a thing.
- **Per card, not per panel.** An aggregate summary over the whole list needs a
  denominator, and there are two defensible ones — 19 of 80 recommendations and 21 of 198
  combos are both true and answer different questions. A per-row breakdown has neither
  problem: its parts sum to the badge sitting beside them, which the layout test asserts.
- **Slate, not the tier colours.** Green, yellow and grey already mean *what a combo
  achieves*. A size pill in green would read as "this wins the game" rather than "this needs
  two cards", so size gets a colour of its own (`--size`).

### Collapsing interchangeable cards

Two cards are interchangeable **for your deck** when adding either one completes
exactly the same set of combos. That is read off the data — the cards you already
hold plus what the combo produces — so no wording is interpreted and nothing is
inferred from card names.

It matters because the flat list actively misleads. Four different cards each
claiming "+7 combos" at the top of the suggestions look like four options worth
seven combos apiece; they are one option worth seven, described four times.

**Identical results are required, and that is deliberate.** Two variants only
collapse when they produce exactly the same list. This under-groups: each
interchangeable card brings its own rider, so `Scurry Oak + Sadistic Glee` shows
separately for Carrion Feeder, Viscera Seer and Umbral Collar Zealot — five
identical core results each, plus *Infinite scry 1* from the Seer and *Infinite
surveil* from the Zealot.

The tempting repair is to compare results loosely: share a core, allow an extra
or two each. **Don't.** It is a threshold with a story attached, and it merges
combos whose payoffs genuinely differ the moment they overlap — Kiki-Jiki,
Mirror Breaker pairs with a hundred partners producing everything from infinite
turns to infinite combat damage, and any "close enough" rule eventually eats
those. Splitting a family into three honest rows is a much smaller sin than
telling someone two different combos are the same one.

If this is ever worth fixing properly, the fix is exact rather than fuzzy:
Spellbook *authors* a combo and *generates* variants from it, so the parent
recipe — if the export names it — groups them with nothing inferred at all. That
is the only version worth building. `compact()` currently keeps none of it.

Two details worth keeping:

- **Grouping must not reorder.** `groupVariants()` returns groups in the order
  their first variant arrived, because the caller has already sorted them —
  smallest combo first, most played within a size — and neither ordering should
  be undone on the way to the screen. The layout test caught this when the first
  pass sorted by group size instead.
- **Nothing is lost.** Every variant lands in exactly one group and every
  suggested card survives, both asserted in `test/grouping.test.js`. A collapsed
  combo still lists all its versions, each linking to its own Spellbook page.

### Template slots ("a Persist Creature")

Some combos have a slot naming a property rather than a card. Because matching
works on card names, every one of them used to be dropped — your deck contains
Kitchen Finks, it does not contain "a Persist Creature". That was **3,860
combos**, 64% of which would show green.

Spellbook attaches a Scryfall query to most templates, so `tools/templates.js`
turns each slot into the actual list of cards that fill it. Nothing interprets
wording: Spellbook authors the query, Scryfall evaluates it, we record the
answer. Stored as `card -> template ids` (0.62 MB) rather than the reverse — one
card satisfies a handful of templates, one template matches thousands of cards.

**`templates.json` is generated by hand and checked in**, like `result-tiers.js`
— not resolved on every refresh. Resolving costs 465 Scryfall requests and 23
minutes, and templates change when a set ships, a few times a year. Doing that
nightly would spend both to learn that nothing had moved.

The cost of a hand-generated file is that it goes stale, and stale is invisible:
the combos needing a new template are simply excluded, with nothing to see. So
the daily refresh checks — every combo in the export names the template ids it
needs, which makes the comparison free — and prints anything it has never seen,
with how many combos are waiting on it. The 29 query-less templates are recorded
separately so they aren't reported as new every night; a warning that always
fires is one nobody reads.

When it fires, run the **Regenerate template card lists** workflow from a branch.
It commits `templates.json`, and refuses to write at all if any template failed —
a file half-written by a 503 would look complete and quietly exclude those combos
until someone noticed. Between a set shipping and regenerating, its combos stay
excluded: incomplete, never wrong, and the log says so.

**Only templates a combo actually asks for get resolved.** Spellbook defines 178
templates; just 157 ids appear anywhere in the combo data. The unused ones are
not small — `Nonartifact creature with MV <= 5` alone is 14,368 cards over 83
pages and nothing wants it. So the workflow reads the published `combos.json`
first, collects the ids in use, and resolves those. (`--all` resolves everything;
useful for measuring, useless for publishing.)

Measured, resolving everything versus only what is used:

| | all | used only |
|---|---:|---:|
| Templates resolved | 148 | **134** (14 skipped) |
| Cards in the file | 21,769 | **12,472** |
| File size | 0.62 MB | **0.35 MB** |
| Wall time | 16.2 min | **12.9 min** |

The payload shrinks 44%, the run only 20% — most of the skipped templates are
small, and two large ones do not dominate a 440-request job as much as their page
counts suggest. Worth having, but it is a trim rather than a transformation. The
dropped cards cost nothing: they were cards that satisfied *only* templates no
combo asks for.

Those get recorded in `skipped`, kept apart from `unresolvable` because the two
mean different things. A query-less template is permanently out of reach; a
skipped one could be resolved the moment something needs it. So if a combo starts
asking for a skipped template, the daily check says "skipped as unused, now in
use — regenerate" instead of treating it as a permanent gap.

### What templates are actually used for

Worth knowing before assuming a slot is too vague to be useful — measured with
`tools/template-users.js`, which prints the combos requiring a given template:

| combos | template | cards that fill it |
|---:|---|---:|
| 790 | Persist Creature | 24 |
| 528 | Noncreature Artifact with MV≤1 | 394 |
| 315 | Haste Enabler | *no query* |
| 237 | Hero Creature | 351 |
| 232 | Undying Creature | 22 |
| 229 | Anthem Effects | *no query* |
| 204 | Artifact Castable for {0} | 59 |

The templates combos ask for are narrow. The enormous ones — the reason to fear
that template combos would match every deck and read as noise — turn out to be
used by nothing at all. Worth re-measuring rather than assuming if that concern
comes up again.

The two biggest unresolvable templates, Haste Enabler and Anthem Effects, account
for **544 combos that can never be filled**. That is the concrete cost of the
29-template gap.

Four rules, all of them about not overclaiming:

- **A slot is filled or the combo is not counted.** There is no one card to
  suggest for "a Creature with Haste" — 612 cards fill it — so a template combo
  only counts once the deck already fills every slot it has. Templates with no
  query (29 of 178) can never be filled and are never counted, exactly as before.
  What changed is that not counting a combo no longer means saying nothing about
  it — see "One slot away" below.
- **Every slot gets its own card.** A card cannot hold two slots, and a card the
  combo already names cannot also fill one. Assignment is a real matching
  (Kuhn's algorithm), not a greedy pass: taking the first candidate for each slot
  in turn can strand a later slot whose only option is already spoken for.
- **The page says which card filled which slot.** Some templates are enormous —
  `Nonartifact creature with MV <= 5` is 14,368 cards, roughly 40% of Magic — so
  these combos match nearly any deck. A combo that appears because of a slot and
  cannot show why reads as invented. Asserted in the layout test.
- **Unreadable data excludes rather than includes.** A requirement with no id is
  recorded as `null`, which matches no template. Data published before this
  existed records only a slot *count*, which is treated the same way — the page
  and the data branch update independently, and a stale `combos.json` must never
  start claiming combos.

### One slot away

Not counting a combo is right. *Silence* about it was not: a deck holding Rings of
Brighthearth and short only of a Persist Creature is one card from a combo, and the
old behaviour was to drop the row and mention nothing. It's now its own section,
below the combos the deck can actually assemble and never counted among them.

Four decisions, all narrowing:

- **One gap, and nothing else missing.** Every card the combo names is in the deck and
  exactly one slot is unfilled. Two unfilled slots is two cards away; a missing named card
  *plus* a slot is likewise two, and the existing one-card-away suggestions already refuse
  to cross that line.
- **Inside the deck's colours.** A combo the deck could not legally run is not a decision
  anyone has to make. (The off-colour tab exists for *suggestions*, where the card is the
  subject; here the combo is.)
- **A slot with no id says nothing.** `compact()` writes `null` for a requirement it could
  not read, and data predating template resolution records only a slot count. Neither can
  say what would fill it, so neither appears — the same rule as everywhere else here.
- **It is not phrased as a recommendation.** There is no single card to recommend for a slot
  394 cards fill. The row names the slot, counts the cards that fill it, says how many are
  in your colours, and lists a few.

Which few is itself read off the data: candidates are **ranked by how many of your own stuck
combos each one would complete**, then alphabetically. A card that unsticks three of them is
a better thing to know about than a card that unsticks one, and that ordering needs nothing
known about the card itself. Cards already in the deck are never offered, and off-colour
cards are counted but not named.

**Making the slot nameable cost one field.** The published data carried names only for
templates that resolved, so a combo blocked by *Haste Enabler* — one of the 29 with no
Scryfall query — could only be described as needing "a card". `unresolvable` (43 short
names, all told) is now published alongside, so the row reads "Needs Haste Enabler — no card
list published for this slot yet". It cannot make a combo count, because matching only ever
consults the card lists. `tools/try-deck.js` was already reading that field.

**Resolving against the Scryfall bulk file was considered and rejected.** We
already download it for colour identity, so it looks free. It isn't: the bulk
file is card data, not a search engine, and evaluating `t:creature -t:artifact
mv<=3` locally means reimplementing Scryfall's query language — `is:permanent`,
`is:tdfc`, `keyword:devoid`, `mana:{X}{X}{X}`, `o:"…"`, negation, `or`,
parentheses, and that is from a 12-query sample of 149. `is:permanent` and
`is:tdfc` are Scryfall's own derived definitions rather than fields in the file,
so a local version would be a reconstruction — and a wrong reconstruction does
not error, it silently yields a card list that is slightly wrong. Cost was never
the objection: 465 requests and ~23 minutes, on a job that already streams a
578 MB export.

## Adding a card, and searching again

Every suggestion carries **+ Add to deck**, and so does every interchangeable
alternative under it. It appends `1 <card>` to the decklist, keeps the list, and
submits the form again.

It is a button rather than a note telling you to type the card in because of where
the database already is: parsed, in the worker, from the search you just ran.
Matching a 100-card deck against ~104k combos is **~115 ms** over data in memory,
so taking a suggestion costs a walk rather than a download, and the page stops
being a one-shot report.

Three details, each the kind that is invisible when wrong:

- **It goes through the form**, not through the render code. `requestSubmit()` on
  the real form is what disables the button, clears the previous failure report and
  re-reads both boxes — none of which should have a second implementation that can
  drift from the first.
- **The list is saved before the search**, not on the usual typing debounce, so a
  fast search cannot outrun the save and leave the addition unkept.
- **The status line survives the search.** "Added Deadeye Navigator" was previously
  replaced by the search's own status about 200 ms later, which is not long enough
  to read — so the note is handed to the next search and rendered as part of its
  line: *"Added Deadeye Navigator. Searched 9 cards against 104,000 known combos."*

A card already in either box is not added twice; the page says so instead. The
layout test presses the button and asserts the deck ends up holding **more combos
than it did**, because an append that forgets to search again looks completely
fine on screen.

## Classifying the decklist: which bracket is it?

Wizards' bracket system rates a Commander deck 1–5. Two of its criteria are
properties of a card list, and the rest are judgements about how a deck plays — so
the page checks the two and **names the ones it did not check**:

| | |
|---|---|
| 1 Exhibition / 2 Core | no Game Changers, no two-card infinite combos |
| 3 Upgraded | up to three Game Changers, no early two-card combo |
| 4 Optimized | no limit on either |
| 5 cEDH | a choice about how you play, not a fact about the list |

So what the panel reports is a **floor** — the lowest bracket the list is still
eligible for — and never a verdict. A deck with no Game Changers and no two-card
win *could* be bracket 2; whether it is depends on mass land denial, chained extra
turns, how many tutors counts as "a few", and how early a combo lands. None of
those is a card name, so none of them is guessed at. That caveat is on the page,
next to the number, and deliberately **not** foldable: a bracket number with its
limits hidden behind a control reads as the whole answer.

**"Two-card infinite combo" means a two-card line that wins**, which the page
already knows: green tier, by the same written-down inventory the result chips use.
Basalt Monolith + Rings of Brighthearth loops all day and wins nothing, so it is
not one. A filled template slot counts as one of the two cards — something has to
occupy it, and your deck is what does.

### The Game Changer list is read, not kept

`tools/fetch-combos.js` publishes the list off **Scryfall's own `game_changer`
flag**, in the same pass that already streams the oracle bulk file for colour
identity. It is deliberately not a list in this repository: Wizards revises it with
each bracket update, and a copy here would go stale silently — the exact failure
mode `templates.json` has to work to avoid.

The one way that can break is the flag being renamed, and the consequence is
nothing: `bracketCheck()` returns null, the panel is not drawn, and that looks
exactly like a deck with nothing to report. So the refresh **says so, loudly** —
under 20 flagged cards prints a warning naming the field and linking their card
object docs. It is not fatal, unlike missing colour data: the combo results are all
still correct without it.

Half a check is worse than none, which is why a missing list draws nothing rather
than a bracket based on combos alone — a deck full of Game Changers would otherwise
read as bracket 3.

## Layout

One column on phones and tablets; from 900px the decklist sits in a sticky left
column beside the results, so you can edit the list while reading suggestions.
Section headers are 48px tall for thumbs, and `tools/verify-layout.js` asserts
all of it — see Commands.

### Light and dark, from one set of tokens

Dark is the base. A `prefers-color-scheme: light` block **restates the tokens and
nothing else** — every colour on the page is a custom property, so supporting light
meant naming eight more (`--line`, `--decisive`, `--code-bg`, `--brass-ink` and the
rest) rather than auditing 600 lines of rules. The only hardcoded colours left
outside that block are Wizards' mana swatches and the dark ink that sits on them,
which are the same in both themes on purpose.

Brass, green and red are **darkened for light rather than reused**: `#d4a24e` is a
good accent on `#12141a` and unreadable on white, which is the whole reason a theme
is more than swapping two colours.

**Worth knowing:** browsers report `light` for anyone who has not chosen, so this
flips the default for most visitors rather than only serving people who asked for
light. If dark should stay the default, the media query is the one place to change
— gate it behind a toggle, or invert the condition.

**The page uses the desktop it is on, up to 1500px.** The shell was capped at
1140px at every size, from a time when this was one column of prose. It is now a
fixed 370px sidebar beside a list of rows, so that cap cost the results
everything a bigger screen offered: measured at 1920px it left **780px of the
screen empty** — 1420px at 2560px — while combo names wrapped inside a 714px
column. The sidebar keeps its width, so the room goes where it is useful: the
results column runs 714 → 999px at 1440 and 1074px from 1680 up.

It is capped rather than fluid because these rows are not prose but they are not
tables either — a combo's result chips strung across an ultrawide monitor is
worse than a margin. The layout test now renders a **1920px** viewport and fails
both ways: if the page stops using the screen, and if it stops respecting the cap.
1440px was the widest viewport it checked before, which is exactly where the old
cap was least visible.

The layout test loads the page in a **sized iframe** rather than resizing the
browser window: media queries follow the iframe's width, and the full Chrome
build silently clamps `--window-size` to 500px, which quietly turned a "390px"
run into a 500px one that proved nothing.

It also runs the browser **on the real clock, and has the page POST its verdict back**
to the test process. It used to run under `--virtual-time-budget --dump-dom`, which is
tidier — one command, DOM on stdout — and stopped working the moment the search moved
into a worker and started keeping a cached copy: under a virtual clock **`caches.open()`
and a worker's `fetch` both return promises that never settle**, so Chrome waits forever
for a page that cannot finish and prints nothing at all. Not a subtle failure, but a
confusing one, since neither feature is visibly about timers. On the real clock the same
page reports in ~450ms.

That discovery is also why `search.js` never *waits* on the cache: see
[Downloading the database once](#downloading-the-database-once-not-once-a-visit).

### What the layout test proves

Ten runs. Four are layout at 390/768/1440/1920px, two are the tier page, and three
exist because the thing they check fails *silently*. Two more assertions ride along
inside the layout runs, for the same reason:

- **`+ Add to deck`** is pressed, and the run asserts the deck ends up holding *more
  combos than it did* — not merely that a line appeared in the box. An append that
  forgets to search again looks entirely correct on screen.
- **The bracket panel** has to name the two Game Changers the fixture's deck holds
  (of three published), give both reasons for its floor, and carry the caveat about
  what it did not check — unfolded. Every one of those was confirmed by breaking the
  code and watching them fail.

- **`desktop (no worker)`** deletes `Worker` from the page and expects identical
  output from the in-page fallback. On its own that proves only that *something*
  answered — the two paths agree by design — so the page reports which one ran
  (`data-via` on the footer line, and a `searched:` row in the failure report)
  and the run asserts it was the fallback. Before that it would have passed
  whether or not the fallback was ever reached.
- **`share link`** types a deck, waits out the save debounce, presses Copy link,
  opens the resulting URL in a fresh page **with a different deck in
  `localStorage`**, and expects the *link's* deck — the encoding is ours, and a
  link that quietly loses the deck is worse than no link. A corrupt `?deck=` must
  report an error rather than open empty.
- **`desktop (asset-stamped)`** serves the page the way the deploy does, every
  asset URL carrying `?v=`, from a path where **the server refuses unstamped
  `.js`**. That refusal is the whole trick: on a real static host an unstamped URL
  loads perfectly well — it just serves whatever the CDN cached — so nothing about
  a dropped stamp is observable. Refusing them turns it into a 404, a dead worker
  and a fallback, which the `via` assertion catches. Both hands-off hops are
  covered: app.js building the worker's URL, and the worker building its
  `importScripts` URLs.

All three were checked by breaking the code and confirming they fail — the
stamped one caught a hole in its own first version, which passed while
`importScripts` had lost the stamp, because the page's own `<script>` tags were
requesting the same files with it.

## How it works

Static site, zero dependencies, no build step:

- `index.html` / `style.css` — the page. Both HTML files carry a
  **Content-Security-Policy** meta tag: `default-src 'none'`, scripts and styles from
  `'self'`, and `connect-src` naming the only two hosts this page talks to — the data
  branch on `raw.githubusercontent.com` and Archidekt's deck API. A decklist is the one
  piece of text here that comes from outside, and this leaves an injected script with
  nowhere to load from and nowhere to report to. `form-action 'none'` because the form is
  handled in JS and never navigates.
- `favicon.svg` — an infinity loop in the site's brass, drawn rather than fetched. Two
  loops meeting at a pinch instead of a crossing stroke, which turns into a blob at 16px.
- `eslint.config.mjs` — the lint rules, with no lint dependency: CI fetches ESLint for
  that one step. See Commands.
- `parser.js` — decklist parsing (`DeckParser`). Understands plain names, `1x Card`,
  Moxfield/Arena exports (`1 Sol Ring (C21) 263 *F*`), `Commander:` / `Sideboard:`
  sections, per-line commander markers (`*CMDR*`, `[Commander{top}]`), MTGO `SB:`
  prefixes, comments, Moxfield + Archidekt API payloads, and deck URLs. Runs under
  Node so it's unit-testable.
- `result-tiers.js` — the tier inventory: every combo result Spellbook publishes,
  listed by name under green, yellow or grey. Hand-maintained data, no logic.
- `tiers.html` / `tiers-page.js` — the review page for that inventory, counted
  against live data and flagging anything unclassified.
- `combos.js` — combo-result analysis (`DeckCombos`): turns the API's "almost included"
  variants into the ranked add-this-card suggestions (front-face matching for
  double-faced cards, ties broken on popularity then alphabetically), works out which
  template slots the deck fills and which it is short of, and collapses interchangeable
  cards via `groupSuggestions()` / `groupVariants()`.
- `search.js` — downloading the database, keeping a copy, and running the match
  (`ComboSearch`). No DOM, so it runs in a worker, in the page, or under Node.
- `search-worker.js` — the worker that does all of the above off the thread drawing
  the page. Imports the three files above.
- `app.js` — reads the form, asks for a search, renders the sections above. On failure it
  shows a copyable report (endpoint, HTTP status, what was sent, which lines were skipped)
  instead of a bare "it didn't work".
- `tools/fetch-combos.js` — downloads Commander Spellbook's bulk export and
  writes a compact `combos.json`. Run by CI, not by the page.

## Why the data is published, not queried live

Commander Spellbook's API only accepts **browser** requests from their own site
and localhost:

```python
# backend/backend/production_settings.py
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^https://(\w+\.)?commanderspellbook\.com$',
    r'https?://localhost:\d+',
]
```

A page served from `paludancode.github.io` is not on that list, so the browser
refuses to send the request and the fetch fails with no status at all — Safari
words it "Load failed". Nothing client-side can change that; it is their server's
allowlist.

CORS applies to browsers, not to servers, so `.github/workflows/update-data.yml`
fetches the database in CI instead and force-pushes `combos.json` as a single
orphan commit to the **`data` branch**. The page reads it from
`raw.githubusercontent.com` and does the deck matching itself in `combos.js`
(complete combos / one card short / one card short but off-colour), which is
what the `find-my-combos` endpoint would have done server-side. This is the same
split [MTG-Pricerunner](https://github.com/PaludaNCode/MTG-Pricerunner) uses for
prices. The `data` branch is a build artifact — never branch from it or PR into it.

Consequences worth knowing:

- Combo data is as fresh as the last workflow run (daily cron + manual dispatch),
  not live. Which snapshot you have is printed at the bottom of the page.
- Combos requiring a *template* ("a Persist Creature") are excluded from
  suggestions, since no single named card completes them — but not from results,
  and no longer from the page: see "Template slots" and "One slot away" above.
- Deck colour identity is the union of the colours of the cards pasted in. If
  none of them is recognised, colour filtering is switched off rather than
  guessed at.

### Downloading the database once, not once a visit

The published file is **2.9 MB on the wire** (~25 MB parsed), and
`raw.githubusercontent.com` serves it with `cache-control: max-age=300`. So every visit
downloaded the whole database again — and so did any reload five minutes into a session,
to learn that a once-a-day cron had not run since. The parsed copy was held in a variable,
which covers repeat searches in one visit and nothing else.

It is now kept in **Cache Storage**, keyed on the URL. A visit that finds a copy uses it
and checks for a newer one **in the background**, conditionally: `If-None-Match` against
the stored ETag, so a 304 costs a few hundred bytes instead of 2.9 MB. When something has
changed, the new copy is stored for next time rather than swapped in mid-session — the data
refresh runs daily, so a page showing this morning's snapshot instead of this afternoon's
is not worth a surprise. The footer says which one it is either way.

**An abandoned cache version is deleted, not just ignored.** Bumping `CACHE_NAME` stops the
page *reading* an old copy; it does not remove it, so the first version's ~28 MB sat in the
reader's browser indefinitely and every future shape change would have added another. Every
cache matching `mtg-combo-finder-data-` that is not the current one is now dropped — once per
session, alongside the open rather than before it, never awaited, and every failure ignored.
A browser that will not let us tidy up is not a browser that should fail a search, so
`test/search.test.js` covers a listing that hangs, one that throws, and one that isn't there.

**Nothing ever waits on the cache.** Every call to it is raced against a 1.5s deadline and
a slow cache is treated as an absent one, because Cache Storage can do worse than fail: in
headless Chrome under a virtual clock, `caches.open()` returns a promise that **never
settles at all**. Awaiting one on the way to the data gives you a page that loads, says
"Downloading the combo database…" and stays that way forever — strictly worse than not
caching. Writes are never awaited either; storing a copy is next visit's business.

That deadline is why `test/search.test.js` exists: a cache that hangs, a cache that
throws, a cache that returns a stale copy, and a 304 versus a 200 are all cheap to fake
and impossible to notice by hand.

### The search runs beside the page, not in it

Downloading ~25 MB of JSON, parsing it, and walking ~100k combos all used to happen
between one paint and the next. None of it touches the DOM, so `search-worker.js` does
all three off-thread and posts back only what gets drawn — a few hundred rows, not the
database. The dataset is parsed once and kept there, so the second search of a session is
a walk over data already in memory.

A browser with no `Worker`, or a worker that fails to start or dies mid-search, falls back
to searching in the page: slower, but working, and the same code either way — `search.js`
is loaded both ways rather than duplicated. The layout test runs one viewport with `Worker`
deleted from the page to prove the fallback isn't a branch nobody has ever executed.

### Colours come from the cards, not from a commander

The commander used to decide the deck's colours, which meant the commander had
to be known, which meant finding one when the box was left empty. That took
three signals — an export marker, the export's ordering, and failing both, the
legal commander whose colours matched the deck — and where several legendary
creatures fitted it offered a shortlist to choose from.

All of it is gone. A decklist with a dozen legends in it got a guess plus a
question in place of an answer it already contained: **every card in the list is
a card the deck plays**, so the union of their colour identities is the deck's,
and no card can be wrong about its own colours.

What went with it: `detectCommanders()`, `commandersByPosition()` and the
sorted-export heuristic, the candidate shortlist and its buttons, the
`commanderNames` list in the published data (3,321 names), and `canBeCommander()`
in the fetcher. About 250 lines and a test file.

The commander box stays, because a commander is a card in the deck and its
combos count — it simply no longer decides anything the cards can decide.

**One consequence, accepted.** A deck whose commander permits a colour it plays
none of — a Mardu commander over a list with no red card in it — reads as the
colours actually present. Suggestions in that unplayed colour land under "other
colours" instead of "in your colours". That is a fair description of the list as
pasted, and it hides nothing: the split is between two visible tabs, not between
shown and dropped.

The layout test asserts the negative — that no commander line and no picker is
rendered — and runs the same deck with and without a `*CMDR*` marker to confirm
the output is identical either way.

### Use the bulk export, never the paged API

The fetcher reads **`https://json.commanderspellbook.com/variants.json`** — the same
bulk file Commander Spellbook's own frontend uses (see `combo-sitemap.xml.ts` in
[commander-spellbook-site](https://github.com/SpaceCowMedia/commander-spellbook-site)).
One request for the whole database.

That file is **over 512 MB**, which is past the longest string V8 will build, so
`res.json()` dies with `Cannot create a string longer than 0x1fffffe8 characters`.
`tools/fetch-combos.js` therefore streams the response and pulls out one variant
object at a time with a small hand-written scanner (no dependencies), keeping only
the object currently being read in memory. `test/scanner.test.js` feeds it chunk
sizes down to a single byte, including braces and escaped quotes inside strings.

Do not "improve" this by paging `/variants` instead. That needs ~300 requests and
their rate limit is a **cumulative quota, not a per-second throttle**: walking it at
4 req/s was cut off after 120 pages, and slowing to 1 req/s was cut off *earlier*,
at 78, with two full minutes of backoff never clearing it. Fewer, larger requests
is both the only thing that works and the neighbourly way to consume someone else's
database.

### Colour identity comes from Scryfall

Commander Spellbook's `CardSerializer` exposes name, images and type line but
**not** colour identity, so the combo export alone cannot tell you whether a
suggested card fits the deck's colours. `tools/fetch-combos.js` therefore also
streams [Scryfall's oracle-cards bulk file](https://scryfall.com/docs/api/bulk-data)
and publishes a name → identity map alongside the combos.

The same pass reads Scryfall's `game_changer` flag, which is where the bracket check's
list comes from — see
[The Game Changer list is read, not kept](#the-game-changer-list-is-read-not-kept).

**That map is the only thing colour filtering rests on**, now that colours are read
off the cards rather than off a commander — see "Colours come from the cards" above.
It is also the most load-bearing external data here: one bulk download per refresh,
consulted on every search.

The same pass used to publish `commanderNames` too — every card allowed to *be* a
commander, for working one out of a pasted deck. That went when detection did.
The fetcher refuses to publish with fewer than 500 names, for the same reason it
refuses to publish without colour data.

The first published dataset had `cardIdentity: {}` because the fetcher looked for
a `card.identity` field that does not exist, and the guard around it turned that
into an empty map rather than an error — colour filtering was simply inert. The
fetcher now refuses to publish with fewer than 1,000 identities.

**Tokens must not be published.** Scryfall's bulk file contains a token named
`Pippin, Warden of Isengard // Pippin, Warden of Isengard` with no colour
identity, and matching on the front face lands it on the real card's key. In the
data published on 2026-07-30 that zeroed the identity of **1,901 real cards** —
Sam, Loyal Attendant included — silently mis-sorting them into "Other colours".
The fetcher now drops `token` / `double_faced_token` / `emblem` / `art_series` /
`vanguard` layouts, and `identityIndex()` additionally refuses to let a
colourless entry displace a coloured one, so already-published data is repaired
in the page without waiting for a refresh.

### API contract notes

Verified against [the backend source](https://github.com/SpaceCowMedia/commander-spellbook-backend):

- The wire format is **camelCase**, even though the Python dicts are snake_case —
  `CamelCaseJSONRenderer` is the default renderer, and the bulk export camelizes too.
  Reading the Python source alone is misleading here. The fetcher accepts either spelling.
- A variant's cards are `uses[].card.name`; results are `produces[].feature.name`.

## Data-source research (why Commander Spellbook only)

Commander Spellbook is *the* community combo database — other combo sites are fronts for
the same data rather than independent sources:

- [EDHREC's combo feature](https://edhrec.com/combos) is officially powered by
  Commander Spellbook (see [EDHREC's own guide](https://edhrec.com/guides/how-to-use-commander-spellbook-the-combo-search-engine)).
  We link each suggested card to EDHREC for popularity/synergy context instead.
- Third-party finders like [Nerd Leagues](https://www.nerdleagues.com/combos) and
  [combo-finder.com](https://combo-finder.com/) also consume Spellbook data.
- The backend is open source: [SpaceCowMedia/commander-spellbook-backend](https://github.com/SpaceCowMedia/commander-spellbook-backend);
  API root at [backend.commanderspellbook.com](https://backend.commanderspellbook.com/).

So "multi-site" here means multi-site **deck import** (Archidekt URL via its
[public API](https://archidekt.com/api/decks/), text exports from everything else) rather
than multiple combo databases.

### Why Moxfield URLs can't be loaded

Moxfield has no public API and deliberately gates `api2.moxfield.com`: requests need a
User-Agent it whitelists on request, behind Cloudflare bot protection
([moxfield-public#143](https://github.com/moxfield/moxfield-public/issues/143)). A browser
can't satisfy either — `fetch` forbids setting `User-Agent`, a Cloudflare challenge can't be
answered cross-origin, and no CORS headers come back. That's a deliberate access policy, not
a bug to work around, so the app detects Moxfield links and points at the deck's Export
instead of burning a request that cannot succeed. Routing through a public CORS proxy would
circumvent that policy and put user decklists through an unrelated third party, so we don't.
Loading Moxfield decks properly would need a small server of our own with a whitelisted
User-Agent — a real option, but it ends the zero-backend design.

## Commands

```bash
# Build the combo database locally (one large download; reads templates.json)
node tools/fetch-combos.js

# Regenerate templates.json — ~13 minutes, only the templates a combo asks for
# (--all resolves every queryable one, ~16 minutes, useful only for measuring).
# Needed when the data refresh reports templates it has not seen, i.e. a new set.
# Normally run from the "Regenerate template card lists" workflow, on a branch.
node tools/templates.js templates.json

# Unit tests (node:test, zero deps)
npm test

# The same tests with coverage floors, which is what CI runs. Set a point under
# what the suite currently manages (94% lines / 90% branches / 95% functions), so
# they catch a module arriving untested rather than bickering over a line. Only
# files the tests load are measured — app.js and tiers-page.js are the layout
# test's job. Needs Node 22.8+ for the threshold flags.
npm run test:coverage

# Lint. Fetched for the run rather than installed: this repo has no node_modules
# and one that only a linter needs would be the first entry in it. Catches what
# node --check cannot — a misspelled global, a variable a refactor left behind,
# a duplicate object key.
npm run lint

# Layout smoke test — REQUIRED after any UI change. Renders the real page at
# 390/768/1440 px and fails on horizontal overflow, a collapse control that
# doesn't collapse, or the desktop columns not splitting. Also asserts the
# behaviour that is invisible when it breaks: the kept copy of the database
# being used on the second load, the decklist surviving a search, Clear
# actually clearing, the share link's whole round trip, the same output with
# Worker taken away — and that the search really did run where it was supposed
# to. See "What the layout test proves" below.
npm run verify

# Syntax-check everything (same as CI)
for f in $(git ls-files '*.js'); do node --check "$f"; done

# Run locally: it's a static page, any file server works
npx serve .   # or python3 -m http.server
```

### Answering questions from the data

Four read-only tools, each also a manual workflow, for the questions that keep
coming up. They exist because guessing at these has been wrong more than once.

```bash
# What would the page show for a deck? Combos, tiers, which card filled which
# template slot, suggestions. Defaults to test/fixtures/deck.txt.
node tools/try-deck.js [deck.txt]

# "Shouldn't X combo with Y?" — the published combos naming them, and what
# stands between a deck and each one, missing cards and slots reported apart.
node tools/combos-with.js "Heroic Feast" "Kitchen Finks"

# Which cards demand a given template, or (no argument) every template ranked
# by how many combos need it — which also checks the ids still line up.
node tools/template-users.js ["Persist Creature"]

# What does this card actually say? Straight from Scryfall.
node tools/lookup-card.js "Camellia, the Seedmiser"
```

`tools/research-sources.js` and `tools/research-coverage.js` are kept for the
questions whose answers can change: has a second combo database appeared, and do
Spellbook's templates still carry Scryfall queries. Their conclusions are under
"Data-source research" above.

## Branching strategy

Same as [MTG-Pricerunner](https://github.com/PaludaNCode/MTG-Pricerunner): trunk-based,
short-lived branches.

1. Branch off `main`: `feat/<thing>` or `fix/<thing>`
2. Push, open a PR — CI runs (`checks` job: JS syntax check + lint + unit tests with
   coverage floors + layout smoke test)
3. Merge when green. "Allow auto-merge" is enabled on the repo, so the usual move is
   to hit **Enable auto-merge** on the PR right after opening it — it then lands on
   its own the moment CI passes. Merging to `main` **is** the release: the deploy
   workflow fires on push to `main` and publishes to GitHub Pages (once Pages is
   available — see Deploying below).

`main` should be protected: PRs need the `checks` job green before merge; force-pushes
and deletion blocked. **Not enabled yet** — flip it on under
Settings → Branches → Add branch ruleset (require status checks: `checks`) when ready;
until then the flow above is convention. Auto-merge only waits for whatever the ruleset
requires, so it pulls its full weight once `checks` is a required status check. Repo
admins can push directly in a pinch (escape hatch — prefer PRs).

## Deploying

`.github/workflows/deploy.yml` publishes the repo root to GitHub Pages on every push
to `main`. Note: GitHub Pages on a **private** repo requires a paid GitHub plan —
either make the repo public or run the page locally until then.

## Credits

All combo data and the combo search itself come from the amazing
[Commander Spellbook](https://commanderspellbook.com/) project.
