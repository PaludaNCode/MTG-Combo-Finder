# MTG Combo Finder

Paste a Magic: The Gathering decklist and find the combos hiding in it — plus
**ranked suggestions for which single card to add to unlock the most new combos**.
A bit like [Commander Spellbook](https://commanderspellbook.com/)'s "Find My Combos",
because it literally asks Commander Spellbook's public API about your deck.

## Features

- **Combos in your deck** — every known combo your current 99 (or 60) can already pull off,
  with what it produces, how it works, and a link to the combo's Spellbook page.
- **Suggested additions** — every combo you're *one card away* from, aggregated per missing
  card and ranked: "add Rings of Brighthearth → unlocks 4 combos". Each suggestion links to
  the card's EDHREC and Scryfall pages and expands to show exactly which combos it enables.
- **Outside your color identity** — the same ranking for cards that would require changing
  your deck's colors, shown separately.
- **Deck import** — paste an Archidekt deck URL, or paste any site's text export
  (Moxfield, Arena, MTGO `SB:` lines, TappedOut/Deckstats/MTGGoldfish plain exports).

## How it works

Static site, zero dependencies, no build step:

- `index.html` / `style.css` — the page.
- `parser.js` — decklist parsing (`DeckParser`). Understands plain names, `1x Card`,
  Moxfield/Arena exports (`1 Sol Ring (C21) 263 *F*`), `Commander:` / `Sideboard:`
  sections, MTGO `SB:` prefixes, comments, Moxfield + Archidekt API payloads, and
  deck URLs. Runs under Node so it's unit-testable.
- `combos.js` — combo-result analysis (`DeckCombos`): turns the API's "almost included"
  variants into the ranked add-this-card suggestions (front-face matching for
  double-faced cards, ties broken alphabetically).
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
- Combos requiring a *template* ("any sacrifice outlet") are excluded from
  suggestions, since no single named card completes them.
- Deck colour identity is derived from the commander's entry in the dataset. An
  unrecognized commander disables colour filtering rather than hiding results.

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

The first published dataset had `cardIdentity: {}` because the fetcher looked for
a `card.identity` field that does not exist, and the guard around it turned that
into an empty map rather than an error — colour filtering was simply inert. The
fetcher now refuses to publish with fewer than 1,000 identities.

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
# Build the combo database locally (one large download)
node tools/fetch-combos.js

# Unit tests (node:test, zero deps)
npm test

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
