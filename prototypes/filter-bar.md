# Filtering the results — what a chip has to say, and what it must not hide

The question the prototype was drawn to answer: **can the reader ask the results a narrower
question — only the wins, only the two-card ones, only the ones my commander is in — and see
that it worked?**

Answer: **yes, and the second half is the hard half.** `prototypes/filter-bar.html` filters the
real 233 combos of the standing Chatterfang deck; this file is the measurement and the two
decisions behind it.

```bash
# the fixture declares no commander, so the chip this was written for needs one adding
sed 's/^1 Chatterfang, Squirrel General$/& *CMDR*/' test/fixtures/chatterfang-deck.txt > /tmp/cf.txt
node tools/deck-filters.js /tmp/cf.txt              # the table below
node tools/deck-filters.js /tmp/cf.txt --json prototypes/filter-bar-data.js.json
```

## The measurement that shapes the design

Measured 13 Aug 2026 against the live snapshot (105,452 combos):

| chip | combos | rows in *Combos in your deck* |
|---|---:|---:|
| — | 233 | 40 |
| Uses my commander | 11 | 14 |
| **Wins only** | **182** | **40** |
| 2-card | 9 | 12 |
| Uses my commander **+** 2-card | 1 | 2 |

**"Wins only" removes 51 combos and no rows at all.** The panel is a row per *card*, and every
card carrying a combo in this deck carries at least one win, so the list looks identical after
pressing it. Its whole visible effect is that the gutter numbers shrink — Phyrexian Altar 46 → 35,
Heliod, Sun-Crowned 44 → 39 — which a reader with the disclosures closed can easily miss.

That is the difference between the two kinds of chip, and nothing on the row tells you which one
you have pressed. So the panel caption restates the filter as a sentence and prints **both**
numbers: *"Showing the 182 of 233 combos that win the game, carried by 40 of your 40 cards."*

## Two decisions

**1. Toggles, not tabs.** They AND together. `Uses my commander + 2-card` is one combo —
Chatterfang, Squirrel General + Pitiless Plunderer, the only thing in this deck you assemble by
drawing a single card — and a tab strip makes that question unaskable. It also costs a new
control: the shipped `.tabs` chrome cannot be reused, because giving an exclusive control and an
additive one the same appearance teaches the reader the wrong rule.

**2. Every chip's count answers the same question: *with this on, and whatever else is on, how
many are left?*** So an unpressed chip is a prediction and a pressed one is the panel's current
count, which is why two pressed chips read the same number.

The other reading was built first and is wrong in a way that looks right — a pressed chip showing
what *releasing* it would give. With `Uses Chatterfang` and `2-card` pressed the bar read **9 and
11 over a panel holding 1**, and nothing on screen said that neither number was the answer.

A chip that would leave nothing is **disabled and still shows its 0**, rather than hidden: with
those two pressed, `Wins only` reads 0 because that one combo is *decisive*, not a win. Hiding it
would make the bar change shape under the pointer as you press its neighbour.

## The commander chip is absent, not empty

A chip reading 0 is a claim: *your commander is in no combo*. A deck that never said who its
commander is has made no such claim, and that is the common case — **neither checked-in fixture
deck declares one** (CLAUDE.md, "The two fixture decks"), so it is the state an author never sees
and a reader usually is in. The prototype switches between the two states from the top of the page.

## What it does not filter

The suggestions. *"Which card would unlock the most wins"* is a good question and a different
feature: these chips are about the combos you already have, and that panel has tabs of its own
which these would then wrap.

## Still open

Whether the bar survives a new search. Keeping it means pasting a fresh deck and being told it has
9 combos; clearing it means losing the filter on every `+ Add to deck`, which re-runs the search.
The shipped answer probably has to tell those two apart.
