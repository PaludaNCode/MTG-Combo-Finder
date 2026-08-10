'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { execFileSync, spawn } = require('node:child_process');

const { verdict, parseArgs, main, gitStatus, strayPaths } = require('../tools/prove-check.js');

// tools/prove-check.js exists to make one mistake impossible — a fix reverted for a
// demonstration and never put back — so the thing worth testing hardest is the restore,
// including on the paths where the demonstration itself blew up. A bug here would be
// invisible in exactly the way this tool exists to prevent: the tree looks finished, the
// check is green, and the fix is gone.

test('a failed restore outranks every other verdict', () => {
  // Including the one that would otherwise read as success. "Proved" printed over a lost
  // fix is the worst thing this tool could say.
  assert.equal(verdict({ restored: false, changed: true, checkFailed: true }).ok, false);
  assert.match(verdict({ restored: false, changed: true, checkFailed: true }).why, /NOT RESTORED/);
});

test('a path moved outside --files fails the run, and outranks the answer', () => {
  // Second only to a failed restore, and for the same reason: the tree is not what it was.
  // `checkFailed: true` here, so this is the verdict that would otherwise have read
  // "proved" over a file the tool silently left patched.
  const v = verdict({ restored: true, strayed: ['style.css'], changed: true, checkFailed: true });
  assert.equal(v.ok, false);
  assert.match(v.why, /style\.css/);
  assert.match(v.why, /not in --files/);
});

test('not comparing the tree is not the same as comparing it clean', () => {
  // `null` is "git did not answer" and must never read as "nothing strayed". The run is
  // allowed to pass — the restore list was still watched — but only this shape does.
  assert.equal(verdict({ restored: true, strayed: null, changed: true, checkFailed: true }).ok, true);
  assert.equal(verdict({ restored: true, strayed: [], changed: true, checkFailed: true }).ok, true);
});

test('an interrupted run is not a proved one', () => {
  // The trap the SIGINT handler opened: catching the signal keeps this process alive to
  // restore, and the check — killed by the same Ctrl-C, because the terminal sends it to
  // the whole group — exits non-zero, which is exactly what a check going red looks like.
  // Before this branch existed the measured output was `ok   the check failed with the fix
  // reverted`. Ahead of brokeCleanly too, since an interrupted break is not a wrong break.
  const v = verdict({ restored: true, interrupted: 'SIGINT', changed: true, checkFailed: true });
  assert.equal(v.ok, false);
  assert.match(v.why, /interrupted \(SIGINT\)/);
  assert.match(v.why, /nothing was proved/);
  assert.equal(verdict({ restored: true, interrupted: 'SIGINT', brokeCleanly: false, changed: true }).ok, false);
});

test('a break that changed nothing proves nothing', () => {
  // The likely shape of it: a search string that stopped matching after a rewording, so
  // the check runs against the fixed tree and passes. Green, and about nothing.
  const v = verdict({ restored: true, changed: false, checkFailed: false });
  assert.equal(v.ok, false);
  assert.match(v.why, /changed no bytes/);
});

test('a break that exited non-zero is refused before its bytes are believed', () => {
  // `changed: true` and it still fails: a break command that died halfway may have
  // written something first, so the revert is half applied and the check would be
  // measuring a state nobody designed. This ordering is the whole point of the case.
  const v = verdict({ restored: true, brokeCleanly: false, changed: true, checkFailed: true });
  assert.equal(v.ok, false);
  assert.match(v.why, /exited non-zero/);
});

test('a check that survives the break is the failure being looked for', () => {
  const v = verdict({ restored: true, changed: true, checkFailed: false });
  assert.equal(v.ok, false);
  assert.match(v.why, /not watching what it claims/);
});

test('red on the break and restored is the only pass', () => {
  assert.equal(verdict({ restored: true, changed: true, checkFailed: true }).ok, true);
});

test('a failure that does not say the expected thing is refused', () => {
  // The hole the exit code alone leaves: something went red, and this is the only way
  // to know it was the right something.
  const v = verdict({ restored: true, brokeCleanly: true, changed: true, checkFailed: true, expected: '170px', matched: false });
  assert.equal(v.ok, false);
  assert.match(v.why, /unrelated reason/);
});

test('a failure that says the expected thing passes, and says so', () => {
  const v = verdict({ restored: true, brokeCleanly: true, changed: true, checkFailed: true, expected: '170px', matched: true });
  assert.equal(v.ok, true);
  assert.match(v.why, /170px/);
});

test('--expect is optional and its absence never fails a run', () => {
  // `expected: null, matched: false` is the no-flag case, and it must not read as an
  // unmatched expectation.
  assert.equal(verdict({ restored: true, brokeCleanly: true, changed: true, checkFailed: true, expected: null, matched: false }).ok, true);
});

test('the files list is collected, and a stray argument is refused', () => {
  const args = parseArgs(['--files', 'a.css', 'b.js', '--break', 'x', '--check', 'y', '--expect', 'z']);
  assert.deepEqual(args.files, ['a.css', 'b.js']);
  assert.equal(args.break, 'x');
  assert.equal(args.check, 'y');
  assert.equal(args.expect, 'z');
  // Not a warning. A misspelled option that silently dropped the file list would mean
  // nothing gets restored.
  assert.throws(() => parseArgs(['--flies', 'a.css']), /unknown option/);
  assert.throws(() => parseArgs(['a.css']), /stray argument/);
});

// The end to end shape, against a scratch file rather than the real stylesheet: the point
// is the bytes on disk afterwards.
function withScratch(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prove-check-test-'));
  const file = path.join(dir, 'subject.txt');
  fs.writeFileSync(file, 'FIXED\n');
  try {
    return body(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('the file comes back byte for byte after a run that went red', () => {
  withScratch((file) => {
    const code = main([
      '--files', file,
      '--break', `node -e "require('fs').writeFileSync(process.argv[1],'BROKEN\\n')" ${file}`,
      // Reads the file the break just wrote and fails on it, which is what a real check
      // does; `exit 1` alone would pass this test against a tool that never wrote anything.
      '--check', `node -e "process.exit(require('fs').readFileSync(process.argv[1],'utf8').includes('BROKEN')?1:0)" ${file}`,
    ]);
    assert.equal(code, 0);
    assert.equal(fs.readFileSync(file, 'utf8'), 'FIXED\n');
  });
});

test('the file comes back even when the break command itself fails', () => {
  withScratch((file) => {
    // Half a break: it writes, then exits non-zero. The restore is in a finally for this
    // case exactly — an exception must not be able to leave a patched file on disk.
    const code = main([
      '--files', file,
      '--break', `node -e "require('fs').writeFileSync(process.argv[1],'BROKEN\\n');process.exit(3)" ${file}`,
      '--check', 'true',
    ]);
    assert.notEqual(code, 0);
    assert.equal(fs.readFileSync(file, 'utf8'), 'FIXED\n');
  });
});

test('a check that stays green with the fix reverted is reported as a failure', () => {
  withScratch((file) => {
    const code = main([
      '--files', file,
      '--break', `node -e "require('fs').writeFileSync(process.argv[1],'BROKEN\\n')" ${file}`,
      '--check', 'true',
    ]);
    assert.equal(code, 1);
    assert.equal(fs.readFileSync(file, 'utf8'), 'FIXED\n');
  });
});

test('a missing file is refused before anything is written', () => {
  assert.equal(main(['--files', 'no/such/file.css', '--break', 'true', '--check', 'true']), 2);
});

test('--expect is matched against the real output, end to end', () => {
  withScratch((file) => {
    const args = (expected) => [
      '--files', file,
      '--break', `node -e "require('fs').writeFileSync(process.argv[1],'BROKEN\\n')" ${file}`,
      // Prints a recognisable line and fails, the way a real check does.
      '--check', `node -e "console.log('FAIL the list starts 540px in');process.exit(1)"`,
      '--expect', expected,
    ];
    assert.equal(main(args('540px')), 0, 'a matching expectation passes');
    assert.equal(main(args('170px')), 1, 'a failure about something else is refused');
    assert.equal(fs.readFileSync(file, 'utf8'), 'FIXED\n');
  });
});

// The tree comparison, against a real git repository rather than a stub: the decision is
// pure and tested below, but the *wiring* is the half that would silently not happen —
// which is this file's whole subject.
function withRepo(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prove-check-repo-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  fs.writeFileSync(path.join(dir, 'subject.txt'), 'FIXED\n');
  fs.writeFileSync(path.join(dir, 'bystander.txt'), 'UNTOUCHED\n');
  git('add', '-A');
  git('commit', '-qm', 'first');
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    return body(dir);
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('a break that edits a file outside --files fails the run and says which', () => {
  withRepo(() => {
    const code = main([
      '--files', 'subject.txt',
      // Two files patched, one of them not on the restore list — the shape of a break
      // command that reverts a fix and a fixture together, or a `sed -i` with a wider
      // glob than intended.
      '--break', `node -e "const f=require('fs');f.writeFileSync('subject.txt','BROKEN\\n');f.writeFileSync('bystander.txt','ALSO BROKEN\\n')"`,
      '--check', 'false',
    ]);
    assert.equal(code, 1);
    // The listed file goes back, as always…
    assert.equal(fs.readFileSync('subject.txt', 'utf8'), 'FIXED\n');
    // …and the one that did not is still wrong, which is exactly why the run must not
    // report success. The tool does not guess at putting it back: that is the rule
    // --files exists to enforce.
    assert.equal(fs.readFileSync('bystander.txt', 'utf8'), 'ALSO BROKEN\n');
  });
});

test('a run that touches only --files is not reported as straying', () => {
  withRepo(() => {
    const code = main([
      '--files', 'subject.txt',
      '--break', `node -e "require('fs').writeFileSync('subject.txt','BROKEN\\n')"`,
      '--check', `node -e "process.exit(require('fs').readFileSync('subject.txt','utf8').includes('BROKEN')?1:0)"`,
    ]);
    assert.equal(code, 0, 'the guard must not redden an honest run');
  });
});

test('a file already dirty before the run, and edited further by the break, is caught', () => {
  withRepo(() => {
    // The hole the status letters alone leave: ` M` before and ` M` after, so nothing
    // moved as far as `git status` is concerned. This is why each dirty path carries a
    // hash of its bytes.
    fs.writeFileSync('bystander.txt', 'ALREADY EDITED\n');
    const code = main([
      '--files', 'subject.txt',
      '--break', `node -e "const f=require('fs');f.writeFileSync('subject.txt','BROKEN\\n');f.writeFileSync('bystander.txt','EDITED AGAIN\\n')"`,
      '--check', 'false',
    ]);
    assert.equal(code, 1);
  });
});

test('a tree left as it was found passes even when it was dirty to begin with', () => {
  withRepo(() => {
    // The comparison is what this run changed, never how clean the tree is: somebody
    // proving a check mid-change has every other file modified, and that is the normal
    // case rather than an edge one.
    fs.writeFileSync('bystander.txt', 'ALREADY EDITED\n');
    const code = main([
      '--files', 'subject.txt',
      '--break', `node -e "require('fs').writeFileSync('subject.txt','BROKEN\\n')"`,
      '--check', 'false',
    ]);
    assert.equal(code, 0);
    assert.equal(fs.readFileSync('bystander.txt', 'utf8'), 'ALREADY EDITED\n');
  });
});

test('strayPaths compares what moved, not what is dirty', () => {
  const before = { root: '/repo', paths: { 'a.js': ' M:aaa', 'b.js': ' M:bbb' } };
  const after = { root: '/repo', paths: { 'a.js': ' M:aaa', 'b.js': ' M:ZZZ', 'c.js': '??:ccc' } };
  // b.js changed under the same status letters, c.js appeared, a.js was dirty throughout
  // and is not this run's business.
  assert.deepEqual(strayPaths(before, after, [], '/repo', '/repo'), ['b.js', 'c.js']);
  // …and a path on the restore list is never a stray, however it moved.
  assert.deepEqual(strayPaths(before, after, ['b.js'], '/repo', '/repo'), ['c.js']);
  // A file named from a subdirectory is the same path as the one git prints.
  assert.deepEqual(strayPaths(before, after, ['../b.js'], '/repo', '/repo/tools'), ['c.js']);
  // Not compared is null, at both ends, and never an empty list.
  assert.equal(strayPaths(null, after, [], '/repo', '/repo'), null);
  assert.equal(strayPaths(before, null, [], '/repo', '/repo'), null);
});

test('gitStatus answers null outside a repository rather than reporting a clean tree', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prove-check-bare-'));
  try {
    // os.tmpdir() is not inside this checkout, so there is nothing to find. If this ever
    // starts returning an object, the "not compared" branch stops being reachable and
    // every run outside a repo silently claims a clean comparison.
    assert.equal(gitStatus(dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the SIGINT listener does not outlive the run', () => {
  // main() is called a dozen times by this file alone. A listener per call leaks, and the
  // only warning is node's own at eleven, which nobody would read as this.
  const before = process.listenerCount('SIGINT');
  withScratch((file) => {
    main([
      '--files', file,
      '--break', `node -e "require('fs').writeFileSync(process.argv[1],'BROKEN\\n')" ${file}`,
      '--check', 'false',
    ]);
  });
  assert.equal(process.listenerCount('SIGINT'), before);
});

// Ctrl-C, driven for real. The tool is spawned in its own process group and the group is
// signalled once the break has landed, which is what a terminal does — and what makes the
// check die alongside the tool, the detail the verdict has to survive.
//
// Measured before any of this existed: node is *terminated by* SIGINT when no listener is
// registered, so the `finally` never ran and the patched file stayed on disk. Both this
// test and that measurement are the reason the handler is not just belt and braces.
test('Ctrl-C puts the file back and reports that nothing was proved', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prove-check-sigint-'));
  const file = path.join(dir, 'subject.txt');
  fs.writeFileSync(file, 'FIXED\n');
  // `detached` gives it a process group of its own, so the signal below can be sent to the
  // group the way a terminal sends it — which is what kills the check as well, and the
  // detail the verdict has to survive.
  const child = spawn(process.execPath, [
    path.join(__dirname, '..', 'tools', 'prove-check.js'),
    '--files', file,
    '--break', `node -e "require('fs').writeFileSync(process.argv[1],'BROKEN\\n')" ${file}`,
    // A minute, not a few seconds. The window this test needs is "the check is still
    // running when the signal arrives", and the signal kills the check anyway, so a long
    // sleep costs nothing and a short one is a race: on a loaded machine the check can
    // finish first, the run completes honestly, and the assertion about an interrupted
    // run fails for a reason that has nothing to do with the tool.
    '--check', 'node -e "setTimeout(()=>process.exit(1),60000)"',
  ], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });

  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const exited = new Promise((resolve) => child.on('exit', resolve));

  try {
    // Signalled once the break has landed rather than after a fixed sleep: the state being
    // waited for is on disk, and a timer would be either flaky or slow.
    const pause = () => new Promise((r) => setTimeout(r, 25));
    for (let i = 0; i < 200 && !fs.readFileSync(file, 'utf8').includes('BROKEN'); i += 1) await pause();
    assert.match(fs.readFileSync(file, 'utf8'), /BROKEN/, 'the break should have landed');
    process.kill(-child.pid, 'SIGINT');

    const code = await exited;
    assert.equal(fs.readFileSync(file, 'utf8'), 'FIXED\n', 'the file has to come back');
    assert.notEqual(code, 0, 'an interrupted run is not a pass');
    assert.match(out, /interrupted/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a --expect that is not a regex is an operator error, not a silent no-match', () => {
  withScratch((file) => {
    const code = main([
      '--files', file,
      '--break', `node -e "require('fs').writeFileSync(process.argv[1],'BROKEN\\n')" ${file}`,
      '--check', 'false',
      '--expect', '(unclosed',
    ]);
    // 2, the usage code — swallowing it as "no match" would report a broken flag as a
    // broken check, which sends the reader to the wrong file.
    assert.equal(code, 2);
    assert.equal(fs.readFileSync(file, 'utf8'), 'FIXED\n');
  });
});
