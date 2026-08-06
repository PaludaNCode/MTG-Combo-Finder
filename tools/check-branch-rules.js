#!/usr/bin/env node
// Does GitHub actually enforce what CLAUDE.md and the README say about `main`?
//
// This exists because on 5 Aug 2026 the answer was no. CLAUDE.md, the README and a
// whole session's reasoning all described a branch ruleset protecting `main`, and no
// ruleset existed at all — 160 pull requests had merged through a gate that was not
// there. Nothing looked wrong, because **a missing gate is indistinguishable from a
// working one**: PRs still merge, `checks` still goes green, and nothing anywhere
// says the green was advisory. The file's own conclusion was "prose asserting it is
// configured is worth nothing". This is that prose turned into a command.
//
//   node tools/check-branch-rules.js               # ask GitHub, print every claim
//   node tools/check-branch-rules.js --fixture test/fixtures/branch-rules.json
//   node tools/check-branch-rules.js --json        # dump what was fetched
//
// **The thirteen claims split in two by what it takes to see them, and that split was
// got wrong twice before it was measured.**
//
// Ten of them live on `/rules/branches/<branch>`, which lists the rules that
// *effectively apply* and answers anybody. `/branches/main/protection` would need admin
// and is not used at all — a session's token is `metadata=read`, so it answers 403.
//
// The other three are repository settings — the three merge methods, auto-merge, and
// whether merged branches are kept — and **GitHub returns those fields only to a caller
// with push access.** An anonymous request does not get them, and neither does a
// workflow `GITHUB_TOKEN`: the strongest thing Actions can grant is `contents: write`,
// and there is no `administration` permission for it to hold. So on a runner those
// three are permanently UNKNOWN, and that is a property of the endpoint rather than
// something to work around. `GITHUB_API_TOKEN` (deliberately not `GITHUB_TOKEN`, so a
// runner's token is never picked up by accident) is honoured for anyone holding a PAT
// with push access, which is what turns the three into real answers.
//
// **The first live run reported all three as BROKEN, and the diagnosis of that was also
// wrong.** The findings were absent fields compared against `=== false` / `=== true`;
// that part is fixed by narrowedResponse() below. But the cause was blamed on the token
// the workflow was sending, and removing it changed nothing — the next run was still
// narrowed. What had actually happened is that every request from the editing sandbox
// goes through an agent proxy that **injects a GitHub credential with push access**, so
// the `curl` used to record the fixture saw fields the runner never could. The tell was
// there and unread: `/rate_limit` reports 5,000 an hour from here, not the anonymous 60.
// Two wrong stories in one evening, both from assuming what a request was rather than
// asking it.
//
// **Live mode cannot run from that sandbox at all**, for an unrelated reason:
// `api.github.com` is off the proxy's allowlist and Node's `fetch()` does not read
// `HTTPS_PROXY`, so live mode answers 403 while `curl` to the same URL succeeds. Same
// shape as the Scryfall block in CLAUDE.md § *Network, and this sandbox*. So: dispatch
// check-branch-rules.yml for the ten, and re-record the fixture with `curl` — which is
// authenticated from there, and is the only way to reach the other three:
//
//   for b in main data; do curl -sS "$API/rules/branches/$b"; done   # + curl -sS "$API"
//
// which is what test/fixtures/branch-rules.json is: a **push-access** recording, and
// labelled as one, because replaying it answers "was this true when it was taken" and
// never "is this true now".
//
// Deliberately NOT wired into CI, for probe-cors.js's reason: it asks a live third
// party, and a check that goes red when somebody else is having an outage is a check
// that gets muted. It is also the wrong shape for a unit test — the answer lives in a
// GitHub settings page, so a red run here is a thing to go and change rather than a
// thing to fix in the tree. `checkClaims()` below is pure and is unit-tested against
// the recorded response in test/fixtures/branch-rules.json.
//
// Three verdicts, and the middle one is why this is not just an assertion script:
//
//   BROKEN    the claim is false right now. Exit 1.
//   FRAGILE   the claim holds, but one checkbox away from not holding, with nothing
//             else watching. Exit 0 — reported, because the whole failure mode above
//             was a true sentence that quietly stopped being true.
//   UNKNOWN   unauthenticated GitHub does not answer this. Never reported as a pass.
'use strict';

const fs = require('fs');

// This repository. Hardcoded rather than read from `git remote`, so running the tool
// inside a fork or a stale clone still asks about the repo whose settings CLAUDE.md
// is describing — the question is "is the documented configuration real", and a
// remote URL is not evidence about that.
const SLUG = 'PaludaNCode/MTG-Combo-Finder';

const API = 'https://api.github.com/repos/';

// Every claim this repository's docs make about its own branch configuration, with
// where the claim is written. A claim whose `where` is stale is itself a finding —
// test/doc-pointers.test.js keeps the `README §` pointers honest, and a pointer here
// that names nothing is the same class of rot.
//
// Each check receives the whole observation and returns null for a pass, or
// { level, saw, then } — `then` being what to do about it, since somebody running
// this has already decided to care.
const CLAIMS = [
  {
    claim: 'a ruleset applies to `main` at all',
    where: 'CLAUDE.md § Conventions. The ruleset that refuses direct pushes to main.',
    check: (o) => o.mainRules.length ? null : {
      level: 'BROKEN',
      saw: 'no rules apply to `main`; direct pushes are allowed and every merge is ungated',
      then: 'this is the 5 Aug 2026 failure again. Recreate the ruleset before believing '
        + 'anything else in this output, and treat recent merges as unreviewed.',
    },
  },
  {
    claim: 'a pull request is required to land on `main`',
    where: 'CLAUDE.md § Conventions.',
    check: (o) => rule(o, 'pull_request') ? null : {
      level: 'BROKEN',
      saw: 'no pull_request rule',
      then: 'nothing stops a direct push, so `checks` gates nothing at all.',
    },
  },
  {
    claim: 'required approvals is 0',
    where: 'CLAUDE.md § Conventions. Above zero makes every PR unmergeable on a solo repo.',
    check: (o) => {
      const pr = rule(o, 'pull_request');
      if (!pr) return null; // already reported by the claim above
      const n = pr.parameters.required_approving_review_count;
      return n === 0 ? null : {
        level: 'BROKEN',
        saw: `required_approving_review_count = ${n}`,
        then: 'with one maintainer there is nobody to approve, so every PR is stuck. '
          + 'This reads as rigour and is a deadlock.',
      };
    },
  },
  {
    claim: '`checks` is a required status check',
    where: 'CLAUDE.md § Commands. The one name the ruleset requires.',
    check: (o) => {
      const sc = rule(o, 'required_status_checks');
      const names = sc ? sc.parameters.required_status_checks.map((c) => c.context) : [];
      return names.includes('checks') ? null : {
        level: 'BROKEN',
        saw: names.length ? `required: ${names.join(', ')}` : 'no required status checks',
        then: 'ci.yml builds `checks` as an aggregator job specifically so this name '
          + 'survives the workflow being split. If it is not required, the split '
          + 'stopped gating and nothing went red.',
      };
    },
  },
  {
    // The load-bearing one. ci.yml has no `push: branches: [main]` trigger, which is
    // only safe because a PR cannot merge while behind its base — that is what makes
    // the pull-request run a statement about the tree that actually lands.
    claim: 'branches must be up to date before merging (strict status checks)',
    where: '.github/workflows/ci.yml, the comment on the missing push trigger.',
    check: (o) => {
      const sc = rule(o, 'required_status_checks');
      if (!sc) return null; // already reported
      return sc.parameters.strict_required_status_checks_policy ? null : {
        level: 'BROKEN',
        saw: 'strict_required_status_checks_policy = false',
        then: 'CI no longer runs on push to `main` and now nothing tests the merge '
          + 'result. Either turn this back on, or put `push: branches: [main]` back '
          + 'into ci.yml — the file says so itself.',
      };
    },
  },
  {
    claim: 'force-pushes to `main` are blocked',
    where: 'CLAUDE.md § Conventions.',
    check: (o) => rule(o, 'non_fast_forward') ? null : {
      level: 'BROKEN',
      saw: 'no non_fast_forward rule',
      then: 'history on `main` can be rewritten, which no test here would ever see.',
    },
  },
  {
    claim: 'deleting `main` is blocked',
    where: 'CLAUDE.md § Conventions.',
    check: (o) => rule(o, 'deletion') ? null : {
      level: 'BROKEN', saw: 'no deletion rule', then: 'add it; it costs nothing.',
    },
  },
  {
    // An absence, asserted. Turning this on looks like tidiness and would forbid the
    // merge commits `main` is already built from.
    claim: 'linear history is NOT required',
    where: 'CLAUDE.md § Conventions. A deliberate omission that reads as an oversight.',
    check: (o) => !rule(o, 'required_linear_history') ? null : {
      level: 'BROKEN',
      saw: 'required_linear_history is set',
      then: 'this forbids merge commits, and merge commits are what make a restarted '
        + 'branch a fast-forward. Turning it on breaks CLAUDE.md, "The designated '
        + 'branch after its PR merges" — the whole section, not a detail of it.',
    },
  },
  {
    // The invariant two CLAUDE.md sections and .githooks/pre-push all rest on:
    // `main`'s tip is always a descendant of the PR head, so a branch restarted from
    // `main` always pushes cleanly and never needs --force.
    //
    // GitHub decides the available merge buttons by intersecting the repository's
    // three checkboxes with the ruleset's allowed_merge_methods. Either side can
    // carry it, so this reports the effective set — and flags a ruleset that permits
    // more than the repo does, because that is one checkbox away from silent breakage.
    claim: 'the only way to merge is a merge commit',
    where: 'README § Branching strategy. CLAUDE.md § The designated branch after its PR merges.',
    check: (o) => {
      const pr = rule(o, 'pull_request');
      const fromRuleset = (pr && pr.parameters.allowed_merge_methods) || null;
      // The merge-commit setting is `allow_merge_commit`, NOT `allow_merge_merge` —
      // the three field names do not share a pattern, and building them from the
      // method name silently reads `undefined` for the one that matters. The first
      // version of this did exactly that and passed every test, because `undefined`
      // is `!== false` and so 'merge' landed in the allowed list by accident. Spelling
      // them out is the fix; narrowedResponse() is what made the bug visible.
      const FIELD = { merge: 'allow_merge_commit', squash: 'allow_squash_merge', rebase: 'allow_rebase_merge' };
      const methods = ['merge', 'squash', 'rebase'];
      // **A ruleset pinned to merge-only settles this on its own, and that is the whole
      // point of pinning it.** The effective set is the intersection, so it cannot
      // contain anything the ruleset does not — no repository field can widen it back.
      // That makes the claim answerable by a caller with no push access at all, which
      // is what turns this from a settings page somebody has to go and look at into a
      // thing the runner checks. Asking for the repository settings first would throw
      // that away and report UNKNOWN for a configuration that is fully determined.
      //
      // One exception, and it is not the claim failing: if the repository ALSO has merge
      // commits switched off, the intersection is empty and nothing can merge at all.
      // Worth its own message, because "no way to merge but a merge commit" is still
      // technically true there and reporting a pass would be absurd.
      if (fromRuleset && fromRuleset.length === 1 && fromRuleset[0] === 'merge') {
        if (o.repo.allow_merge_commit === false) {
          return {
            level: 'BROKEN',
            saw: 'the ruleset allows [merge] and the repository has merge commits off '
              + '→ effective [none]',
            then: 'no pull request can be merged at all. Turn merge commits back on in '
              + 'Settings; the ruleset is not the thing to change.',
          };
        }
        return null;
      }
      const narrow = narrowedResponse(methods.map((m) => FIELD[m]), o);
      if (narrow) return narrow;
      const fromRepo = methods.filter((m) => o.repo[FIELD[m]]);
      const effective = fromRuleset
        ? fromRepo.filter((m) => fromRuleset.includes(m))
        : fromRepo;
      const shown = `repo allows [${fromRepo.join(', ') || 'none'}], `
        + `ruleset allows [${fromRuleset ? fromRuleset.join(', ') : 'unset — all of them'}]`
        + ` → effective [${effective.join(', ') || 'none'}]`;
      if (effective.length !== 1 || effective[0] !== 'merge') {
        return {
          level: 'BROKEN',
          saw: shown,
          then: 'a squash or rebase merge leaves `main` NOT a descendant of the PR head, '
            + 'so restarting the designated branch from `main` diverges and needs a '
            + 'force-push. That exception was documented once, then deleted by turning '
            + 'these off. Turn them off again, or put the exception back.',
        };
      }
      if (fromRuleset && fromRuleset.length > 1) {
        return {
          level: 'FRAGILE',
          saw: shown,
          then: 'the invariant is held by one repository checkbox with no second lock. '
            + 'Set the ruleset\'s allowed_merge_methods to ["merge"] and this tool can '
            + 'read the guarantee straight off the rule, which is what makes the rest '
            + 'of the branching docs checkable rather than merely written down.',
        };
      }
      return null;
    },
  },
  {
    claim: 'merged branches are kept',
    where: 'CLAUDE.md § The designated branch after its PR merges.',
    check: (o) => narrowedResponse(['delete_branch_on_merge'], o)
      || (o.repo.delete_branch_on_merge === false ? null : {
        level: 'BROKEN',
        saw: 'delete_branch_on_merge is on',
      then: 'a merged branch loses its remote ref, so the follow-up push is a new '
        + 'branch and `--force-with-lease` fails with "(stale info)" — a rejection '
        + 'that reads like a protection working and is nothing of the kind. This is '
          + 'exactly what .githooks/pre-push was written for; that hook is the fallback, '
          + 'not the fix.',
      }),
  },
  {
    claim: 'auto-merge is available',
    where: 'README § Branching strategy. The Enable auto-merge step.',
    check: (o) => narrowedResponse(['allow_auto_merge'], o)
      || (o.repo.allow_auto_merge === true ? null : {
        level: 'BROKEN',
        saw: 'allow_auto_merge is off',
        then: 'every merge now needs somebody watching CI finish.',
      }),
  },
  {
    // Not a rule to add — a rule to keep absent. update-data.yml force-pushes an
    // orphan commit to `data` nightly, so any ruleset reaching that branch breaks the
    // nightly job, and it breaks it silently: the combo snapshot just stops moving.
    claim: '`data` is not protected against force-pushes',
    where: 'CLAUDE.md § Conventions. A ruleset for data must not block force-pushes.',
    check: (o) => {
      const blocked = o.dataRules.filter((r) => r.type === 'non_fast_forward' || r.type === 'pull_request');
      return blocked.length === 0 ? null : {
        level: 'BROKEN',
        saw: `rules on \`data\`: ${blocked.map((r) => r.type).join(', ')}`,
        then: 'update-data.yml force-pushes `data` nightly and will now fail every '
          + 'night. Nothing on the page says so — it serves the last snapshot that '
          + 'landed, so the symptom is combo data quietly going stale.',
      };
    },
  },
  {
    // Reported as unknown rather than as a pass, because the honest answer is that
    // this endpoint does not carry it. An empty-looking response is not evidence.
    claim: 'nothing can bypass the ruleset',
    where: 'CLAUDE.md § Conventions. GitHub Actions is not an available bypass actor.',
    check: (o) => ({
      level: 'UNKNOWN',
      saw: o.bypassSeen === undefined
        ? 'bypass_actors is on /rulesets/<id>, which this does not read — and that '
          + 'endpoint omitted it even for a push-access caller. Absent is not empty'
        : `bypass_actors = ${JSON.stringify(o.bypassSeen)}`,
      then: 'read it in Settings → Rules, which needs admin. A bypass actor makes every '
        + 'finding above advisory for whoever holds it, so this one never passes.',
    }),
  },
];

// A repository setting that is not in the response is UNKNOWN, never a broken claim.
//
// **This function exists because its absence shipped, and the tool reported three false
// findings on its first live run.** `/repos/{owner}/{repo}` answered without
// `allow_merge_commit`, `allow_squash_merge`, `allow_rebase_merge`, `allow_auto_merge`
// or `delete_branch_on_merge`, and each check compared the missing value against the
// state it wanted — `=== false`, `=== true` — so absent read as "the documented claim is
// false". The run said auto-merge was off four minutes after auto-merge had merged the
// pull request that added the tool.
//
// **Those fields are returned only to a caller with push access**, which took two wrong
// diagnoses to establish; the header has the full story. Nothing is working around it —
// on a runner these three claims are simply not answerable, and saying so is the whole
// job of this function.
//
// The general rule was already applied to `bypass_actors` and not to anything else,
// which is the lesson: **absent is not empty, and it is not false either.** A check that
// cannot see a setting has to say so, because "the docs are wrong" and "I could not
// look" are the same bytes and only one of them is worth acting on.
function narrowedResponse(fields, observation) {
  const missing = fields.filter((f) => observation.repo[f] === undefined);
  if (!missing.length) return null;
  return {
    level: 'UNKNOWN',
    saw: `the repository response carried no ${missing.join(', ')}`,
    then: 'not a finding — this claim was not checked. GitHub returns these fields only '
      + 'to a caller with push access, and neither an anonymous request nor a workflow '
      + 'GITHUB_TOKEN has it (Actions cannot grant repository administration). Set '
      + 'GITHUB_API_TOKEN to a PAT with push access, or replay a fixture recorded with '
      + 'one.',
  };
}

// A rule by type, from the effective list. `/rules/branches/<b>` flattens every
// ruleset that reaches the branch, so this answers "does this apply" without caring
// which ruleset supplied it — which is the question, on a repo with one.
function rule(observation, type) {
  return observation.mainRules.find((r) => r.type === type) || null;
}

// The whole decision, pure, so the test can drive it. Takes the three API responses
// and returns one finding per claim that is not a clean pass.
function checkClaims(observation) {
  const o = {
    mainRules: observation.mainRules || [],
    dataRules: observation.dataRules || [],
    repo: observation.repo || {},
    bypassSeen: observation.bypassSeen,
  };
  const findings = [];
  for (const c of CLAIMS) {
    const bad = c.check(o);
    if (bad) findings.push({ claim: c.claim, where: c.where, ...bad });
  }
  return {
    findings,
    broken: findings.filter((f) => f.level === 'BROKEN'),
    fragile: findings.filter((f) => f.level === 'FRAGILE'),
    unknown: findings.filter((f) => f.level === 'UNKNOWN'),
    passed: CLAIMS.length - findings.length,
    total: CLAIMS.length,
  };
}

async function getJson(url) {
  const headers = { accept: 'application/vnd.github+json' };
  // `GITHUB_API_TOKEN`, never `GITHUB_TOKEN`. A workflow token is picked up by that
  // second name automatically in some setups, and it cannot help here — Actions has no
  // repository-administration permission, so it sees the same narrowed repository object
  // an anonymous caller does. Reading it would only disguise which of the two ran. This
  // name has to be set on purpose, by somebody holding a PAT with push access, which is
  // the only thing that turns the three settings claims into answers.
  const token = process.env.GITHUB_API_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    // 403 here is the rate limit or a blocked host, never a permissions problem — say
    // so, because "403" alone sends people looking for a token scope that would not
    // help. From the usual sandbox this is the proxy: see the header.
    const hint = res.status === 403
      ? '\n  Not a scope problem: the rules endpoints answer any caller. Either the'
        + '\n  60/hour anonymous rate limit, or api.github.com is off the agent proxy'
        + "\n  allowlist — Node's fetch() does not read HTTPS_PROXY, so `curl` to the same"
        + '\n  URL can succeed while this fails. Run it on a runner, or replay --fixture.'
      : '';
    throw new Error(`GET ${url} → HTTP ${res.status}${hint}`);
  }
  return res.json();
}

async function observe(slug) {
  const base = API + slug;
  const [mainRules, dataRules, repo] = await Promise.all([
    getJson(`${base}/rules/branches/main`),
    getJson(`${base}/rules/branches/data`),
    getJson(base),
  ]);
  return { slug, mainRules, dataRules, repo };
}

function report(result, observation) {
  console.log(`Branch configuration of ${observation.slug}, as GitHub reports it.`);
  // A replay has to announce itself. The failure this tool exists to catch is a stale
  // description of the configuration passing for a live one, and a fixture is exactly
  // that if the output does not say which it is.
  if (observation.fetched) {
    console.log(`REPLAY of a fixture recorded ${observation.fetched} — not a live answer.`);
    // Which caller recorded it decides which claims it can speak to at all: three of
    // them are invisible without push access, so a replay that does not say so invites
    // the reader to think a runner could have produced the same output.
    if (observation.access) console.log(`  recorded with: ${observation.access}`);
  }
  console.log(`\n${result.passed} of ${result.total} documented claims hold.\n`);
  for (const f of result.findings) {
    console.log(`${f.level}: ${f.claim}`);
    console.log(`  documented in: ${f.where}`);
    console.log(`  GitHub says:   ${f.saw}`);
    console.log(`  what to do:    ${f.then}`);
    console.log('');
  }
  if (result.broken.length) {
    console.log(`${result.broken.length} claim(s) this repository's docs make are FALSE right now.`);
    console.log('Change the setting, or change the sentence — a wrong one is worse than none.');
  } else if (result.findings.length) {
    // Never just "all good". A clean BROKEN list with FRAGILE or UNKNOWN lines above it
    // is not the same statement as a clean run, and the summary has to keep them apart —
    // this whole tool exists because a reassuring sentence outlived the thing it
    // described.
    const parts = [];
    if (result.fragile.length) parts.push(`${result.fragile.length} held by a single setting`);
    if (result.unknown.length) parts.push(`${result.unknown.length} not answerable here`);
    console.log(`No documented claim is false. Not the same as "protected": ${parts.join(', ')}`);
    console.log('— read those lines above before relying on this.');
  } else {
    console.log('Every documented claim holds, and none of them is guesswork.');
  }
  return result.broken.length ? 1 : 0;
}

async function main(argv) {
  const fixtureAt = argv.indexOf('--fixture');
  const observation = fixtureAt >= 0
    ? JSON.parse(fs.readFileSync(argv[fixtureAt + 1], 'utf8'))
    : await observe(SLUG);
  if (!observation.slug) observation.slug = SLUG;
  if (argv.includes('--json')) {
    console.log(JSON.stringify(observation, null, 2));
    return 0;
  }
  return report(checkClaims(observation), observation);
}

module.exports = { CLAIMS, checkClaims, SLUG };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}
