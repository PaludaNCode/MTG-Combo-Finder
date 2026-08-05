'use strict';
// Every "README § X" and 'CLAUDE.md, "X"' points at a heading that exists.
//
// These two files are wired together by name. CLAUDE.md is the index and says `README § X` when the
// reasoning lives over there; the README and the tools point back at CLAUDE.md sections the same way.
// **A pointer at a heading that no longer exists is worse than no pointer**: it reads as authoritative,
// it sends the reader nowhere, and nothing about it looks wrong.
//
// It is checked because it happened. Renaming CLAUDE.md's "The designated branch after its PR merges:
// prune, never force" to drop the ", prune, never force" left `.githooks/pre-push` citing the old
// title — inside the error message the hook prints, which is the one moment somebody is actually
// following the pointer. `tools/check-readme-numbers.js` already refuses to let a reworded anchor pass
// silently for the same reason; this is that idea applied to headings across files.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// `##` through `####`. `#` is the document title and nothing points at it.
function headings(markdown) {
  return markdown.split('\n')
    .map((line) => /^#{2,4}\s+(.*?)\s*$/.exec(line))
    .filter(Boolean)
    .map((m) => m[1].replace(/[*`]/g, '').trim());
}

// A pointer resolves if a heading equals it, or contains it — headings carry punctuation and asides
// ("Sweeping every card, and why a sweep can run twice") that a reference reasonably shortens.
const resolves = (ref, hs) => hs.some((h) => h === ref || h.includes(ref));

// Every tracked text file, because a pointer in a tool's error message matters more than one in prose
// — and `.githooks/pre-push`, which has no extension, is exactly that file. The first version of this
// filter matched on extension alone and silently skipped the one pointer that had actually broken.
function textFiles() {
  return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((f) => /\.(md|js|sh|yml|html|css)$/.test(f) || f.startsWith('.githooks/'))
    .filter((f) => !f.startsWith('test/fixtures/'));
}

// Only the code spans that *are* the notation get neutralised, and the distinction matters twice over.
//
// CLAUDE.md explains the convention using it — "`README § X` means read that section" — and the
// closing-report section says "(a `README §`, an issue number)". Neither points at a heading, and both
// matched, so a naive scan reports two failures nobody can fix, which is a check somebody switches off.
//
// But blanking *every* code span was worse and its own bug: the heading "A fresh session's `main` is
// realigned…" is referenced with the backticks in place, and deleting the span deleted the word, so a
// pointer that resolves perfectly well was reported broken. So a span mentioning the notation is
// blanked and every other span keeps its text.
const withoutCode = (text) => text.replace(
  /`[^`\n]*`/g,
  (span) => (/README\s*§|CLAUDE\.md/.test(span) ? '``' : span.replace(/`/g, '')),
);

// `README § *Title*` — the form CLAUDE.md uses throughout. The § is required, which is what keeps this
// from matching ordinary prose that happens to mention the file.
const README_REF = /README\s*§\s*\*?([^*\n.]{6,80}?)\*?\s*(?=[.,\n]|$)/g;
// `CLAUDE.md § *Title*` or `CLAUDE.md, "Title"` — both appear.
const CLAUDE_REF = /CLAUDE\.md(?:\s*§\s*\*?([^*\n.]{6,80}?)\*?\s*(?=[.,\n]|$)|,\s*"([^"\n]{6,80})")/g;

function pointers() {
  const found = [];
  for (const file of textFiles()) {
    const text = withoutCode(read(file));
    for (const m of text.matchAll(README_REF)) found.push({ file, target: 'README.md', ref: m[1] });
    for (const m of text.matchAll(CLAUDE_REF)) {
      found.push({ file, target: 'CLAUDE.md', ref: (m[1] || m[2]) });
    }
  }
  return found.map((p) => ({ ...p, ref: String(p.ref).replace(/[*`]/g, '').trim() }));
}

test('every cross-file section pointer names a heading that exists', () => {
  const hs = { 'README.md': headings(read('README.md')), 'CLAUDE.md': headings(read('CLAUDE.md')) };
  const broken = pointers().filter((p) => !resolves(p.ref, hs[p.target]));
  assert.deepStrictEqual(
    broken.map((p) => `${p.file} → ${p.target} § "${p.ref}"`), [],
    'a pointer at a heading that does not exist reads as authoritative and goes nowhere',
  );
});

test('there are pointers to check, so an empty scan cannot pass for a clean one', () => {
  // The failure this repository keeps writing down: a check that matches nothing reports success for
  // work it did not do. If a regex change silently stops finding references, this reddens.
  const found = pointers();
  assert.ok(found.length >= 12, `only ${found.length} pointers found — the scan has probably stopped working`);
  assert.ok(found.some((p) => p.target === 'CLAUDE.md'), 'no CLAUDE.md pointers found at all');
  assert.ok(found.some((p) => p.target === 'README.md'), 'no README pointers found at all');
  // And the hook's message is one of them, since that is the pointer that broke.
  assert.ok(found.some((p) => p.file === '.githooks/pre-push'), "the hook's pointer is not being scanned");
});
