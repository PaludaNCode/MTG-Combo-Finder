#!/usr/bin/env node
// Stamp every local asset URL in a page with the commit SHA, and refuse to
// finish if one was missed.
//
// Why the deploy needs this at all: Pages' CDN caches by full URL and a deploy
// purges nothing, so an unversioned URL can serve a stale file — or worse, new
// HTML with old JS — for up to ~20 minutes. The HTML itself stays cacheable;
// the stamp only guarantees that the HTML and its assets always match.
//
// Why it is a script rather than the `sed` it replaces: that version carried a
// hand-written list of filenames and a hand-written count per page, and asserted
// the count. Which catches a *rename* — the count drops — and cannot catch an
// *addition*, because a file added to the page and not to the list goes out
// unstamped while the count still matches. That is a stale-JS bug that only ever
// appears in production, and unofficial.js and graph.js both shipped that way.
//
// So the check is inverted. Nothing is listed: every local asset reference is
// found in the page, all of them are stamped, and then the page is re-read and
// the job fails if any local asset is still bare. "Did we stamp the number we
// expected" becomes "is anything unstamped", which is the property actually
// wanted and the one that survives someone adding a script.
//
//   node tools/stamp-assets.js <version> <page>...
//
// Also exports the rewrite so tools/verify-layout.js can build its stamped
// fixture from the same rule rather than a second regex that agrees with this
// one until the day it does not.
'use strict';

const fs = require('node:fs');

// src= and href= on the two hand-written pages here. Deliberately not an HTML
// parser: these are two files in this repository, written by hand and reviewed
// by hand, and a dependency-free regex that is obviously right for them beats a
// general solution that has to be trusted.
const ATTR = /\b(src|href)="([^"]*)"/g;

// What counts as ours to stamp.
function isLocalAsset(url) {
  if (!url) return false;
  // Anything with a scheme, a protocol-relative host, or a fragment belongs to
  // somebody else or to this page — either way the CDN question does not arise.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//') || url.startsWith('#')) return false;
  // Already carries a query, so already stamped — running twice is a no-op
  // rather than `app.js?v=a?v=b`.
  if (url.includes('?')) return false;
  // A link to the other page is navigation, not an asset. Stamping it would put
  // a commit SHA in a URL people bookmark, and the HTML is deliberately the one
  // thing left cacheable-and-current.
  if (/\.html?$/i.test(url)) return false;
  return true;
}

// Every local asset a page references, in document order, deduplicated.
function localAssets(html) {
  const found = [];
  for (const [, , url] of String(html).matchAll(ATTR)) {
    if (isLocalAsset(url) && !found.includes(url)) found.push(url);
  }
  return found;
}

// Rewrite every local asset URL through `fn`. The deploy appends a query; the
// layout test moves them under a sandbox path and appends its own. One rule,
// two callers, so the fixture cannot drift away from what the deploy does.
function rewriteAssets(html, fn) {
  return String(html).replace(ATTR, (whole, attr, url) => (
    isLocalAsset(url) ? `${attr}="${fn(url)}"` : whole
  ));
}

const stamp = (html, version) => rewriteAssets(html, (url) => `${url}?v=${version}`);

// ---- the service worker's shell list ---------------------------------------
//
// sw.js precaches the shell, and the list has to be the stamped URLs or the worker
// would warm the cache with the very URLs the page no longer asks for. It is written
// here, from the same localAssets() walk that stamps the pages, because the
// alternative is a second list maintained by hand — which is the exact failure this
// script exists to end: a file added to a page and not to the list.
//
// The pages themselves go in too. They are not stamped (they carry the stamps), and
// they are what a reader needs offline.
const SHELL_START = '// __SHELL_START__';
const SHELL_END = '// __SHELL_END__';

function shellList(pages, assets, version) {
  const urls = ['./'].concat(pages, assets.map((url) => `${url}?v=${version}`));
  const lines = urls.map((url) => `    '${url}',`).join('\n');
  // Both markers are written back, so a second run finds them where it looks.
  return `${SHELL_START}\n  const SHELL = [\n${lines}\n  ];\n  ${SHELL_END}`;
}

// Returns the rewritten worker, or null if the markers are not where they should be —
// which the caller turns into a failed deploy rather than a silent no-op. A worker
// precaching last week's URLs is worse than one precaching nothing.
function writeShell(source, pages, assets, version) {
  const start = source.indexOf(SHELL_START);
  const end = source.indexOf(SHELL_END);
  if (start === -1 || end === -1 || end < start) return null;
  const before = source.slice(0, start);
  const after = source.slice(end + SHELL_END.length);
  // The end marker keeps its own line, so a second run finds it where it looks.
  return before + shellList(pages, assets, version) + after;
}

// The build the worker names its cache after. A byte-identical sw.js is not an
// update as far as the browser is concerned, so this is also what makes a deploy
// with no asset changes still swap the worker.
function writeBuild(source, version) {
  return source.replace(/^(\s*const BUILD = ')[^']*(';)/m, `$1${version}$2`);
}

function main(argv) {
  const [version, ...pages] = argv;
  if (!version || !pages.length) {
    console.error('usage: node tools/stamp-assets.js <version> <page>... [--worker sw.js]');
    return 1;
  }
  // The worker is not a page and is not stamped in place — it is rewritten, with the
  // list of everything the pages turned out to reference.
  const workerAt = pages.indexOf('--worker');
  const worker = workerAt === -1 ? null : pages[workerAt + 1];
  if (workerAt !== -1) pages.splice(workerAt, 2);

  let failed = false;
  const everyAsset = [];
  for (const page of pages) {
    const before = fs.readFileSync(page, 'utf8');
    const assets = localAssets(before);
    // A page with no assets is a page this script was pointed at by mistake.
    // Silence would look like success.
    if (!assets.length) {
      console.error(`${page}: no local asset URLs found — is this the right file?`);
      failed = true;
      continue;
    }

    fs.writeFileSync(page, stamp(before, version));

    // Re-read rather than trusting the string we just built. The assertion is
    // about the file that ships.
    const left = localAssets(fs.readFileSync(page, 'utf8'));
    if (left.length) {
      console.error(`${page}: ${left.length} asset(s) still unstamped: ${left.join(', ')}`);
      failed = true;
      continue;
    }
    console.log(`${page}: stamped ${assets.length} — ${assets.join(', ')}`);
    for (const url of assets) if (!everyAsset.includes(url)) everyAsset.push(url);
  }

  if (worker && !failed) {
    const source = fs.readFileSync(worker, 'utf8');
    const rewritten = writeShell(writeBuild(source, version), pages, everyAsset, version);
    if (!rewritten) {
      console.error(`${worker}: the ${SHELL_START} / ${SHELL_END} markers are missing — `
        + 'it would precache the unstamped URLs the page no longer asks for');
      return 1;
    }
    fs.writeFileSync(worker, rewritten);
    // Re-read, like the pages above: the assertion is about the file that ships.
    const after = fs.readFileSync(worker, 'utf8');
    if (!after.includes(`?v=${version}`) || !after.includes(`const BUILD = '${version}'`)) {
      console.error(`${worker}: rewritten but does not carry ${version}`);
      return 1;
    }
    console.log(`${worker}: shell of ${everyAsset.length + pages.length + 1} URL(s) at build ${version}`);
  }
  return failed ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = {
  isLocalAsset, localAssets, rewriteAssets, stamp, main, writeShell, writeBuild, shellList,
};
