# Cards carrying no combo — is there a panel here, and what is it allowed to say?

The question the prototype was drawn to answer: **"Combos in your deck" lists the cards that
carry one. What about the other 41, and can the page say anything about them that is not a
deckbuilding opinion it has no business having?**

Answer: **yes, but only if it is three groups rather than one list, and only if it is a floor
rather than a verdict.** `prototypes/no-combo-panel.html` is the panel; this file is the
measurement and the two decisions that are still open.

Every number below was measured on **13 Aug 2026** against the live snapshot (105,452 combos)
with the real `parser.js` and `combos.js`. The commands are named rather than reproduced.

```bash
node tools/try-deck.js                          # 85 lines, 98 cards, 33 combos
node tools/deck-cards.js test/fixtures/deck.txt # which cards carry them
```

## One list would have been useless

85 distinct cards, 23 of them lands. The 62 nonland cards split four ways, and the split is the
whole feature:

| | tuning deck | Chatterfang deck |
|---|---:|---:|
| carries a combo now — *Combos in your deck* today | 21 | 40 |
| **one card away from one** | **10** | **11** |
| **in published combos, none reachable here** | **9** | **7** |
| **in no published combo at all** | **22** | **22** |

Trudge Garden carries nothing and is one card from five. Path to Exile carries nothing and always
will. Both are "cards carrying no combo", and telling a reader they are the same thing is worse
than not having the panel.

**The panel does not empty out as a deck gets better.** The Chatterfang deck is the tuned one —
233 combos against 33 — and its three groups are 11 / 7 / 22 against 10 / 9 / 22. What changes is
that the first group's cards are closer: Well of Lost Dreams sits in "no partner here" on the
tuning deck and moves to "one card away" (12 of them) on the Chatterfang deck. Same card, same
92 published combos, different deck.

## Three things it must not do

1. **It must not be called "Cut candidates."** The page has no idea what the deck needs to
   function. 22 of these 62 cards are the removal, the ramp and the protection, and a heading
   that calls them candidates for cutting is a claim the data cannot support. Same rule the
   bracket panel already follows: a floor, never a verdict.
2. **It must not list lands.** 21 of the 43 cards in no published combo are lands, and a tab that
   is mostly `Forest` is wallpaper. `dataset.lands` already carries the list, so this is a filter
   rather than new data — but **two of the hidden lands are not wallpaper**, Command Tower (15
   published combos) and Vernal Fen (1), which is why the caption says *23 lands are not shown*
   instead of quietly dropping them.
3. **It must not put a bare `0` in the gutter.** Every row's shipped number would be zero, which
   is a column of zeros saying the same thing 41 times. Each group's number means something
   different instead — 5 combos one card away, 92 published elsewhere — and the third group has no
   number at all because it has no number worth printing.

## What it costs to build

Almost nothing new. `.panel`, `.panel-note`, the `.tabs` strip and `.combo.suggestion` are all
shipped, and **`pieceCard()` in `render-suggestions.js` already renders a card with zero combos** —
the basket produces those — so the row builder is reused rather than written.

Two things are new and both are wording:

- **the gutter labels**, `one away` and `elsewhere`, replacing the shipped `combos`
  (`DeckView.rowNumbers`). `5 combos` under a heading that says the card carries none would be the
  page contradicting itself. Neither replacement is good: `one away` wraps to two lines in the
  4.2rem gutter at a laptop width, which is visible in the prototype.
- **the "Needs …" line**, which is the most useful sentence in the panel and belongs in
  `view-model.js` beside the other row sentences. Its hard case is a card wanting eleven partners.

## Still open

- Should the second tab print the published count at all? `92` is the only figure anywhere on the
  page that counts combos **outside** the reader's deck, and a reader may well read it as
  something they have.
- Collapsed by default, or open? Collapsed is the recommendation — the state is already remembered
  per reader (`PageDom`'s `COLLAPSE_KEY`) and 41 rows between the suggestions and the basket push
  the basket off a phone screen.
