# Buying the cards the page just recommended — three shapes

The question the prototypes were drawn to answer: **the page's best output is a ranked list of cards
somebody does not own, so what does "and now buy them" look like, and where does it live?**

Three shapes, one file each, all drawn against the real stylesheet so the panel chrome, the tokens and
both themes are the shipped ones:

| | file | in one line |
|---|---|---|
| **A** | `shopping-basket-panel.html` | A fourth panel, *Cards you've added*, in the results flow |
| **B** | `shopping-basket-tray.html` | The same basket docked to the bottom of the viewport |
| **C** | `shopping-buy-in-row.html` | No basket at all — a Buy chip on every suggestion row |

All three share `shopping-cart-links.js`, which is the one place a store URL is spelled out, and
`shopping-proto.js`, which makes the buttons real: *Copy list* copies, and each store button carries
the URL the module actually builds and prints it on the page so it can be pasted into a browser and
settled.

Every number below was measured on **8 Aug 2026**. The commands are named rather than reproduced.

## The measurement the prototypes are built on

The tuning deck, with its five top suggestions taken:

```bash
node tools/try-deck.js                     # 98 cards, 33 combos
node tools/try-deck.js <that deck + 5>     # 103 cards, 80 combos
```

Five cards — Herd Baloth, Ashnod's Altar, Cleric Class, Light of Promise, Pitiless Plunderer — take
this deck from **33 combos to 80**. That is the number the basket exists to show, and it is the reason
the feature is worth building at all: the page can tell somebody what five cards bought them, and
nothing else they own can.

## The basket is derived, not tracked

This is the one design decision that is not a matter of taste, and it is the same in A and B.

`+ Add to deck` writes a line into the decklist box and re-searches (`render-rows.js:160`). After that
the card is indistinguishable from a pasted one — `addedNote` is cleared by the very next render. So a
basket built by **logging clicks** would be a second source of truth over free text the reader can edit
by hand, which is the shape this repository keeps designing out: the asset stamping reads what the
pages reference rather than a list, and `prune-artifact.js` computes what survives from `localAssets()`
rather than keeping one.

Instead, store **the deck as it arrived** — pasted, dropped, imported from a URL, or opened from a
share link — and let the basket be the difference. One extra field beside what `DeckIO.saveDeck()`
already keeps.

| the reader does | click log | arrival diff |
|---|---|---|
| types a card into the box by hand | misses it | catches it |
| removes an added card | needs an un-log path | drops out on its own |
| reloads the page | gone | intact, baseline sits beside the deck |
| opens somebody's share link | meaningless | empty, which is correct — that whole deck arrived |
| pastes a new deck | stale | baseline resets |

One misread to accept rather than engineer around: **added is not unowned**. Somebody may add a card
they already have, or fix a typo and watch it appear in the basket. Per-row *Remove* handles it. Do not
try to infer ownership; the page has never known what anybody owns and guessing is worse than the
occasional wrong row.

## The number the basket must not show

The five cards are in 18, 11, 10, 10 and 8 of the deck's combos. **Those sum to 57, and the deck only
gained 47.** Combos overlap — a combo naming two of the five is counted by both — so a basket that adds
its rows up is wrong by ten on a five-card list, and wrong by more as the list grows.

Worse, the figure the *suggestion* panel showed for Herd Baloth was **+10**, and once all five are in
it is **in 18**. Both are true and they answer different questions: *what would this unlock from the
deck you had* against *how many of the deck's combos name it now*. Neither is the other, and putting
the first in a basket that the reader has since added four more cards to is a stale number that looks
live.

So both basket shapes show **one** aggregate — `33 combos → 80`, the deck total before and after — and
a per-row figure that is the same one *Combos in your deck* already computes for every card in the
deck. This is `DeckView.deckCombosNote()`'s rule again: a count beside a heading has to say what it
counts, and `npm run verify` measures the three panel captions against each other for exactly this.

## Prices are a separate decision with a data cost

The price column in shape A is drawn and empty, on purpose.

`combo-steps.js`'s `pick()` strips `prices.tcgplayer` out of every published record, and
`test/combo-steps.test.js:268` asserts the word never appears in one. Nothing the browser can reach
knows what a card costs. Bringing prices back is worth doing — "these five cost £X" is what turns a
suggestion list into a budget decision — but it is a data change, not a layout one:

- it goes through the nightly snapshot, not a live API, so `connect-src` stays as it is and the page
  keeps working offline;
- the prices are then up to a day stale, which has to be said on screen rather than implied;
- and it costs payload on a file with a **1.53 MB ceiling** the publish gate already enforces
  (`node tools/check-snapshot.js` is the live figure).

The slot is in the prototype because its width is a layout question worth settling now. Filling it is a
separate piece of work.

## What a tray costs that a panel does not

Shape B buys reachability, and that is a real win: the results are long, the basket fills while the
reader is *in* them, and a panel at the bottom is a panel you have to know is there.

Against that, this page has **no fixed or overlaying UI anywhere today**. Everything scrolls. A tray
needs its own answers for:

- focus order — it is last in the DOM and first on the screen;
- whether Escape closes it;
- 390px in landscape, where a 6rem bar is a sixth of the viewport;
- whether it hides while the decklist textarea has focus, since on a phone it and the keyboard want the
  same space;
- and body padding equal to the closed bar, or the footer is what it permanently covers.

Shape A needs none of those answered. That is the whole trade, and it is why A is the recommendation
below despite B being the better shape in the abstract.

There is also a checking trap that comes with B specifically: the tray's list is `hidden` while the bar
is closed, and **every rect inside a closed container is 0**, so an assertion about the list passes
against a box the browser never laid out. CLAUDE.md records this under *A control that opens something
must be measured OPEN, and pressed with focus* — it has shipped bugs here twice. Whatever checks shape
B presses the toggle first, with `focus()`, not `element.click()`.

## What is not verified

**Nothing about any store URL has been confirmed.** Every store host 403s at CONNECT from this sandbox
— probed 8 Aug 2026, all three returned `000`:

```
www.tcgplayer.com    blocked
www.cardkingdom.com  blocked
www.cardmarket.com   blocked
```

So `shopping-cart-links.js` carries `verified: false` on every entry and a `check` string naming what
settles it. The honest state:

| store | shape assumed | what has to happen |
|---|---|---|
| TCGplayer | `GET /massentry?productline=Magic&c=<qty name>||…` | Paste a built URL into a browser; confirm five cards land in the cart |
| Card Kingdom | modelled as a GET; may be **POST-only** | If POST-only it stops being a link — see the CSP note below |
| Cardmarket | **no public URL contract known** | Their want-list import appears to need a login. If so this store is Copy-list-only and the button must say so rather than opening a sign-in page |

The affiliate ids are placeholders that deliberately do not look real (`PUBLISHER_ID`, `PARTNER_ID`),
because an id that looks real is an id somebody assumes was checked. Wrapping is a separate step from
building the destination for one reason that matters: **the unwrapped URL is what ships if the
programme lapses or is wrong for the reader's region.** A store link that stops earning is a working
feature; a store link that stops working is not.

## What the CSP allows

- **Plain `<a href>` cart links need no CSP change.** Navigation is not restricted by either page's
  policy. All three shapes ship as-is on this point.
- **A POST form does not have a clear answer.** `form-action` does not inherit from `default-src`, and
  neither `index.html` nor `tiers.html` names it — so what a browser does is down to the browser rather
  than to a decision anybody here made. If a store needs a POST, add `form-action` explicitly and name
  the hosts before building the button.
- **No third-party script, tag, pixel or remote logo can ever be added**: `default-src 'none'`,
  `script-src 'self'`, `img-src 'self'`. Store names are text, not logos. This is not a limitation to
  work around — it is the reason the page loads the way it does.

## Measuring which shape people use

The page carries no analytics and cannot: a third-party tag breaches the CSP by construction. So the
only conversion signal available is **the affiliate network's own reporting**, keyed on a `subid` that
names the placement — `basket-panel`, `basket-tray`, `row-buy`, `row-buy-all`. Every button in all
three prototypes already passes one.

That is enough to answer *which placement earns*, and it answers it without the page recording anything
about its readers. It is not enough to answer *how many people press + Add to deck at all*, which is
the number that decides between A/B and C — and nothing here can answer that. Shape C's best argument
is that it serves the reader who never presses the button, and **nobody knows what share that is.**

## What shipping any of them needs

- `npm run verify` — non-negotiable, all three touch layout. It renders at 390/768/1440/1920px and
  catches what a screenshot cannot.
- The row thresholds resolve against **the row's own column, not the viewport** — 704px at a 768px
  window but 442px at 900px. Any claim about what fits at 390px in shape C is a guess until `verify`
  prints the column width.
- A new panel in shape A means a new `panel-count`, and the rule that a count beside a heading must say
  what it counts applies the moment it lists cards while the note talks about combos.
- `e2e/a11y.spec.js` for the contrast of any new chip or button, on `--panel` **and** on `--panel-2` —
  the result chips measured 4.19:1 on the nested surface and passed on the flat one.

## Recommendation

**Ship C first, then A.**

C is an afternoon, touches `RenderRows.cardLinks()` and the suggestions panel head, needs no new state,
and serves the reader who reads the list and decides in their head — a share of the audience nobody can
currently measure. It also puts the store URL question to the test cheaply, which is the only genuinely
unknown part of this whole feature.

A is the shape worth having. It answers *what did this session change about my deck*, which is
currently unanswerable without diffing two textareas by eye, and it earns its place with the affiliate
links removed — which is the test of whether a monetization feature is really a feature.

B stays a prototype until somebody has watched a real reader lose track of the basket in shape A.
