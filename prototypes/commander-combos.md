# Combos with your commander — is the data there?

The question asked before the prototype was drawn: **can the page say that a combo uses your
commander, and is that worth saying?** Answer: **yes to the first, entirely from data the page
already has and with no change to the snapshot. The second is where the interesting number is** —
the claim worth making is not *this uses your commander*, it is *you only have to draw one card
for this*.

Every number below was measured on 8 Aug 2026 against the live snapshot
(`raw.githubusercontent.com/.../data/combos.json`, 104,198 combos) using the real `parser.js`
and `combos.js`. The commands are named rather than reproduced.

## The deck half needs no new data at all

`DeckParser.parseDecklist()` already returns `{ commanders, main, skipped }`, and `commanders` is
populated from every marker the page accepts — a `Commander (1):` heading, an inline `*CMDR*`, a
`[commander]` annotation, or Moxfield's and Archidekt's own commander boards. Matching those names
against `variantCardNames()` on a matched row is the whole feature.

**It is deck-side only, which is what makes it cheap and also what bounds it.** The page can say
*this combo uses a card you happen to have chosen as your commander*. It cannot say *this combo
requires that card to be your commander* — see the last section.

## It marks 5% of rows, not everything

The objection this prototype was built to answer: a Commander deck's commander is in half its
combos, so a chip would mark everything and mean nothing. **Measured, it marks 11 of 233.**

| Chatterfang deck (233 combos in deck) | |
|---|---|
| combos naming the commander | **11 (5%)** |
| of those, printed as 2-card | 1 |
| of those, printed as 3-card | 10 |
| suggestions unlocking a combo that names the commander | **66 of 247 (27%)** |

On the tuning deck with Kinnan declared, **0 of 33** — the deck's cards simply do not pair with
him in the snapshot, and 3 of its 153 suggestions do. So the marker is quiet on one real deck and
useful on the other, which is the right shape for something that must not become wallpaper.

## The number that changes is "cards you still have to draw"

This is the part worth building. A commander starts in the command zone: it is never a card you
wait for. So a combo's *printed size* and *what it costs you* are two different numbers, and the
page currently prints only the first.

| Chatterfang deck | 2 | 3 | 4 |
|---|---|---|---|
| by printed size | 9 | 169 | 55 |
| by cards you must draw | 18 | 159 | 55 |
| …and one at **1** | | | |

**Chatterfang, Squirrel General + Pitiless Plunderer is a combo you assemble by drawing one
card.** The page prints it as `2-card`, identical to a 2-card combo where you must find both
halves. That is the concrete misrepresentation, and it is the argument for the feature — not the
chip.

    node tools/try-deck.js       # the deck this is measured against, without a commander marked

## Keep the size pill, add a separate chip. Do not rewrite the pill.

The prototype draws four treatments and **recommends C**. The reason is a rule this repository
already follows elsewhere: a combo's size is a property of the *combo* and is true for everybody,
while "cards you still have to draw" is a property of *your deck*. Rewriting `2-card` to `draw 1`
makes a pill that is summed and counted across panels into a deck-dependent figure — and the
size breakdown under each suggestion adds up to the total beside it, which is checked. Two facts,
two pieces of vocabulary.

| variant | what it says | why it lost |
|---|---|---|
| A | a `Commander` pin on the row | true and inert — it names the card without saying why anyone should care |
| B | the size pill becomes `draw 1` | the honest number in the wrong place: it makes a combo property deck-dependent and breaks the breakdown sums |
| **C** | size pill kept, plus a `1 to draw` chip | **recommended** — two facts kept apart, and the new one only appears on the 5% of rows it changes |
| D | C, plus the commander's name marked in the heading | the clearest, and the most new surface; worth it only if C reads as unattributed |

## What a snapshot change would buy, and what it costs

Commander Spellbook's export carries **`mustBeCommander`** and `zoneLocations` per card — the
fixture in `test/fixtures/dataset.js` already models both — and `tools/fetch-combos.js` **drops
them**. A published combo is `{ c, p, i }`: cards, produces, identity. Nothing about a zone.

That is a different and stronger feature: *this combo only works if that card is your commander*,
which turns a row a reader dismisses into a reason to keep their commander, and turns a
suggestion into a warning. It needs one field in the payload and one condition in the fetcher's
existing pass.

**Not proposed here.** It is a data change with a size cost against a watched payload, it wants
its own measurement of how many of the 104,198 combos actually set the flag, and this prototype
is deliberately the half that needs nothing.

## The branch that has to stay silent

**Neither checked-in fixture deck declares a commander.** `test/fixtures/deck.txt` and
`test/fixtures/chatterfang-deck.txt` are both plain lists; the `*CMDR*` marker is added by
`test/fixtures/dataset.js` for the harness decks, and the measurements above were taken by marking
a commander by hand.

So the common case for a pasted list is **no commander declared at all**, and every part of this
must then draw nothing — no chip, no second number, no empty space where one would go. That is
the same rule the legality line already follows when no commander is named, and it is the branch
most likely to be got wrong, because the author is always testing with a marked deck.
