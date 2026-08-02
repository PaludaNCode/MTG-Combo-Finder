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

function main(argv) {
  const [version, ...pages] = argv;
  if (!version || !pages.length) {
    console.error('usage: node tools/stamp-assets.js <version> <page>...');
    return 1;
  }

  let failed = false;
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
  }
  return failed ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { isLocalAsset, localAssets, rewriteAssets, stamp, main };
