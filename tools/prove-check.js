#!/usr/bin/env node
// Break a check on purpose, watch it go red, and put the file back.
//
// "A check nobody has seen fail is a check nobody has seen work" is the oldest rule in
// CLAUDE.md and the one with no tooling behind it, so it is performed by hand every time:
// copy the file somewhere, patch it, run the check, grep for FAIL, copy it back. Four
// steps, and the last one is the one that matters — the fix being proved is usually still
// *uncommitted*, so a restore that silently does not happen loses the work and leaves a
// tree that looks finished. That is the failure this exists to make impossible.
//
// It also refuses three ways of proving nothing, none of which the manual version can
// notice — every one of them looks exactly like a successful demonstration:
//
//   - a break command that changed no bytes. The check then runs against the fixed tree
//     and passes, which reads as "the check is fine" when nothing was tested at all. This
//     is the likely outcome of a search string that no longer matches after a rewording.
//   - a break command that exited non-zero. It may have written something before it died,
//     so the bytes moved and the revert is half applied — a check run against that is
//     measuring a state nobody designed.
//   - a restore that did not verify byte for byte. Reported as a failure of THIS tool
//     rather than as a result, because the tree is now wrong and that outranks the answer.
//
// What it deliberately does not do is decide what "broken" means. The break is a shell
// command you write, because the inverse of a fix is a judgement — reverting one selector
// is a different claim from deleting the rule — and a tool that guessed would be proving
// its own guess.
//
// It cannot tell you the check was green *before* the break, either; that would mean
// running it twice and doubling the slowest thing in the repository. Run the check
// yourself first. A check that was already red goes red again here and this tool will
// happily call that a pass, which is the one hole in it.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

// The verdict, as data, so both branches are testable without running a browser: this
// file's whole reason to exist is the restore, and a bug in *it* would be invisible in
// exactly the way it exists to prevent.
//
// Order matters. A failed restore outranks everything — the result is worthless and the
// tree is wrong, and saying "proved" over a lost fix would be the worst thing it could
// print. Then "nothing changed", because a check that never met the break says nothing
// about the break. The check's own exit code is read last.
function verdict({ restored, brokeCleanly, changed, checkFailed }) {
  if (!restored) {
    return { ok: false, why: 'THE FILES WERE NOT RESTORED — the working tree is still broken. Restore it by hand before doing anything else.' };
  }
  // Before `changed`, because a break that errored halfway may well have written
  // something first: the bytes moved, so `changed` is true and would otherwise wave a
  // half-applied revert through as a real one.
  if (brokeCleanly === false) {
    return { ok: false, why: 'the break command exited non-zero, so what it left behind is unknown and the check was not run' };
  }
  if (!changed) {
    return { ok: false, why: 'the break command changed no bytes, so the check ran against the fixed tree and proved nothing' };
  }
  if (!checkFailed) {
    return { ok: false, why: 'the check passed with the fix reverted, so it is not watching what it claims to watch' };
  }
  return { ok: true, why: 'the check failed with the fix reverted and passed once it was back' };
}

function parseArgs(argv) {
  const out = { files: [], break: null, check: null };
  let key = null;
  for (const arg of argv) {
    if (arg === '--files') { key = 'files'; continue; }
    if (arg === '--break') { key = 'break'; continue; }
    if (arg === '--check') { key = 'check'; continue; }
    if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    if (key === 'files') out.files.push(arg);
    else if (key) { out[key] = arg; key = null; }
    else throw new Error(`stray argument ${JSON.stringify(arg)}`);
  }
  return out;
}

const USAGE = `usage: node tools/prove-check.js \\
    --files style.css \\
    --break "node -e \\"...patch the file...\\"" \\
    --check "npm run verify"

  --files   every file the break touches. Listed, never inferred: this is the restore
            list, and guessing what to put back is how work gets lost.
  --break   a shell command that undoes the fix. Yours to write — see the note at the
            top of this file for why it is not computed.
  --check   the check that must go red. Judged on its exit code.`;

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(String(err.message) + '\n\n' + USAGE);
    return 2;
  }
  if (!args.files.length || !args.break || !args.check) {
    console.error(USAGE);
    return 2;
  }

  for (const file of args.files) {
    if (!fs.existsSync(file)) {
      console.error(`prove-check: ${file} does not exist`);
      return 2;
    }
  }

  // Two copies of the truth: one in memory, which is what the restore writes back, and
  // one on disk, which is what somebody has to reach for if this process is killed
  // between the break and the restore. The on-disk copy is the whole reason a temp
  // directory is used at all — it is never read by this program.
  const snapshot = new Map(args.files.map((f) => [f, fs.readFileSync(f)]));
  const holding = fs.mkdtempSync(path.join(os.tmpdir(), 'prove-check-'));
  for (const [file, bytes] of snapshot) {
    fs.writeFileSync(path.join(holding, path.basename(file) + '.orig'), bytes);
  }
  console.log(`prove-check: held ${args.files.length} file(s) in ${holding}`);

  let changed = false;
  let brokeCleanly = true;
  let checkFailed = false;
  let checkOutput = '';
  try {
    try {
      execSync(args.break, { stdio: 'inherit' });
    } catch {
      // Not rethrown: the files still have to go back, and "your break command is wrong"
      // is a result this tool can report rather than a crash it should hand to the shell.
      brokeCleanly = false;
    }
    changed = args.files.some((f) => !fs.readFileSync(f).equals(snapshot.get(f)));

    if (brokeCleanly && changed) {
      try {
        checkOutput = execSync(args.check, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (err) {
        checkFailed = true;
        checkOutput = String((err.stdout || '') + (err.stderr || ''));
      }
    }
  } finally {
    // Unconditional, and before anything is reported. Every early return above this point
    // is before the first write, and everything after it is inside this block on purpose:
    // an exception thrown by the break command must not be able to leave a patched file
    // on disk.
    for (const [file, bytes] of snapshot) fs.writeFileSync(file, bytes);
  }

  const restored = args.files.every((f) => fs.readFileSync(f).equals(snapshot.get(f)));
  const result = verdict({ restored, brokeCleanly, changed, checkFailed });

  // The failure lines, not the whole run: a red `verify` prints one line per viewport and
  // the useful part is which of them went red and what they said. Silence here with an ok
  // verdict means the check failed without printing anything a reader could act on, which
  // is worth seeing.
  const failures = checkOutput.split('\n').filter((l) => /^(FAIL|not ok|\s*✘|.*Error:)/.test(l));
  if (failures.length) {
    console.log('\nprove-check: what went red\n' + failures.slice(0, 12).map((l) => '  ' + l.trim()).join('\n'));
  }

  if (result.ok) {
    fs.rmSync(holding, { recursive: true, force: true });
    console.log(`\nok   ${result.why}`);
    return 0;
  }
  console.error(`\nFAIL ${result.why}`);
  if (!restored) console.error(`prove-check: the originals are in ${holding}`);
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { verdict, parseArgs, main };
