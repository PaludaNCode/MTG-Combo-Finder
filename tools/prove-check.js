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
// A fourth refusal is opt-in, because it needs something only the operator knows: with
// `--expect <regex>` the failing output has to *say* the expected thing. Without it this
// tool reads an exit code and nothing else, so a check reddened by an unrelated break —
// the exact mistake the ritual exists to catch — reads as a successful demonstration.
// Pass it whenever the expected failure has a number or a phrase in it, which is almost
// always. It was left out of the first version and the gap was covered by prose telling
// the reader to eyeball the output, which is the shape of every rule here that broke.
//
// It cannot tell you the check was green *before* the break; that would mean running it
// twice and doubling the slowest thing in the repository. Run the check yourself first.
// A check that was already red goes red again here and this tool will happily call that
// a pass, which is the hole `--expect` narrows and does not close.
//
// A fifth refusal watches the rest of the tree. `--files` is the restore list and is
// deliberately explicit, so a break command that touches anything *not* on it leaves that
// behind — and the run reported `ok` regardless, which is the quiet-failure-that-looks-like
// -success this whole file exists to prevent, wearing its own name. `git status --porcelain`
// is read either side of the run and any path that moved and is not on the list fails the
// run. It is a comparison and not a snapshot of the world: a tree that was already dirty
// stays dirty and says nothing, because the question is what THIS run changed.
//
// And a sixth reads the signals: a run interrupted with Ctrl-C is not a run that proved
// anything, however its check exited. That one arrived with the SIGINT handling below and
// is explained where it is decided, in verdict().
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync, execFileSync } = require('node:child_process');

// The verdict, as data, so both branches are testable without running a browser: this
// file's whole reason to exist is the restore, and a bug in *it* would be invisible in
// exactly the way it exists to prevent.
//
// Order matters. A failed restore outranks everything — the result is worthless and the
// tree is wrong, and saying "proved" over a lost fix would be the worst thing it could
// print. Then "nothing changed", because a check that never met the break says nothing
// about the break. The check's own exit code is read last.
function verdict({ restored, strayed, interrupted, brokeCleanly, changed, checkFailed, expected, matched }) {
  if (!restored) {
    return { ok: false, why: 'THE FILES WERE NOT RESTORED — the working tree is still broken. Restore it by hand before doing anything else.' };
  }
  // Second, for the same reason the first is first: the tree is wrong, and that outranks
  // whatever the check said. `strayed` is a list of paths, `null` is "not compared" — a
  // distinction kept because a run outside a git tree must not report a clean comparison
  // it never made. Absent is not empty.
  if (strayed && strayed.length) {
    return {
      ok: false,
      why: `the break command moved ${strayed.length} path(s) that are not in --files, so they were never put back: `
        + strayed.join(', ') + '. Restore them by hand, then add them to --files.',
    };
  }
  // Before every judgement about the check, because an interrupted run has no answer to
  // judge. This is the trap the SIGINT handler opened rather than closed: catching the
  // signal stops it killing this process, so the tree comes back — and a check killed by
  // that same signal exits non-zero, which is indistinguishable from the check going red
  // on its own. Measured: with the handler and without this branch, Ctrl-C during a run
  // printed `ok   the check failed with the fix reverted and passed once it was back`.
  // A tool that says "proved" over a run somebody abandoned is worse than one that dies.
  if (interrupted) {
    return { ok: false, why: `the run was interrupted (${interrupted}) — the files are back, but nothing was proved` };
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
  // Last, because it only refines a failure that already happened — but it is the
  // difference between "something went red" and "the right thing went red", which is
  // the mistake the whole ritual exists to catch. Without --expect this tool reads an
  // exit code and nothing else, so a check reddened by an unrelated break passes.
  if (expected && !matched) {
    return { ok: false, why: `the check failed, but nothing in its output matched ${JSON.stringify(expected)} — it may have gone red for an unrelated reason` };
  }
  return {
    ok: true,
    why: expected
      ? `the check failed with the fix reverted, said ${JSON.stringify(expected)}, and passed once it was back`
      : 'the check failed with the fix reverted and passed once it was back',
  };
}

// The working tree as git sees it: `{ root, paths }`, or null when git did not answer.
//
// Null rather than an empty object, and the difference is load-bearing — "no path is
// dirty" and "nothing was asked" are the same shape and opposite claims, and reporting
// the second as the first is how this tool would grow the exact blind spot it was
// extended to close.
//
// Renames are split into their two halves (`R  old -> new`) because either half being
// left behind is the failure, and a path is quoted by git only when it contains
// something exotic — kept as it comes rather than unquoted, since a stray path is being
// printed for a person to act on, not opened.
//
// The status letters alone are not enough, and the gap is the realistic one rather than
// an exotic one: a file already modified before the run reads ` M` both times, so a break
// command that edits it *further* moves nothing this could see. So each dirty path carries
// a hash of its bytes as well. Only the paths git already named are hashed — a clean file
// the break touches appears out of nowhere and is caught by the letters — which keeps this
// to a handful of files rather than a walk of the tree.
function gitStatus(cwd) {
  const at = cwd || process.cwd();
  try {
    const git = (args) => execFileSync('git', args, { cwd: at, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const root = git(['rev-parse', '--show-toplevel']).trim();
    const paths = {};
    for (const line of git(['status', '--porcelain']).split('\n')) {
      if (!line.trim()) continue;
      const code = line.slice(0, 2);
      for (const p of line.slice(3).split(' -> ')) {
        const rel = p.trim();
        paths[rel] = code + ':' + fingerprint(path.join(root, rel));
      }
    }
    return { root, paths };
  } catch {
    // A missing git, a directory outside a repository, a git that errored: all one case
    // here, and all of them "not compared".
    return null;
  }
}

// A file's bytes, as a short string. `absent` for a path that is not there, which is a
// state a porcelain line can legitimately describe (a deletion) and must not read as an
// unreadable file.
function fingerprint(file) {
  try {
    return require('node:crypto').createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
  } catch {
    return 'absent';
  }
}

// Which paths this run moved and never put back. Pure, because it is the decision — and
// a decision inside the `try` of a tool nobody watches is a decision nobody tests.
function strayPaths(before, after, files, root, cwd) {
  if (!before || !after) return null;
  // The restore list, as git spells paths: repo-relative, forward slashes. A file given
  // as `style.css` from the root and one given as `./style.css` from a subdirectory are
  // the same path to this tool and must be the same string here.
  const restored = new Set((files || []).map(
    (f) => path.relative(root, path.resolve(cwd || process.cwd(), f)).split(path.sep).join('/')
  ));
  const stray = [];
  for (const p of new Set([...Object.keys(before.paths), ...Object.keys(after.paths)])) {
    if (restored.has(p)) continue;
    if (before.paths[p] !== after.paths[p]) stray.push(p);
  }
  return stray.sort();
}

function parseArgs(argv) {
  const out = { files: [], break: null, check: null, expect: null };
  let key = null;
  for (const arg of argv) {
    if (arg === '--files') { key = 'files'; continue; }
    if (arg === '--break') { key = 'break'; continue; }
    if (arg === '--check') { key = 'check'; continue; }
    if (arg === '--expect') { key = 'expect'; continue; }
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
  --check   the check that must go red. Judged on its exit code.
  --expect  a regex the failing output must contain. Optional, and the only thing that
            tells "the right check went red" from "something went red" -- without it an
            unrelated failure reads as a successful demonstration.`;

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

  // Read before the break, compared after the restore: what this run left behind outside
  // the restore list.
  const treeBefore = gitStatus();

  const restoreAll = () => { for (const [file, bytes] of snapshot) fs.writeFileSync(file, bytes); };

  // Ctrl-C, which until now took the tree with it. Measured on the real tool before this
  // existed: with no listener registered node is terminated *by* the signal — not exited —
  // so the `finally` below never ran and the patched file stayed on disk. Both ways round,
  // the signal sent to this process alone and to the whole group: `signal=SIGINT`, subject
  // file still broken. "Can leave a broken tree" was the generous reading; it always did.
  //
  // What registering a listener buys is that the signal stops being fatal, so the restore
  // happens — either here or in the `finally` a moment later. What it cannot buy is
  // promptness: `execSync` blocks the event loop, so while the check is running node
  // cannot reach this function at all. In a terminal that costs nothing, because Ctrl-C
  // goes to the process group and kills the check too, which unblocks the loop; sent to
  // this pid alone it waits for the check to finish. Both restore.
  //
  // The uncovered case, named rather than papered over: `kill -INT` aimed at THIS pid only.
  // The check survives it, finishes, and its own result is reported — a run somebody asked
  // to stop, reported as a result. There is no synchronous way to ask node whether a signal
  // is pending, so nothing here can see it; Ctrl-C in a terminal is the group case above and
  // is the one this was written for. Measured both ways in the same probe.
  const onSigint = () => {
    restoreAll();
    console.error(`\nprove-check: interrupted — put ${args.files.length} file(s) back. Originals also in ${holding}`);
    process.exit(130);
  };
  process.on('SIGINT', onSigint);

  let changed = false;
  let brokeCleanly = true;
  let checkFailed = false;
  let checkOutput = '';
  // The signal that killed a child, if one did. A child dies from Ctrl-C because the
  // terminal sends it to the whole process group, and this is the only trace of it left
  // by the time the verdict is taken: node cannot run the handler above while `execSync`
  // holds the event loop, so the run reaches its report as though the check had simply
  // failed. See the branch in verdict() that reads this.
  let interrupted = null;
  const signalOf = (err) => {
    if (!err) return null;
    if (err.signal) return err.signal;
    // A child that died from a signal reports a null status. Named rather than treated as
    // an exit code, because "no code at all" is the distinction that matters here.
    return err.status === null ? 'killed' : null;
  };
  try {
    try {
      execSync(args.break, { stdio: 'inherit' });
    } catch (err) {
      // Not rethrown: the files still have to go back, and "your break command is wrong"
      // is a result this tool can report rather than a crash it should hand to the shell.
      brokeCleanly = false;
      interrupted = signalOf(err);
    }
    changed = args.files.some((f) => !fs.readFileSync(f).equals(snapshot.get(f)));

    if (brokeCleanly && changed) {
      try {
        checkOutput = execSync(args.check, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (err) {
        checkFailed = true;
        checkOutput = String((err.stdout || '') + (err.stderr || ''));
        interrupted = signalOf(err);
      }
    }
  } finally {
    // Unconditional, and before anything is reported. Every early return above this point
    // is before the first write, and everything after it is inside this block on purpose:
    // an exception thrown by the break command must not be able to leave a patched file
    // on disk.
    restoreAll();
    // Removed here rather than left to process exit, because main() is called many times
    // in one process by the tests: a listener per call leaks, and node warns about it at
    // eleven, which is a warning nobody would read as this.
    process.off('SIGINT', onSigint);
  }

  const restored = args.files.every((f) => fs.readFileSync(f).equals(snapshot.get(f)));
  // After the restore, so a file that was put back correctly is not reported as strayed.
  const strayed = strayPaths(treeBefore, gitStatus(), args.files, treeBefore && treeBefore.root);
  if (strayed === null) {
    // Said out loud, because the alternative is a run that quietly checked less than the
    // reader thinks it did — this tool's own subject matter.
    console.log('prove-check: the working tree was not compared — git did not answer, so only --files was watched');
  }
  // Built here rather than in verdict(), which stays pure data in and verdict out: a
  // bad regex is an operator mistake and should say so, not be swallowed as "no match".
  let matched = false;
  if (args.expect) {
    let re;
    try {
      re = new RegExp(args.expect);
    } catch (err) {
      console.error(`prove-check: --expect is not a valid regex: ${err.message}`);
      return 2;
    }
    matched = re.test(checkOutput);
  }
  const result = verdict({ restored, strayed, interrupted, brokeCleanly, changed, checkFailed, expected: args.expect, matched });

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

module.exports = { verdict, parseArgs, main, gitStatus, strayPaths };
