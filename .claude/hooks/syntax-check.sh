#!/bin/bash
#
# Parse every .js file the moment it is edited, and refuse the edit if it does not.
#
# CI already does this — the `static` job's first step is a syntax check over every script,
# and it is first for a reason. The gap this closes is *when*: CI finds it after a push, and
# locally nothing looks at a file until something runs it. The cost of that gap is not the
# error, it is which error you get. A file that does not parse fails at whatever you happen
# to run next, in that thing's words, several minutes later.
#
# The case that wrote this hook: a comment added to tools/verify-layout.js contained a
# backtick, and ~1,500 lines of that file are inside `const HARNESS = ` + a template literal.
# The backtick closed the literal, and the next 1,500 lines were parsed as code. What came
# back was `SyntaxError: Unexpected identifier 'overflow'` from `npm run verify`, pointing at
# a line whose only sin was being ordinary prose in a comment. CLAUDE.md warns about exactly
# this trap in two places; it was walked into anyway, inside the first edit of the session.
# `node --check` says the same thing in 40ms, against the file that is actually wrong,
# before anything else has a chance to report it in its own vocabulary.
#
# PostToolUse rather than PreToolUse: the file has to exist in its new form to be parsed,
# and a syntax error is worth *reporting* rather than worth blocking a write over — the
# edit is usually 99% right and wants fixing, not discarding.
#
# Exit 2 is the code Claude Code reads as "blocking, and here is why" — stderr goes back to
# the model. Everything else exits 0: a hook that fails on its own inputs would be a hook
# that has to be removed the first time somebody edits a file with a colon in its name.
set -uo pipefail

# The tool call arrives as JSON on stdin. Parsed with node rather than jq because node is
# the one interpreter this repository already requires — there are no dependencies here on
# purpose, and a hook that needs jq is a hook that silently does nothing on a machine
# without it. Silently doing nothing is the failure mode every rule in CLAUDE.md is about.
#
# The program is carried in a QUOTED heredoc rather than inline in single quotes, and that
# is not tidiness. Written inline, the apostrophe in an ordinary English comment — "not this
# hook's to judge" — closes the shell string, and bash then reports a syntax error at a line
# of JavaScript. Every path through this file exited 2 with that message, including the
# non-.js path that is supposed to do nothing at all, which is a hook that blocks every edit
# in the repository. Found by running it; nothing else here could have.
read -r -d '' READ_PATH <<'NODEJS' || true
let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  try {
    const call = JSON.parse(raw);
    const input = call.tool_input || {};
    process.stdout.write(input.file_path || input.notebook_path || '');
  } catch {
    // An unreadable payload is not this hook's to judge. Say nothing, exit clean.
    process.stdout.write('');
  }
});
NODEJS

file="$(node -e "$READ_PATH" 2>/dev/null || true)"

case "$file" in
  *.js) ;;
  *) exit 0 ;;
esac

[ -f "$file" ] || exit 0

if ! out="$(node --check "$file" 2>&1)"; then
  # Named as the hook rather than as node, so it is obvious where the message came from
  # and which file is being talked about — `node --check` prints the path once, at the top
  # of a stack that is mostly node's own frames.
  echo "syntax-check: $file does not parse, so nothing that loads it will run." >&2
  echo "$out" >&2
  # The trap that is worth naming every time, because the error never points at it: a
  # backtick anywhere inside a template literal ends it, and this repository keeps a
  # ~1,500 line one in tools/verify-layout.js (HARNESS). Comments are inside it too.
  case "$file" in
    tools/verify-layout.js|*/tools/verify-layout.js)
      echo "syntax-check: most of this file is inside the HARNESS template literal — a backtick in a comment ends it." >&2
      ;;
  esac
  exit 2
fi
