# Cards and lands on import — is the data there?

The question asked before the prototype was drawn: can the page say *98 cards, 36 lands* about a
list somebody just pasted, with the data this repository already has? Answer: **the card count
yes, today, from nothing; the land count yes, but it needs one field added to a file CI already
builds.** Nothing about it needs a new third party, a new request or a new origin in the CSP.

Every number below was measured on 6 Aug 2026. The commands that produce them are named rather
than reproduced, so they stay answerable when the figures move.

## The card count needs no data at all

`DeckParser.parseDecklist()` already returns `{ commanders, main }` with a `quantity` per entry,
and the sideboard rules that decide what is *in* the deck are already applied there — a
`Sideboard:` heading, an `SB:` prefix, a `*CMDR*` marker, a hundred-card command zone. Summing
`quantity` is the whole feature.

It is not a count anything on the page currently shows, and the difference matters: the tuning
deck is **85 lines and 98 cards**, because sixteen of its lands arrive as `9 Forest` and friends.
`tools/try-deck.js` prints *85 cards parsed* — it counts entries, and that is a tool's own summary
being wrong in the way CLAUDE.md warns about under *What a tool says about itself is not exempt*.
Whichever number the page shows, it must be the one it means: **98** is how many cards the deck
has.

    node tools/try-deck.js                     # the deck the measurements above come from

## The land count needs a type line, which the browser has never had

Nothing served to the browser knows a card's types. Three candidates, only the third works:

| candidate | verdict |
|---|---|
| `combos.json`'s `cardIdentity` | **colour only.** A name → identity map (`"BG"`), no types. |
| `card-text.json` | **has it, cannot ship it.** `faces[].types` for 34,422 cards — and 16.5 MB, deleted out of the Pages artifact by `tools/prune-artifact.js` because no page references it. It is the research cache, not page data. |
| one more field in the snapshot build | **this one.** |

`tools/fetch-combos.js` already streams Scryfall's `oracle-cards` bulk file over **every real
card** and reads three things off each: `color_identity`, `game_changer`, and
`legalities.commander`. `type_line` is on the same card object. Collecting the land names in that
same pass costs one condition and no extra request.

What it costs on the wire, measured off `card-text.json` as a stand-in for what Scryfall would
give:

- **1,273 land cards** of 34,422 — 25.8 KB as a JSON array of names, **10.5 KB gzipped**.
- The payload is 1.72 MB on the wire, so that is **+0.6%**, and it is read by
  `search-worker.js`, not the main thread.

A `lands` array is the cheap shape and the right one: the page needs one boolean per card, not a
type line. Shipping full type lines for every card is 282 KB gzipped — **27× the cost** for a
question nobody is asking yet.

    node -e "console.log(require('./card-text.json').count)"   # what the cache covers
    gzip -9 -c <file> | wc -c                                  # the only size that counts

## The four decisions the data forces

1. **A card the map has never heard of is neither land nor spell.** It has to be its own number.
   `DeckView` already has this rule for the unrecognized-cards box — over half the deck unknown
   means the *data* is thin, not the decklist, and the page says nothing rather than accusing the
   reader. The lands half must go silent on the same test, and the card count must survive it,
   because the card count never depended on the data. The test fixture is exactly that case:
   `cardIdentity` knows **14 of 85** cards.
2. **Modal double-faced cards.** 82 of the 1,273 are land on the back face only — Agadeem's
   Awakening, Turntimber Symbiosis. Front face wins here, so they count as spells, which is what
   Moxfield and Archidekt do and therefore what a reader is comparing against. Worth being a
   named decision rather than a fall-out of reading `faces[0]`.
3. **Three cards are Land Creature** (Dryad Arbor and two more). They are lands. This only bites
   if the strip ever grows a creature count, at which point the two overlap and something has to
   say so.
4. **Lands + spells must equal cards, visibly.** 36 + 62 = 98 is checkable at a glance, and that
   is the point — so the unread bucket cannot be quietly folded into either half.

## What the prototype does and does not settle

`deck-counts.html` draws four variants against the real stylesheet in both themes. It settles the
layout questions — where the strip sits, what wraps at 390px, which existing tokens it uses — and
it settled one that no sketch would have: **`.count` is already a class** in `style.css`, carrying
`display: flex` for the magnitude bar behind a suggestion's number. Reusing it turned the `<b>`
into a block and the strip rendered `98cards · 36lands`, with the space present in the DOM and the
HTML entirely valid.

It does not settle which variant ships, and it is not wired to a deck: every number in it is
typed, taken from the two fixture decks.

    test/fixtures/deck.txt              98 cards · 36 lands (16 basic) · 62 spells
    test/fixtures/chatterfang-deck.txt  116 cards · 36 lands (16 basic) · 80 spells
