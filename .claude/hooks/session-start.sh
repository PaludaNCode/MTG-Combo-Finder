#!/bin/bash
#
# Make a fresh remote session's git refs mean what they say.
#
# There is nothing to install here — this repository has no dependencies on purpose, and
# ESLint and Playwright are fetched per run (see the scripts in package.json). What a new
# container does need is for `main` to be the `main` everybody else means.
#
# The problem this exists for: a container's clone can carry a `main` created from an
# `origin/main` that has since been rewritten. One of them pointed at the project's
# original unsquashed history — root `ac6d991d8 Initial commit`, 38 commits, sharing *no*
# ancestor with the remote at all, so `git merge-base main origin/main` returned nothing
# and `git pull` refused as divergent. Nothing was wrong with the repository; the local ref
# was a fossil. CLAUDE.md has said "never trust a local main" for a while, which works only
# for someone who reads it first and remembers at the right moment. This makes it true
# instead of documented.
#
# Deliberately conservative. It will skip rather than guess, and it never discards a commit:
#
#   - offline, or no origin/main                  -> do nothing
#   - main is checked out                         -> do nothing (never move the ref underfoot)
#   - main is already origin/main                 -> do nothing
#   - main holds commits the remote does not      -> tag them first, then realign
#
# Remote only. A laptop's clone is the developer's to manage, and a hook that rewrites refs
# on a machine somebody is working on is a worse trade than the problem it solves.
set -euo pipefail

# Point git at the tracked hooks before anything else, and do it on every machine rather than
# only a remote session. `.githooks/pre-push` catches a force-push whose lease names a ref the
# remote does not have — the mistake this file's own CLAUDE.md section documents and which was
# then made anyway, an hour after being written down. A check that only runs in a container is
# a check that does not run where the rule is broken.
#
# core.hooksPath, not a copy into .git/hooks: the hook stays reviewable in the repository and
# there is no installed copy to drift from it.
if [ -d .githooks ] && [ "$(git config --get core.hooksPath || true)" != '.githooks' ]; then
  git config core.hooksPath .githooks
  echo 'session-start: git hooks now come from .githooks'
fi

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Not a git checkout at all, somehow. Not this script's business.
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

# --prune is half the value on its own: it clears remote-tracking refs for branches that
# have been merged and auto-deleted, which is what makes `git branch -r` a list of what
# actually exists rather than a list of what existed when the container was built.
#
# A failure here is almost always "no network yet", which is not a reason to fail a session.
if ! git fetch --prune --quiet origin 2>/dev/null; then
  echo "session-start: could not reach origin; left refs alone"
  exit 0
fi

if ! git rev-parse --verify --quiet origin/main >/dev/null; then
  exit 0
fi

# Never move a branch that is checked out. Written as an if rather than `[ ... ] && exit 0`
# on purpose: under `set -e` a failing test in an && list exits the script non-zero, which
# would turn every ordinary "nothing to do" run into a hook failure.
current_branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
if [ "$current_branch" = "main" ]; then
  echo "session-start: main is checked out; left it alone"
  exit 0
fi

if ! git rev-parse --verify --quiet refs/heads/main >/dev/null; then
  exit 0
fi

local_main="$(git rev-parse main)"
remote_main="$(git rev-parse origin/main)"
if [ "$local_main" = "$remote_main" ]; then
  exit 0
fi

# Anything on main that the remote has never seen. Usually the fossil history; conceivably
# somebody's unpushed work, and this script cannot tell the difference — so it keeps it.
unique="$(git rev-list --count "origin/main..main" 2>/dev/null || echo 0)"
if [ "$unique" != "0" ]; then
  archive_tag="archive/main-${local_main:0:9}"
  git tag -f "$archive_tag" main >/dev/null
  echo "session-start: main held $unique commit(s) the remote does not; kept them as $archive_tag"
  echo "session-start: restore with  git branch <name> $archive_tag"
fi

git branch -f main "$remote_main"
echo "session-start: realigned main to origin/main ($(git rev-parse --short origin/main))"
