# MTG Combo Finder

**▶ Live site: https://paludancode.github.io/MTG-Combo-Finder/**

Paste a Magic: The Gathering decklist and find the combos hiding in it — plus
**ranked suggestions for which single card to add to unlock the most new combos**.
A bit like [Commander Spellbook](https://commanderspellbook.com/)'s "Find My Combos",
but the matching happens in your browser against a published copy of their
database — see [Why the data is published, not queried live](#why-the-data-is-published-not-queried-live).

## Features

- **Combos in your deck** — every known combo your current 99 (or 60) can already pull off,
  with what it produces, how it works, and a link to the combo's Spellbook page.
- **Suggested additions** — every combo you're *one card away* from, aggregated per missing
  card and ranked: "add Rings of Brighthearth → unlocks 4 combos". Each suggestion links to
  the card's EDHREC and Scryfall pages and expands to show exactly which combos it enables.
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
  their first variant arrived, because the caller sorted by popularity and the
  most-played combo should not drift down the page. The layout test caught this
  when the first pass sorted by group size instead.
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

- **A slot is filled or the combo does not appear.** There is no one card to
  suggest for "a Creature with Haste" — 612 cards fill it — so a template combo
  only counts once the deck already fills every slot it has. Templates with no
  query (29 of 178) can never be filled and stay excluded, exactly as before.
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

## Layout

One column on phones and tablets; from 900px the decklist sits in a sticky left
column beside the results, so you can edit the list while reading suggestions.
Section headers are 48px tall for thumbs, and `tools/verify-layout.js` asserts
all of it — see Commands.

The layout test loads the page in a **sized iframe** rather than resizing the
browser window: media queries follow the iframe's width, and the full Chrome
build silently clamps `--window-size` to 500px, which quietly turned a "390px"
run into a 500px one that proved nothing.

## How it works

Static site, zero dependencies, no build step:

- `index.html` / `style.css` — the page.
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
  double-faced cards, ties broken alphabetically), and collapses interchangeable
  cards via `groupSuggestions()` / `groupVariants()`.
- `app.js` — reads the form, downloads the combo database, renders the sections
  above. On failure it shows a copyable report (endpoint, HTTP status, what was
  sent, which lines were skipped) instead of a bare "it didn't work".
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
  not live.
- Combos requiring a *template* ("a Persist Creature") are excluded from
  suggestions, since no single named card completes them — but not from results:
  see "Template slots" above.
- Deck colour identity is the union of the colours of the cards pasted in. If
  none of them is recognised, colour filtering is switched off rather than
  guessed at.

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
suggested card fits your commander's colours. `tools/fetch-combos.js` therefore
also streams [Scryfall's oracle-cards bulk file](https://scryfall.com/docs/api/bulk-data)
and publishes a name → identity map alongside the combos.

The same pass publishes `commanderNames`, the names of every card that is allowed
to *be* a commander — a legendary creature, a Background, or a card whose rules
text grants it — filtered by `legalities.commander`, which is what keeps tokens
and Un-cards out. Only the front face counts: Westvale Abbey's combined type line
reads `Land // Legendary Creature — Demon`, and testing it whole would make the
land a commander. The page uses that list to find the commander in a pasted deck.
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

# Regenerate templates.json — 465 Scryfall requests, ~23 minutes. Only needed
# when the data refresh reports templates it has not seen, i.e. after a new set.
# Normally run from the "Regenerate template card lists" workflow, on a branch.
node tools/templates.js templates.json

# Unit tests (node:test, zero deps)
npm test

# Layout smoke test — REQUIRED after any UI change. Renders the real page at
# 390/768/1440 px and fails on horizontal overflow, a collapse control that
# doesn't collapse, or the desktop columns not splitting.
npm run verify

# Syntax-check everything (same as CI)
for f in $(git ls-files '*.js'); do node --check "$f"; done

# Run locally: it's a static page, any file server works
npx serve .   # or python3 -m http.server
```

## Branching strategy

Same as [MTG-Pricerunner](https://github.com/PaludaNCode/MTG-Pricerunner): trunk-based,
short-lived branches.

1. Branch off `main`: `feat/<thing>` or `fix/<thing>`
2. Push, open a PR — CI runs (`checks` job: JS syntax check + unit tests)
3. Merge when green. Merging to `main` **is** the release: the deploy workflow fires
   on push to `main` and publishes to GitHub Pages (once Pages is available — see
   Deploying below).

`main` should be protected: PRs need the `checks` job green before merge; force-pushes
and deletion blocked. **Not enabled yet** — flip it on under
Settings → Branches → Add branch ruleset (require status checks: `checks`) when ready;
until then the flow above is convention. Repo admins can push directly in a pinch
(escape hatch — prefer PRs).

## Deploying

`.github/workflows/deploy.yml` publishes the repo root to GitHub Pages on every push
to `main`. Note: GitHub Pages on a **private** repo requires a paid GitHub plan —
either make the repo public or run the page locally until then.

## Credits

All combo data and the combo search itself come from the amazing
[Commander Spellbook](https://commanderspellbook.com/) project.
