# MTG Combo Finder

Paste a Magic: The Gathering decklist (e.g. a [Moxfield](https://moxfield.com/) export)
and find the combos hiding in it — a bit like
[Commander Spellbook](https://commanderspellbook.com/)'s "Find My Combos", because it
literally asks Commander Spellbook's public API about your deck.

## How it works

Static site, zero dependencies, no build step:

- `index.html` / `style.css` — the page.
- `parser.js` — decklist parsing (`DeckParser`). Understands plain names, `1x Card`,
  Moxfield/Arena exports (`1 Sol Ring (C21) 263 *F*`), `Commander:` / `Sideboard:`
  sections, MTGO `SB:` prefixes, and comments. Also runs under Node so it's unit-testable.
- `app.js` — reads the form, POSTs `{ commanders, main }` to
  `backend.commanderspellbook.com/find-my-combos`, renders the combos found
  (and the "one card away" near-misses).
- A Moxfield deck URL can be loaded directly (best effort — falls back to
  telling you to paste the export if Moxfield blocks the cross-origin request).

## Commands

```bash
# Unit tests (node:test, zero deps)
npm test

# Syntax-check everything (same as CI)
for f in $(git ls-files '*.js'); do node --check "$f"; done

# Run locally: it's a static page, any file server works
npx serve .   # or python3 -m http.server
```

## Deploying

`.github/workflows/deploy.yml` publishes the repo root to GitHub Pages on every push
to `main`. Note: GitHub Pages on a **private** repo requires a paid GitHub plan —
either make the repo public or run the page locally until then.

## Credits

All combo data and the combo search itself come from the amazing
[Commander Spellbook](https://commanderspellbook.com/) project.
