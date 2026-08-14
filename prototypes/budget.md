# What a suggestion costs — and where the price actually belongs

The question the prototype was drawn to answer: **the page ranks 141 cards by how many combos
each would unlock, and says nothing about the fact that one of them is 25 cents and the next is
thirty dollars. Where does the money go?**

Answer: **into the tiebreak, not into the headline.** `prototypes/budget.html` is the drawing.

> ## The prices in that file are placeholders
>
> Scryfall is 403 at CONNECT from this sandbox (CLAUDE.md, *Network, and this sandbox*), confirmed
> again on 13 Aug 2026, so **no price in the prototype was measured.** They are deliberately round
> — 0.25, 0.50, 1, 2, 4, 8 — so they cannot be read as quotes, and one card is deliberately
> unpriced. What is real: the cards, the combo counts, the size breakdowns, the seven-way tie, and
> the order each control puts them in.

## The measurement that argues for the feature

Measured 13 Aug 2026 against the live snapshot (105,452 combos) with the real `parser.js` and
`combos.js`:

| deck | suggestions | in a tie of 2+ | biggest tie |
|---|---:|---:|---:|
| tuning deck | 141 | **139 (99%)** | 66 cards, all unlocking 1 |
| Chatterfang deck | 248 | **241 (97%)** | 53 |

The tuning deck's suggestions by combos unlocked: **10 → 1 card · 7 → 7 cards · 6 → 1 card ·
5 → 14 · 4 → 12 · 3 → 19 · 2 → 21 · 1 → 66.**

**So the headline number decides almost nothing about the order a reader sees.** One card unlocks
10; seven cards unlock exactly 7; sixty-six unlock exactly 1. For 99% of the list the order comes
from the tiebreak, and the tiebreak today is EDHREC popularity — a reasonable choice, and not the
question a deck builder is asking. Given seven cards that each unlock seven combos, the question
is which of them they can afford.

That is the feature. Not a "combos per dollar" ranking — **price as the tiebreak.**

## The default, settled by drawing the alternatives

Four orderings are on the control and the recommendation leads:

| ordering | what it does to this deck |
|---|---|
| **Combos, then cheapest** | +10 Herd Baloth, then the seven 7s in price order, unpriced last. **Recommended.** |
| Combos, then popularity | what ships today |
| Cheapest first | puts Ajani's Welcome (+5) above Cleric Class (+7) |
| Combos per $1 | promotes a 25¢ card unlocking one over a $4 card unlocking seven |

**Cheapest first throws away the ranking the page exists to produce**, in exchange for a number
the reader can already see on every row. *Combos per $1* is the flashy one and the least useful:
it is arithmetic rather than advice. Both stay on the control because they cost nothing to offer
and somebody will want them; neither should be the default. Drawing all four is what made that
obvious — the first version of this prototype shipped with *cheapest first* as its opening state
and the list read as broken.

## Three things that must not be got wrong

1. **The price is its own quiet pill, never folded into the Buy link.** "Buy $4.00" reads as a
   quote for the page that link opens, and it is not one: it is a market price from a daily
   snapshot, one printing, before postage. The pill's `title` says so and the caption names the
   snapshot. A reader who clicks through to a different number stops believing the rest of the
   page, which is a bigger loss than the feature is a gain.
2. **Sorting is a `<select>`; the budget cap is a chip.** The same distinction
   `prototypes/filter-bar.html` drew: chips are additive toggles, a sort is exclusive, and giving
   them one appearance teaches the wrong rule.
3. **Absent is not free.** An unpriced card sorts *last* in every ordering, and the cap keeps it
   rather than dropping it. Reading a missing price as 0 makes every card too new to have one the
   cheapest thing on the page, so "cheapest first" would recommend exactly what nobody can buy —
   and it would look like a working feature.

Nor may a basket print a precise total. "About $14" is what the data supports; `$13.75` is a claim
about postage, printing and the hour of the day that no snapshot can stand behind.

## What must be measured before this ships

- **The payload.** Prices would be a new file on the `data` branch, written by the nightly job
  that already streams Scryfall's bulk export for `card-text.json`. *Under 1 MB is an estimate and
  nothing here has weighed it* — `node tools/scryfall-bulk.js` on a runner is the answer, and it
  has to run there rather than here.
- **How many of the 34,422 cards have no price at all**, which is the real size of decision 3.
- **Whether the file is fetched lazily.** The first-search budget is already spent on
  `combos.json`; a second unconditional download is a regression for every reader who never
  touches this control.
- **`usd` or `eur`.** Scryfall carries both and the shipped store link is TCGplayer, so the
  prototype uses dollars. A reader in Europe being quoted dollars beside a US store is coherent;
  quoting euros beside it is not, so the two would have to move together.
