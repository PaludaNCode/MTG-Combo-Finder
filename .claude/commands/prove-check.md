---
description: Break a check on purpose, watch it go red, and put the file back — the ritual behind "a check nobody has seen fail is a check nobody has seen work"
argument-hint: "[what you just added a check for]"
allowed-tools: Bash, Read, Grep, Glob
---

Prove the check you just wrote actually watches something: `$1`.

`CLAUDE.md` § *Tests, and what a tool says about itself* is the rule — **a check nobody has
seen fail is a check nobody has seen work**, and every entry in that section once passed
while measuring nothing. This command is that rule performed rather than remembered.

## Before you start

**Run the check and see it green.** This command cannot do it for you: proving a check twice
means running the slowest thing in the repository twice, and `verify` is ~20s. A check that
was *already* red goes red again under the break and `prove-check` will call that a pass.
That is the one hole in it.

## 1. Decide what "reverted" means

Write the smallest edit that undoes the fix and nothing else. This is a judgement and it is
why the tool does not compute it: putting one selector back is a different claim from
deleting the whole rule, and a break that deletes too much passes for the wrong reason.

Prefer a string replacement over a line number — line numbers move under you.

## 2. Run it

```bash
npm run prove -- \
  --files style.css \
  --break "node -e \"const f='style.css',s=require('fs').readFileSync(f,'utf8');require('fs').writeFileSync(f,s.replace('FIXED','BROKEN'))\"" \
  --check "npm run verify"
```

- `--files` is the **restore list**. Every file the break touches goes here, listed rather
  than inferred — guessing what to put back is how uncommitted work gets lost.
- The tool holds a copy on disk as well as in memory, restores in a `finally`, and verifies
  the restore byte for byte before it reports anything.

It refuses three things that all look like a successful demonstration: a break that changed
no bytes (usually a search string that stopped matching), a break command that exited
non-zero (half applied, so the check measured a state nobody designed), and a restore that
did not verify.

## 3. Read what went red

The tool prints the failure lines. **Check they are the right ones.** A check going red for
an unrelated reason is the failure mode this whole ritual exists to catch, and the tool
cannot tell one FAIL from another — it only knows the exit code.

Name the numbers in your report: *"reverted, `verify` reports 170px at 390px and 48px at
768px, and stays green at 1440"*. The viewport that stayed green is worth saying out loud —
it is usually the reason the bug shipped.

## 4. If it did not go red

The check is not watching what it claims to. Common causes, in the order they have actually
happened here:

- **It measures the page at rest.** A control that opens something has to be *opened*
  before anything is measured. Every rect inside a closed `<details>` is 0 and every
  assertion about it passes.
- **A dispatched event is not the gesture.** `element.click()` moves no focus, so anything
  keyed on `:focus`, `:focus-within` or `:hover` is untouched by it. That is a Playwright
  job, not a `verify` one.
- **It is pinned to the first row** rather than to the shape it needs, and the first row
  changed.
- **The selector matches nothing**, which reports success for work it did not do.
