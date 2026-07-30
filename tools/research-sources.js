#!/usr/bin/env node
// One-off research, run by hand from Actions (.github/workflows/research.yml).
//
// It answers two questions that cannot be answered from a laptop behind a
// restrictive network, and that the published combos.json has already thrown
// away the evidence for:
//
//   1. What is a "template"? Commander Spellbook models a generic requirement
//      ("a sacrifice outlet") as a template rather than a card, and 3,860
//      combos need one — 64% of which would show green. We currently drop all
//      of them, because compact() keeps only a count. If a template carries a
//      Scryfall query or a card list, a new sacrifice outlet could join those
//      combos without anyone authoring anything, which is the entire question
//      behind "why is Hammerhead, Maggia Boss in no combo at all?".
//
//   2. Where do other sites get combos Spellbook does not have? EDHREC and
//      EDHOptimizer show combos for cards Spellbook's own search returns
//      nothing for. Either they resolve templates into concrete cards, or they
//      carry combo data of their own. That changes what we could do about it.
//
// This reads. It does not harvest: robots.txt is fetched and obeyed first, one
// page per host, spaced out, with a User-Agent that says who is calling and
// why. The output is a report for a human to read, not a dataset.
'use strict';

const { createVariantScanner, bodyChunks } = require('./fetch-combos.js');

const UA = 'MTG-Combo-Finder-Research/1.0 (+https://github.com/PaludaNCode/MTG-Combo-Finder; one-off source attribution check)';
const BULK_URL = 'https://json.commanderspellbook.com/variants.json';

const out = [];
const say = (line = '') => { out.push(line); console.log(line); };

// ---- part 1: what a template actually looks like ---------------------------

// Enough variants to see every template in circulation, then stop — there is no
// reason to pull half a gigabyte to answer a structural question.
const SAMPLE_TARGET = 400;

async function inspectTemplates() {
  say('## 1. What a Commander Spellbook "template" is');
  say();
  say(`Streaming \`${BULK_URL}\` until ${SAMPLE_TARGET} variants requiring a template have been seen.`);
  say();

  const res = await fetch(BULK_URL, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error('bulk export HTTP ' + res.status);

  let seen = 0, withTemplates = 0, bytes = 0;
  const templates = new Map();
  let firstExample = null;
  let sampleKeys = null;

  // The same scanner the fetcher uses, so this cannot drift from what actually
  // parses the file in production — and it is the one with tests.
  const push = createVariantScanner((variant) => {
    seen += 1;
    if (!sampleKeys) sampleKeys = Object.keys(variant);
    const requires = variant.requires || variant.requiresTemplates || variant.requires_templates || [];
    if (!Array.isArray(requires) || !requires.length) return;

    withTemplates += 1;
    if (!firstExample) firstExample = { id: variant.id, requires };
    for (const req of requires) {
      const t = (req && req.template) || req;
      const name = t && (t.name || t.templateName || t.template_name);
      if (!name) continue;
      if (!templates.has(name)) templates.set(name, { count: 0, sample: t });
      templates.get(name).count += 1;
    }
  });

  const decoder = new TextDecoder('utf-8');
  for await (const chunk of bodyChunks(res)) {
    bytes += chunk.length;
    push(decoder.decode(chunk, { stream: true }));
    // Enough to characterise every template in circulation. There is no reason
    // to pull half a gigabyte to answer a structural question.
    if (withTemplates >= SAMPLE_TARGET) break;
  }

  say(`Read ${seen.toLocaleString()} variants (${(bytes / 1024 / 1024).toFixed(1)} MB) to reach `
    + `${withTemplates.toLocaleString()} that require a template.`);
  say();

  if (!firstExample) {
    say('**No variant in the sample carried a template requirement.** The field name has probably '
      + 'changed. Keys on a sampled variant, so the next run knows where to look:');
    say();
    say('```');
    say(JSON.stringify(sampleKeys));
    say('```');
    say();
    return;
  }

  say('### The exact shape of a template requirement');
  say();
  say('```json');
  say(JSON.stringify(firstExample, null, 2).slice(0, 2500));
  say('```');
  say();

  const first = firstExample.requires[0];
  const inner = (first && first.template) || first || {};
  const keys = Object.keys(inner);
  say(`Fields on the template object: \`${keys.join('`, `') || '(none)'}\``);
  say();

  // The decisive question: is there something a card could be tested against?
  const resolvable = keys.filter((k) => /scryfall|query|api|cards?$/i.test(k));
  if (resolvable.length) {
    say('**Resolvable.** These fields look like they define which cards satisfy it: '
      + `\`${resolvable.join('`, `')}\`.`);
    for (const k of resolvable) say(`  - \`${k}\`: ${JSON.stringify(inner[k]).slice(0, 300)}`);
    say();
    say('If one of those is a Scryfall query, a card like Hammerhead, Maggia Boss could satisfy the '
      + 'template without anyone authoring a combo for it — which would be the answer.');
  } else {
    say('**Not resolvable from the bulk export alone.** No field on the template names a query or a '
      + 'card list, so deciding whether a given card satisfies it needs their API.');
  }
  say();

  say(`### Distinct templates in the sample (${templates.size})`);
  say();
  say('| uses | template |');
  say('|---:|---|');
  [...templates.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 40)
    .forEach(([name, v]) => say(`| ${v.count} | ${name} |`));
  say();
}

// ---- part 2: where the other sites get their combos ------------------------

const TARGETS = [
  { host: 'edhrec.com', path: '/combos/hammerhead-maggia-boss' },
  { host: 'edhoptimizer.com', path: '/en/commander/hammerhead-maggia-boss/' },
];

// Deliberately simple, and deliberately cautious: any Disallow line whose path
// prefixes ours counts, whether it sits in a "*" group or not. Over-blocking is
// the safe failure here.
function disallowed(robots, path) {
  const rules = [];
  for (const raw of String(robots).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^Disallow:\s*(\S*)$/i);
    if (m && m[1]) rules.push(m[1]);
  }
  return rules.filter((rule) => path.startsWith(rule.replace(/\*.*$/, '')));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(target) {
  const base = `https://${target.host}`;
  say(`### ${target.host}`);
  say();

  let robots = '';
  try {
    const res = await fetch(base + '/robots.txt', { headers: { 'User-Agent': UA } });
    robots = res.ok ? await res.text() : '';
    say(`\`robots.txt\` → HTTP ${res.status}${res.ok ? '' : ' (treating as no rules)'}`);
  } catch (err) {
    say(`\`robots.txt\` could not be read (${err.message}) — **not fetching anything else from this host.**`);
    say();
    return;
  }

  const blocked = disallowed(robots, target.path);
  if (blocked.length) {
    say(`**\`${target.path}\` is disallowed** by: \`${blocked.join('`, `')}\` — not fetching it.`);
    say();
    say('That is itself an answer: their combo pages are not open to automated reading, so any '
      + 'use of their data needs to go through an API or a conversation, not a scraper.');
    say();
    return;
  }
  say(`\`${target.path}\` is not disallowed by robots.txt. Fetching it once.`);

  await wait(2000); // one page, unhurried
  let html = '';
  try {
    const res = await fetch(base + target.path, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    say(`Page → HTTP ${res.status}`);
    if (!res.ok) { say(); return; }
    html = await res.text();
  } catch (err) {
    say(`Page could not be read: ${err.message}`);
    say();
    return;
  }

  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1].trim();
  say(`Title: \`${title.slice(0, 160)}\``);
  say(`Size: ${(html.length / 1024).toFixed(0)} KB`);

  const mentions = [
    'Commander Spellbook', 'commanderspellbook', 'Scryfall', 'EDHREC', 'edhrec',
    'Hammerhead', 'Maggia', 'sacrifice',
  ].filter((needle) => html.toLowerCase().includes(needle.toLowerCase()));
  say(`Mentions: ${mentions.length ? '`' + mentions.join('`, `') + '`' : '(none of the ones looked for)'}`);

  // The distinction that settles it: is the card a *piece* of the listed
  // combos, or just the commander the page is about?
  const hammerheadCount = (html.match(/Hammerhead/gi) || []).length;
  say(`"Hammerhead" appears ${hammerheadCount} time(s) in the HTML.`);
  if (hammerheadCount <= 3) {
    say('Few enough that it is probably only the page heading — i.e. these are combos *playable in* '
      + 'a Hammerhead deck, not combos *containing* him.');
  } else {
    say('Often enough that he is plausibly named inside the combos themselves — worth reading the '
      + 'excerpt below.');
  }

  // A short, human-readable excerpt around the first mention, so a person can
  // judge rather than trusting a heuristic.
  const idx = html.search(/Hammerhead/i);
  if (idx > -1) {
    const text = html.slice(Math.max(0, idx - 400), idx + 1200)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    say();
    say('Excerpt around the first mention:');
    say('```');
    say(text.slice(0, 900));
    say('```');
  }

  // Client-rendered pages hand the answer over in their bootstrap payload.
  const nextData = html.match(/id="__NEXT_DATA__"[^>]*>([\s\S]{0,1200})/);
  if (nextData) {
    say();
    say('This is a Next.js page; the first part of its data payload:');
    say('```json');
    say(nextData[1].slice(0, 800));
    say('```');
  }
  say();
}

async function main() {
  say('# Where combos come from — research run');
  say();
  say(`Run at ${new Date().toISOString()} from a GitHub Actions runner, which has the open network `
    + 'access a development machine here does not.');
  say();

  try {
    await inspectTemplates();
  } catch (err) {
    say(`Template inspection failed: ${err.message}`);
    say();
  }

  say('## 2. Where EDHREC and EDHOptimizer get combos Spellbook does not have');
  say();
  say('One page per host, robots.txt checked first. Reading to find attribution, not collecting data.');
  say();
  for (const target of TARGETS) {
    try {
      await probe(target);
    } catch (err) {
      say(`### ${target.host}`);
      say(`Probe failed: ${err.message}`);
      say();
    }
    await wait(3000);
  }

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) require('node:fs').appendFileSync(summary, out.join('\n') + '\n');
}

main().catch((err) => {
  console.error('Research run failed:', err);
  process.exit(1);
});
