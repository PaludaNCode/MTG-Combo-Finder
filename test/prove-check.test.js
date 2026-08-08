'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { verdict, parseArgs, main } = require('../tools/prove-check.js');

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

test('the files list is collected, and a stray argument is refused', () => {
  const args = parseArgs(['--files', 'a.css', 'b.js', '--break', 'x', '--check', 'y']);
  assert.deepEqual(args.files, ['a.css', 'b.js']);
  assert.equal(args.break, 'x');
  assert.equal(args.check, 'y');
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
