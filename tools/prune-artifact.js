#!/usr/bin/env node
// Delete everything the deployed site does not serve, just before it is uploaded.
//
// The Pages artifact is `path: .`, so it has always carried the whole checkout:
// card-text.json (16.5 MB of oracle text that only the research tools read),
// templates.json, research-log.js, the READMEs, tools/, test/, e2e/ — 17.5 MB of
// an 18.5 MB artifact, against a site of 1.06 MB. Nothing *fetches* the rest,
// which is why nothing was ever broken by it —
// but every one of those files is served under our origin to anyone who asks,
// and "what does this site consist of" was not a question the repository could
// answer.
//
// **It is not a speed fix and should not be sold as one.** Measured on the two
// deploys before this existed: upload-pages-artifact took 2s and 3s, out of jobs
// of 238s and 17s. The variance is deploy-pages queueing and has nothing to do
// with size. If this ever appears to save minutes, something else changed.
//
//   node tools/prune-artifact.js index.html tiers.html           # say what it would do
//   node tools/prune-artifact.js index.html tiers.html --apply   # do it
//
// Dry by default, and deliberately: this deletes directories, and the one place
// it is meant to run is a disposable runner checkout. A bare run in a working
// tree prints a plan and touches nothing.
//
// WHAT IT KEEPS IS COMPUTED, NEVER LISTED. That is the same rule stamp-assets.js
// is built on and for the same reason: a hand-written list of what to keep would
// go stale the first time somebody adds a script to a page, and the failure —
// a file deleted out of the artifact while the page still asks for it — is a 404
// that only production can show. So the keep set is read out of the pages
// themselves, and the guard below re-reads them after the deletion and fails the
// deploy if anything they reference has stopped existing.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { localAssets } = require('./stamp-assets.js');
// The files no `src=` in either page references — the worker, and the two scripts
// only the no-Worker fallback loads. Imported from sw.js rather than written out
// again here, because sw.js already maintains that list for its precache and
// test/service-worker.test.js already pins it against app.js and
// search-worker.js. A second copy would be a second thing to keep in step, and
// the copy that fell behind would delete a file the page loads at runtime.
const ServiceWorkerShell = require('../sw.js');

// The service worker itself is not in either page — app.js registers it — and it
// is not in NOT_IN_THE_HTML either, since that list is what the worker precaches
// and a worker does not precache itself.
const ALSO_SERVED = ['sw.js'];

// An asset URL as a path in the checkout. Runs after stamp-assets.js, so every
// reference carries `?v=<sha>` by the time this reads it; localAssets() ignores
// URLs with a query, which would make the keep set *empty* and delete the site.
// So the query is stripped before the walk rather than after — see servedBy().
const bare = (url) => String(url).split('?')[0].split('#')[0];

// What the site consists of, read out of the pages. Throws rather than returning
// an empty set: a page this found no assets in is a page it was pointed at by
// mistake, and silence here would be a plan to delete everything.
function servedBy(pages, read) {
  const keep = new Set(ALSO_SERVED.concat(ServiceWorkerShell.NOT_IN_THE_HTML || []));
  for (const page of pages) {
    // Unstamped copy of the page, so localAssets() can see references the deploy
    // has already stamped. The page on disk is left exactly as it is.
    const html = String(read(page)).replace(/\?v=[^"#]*/g, '');
    const assets = localAssets(html);
    if (!assets.length) throw new Error(`${page}: no local asset URLs found — is this the right file?`);
    keep.add(page);
    for (const url of assets) keep.add(bare(url));
  }
  return keep;
}

// Which top-level entries survive. Everything is compared on its first path
// segment, so an asset in a subdirectory keeps the whole subtree: `img/pip.svg`
// keeps `img/`. Coarse on purpose — a directory the site reaches into at all is
// a directory this has no business editing.
function plan(entries, keep) {
  const roots = new Set([...keep].map((p) => p.split('/')[0]));
  const kept = [];
  const dropped = [];
  for (const entry of entries) {
    // Hidden entries are already excluded from the artifact by
    // upload-pages-artifact v4+, so they are not this script's business — and
    // .git is among them, which is the one deletion that would break the job.
    if (entry.startsWith('.')) continue;
    (roots.has(entry) ? kept : dropped).push(entry);
  }
  return { kept: kept.sort(), dropped: dropped.sort() };
}

// Bytes, following directories. Reported rather than computed for its own sake:
// the log line is the only place anybody will ever see what the artifact stopped
// carrying, and a count of files does not say 16.5 MB.
function sizeOf(target) {
  let total = 0;
  const stack = [target];
  while (stack.length) {
    const at = stack.pop();
    let stat;
    try {
      stat = fs.lstatSync(at);
    } catch (err) {
      continue; // a dangling link, or something removed under us
    }
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(at)) stack.push(path.join(at, name));
    } else {
      total += stat.size;
    }
  }
  return total;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

function main(argv) {
  const apply = argv.includes('--apply');
  const pages = argv.filter((a) => a !== '--apply');
  if (!pages.length) {
    console.error('usage: node tools/prune-artifact.js <page>... [--apply]');
    return 1;
  }

  let keep;
  try {
    keep = servedBy(pages, (p) => fs.readFileSync(p, 'utf8'));
  } catch (err) {
    console.error(err.message);
    return 1;
  }

  const { kept, dropped } = plan(fs.readdirSync('.'), keep);
  // Every page has to be one of the survivors. If it is not, this is running
  // somewhere that is not the site's root and the plan below is nonsense.
  for (const page of pages) {
    if (!kept.includes(page.split('/')[0])) {
      console.error(`${page} is not in this directory — refusing to delete anything`);
      return 1;
    }
  }

  const freed = dropped.reduce((sum, entry) => sum + sizeOf(entry), 0);
  const served = kept.reduce((sum, entry) => sum + sizeOf(entry), 0);
  console.log(`the site serves ${kept.length} entr(ies), ${kb(served)}: ${kept.join(', ')}`);
  console.log(`${apply ? 'dropping' : 'would drop'} ${dropped.length}, ${kb(freed)}: ${dropped.join(', ')}`);
  if (!apply) {
    console.log('\nDry run. Pass --apply to delete.');
    return 0;
  }

  for (const entry of dropped) fs.rmSync(entry, { recursive: true, force: true });

  // The guard, and the reason the keep set is computed rather than listed: read
  // the pages back off disk and check that everything they reference is still
  // there. A missing asset here is a 404 on the live site that nothing else in
  // this pipeline would notice — the deploy would go green and the page would
  // load without its stylesheet.
  //
  // WHAT IT CANNOT CATCH is a keep set that came out too *small*, because it only
  // checks the set it was given: break the query strip above and `keep` loses
  // every stamped asset, the plan deletes them, and this loop finds nothing
  // missing because it is no longer looking for them. Proved by breaking it —
  // 9 of these 10 tests stayed green and only "a stamped page is read the same as
  // a bare one" went red. That test is the guard for this one.
  const missing = [...keep].filter((p) => !fs.existsSync(p));
  if (missing.length) {
    console.error(`::error::the prune removed ${missing.length} file(s) the site serves: ${missing.join(', ')}`);
    return 1;
  }
  console.log(`Pruned. ${kb(freed)} will not be uploaded; ${keep.size} served file(s) all present.`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { servedBy, plan, sizeOf, main, ALSO_SERVED };
