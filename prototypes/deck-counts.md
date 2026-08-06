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

- **1,191 land cards** of 34,422 — 22.4 KB as a JSON array of names, **9.1 KB gzipped**.
  That is the count by *front* face; 1,273 cards have a land face anywhere, and decision 2
  below is why the other 82 are not in it.
- Plus **13 basic-land names**, 204 bytes, 119 gzipped — the second list the
  `(16 basic · 20 nonbasic)` aside needs.
- Plus the **82 MDFCs** — a spell on the front, a land on the back — 3.4 KB, 1.7 KB gzipped,
  for the `62 spells (3 MDFCs)` aside. Not a subset of the lands but the complement of them.
- The whole payload gzips to **1.25 MB** on the wire (the publish gate's own figure, against its
  1.53 MB ceiling), so the three lists are about **+0.9%**, and they are read by `search-worker.js`
  rather than the main thread. An earlier draft of this file said 1.72 MB and took it from a table
  further up the README rather than measuring — `check-snapshot.js` is the live answer.

A `lands` array is the cheap shape and the right one: the page needs one boolean per card, not a
type line. Shipping full type lines for every card is 282 KB gzipped — **31× the cost** for a
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
   named decision rather than a fall-out of reading `faces[0]` — and, as shipped, worth saying out
   loud: they are counted a second time as `62 spells (3 MDFCs)`, so a deck site showing 39 lands
   against this page's 36 explains itself.
3. **Three cards are Land Creature** (Dryad Arbor and two more). They are lands. This only bites
   if the strip ever grows a creature count, at which point the two overlap and something has to
   say so.
4. **Lands + spells must equal cards, visibly.** 36 + 62 = 98 is checkable at a glance, and that
   is the point — so the unread bucket cannot be quietly folded into either half.

## What shipped, and what the prototype caught

**Variant A+, with the spells before the lands**: `Deck  98 cards · 62 spells · 36 lands (16 basic ·
20 nonbasic)`. One line, above the colour identity, no panel — the strip sits directly above the answer
the page is for, so every pixel of height it takes is height taken from that. B lost on exactly that
count and C spends a whole box on one line. The order puts the deck's body first and the land count
last, where the eye stops, because the land count is what somebody came to check.

The prototype caught one thing no sketch would have: **`.count` is already a class** in `style.css`,
carrying `display: flex` for the magnitude bar behind a suggestion's number. Reusing it turned the `<b>`
into a block and the strip rendered `98cards · 36lands`, with the space present in the DOM and the HTML
entirely valid. Every class in the shipped rules is prefixed because of it.

Two things it did not settle, both measured afterwards on the real page:

- **At 390px the strip takes two lines** — `98 cards · 62 spells · 36 lands (16 basic · 20 nonbasic)`
  does not fit 358px of column. Two lines rather than dropping the aside, which is the number a phone
  would most want. `verify` allows two below a 416px column and exactly one above it, and the limit is
  written for what a real deck does rather than for what the fixture deck does — the fixture's `17 cards ·
  7 spells · 10 lands` fits on one line at every width and would have passed a rule that only works for
  short decks.
- **The aside names only the halves that are there.** `10 basic · 0 nonbasic` is a zero nobody asked
  about; the fixture deck is ten Islands and reads `(10 basic)`.

The file is still four variants, kept as the record of the choice. It is not wired to the page, so a
change in `style.css` does not show up in it.

    test/fixtures/deck.txt              98 cards · 62 spells · 36 lands (16 basic · 20 nonbasic)
    test/fixtures/chatterfang-deck.txt  116 cards · 80 spells · 36 lands (16 basic · 20 nonbasic)
