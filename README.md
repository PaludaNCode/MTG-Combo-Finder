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
- **How it works** — the prerequisites and the steps, in order, on the row itself.
  One request and about half a kilobyte for the combo you open, rather than 51.70 MB
  downloaded for all 103,737 — see [How a combo is executed](#how-a-combo-is-executed).
- **Suggested additions** — every combo you're *one card away* from, aggregated per missing
  card and ranked: "add Rings of Brighthearth → unlocks 4 combos". Each suggestion links to
  the card's EDHREC and Scryfall pages and expands to show exactly which combos it enables.
  **Ties break on popularity** — see [Ranking, and what popularity is for](#ranking-and-what-popularity-is-for).
- **Take a suggestion without retyping it** — every suggestion (and every
  interchangeable alternative) carries **+ Add to deck**: the card is appended to
  the decklist, kept, and the search runs again against the database already in
  memory. See [Adding a card, and searching again](#adding-a-card-and-searching-again).
- **Compare a whole choice in one press** — when a suggestion is a choice between
  interchangeable cards, **Compare all N on Scryfall** opens every one of them on a
  single Scryfall page. See
  [Comparing a whole choice at once](#comparing-a-whole-choice-at-once).
- **Which bracket the list is in** — five pips under the colour identity: the brackets
  your list has ruled itself out of, the floor it lands on, and the ones still open. A
  floor, never a verdict; hover, focus or tap the pips for the reasoning, the Game
  Changers behind it and the criteria it did not check — see
  [Classifying the decklist](#classifying-the-decklist-which-bracket-is-it).
- **Whether the list is *allowed*** — beside the bracket: cards outside the commander's
  colour identity, and cards banned in Commander. Two lines, because they are two
  different accusations, and nothing at all when there is neither — see
  [Whether the list is allowed](#whether-the-list-is-allowed-is-a-different-question-from-how-strong-it-is).
- **What each recommendation's count is made of** — a `+3` in the row's number gutter
  reads *1 × 2-card · 1 × 3-card · 1 × 4-card* underneath, smallest first. A two-card
  combo is a far easier thing to assemble in a game than a four-card one, and a count
  hides the difference entirely — see
  [What the count is made of](#what-the-count-is-made-of).
- **It works with the network off** — a second visit renders and searches from what is
  already on the device: the shell in a service worker's cache, the snapshot in the one
  `search.js` keeps. See
  [The shell offline](#the-shell-offline-and-why-the-html-is-the-one-thing-not-cached-first).
- **Cards it did not recognise are named** — a section above the results, listing the
  cards you pasted that this snapshot has no card by that name for. `1 Sol Rimg` is a
  perfectly good card line, so it lands in the deck, matches nothing, and used to be
  never mentioned again — see
  [Telling the reader which cards were not recognised](#telling-the-reader-which-cards-were-not-recognised).
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
- **Deck import** — paste an Archidekt deck URL, drop or choose an exported deck
  file, or paste any site's text export (Moxfield, Arena, MTGO `SB:` lines,
  TappedOut/Deckstats/MTGGoldfish plain exports). The file path works for every
  site, including the ones a browser can never read an API from — see
  [Why Moxfield URLs can't be loaded](#why-moxfield-urls-cant-be-loaded).
- **Cards carrying your combos** — every card that takes part in a combo you can
  already assemble, ranked by how many, each with the same size breakdown a
  suggestion carries (*5 combos, 3 of Spellbook's and 2 of ours · 3 × 2-card ·
  1 × 3-card · 1 × 4-card*). A list
  of combos hides this: cutting a card that turns up in four of them costs four
  combos, which is exactly what you want to know before trimming a deck — and
  whether those four are two-carders or four-carders changes the answer.
- **How your combos connect** — the same combos as a picture: a dot per card, and
  a line between two cards that overlap. **Solid** means a combo needs both of
  them; **dashed** means they do the same job — swap one for the other and you
  still have a combo — so your four sacrifice outlets end up in one cluster
  instead of four corners. Both are drawn heavier the more they overlap and
  carry the count as a number, and four chips let you read either relation on
  its own — or **Game-ending**, which is the only line that matters on a map with
  a hundred of them. **Press two or three cards** and the map shows what they have in
  common, with a line under it saying what cutting them would actually cost —
  which is not the sum of their combo counts, because a combo whose slot another
  of your cards can fill survives losing this one. Redrawn from scratch by every
  search, so **+ Add to deck** moves the map too. See
  [The combo map](#the-combo-map).
- **Suggestions split by colour** — two tabs, *In your colours* and *Other
  colours*. A red card is noise for a deck that isn't red, so it goes behind a
  tab rather than into the list. **Colours are read off the cards** — every card
  in the list is a card the deck plays, so the list answers the question and
  cannot be wrong about it.
- **Collapsible results** — every section header is a collapse control, and what
  you close stays closed (kept in `localStorage`) across searches and visits.
- **Light or dark, your call** — one set of colour tokens with a light override. Your
  system's preference is the starting point; the **sun/moon button** in the header
  overrules it and the choice is remembered. See
  [Light and dark, from one set of tokens](#light-and-dark-from-one-set-of-tokens).
- **Your decklist survives a reload** — the list is the whole input, and losing it to a
  refresh was a strange thing for this page to do. It's kept in `localStorage` (it never
  leaves the browser), **Clear** empties it in one press, and **Copy link** puts the deck
  in the URL so it can be shared or bookmarked. A link beats the stored list: opening
  someone's deck means seeing theirs, not the one you were last working on.
- **The data's date is on the page** — a footer line says which daily snapshot you're
  looking at, and how it got there. That matters more now a copy is kept between visits;
  see [Downloading the database once, not once a visit](#downloading-the-database-once-not-once-a-visit).
- **What a combo gives you**, as chips rather than a comma-run: game-ending
  results sort first and are highlighted, duplicates collapse, and the grey
  plumbing folds behind "+N more" — 53px a row on a phone.

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
*how* a loop works, which is not the same as why you'd run it.

**So grey folds.** Every grey result on a row goes behind "+N more" with the count on the
control, and what is left is the louder tiers — up to the same eight, because nine decisive
results are a wall of yellow whatever the tiers say.

This reverses the rule that was here, and the reversal is worth recording rather than
quietly restyling: `splitResults()` used to guarantee that a tier which exists never
disappears entirely, on the grounds that grey is *quieter, not hidden*. The reasoning was
sound; what changed it is the measurement. Those four biggest outcomes turn up together
under combo after combo, so a row whose real payoff is one green chip was spending four
lines on the plumbing — measured by `npm run verify` at **76px folded against 129px open**
on a 390px phone, 53px a row, on rows a deck has eighty of. The fold is one press away and
says how much it holds, so nothing is hidden in the sense that mattered.

One case is exempt, and it is the one that would make the rule turn a row silent: a combo
whose results are *all* grey. Folding those would leave a row saying nothing about what it
does, so grey is only ever folded when something louder is on screen — with nothing louder,
grey is what the combo does and it is shown. `test/match.test.js` pins that, and
`npm run verify` fails if a grey chip is on screen before the fold is opened, which is the
same assertion inverted: it used to fail if grey was *not*.

The tiers page is deliberately untouched. It is the inventory of which result sits in which
tier — the grey list is the page's subject, not noise on a row about something else.

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

**And where a row differs from the rows around it by one card, that card goes last** —
in those nested lists too, not only in a collapsed group. The two rules apply together:
the card the list is under, then the cards every row shares, then the card that changes.

```
1. Chatterfang, Squirrel General  11
   ▾ The combos it holds together
       Chatterfang, Squirrel General + Warren Soultrader + Academy Manufactor
       Chatterfang, Squirrel General + Warren Soultrader + Essence Warden
       Chatterfang, Squirrel General + Warren Soultrader + Soul Warden
```

A lead used to *replace* a trail rather than sit in front of one, so those lists were
lead-first and then alphabetical, and the card that changed landed mid-line on every row
— "Chatterfang + Essence Warden + Warren Soultrader", with the difference in a different
place each time. That is the one place a reader compares rows most closely, and it was the
one place the rule was off.

**A row can sit in two families at once** — *the lead + one of these + one of those* — and
then something has to pick which axis the block is read along. Carrion Feeder's list holds
a 2×2 of them: `{Herd Baloth, Scurry Oak}` against `{Necrosynthesis, Sadistic Glee}`, four
rows, each of which can be read as either dimension varying. Choosing per row let two of
the four pick the other axis — the Scurry Oak rows sent Scurry Oak *last* while the Herd
Baloth rows sent it *middle* — so the block came apart into two rows in one place and two
rows four positions down. A family therefore **claims** the rows it orders, biggest first:
the families crossing it are left holding one unclaimed row each, which is no longer a
family and is skipped, and the rest are claimed along the same axis. All four rows then
read *lead + shared + the one that changes* and sort into one block of two pairs.

Which rows count as a family, for ordering, is decided **from the cards alone** —
deliberately unlike [collapsing](#collapsing-interchangeable-cards), which also requires
the same results and must: merging two combos that do different things would say one
thing where the data says two. Ordering merges nothing and hides nothing, and on the eight
Chatterfang rows above the stricter bar aligned five, which reads as a rule that half
works. `DeckCombos.interchangeableIn()` answers it per list, since "the card that changes"
only means anything beside the rows it changes against.
The versions of a collapsed group are identical but for one piece, and alphabetical
order puts that piece wherever its name happens to fall, so the difference moves from
line to line and the eye has to hunt for it:

```
Chatterfang, Squirrel General + Warren Soultrader + any of 4
  ▾ All 4 versions
      Chatterfang, Squirrel General + Essence Warden + Warren Soultrader
      Chatterfang, Squirrel General + Lunarch Veteran // Luminous Phantom + Warren Soultrader
      Chatterfang, Squirrel General + Prosperous Innkeeper + Warren Soultrader
      Chatterfang, Squirrel General + Soul Warden + Warren Soultrader
```

Sending the interchangeable cards last gives every version the shape its own heading
already has — *the shared cards, then the one that changes* — so the difference lands
in the same place every time:

```
Chatterfang, Squirrel General + Warren Soultrader + any of 4
  ▾ All 4 versions
      Chatterfang, Squirrel General + Warren Soultrader + Essence Warden
      Chatterfang, Squirrel General + Warren Soultrader + Lunarch Veteran // Luminous Phantom
      Chatterfang, Squirrel General + Warren Soultrader + Prosperous Innkeeper
      Chatterfang, Squirrel General + Warren Soultrader + Soul Warden
```

All three rules are one function, `DeckCombos.orderComboNames(names, {lead, trail})`,
kept beside the data it orders so it can be tested without a browser — twelve tests in
`test/name-order.test.js`. Where the lead is *itself* one of the interchangeable cards it
leads and is not named again at the end, which is the ordinary case in the suggestion
panel rather than an edge of it: the card you would be adding is usually the card that
varies between its own rows. Both are orderings and never filters, and a pin naming
nothing in the combo leaves the row alphabetical rather than throwing or emptying it.

**The list is sorted on the same drawn names**, and that is the other half of it. Sorting
on the alphabetical signature scattered the families the row ordering had just lined up:
three rows of Carrion Feeder's real list are *Carrion Feeder + Kitchen Finks + the one
that changes*, their alphabetical keys start Archangel / Carrion / Carrion, and they
landed at positions 2, 4 and 7 with a Cauldron Familiar row and two Herd Baloth rows
between them. The difference sat in one column and the eye still had to work out which
rows to compare it across.

```
before                                              after
1. Carrion Feeder + Pitiless Plunderer + Anim…      1. Carrion Feeder + Cauldron Familiar + Samwise…
2. Carrion Feeder + Kitchen Finks + Archangel…      2. Carrion Feeder + Herd Baloth + Necrosynthesis
3. Carrion Feeder + Cauldron Familiar + Samwise…    3. Carrion Feeder + Herd Baloth + Sadistic Glee
4. Carrion Feeder + Kitchen Finks + Heliod…        4. Carrion Feeder + Kitchen Finks + Archangel…
5. Carrion Feeder + Herd Baloth + Necrosynthesis    5. Carrion Feeder + Kitchen Finks + Heliod…
6. Carrion Feeder + Herd Baloth + Sadistic Glee     6. Carrion Feeder + Kitchen Finks + Heroic Feast
7. Carrion Feeder + Kitchen Finks + Heroic Feast    7. Carrion Feeder + Necrosynthesis + Scurry Oak
```

`byDrawnName()` compares what the row will actually say, so rows sort by their shared
cards first and by the card that changes only after. The lead it sorts under has to be the
one the render side draws, or the list is ordered on strings nobody sees. It orders all
three of these lists, ours and Spellbook's rows together, so a row of ours sits beside the
family it belongs to rather than wherever a second sort would put it.

**Then the blocks are ordered by how many rows they hold, largest first, and only then
alphabetically.** Alphabetical alone keeps a family together but says nothing about which
family is worth reading first, so a list opened on whichever block happened to start with
an A: Carrion Feeder's opened on a lone Cauldron Familiar row, above three Kitchen Finks
rows that are one decision between three cards. A block of three is three versions of one
thing and the reader is choosing between them, so the choices lead — biggest down to
smallest — and the rows that stand alone follow. A row with no family counts as a family of
one, which is what it is.

```
alphabetical only                               by block size, then alphabetical
1. … Cauldron Familiar + Samwise Gamgee         1. … Kitchen Finks + Archangel of Thune
2. … Herd Baloth + Necrosynthesis               2. … Kitchen Finks + Heliod, Sun-Crowned
3. … Herd Baloth + Sadistic Glee                3. … Kitchen Finks + Heroic Feast
4. … Kitchen Finks + Archangel of Thune         4. … Pitiless Plunderer + Animation Module
5. … Kitchen Finks + Heliod, Sun-Crowned        5. … Pitiless Plunderer + Quina, Qu Gourmet
6. … Kitchen Finks + Heroic Feast               6. … Pitiless Plunderer + Stridehangar…
7. … Pitiless Plunderer + Animation Module      7. … Herd Baloth + Necrosynthesis
```

Combo size still outranks both, so a 4-card row never sorts up among the 3-card rows it
shares cards with — and nothing is lost to that, because a family's rows are all the same
size by construction: they share every card but one.

**All of this orders rows and never cards.** Where a card sits inside a row is
`orderComboNames()`'s decision and the comparator only reads its answer. Two tests hold
that: one checks every row's drawn cards are identical before and after the rows are
sorted, and one checks the answer cannot depend on the order the rows arrived in. Measured
over the standing Chatterfang deck it is 195 drawn lists and 1,983 rows with no row's cards
moving.

**Combos in your deck** is deliberately left out: it is ranked by size and play count, and
`groupVariants()` hands its rows back in the order they arrived precisely so grouping
cannot reshuffle the most-played combo down the page.

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
Popularity decides between cards that make the same claim.

**Inside a card, size leads and the card names break the tie** — not popularity. Both nested
lists work this way: *Combos this unlocks* under a suggestion, and *The combos it holds
together* under one of your own cards.

Size first, because sorting those lists on play count alone put a 4-card line at the top of a
list whose own heading read *1 × 2-card · 4 × 3-card · 7 × 4-card* — two orderings of one set
of combos, one line apart, opening on the hardest thing to assemble. A template slot counts
toward that size, because something has to occupy it.

Then **alphabetically, and deliberately not by play count**. Ordering eleven rows by
popularity scatters every repeated partner down the list:

```
Scurry Oak + Archangel of Thune + Essence Warden          999 plays
Scurry Oak + Archangel of Thune + Prosperous Innkeeper    493
Scurry Oak + Sadistic Glee + Viscera Seer                 377
Scurry Oak + Ashnod's Altar + Sadistic Glee               333
Scurry Oak + Ashnod's Altar + Necrosynthesis              305
Scurry Oak + Carrion Feeder + Sadistic Glee               216
Scurry Oak + Archangel of Thune + Lunarch Veteran         186
```

Nothing there is out of order and all of it reads as unsorted, because the play counts are not
on screen — the Archangel rows are scattered across positions 1, 2 and 7, and a reader
scanning for a card cannot see why. Popularity still ranks the cards *above* these lists,
which is the job it is for: deciding which suggestion to show first.

Popularity is a tie-break rather than the ranking, and `pop` is absent from some variants:
a missing one counts as zero, so ordering never depends on whether a field is there. With
no popularity anywhere — old data, or a test fixture — the order falls back to alphabetical
exactly as before.

### What the count is made of

A count of combos says nothing about how hard they are to pull off, and the difference is
large: a two-card combo needs two cards on the table, a four-card one needs four to be
found, cast and kept alive. "+6" reads identically whether it is six two-carders or five
four-carders and a two.

So every recommendation carries its own breakdown, on the last line of its own column:

```
  +3    │ Thassa's Oracle
COMBOS  │ EDHREC · Scryfall · + Add to deck
  2+1   │ 1 × 2-card   1 × 3-card   1 × 4-card

  +1    │ Mana Crypt
COMBOS  │ EDHREC · Scryfall · + Add to deck
        │ 3-card
```

That is the narrow reading, which is the one every width used to get. Two of those three
lines change shape where the row's column is wide enough to afford it — the split spells
itself out, and the links move up beside the name — and both are keyed on the column
rather than the window. See
[The card's links share its name's line where the row is wide](#the-cards-links-share-its-names-line-where-the-row-is-wide-and-that-threshold-is-not-the-splits).

**And so does every card in *Cards carrying your combos***, where the same argument applies
in reverse. That panel exists to answer "what would cutting this cost me", and a bare
*9* in the gutter is one number covering nine different propositions:

```
   5    │ Basalt Monolith
COMBOS  │ EDHREC · Scryfall
  3+2   │ 3 × 2-card   1 × 3-card   1 × 4-card
```

A card holding up three two-card lines is a very different card to cut than one holding up
nine four-card ones, and the count alone cannot tell them apart. The layout test asserts the
pills are in the card's own column, are smallest-first, and **sum to the total in the
gutter** — a breakdown that disagrees with its own total is worse than none.

Four details, each of them a decision:

- **The last line of the row, not squeezed onto the card's.** They used to share the name's
  line to save a line per row, which mattered when the row had four lines to spend. Moving
  the split into the gutter (below) paid for one, so the name, the links and the pills got
  one each. **Measured at 390px, this is a trade and not a free win:** a row that carries a
  split is 127px where it was 156px, and a row without one 115px where it was 120px — but the
  pills now live in a 248px column instead of the row's full 324px, so a row whose three
  pills wrap is 141px against 120px. Across a whole panel it goes both ways: the deck with
  unofficial rows loses 72px, the tuning deck gains 46px. On the name's line the pills
  wrapped anyway wherever there were three of them.
- **Unlabelled.** "1 × 2-card" under a card name, in a panel headed *Suggested additions*,
  does not need a caption explaining that it is about combo sizes — and a caption would
  repeat on all eighty rows.
- **The total is the number alone.** `+3`, not `+3 combos`: the word is under it in the
  gutter, and saying it twice per row is eighty repetitions. It is not simply dropped, though
  — the total carries `title="unlocks 3 combos"`, and the layout test fails if any total on
  the page cannot say what it counts.
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
  problem: its parts sum to the total in the row's gutter, which the layout test asserts.
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
- **Each option is a grid, never a wrapping line.** *name · links · + Add* on one row
  where the column has room for it, and *name* above *links · + Add* where it does not
  — a grid area either way, with the name column the only one that gives:
  `minmax(0, 1fr)` plus an ellipsis. As a wrapping flex row, a long name pushed its
  **+ Add** onto a second line — measured on a phone, *The Destined White Mage* put its
  button 113px left of the row above it — so some rows were one line, some were two,
  and no two buttons shared an edge. The difference between that and the two shapes
  here is that the *width* decides, not the name: every option in a list changes
  together, and the button is in the last column of both shapes, so the buttons share
  an edge at every width. The layout test measures those edges and fails if they
  differ. Which shape a column should be in, and why the threshold is where it is, is
  in [Where the second number goes](#where-the-second-number-goes-and-why-it-is-a-second-number)
  — it is the same measurement that decides where the *Compare* pill sits.
- **The name is clipped, not shortened.** The full text stays in the DOM, so a screen
  reader reads it, find-in-page finds it, and copying the row copies all of it; only
  the drawing stops early, with `title` putting it back within reach of a pointer.
  Cutting the string in JavaScript would have taken the information away for real.

#### Comparing a whole choice at once

Grouping sixteen cards into one decision is only half the job: **making** that
decision means looking at sixteen cards, and the links beside each name go to one
card each. So a choice carries one more link — **Compare all 16** — which opens every
card in the group on a single Scryfall page, images and all.

**Every combo row carries the same link, under a different verb.** *Combos in your
deck*, *Combos this unlocks*, *The combos it holds together* — each row ends with **See
all N cards** beside its Spellbook link, opening every card in that combo on one
Scryfall page.

It says *see* and not *compare* deliberately. A choice between interchangeable cards is
a comparison: the reader weighs them and picks one. The cards a combo needs are not
alternatives at all — they are all required — so inviting a comparison is inviting the
wrong idea. One query builder, two callers, two verbs; the layout test fails if a combo
row's link says "compare".

It is **one link rather than one per card name**: a four-card row would carry four, the
heading is the combo rather than a list of links, and reading the cards is a single
action so it is a single press.

**Both links sit above the result chips, not below them.** What a combo *needs* is read
before what it *does* — the cards decide whether the row is worth reading at all, and a
reader after the steps or the card images should not have to scroll past a wall of
result chips to find the way out. Both row types do it in that order: an ordinary
combo and a collapsed choice. The layout test compares the two
elements' document positions and fails if the links drop below the chips. Named cards only — a template slot has no card to open, and the row
already names what fills it. A collapsed row's link covers its shared cards *plus* all
the interchangeable ones, since that whole set is what the reader is choosing between.

**The wording is cut to fit the column, and the link shares its row wherever that
fits.** The label's own sentence is 163px and the link 108px. *"or any one of these 15
instead — same combos:"* needed two rows on a phone all by itself, so it reads **"or
these 15, same combos:"** — and *"or this one, same combos:"* when there is a single
alternative, since *"or these 1"* is not English. The link dropped *on Scryfall* for
70px of the same budget; its `title` and accessible name still say where it goes.

What the layout test measures is the **sentence**, over its own text node rather than
the label's box — because the box holds the link too, so a label reported as one line
can still be *"or these 2, same / combo:"* with the link beside it. That is not a
hypothetical: it is what happened when this block moved into the card's column, where
233px is not enough for both. The sentence has to be one line at every width, which
pins both halves of the budget — putting the old wording or *on Scryfall* back fails
the run — and where the link sits is the column's decision, asserted against the
column's own width in
[Where the second number goes](#where-the-second-number-goes-and-why-it-is-a-second-number).

- **The query is exact.** `DeckCombos.scryfallSetQuery()` builds
  `!"Blood Artist" or !"Zulaport Cutthroat" or …`. Without the `!`, Scryfall reads
  the words as a substring search and returns a different, larger set of cards than
  the group being offered — which would look like a working comparison.
- **The recommended card is included.** The link covers `group.cards`, not just the
  folded-away alternatives: the card in the heading is one of the options being
  weighed, and a comparison missing it is the wrong comparison.
- **A link, not a fetch.** Scryfall serves this as a GET, so the comparison costs
  this page no request and nothing to rate-limit, and it needs no JavaScript to
  have run. It is styled as a button because that is what it does, and kept quieter
  than the `+ Add` pills — adding a card is the decision, this is the reading you do
  first.
- **Whitespace is collapsed, which `nameKey()` does not do.** That function trims
  and lowercases but leaves inner spacing alone, correctly, because it decides
  whether a deck holds a card. Here the string goes into a search, where
  `!"Blood   Artist"` matches nothing at all.

Nine unit tests in `test/scryfall-query.test.js` cover the query; the layout test
reads the real `href` out of the rendered page and checks it names every card the
group shows, that every term is exact, and that the number in the label is the
number the query actually asks for.

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
— not resolved on every refresh. Resolving costs 465 Scryfall requests and a
quarter of an hour (see the measured table below), and templates change when a set
ships, a few times a year. Doing that nightly would spend both to learn that
nothing had moved.

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
  A combo whose slot the deck cannot fill is not reported anywhere — see "The panel
  that could not answer its own question" below.
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

### The panel that could not answer its own question

There used to be a fifth panel here, **One slot away**: combos the deck held every named
card for and could not assemble because nothing in it filled their slot. It is gone, and
this section is the record of that rather than a description of it, because removing it
reverses what this section used to argue.

**What it was for.** Not counting these combos is right — the deck genuinely cannot do
them. *Silence* about them looked wrong: "you hold Rings of Brighthearth and need any
Persist Creature" is a real deckbuilding fact, and the original behaviour was to drop the
row and mention nothing. So the panel narrowed hard — one gap and nothing else missing,
inside the deck's colours, and only slots whose id the data could actually read — and then
reported the slot, how many cards fill it, and six of them ranked by how many of your own
stuck combos each would unstick.

**Why it went.** It is the one section that could not answer its own question. A slot 394
cards fill has no card to recommend, so every row reduced to a slot name, a count and a
handful of examples, and left the reader to do the rest. The four panels around it each
end in something you can act on — a card to add, a card to cut, a combo to look for. This
one ended in a research task.

**What was given up, plainly.** The fact itself. A reader who wants it now has to ask from
a terminal — `node tools/deck-gaps.js deck.txt` answers exactly this question and more
besides — and that is a different audience from somebody pasting a decklist into a web
page. This is the cost of the removal and it is not zero; it is accepted rather than
worked around.

**What did not go with it.** Template slots are untouched, and the distinction is the
whole reason the removal is safe:

- A combo whose slot the deck *does* fill still renders that slot in its own row in
  "Combos in your deck", and still names the card credited with filling it.
- A filled slot still **counts as a card** in the size breakdown: `Rings of Brighthearth
  + a Persist Creature` is a two-card combo, and counting only the named cards would file
  it as a one-card one.
- `resolveSlots()`, `assignSlots()` and `templates.json` all stay exactly as they were.

What went is the panel, the row shape it needed, and `slotCandidates()` — which existed
only to feed it. `test/template-slots.test.js` is what is left of the tests: it holds the
line that matters, which is that a combo the deck cannot assemble is never counted among
the ones it can, plus the surviving half about filled slots. `npm run verify` now expects
four panels, and asserts that the fixture's one-slot-short combo appears **nowhere** in
the results rather than in a panel of its own — across every combo link on the page, since
the way this could go wrong is it surfacing somewhere it would read as a combo the deck has.

**One field outlived it.** `unresolvable` — names for the 29 templates with no Scryfall
query — was published so a blocked row could read "Needs Haste Enabler" instead of "needs a
card". It is still published and still merged into the template names, because it is what
`tools/combos-with.js` and `tools/try-deck.js` read, and because a template with no card
list must still be a slot the deck cannot fill rather than an unnamed one. The page just no
longer has anywhere to print it.

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

## How a combo is executed

Every combo row already answers *what this does* — the result chips — and sends you
to Commander Spellbook for *how you do it*. Now the same line offers to bring the
answer here first: **How it works · View on Commander Spellbook → · See all 3 cards**.
The line that existed only to send people away is the right place for it, and the
link stays as the way out for every case where the panel cannot answer.

**The steps are not in the download, and that is the whole design.** The database is
103,737 combos and 27.65 MB parsed, of which the results field alone is 13 MB. The
steps add **51.70 MB** of text on top — twice the whole rest of the database, measured
rather than guessed — so publishing them for every combo would swamp a download [the page
already works hard to make once](#downloading-the-database-once-not-once-a-visit), to
answer a question a reader asks about two or three combos out of thirty-three. So they
are fetched for the one combo somebody stopped on, when they ask, and held for the rest
of the session — a row nobody opens costs nothing.

**Collapsed on every row, always.** A list of twenty-two combos is a list. Twenty-two
sets of steps is a document nobody asked for, and it would bury the ranking the panel
above it spent so much effort getting right.

**Four states, and the last two are the ones worth building carefully.** The steps are
fetched, so they can be slow, they can fail, and Spellbook can simply never have
written any. Waiting says so; a failure names what went wrong and points at the link
beside it; "no steps recorded for this combo yet" is an answer rather than an empty
box. The panel drops its quoted-block styling for all three — a line saying there is
nothing to read should not occupy the row as heavily as three steps that there are.
A failure is also **not cached**, unlike the other two: the network being down when
somebody pressed the button says nothing about whether the combo has steps, so the
next press asks again instead of being told "no" forever.

**An unofficial row borrows the published combo's steps, and says so.** That is the
one place this panel could mislead: the row exists *because* a card has been swapped,
so the steps name a card the deck does not run. Every such row leads with the swap —
*"These are the published combo's steps. Read Sadistic Glee as Necrosynthesis"* — and
a chained row names both swaps. Unattributed, the page would be quietly printing
instructions for somebody else's deck.

**Fetching from Spellbook directly is ruled out**, and it was ruled out before this
panel was written: their `CORS_ALLOWED_ORIGIN_REGEXES` allows `*.commanderspellbook.com`
and localhost, which is [the same restriction that made this project publish data
instead of querying it](#why-the-data-is-published-not-queried-live). So the steps are
published on the `data` branch by the nightly refresh — no CORS question, since
`raw.githubusercontent.com` is already in the CSP. `setSource()` stays a seam anyway,
so if that allowlist ever admits this origin their endpoint drops in with no adapter.

### One file per combo, and the four cleverer things it beat

Five ways to publish 51.70 MB so a reader can fetch 500 bytes of it were built and
measured — `tools/measure-steps.js`, run on a runner because it needs the whole bulk
export. What each costs to open one combo:

| | requests | downloaded | |
| --- | --- | --- | --- |
| **one file per combo** | **1** | **0.5 KB** | 103,737 files on the branch |
| blob + offset table | 1 | 0.5 KB | after a 126.9 KB index |
| sharded JSON, 512 ways | 1 | 21.7 KB | |
| SQLite over byte ranges | 4 | 16.0 KB | sequential — each trip decides the next |
| Parquet, best of three tunings | 2 | 76.0 KB | 51 row groups; larger groups were far worse |

The blob tied on paper and lost on two things that only appeared once the design was
tested against the actual host rather than reasoned about.

**A range request to `raw.githubusercontent.com` does not address the bytes you think
it does.** They serve almost everything as `text/plain` and Fastly gzips it, so
`Range: bytes=1000-1099` returns bytes 1000–1099 *of the gzip stream*. A 100 KB file
of `A`s reports its total size as 133. A browser cannot opt out — `Accept-Encoding` is
a [forbidden header](https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name),
so `fetch()` always offers gzip and always gets it. Of 25 extensions probed, exactly
one came back uncompressed with honest ranges:

```
.bin .dat .png .wasm .gz .br .parquet .db .pdf .woff2 .jpg .gif
.webp .mp4 .7z .tgz .jar .bz2 .xz .zst .tar .ico .epub
                          → text/plain; charset=utf-8, content-encoding: gzip
.zip                      → application/zip, no encoding, ranges over the real bytes
```

Which also means the SQLite figure above measures something a browser cannot do: it
was taken with `curl`, which sends no `Accept-Encoding` and so gets identity ranges.

**And an offset table has to be keyed on something.** Keyed by row number it is small,
and it breaks every morning: `search.js` serves a cached `combos.json` for the session
and revalidates behind it, so on the first visit after a refresh the reader's row
numbers are yesterday's and the offsets are today's. Keyed by combo id — the only
stable key — the table has to carry the ids, which makes it big enough to want
sharding, which costs the extra round trip the blob existed to avoid.

Follow that to the end and **the index disappears into the filename**. If the URL
contains the id there is nothing to look up: no table to download before the first
answer, no offsets to keep in step with anything, no dependence on how a CDN feels
about content encodings, and a 404 is a complete and correct answer meaning "no steps
recorded". The cost lands on the publisher, which is where it can be measured and
afforded — 103,737 files is 24s to `git add`, 1.6s to commit and a 19.8 MB pack, in a
job that already spends minutes streaming a 512 MB export.

As published the tree is **75.01 MB**, not the 51.70 MB of text in it. The difference is
Spellbook's own field names — `notablePrerequisites` rather than `n` — plus the id on
every record: 45% overhead, paid deliberately. It is what makes a published file
something `normalize()` could have been handed straight from their API, and what lets
`pick()` be tested as an equality rather than as a translation. The CDN gzips it back
off on the wire; on the branch it is 23 MB in a build artifact nobody clones.

Two details carry the correctness. Ids are hashed into **256 directories**, not for
the reader — `raw.githubusercontent.com` does not care — but for git, which rewrites a
directory's tree object whole whenever anything in it changes. And every record is
**stamped with its own id**, which the reader checks against the one it asked for. The
id is in the URL, so that can only disagree if a file was published to the wrong path;
it costs about fifteen bytes a row to make impossible the failure [this project
engineers against everywhere
else](#the-combo-id-is-not-published-because-it-is-derivable) — the answer that works
and is quietly about something else.

Because there is no manifest, nothing downstream can notice a tree that is quietly
wrong — a reader would press the button, be told there are no steps, and believe it.
So `tools/check-snapshot.js --steps` computes the manifest instead of publishing one,
and refuses the publish over coverage collapsing, a file in a bucket no reader will
look in, a record stamped with someone else's id, or a file for a combo that is not in
today's snapshot. Every file, not a sample.

### What a variant actually contains

`normalize()` was written against field names read off Spellbook's website and guessed
at. **A guessed field name does not fail loudly** — it comes back `undefined` and the
panel quietly shows one fewer line — and nothing in this repository recorded the real
ones, because `compact()` keeps six fields and drops the rest without naming them.

It also could not be asked from a laptop: their API refuses browser requests from
anywhere but their own origin. But `.github/workflows/update-data.yml` streams that same
bulk export every night on a runner, so CI can see it. `tools/peek-variant.js` prints one
variant whole, and `.github/workflows/peek-variant.yml` runs it on demand. Run against
`2290-2919`, it gave:

| field | what it holds |
| --- | --- |
| `description` | the steps, one per line — *"Remove a +1/+1 counter from Spike Feeder to gain 1 life.\n…"* |
| `notablePrerequisites` | the conditions worth stopping on — *"Spike Feeder has at least two +1/+1 counters on it."* |
| `easyPrerequisites` | the ones a player assumes; often empty |
| `manaNeeded` / `manaValueNeeded` | mana, as symbols and as a number |
| `uses[].zoneLocations` | a letter per zone: `B`, `G`, `H`, `E`, `L`, `C` |
| `uses[].battlefieldCardState` | and `graveyardCardState`, `exileCardState`, `libraryCardState` — one per zone, empty strings rather than absent |
| `uses[].mustBeCommander`, `quantity` | |
| `notes`, `spoiler`, `popularity`, `identity` | |

**One guess was wrong**: `otherPrerequisites` does not exist. That was the field
`normalize()` read for its prose prerequisites, so it had been reading nothing at all.
The two real fields are now read in the order they are meant to be, notable first.

**And the hand-written sample was wrong about the cards.** While the panel was a
prototype it answered from three combos written out by hand; that version of this one
said *"remove two +1/+1 counters to gain 2 life"*, and Spellbook's own text says one
for one. Nobody would have caught that by reading the prose, and it is the argument for
this panel quoting them rather than explaining the cards itself. The sample is gone now
that there is real data — a fallback that invents instructions would make a page that
had failed to wire up its data look exactly like one that had.

Deliberately a tool run on demand rather than a test. It asks a live third party a
question, and a check that fails when somebody else has an outage is a check that gets
muted. Run it when the shape is in doubt, read the answer, write it down here.

**What gets published is a subset of what they send, not a format of our own.**
`ComboSteps.pick()` selects exactly the fields `normalize()` reads — dropping card
images, prices, legalities and the full result list, and collapsing the four per-zone
state fields into the one `describeUse()` would have reached anyway. The test is an
equality rather than a spot check: `normalize(pick(v))` must deep-equal `normalize(v)`
for every variant shape, so whatever `pick()` drops provably cannot change a line the
reader would have seen. Both ends import the same module, as the publisher and the page
import the same `pathFor()`.

**What is still rough.** Nothing measures what a real fetch costs on a phone — the same
gap that made the data-side work hard to rank until the footer line closed it, and the
numbers in the table above are bytes and round trips rather than milliseconds on a train. And
`combo-steps.js` is page-only, like `graph.js`: the worker does not import it, because
nobody has asked for steps at the moment a search runs.

## The combo map

*A prototype.* It draws, it keeps up with the deck, and it is tested — the rough
edges it still has are named at the bottom of this section rather than smoothed
over.

Under "Combos in your deck" sits the same set of combos as a picture: **a dot per
card, and a line between two cards that overlap**. Two cards can overlap in two
quite different ways, and the map draws both:

| | What it means |
| --- | --- |
| **Solid line** | *a combo needs both of them.* A combo of three cards is a triangle, not a chain — every pair inside it is a pair the combo needs, and drawing two of the three lines would say two of the cards were unrelated. |
| **Dashed line** | *they do the same job.* Swap one for the other and one of your combos turns into another of your combos. Your sacrifice outlets are never in a combo *together* — they are alternatives — so this is the only line that will ever join them. |

Three more things carry meaning, and nothing else does:

| What you see | What it means |
| --- | --- |
| **Dot size** | how many of your combos that card takes part in — the same count "Cards carrying your combos" ranks by, sized by area so a card in nine combos is not drawn eighty times the size of one in a single combo |
| **Line weight** | how much the pair overlaps, on whichever of the two meanings its line is for, capped so one very busy pair does not draw a bar across the map |
| **The number on a line** | the same thing said exactly: *6* on a solid line is six combos needing both, *23* on a dashed one is twenty-three combos where either card will do |
| **Line colour** | on a solid line, the best result of the combos behind it, in the same three tiers the result chips use: **green** wins the game, **yellow** is real value something else must convert, **grey** is plumbing |

What all of that adds over the panels around it is shape, which is the one thing
a list cannot show. "Cards carrying your combos" will tell you Basalt Monolith is
in five combos and Dramatic Reversal is in two; it cannot tell you that the deck
is one artifact-mana engine with a Heliod cluster bolted on, or that six of your
cards are the same lifegain trigger wearing different hats. That is a picture,
and it is usually the thing you wanted to know before cutting anything.

Hovering a card lights it, everything it touches and the lines between them, and
pushes the rest back. On a deck with thirty combos in it that is the only way to
read the thing — every line is drawn at the same weight until you ask about one
card.

### Picking two or three cards out

Hovering asks *what is this card tangled up with*. The question after it is
always about two or three at once — **these look like the same effect, which do I
keep?** — and that one is not about any single line on the map.

Pressing cards pins them. What lights is then what they have **in common**: the
lines between them, and the cards every one of them combos with. Everything else
goes quiet, and a line under the map counts it out:

> **Carrion Feeder, Viscera Seer and Ashnod's Altar**: 3 of your combos take any
> one of them in the same slot. All three combo with Cauldron Familiar, Herd
> Baloth, Sadistic Glee and 2 more. Cut all three and 7 of the 17 combos they
> appear in would go; the other 10 have a stand-in.

That last number is the one worth the feature, and it is not the sum of anything
on the card list. **Cutting a card does not cost you its combos when another card
in your deck fills the same slot** — which is exactly what the interchangeable
relation knows and a combo count does not. On the tuning deck, cutting *Essence
Warden, Soul Warden and Prosperous Innkeeper* — 33 combos between them — costs
nothing at all, because Lunarch Veteran, Elas il-Kor and Case of the Uneaten
Feast cover every one. Cutting *Herd Baloth and Scurry Oak* costs 16 of 47.

The arithmetic is `compare()` in `graph.js`, counted from the combos rather than
from the graph: "how many combos need all three of these" is a question about
combos, not about pairs. Pressing a pinned card again unpins it, pressing the
background clears them, and Escape does too.

**The cards are buttons.** A shape you press to change what the page says is a
button whatever it is drawn as, so each one is focusable, carries its own name
and combo count, reports whether it is pinned, and the comparison is announced
when it changes. That is also why the map as a whole is a `group` and not an
`img`: an image is not something you press.

**Either question on its own.** Three chips above the map — *Both*, *Works
together*, *Interchangeable* — hide one set of lines or the other. Nothing moves
when you switch: the layout is worked out from both relations at once and stays
put, so a card's neighbours are still its neighbours and the filter only ever
takes lines away. On a real deck "Interchangeable" is the view that answers
"which of these are the same card in different clothes" in one glance.

### Why interchangeable had to be its own relation

The first version drew only the solid lines, and it was wrong in a way that took
a real deck to see: **the cards a reader most wants grouped were the ones it
pushed furthest apart.** Four sacrifice outlets never appear in a combo together,
so on shared combos alone there is nothing joining them at all — and every node
repels every other, so they ended up in four different corners. The map answered
"what works with what" and was silent on "which of these do the same job", which
is the question you ask when you are deciding what to cut.

**Interchangeability is measured exactly, not by similarity.** Two cards are
interchangeable in a combo when the rest of that combo is identical — the same
rule `groupVariants()` already uses to collapse *Scurry Oak + Sadistic Glee +
Carrion Feeder* and its Viscera Seer version into one row. A looser measure was
tried first: how many partners two cards happen to share. On the tuning deck that
produced **302 pairs against the exact rule's 48**, most of them saying nothing
at all, and its top entries were the same pairs the exact rule already found.

**The pull is asymmetric, deliberately.** A dashed line pulls its two ends
together harder than a solid one, and that asymmetry is the whole reason the map
groups anything: cards that do the same job are exactly the ones a reader wants
side by side, while cards that combo together are already tied by the combo
itself. A swap link also earns a flat bonus before its count is counted, because
one combo where either card will do is already the strongest statement the data
makes — without that step a single swap (pull 1.4) barely beat a single shared
combo (1.0), and on a fixture of three outlets around one payoff the third outlet
still settled nearer the payoff than its own alternatives.

On the tuning deck the result is six legible groups: the sacrifice outlets, the
lifegain triggers, the counter payoffs, the lifegain payoffs, and two smaller
pairs — none of which existed as a shape on the map before.

### Filtering by what the line is worth, not just by what it is

Three of the four chips ask **which relation** to draw: both, works-together, or
interchangeable. The fourth asks a different question about the same picture — what the
combo behind the line is *worth* — and on a deck whose map runs to over a hundred lines
it is the one that makes it readable. *Show me only the lines that end the game.*

The data was already there. `graph.js` puts the best tier of any combo behind an edge on
the edge itself, so the filter is a class on the `<svg>` and a CSS rule, exactly like the
relation views: the cards do not move, the layout is still worked out from both relations
at once, and switching is the same picture with lines taken away.

**Interchangeable lines are not in that view, and that is a decision rather than a side
effect.** A swap line says "these two do the same job" — there is no combo behind it, so
there is no result and no tier it could be filtered by. Leaving them in would answer a
question about game-enders with a screenful of lines that are not combos at all. The
chip's title says so, because a filter that silently drops a category is worse than one
that does not filter.

The part that needed a test was smaller and easier to get wrong: **the tier has to be on
the number as well as on the line.** It was on the line only, so the first version of
this view hid every count on the map, including the counts belonging to the lines it was
showing — a filter that removes the information it was opened to read. The layout test
asserts the count survives, and confirms it by failing when the class is taken off again.

### The number on a line

Thickness says "more than that one". It does not say how many, and the difference
between an interchangeable pair worth 3 combos and one worth 17 is a
deckbuilding decision, so the count is printed on the line as well.

Not on all 162 of them. The strongest fourteen are on screen at rest; every other
line's number is drawn, hidden, and shown when either of its cards is picked out
— where it is one card's dozen lines rather than the map's hundred and fifty.
Each number is offered a place in the same occupied space the dots and the card
names hold, sliding along its line and then off it if the midpoint is taken.

Two orderings in that came from watching it fail:

- **Numbers are placed before card names**, not after. The heaviest overlaps sit
  in the middle of the deck's engine, which is exactly where there is no room, so
  leaving them until last meant the map's biggest number was the one it never
  printed. A name crowded out comes back on hover; so does a number, but the
  number is the thing being asked for.
- **A number may step off its line.** The very biggest overlap is usually two big
  dots side by side, and the whole length of the line between them is inside
  them — there is no room *on* that line at any point along it.

**A card filling a template slot is on the map like any other.** It holds the
combo up just as much as a card the combo names, and cutting it costs the combo
all the same. That is the same rule "Cards carrying your combos" applies, and a
test pins the two panels to the same set of cards so they cannot drift apart.

**The placement is deterministic, which is not the usual choice.** A
force-directed layout normally seeds its starting positions at random. This one
starts from a ring in a fixed order — busiest card first, ties broken by name —
so the same deck always draws the same picture. That matters here because the map
is thrown away and rebuilt by *every* search, including the one **+ Add to deck**
fires: with random seeding, adding one card would reshuffle the whole picture and
every card would appear to have moved.

**No charting library.** The page's Content-Security-Policy allows scripts from
nowhere but itself, so a library would have to be vendored into the repository.
Fruchterman–Reingold — every node pushes every other away, every edge pulls its
two ends together, the whole thing cools over a fixed number of steps — is about
thirty lines, plus a pull toward the centre so that a deck whose combos fall into
two unconnected clusters does not simply push them off the canvas.

**The arithmetic is in `graph.js` and the drawing is in `app.js`.** `build()`
turns combos into `{nodes, links}` and `layout()` places them; neither knows what
SVG is. That is what makes the interesting half testable in node, where there is
nothing to look at: `test/graph.test.js` asserts that cards filling the same role
are joined and drawn closer than the payoffs they all combo with, that two such
groups stay two clusters, that a pair which is both ways round is still one line,
that the biggest overlap keeps its number even in a knot, that nodes land inside
the canvas, that no two dots overlap *given how big they are drawn*, that no
label or number is drawn over a dot or over another one, that a crowded map drops
names rather than piling them up, that an unconnected cluster is still on screen,
that two identical searches draw identical pictures, and — for the comparison
behind picking cards out — that cutting a card with a stand-in costs nothing,
that cutting every alternative costs the lot, and that a card filling a template
slot is compared like any other. The layout test
then presses the real page: the map renders at every viewport, in three colours,
scales with its column, dims on hover, and **grows a card when + Add to deck is
pressed** — a picture one search behind the list beside it would be worse than no
picture at all.

### What a real deck does to it

The first list this was tried against was a 91-card Abzan aristocrats deck, and
it drew **28 cards and 114 lines** — four times the density the first version had
been built against, and it broke three things at once. All three fixes are about
crowding, and none of them is visible on a small deck:

**Dots landed on top of each other.** The force run is about structure and knows
nothing about how big anything is drawn, so it happily settled two 20px dots 6px
apart — one blob, reading as one card. A separation pass now pushes overlapping
dots apart along the line between them, a few rounds until nothing overlaps, and
because that pulls the picture in from the edges it was scaled out to, the fit is
run once more afterwards. That second fit can only ever scale *up*, so it cannot
reintroduce an overlap.

**The canvas is sized for the deck**, from 760×440 up to 900×760. The dots and the
type are a fixed size in those coordinates, so a bigger canvas is a relatively
smaller dot and more room for names — on that deck it took the labels that could
not be placed from 10 to 6. It costs nothing on screen, because the SVG is scaled
to its column either way: a bigger canvas is a taller panel, not a smaller
picture.

**Labels were drawn across other cards' dots**, which is worse than no label —
a name over a dot belongs, to the eye, to that dot. Every dot is now occupied
ground before a single label is placed, each name is tried in six positions
(under, over, either side, then a line further out), taken in order of dot size,
and dropped if none of them is free. A dropped name is still there on hover,
which is one label rather than forty.

That last one had a wrong first version worth recording: with only *two*
positions to try — under and over — the cards losing their names were the ones in
the middle of the deck's engine, because a central dot is ringed by other dots.
Measured on the same deck, the dropped labels had a *larger* average dot than the
kept ones: precisely backwards. Sideways is where the room is in a crowd, and
with six positions the deck drew 22 of its 28 names, the busiest included.

**Sixty cards, then it stops.** Past that the labels collide faster than any of
this can separate them, and the repulsion pass is O(n²) per iteration. The
busiest cards are kept and the panel says how many were left out, rather than
quietly drawing a smaller deck than the one it was given.

### A phone gets a different map, not a smaller one

Every length on this canvas is in canvas units, and the whole canvas is scaled
into whatever column it lands in — so what a reader actually sees is the *ratio*
between the two, and the only way to make anything bigger is to make the canvas
smaller relative to what is drawn on it. A narrow column therefore gets its own
preset: a canvas around 430 units instead of 900, type at 15 units instead of 11,
and names cut to 12 characters instead of 18. On a 370px column that puts card
names near 13px, against 4px for the same map drawn desktop-sized.

The names are cut shorter to pay for the type. A label is far wider than the dot
it belongs to, so at 15 units two full-length ones at opposite edges would set
the width of the whole picture — and the width of the picture *is* the scale. A
tap gives the rest of the name.

**One decision, not two.** The type size lives in `sizeFor()` and reaches the
stylesheet as a custom property, because the layout reserves room for a name by
measuring a box and the page draws that name at whatever CSS says. Those two were
briefly different numbers — a media query bumped mobile labels to 13 units while
the layout went on reserving room for 11, so every box on a phone was 18%
narrower than the text put in it.

**The canvas is trimmed to the drawing.** A graph is rarely the shape of the box
it is fitted into, and the fit scales to whichever axis binds — so the other one
comes back short and the difference is empty screen. On a phone that was 40% of
the panel. The layout now reports the box it actually used, which is also what
stopped names being clipped at the edges: the fit sizes the *dots*, and the names
hang off them, so the box has to be measured after they are placed.

**What it does not do yet.** There is no dragging, no zoom, and no click-through
to a card, and the layout is worked out once per search — rotating a phone
rescales the same picture rather than re-laying it out for the new shape. The map
is also one image to a screen reader, with a one-line description; everything on
it is written out in words in the panels above, which is the better read anyway.

### Asking how wide the column is, and the 601ms it used to cost

The scaling above needs one number from the page: how wide the column the map
lands in actually is. It cannot be read off the window — at 1000px the page is two
columns and this is not the wider one — so `renderGraph()` measured the panel it
had just built, with `body.clientWidth`.

That property read was the single most expensive line on the page. Reading any
geometry flushes pending style and layout for the *whole document*, and this one
ran mid-render: "Combos in your deck" had just put ~15,000 nodes in, so the read
laid the page out, and then the pieces and suggestions panels added ~78,000 more
and it was laid out again before paint. Two full layouts a search, and the first
one bought nothing but a number. On a 520-combo deck at 390px with the CPU
throttled 4× it was **601ms of a 3,620ms search** — more than the download, the
parse and the matching put together, which is 600ms of that same search.

**Drawing the map earlier does not fix it, and was measured making it worse.**
The obvious move is to build the map before the heavy panels, since `#graph` sits
in a fixed place in `index.html` and building it early moves nothing a reader
sees. On a re-search that is slower, not faster: the *previous* render is still in
the document, so an early read flushes a bigger tree than the late one did. It
went 3,689ms to 4,106ms. The problem was never where the read happened.

So the render path does not read geometry at all. A `ResizeObserver` on the panel
body keeps the width in a variable, and its callback runs after layout, where the
number is already computed and costs nothing to take. Warm searches went 3,689ms
to 2,965ms, a fifth of the whole search, and the map is identical — checked at
five widths, on two decks, on a first search and a re-search. The first search on
a fresh page still reads the width directly, because there is nothing to observe
until the section has been laid out once; that one is unavoidable and is paid once.

Two details that are easy to get wrong here. The observer takes
`borderBoxSize`, not `contentRect` — `.panel-body` carries 1rem of side padding,
which `clientWidth` includes and `contentRect` excludes, so the neat-looking
option draws every map 32px narrower than before. And `panel()` throws the body
away and builds a new one every search, so the observation has to be moved to the
new node each time while the cached number carries over, since what it describes
is the column and the column has not changed.

**The guard is a count, not a duration.** A regression here is invisible twice
over: the page draws exactly the same map, and a timing threshold on a shared
runner is a flake. `tools/verify-layout.js` counts reads of `clientWidth` while a
re-search runs and fails if there are any — `columnWidth()` holds the only
synchronous read of it in the shipped page, and by the second search the cache is
warm, so zero really means zero. That is also why the observer takes the width off
the entry rather than reading `target.clientWidth`, which would have been correct
and free: it would have put two counts of noise into a check whose whole value is
that the answer is exactly zero.

## The combos come first, and the rest of the page arrives after

The page was slow on a phone, and the reason turned out not to be that it did too
much work. It was that it did all of it before letting the browser draw anything.

`renderResults()` was one synchronous task: combos, then the unofficial rows, then
the map, then the pieces panel, then the suggestions panel. A browser cannot paint
in the middle of a task, so on a 520-combo deck at 390px with the CPU throttled 4×
the reader watched a dead page for **3,094ms** — even though their combos had been
built after about 800ms of it. The remaining two seconds went on three panels that
are nine screens below the fold and that nobody has scrolled to yet.

It now yields after the combos. Same work, different order:

| | combos on screen | everything built |
|---|---:|---:|
| one task | 3,094ms | 2,066ms |
| yielding | **797ms** | 2,558ms |

**This is a trade, not a free win.** Total building goes *up* — scheduling frames
costs something — so the phone does slightly more work than it did. What changes is
that the reader is not made to watch it. The number that got 3.9× better is the only
one they experience; the number that got worse describes work happening behind an
answer they are already reading.

**The three panels are emptied immediately and filled a frame later**, rather than
left alone until their replacements are ready. Leaving them would be smoother — no
gap, no re-grow — and would put the previous deck's numbers under a list that had
already changed, for a second and a half, every time somebody pressed **+ Add to
deck**. The map has a rule about this already: one search behind says the added card
is in no combos. Three panels visibly absent beats three panels quietly wrong.

Clearing them turned out to be most of the win as well as the honest choice. An
earlier version that deferred the panels but left the old contents in place only
reached 1,674ms, because the frame carrying the combos still had to lay out and
paint the 93,000 nodes of the previous render sitting underneath them.

**Two things that are easy to get wrong here.** The suggestions panel's
`computeSuggestions()` and `groupSuggestions()` calls are *inside* the deferred
callback rather than passed to it as arguments — as arguments they are evaluated
immediately, which would leave ~150ms of the work they were supposed to defer on the
critical path, to hand a finished list to a function that will not be called for
another frame. And every deferred callback carries the token of the render that
booked it and does nothing if a newer search has started, because "+ Add to deck"
fires a search straight away and a stale callback landing late would draw the
previous deck's map over the current deck's results.

`tools/verify-layout.js` books a frame from the top of the render and records which
panels are filled by the time it runs. It asserts in both directions: the combos are
in that frame, and the pieces and suggestions panels are not. Checking only the first
would pass on a page that had gone back to one task; checking only the second would
pass on a page that painted nothing at all.

## Adding a card, and searching again

Every suggestion carries **+ Add to deck**, and so does every interchangeable
alternative under it. It writes `1 <card>` into the decklist, keeps the list, and
submits the form again.

**The card goes into the main deck, not onto the end of the box.** Several sites
export a list that ends in a `Sideboard:` section, and a card appended below that
heading parses as a sideboard card: it never enters the deck, so the next search
suggests it again and the button looks like it did nothing. `Commander:` was quieter and
worse — the card silently joined the command zone.

`DeckParser.addMainDeckCard()` writes it at the **end of the biggest main-deck run**,
above the blank line separating that run from whatever follows, so the list keeps the
shape its owner gave it. Not the first line that leaves the deck: on an export that opens
with its command zone that is line 0, above everything, which parses correctly but reads
as though the button misfired. MTGO's `SB:` lines carry their own marker instead of a
heading, so they are stepped over too and the card lands above them.

Biggest rather than last, because a section can split the deck in two — a sideboard in
the middle of a list, an export that repeats its `Deck` heading — and then which run is
"the deck" is a question about weight of cards, not about which one came last. A card
added to a 60-card block reads as belonging; the same card added to the one-line block
below the sideboard does not. Ties keep the later run, so an ordinary single-block list
is unaffected.

That is as far as "we don't know where it goes" ever has to reach. **+ Add to deck only
exists once a search has found combos**, and that needs a deck — so the deck is always in
the box somewhere, and the only real question is which run of it to write into. A list
with no deck in it at all takes the top of the box, where it parses as the main deck.

The insertion point is the same walk `parseDecklist()` does, kept in the parser for that
reason: two notions of "where the main deck ends" would drift apart the first time a
site invented a heading.

The layout test runs the whole press against a decklist that ends in a sideboard, and
the old behaviour fails it with *"put Deadeye Navigator below the sideboard heading,
where it is not in the deck"* and *"6 combos before adding and 6 after"*. Its previous
assertion — that the added card is the box's **last line** — was the bug written down as
a requirement, and is now a check on where the card landed relative to the section.

### When the heading and the card count disagree

One shape defeats all of that, because there the heading is simply wrong: a whole deck
pasted under a `Commander` heading with no `Deck` heading after it — what you get by
copying an export from the commander down and losing the second heading. Read literally
it is a hundred-card command zone, and since **colour identity is taken from the command
zone**, the deck ends up filtered against itself; the add button then appends a 101st
commander, which is the original bug wearing a different hat.

So one rule in the parser overrules the exporter: a command zone holding more than
`DECK_SIZED_RUN = 15` cards is not a command zone, and its cards are folded into the main
deck. `parseDecklist()` and the insertion walk apply the same rule, so a card added to
such a list joins the deck under the block rather than the command zone above it.

`test/parser.test.js` pins the threshold from both sides (15 believed, 16 not) rather
than deriving it from the constant, so moving it has to be a deliberate edit in two
places.

### Why the same argument does not extend to the sideboard

It is tempting to run the rule again on the other board, and an earlier version did. A
constructed sideboard is capped at fifteen cards and Commander has no sideboard at all,
so a sixteenth looks like the same kind of evidence — and it would fix a real failure. An
export whose `Sideboard` is followed by a heading the parser does not know keeps every
card after it on the ignored board, so a twenty-card deck parses to nothing and the
search reports no combos in a deck that is plainly there.

**It does not hold, because this sideboard is not the game's sideboard.** On Moxfield it
is where people park cards they are considering — saved to hand, not played — and such a
list has no size limit at all. Folding a stash of forty into the deck would invent combos
the deck cannot make. That is a worse failure than the one it fixes, and a much quieter
one: a deck that finds nothing is obviously wrong, while a deck that finds four combos it
cannot assemble looks exactly like a good result.

So sideboard cards stay out of the deck at every size, and `+ Add to deck` never writes
into a sideboard however large it is. The cost is that a deck lost behind a stale heading
is not recovered — but it is *reported*, in the `skipped` list the page shows under the
lines it could not use, which is the difference that matters. `test/parser.test.js` pins
this deliberately, at 1, 15, 16, 40 and 120 cards, so the argument has to be re-made
rather than re-discovered.

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

**Checked against Wizards' own Commander Brackets Beta chart**, not just against
write-ups of it. Every line above matches it, including the one that matters most here:
bracket 3 permits *late-game* two-card infinite combos, which is why a two-card win puts
a list at 3 rather than 4 — how early it lands is a judgement about play, and that is
one of the criteria this page does not make. The chart also lists *few tutors* for
brackets 1 and 2, and mass land denial and chained extra turns throughout; none of those
is a card name, so none is checked.

So what the page reports is a **floor** — the lowest bracket the list is still
eligible for — and never a verdict. A deck with no Game Changers and no two-card
win *could* be bracket 2; whether it is depends on mass land denial, chained extra
turns, how many tutors counts as "a few", and how early a combo lands. None of
those is a card name, so none of them is guessed at.

### One line, in the shape of the colour identity

The check is **a label and five pips**, sitting directly under Colour identity and
built from the same geometry — two readings of one list, so they read as a pair:

```
COLOUR IDENTITY  {U}{G}
BRACKET          1̶  2̶  ③  4  5
```

Brackets the list has ruled itself out of are struck through and dimmed, the floor is
the one filled pip, and the brackets still open are outlined. Three states, because
"could be this" is genuinely not a milder version of either "cannot" or "is". Showing
the whole scale is what makes the number a position rather than a score from nowhere,
and it says *floor, not verdict* without a word: the lit range runs to the right-hand
end.

**Everything else is one hover, focus or tap away** — the reasoning, the Game Changers
**with their EDHREC and Scryfall links**, the combos behind the floor, and the list of
criteria nobody checked.

This is a deliberate reversal. The caveat used to be printed under the number and kept
unfoldable, on the argument that a bare bracket number reads as the whole answer. That
argument still holds, which is why the hover panel carries the full caveat rather than
a summary of it, and why the panel is reachable three ways rather than by mouse alone:

- **Hover** for a mouse, via `:hover` on the wrapper.
- **Keyboard**, via `:focus-within` — the pips are a `<button>`, so Tab reaches them
  and Escape closes the panel.
- **Tap**, via `aria-expanded` toggled on click, because a phone has no hover at all.
  A `title` tooltip alone would have left phones with a number and no way to ask why.

The pips are `aria-hidden`: five numbered circles read out as "1 2 3 4 5", which is
worse than nothing. The button carries the whole answer as its accessible name —
*"Bracket 3 at the earliest — Upgraded. Why this bracket?"* — which the layout test
asserts, along with the pip states, that the panel starts closed, that a press opens
it and a second press closes it, and that the card links survived the move.

**"Two-card infinite combo" means a two-card line that wins**, which the page
already knows: green tier, by the same written-down inventory the result chips use.
Basalt Monolith + Rings of Brighthearth loops all day and wins nothing, so it is
not one. A filled template slot counts as one of the two cards — something has to
occupy it, and your deck is what does.

### Whether the list is allowed is a different question from how strong it is

The bracket says what power level a list sits at and never says whether the list is
*legal*. Two neighbouring questions come nearly free from machinery that was already
here, and they are answered on a line under the bracket:

- **Cards outside the commander's colour identity.** No new data at all: `cardIdentity`
  covers every card in Scryfall's oracle-cards file rather than only the ones that
  appear in combos.
- **Cards banned in Commander.** New data, but the same shape as the Game Changers and
  read in the same pass over the same bulk file — `legalities.commander === 'banned'` —
  so the page stays on one request.

**Only `banned`, and not `not_legal`.** That value covers every card that has simply
never been in the format: Alchemy rebalances, un-cards, most of Arena. Reporting those
as illegal would flag a lot of paper decks that are fine.

**The identity is the commander's, not the deck's**, and that is the whole point of the
rule. Colours elsewhere on this page are read off the cards — see "Colours come from
the cards" — and reading them off the cards *here* would make every list legal by
construction, since the union of a deck's colours always contains the deck's colours.
So the claim needs a commander, and there is no claim without one.

**Two accusations, kept apart.** A card in the wrong colours is a decklist mistake the
reader fixes by cutting a card; a banned card is the format saying no. Two lines, and
only the ban takes `--error` — colouring both the same would overstate the first. But
**one card only ever collects one accusation**: a banned card in the wrong colours is on
both lists, since the ban list is not filtered by colour, and naming it twice reads as
two problems where there is one card to cut. The ban wins, because the colours stop
mattering the moment the card goes.

**Silence is not a clean bill of health, so silence is what a legal deck gets.** No line,
no green tick, no "0 problems" — the same discipline the bracket panel keeps. Two of the
format's rules are readable off a card list and the footnote says so; a tick would be
read as covering singleton, deck size and everything else nobody checked. What *was* not
checked rides along with a finding rather than standing on its own: a reader looking at
one banned card should know the colour half went unanswered, but a panel that appears on
a legal deck to list what it skipped is an empty panel with a caveat in it.

**The thin-map rule is the same one, shared rather than copied.** Off-identity is
computed only over cards the map knows, so it cannot invent a card — but it can be wrong
about all of them at once, which is exactly what a commander whose own identity came back
empty looks like, and the published data has zeroed real cards' identities once already.
So the same guard applies as for
[unrecognized cards](#telling-the-reader-which-cards-were-not-recognised): more than half
the deck reading as off-identity is a claim about the data, and the colour half goes
quiet. `tooMuchOfTheDeck()` in `view-model.js` is that rule, in one place, used by both.

The publisher gates the new list the way it gates the others: `check-snapshot.js` compares
the count against the last snapshot, and the fetcher says so in the log when the list comes
back short — a ban list that came back empty is a `legalities` shape change, not a format
that banned nothing, and the page would go quiet rather than wrong. The layout test runs a
deck that is illegal two ways at once and a second with no commander named, and every other
deck it runs is the silent branch.

### The Game Changer list is read, not kept

`tools/fetch-combos.js` publishes the list off **Scryfall's own `game_changer`
flag**, in the same pass that already streams the oracle bulk file for colour
identity. It is deliberately not a list in this repository: Wizards revises it with
each bracket update, and a copy here would go stale silently — the exact failure
mode `templates.json` has to work to avoid.

The one way that can break is the flag being renamed, and the consequence is
nothing: `bracketCheck()` returns null, the line is not drawn, and that looks
exactly like a deck with nothing to report. So the refresh **says so, loudly** —
fewer than **30** flagged cards prints a warning naming the field and linking their
card object docs. It is not fatal, unlike missing colour data: the combo results are
all still correct without it.

**How long the list is has two answers, and 30 is safe under both.** Wizards' own
Commander Brackets Beta infographic lists **40** cards. Secondary sources report **53**
as of the 9 February 2026 update, which would make the infographic the launch version —
plausible, since the list is revised with every update, but unconfirmed here: Scryfall
and Wizards are both unreachable from the sandbox this was written in.

30 keeps ten cards of headroom under 40, and against 53 still catches a flag that had
half stopped working. It replaces the 20 this started at, which predates either figure
and would have called 21 of 53 healthy. Both numbers are asserted in
`test/bracket.test.js` — one test for the headroom, one for the half-broken case — so 40
fails on the first and 20 on the second. If the list is ever confirmed at 53, 30 can go
up.

Half a check is worse than none, which is why a missing list draws nothing rather
than a bracket based on combos alone — a deck full of Game Changers would otherwise
read as bracket 3.

## Layout

One column on phones and tablets; from 900px the decklist sits in a sticky left
column beside the results, so you can edit the list while reading suggestions.
Section headers are 48px tall for thumbs, and `tools/verify-layout.js` asserts
all of it — see Commands.

### Light and dark, from one set of tokens

Dark is the base. A `:root[data-theme='light']` block **restates the tokens and
nothing else** — every colour on the page is a custom property, so supporting light
meant naming eight more (`--line`, `--decisive`, `--code-bg`, `--brass-ink` and the
rest) rather than auditing 600 lines of rules. The only hardcoded colours left
outside that block are Wizards' mana swatches and the dark ink that sits on them,
which are the same in both themes on purpose.

Brass, green and red are **darkened for light rather than reused**: `#d4a24e` is a
good accent on `#12141a` and unreadable on white, which is the whole reason a theme
is more than swapping two colours.

#### The reader picks, the system only suggests

Light first shipped keyed on `prefers-color-scheme` alone, which meant the page
decided for you — and browsers report `light` for everyone who has never chosen, so
the default quietly flipped for most visitors. The **sun/moon button** in the header
fixes that in the honest direction: the system's answer is still what you get until
you say otherwise, and once you do it is remembered in `localStorage` under
`mtg-combo-finder.theme`.

- **`theme.js` resolves the two inputs into one answer** — a stored choice, else what
  the browser asks for — and writes it on `<html>` as `data-theme`. That is why the
  CSS is keyed on the attribute and not on a media query: a media query *and* an
  attribute selector would mean these seventeen tokens living in two places, kept in
  sync by hand.
- **It loads from `<head>`, synchronously, ahead of the stylesheet.** A theme applied
  after the first paint is a white flash on a dark page. It is a file rather than an
  inline script because the CSP here is `script-src 'self'`, which is worth more than
  one saved request.
- **The button is `hidden` in the markup and shown by the script**, so a control that
  cannot work without it never appears if it did not arrive.
- **Both icons ship in the markup and CSS shows one** — a moon on the dark page, a sun
  on the light one — keyed on the same `data-theme` attribute the tokens use, so the
  icon cannot disagree with the colours and switching costs no DOM work. Drawn inline
  for the reason the mana pips are: a remote icon font is one more thing to load and
  one more thing to fail. Nothing in JS touches the button's contents, because writing
  text into it would delete the two SVGs that *are* the control — the layout test
  fails on exactly that mistake.
- **The icon shows the theme you are in; the accessible name says where pressing
  goes** ("Switch to light mode"), which is the only wording an icon-only button has,
  on hover or read aloud.
- **No choice means it keeps following the system**, including a change made while the
  page is open. Storing a choice is what stops that.
- **With JavaScript off the page is dark.** A real trade and a small one: this page is
  a decklist parser and a combo search, so without JavaScript there is nothing on it
  to read in either theme.

Seven unit tests in `test/theme.test.js` cover the decision — precedence, junk in
storage, the fallback, and the label. The layout test presses the real button and
reads the computed style back: it asserts the page repaints, the choice overrides the
system, it survives a reload, pressing twice returns and is also remembered, the
second page opens in the same theme, and **exactly one icon is visible** and it is the
one matching the theme.

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

### Two browser test suites, and which check belongs in which

There are two, they are not the same job, and a check put in the wrong one is
either slow or a lie.

| | `tools/verify-layout.js` (`npm run verify`) | `e2e/` (`npm run test:ui`) |
| --- | --- | --- |
| **What it does** | *measures* the rendered page | *uses* the rendered page |
| Typical assertion | "no dot is drawn outside the viewBox", "the columns split at 900px", "this number sits on its line" | "hovering a card dims the rest", "pressing two cards says what cutting them costs", "the shared link opens the right deck" |
| Input | synthetic: it dispatches `pointerenter` at an element | real: a pointer that moves, keys that are pressed, a finger that taps |
| Dependencies | none — it drives headless Chrome directly and has the page POST back a verdict | Playwright, fetched for the run |
| Widths | four, in an iframe sized per viewport | two device profiles, desktop and phone |
| Runs in | ~6s | ~20s |

The rule of thumb: **geometry goes left, gestures go right.** "Where did this land"
is a measurement and belongs in the layout test, which can read it back at four
widths for the price of one page load. "Does this work when a person does it" is
a gesture and belongs in Playwright, because a dispatched event will happily
light a card that a real mouse could never reach — the map's cards are a case in
point, and the Playwright suite is what noticed that a card's press target is its
dot rather than the middle of the box its label stretches.

Both drive the real files, unbuilt, against the same made-up deck in
`test/fixtures/dataset.js`. One fixture, because two copies of a fixture is two
fixtures: a case added to one and not the other is a claim only half the tests
make.

### The numbers in this file are checked

This README states real counts, and CLAUDE.md has long carried a note asking people
to remember that when they change a data file. `npm run check:readme` is that note,
mechanised, and CI runs it.

Seven claims, each anchored on a phrase in the prose and compared to the file it
describes:

| claim | counted from |
| --- | --- |
| `lists all 1,079 results Commander Spellbook publishes` | `result-tiers.js` |
| `All 392 hand-written rows` | `unofficial.js` `COMBOS` |
| `and the three stand-in rules` | `unofficial.js` `STAND_INS` |
| `Templates resolved \| 148 \| **134**` | `templates.json` |
| `**134** (14 skipped)` | `templates.json` |
| `Cards in the file \| 21,769 \| **12,472**` | `templates.json` |
| `29 query-less templates are recorded` | `templates.json` |

**A pattern that matches nothing is a failure, not a pass.** That is the half that
makes it worth having: a checker that finds no claim and exits 0 reports success for
work it did not do — it turns "nobody verified this" into "this was verified". So
rewording a sentence out from under a check fails the build and names which claim to
re-anchor.

**Only what this repository can count.** Everything measured against the published
database — 103,737 combos, 53 Game Changers, MB on the wire — is a snapshot of
somebody else's data taken on a particular morning. Pinning those would mean a red
build every time Spellbook published a combo, so they stay prose, and stay the kind
of number to re-measure rather than trust.

The stand-in rules are the interesting anchor: the count is spelled as a word, not a
digit. The day there were two, the sentence that had to change was "and the one stand-in
rule" — a check looking for a digit would never have noticed, and this one did, on the
day Bogwater Lumaret and Elas il-Kor made it three. The plural is inside the match now,
so "the three stand-in rule" cannot creep back in either.

### The decisions live where a test can reach them

`app.js` is not covered by the unit tests, deliberately: it is the layout test's job,
and that is the right call for DOM wiring. It is a much weaker call for the parts of
`app.js` that are not DOM wiring at all.

The layout test proves a panel is not empty. It cannot prove the panel is telling the
truth, because **a wrong number renders exactly as happily as a right one**. "3 of
your combos need both" and "4 of your combos need both" are both perfectly good HTML,
and so is "Bracket 3" on a list whose floor is 4.

So `view-model.js` holds the decisions — pure functions of a search result, no
`document` anywhere in the file:

| | what it decides |
| --- | --- |
| `pickedSentence()` | what picking two or three cards out of the map found, in a sentence |
| `bracketProse()` | the headline, the reasoning, and which of the five pips is in which state |
| `sizePills()` | "3 × 2-card", and which pill counts as the easiest |
| `splitParts()` | "+4 official · +1 unofficial", or "none published" |
| `timingSentence()` | what the search cost, and which phases to name |

`app.js` turns what they return into elements and does nothing else with it. The rule
for what belongs there: **if getting it wrong would produce a page that looks right
and says something false, it is a decision.**

`pickedSentence()` is the case that makes the argument. Forty lines of pluralisation —
"both" against "all three", "card" against "cards", a list joined as "A and B" or "A,
B and C", and a regex that inserts "of your combos" after whichever number happens to
lead — none of which any test could see. It now has fourteen.

### The accessibility check, and the four things it found

`e2e/a11y.spec.js` runs axe-core over both pages, in both themes, empty and after a
search, and again with each control that builds DOM on press opened. WCAG 2.1 AA and
nothing else — axe also ships "best practice" rules, which are advice, and a suite
that cries wolf gets muted.

It is in the Playwright suite rather than the layout test because it needs what that
step already pays for: a real engine computing real colours on a page that has
actually been searched. axe is injected with `page.evaluate()` rather than
`addScriptTag()`, so the page keeps the exact `script-src 'self'` it ships with — a
tag would be refused, correctly.

The accessibility work here was already careful — `aria-pressed` on every map node, a
tablist with roving tabindex, `role="status"` on the summary, labelled mana pips, a
`<title>` inside the SVG. What it was not was *checked*, and the first run found four
contrast failures, all of them the same mistake:

| Where | Was | Measured |
| --- | --- | --- |
| The build stamp in the footer | `--muted` at `opacity: .75` | 4.43:1 |
| The map legend's footnote | `--muted` at `opacity: .85` | 4.1:1 |
| A tier filter chip switched off | `--muted` at `opacity: .5` | 2.5:1 |
| The map's two inactive view chips | the same rule, reaching further than it looked | 2.5:1 |

**Opacity is the common cause, and it is worth naming.** Every colour on these pages
is a token, chosen against a background and checked once. `opacity` is applied
*after* that choice, so it spends a contrast budget that has already been allocated
— and it does so invisibly, because the declaration says `.75`, not "and now this
text is below AA". Three of the four were a couple of hundredths under. The fourth
was half.

The last row is a second lesson. `.chip[aria-pressed="false"] { opacity: .5 }` was
written for the tier filter; the map's view filter happens to share `.chip` and set
`aria-pressed` for its own unrelated reasons, so a rule about one control was dimming
another. Off is now signalled by the tier colour and border reverting, and by the
dot going hollow — which is a better cue anyway, since it does not rest on colour.

The fix added one token, `--faint`, for the build stamp: quieter than `--muted` and
still legible. **It is only safe on `--bg`** — 4.8:1 there, 4.3:1 on a panel — which
is why the legend's footnote went back to `--muted` instead. There is less headroom
under `--muted` than it looks: it is 7:1 on the page background, `--faint` is 4.8:1,
and below that there is nothing left to have.

Two of the four only appear in a state a page load never reaches — a filter switched
off, a disclosure opened — so the spec presses them. A check that only ever sees the
default state would have found half of this.

### What the layout test proves

Fifteen runs. Four are layout at 390/768/1440/1920px, two are the tier page, three
exist because the thing they check fails *silently* (`desktop (no worker)`, `share
link`, `desktop (asset-stamped)`), three press the unofficial panel — the plain
rows, a two-swap row, and a row offered as a suggestion — and the last three are a
deck with no commander marker, a sideboarded deck, and the theme toggle. Two more
assertions ride along inside the layout runs, for the same reason:

- **`+ Add to deck`** is pressed, and the run asserts the deck ends up holding *more
  combos than it did* — not merely that a line appeared in the box. An append that
  forgets to search again looks entirely correct on screen.
- **The bracket line** has to strike the two brackets the list rules out, fill the
  floor, leave the rest open, and announce the whole answer through the button's
  accessible name — the pips are `aria-hidden`, so that name is all a screen reader
  gets. Its explanation must start *closed*, open on a press and close on a second
  one, and still carry the two Game Changers the fixture's deck holds (of three
  published), both reasons for the floor, and the caveat about what went unchecked,
  with the card links intact.
- **The theme toggle** is pressed and the computed colours read back: the page
  repaints, the choice beats the system preference, it survives a reload, pressing
  twice returns *and* is remembered, `tiers.html` opens in the same theme, and
  exactly one of the two icons is visible.
- **`Compare all N on Scryfall`** is read as a real `href` and checked to name every
  card the group shows — the recommended one included — with every term exact.
- **"Combos this unlocks"** must run smallest-first. The fixture's most-played combo
  is deliberately also its largest, so sorting on popularity alone fails the run.
- **The divider down a suggestion row** is walked piece by piece — the left border of
  every block in the card's column — and each has to be drawn, at the same x, starting
  where the piece above ended. The gutter is checked for the opposite: it must draw
  nothing, since a border returning there would be a second line at the same x, which
  is invisible on screen and puts the numbers back to sizing the card's column. It is
  one line on screen and three or four boxes in the CSS, none of which knows about the
  others. The same run
  holds the choice of card to the shape its column's width calls for, at both ends of
  the range: 233px of column on a phone, 454–1042px everywhere else.
- **The combo map** is entirely geometry, and every way it can break is invisible:
  a graph with every node at one point, or with nodes placed outside the box it is
  drawn in, is valid SVG and an empty panel to look at. So the run reads the real
  circles back out — inside the viewBox, none overlapping, more than one size —
  checks its three tiers come out in three computed colours, hovers the quietest
  card and measures that its neighbours light while the rest fade, and presses
  **+ Add to deck** to assert the map *grew that card*. A picture one search
  behind the list beside it says the added card is in no combos. The second
  relation is checked the same way — the fixture holds two cards that are never
  in a combo together and each complete two of the same ones, so the run asserts
  a dashed line joins them, that it carries its count as a real number placed on
  the line, and that pressing **Interchangeable** hides every solid line *without
  moving a single card*. Picking cards out is pressed too: one card, then a
  second, reading back the sentence each time, that both stay ringed and lit with
  the pointer elsewhere, that the cards are real buttons with names, and that
  pressing a pinned card again — or the background — puts it all back.

Every one of those was confirmed by breaking the code and watching them fail.

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
- `unofficial.js` — the page's own second opinion: `COMBOS`, the hand-written rows
  a substitution audit left standing, and `STAND_INS`, the one-card identities
  declared once and worked out against live data. Hand-maintained data, no logic —
  the matching lives in `combos.js`. See
  [Unofficial combos](#unofficial-combos-the-pages-own-second-opinion).
- `research-log.js` — which cards have been swept and what each pass found: the cards it
  covered, how it generated candidates, how many it proposed, examined and kept, why each
  rule-out was one, and the verbatim oracle text it read. Not page data — the browser never
  loads it — so it is a plain CommonJS module rather than the dual-export shape everything
  above uses. It is the answer to "has anybody checked this card?", which nothing could
  answer before it existed.
- `templates.json` — the generated card list behind every template slot ("a Persist
  Creature"), stored as `card -> template ids`. Checked in rather than resolved on
  every refresh; see [Template slots](#template-slots-a-persist-creature).
- `combos.js` — combo-result analysis (`DeckCombos`): turns the API's "almost included"
  variants into the ranked add-this-card suggestions (front-face matching for
  double-faced cards, ties broken on popularity then alphabetically), works out which
  template slots the deck fills and which it is short of, collapses interchangeable
  cards via `groupSuggestions()` / `groupVariants()`, and works out the deck's bracket
  floor in `bracketCheck()`. Also the small view helpers that need testing without a
  browser: `edhrecSlug()`, `scryfallSetQuery()` for the whole-choice comparison link,
  and `orderComboNames()` for the order a combo's cards are named in.
- `graph.js` — the combo map's arithmetic (`ComboGraph`): `build()` turns the
  combos the deck can assemble into a graph of cards and the pairs that share
  one, `layout()` places that graph on a canvas with a deterministic
  force-directed run. No DOM — `app.js` draws the result as SVG — so the half
  with all the interesting failure modes is testable under Node. See
  [The combo map](#the-combo-map).
- `theme.js` — resolves the theme (`DeckTheme`): the reader's stored choice, else what
  the browser asks for, written on `<html>` before the first paint and toggled by the
  sun/moon button. Loaded from `<head>` rather than with the rest, and excluded from
  coverage by name — see Commands.
- `search.js` — downloading the database, keeping a copy, dropping the copies an
  earlier `CACHE_NAME` left behind, and running the match (`ComboSearch`). No DOM, so
  it runs in a worker, in the page, or under Node. The bracket check runs here too,
  beside the match: the Game Changer list is in the dataset, and the dataset stays in
  the worker.
- `search-worker.js` — the worker that does all of the above off the thread drawing
  the page. Imports `result-tiers.js`, `combos.js`, `unofficial.js` and `search.js`
  — not `parser.js`, because the page has already turned the textarea into entries
  before it posts, and not `graph.js`, which is drawn from what a search hands back
  rather than used during one.
- `app.js` — reads the form, asks for a search, renders the sections above. On failure it
  shows a copyable report (endpoint, HTTP status, what was sent, which lines were skipped)
  instead of a bare "it didn't work".
- `tools/fetch-combos.js` — downloads Commander Spellbook's bulk export and
  writes a compact `combos.json`. Run by CI, not by the page.
- `e2e/` — the browser tests: `server.js` serves the repository as it deploys
  with `combos.json` answered from the fixture, and the two spec files press the
  pages the way a person does. `playwright.config.js` at the root wires them to
  a desktop and a phone profile. See
  [Two browser test suites](#two-browser-test-suites-and-which-check-belongs-in-which).
- `test/fixtures/dataset.js` — the made-up deck and dataset both browser suites
  run against, so neither can drift from the other.

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
  where the deck fills the slot: see "Template slots" above.
- Deck colour identity is the union of the colours of the cards pasted in. If
  none of them is recognised, colour filtering is switched off rather than
  guessed at.

### The two fields that repeat are published once each

Of the payload's 26.37 MB, the combos array was 25.23 MB, and two fields made up
most of it:

| field | was | what it is |
| --- | --- | --- |
| `p` | 13.19 MB | the results, e.g. "Infinite storm count" |
| `c` | 7.76 MB | card names |
| `id` | 2.30 MB | the Spellbook variant id |
| `i`, `pop`, `t` | 1.32 MB | colour identity, play count, template slots |

Across 103,737 combos there are **1,079 distinct result strings** and **7,364
distinct card names**. `"Infinite ETB"` was being written to the file some forty
thousand times. Both are now published as indices into two tables at the top of the
payload, `names` and `results`:

| | file | on the wire | heap | parse |
| --- | --- | --- | --- | --- |
| before | 26.37 MB | 2.73 MB | 69 MB | 170 ms |
| after | **9.37 MB** | **1.72 MB** | **35 MB** | 165 ms |

**The heap number is the one that matters, and it is worth being precise about where
it comes from.** `JSON.parse` builds a separate string for every occurrence, so the
old payload landed as roughly half a million short strings — 69 MB that the worker
then holds for the life of the session, deliberately, so the second search is free.
On a phone that is the kind of resident set a browser reclaims without asking.

`DeckCombos.decode()` resolves the indices once, immediately after the parse, and
hands back **the same string object** for every occurrence. The arrays end up holding
pointers to 8,443 strings instead of half a million strings.

**Which is why decoding is not a compromise.** The obvious alternative is to keep the
indices and teach the thirty-odd call sites in `combos.js` to compare integers.
Measured: that also lands at 35 MB. The saving is in the sharing, not in the
integers, so the rest of the code never learns that any of this happened — and
`matchDeck` was never the bottleneck anyway, at 43–93 ms against the real snapshot.

The parse time barely moves in Node. In the browser it halves, which is what the
footer's `parse` figure is for.

A payload without the tables is returned untouched, so the test fixtures and any
older local `combos.json` keep working. `CACHE_NAME` moves to `-v3`, which drops the
old copy off readers' disks rather than leaving 26 MB of it there forever.
`tools/check-snapshot.js` refuses to publish a payload whose indices do not land on
a string — that failure parses, passes a length check, and renders as nothing.

### The combo id is not published, because it is derivable

After interning, `id` was the biggest single field left: **27.5% of the payload on the
wire**, spent on something the reader can work out. A Spellbook variant id is not
opaque — it is the combo's card ids in ascending order joined with `-`, then each
distinct template id, ascending, prefixed with `--`:

```
1110-4694-7839--112     three cards, one template slot
215-579--85--181        two cards, two template slots
```

So the payload now ships **one card id per distinct card** — 7,364 numbers in a
`cardIds` table aligned to `names` — instead of one composite id per combo, 103,737
times. `DeckCombos.rebuildId()` puts them back.

| | file | on the wire |
| --- | --- | --- |
| interned, ids published | 9.37 MB | 1.72 MB |
| ids derived | **7.00 MB** | **1.27 MB** |

Together with the interning above, that is **26.37 MB → 7.00 MB** and **2.73 MB →
1.27 MB** from where this started.

**Where the card ids come from is the careful part, and it is not upstream.** The bulk
export's shape belongs to Spellbook, and a card id read from a field they rename would
arrive as `undefined` inside a URL rather than as an error in a log. They are recovered
instead from the combo ids we already hold, which cannot disagree with themselves: a
card's id must appear in the id of *every* combo that card is in, so intersecting those
sets narrows each card to a few candidates, and since an id belongs to exactly one card,
a solved card frees its id from every other candidate set. Three rounds of that settles
**7,241 of 7,364** cards.

**Nothing is trusted on the strength of that.** The fetcher rebuilds every id and
compares it to the real one, and **a row that does not rebuild exactly keeps its literal
id**. On the current snapshot that is 162 rows out of 103,737 — the cards the derivation
could not pin. A card left unsolved, a template requirement whose id the data could not
record, or an encoding Spellbook changes tomorrow all cost a few hundred bytes instead
of a wrong link.

That asymmetry is the whole design. A broken page announces itself; **a permalink that
works and shows somebody a different combo does not**, and no test the reader runs would
catch it. So the scheme is built so that the failure mode is a slightly larger file.

`tools/check-snapshot.js` enforces the other half before publishing: a row with no `id`
*and* no way to rebuild one is refused, because that renders as a missing link rather
than as an error. It calls the page's own `rebuildId()` rather than a copy, so the gate
cannot drift from what readers actually run.

### The fixture is authored readably and served published

`test/fixtures/dataset.js` writes card names and result strings out in full, because a
fixture nobody can read is a fixture nobody will extend. The published payload is not
that shape: it interns both into tables, and `DeckCombos.decode()` is what turns one
into the other.

Serving the readable shape to the browser tests meant **nothing ever exercised the
shape the pages actually receive** — and that is not a theoretical gap. `tiers.html`
reads `combos.json` directly, never called `decode()`, and went to production sitting
on *"Loading the combo database…"*: `combo.p` was a list of integers, `tierOf(3)`
matched nothing, and the sort died on `localeCompare` of a number — after the fetch
had succeeded, so no error reached the screen. Both of the layout test's tier runs were
green throughout, because both were fed strings.

So `asPublished()` interns the fixture on the way out, and both harnesses serve it
through that. Verified the way a guard should be: with the fix reverted, the two tier
runs fail and nothing else does.

Combo ids stay literal in the fixture. That is a real published shape — it is what
happens to a row whose card ids the derivation could not settle, 162 of them in the
live snapshot — and the harnesses identify particular combos by id, so deriving them
would couple those assertions to synthetic numbers while saying nothing more about the
page. The rebuild path is covered where it belongs: `test/decode.test.js` drives
`rebuildId()` directly, and the encoding was checked against all 103,737 published rows
before it shipped.

### The shell offline, and why the HTML is the one thing not cached first

The data survived going offline and the page did not, which was the wrong way round. A
reader who has searched once holds the entire snapshot on the device — `search.js` keeps
it in Cache Storage — and then plane mode failed on `index.html`, so none of it was
reachable. For a tool you would plausibly use at a table with bad wifi, that is backwards.

**Why this repository is unusually well placed to run a service worker.** The classic
failure is shipping an update nobody receives, and the machinery against that was already
here: `tools/stamp-assets.js` rewrites every local `src=`/`href=` to carry `?v=<commit
sha>` at deploy time, so every asset URL is immutable and every deploy mints a fresh set.
A cache-first worker over immutable URLs cannot serve a half-updated mix. The CSP needed
no change either — `worker-src 'self'` was already in both heads.

**The asymmetry, which is not a simplification waiting to be made.** `index.html` is
deliberately *not* stamped: it is the document that carries the new stamps, so it has to
stay cacheable-but-fresh. So the worker is **network-first for the document and
cache-first for everything else**. A cache-first HTML would pin a reader to one deploy
for as long as the cache lived — the exact bug the stamping exists to prevent,
reintroduced one layer up.

**And the rule extends past the HTML: cache-first is only for URLs that carry a stamp.**
A bare `app.js` is not immutable. It is what this page is served as locally, under `npm
run verify`, and under `npm run test:ui`, so trusting one from the cache would mean
editing a file and being served yesterday's copy for as long as the cache lived. Stamped
is immutable and cached hard; unstamped is asked for and only falls back to the cache
when the network cannot answer. Both are *stored* either way, which is what makes an
unstamped local page work offline too.

**The precache list is not maintained by hand.** `tools/stamp-assets.js` writes it into
`sw.js` at deploy time from the same `localAssets()` walk that stamps the pages, and
fails the deploy if the markers it rewrites have gone — a worker precaching last week's
URLs would be worse than one precaching none, and would look identical from outside. So
adding a `<script>` to a page is still just adding a `<script>` to a page.

**The exception, named out loud.** Five files no `src=` references, because `app.js`
constructs the search worker and both it and the no-`Worker` fallback load their scripts
themselves: `search-worker.js`, `result-tiers.js`, `combos.js`, `unofficial.js`,
`search.js`. The walk cannot see them, so they are the one list in the worker written by
hand — and `test/service-worker.test.js` reads the names back out of `app.js` and
`search-worker.js` and fails if it stops covering them. Precached rather than accepted as
online-only, because a reader whose `Worker` failed being handed a page that cannot
search is the one part of going offline that would look like a bug rather than a limit.

**The payload is not the worker's business.** `search.js` already owns that URL, with its
own versioned cache name, its own revalidation and its own deadline discipline. Two
caching layers over one URL is the kind of thing that looks fine until they disagree
about which copy is current, so the worker skips it — by name as well as by origin, since
both test harnesses serve the fixture from their own origin and this must not start
depending on that.

**What is tested, and where.** The worker's whole decision is which strategy a request
gets, and it is a pure function — so `test/service-worker.test.js` asserts it directly:
the document is never cache-first, a stamped asset always is, an unstamped one never is,
and the payload is skipped. That is the property that makes a fresh deploy visible at
all, and it should not need a deploy to check. The rest is `e2e/offline.spec.js`, the only
harness that can run a real worker: a second visit with the network off renders and
searches, a changed page is picked up on the next load with no hard refresh, and a browser
that refuses to give us a worker still gets a working page. Proving the update path meant
changing what the server sends mid-test, since Playwright's interception does not apply to
requests a service worker makes — `/__deploy` in `e2e/server.js` is that, and it is the
one mutable thing in the suite.

### Downloading the database once, not once a visit

The published file is **1.7 MB on the wire** (~9 MB parsed, 35 MB in memory once decoded), and
`raw.githubusercontent.com` serves it with `cache-control: max-age=300`. So every visit
downloaded the whole database again — and so did any reload five minutes into a session,
to learn that a once-a-day cron had not run since. The parsed copy was held in a variable,
which covers repeat searches in one visit and nothing else.

It is now kept in **Cache Storage**, keyed on the URL. A visit that finds a copy uses it
and checks for a newer one **in the background**, conditionally: `If-None-Match` against
the stored ETag, so a 304 costs a few hundred bytes instead of 1.7 MB. When something has
changed, the new copy is stored for next time rather than swapped in mid-session — the data
refresh runs daily, so a page showing this morning's snapshot instead of this afternoon's
is not worth a surprise. The footer says which one it is either way.

**An abandoned cache version is deleted, not just ignored.** Bumping `CACHE_NAME` stops the
page *reading* an old copy; it does not remove it, so the first version's ~26 MB sat in the
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

Downloading the database, parsing it, and walking ~100k combos all used to happen
between one paint and the next. None of it touches the DOM, so `search-worker.js` does
all three off-thread and posts back only what gets drawn — a few hundred rows, not the
database. The dataset is parsed once and kept there, so the second search of a session is
a walk over data already in memory.

A browser with no `Worker`, or a worker that fails to start or dies mid-search, falls back
to searching in the page: slower, but working, and the same code either way — `search.js`
is loaded both ways rather than duplicated. The layout test runs one viewport with `Worker`
deleted from the page to prove the fallback isn't a branch nobody has ever executed.

### What the search cost, in the footer

Three phases — download, parse, match — and until now nothing measured any of them.
Which one dominates depends entirely on the device: the download is a few MB, the
parse builds tens of thousands of objects, and the match walks all of them. A laptop
answers one way and a five-year-old phone another, and only one of those is the
reader.

So the footer says. **`ready in 1.4s (download 0.9s · parse 0.4s · match 0.1s)`**,
beside the snapshot date that was already there. In the footer rather than in a
devtools trace on purpose: the machine worth measuring belongs to somebody who is
never going to open one.

**The first phase is named for where the bytes came from**, and that detail was
wrong at first in the direction that matters most. `msFetch` times
`fetchDatabase()`, which either downloads the database or reads the copy already on
disk — two operations three orders of magnitude apart — and both were being called
"download". A first visit read `download 1.5s` and the next read `download 39ms`,
which says the network got forty times faster rather than that the cache did its
job. The number was honest and the word was not. It now reads `cache 39ms` on a
cached load, and an unrecognised source falls back to the neutral "read" rather
than guessing at "download".

**Only the phases that happened.** The second search *within* one session has no fetch
and no parse at all — the dataset is already in memory, which is the whole reason the
worker keeps it — and the line falls back to `ready in 0.1s`. Printing `download 0ms`
would report a skipped phase as an instant one, which is the opposite of what makes
the number worth having.

The numbers also land on the diagnostics object, so a failure report carries them
without a second mechanism. Nothing is sent anywhere: this is a static page with no
analytics, and the measurement is for whoever is looking at the screen.

**This is what the data-side decisions were missing**, and it settled them the day it
shipped. The review this project ran in August 2026 argued for sharding the payload and for
keeping a decoded copy in IndexedDB, both substantial work justified entirely by numbers
nobody had collected. The first reading off a real phone, cold:

```
ready in 1.6s (download 1.5s · parse 61ms · match 64ms)
```

**The parse was 61 ms.** Keeping a decoded copy in IndexedDB existed to skip that, on
the stated worry that "phones are several times worse" at parsing — measured, they are
not, because interning had already taken the parse from ~340 ms on a laptop to nothing
worth naming on a phone. That idea is closed, and closed by a number rather than by an
argument.

**The download was 94% of the search**, which is why the combo id stopped being
published: one field, 27.5% of the wire, no change to the design. Sharding the payload
would go after the same third and cost the one-file property the section above defends
— and it would go after a *cold* load only. Cache Storage serves every later visit and
revalidates in the background, so the same phone waits about 125 ms on its second
visit and never waits again.

Which is the point of measuring rather than reasoning: the two ideas that looked
biggest on paper were the two the numbers killed, and the one filed as "optional,
small, slightly risky" turned out to be the only one worth building.

**And the second visit, from the same phone:**

```
ready in 0.2s (cache 39ms · parse 43ms · match 71ms)
```

Which is [the caching](#downloading-the-database-once-not-once-a-visit) proving
itself: 1.5 s of network becomes 39 ms off disk, and the whole search drops from
1.6 s to 0.2 s. The snapshot date was still the *previous* one, which is also
correct — the copy in hand is served and the newer one is picked up next visit,
exactly as that section describes. Reading that line is what exposed the
mislabelling above; it was reported as `download 39ms`, and a download is the one
thing it was not.

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

### The publish is gated on yesterday's snapshot

The `data` branch is a single orphan commit, force-pushed. That keeps the repository
small and it means **there is nothing to roll back to** — the moment a worse snapshot
lands, the good one is gone.

`tools/fetch-combos.js` has two guards of its own: refuse to write zero combos, and
refuse to publish with fewer than 1,000 card identities. The second exists because
that failure already happened once, silently. Neither compares today against
yesterday, so a half-published upstream export — or a schema change that makes
`compact()` drop most rows — produces a file that passes both and then overwrites
the good one.

`tools/check-snapshot.js` runs between the fetch and the publish and compares four
counts against the published copy: combos, card identities, Game Changers, and
template cards. Each is a subsystem that goes quietly dark rather than loudly wrong —
no identities means no colour filtering, no Game Changers means every bracket check
silently downgrades, no template cards means every slot stops resolving. A fall of
more than **10%** in any of them stops the publish. Ten per cent of 103,737 is ten
thousand combos disappearing overnight, which is not churn.

It also checks the shape of every row, not a sample: `id`, a non-empty `c`, a string
`i`, an array `p`. An upstream field rename does not error — it produces rows the
page renders blank, and the first report of it is somebody looking at an empty combo.

Three things it deliberately does **not** do. It does not block the first publish:
with nothing on the data branch yet there is nothing to compare against, and it says
so and passes. It does not fail when it cannot reach the published copy — being
unable to compare is not evidence the new file is bad, and the refresh should not
acquire a second network dependency. And it does not decide that a real shrink is
impossible: re-run the workflow from the Actions tab with **allow_shrink** ticked
when Spellbook has genuinely retired a family of combos. The override is a person
deciding, which is the right shape for a judgement a script cannot make.

**It runs before the publish, unlike `verify-unofficial.js`, which runs after.** That
one checks our own citations, and holding today's combos back over a stale citation
would be the wrong end of the stick. This one asks whether today's combos are worth
publishing at all.

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

### Telling the reader which cards were not recognised

A misspelled card used to parse cleanly and then do nothing. `1 Sol Rimg` is a card
line by every rule in `parser.js` — a quantity, a name, no set code — so it lands in
the deck, is sent to the search, matches no combo, and is never mentioned again. The
page reported *Searching combos for 100 cards…* and returned a smaller answer than the
deck deserved, with nothing on screen saying why. An old or alternate spelling, a card
printed since the snapshot, and a token line out of a deck export all failed the same
silent way — the publisher drops `token` / `double_faced_token` / `emblem` /
`art_series` / `vanguard` layouts, so `Treasure` on a line of its own is not a card as
far as the data is concerned.

This is the failure class this file already worries about in the other direction — *a
wrong rule-out is invisible: it produces no row, no test failure and no complaint* —
except here it happened in front of a reader, on their own deck, on every search.

**The signal already existed and was thrown away.** `cardIdentity` is keyed by every
card in Scryfall's oracle-cards bulk file, not only the 7,364 that appear in combos, and
`deckIdentity()` already walked the deck against it and skipped what it could not find.
`unrecognizedCards()` is that same walk keeping the misses. No new download, no new
request, no second pass over the payload.

**Three populations, and only one is worth a word.** In the map and in no combo is
ordinary — most of any deck. In the map and in combos the deck cannot complete is what
the suggestions panel is for. Not in the map at all is the one nobody can see.

**It says so above the results, not in a disclosure.** The complaint being answered is
that nothing on screen said why the answer was small, and a closed `<details>` is
nothing on screen. It is also not `showDiagnostics()`' population: that lists lines the
parser *dropped*, and an unrecognized card is one the parser accepted. So the names are
written out, in the reader's own spelling — that is what they have to find in the box to
fix — with one line saying every cause, because from here they cannot be told apart and
only one of them is the reader's mistake.

**The wording claims what is known and no more.** The data is a nightly snapshot of
Scryfall by way of Spellbook, so the sentence is that *this snapshot* has no card by
that name. "Sol Rimg is not a real card" would be wrong the day a set is released.

**The constraint that decides the whole feature: a thin map must produce silence.** The
test fixture's `cardIdentity` has 14 entries, so a naive version reports most of an
85-card deck as unrecognized in `npm run verify` and `npm run test:ui`. That is not a
fixture problem to paper over — the published payload has shipped `cardIdentity: {}`
once already (see above), and *that* payload would report every card in the deck. The
rule is the one `deckIdentity()` already uses: when the map cannot answer, say nothing.
So an absent or empty map says nothing at all, and more than **half the deck** unknown
says nothing either, on the grounds that the answer is then about the data rather than
the deck.

Half, and not something tighter, because the rule has to survive a small paste: a reader
checking three cards with one typo is 33% unknown and deserves to be told. Nobody's real
decklist is half misspelled, and a map thin enough to be broken misses almost
everything — the fixtures sit at 83% and 100%, not at 55%.

**Where the three pieces live**, which is the usual split here: `combos.js` identifies
them and returns facts only — which names missed, how many were checked, how big the map
was — beside the `identityIndex()`/`deckIdentity()` that own `nameKey()` and the dataset.
`view-model.js` decides whether any of it is worth saying and how it is phrased, because
a count and a pluralisation that could be confidently wrong is exactly what belongs where
`node --test` can reach it — the thin-map rule is there too. `app.js` draws it and does
nothing else with it.

The layout test runs the tuning deck with `1 Sol Rimg` and `1 Treasure` appended, and
asserts the section names both, claims two cards, says a token line lands here too, and
sits **above** the first panel of results — measured, since a notice qualifying an answer
it renders below is a notice nobody reads. Every other deck it runs is the other branch:
nothing unrecognized, and no section at all. The thin-map and empty-map rules are pinned
in `test/view-model.test.js` rather than left to the fixtures happening to be small.

### Testing the publisher against a fixture

`tools/fetch-combos.js` was, by a wide margin, the least-covered code here, and it is
the only code in the repository that force-pushes a branch unattended. Everything
*downstream* of it was well guarded — `check-snapshot.js` has its own suite, the publish
gate checks four counts and every row's shape, `--steps` walks every file against
`StepsSource.pathFor()`. None of that watched the code that produces the thing the gate
inspects, and a payload can satisfy every gate while still being wrong in the way that
matters most: a permalink that resolves and shows a different combo.

So `--fixture <file>` replaces both third parties with one local file — the variants
Spellbook would have streamed and the card data Scryfall would have — and everything
between those two boundaries is the same code that runs at 04:17. There is one
`onVariant` callback either way on purpose; a second path through `compact()` and the
steps writer would prove something else.

**`test/fixtures/export.json` is deliberately not a happy path.** Nine variants, each
there for a shape that can go wrong quietly: a template slot, a requirement whose
template id is missing (recorded as `null`, which must never become a `0` in a URL), two
cards that appear nowhere else so their ids cannot be solved, utility-only results, a
utility mixed with a real one, and a variant with no cards at all, which is dropped. The
assertions are made on the far side of `DeckCombos.decode()` rather than on the raw file,
because decoding is the reader's view and a payload that parses but decodes wrong is the
whole point.

The run derives 4 of 6 card ids, drops the 6 rows whose ids rebuild exactly, and leaves
the 2 that cannot keep theirs. `npm test` runs it, so CI does.

**One thing it cannot prove, and one that bit while writing it.** It cannot prove the
export's *shape* is still Spellbook's — a fixture is somebody else's format, frozen. That
is what `peek-variant.yml` is for, and the fixture records which run of it the field
names came from. And every id in it has to be numeric-dash, because `deriveCardIds()`
reads a row's id *as* the card ids in it: the first draft used a readable label,
`no-rebuild-1`, whose parts intersected with the real ones and unsolved every card in
its row. The fixture then derived nothing at all and the round-trip test still passed,
because all eight rows had simply kept their literal ids. Which is the same class of
invisible wrongness the fixture exists to catch, found by reading the log rather than by
a failing assertion — so `no id is rejected as an unsafe filename` is now a test.

### API contract notes

Verified against [the backend source](https://github.com/SpaceCowMedia/commander-spellbook-backend):

- The wire format is **camelCase**, even though the Python dicts are snake_case —
  `CamelCaseJSONRenderer` is the default renderer, and the bulk export camelizes too.
  Reading the Python source alone is misleading here. The fetcher accepts either spelling.
- A variant's cards are `uses[].card.name`; results are `produces[].feature.name`.

### Known gaps in the published data

Spellbook authors a combo and generates variants from it, and that generation is
uneven: a combo published for one card is sometimes missing for a functionally
identical one. The page reports the data faithfully, so the gap shows up as a card
appearing in fewer combos than its twin — which reads as a bug here and is not one.

Coverage per card is the visible symptom. Measured on the 2026-07-31 snapshot: Soul
Warden appears in **149** combos, Daxos, Blessed by the Sun **132**, Essence Warden
**121**, Lunarch Veteran **90** — four cards that do the same thing, ordered by how
long they have existed.

Five specific gaps were found by taking each combo of one card, substituting a
functional twin, and checking whether that variant exists — and the same method,
pointed at one deck's lifegain loops, later found five shapes more (see
[The lifegain families](#the-lifegain-families-thirty-six-rows)):

| Missing variant | Published sibling to cite | Confidence |
|---|---|---|
| Quina, Qu Gourmet + Academy Manufactor + Warren Soultrader | `3000-4231-5670` (Chatterfang version) | **Verified against the cards.** Quina adds a 1/1 Frog to any token creation, so it refuels the sacrifice loop exactly as Chatterfang does |
| Lunarch Veteran + Heroic Feast + Scurry Oak | `360-4186-7743` (Soul Warden version) | High — Lunarch Veteran's front face is Soul Warden's text, and every other card with that text has the variant |
| Essence Warden + Hapatra, Vizier of Poisons + Yawgmoth, Thran Physician (×3, with Anointed Procession / Parallel Lives / Doubling Season) | the Soul Warden versions | High — Soul Warden and Essence Warden are functional duplicates |
| Kitchen Finks + Heroic Feast + any of 15 free sacrifice outlets (and a 16th two steps deep) | the Archangel of Thune versions | **Verified against the cards.** Both turn the Finks' 2 life into the +1/+1 counter that cancels persist; Spellbook publishes all 15 with four other lifegain-to-counter engines and none with this one |
| Hammerhead, Maggia Boss in 1,889 loops | the Bartolomé del Presidio versions, and the Carrion Feeder ones where Bartolomé has none | **Verified against the cards.** Hammerhead and Bartolomé have one ability each and it is the same sentence. Declared once as a stand-in rule rather than written out — see below |

**A high substitution score is not a verdict.** Two cards filling the same slot in
1,384 other contexts says they are interchangeable *somewhere*, not here. A worked
example: Camellia, the Seedmiser + Peregrin Took looks like it should combo with any
sacrifice outlet, and does not — that loop pays `{2}` for Camellia's ability, so the
outlet has to produce mana (Ashnod's Altar) or eat the Food itself. Viscera Seer and
Carrion Feeder do neither, and 20 candidate gaps died on that one reading of the cards.
Whether a substitution holds is a question about the cards, and this database cannot
answer it either way.

## Unofficial combos: the page's own second opinion

Everything above comes from Spellbook and is shown on their authority. `unofficial.js`
is the one exception — the surviving output of that substitution audit, rendered in its
own panel below **Combos in your deck** and never counted among them.

### One shape, sixteen rows: Kitchen Finks and Heroic Feast

Kitchen Finks gains 2 life on entry and has persist, so any free sacrifice outlet
loops it the moment something puts a +1/+1 counter on it — the counter cancels the
-1/-1 persist leaves behind, and it can die again.

Spellbook publishes that loop across **15** free outlets, four times over: once each
for Archangel of Thune, Heliod, Sun-Crowned, Cleric Class and The Destined White
Mage. Heroic Feast does the same job and has **none** of them.

> **Archangel of Thune** — Whenever you gain life, put a +1/+1 counter on each creature you control.
>
> **Heroic Feast** — Whenever you gain life, choose up to that many target creatures you control. Put a +1/+1 counter on each of them.

Two life gained is two targets and the loop needs one. Spellbook already treats the
pair as interchangeable elsewhere — **152 of Heroic Feast's 167** published combos
are card sets Archangel of Thune also appears in — which is exactly the signal the
substitution audit looks for.

**Why these are written out rather than declared as a rule.** The two cards are not
equivalent: Archangel counters *every* creature you control, Heroic Feast counters up
to as many as you gained life and has to target. Here that costs nothing. Elsewhere
it would, and a stand-in rule would have generated 347 rows without knowing which.
The difference between this and Hammerhead is the difference between two cards that
do the same job and two cards that are the same card.

**And it costs one result.** Every source combo claims *Infinite +1/+1 counters on
creatures you control*, which Archangel gives and Heroic Feast does not — the loop
spends its counter cancelling the persist counter, and the second target only grows
something if another creature is out, which these three cards do not guarantee. That
line comes off.

What replaces it turns on reading the trigger closely. Two life is **two targets, not
two counters on one creature** — *"choose up to that many target creatures you
control. Put a +1/+1 counter on each of them"* — and the targets have to be different
objects. So one counter goes on the Finks to cancel persist and the second goes
anywhere else, which means the loop grows something for good whenever a second
creature is on the battlefield.

For **ten of the fifteen the outlet is itself a creature**, so the three cards
guarantee that second body between them. Those ten claim *Infinite +1/+1 counters on
a creature* — singular, one creature rather than all of them. The five whose outlet
is an artifact or an enchantment (Altar of Dementia, Ashnod's Altar, Blasting Station,
Goblin Bombardment, Phyrexian Altar) leave the Finks as the only creature the combo
promises, so they claim no counters at all.

Phantom Train is counted among the ten deliberately: it is a Vehicle rather than a
creature, but its own ability turns it into one for the turn as it eats, and it puts
the counter on itself regardless.

**The sixteenth row is two swaps deep**, one of three in the file, and it is allowed
because the two steps are not the same kind of claim:

```
2086-2919-2921   Kitchen Finks + Archangel of Thune + Bartolomé del Presidio
  → Heroic Feast for Archangel of Thune          a judgement about two cards
  → Hammerhead for Bartolomé del Presidio        the same sentence, different name
= Kitchen Finks + Heroic Feast + Hammerhead, Maggia Boss
```

Chaining an identity onto a judgement leaves exactly the risk the judgement already
carried; chaining two judgements would not. A row may therefore declare `swaps: [...]`
instead of `swap`, and the page prints every step — *"Heroic Feast in place of
Archangel of Thune, then Hammerhead, Maggia Boss in place of Bartolomé del Presidio"* —
because a weaker claim shown as a stronger one is the single thing that note exists to
prevent. `test/unofficial.test.js` checks each step finds the card it claims to
replace, that the chain lands on the row's cards, that no row goes deeper than two,
and that the second step is a declared stand-in rather than another judgement; the
layout harness checks the page prints both.

### The lifegain families: thirty-six rows

Kitchen Finks was one shape with one card missing from it. Asking the same question of
every lifegain loop a single Golgari-white deck could assemble turned up something
larger: **five shapes, 36 card sets that Spellbook does not publish while publishing
their siblings** — and in each of them the card that is absent is the card that gains
the life.

The method is the substitution audit, narrowed to one deck so the answer is checkable:
take every published combo whose cards that deck holds, find the one that names exactly
one member of a group of interchangeable cards, and ask whether the version naming each
*other* member is published too.

Three groups did the work:

| Group | In the deck | Published combos apiece |
|---|---|---|
| gains life when a creature enters | Soul Warden · Essence Warden · Lunarch Veteran · Prosperous Innkeeper · Elas il-Kor · Case of the Uneaten Feast · Aunt May · Hinterland Sanctifier · Virulent Emissary | 54–149 |
| turns life into a +1/+1 counter | Archangel of Thune · Heliod, Sun-Crowned · Heroic Feast | 167–348 |
| eats a creature for mana | Ashnod's Altar · Phyrexian Altar | 6,063 and 5,167 |

**The loop, three cards at a time.** A counter on Scurry Oak, Herd Baloth or Basking
Broodscale makes a token; the token entering gains a life; the life puts the next
counter on. Three makers times three payoffs times the deck's nine gainers is 81
combinations, of which **11 are absent** while the rest are published. Two were already
in the file. The other nine are the first block.

**The loop, with Animation Module.** *Whenever one or more +1/+1 counters are put on a
permanent you control, you may pay `{1}`: create a 1/1 Servo* — so the same two cards
close a circle round it, and an altar eats each Servo to pay for the next. Spellbook
publishes that **31 times with Archangel of Thune, 30 with Heliod, and 25 with Heroic
Feast — every Heroic Feast row using Phyrexian Altar.** With Ashnod's Altar there is not
one, for any gainer at all. Seven rows fill that hole; four more give Heroic Feast the
two gainers its published rows skip; four more are the Virulent Emissary versions, two
of those going through Amalia Benavides Aguirre's explore trigger rather than straight
to the counter.

Those seven rows carry one line their source does not — *Infinite colorless mana* —
because Ashnod's Altar makes `{C}{C}` against a cost of `{1}` where Phyrexian Altar
makes one coloured mana and the loop breaks even. It is the line the published Ashnod's
Altar versions of the same loop already claim.

**Warren Soultrader and a token doubler.** *Pay 1 life, sacrifice another creature:
create a Treasure token.* Chatterfang, Stridehangar Automaton or Quina hands the
creature back inside the same token creation, a gainer hands the life back, and only the
Treasure count moves. Published with 59, 57 and 59 gainers respectively — and seven of
the combinations this deck can build are not among them.

**Trudge Garden**, whose loop needs `{2}` out of the sacrifice — the reason the earlier
audit threw out eighteen candidates for it. Ashnod's Altar makes that `{2}` alone;
Phyrexian Altar makes half and Pitiless Plunderer's Treasure the other half. Three rows,
each one a missing gainer rather than a missing outlet.

**Virulent Emissary is the card this pass kept arriving at**, in 15 of the 36 rows:

| | | |
|---|---|---|
| **Hinterland Sanctifier** | `{W}` 1/2 | Whenever another creature you control enters, you gain 1 life. |
| **Virulent Emissary** | `{G}` 1/1 | Deathtouch<br>Whenever another creature you control enters, you gain 1 life. |

The same sentence, one rider, and green rather than white — which is exactly the
difference that decides whether this deck can run the line. It is in **54** published
combos where the Sanctifier is in 106, so unlike Hammerhead it is not invisible to the
audit — it is simply written into some of these loops and not others. That is why these
are rows and not a stand-in rule: deathtouch means the two cards are not one card under
two names, and *Cleric* against *Elf Assassin* is a difference some other combo will
care about even though none of these do.

**What this pass ruled out**, and why the count is 36 rather than 51:

- **15 — Trudge Garden again.** Seven candidates swapped Ashnod's Altar for Phyrexian
  Altar, which makes one mana where the loop spends `{2}`; that is why Spellbook's
  Phyrexian Altar version needs Pitiless Plunderer as a fourth card. The other eight
  went the other way and were **supersets**: Trudge Garden + Ashnod's Altar + a gainer is
  already a published three-card combo, so adding Pitiless Plunderer to it is a card
  Spellbook would never print.

Everything else the sweep proposed was outside the lifegain question — Ghave and
Camellia mana swaps, Basking Broodscale sacrifice-outlet supersets the first audit had
already closed — and was left alone rather than half-answered.

### What this cannot find: a card Spellbook has never used

The audit works by substitution *between two published cards*: it takes a combo
naming one and asks whether the variant naming the other exists. Both halves have
to be in the data — the evidence that two cards are interchangeable is that
Spellbook already treats them that way somewhere else.

So a card the database has **never used at all** is invisible to it, and not by
accident. Worked example, and the question that keeps coming back:

> *Hammerhead, Maggia Boss is a sacrifice outlet in my deck. Why does he have no
> combos, official or unofficial?*

Measured on the 2026-08-01 snapshot, he is in the data — Scryfall's colour
identity for him is there, so the page knows the card — and he is named by
**zero** of its 103,675 combos. That closes all three doors at once:

1. **Nothing to list.** No published combo names him, so "Combos in your deck"
   has nothing to say about him, correctly.
2. **Nothing to substitute.** With no published appearances there is no pair to
   measure, so he can never become a candidate row here. The method has no
   opinion about him rather than a negative one.
3. **No slot to arrive through.** Spellbook enumerates sacrifice outlets by name
   — Carrion Feeder appears in 1,769 combos — rather than templating them, so
   there is no "a Sacrifice Outlet" slot for a new outlet to fill.
   `tools/research-coverage.js` checks this against the live data and reports it:
   not one template name mentions sacrificing. The two templates he *does* fill
   are *Dragon Creature* and *Villain Creature*, between them used by 19 combos,
   none of which are about sacrificing anything.

**So the only way in is to read the card**, which is what `tools/lookup-card.js`
and the *Look up card text* workflow are for — Scryfall answers, Actions has the
network, and the text lands in the run summary. (When it does *not* answer, there
is a second source; see [Reading a card when Scryfall is
unreachable](#reading-a-card-when-scryfall-is-unreachable).) Hammerhead says:

> Sacrifice another creature or artifact: Put a +1/+1 counter on Hammerhead.

The first answer to that was Umbral Collar Zealot — *sacrifice another creature or
artifact: surveil 1* — the same cost with a rider no loop uses, which produced
four hand-written rows. Those rows are gone, because reading further found
something better than a card with the same cost. It found the same card:

| | | |
|---|---|---|
| **Bartolomé del Presidio** | `{W}{B}` 2/1 | Sacrifice another creature or artifact: Put a +1/+1 counter on Bartolomé del Presidio. |
| **Hammerhead, Maggia Boss** | `{1}{B}` 2/1 | Sacrifice another creature or artifact: Put a +1/+1 counter on Hammerhead. |

One ability each, the same sentence, the same body. The names, the mana costs and
the colours are the whole difference — and Spellbook publishes **1,674** combos
naming Bartolomé and none naming Hammerhead.

The colour is the part that earns its keep. Hammerhead is mono-black where
Bartolomé is white-black, so every one of those lines is an Orzhov combo that a
Golgari deck can actually run, and had no way of being told about.

### Reading a card when Scryfall is unreachable

"Read the card" assumes a network that will serve you the card, and that assumption
failed on 3 Aug 2026: an agent sandbox with an egress proxy allowlisting
`raw.githubusercontent.com` got `CONNECT tunnel failed, response 403` for
`api.scryfall.com`, `scryfall.com`, `data.scryfall.io`, `commanderspellbook.com`,
`api.magicthegathering.io`, `mtgjson.com` and `gatherer.wizards.com` alike.
`tools/lookup-card.js` printed *"Scryfall returned HTTP 403 — check the spelling"*
and stopped, which is a diagnosis it had no way to make: a blocked host and a
misspelling are identical from inside the tool, and it named the likelier one as
though it knew. **It now asks Scryfall first and Forge second**, and only says
"check the spelling" when Scryfall was reachable enough to say the name is unknown.

#### And now a third source, ahead of both: a cache a runner filled

Falling back to Forge works, and it costs something every time. Forge's wording is not
Wizards', so anything a reading turns on has to be cross-checked against XMage by hand —
which means the *rule* that made this project trustworthy (`research-log.js` refuses a pass
without verbatim oracle text) is also what makes each pass expensive. And the queue is not
small: `tools/substitution-scope.js` finds thousands of implied-but-unpublished combos, most
of whose cards no recorded pass has read.

A runner can reach Scryfall perfectly well. So the *Cache card text* workflow reads cards
there and commits them to `card-text.json`, and `tools/lookup-card.js` asks that first. A
cache hit needs no request — so it works in the sandbox — and carries no banner, because it
is not a second opinion: a runner read Scryfall and wrote down what it said.

**The ordering is the whole design.** If a live fetch outranked the cache, every pass run
from the sandbox would fall through to Forge exactly as before, and the cache would be dead
weight that looked like it was working. `test/lookup-card.test.js` pins it.

**Normalised, not raw, and that is what makes it committable.** A Scryfall card object is
3–5 KB of prices, images, printings and rulings; what the tool prints is about 300 bytes of
it. Storing the raw object would make the queue's worth of cards a multi-megabyte blob
nobody reviews — and "a card's oracle text arrives as a diff somebody reads" is the entire
argument for keeping this in the repository rather than on the `data` branch. So only the
printed fields are kept, the file is written sorted so an added card is a one-entry diff,
and a shape change means re-fetching rather than migrating.

**Every entry carries the day it was read, and the tool says how old that makes it.** Not a
timestamp — a day, because a full ISO time would make every re-fetch a diff even when the
text is identical, burying the one line that did change. Oracle text is errata'd rarely,
which is exactly what makes a silently stale copy dangerous: it is a *wrong reading somebody
trusts*, the most expensive mistake available here and the only one that produces no
complaint. Past a year the note says so and names the workflow; it still shows the text,
because a year-old reading is right for all but a handful of cards and withholding it would
send somebody to Forge's wording instead, which is strictly worse. An entry with no date
reads as *unknown*, never as fresh.

**Nothing hand-writes into that file.** It exists so a reading is Scryfall's word rather
than somebody's recollection; a typed entry would make it a source of exactly the
unverified text the rule was written to stop, and one that now looks authoritative. Only
the workflow writes it — which is also why this repository ships without one, rather than
with a seeded example nobody could vouch for.

**What it does not do yet**, stated because the obvious next step looks free and is not:
it takes card names, not the work queue. Feeding it the top N unswept cards directly needs
`tools/substitution-scope.js` to become a module first — it has no exports at all today and
computes its ranking inside `main()` on the way to printing a table, and scraping a tool's
own markdown output is the coupling this repository avoids everywhere else. So for now: run
the scope tool, read its bottom table, paste the names in. Two steps, the same shape as
`peek-variant.yml` being read and written down by a person.

**[Forge](https://github.com/Card-Forge/forge) publishes its card scripts as plain
files in a GitHub repository, so they arrive over the one host that was reachable.**
Each carries an `Oracle:` line, which is the card text verbatim:

```bash
curl -s https://raw.githubusercontent.com/Card-Forge/forge/master/forge-gui/res/cardsfolder/a/academy_manufactor.txt
```
```
Name:Academy Manufactor
ManaCost:3
Types:Artifact Creature Assembly-Worker
PT:1/3
R:Event$ CreateToken | … | ValidToken$ Clue,Food,Treasure | …
Oracle:If you would create a Clue, Food, or Treasure token, instead create one of each.
```

The path is `cardsfolder/<first letter of the slug>/<slug>.txt`, and the slug rule
was derived by probing rather than guessed, because a documented URL rule that is
wrong is worse than none. Four parts, each one a card the obvious rule got wrong:

| | |
|---|---|
| **strip accents, then lowercase** | `Éomer, Marshal of Rohan` → `eomer_marshal_of_rohan` |
| **apostrophes vanish; every other non-alphanumeric run becomes one `_`** | `Ashnod's Altar` → `ashnods_altar`, and `M.O.D.O.K.` → `m_o_d_o_k` — the dots are separators, not nothing |
| **split and double-faced cards join *both* faces** | `Birgi, God of Storytelling // Harnfel, Horn of Bounty` → `birgi_god_of_storytelling_harnfel_horn_of_bounty`. Taking the front face alone 404s |
| **recent sets live in `cardsfolder/upcoming/`, not the letter directory** | so a miss is two requests, not one, before it is a miss |

Probed against **454 card names** drawn from the published combo data — 400 spread
evenly across all 7,364 distinct names, plus 54 chosen for apostrophes, commas,
accents, hyphens, digits, dots and `//` — the rule resolves **454 of 454**. Nine of
the 54 were only in `upcoming/`, all of them from recent sets, which is why that
second request is part of the rule and not an optimisation.

Two things this is not. It is **not a replacement for Scryfall**: there are no
colour identities, no legalities and no printings here, and `tools/lookup-card.js`
asks Scryfall first because Scryfall is the better answer when it is available. And
it is **not the same authority** — Forge's `Oracle:` line is maintained by that
project rather than by Wizards, so it is a second opinion, not the gospel. Where a
reading actually turned on the wording, both Forge and
[XMage](https://github.com/magefree/mage) were read and agreed; that is how the
Peregrin Took and Academy Manufactor texts above were settled. XMage files a card at
`Mage.Sets/src/mage/cards/<letter>/<PascalCaseName>.java`, punctuation gone.

So **every card Forge answers is printed under a banner saying so**, rather than the
distinction living in a header nobody scrolls back to:

> **From Forge's card script, not Scryfall.** Scryfall could not be reached (HTTP 403), which says nothing about the name.
>
> Oracle text only — no colour identity, no legality, no printings. Forge maintains
> this wording rather than Wizards, so cross-check anything a reading turns on.

That matters because this tool's output gets pasted into `unofficial.js` rows, which
exist to cite their evidence. *Which source said this* has to survive the journey.

**Four outcomes, and one of them was the bug.** `verdict()` decides which — a
function of the two answers rather than branches buried in the printing, because
both ways of getting it wrong are invisible to the reader: Forge's wording passed
off as Scryfall's, and a refused network reported as a typo.

| Scryfall | Forge | what it says |
|---|---|---|
| answered | not asked | the card, no banner — the ordinary case |
| blocked | has it | the card, banner, and the blame on the network |
| 404 | has it | the card, banner, and *Scryfall wants a different spelling of this name* |
| blocked | no | both failed, and the network is the likely reason for both |
| 404 | no | **the only case that says "check the spelling"** |

`test/lookup-card.test.js` pins all five, and pins the slug rule case by case — a
slug that reaches nothing is indistinguishable from a card Forge does not have, so
without those the fallback could rot into uselessness in silence.

### One card, 1,889 combos: why this one is a rule and not rows

Four rows can be written by hand. Nearly nineteen hundred cannot, and a file with
1,889 copies of a published combo with one word changed is not evidence anybody
can check. So `unofficial.js` has a second export, `STAND_INS`, which declares the
finding once:

```js
{
  card: 'Hammerhead, Maggia Boss',
  confidence: 'verified',
  for: [
    { card: 'Bartolomé del Presidio', why: '…the same sentence…' },
    { card: 'Carrion Feeder',         why: '…one restriction more…' },
  ],
}
```

`standInRows()` in `combos.js` works the rows out against the live data, and each
one carries exactly what a hand-written row carries — the source combo by id, the
swap, the reasoning, the results — except that the evidence is *looked up* rather
than typed, so it cannot cite a combo that has since been retired.

**Carrion Feeder is the second source and a weaker claim**, which is why it is
listed second rather than first:

> This creature can't block.
> Sacrifice a creature: Put a +1/+1 counter on this creature.

Free and repeatable the same way, but creatures only where Hammerhead also eats
artifacts, and able to eat *itself* where Hammerhead cannot. Every Carrion Feeder
loop is therefore a Hammerhead loop and the reverse is not true — the swap runs
one way. A row cites Bartolomé wherever Spellbook published that version (1,674 of
them) and falls back to the Feeder for the **215** lines the Feeder has and
Bartolomé does not. Order in `for` is preference, not membership.

**159 of the 1,889 have a template slot** — "any Persist Creature" — and those are
included on the same terms a published combo with a slot is: your deck has to fill
it, and the row names the card credited with doing so. The slot is resolved against
your deck *minus Hammerhead himself*, because a card cannot both be the swap and
fill a slot beside itself. 26 of those 159 ask for a slot Spellbook has named but
published no card list for — *Creature that earthbends on entering* — and nothing,
official or ours, can ever include those.

**What the rule deliberately does not reach**, reported by
`tools/verify-unofficial.js` on every refresh rather than left to be discovered:

- **Loops that sacrifice the Feeder itself.** Hammerhead cannot — his ability says
  *another*. An outlet that eats itself has no outlet afterwards, so nothing in the
  data appears to do this on purpose, but the rule cannot prove that and this is
  the shape it would get wrong.
- **Our own rows.** A rule reads published combos only. Generating from an
  unofficial row would be a swap on top of a swap, and all but one row on this page
  is one step from something Spellbook published. This is why the six Necrosynthesis
  rows get no Hammerhead versions from the rule. Where that second step is worth
  taking it is written out by hand, with both swaps named — see the Kitchen Finks
  section above.
  Three such rows exist and all three are in the file — the complete set, found by
  applying every stand-in rule to every hand-written row:

  | Two steps deep | Step 1 (our judgement) | Step 2 (the identity) |
  |---|---|---|
  | Kitchen Finks + Heroic Feast + Hammerhead | Heroic Feast for Archangel of Thune | Hammerhead for Bartolomé del Presidio |
  | Scurry Oak + Necrosynthesis + Hammerhead | Necrosynthesis for Sadistic Glee | Hammerhead for Carrion Feeder |
  | Herd Baloth + Necrosynthesis + Hammerhead | Necrosynthesis for Sadistic Glee | Hammerhead for Carrion Feeder |

  A test holds that number down: nothing may go deeper than two steps, and the second
  step must be a declared stand-in rather than another judgement.

**And the evidence is checked, both kinds.** `tools/verify-unofficial.js` reads
every hand-written row's `from.id` against the live data and fails if it does not
resolve, or resolves to a combo naming different cards — every one of those ids was
looked up by hand, which is exactly how a digit gets transposed. A stand-in rule
cannot fail that way, and fails a quieter way instead: a source card misspelled by
one accent matches nothing, generates nothing, and says nothing about it. So the
tool counts what each rule actually reached and prints it. It also reports any row
Spellbook has since published — not an error, but the outcome a row is supposed to
reach, and for a rule, the sign it is on its way to being unnecessary.

**The card swapped *in* is the one name nothing else can check**, so it carries an id.
`from.cards` is anchored to the cited combo and `cards` is that list with the swaps
applied, but the card arriving is only ever a string somebody typed — misspell it and
the row is shown to a reader, matches no deck ever, and reads exactly like a card
nobody happens to play. Every swap therefore records the Spellbook card id beside the
name, and the tool reads the two against each other. Both directions are a finding: an
id that now carries a *different* name is a card renamed upstream, which the name alone
would register only as a row that quietly stopped being about anything; and `inId: null`
is a claim in its own right — *the published data has no such card* — which is
Hammerhead's whole position, and the day it stops being true is the day his rule can go.

**Names stayed the key, and that was measured rather than assumed.** The obvious repair
to "a name is ambiguous" is to key on the id instead. Against this snapshot that is the
wrong way round: all **7,364** card names are distinct, no name carries two ids, and
`nameKey()` produces **zero** collisions — while **123 cards (1.7%) have no id at all**,
every one of them a real combo piece rather than a template filler. Sméagol, Helpful
Guide is in 30 combos with no id; Command Tower is in 15. The id is the *less* complete
identifier here, which is why it sits beside the name as a second opinion rather than
replacing it. A decklist is names in any case — that is what the page is handed.

**And a name that matches nothing now stops the run.** `nameKey()` matches the front
face exactly, so `Chatterfang` is not `Chatterfang, Squirrel General` and the missing
comma found zero combos — which printed as *"No published combo names all of them
together. That is Spellbook's data, not our matching"*, blaming Spellbook for a typo
here. `tools/combos-with.js` now refuses an unknown name and prints its nearest
matches, on the same principle the README's own number check runs on: a search that
matches nothing is not a search reporting an empty answer.

### Why it is a separate panel and not a badge

The difference is not a property of a row, it is the difference between *somebody
published this* and *we worked this out*. A reader deciding whether to trust a line
needs that before they read the cards, not after — so it is a heading, and the panel
opens by saying what it is. The same reasoning keeps these rows out of the combo
count and the bracket check. The bracket in particular is a claim about what a deck
is *allowed to be*, and it should rest on published data rather than on a swap we
made ourselves.

### A combo heading is a list of cards, so it breaks between them

A heading used to be inline text — `A + B + C` — and inline text breaks wherever it runs
out of room, which on a phone is mid-name. The reported case, on the live page:

```
before (334px column)              after
Hammerhead, Maggia Boss +          Hammerhead, Maggia Boss
Kitchen Finks + Archangel of       + Kitchen Finks
Thune                              + Archangel of Thune
```

Three lines either way — this costs no height on the case that prompted it — but every
line is now exactly one card, and the interchangeable card that the ordering sends last
lands somewhere a reader can find.

Each card is a flex item in **both** shapes, and that is the part doing the work: a heading
too wide for its column breaks *between* cards and never inside a name. Below **560px of
the row's own column** every card takes its own line; above it, a heading uses the room it
has. So the threshold is a preference rather than a correctness line, which is why it is
the same 560px the row's other narrow/wide decision already turns on rather than a third
measured number. `npm run verify` prints what each heading needs inline beside what its
column gives — *headings one card per line in 334px (needs 621px inline)* — so a threshold
that starts costing something shows up in a passing run.

Two things that were not obvious:

- **Cards must not shrink.** Flex items shrink by default, so three tablet headings still
  split a name in a column wide enough for the whole heading: nothing was too wide to
  place, the items were being squeezed until their text wrapped. `flex: 0 0 auto` moves a
  card to the next line instead, and `max-width: 100%` keeps the one unavoidable case — a
  single name wider than the column — from overflowing sideways.
- **The `+` belongs to the card it introduces**, drawn as a `::before` on the name in both
  shapes. As its own span it was a flex item free to end a line alone, which is the
  neighbouring bug in this same section. `display: none` rather than an emptied span, so it
  leaves the accessibility tree instead of being announced twice — `::before` content is
  exposed, so a screen reader still reads "+ Kitchen Finks".

And the neighbouring bug: **the link line's separators only exist between two offers on one
line.** `.combo-link` was made a flex row precisely so a wrap could not strand a `→` or a
`·` mid-phrase, but the separator was a flex item of its own, so a wrap moved the chip to
the next line and left the dot behind — the live page showed *View the published combo this
came from → ·* with `See all 3 cards` below it. Below the same 560px the offers each take a
line and the dots go, because a separator between two things that are not side by side is
decoration that reads as a bullet. The dots are `<span class="sep">` now rather than text
nodes, since a bare text run in a flex container is an anonymous flex item — unaddressable,
and free to be last on a line.

`npm run verify` asserts both shapes from geometry rather than from `textContent`, which
cannot see either failure: a card's own client rects say whether it wrapped, the tops of
the cards say whether they share a line, and computed `display` says whether a separator is
drawn. It also skips headings inside a closed disclosure — every rect there is zero, so
every card shares a top of 0 and a perfectly laid-out page reports as broken. That is the
same filter the row totals already needed.

### Where the second number goes, and why it is a second number

Two panels used to be on that list and are not any more, because leaving our rows
out of them answered their own questions wrong.

**Cards carrying your combos** asks what cutting a card costs. Measured on the
worked deck below, it was under-reporting eleven cards — Scurry Oak by five,
Necrosynthesis by four — and Hammerhead, who holds up four of that deck's combos,
was **absent from the panel entirely**. A panel that exists to price a cut cannot
price it at zero.

**Suggested additions** asks what one card would unlock. A card whose whole case is
ours could not be suggested at all, which is the worst version of the problem: not a
number that is too low, but a card the page cannot mention. Hammerhead unlocks 1,889
combos and Spellbook has published none of them.

So both panels count both — **the total, and whose it is underneath**, in a gutter
down the left of every row:

```
   15   │ Scurry Oak                    ← 10 of Spellbook's, 5 of ours
COMBOS  │ EDHREC · Scryfall
 10+5   │ 2 × 2-card   13 × 3-card

   9    │ Basking Broodscale            ← no split: nothing of ours on this row
COMBOS  │ EDHREC · Scryfall
        │ 9 × 3-card

   4    │ Hammerhead, Maggia Boss       ← the whole case is ours
COMBOS  │ EDHREC · Scryfall
  0+4   │ 4 × 3-card

  +8    │ Kitchen Finks                 ← as a suggestion: what it would add
COMBOS  │ EDHREC · Scryfall · + Add to deck
  3+5   │ 1 × 2-card   7 × 3-card
        │ ▾ Combos this unlocks         ← the fold is the card's, not the row's
        │     Kitchen Finks + Sadistic Glee + Scurry Oak
```

The gutter carries the **total** because these are ranked columns and the question
each answers — what does cutting this cost, what would adding this give me — is
answered by the total before anything else is read. Two numbers made the reader add
them up; one number and no split hid half the answer.

**A column and not a badge after the card name**, which is what this was for a long
time. A badge that follows the name lands wherever the name ends, so eighty totals
sat at eighty different offsets and there was nothing to read down — `Scurry Oak` put
its badge at 40% of the width and `Warren Soultrader` at 75%. The gutter is one fixed
3.8rem, so every total in a panel shares both edges; the layout test measures the
distinct right edges per panel and fails on more than one, which is the only way that
claim can be checked — it is invisible in a screenshot of a single row.

It was 4.2rem, and the width is now checked rather than remembered. What the gutter has to
hold is the worst real split — a card unlocking 1,889 combos of ours and none of
Spellbook's, so `0+1889` — and `npm run verify` builds that case rather than hoping the
fixture contains it: **51px** of content, against 50px for the word COMBOS beneath it. With
.45rem of clearance that is 59px, which 3.8rem holds with 2px spare — 6px of a 334px phone
column given back to the card names, and a later trim takes 2px more out of the clearance,
for `calc(3.8rem - 2px)`. Shrinking COMBOS was tried first and bought nothing, since 46px of
label still sits under 51px of split, and the split cannot wrap instead because `0+1889` has
no space in it to break at. The test fails if either stops fitting.

Absolute divider positions are deliberately not written down here. One was, for exactly one
change: *99px to 93px*, measured before the padding either side of the column moved in the
same pull request, which left it 87px and the note stale while still reading as a fact.
`npm run verify` prints where the divider is per viewport on every run, which is the only
copy that cannot go out of date.

**The `+` between the halves sits on the digits' centre, not on their baseline.** It is set
at `.62em` for a reason the stylesheet records — at the digits' size `+24` alone needed 63px
of a 54px column — and a smaller inline box shares the baseline of the digits beside it.
Digits have no descender, so it sat about a third of their height low and read as a subscript.

The shift is measured, on every run: `npm run verify` reads the ink boxes of `20` and `+` off
canvas at their two sizes — a box's height is font ascent plus descent and says nothing about
where the glyph sits inside it, which is the whole question — and reports what it would take
to put the two ink centres on one line. That is **4.5px** at the total's 14.88px sign, or
**.302em** of the sign's own size, and `vertical-align: .3em` lands 4.45px of it. One value
covers both places the sign is drawn, and not by luck: it is always `.62em` of whatever it
sits in, so the shift that centres it is the same fraction of itself either way.

Both are checked, and the second had to be **built** to be checked at all: this deck has no
unofficial combos, so it draws no split, and the `31+9` in the gutter — the case the fix was
reported for — was the one nothing in the run rendered. Measured there it is 2.31px raised
against a 2px ideal, on a 7.74px sign. That ideal is `.258em` of itself rather than `.302em`,
because ink metrics do not scale perfectly through hinting at 7px, which is why the assertion
allows a pixel rather than demanding equality. The split's `+` exists only in the narrow
reading — given room, the split spells itself out in words and separates them with a `·` — so
the run expects two signs where the column is under 560px and one where it is not.

**And the air around the text was trimmed with it.** Two paddings stack before a card name
gets anything — the panel's and the card's — and `npm run verify` prints the pair as one
number: at 390px that was **47px of air around 309px of text**, an eighth of the column
spent on margin twice over. At `.55rem` / `.5rem` / `.6rem` it is 35px of air and **321px of
text**, 12px more for a name — and a later pixel off the right only, `calc(.5rem - 1px)`,
makes it 322px. Only at this end of the range: a 1440px column has 935px of text and the same
64px of air, where the air is doing what padding is for.

That measurement also caught the change breaking itself: an editing slip closed the
gutter's comment early, which left prose as CSS, dropped the whole `.combo.suggestion`
rule, and put the divider at 23px instead of 93px. Nothing lints CSS here — `npm run
verify` is what noticed. The column
also absorbed the rank: the panel is *sorted* by this number, so `1.` beside the name
was a second, weaker copy of the same ordering.

**And the gutter sizes nothing, which took a second attempt to get right.** It grows a
line whenever a total is split into official and unofficial. While it shared a grid row
with the card's name, links and pills, that row was as tall as the taller of the two, so
a row with a split pushed everything below it down by 9px — 28px where the split wrapped
— and a row without one did not. *The combos it holds together* therefore sat at a
different height on every row and wandered down the panel according to which cards
happened to carry unofficial combos. Measured in a browser rather than read off the CSS,
because the fixture deck's card column is tall enough to hide it at desktop widths and
it only shows on the phone run.

The obvious fix is to let the gutter span the rows below it instead of sizing one, and
on its own that breaks the line: the gutter's `border-right` *was* the divider's top
segment, and it ended where the next block's border began only because the grid row
sized it. Spanning made the two overlap by 23px at every viewport, which the layout test
caught. The two constraints are the same constraint — a border sized by a grid row is a
border that has to share one — so the fix is to stop the gutter drawing the line at all.
`.row-main` carries the top segment now, the gutter spans, and the line is one rule
applied to every block in the card's column instead of two rules that have to meet.

**The divider runs the whole row, and everything below the numbers is on the card's
side of it.** *Combos this unlocks* used to start under the gutter, level with a number
it is the expansion of, which made it read as a third thing the row was about rather
than the list behind the total. It starts where the name, the links and the size pills
start now, and so do the interchangeable cards where a row offers them, and the line
between the two columns is carried down past all of it — so everything to the right of
that line is one card's worth of reading, and every row in a panel has one shape
whether it offers a choice of card or not.

The line is a left border on each of those blocks — the card, the interchangeable cards
where a row offers them, and the disclosure — each reaching back across the column gap
with a negative margin to land on exactly the same pixel as the piece above it. Nothing
in the gutter draws any of it. The blocks' own spacing is padding rather than margin for
the same reason — a margin would open a hole in the line at both ends of the block. That
is a fact about three or four boxes agreeing and nothing in the CSS states it, so the
layout test walks the pieces in order and reports the block that stepped sideways, lost
its border, or left a gap. It earned that immediately: the gap is `.55rem` rather than `.7rem` below
480px, the disclosure was still reaching back `.7rem`, and the line was split by the
.15rem of difference at phone width and nowhere else. The gap is one variable now,
which is what makes the two impossible to override apart.

**The card's column is narrower than the row, and the choice of card had to be measured
against it rather than assumed into it.** At 390px that column is 233px of the panel's
334px. `or these 2, same combo:` is 163px and its *Compare all 3* pill 108px, so on one
line the pill broke the **sentence** — `or these 2, same / combo:` — and a card name
beside its two links and its *+ Add*, which take 190px between them whatever is left,
was down to 43px: every alternative drawn as an unreadable stub. So below 420px of
column the pill takes its own line and each entry takes two, name above actions; above
it, both are back on one line. One container query decides both, because one width
decides both.

Neither shape is a wrapping row, which is the failure this replaced long ago and must
not come back: *every* entry changes shape at the threshold, not the ones whose names
happen to be long, and the *+ Add* stays in the last grid column either way — so all
of them share a right edge at every width, which the layout test asserts along with
which shape the column's width should have produced. The narrow shape trades a line of
height per alternative for names that say which card they are; the assertion that no
name is clipped once it has the column to itself is what holds that trade honest.

The width is measured rather than chosen. Four-digit totals are real — Hammerhead
again — so the gutter has to hold `0+1889`, and at 3.4rem that clipped. Widening it
for every row would take 20px off the card name on the rows that do not need it, so
the rare long totals step down a type size instead and right alignment keeps the edge
still. The `+` is set at .62em of the digits, because a sign is not a numeral: at full
size `+24` alone needed 63px of a 54px column.

Ranking is by the two together, because impact is impact and a card you cannot see
is worse than a card ranked slightly wrong; ties break toward the published count,
so two cards of equal reach are not ordered by how much of that reach is our claim.

The unofficial half takes the accent — the colour the page already spends on its own
links and buttons, and the one that means "the site talking" rather than "a property
of the combo". Green, khaki and grey are *win*, *decisive* and *other*, and a fourth
hue in that family would read as a fourth result tier.

**The words "official" and "unofficial" are dropped where the row is narrow**, and that
reverses what this section used to say — that the claim must not depend on a tooltip.
The reasoning it replaces is worth keeping, because the objection is right: `10+5` in
two colours is unreadable to anyone who cannot see the colours. So the sentence did not
go into a tooltip, it went into the split's **accessible name** — `role="img"` with
`aria-label="10 published by Commander Spellbook, 5 unofficial"`, the same device the
mana pips use to be heard as "green" rather than "G". A screen reader gets the claim in
words, a pointer gets it on hover, and the column stays a column. The layout test
asserts all three: the role, the sentence, and that the two halves do not compute to
the same colour. Cutting the words *without* that would be the version of this change
that hides half the answer.

**And where the row is wide, they come back**: the gutter widens to 12rem and the split
reads `10 official · 5 unofficial`. Both readings are in the markup and the stylesheet
picks one, so a resize needs no re-render and no `matchMedia` listener.

Which reading appears is decided by **the width of the row's own column, not the
window** — a container query on the panel body, and this is the case that makes the
difference concrete rather than theoretical:

| window | the row's column | reading |
|---|---:|---|
| 390px | 334px | `10+5` |
| 768px | 689px | `10 official · 5 unofficial` |
| 900px | 427px | `10+5` |
| 1024px | 551px | `10+5` |
| 1440px | 967px | `10 official · 5 unofficial` |
| 1920px | 1042px | `10 official · 5 unofficial` |

These are the widths `npm run verify` prints — the panel body's **content box**, which
is the width a container query is answered against. This table used to quote each of
them 15px larger, and one row was wrong because of it: a 1024px window is 551px of
column, which is *under* the threshold, so it reads `10+5` and not the words. The
number to trust is the one the layout test reports, since that is the number the
browser is deciding on.

The column is **wider at 768px than at 900px**, because 900 is where the two-column
shell starts and hands 370px of the window to the decklist. A `min-width: 900px` media
query would spell the words out in the narrower of those two and not the wider one, so
the viewport is the wrong thing to ask.

Both numbers are measured. **560px** of column is the threshold because at that width a
12rem gutter still leaves the card name 325px, more than the 248px it gets on a phone,
so nothing is worse off than the layout being replaced. **12rem** is
what `0 official · 1889 unofficial` needs at 177px, and Hammerhead makes that a real row
rather than a hypothetical one; `white-space: normal` is the safety valve, so a row with
four digits on both sides wraps to two lines instead of running over the card name.

The layout test checks this as a rule and not as a repeated breakpoint: it reads the
column's width and the split's *visible* text — both readings are in the DOM, so
`textContent` would pass on a page showing both at once — and asserts the words appear
exactly when the column is wide enough. A dropped container declaration (words never
appear) and a dropped query (words appear on a phone) both fail it. It also runs the
deck whose whole case is ours at 390px as well as 1440px, because otherwise the compact
reading is asserted nowhere: the tuning deck has no unofficial combos, so no other
viewport draws a split at all.

### The card's links share its name's line where the row is wide, and that threshold is not the split's

On a phone the card name has a line to itself and `EDHREC · Scryfall · + Add to deck`
sits on the line below it. That is forced: on a shared line the links held their place
beside 5 of 11 real names at 390px and 0 of 11 at 320px, so their left edge went ragged
down a list of eighty rows. A desktop has no such constraint, so there the links move up
beside the name and the row loses a line — same three children in the same order, and
the stylesheet decides, keyed on the row's own column like the split above it.

**The threshold is 750px of column, not the split's 560px**, and the reason is the thing
that looked free and was not. The line being moved is not the two links, which are 108px.
It is the links *and* the add button, which is 245px. At 560px of column that leaves the
name 80px, and the links held their place on **2 of 198** real card names — the ragged
list the phone layout exists to avoid, arrived at from the other side.

Measured over the 198 names in `card-text.json`, which run to 55 characters with a median
of 17, at the column widths the layout test reports:

| the row's column | `.row-main` | names whose links stay on the name's line |
|---:|---:|---:|
| 560px | 325px | 2 / 198 |
| 689px | 454px | 137 / 198 |
| **750px** | 515px | **191 / 198**, and no name wraps |
| 967px | 732px | 197 / 198 |
| 1042px | 807px | 198 / 198 |

So a 768px window keeps the stacked reading and a desktop does not. The seven names that
still do not fit at 750px are not a break: `flex-wrap` drops their links to the line
below, which is the layout they had anyway. Nothing is clipped and nothing leaves the
column at any width, which the layout test asserts separately from which line they are on.

**Two thresholds rather than one**, because they answer different questions — the gutter
needs room for two words, this needs room for a card name beside 245px of controls — and
one number would mean picking whichever question is louder and being wrong about the
other. The size breakdown still closes the row on a line of its own either way: it is
what the count is made of, not another thing you can do with the card, and beside the
links it would read as one run of pills and controls.

The layout test checks it as a rule, the same way it checks the split: it reads the
column's width and the rendered geometry, and asserts the links are beside the name
exactly where the column is wide enough. A dropped rule (never beside) and a leaked one
(beside on a phone) both fail, and both branches are covered by viewports it already
runs — 967px of column at 1440px, 334px at 390px.

### Matching the unofficial rows costs one pass, however many rules there are

The rows are matched against the decklist after the published ones, and with one
card of slack — a row the deck can assemble is a combo it has, a row it is one card
short of is a reason to add that card. Both come out of one call.

The part written for scale is `standInRows()`. A rule could be implemented as "scan
the combo list for this card", and with one rule nobody would notice; with twenty it
would be twenty sweeps of a 100,000-row database on every search anybody runs. So
every rule's source cards go into one index first and the list is walked **once**,
whatever the rules cost. `test/unofficial.test.js` counts the passes with a counting
iterator and holds them at one for ten rules as well as for one.

Two of the numbers moved while this was built, and both are worth writing down:

| | before | after |
|---|---|---|
| whole search, worked deck | ~470 ms | **~180 ms** |
| unofficial matching alone | ~300 ms | ~75 ms |

The search got faster while gaining a feature because of a bug this work exposed:
`identityIndex()` rebuilt an index over all 34,715 cards Spellbook knows **on every
call**, and the callers ask for it once per row rather than once per search. At seven
rows that was ~300 ms nobody had measured; at the sixty-three the file now holds it
would have been nearly three seconds. It is memoised on the dataset now, which is
parsed once per worker and never mutated.

### What each row has to carry

A combo nobody published is only worth showing if it shows its working, so every row
prints the published combo it came from, which card was swapped for which, and how far
the checking actually went:

| | |
|---|---|
| `verified` | the swap was read against both cards' oracle text |
| `derived` | both halves of the swap are separately published, but the specific pairing has not been read against the cards |

All 392 hand-written rows cite a published combo. 367 of them and the three stand-in rules
are `verified`; the other 25 are `derived`, which is what that label was being kept for.
They came from the whole-file sweep below rather than from a question about one card,
and every one of them is a loop whose two halves Spellbook publishes separately without
anybody having read the pairing against the cards. The panel says so on each.

`test/unofficial.test.js` enforces the shape of both halves — every hand-written row
cites a real combo id, every swap is genuinely one card in and one out against the
cited combo, and every row gives a reason; every rule names something other than
itself to stand in for, and says why. A row that cannot say where it came from
cannot ship. Where a rule and a hand-written row produce the same cards,
`matchUnofficial()` keeps the hand-written one — a combo somebody reasoned about by
name beats the same combo produced by a rule, and printing both would be the combo
twice.

### They graduate rather than accumulate

Spellbook is refreshed nightly, and the day a row is published it arrives in the
official list on its own authority. `matchUnofficial()` therefore drops any row whose
card set already appears there. Showing both copies would be the same combo listed
twice, one of them ours and stale — so the entry moves up a panel with nobody editing
the file.

**And somebody is told, which is the part that used to be missing.** The page dropping
a row silently is right for the reader and wrong for the file: the row stays in
`unofficial.js` forever, carrying a claim that is no longer ours to make. The nightly
data job runs `tools/verify-unofficial.js` against the snapshot it just published, and
two things can come back. A **broken citation** — an id that has stopped resolving, or
one that now names a different combo — fails the job, because a row whose evidence
points at nothing is the one failure this panel cannot survive. A **graduation** is not
a failure and used to be reported into the step summary of a job that passed, which is
the same as not reporting it. It now opens a standing issue listing the rows that can
come out, updated every night and closed by the job itself once the list empties. That
is the whole maintenance loop: rows arrive by hand, and leave because a machine noticed
they had stopped being needed.

### What the file costs, and the size at which it stops being source

`unofficial.js` is the largest single script the page loads, and almost all of it is
data: the rows, plus one rule. Graduation is the only thing that ever takes a row out,
and research passes put them in faster than Spellbook publishes them, so the trend is up.

No figure for today's size is written here on purpose. It would be stale within a
research pass, and pinning a compressed size in CI is a check that can fail on a zlib
version rather than on anything anybody did — the mistake the test count in CLAUDE.md
made in the cheap direction and this would make in the expensive one.
`gzip -9 -c unofficial.js | wc -c` is the live answer.

It stays in the repository, and this section is not a plan to move it. Rows being
versioned alongside the matching logic they depend on is worth real weight:
`npm run verify:unofficial` is a test somebody runs before merging rather than a gate
that fires after publishing, and `test/unofficial.test.js` pins the *exact* rows the
standing deck unlocks — a check that cannot exist if the rows arrive over the network.

What is worth fixing in advance is the number at which that trade flips, because it is a
much worse decision to make while looking at a slow page.

**At 200 KB gzipped, `COMBOS` moves to the `data` branch as JSON**, fetched by the worker
and nothing else. The mechanics are already paid for: `connect-src` names that host,
Cache Storage is already how the combo database gets there, and the nightly job already
writes two artefacts beside each other. The number belongs here rather than in the commit
that has to act on it, which is the whole point of fixing it in advance.

**It said 50 KB first, and the number moved on purpose.** The threshold has to be arguable
later, so what it was raised on: `unofficial.js` is loaded by `search-worker.js` and by
nothing else — it is not in `index.html`, so it is never parsed on the main thread and
cannot delay first paint or a keystroke. What it delays is the first search on a cold load,
in a worker that is already waiting on a 1.28 MB combo database. Measured beside the rest
of the page, the main thread carries 106 KB gzipped of script and the worker 80 KB, of
which this file is 43 KB. At the ceiling it would be roughly 2.4 MB of source to parse off
the main thread — the honest cost, and the one to re-measure before raising it again rather
than assuming the next jump is as cheap.

**What that ceiling is not is a licence to stop watching.** It used to say "roughly double
today's rows, so this is not close", and that stopped being true in a single pass: the
four-card sweep that added Bogwater Lumaret, Ghave, Elas il-Kor and Insidious Roots put on
156 rows and about 14 KB gzipped at once. So the shape of the risk is unchanged even with
four times the headroom — a dozen passes of that size, not a hundred — and a pass that size
should still settle the move before it starts rather than after. No figure for today is
written here, for the reason given above: `gzip -9 -c unofficial.js | wc -c` is the live
answer and this paragraph would only rot again.

**And what it would cost, in the same breath**, because a threshold with only the
benefit written down is a decision nobody can argue with later:

- rows stop being versioned with the code, so a row and the matching logic it needs can
  ship apart — the failure being a row that matches nothing, silently;
- `verify:unofficial` becomes a publish-time gate, which changes *when* a broken
  citation is found from "before merge" to "after somebody is already reading it";
- the exact-row assertion in `test/unofficial.test.js` needs somewhere to live that is
  still a unit test, and that is the part with no obvious answer.

The last one is the real cost. The first two are inconveniences; that one deletes a
check which has already caught a row matching on something too loose.

### The audit, and what it ruled out

44 candidates, from pairs of cards that Spellbook itself treats as interchangeable
elsewhere. **35 were ruled out**, and the reasons are more interesting than the nine
survivors, because each is a way a "functionally identical" card turns out not to be:

- **18 — Trudge Garden needs mana, not just a sacrifice.** All 187 published Trudge
  Garden combos use a mana-producing outlet (Ashnod's Altar, Phyrexian Altar,
  Thermopod, Pitiless Plunderer, Krark-Clan Ironworks). Not one uses a free outlet.
  Viscera Seer, Carrion Feeder and Umbral Collar Zealot make no mana, so the loop has
  nothing to pay with.
- **5 — supersets of a two-card combo.** Basking Broodscale's Eldrazi Spawn carries
  *"Sacrifice this token: Add {C}"*, so the token is its own sacrifice outlet and
  Broodscale + Sadistic Glee is already a published pair. Adding an outlet to it is a
  strict superset, which Spellbook never publishes.
- **4 — the opposite reading of the same card.** Scurry Oak's Squirrel and Herd
  Baloth's Beast have no sacrifice ability, so neither works as a *pair* the way
  Broodscale does. They need the third card.
- **1 — Chatterfang does not double what the loop spends.** Chatterfang adds Squirrels
  equal to the number of tokens created; Parallel Lives doubles the tokens themselves,
  including the Treasures that pay Camellia's `{2}`. One Treasure per cycle against a
  two-mana cost does not sustain.

- **4 — the loop needs a *token*, not just a sacrifice.** Only two cards partner
  Cauldron Familiar + Peregrin Took as a three-card combo, and both make a token when
  they eat something: Shilgengar a Blood, Warren Soultrader a Treasure. Every other
  outlet Spellbook lists there needs Garrison Excavator as a fourth card. Viscera Seer,
  Carrion Feeder, Umbral Collar Zealot and Ashnod's Altar make no token.
- **2 — Camellia's loop eats artifacts.** Every outlet published with Camellia +
  Peregrin Took either sacrifices artifacts (Phantom Train, Umbral Collar Zealot, the
  Atog family, Arcbound Ravager) or pays her `{2}` with mana (Ashnod's Altar). Viscera
  Seer and Carrion Feeder take creatures only and produce nothing.
- **1 — Quina is not a doubler.** Anointed Procession doubles every token; Quina adds
  *one* Frog to a creation however many tokens it made. A loop that needs the Treasures
  doubled does not get them.

**Nothing remains open of those 44.** The nine that survived are in `unofficial.js`, and seven of
them were only settled by reading the cards — which is why the panel prints how far the
checking went rather than asking to be believed. The 1,889 Hammerhead rows are not
part of that count and never were: the audit could not have proposed a single one of
them, because it works by comparing two published cards and Hammerhead is not one.

Those 44 were the candidates that first sweep proposed. Pointing the same method at the
lifegain loops of one deck later proposed 51 more and kept 36 of them — the five shapes
in *The lifegain families* above, with the 15 rule-outs written up there. The method did
not change; what changed is which loops it was asked about.

**Which cards have been swept is now written down.** `research-log.js` carries one entry
per pass — the cards it covered, how it generated candidates, how many it proposed, how
many a human actually read, how many it kept, and why every rule-out was one. It exists
because this section could not previously answer "has anybody checked Chatterfang?", and
because `unofficial.js` records only what a sweep *kept*, which is the half that cannot
tell you what was never looked at. `test/research-log.test.js` holds it to the file: a
row whose cards no recorded pass covers fails the build, so the index cannot quietly stop
being one. The candidate count in this section is read out of it rather than added up by
hand, which means a pass that gets logged moves the README and a pass that does not, cannot.

**And a pass will not be accepted without the card text.** `research-log.js` carries a
`read` field — the oracle text, verbatim, for every card a pass names — and
`test/research-log.test.js` fails without it. That is not belt-and-braces. The rule
existed as prose first, saying to work from card text rather than from a similarity
score, and it was broken twice: once putting `{2}{B}{G}` and a `-X/-X` outlet on
Chatterfang, who is `{2}{G}` with `+X/-X`; and once ruling out **all 37** Camellia
candidates on "they answer *a nontoken creature died* with different tokens". Both
cards trigger on *sacrificing a Food*, and Experimental Confectioner makes a **Rat**.
The real difference is that Camellia batches where he counts, which rules out **2** of
the 37 — so thirty-five were thrown away on a text nobody had opened.

That is the failure worth engineering against here, because it is invisible: a wrong
rule-out produces no row, no failing test and no complaint, only a card that quietly
looks well covered. Nobody audits a zero.

**Entries that predate the rule said `UNREAD` rather than inventing text**, under a
ratchet that could only fall — and it reached **zero**, so the allowance is gone and an
`UNREAD` marker anywhere in the log now simply fails. The history is in the test's own
comment because that is the honest record: **16 → 36 → 16 → 0**. It went *up* because
the first count was wrong, not because anyone borrowed: it only covered cards listed in
`cards`, so a pass could reason about a dozen *peers* and record none of them. Ashnod's
Altar named twelve and had one. Correcting the undercount raised the number; fetching the
texts one query at a time brought it to nothing.

Clearing the last of them was not bookkeeping. Reading Scrap Trawler closed the one
rule-out holding the Ashnod's Altar zero open; reading Trudge Garden found a rule-out
describing a card that does not exist — the pass had it wanting mana *out of the
sacrifice*, and it has no sacrifice clause at all, only "whenever you **gain life**, you
may **pay {2}**". The count survived because the requirement is real. The sentence did
not.

**Which makes this file a record of the cards somebody asked about, and nothing wider.**
That is worth a number rather than an apology, so `tools/substitution-scope.js` points
the same method at every card in the database instead of at one. At the strict bar —
0.90 shared shapes, where Soul Warden and Essence Warden sit at 0.975 — it proposes
**1,779 interchangeable pairs implying 4,835 combos Spellbook has not published**. Loosen
it to 0.80 and it is 3,106 pairs and 31,017 combos. Those are candidates, not owed rows,
and the paragraph below is why: the pairs that dominate the total are sacrifice outlets,
which is exactly where the method is least trustworthy. But **855 candidates have been
read, out of thousands proposed** — and which 855 is no longer a matter of reading the
prose above: `research-log.js` records every pass, the cards it covered, and why each
rule-out was a rule-out. It is the index this section spent its whole existence not
having. `node tools/substitution-scope.js` prints the other half from it — the cards
proposing the most that no recorded pass has swept, which is the only form of "how much
is left" anybody can act on.

**A rule-out can also be written as cards, and then a tool can act on it.** `tools/deck-gaps.js`
re-proposed `Scurry Oak + Sadistic Glee` on every run — a pair the first sweep threw out,
because the Squirrel cannot sacrifice itself where Basking Broodscale's Eldrazi Spawn can
— since that decision existed only as a sentence. A rule-out may now carry `sets`, the
exact combinations it killed, and the tool drops them and prints what it dropped.
**It is a subset of its reason, always.** Most rule-outs here are categorical — "the loop
needs a *token* out of the sacrifice" — and cover shapes nobody enumerated, so they have
no card set to record; the first sweep's counted four and names the two it wrote down,
because inventing the others would be the same failure as inventing a count. So the index
answers *has this been ruled out?* with **yes** or **nothing recorded**, and never with
*no*. A candidate that survives it has not been cleared by anybody.

**A pass that finds nothing is still a pass**, and two of the twelve recorded found
exactly that. Ashnod's Altar is the largest card in the standing deck by combo count —
6,063 — and kept none of its 3,316 candidates: its top scored peers are four different
kinds of card, and only the free sacrifice outlets are substitutable at all. Cauldron
Familiar, Samwise Gamgee and Academy Manufactor produced **no candidates at any
threshold**, which is the method being silent rather than the cards being covered. Those
entries are the ones that stop the next person spending the same afternoon.

**But a zero has to be earned, and two of them were not.** Both said so in their own
notes — *provisional*, the candidates filtered but not read — and a provisional zero is
the most dangerous entry the log can hold, because "found nothing" reads as diligence and
nobody audits it. Basking Broodscale had read **12 of 148**, and reading the other 136
turned kept: 0 into **38 rows**. Camellia had read all 37 and found **35 survivors**, then
recorded kept: 0 beside a note saying they survived, because nobody wrote the rows down;
that is the same failure with the arithmetic the other way round. Ashnod's Altar was the
one that held up: all twelve of its rule-out cards are now read end to end, and its zero
is a well-covered card rather than an unfinished pass.

From the outside those two look identical to Chatterfang below, and only `examined` tells
them apart — which is the argument for the field existing. What settled Broodscale was
reading the *engines* rather than the candidates: 108 of the 136 died to five facts about
what the token is. The Eldrazi Spawn is 0/1 where the Squirrel is 1/1, which is 38 of them
(Railway Brawler scales by power, Sword of the Meek returns only for "a 1/1 creature",
Altar of Dementia mills by power); Scurry Oak has **evolve** and Broodscale does not,
which is another 38 — Yawgmoth only ever puts on *-1/-1* counters, so the published steps
say the +1/+1 comes from evolve and nothing else; Treebeard targets "a Halfling or
Treefolk" and Broodscale is an Eldrazi Lizard, which is 27; three read a *green* creature
entering; and two want a **Beast** to sacrifice.

Chatterfang is what a *well-covered* card looks like under the same method, and worth
recording as the counterweight to Rosie: the sweep proposed **1,202** candidates for him
and **1,197 were ruled out on the card text alone**. Stridehangar Automaton reads only
*artifact* tokens and adds a Thopter, so its Clock of Omens and Krark-Clan Ironworks
families turn on the added token being an artifact and a Squirrel is not one; and
Chatterfang + Pitiless Plunderer is a published *two-card* combo, which makes every
"Pitiless Plunderer and an outlet" shape a strict superset of something he already does.
Five survived, and they are in the file.

**Academy Manufactor is what a card the scope tool cannot see looks like.** She is named
in 661 published combos and has exactly *one* substitution peer in all 103,737: Peregrin
Took, sharing 54 shapes with her at a jaccard of **0.05**. That is nowhere near the 0.90
bar `tools/substitution-scope.js` reports at, and it never will be — the score is a ratio,
and a card in 661 combos cannot reach 0.90 against a peer that shares 54 of them. No scope
run has ever named her, and the pass had to be started by reading the card. *Read the pair
count, not the score, for a card this widely published.*

The pair itself is a clean case of a high score meaning less than it looks:

| | |
|---|---|
| Peregrin Took | If one or more tokens would be created under your control, those tokens plus an additional Food token are created instead. |
| Academy Manufactor | If you would create a Clue, Food, or Treasure token, instead create one of each. |

He reads *any* token and hands back a Food; she reads three types and hands back the other
two. So **296 of the 338 candidates died on the token type alone** — a Squirrel, a Zombie,
a Spirit, a Thopter, a Blood or a Myr is a token he is looking at and she is not, which
took the whole Camellia and Ant Queen families out at once. Six more died on quantity: he
*adds* a Food where she only *converts* one, so a Samwise Gamgee trigger is two Foods
behind him and one behind her, and every loop needing the second one breaks. Four died on
a mistake worth naming, because the score cannot see it either — those lines use Peregrin
Took's *second* ability, "Sacrifice three Foods: Draw a card", as a free sacrifice outlet.
That is not a replacement effect at all, and she has no equivalent of it.

**32 survived**, all of them loops whose own token is a Clue or a Treasure — Chalk Outline
investigating on top of its Detective, Kheru Goldkeeper's Treasure, Bootleggers' Stash
under Clock of Omens. The last of those is the strongest evidence in the file: Spellbook
publishes the identical four-card loop with Academy Manufactor in it for four of the eight
artifact lands, and only with Peregrin Took for the other four.

**Thirteen more rows came from the other side of the same shape.** Neither
Cauldron Familiar nor Samwise Gamgee has a substitution peer at all — no card shares three
combo shapes with either — so no amount of comparing proposes anything for them. What does
is the outlet slot: Spellbook fills the free-sacrifice slot of the Cauldron Familiar loop
by name, engine by engine, and the lists disagree. Sixteen outlets behind Peregrin Took,
sixteen behind Samwise Gamgee but not the same sixteen, fifteen behind Eloise, Nephalia
Sleuth, fifteen behind Pitiless Plunderer, six behind Ulvenwald Mysteries. Diffing them is
the whole pass: **Spawning Pit** is in every Peregrin Took list and none of the other four,
though "Sacrifice a creature: Put a charge counter on Spawning Pit" is free, repeatable and
unfussy about what it eats; and Ulvenwald Mysteries, which investigates on a nontoken
creature dying where Eloise investigates on another creature dying, is nine outlets short
of her. Three candidates were ruled out and the reason is the good kind: Warren Soultrader
makes his own Treasure, so `Cauldron Familiar + Warren Soultrader + Academy Manufactor` is
a published *three*-card combo and every four-card row naming him is a strict superset.

That third pass kept 49 of its 54, and they are the families in `unofficial.js` under
*the token-creation half of the counter loops*. **Twenty are Rosie Cotton of South Lane**,
who reads a token being created where the cards Spellbook pairs with these loops read a
creature entering — the same trigger whenever the creature is a token, which is why she
closes in two cards what Sadistic Glee needs three for, and why she was missing from every
loop where the token arrives off a -1/-1 counter. **Twenty-four are Necrosynthesis**, whose
six existing rows covered three sacrifice outlets and left the rest of Sadistic Glee's
untouched. Nine of the Rosie rows and twelve of the Necrosynthesis ones were read against
the cards; the remaining 23 are `derived`.

**A high substitution score is never a verdict.** Two cards filling the same slot in
1,384 other contexts says they are interchangeable *somewhere*, not here. Whether a
substitution holds is a question about the cards, and this database cannot answer it
either way — which is exactly why the panel prints its confidence rather than hiding it.

**Reporting upstream is still the better fix.** When Spellbook adds a variant the next
daily snapshot picks it up, and the row here graduates on its own.

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

### Getting a deck in from a site we can't read

Which is most of them, and the reason the file path exists. Every deck site exports a
text file, and a file needs no CORS, no API and no new origin in the CSP — so
**dropping an exported deck on the form, or picking it with the button, works for
Moxfield and for every site nobody has written an adapter for.**

Both entry points, because they are not interchangeable: dragging is what a desktop
reaches for and is impossible on a phone or from a keyboard, and the file picker is
the one a screen reader can drive.

The care is all in refusing well. An extension is a claim, so the contents are the
evidence: a file is read, then checked for the replacement characters and control
bytes that mean *this was binary and we decoded it anyway* — otherwise a screenshot
dropped on the box would land as a wall of lines the parser silently threw away.
Files over 1 MB are refused unread, which is not about our limits but so that
dropping a video fails as a sentence rather than as a locked-up tab. Every refusal
names the file, says what is wrong with it, and ends with the way out, because
"invalid file" tells nobody anything. And the text goes *into the box* rather than
straight into a search, so a reader can see what arrived and fix a line first.

The decisions live where `node --test` can reach them — `acceptDeckFile()` and
`looksLikeText()` in `parser.js`, `fileLoaded()` and `fileRefusal()` in
`view-model.js` — and `app.js` only wires them up. A sentence that miscounts, or says
"cards" when it loaded one, is exactly the kind of wrong that looks right.

### Whether another site could be a URL, and how that gets decided

Deckstats, TappedOut and MTGGoldfish are each one adapter plus one `connect-src`
entry — *if* a browser may read them. That is one header, `Access-Control-Allow-Origin`,
and it is not a thing to guess at: Moxfield is unsupported precisely because somebody
guessed.

It cannot be answered from a terminal either. `curl` does not enforce CORS, so a 200
there says nothing about what a page can do. `tools/probe-cors.js` asks each site with
the deployed page's `Origin` and reports the one header that decides it, carrying
**Archidekt and Moxfield as controls**. It runs from `.github/workflows/probe-cors.yml`,
on demand, because a runner is the only place with unrestricted network and because a
check that fails during somebody else's outage is a check that gets muted.

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

So Deckstats, MTGGoldfish and TappedOut's text view all refuse outright, and TappedOut's
API allows the read but demands authentication a static page has no way to hold: every
byte this site ships is public, so a credential in it is a published credential. None of
the three is worth an adapter, which is exactly why the file path above is the whole feature.

The first run of this probe got a 400 from Scryfall and drew no conclusions from it,
correctly: Node's `fetch` sends no `User-Agent`, Scryfall require one, and the answer was
about the request rather than about their policy. The probe now sends what a browser
sends, and Scryfall's flip to `200` / `*` is what shows it is asking properly.

### Archidekt may no longer be readable either

The Archidekt row above is the control that was supposed to come back allowed. It did
not, and the diagnostic explains why: asked as `https://archidekt.com` they answer
`Access-Control-Allow-Origin: https://archidekt.com`, and asked as us they answer
`http://localhost:3000`. With `Vary: Origin`, that is a server echoing origins on an
allowlist and falling back to a default for everyone else. **We are not on the list**,
and a browser discards a response whose `Access-Control-Allow-Origin` names somebody
else.

Measured, not confirmed against the live page — this repository is usually edited from a
sandbox that cannot reach `paludancode.github.io`. If it holds, `SITES.archidekt` in
`parser.js` says `browserImport: true` about something that cannot work, and the honest
fix is to flip it to `false` with a `why` that points at the file drop, exactly as
Moxfield already does. The page fails gracefully in the meantime: `describeLoadFailure()`
reports a blocked cross-origin read as *"Your browser blocked the request to Archidekt"*
and offers the export hint, which happens to be the truth.

## Commands

```bash
# Build the combo database locally (one large download; reads templates.json)
node tools/fetch-combos.js

# The same publisher over a canned export instead of the two live third parties:
# no network, about a second. This is what test/fetch-combos-fixture.test.js runs,
# so `npm test` already covers it — the flag is for reading the output by hand.
# See "Testing the publisher against a fixture" below for what it can and cannot
# prove, and test/fixtures/export.json for what each variant in it is there for.
node tools/fetch-combos.js out.json --fixture test/fixtures/export.json

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
# test's job, and theme.js is excluded by name for the same reason: its pure
# functions are required by the tests, its DOM half cannot run in node.
# Needs Node 22.8+ for the threshold flags.
npm run test:coverage

# Lint. Fetched for the run rather than installed: this repo has no node_modules
# and one that only a linter needs would be the first entry in it. Catches what
# node --check cannot — a misspelled global, a variable a refactor left behind,
# a duplicate object key.
npm run lint

# Check every unofficial row still cites a real published combo — and report any
# that Spellbook has published since, which is a row that can come out of the
# file. Also counts what each stand-in rule reached, and which source each of its
# rows leaned on: a rule cannot cite something absent, but a source card
# misspelled by one accent reaches nothing and says nothing about it. Fetches the
# data branch; pass a path to read a local copy instead. The daily data refresh
# runs this too.
npm run verify:unofficial

# Layout smoke test — REQUIRED after any UI change. Renders the real page at
# 390/768/1440/1920 px and fails on horizontal overflow, a collapse control that
# doesn't collapse, or the desktop columns not splitting. Also asserts the
# behaviour that is invisible when it breaks: the kept copy of the database
# being used on the second load, the decklist surviving a search, Clear
# actually clearing, the share link's whole round trip, the same output with
# Worker taken away, "+ Add to deck" leaving the deck with more combos than it
# had, the bracket pips and the explanation behind them, the theme toggle
# overriding the system and being remembered, the Scryfall comparison link
# naming every card in a choice, and the combo map drawing a readable graph that
# grows when a card is added — and that the search really did run where it was
# supposed to. See "What the layout test proves" below.
npm run verify

# Browser tests — the same pages driven rather than measured, at a desktop and a
# phone profile. Playwright is fetched for the run, like ESLint. CI installs
# Chromium only; nothing here is engine-specific. See "Two browser test suites".
npm run test:ui

# Syntax-check everything (same as CI)
for f in $(git ls-files '*.js'); do node --check "$f"; done

# Run locally: it's a static page, any file server works
npx serve .   # or python3 -m http.server
```

### Answering questions from the data

Seven read-only tools, each also a manual workflow, for the questions that keep
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

# What does this card actually say? Straight from Scryfall — when it can be
# reached. A restrictive network refuses api.scryfall.com, and a web search is
# the route that works from there; research-log.js needs the text either way.
node tools/lookup-card.js "Camellia, the Seedmiser"

# How much of the substitution space has nobody looked at? The method behind
# unofficial.js, pointed at every card instead of at the one being asked about.
node tools/substitution-scope.js [jaccard] [minShared]

# Which cards carry a deck's combos, ranked by how many published combos name
# them, and which of those no recorded pass has swept. --unswept for the queue —
# the swept/unswept counts above the table still describe the whole deck, and the
# tool says how many rows the filter is holding back.
node tools/deck-cards.js [deck.txt] [--unswept] [--top N]

# Which gaps does THIS deck expose? Same method, with the candidate shapes bounded
# to cards the deck already holds, so every hit is a combo it could cast tonight.
# Card sets a pass ruled out are dropped and listed; the rest is unrecorded, not
# cleared — read research-log.js first.
node tools/deck-gaps.js [deck.txt] [--jaccard N]
```

`.claude/commands/deck-deep-dive.md` is the whole research pass wired to that last one:
rank a deck's cards, sweep the ones nobody has, write what survives, log the pass.

### What a tool says about itself is not exempt

Two of these were quietly wrong for a while, in the way a tool can be: nothing failed, and
a person read the output once and believed it.

`try-deck.js` reported the lines the parser dropped by interpolating them into a string —
but `parseDecklist()` hands back `{ line, reason }` objects, so the report was ten lines of
`! [object Object]`. On the standing Chatterfang fixture that is 29 sideboard lines
rendered as noise: it said *something* was skipped, and nothing about which or why. It now
words them the way the page's own diagnostics do, `[reason] line`, and says how many it
held back instead of silently showing ten.

`deck-cards.js --unswept` computed its summary from the already-filtered rows, so it
reported **"0 of those have been swept"** every single time — true of the rows that
survived the filter, false of the deck it claims to describe. On the Chatterfang fixture it
read *0 of 33* where `research-log.js` has **27 of 60**, which is a sentence that says
nobody has looked at a deck that is nearly half swept. The counts are now taken before the
filter, and the tool says how many rows `--unswept` is holding back.

Both decisions moved into functions the tests can reach — `skippedLines()` and
`sweepStatus()`, pinned by `test/deck-tools.test.js` — for the same reason a count that
could be confidently wrong belongs in `view-model.js` rather than in a render file. A
research tool's numbers feed the queue that decides what gets swept next, so a wrong one
is not cosmetic: it is the sweep going to the wrong card.

`tools/research-sources.js` and `tools/research-coverage.js` are kept for the
questions whose answers can change: has a second combo database appeared, and do
Spellbook's templates still carry Scryfall queries. They run together from the
**Research combo sources** workflow, and their conclusions are under
"Data-source research" above.

## Branching strategy

Same as [MTG-Pricerunner](https://github.com/PaludaNCode/MTG-Pricerunner): trunk-based,
short-lived branches.

**Outstanding work lives in GitHub issues, and nowhere else.** There is no backlog file in
this repository, and there deliberately is not one any more: two of them existed — a review
of 2 Aug 2026 and a second of 3 Aug 2026 — and both were deleted on 3 Aug 2026 once their
technical items had shipped. What each decision measured and traded away is worth keeping,
and it is kept: in the README section that owns the thing that shipped, which is the
document somebody reads. What was not worth keeping was two files that *read* as queues
while the real queue was the issue list, both restating counts that files already hold.

The two items still open when they went became issues
([#118](https://github.com/PaludaNCode/MTG-Combo-Finder/issues/118), a service worker for
the shell, and [#119](https://github.com/PaludaNCode/MTG-Combo-Finder/issues/119),
legality beside the bracket). The remaining feature sketches went with the files, on
purpose: an idea worth doing is worth an issue, and an idea nobody will file is one nobody
was going to build.

An issue here **points at the live answer rather than restating it**: the count of unread
card texts belongs in `research-log.js`, where a test caps it, not in an issue body that
goes stale the first time somebody reads a card. That is the same failure as prose
claiming *nothing remains open* over an audit of 44 candidates — a second source of truth
where only one of them is checked.

1. Branch off `main`: `feat/<thing>` or `fix/<thing>`
2. Push, open a PR — CI runs (`checks` job: JS syntax check + lint + unit tests with
   coverage floors + the README's countable numbers + layout smoke test + the Playwright
   browser tests, which install Chromium and are the longest step)
3. Merge when green. "Allow auto-merge" is enabled on the repo, so the usual move is
   to hit **Enable auto-merge** on the PR right after opening it — it then lands on
   its own the moment CI passes. Merging to `main` **is** the release: the deploy
   workflow fires on push to `main` and publishes to GitHub Pages. The branch is deleted
   on merge — that is a repository setting, not something to remember, and it is why a
   merged branch is simply gone rather than waiting to be tidied up.

**`main` is protected**, by a branch ruleset: a pull request is required, the `checks` job
has to be green before it can merge, and force-pushes and deletion are blocked. So the flow
above is enforced rather than conventional, and auto-merge pulls its full weight — it waits
for whatever the ruleset requires. Repo admins bypass it and can push directly in a pinch
(escape hatch — prefer PRs). Settings → Rules → Rulesets is the live answer; this paragraph
is only a description of it.

Two rules are deliberately **not** part of it, and both look like oversights:

- **Require linear history.** `main` is merged with merge commits, and that rule forbids
  exactly those — turning it on quietly makes the repository squash-only. That is a
  decision about history, not about protection.
- **Required approvals above zero.** GitHub will not let you approve your own pull
  request, so on a single-maintainer repository any number above zero makes every PR
  unmergeable. `checks` is the gate.

The `data` branch is not covered, and if it ever is, **it must not block force-pushes**:
`update-data.yml` force-pushes an orphan commit there every night, so a ruleset catching
that branch — including one that catches it by glob — breaks the job that publishes the
combo database.

**Secret scanning and push protection are on** (Settings → Advanced Security, which is the
live answer). Push protection is the half that earns its keep: it refuses a push carrying
something that looks like a credential, rather than telling you afterwards, and afterwards
is too late — a secret pushed to a public repository is a secret to rotate, not to remove.
Nothing here needs a credential today; the one place a real one is handled is
`update-data.yml` interpolating `secrets.GITHUB_TOKEN` into a push URL, which is exactly
the shape of thing that gets copied into a second workflow with the token written out
literally.

## Deploying

`.github/workflows/deploy.yml` publishes the repo root to GitHub Pages on every push
to `main`, and does: the repository is public, Pages is enabled and built from the
workflow rather than from a branch, and every merge produces a `github-pages`
deployment. The live answer is the Actions tab, or the deployments list —
`gh api repos/PaludaNCode/MTG-Combo-Finder/deployments?environment=github-pages`.

This used to carry a caveat that Pages on a **private** repo needs a paid plan, so make
the repo public or run the page locally until then. Both halves of that are settled and
the note is gone; it is recorded here only because a reader who remembers it should know
it was resolved rather than dropped.

**Asset URLs are stamped with the commit SHA, and nothing is listed by name.**
Pages' CDN caches by full URL and a deploy purges nothing, so an unversioned URL can
serve a stale file — or worse, new HTML with old JS — for up to ~20 minutes.
`tools/stamp-assets.js` reads whatever each page references, stamps all of it, re-reads
the file, and fails the deploy if anything local is left bare.

That inversion is the point. The `sed` this replaces carried a hand-written list of
filenames and a hand-written count per page, and asserted the count — which catches a
*rename*, and cannot catch an *addition*: a script added to the page and not to the
list ships unstamped while the count still matches. `unofficial.js` and `graph.js`
each shipped that bug, and it is invisible outside production, because an unstamped
URL resolves perfectly well — it just serves whatever the CDN cached last.

**Writing it caught two more.** The list had nine entries; the pages actually
reference eleven. `theme.js` — which runs in `<head>`, before the stylesheet, to stop
a white flash on a dark page — and `favicon.svg` were never stamped at all. Worse,
`tools/verify-layout.js` built its stamped-page fixture from its own regex, which
*did* match `theme.js`: the test proved a stamped page worked while production served
one that wasn't. Both now go through `rewriteAssets()` in the same file, so the
fixture cannot drift from the deploy again.

`search-worker.js` needs no entry and never did — it is loaded from `app.js` rather
than from the HTML, and stamps its own imports out of its query string. Links between
the two pages are deliberately left alone: `tiers.html` is navigation, and a commit
SHA in a URL people bookmark is the opposite of the point.

**Action versions are kept on a supported Node runtime**, which is what the Node 20
deprecation was about. `checkout` and `setup-node` are on **v7**, `upload-artifact`
on **v7**, and Pages' own three — `configure-pages@v6`, `upload-pages-artifact@v5`,
`deploy-pages@v5` — where they are.

**Reviewing the v7 bumps found that this claim had been false.** The runtime an
action uses is declared in its own `action.yml`, and reading them rather than the
release notes is the only way to know:

| | v5 | v7 |
| --- | --- | --- |
| `actions/checkout` | `node24` | `node24` |
| `actions/setup-node` | `node24` | `node24` |
| `actions/upload-artifact` | **`node20`** | `node24` |

So `upload-artifact@v5` was still on the deprecated runtime this section claimed
everything had left, and v7 is the bump that actually delivers it. For `checkout`
and `setup-node`, v7 is not a runtime change at all — the reasoning here never
argued for those, and they were taken on their own merits: no input changes to
`checkout`, and for `setup-node` an ESM migration plus the removal of `always-auth`,
which nothing here passed.

**The one `setup-node` change worth checking was its caching.** v5 enabled caching
by default with package-manager detection; v6 narrowed that to projects declaring
`packageManager` or `devEngines.packageManager` in `package.json`. This repo declares
neither and has no lockfile — there is nothing to cache and nothing installed — so
the narrower behaviour is if anything the safer one.

One real behaviour change came with the Node 24 sweep: **`upload-pages-artifact` v4
stopped including hidden files**, and this deploy uploads `path: .`. That is safe here
— the only tracked dotfile is `.gitignore`, neither page references a dot-path, and
there is no `.nojekyll` to lose, since an Actions-deployed site is served as-is and
never sees Jekyll. It also stops publishing `.github/` to the live site. If a dotfile
ever does need serving, v5 added an `include-hidden-files` input.

**CI cannot verify these.** `checks` never runs the deploy workflow, so a wrong
version here shows up only on the next push to `main`. A failed deploy leaves the
previous deployment serving — the site goes stale rather than dark — but the first run
after a bump is worth watching.

`upload-artifact` in `ci.yml` is unverified for a different reason: its step is behind
`if: failure()`, so a green run never reaches it. A bump there is proved by the first
run that goes red, not by the one that follows it — which is the worst moment to
discover the report no longer uploads, and the reason the version is worth reading
carefully rather than trusting a green tick.

## Credits

All combo data and the combo search itself come from the amazing
[Commander Spellbook](https://commanderspellbook.com/) project.
