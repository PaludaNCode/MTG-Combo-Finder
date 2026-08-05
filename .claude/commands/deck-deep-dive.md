---
description: Deep-dive the cards carrying a deck — rank them by combo weight, sweep the ones nobody has, add any rows found, and log the pass
argument-hint: "[deck.txt] [how-many-cards]"
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, WebSearch, WebFetch
---

Deep-dive the cards that carry a deck's combos, in the order that finds the most.

**Deck:** `$1` — if empty, use `test/fixtures/chatterfang-deck.txt`.
**How many cards:** `$2` — if empty, do the top **3** unswept.

Read `CLAUDE.md` § *Researching a card, and recording that you did* first. It is the
process; this command is that process pointed at one deck. Do not re-derive it.

## 1. Pick the subjects

```bash
node tools/deck-cards.js <deck> --unswept --top 15
```

Ranked by how many published combos name the card, because that is what the
substitution method consumes — a card in 6,000 combos has 6,000 chances to be missing
from one. `played` is beside it; where the two disagree, say so and choose deliberately.

Take the top N unswept. **Check `research-log.js` before starting** — if a card is
already there, skip it and take the next, and say which you skipped.

Read the tool's *"in no published combo"* list too. Those cards cannot be proposed by
any amount of comparing data, so if one is obviously a combo piece, that is the one
worth reading by hand — it is the case `unofficial.js` exists for.

## 2. Sweep each subject

**Reading a card costs nothing now.** `card-text.json` holds every card, so
`node tools/lookup-card.js "Name"` answers from disk with no request and no workflow
dispatch — there is no reason left to ration lookups, and a pass that guesses at a card
to save a round trip is saving nothing. A name that misses is a card published since the
last sweep; re-sweep from a branch rather than reaching for the network.

Per `CLAUDE.md`, in this order. It was ordered to avoid wasted *reading* and survives for
a different reason: **reading is the cheap half, deciding what to read is the expensive
one.**

1. **Peers from card text, not from a score.** This is the step that costs most when
   skipped. Stridehangar Automaton scored as Chatterfang's closest peer and is not one
   — it reads only *artifact* tokens — and that one fact ruled out 1,197 of 1,202
   candidates. Read the oracle text — `node tools/lookup-card.js "Name"` — and say what
   the peer relationship *is* before using it. No amount of free lookups substitutes for
   getting this judgement right.
2. Every shape a peer is published in and the subject is not.
3. **Drop the subsumed** — if the subject already has a combo whose cards are a subset,
   the candidate is a strict superset and Spellbook does not publish those.
4. Drop what is already published and what is already a row in `unofficial.js`.
5. **Read the survivors against the published steps** of the peer's version. They say
   what the loop actually does. Fetch them from the `steps/` tree via
   `StepsSource.pathFor(id)` on the data branch.

Expect most passes to find little. Rosie kept 20 of 25; Chatterfang kept 5 of 1,202.
**A pass that finds nothing is a successful pass** and still gets logged — that is the
whole point of the log.

## 3. Write what survived

Rows go in `unofficial.js`. Every row: `cards`, `confidence`, `from` (the published
combo id and its exact card list), `swap` with **`inId`** (the Spellbook card id of the
card swapped in, or `null` asserting the data has no such card), `why`, `produces`.

- `verified` = you read both cards. `derived` = both halves are published and you
  reasoned the pairing. **Use `derived` rather than reading loosely and claiming
  `verified`.**
- Prefer citing a peer whose effect *matches* the subject's, not the most popular one.
  Rosie's nine cite Mighty Mutanimals over Cathars' Crusade because Mutanimals puts one
  counter on one target creature — her sentence — where Cathars' counters the board and
  would drag in a result she does not produce.
- Generate rows from live data rather than transcribing ids by hand.

## 4. Log the pass — not optional

Add an entry to `research-log.js` per subject: `subject`, `cards`, `cardIds`, `date`,
`method`, `proposed`, `examined`, `kept`, `ruledOut`, `notes`.

`proposed` and `examined` differ whenever a rule-out is mechanical — record both. Give
every rule-out a **reason**; give a count only where you actually counted. The rule-outs
are the valuable part: the oldest audit in the README is more useful for the 35 it
ruled out than for what survived.

## 5. Check, then report

```bash
npm test && npm run lint && npm run check:readme && npm run verify
node tools/verify-unofficial.js
```

`check:readme` will fail if rows were added — the counts in the README are real
measurements. Update the prose it names, including the candidate total, which is read
out of `research-log.js`.

Then report: **which cards were swept, what was kept, and what was ruled out and why.**
Lead with the rule-outs where they are more interesting than the survivors. Give the
before/after row count. Do not commit, push, or deploy unless asked.
