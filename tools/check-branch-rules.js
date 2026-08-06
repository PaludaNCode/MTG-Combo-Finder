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
// Three unauthenticated GETs, and no admin scope anywhere: a session's token is
// `metadata=read`, so `/branches/main/protection` answers 403 and cannot be used,
// while `/rules/branches/<branch>` lists the rules that *effectively apply* and needs
// no auth at all. Unauthenticated GitHub allows 60 requests an hour per IP; this
// spends three, and sends `GITHUB_TOKEN` if one happens to be in the environment
// purely to buy the 5,000/hour bucket — nothing here needs the permissions.
//
// **It cannot run live from the sandbox this repository is usually edited from.**
// `api.github.com` is not on the agent proxy's allowlist and Node's `fetch()` does not
// route through the proxy anyway, so live mode answers 403 while `curl` to the same
// URL succeeds — measured, and the same shape as the Scryfall block in CLAUDE.md
// § *Network, and this sandbox*. Use the runner (check-branch-rules.yml), or re-record
// the fixture through the proxy and replay it:
//
//   for b in main data; do curl -sS "$API/rules/branches/$b"; done   # + curl -sS "$API"
//
// which is what test/fixtures/branch-rules.json is. A replayed run answers "was this
// true when the fixture was taken", never "is this true now" — the file carries the
// date it was recorded so a stale answer cannot pass for a live one.
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
      const fromRepo = ['merge', 'squash', 'rebase']
        .filter((m) => o.repo[`allow_${m}_merge`] !== false);
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
    check: (o) => o.repo.delete_branch_on_merge === false ? null : {
      level: 'BROKEN',
      saw: 'delete_branch_on_merge is on',
      then: 'a merged branch loses its remote ref, so the follow-up push is a new '
        + 'branch and `--force-with-lease` fails with "(stale info)" — a rejection '
        + 'that reads like a protection working and is nothing of the kind. This is '
        + 'exactly what .githooks/pre-push was written for; that hook is the fallback, '
        + 'not the fix.',
    },
  },
  {
    claim: 'auto-merge is available',
    where: 'README § Branching strategy. The Enable auto-merge step.',
    check: (o) => o.repo.allow_auto_merge === true ? null : {
      level: 'BROKEN',
      saw: 'allow_auto_merge is off',
      then: 'every merge now needs somebody watching CI finish.',
    },
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
        ? 'bypass_actors is absent from the unauthenticated response — absent is not empty'
        : `bypass_actors = ${JSON.stringify(o.bypassSeen)}`,
      then: 'read it in Settings → Rules, or with a token that has admin scope. '
        + 'A bypass actor makes every finding above advisory for whoever holds it.',
    }),
  },
];

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
  // Only for the rate-limit bucket. Every endpoint here is readable anonymously, so a
  // run without a token is exactly as trustworthy — which matters, because a check on
  // whether the gates are real should not itself depend on a credential.
  const token = process.env.GITHUB_TOKEN;
  if (token && token !== 'proxy-injected') headers.authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    // 403 here is the rate limit or a blocked host, never a permissions problem — say
    // so, because "403" alone sends people looking for a token scope that would not
    // help. From the usual sandbox this is the proxy: see the header.
    const hint = res.status === 403
      ? '\n  403 is not a scope problem: every endpoint here is readable anonymously.'
        + '\n  Either the 60/hour anonymous limit, or api.github.com is off the proxy'
        + "\n  allowlist — Node's fetch() does not use HTTPS_PROXY, so `curl` to the same"
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
  } else {
    console.log('No documented claim is false. Read the FRAGILE and UNKNOWN lines above');
    console.log('before treating that as "protected": one is held by a single checkbox,');
    console.log('and one this endpoint cannot answer.');
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
