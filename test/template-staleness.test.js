'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { reportNewTemplates } = require('../tools/fetch-combos.js');

// Generating template lists by hand buys back 23 minutes a night, at the cost of
// going stale when Spellbook adds a template. Stale is invisible — the combos
// needing the new template are simply excluded — so the check that catches it is
// the whole reason the trade is acceptable. These tests are that check.

function capture(combos, templateData) {
  const lines = [];
  const real = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try {
    reportNewTemplates(combos, templateData);
  } finally {
    console.log = real;
  }
  return lines.join('\n');
}

const KNOWN = {
  templates: { 7: 'Persist Creature', 9: 'Free Sacrifice Outlet' },
  unresolvable: { 3: 'Haste Enabler' },
};

test('a template nobody has resolved yet is reported, with its combo count', () => {
  const out = capture([
    { id: 'a', t: [42] },
    { id: 'b', t: [42] },
    { id: 'c', t: [7] },
  ], KNOWN);
  assert.match(out, /1 template\(s\) have no card list/);
  assert.match(out, /2 combos stay excluded/);
  assert.match(out, /id 42: new since the file was generated/);
});

test('nothing is reported when every template is accounted for', () => {
  const out = capture([{ id: 'a', t: [7, 9] }, { id: 'b', t: [] }, { id: 'c' }], KNOWN);
  assert.match(out, /Every template the combos ask for is in templates\.json/);
  assert.doesNotMatch(out, /have no card list/);
});

// The 29 query-less templates are permanent. Reporting them nightly would be a
// warning that always fires, which is a warning nobody reads.
test('templates known to have no query are not reported as new', () => {
  const out = capture([{ id: 'a', t: [3] }, { id: 'b', t: [3] }], KNOWN);
  assert.doesNotMatch(out, /have no card list/);
  assert.match(out, /Every template the combos ask for/);
});

test('ids compare across the string and number forms JSON leaves them in', () => {
  // templates.json round-trips object keys as strings; combos carry numbers.
  const out = capture([{ id: 'a', t: [7] }], KNOWN);
  assert.doesNotMatch(out, /are new/);
});

test('a requirement with no id is counted separately, not as a new template', () => {
  const out = capture([{ id: 'a', t: [null, null] }], KNOWN);
  assert.match(out, /2 combo requirement\(s\) carried no template id/);
  assert.doesNotMatch(out, /have no card list/);
});

test('a missing unresolvable list does not break the check', () => {
  const out = capture([{ id: 'a', t: [7] }], { templates: KNOWN.templates });
  assert.match(out, /Every template the combos ask for/);
});

// Skipped templates are the ones we chose not to resolve because no combo asked
// for them. If a combo starts asking, that must read as "regenerate", not as a
// permanent gap — the distinction is the whole reason skipped is recorded apart
// from unresolvable.
test('a template skipped as unused is reported once a combo needs it', () => {
  const out = capture([{ id: 'a', t: [9] }], {
    templates: { 7: 'Persist Creature' },
    unresolvable: { 3: 'Haste Enabler' },
    skipped: { 9: 'Nonartifact creature with MV <= 5' },
  });
  assert.match(out, /1 template\(s\) have no card list/);
  assert.match(out, /skipped as unused, now in use/);
  assert.match(out, /Nonartifact creature with MV <= 5/);
});

test('a template that never existed is reported as new, not as skipped', () => {
  const out = capture([{ id: 'a', t: [404] }], {
    templates: { 7: 'Persist Creature' },
    unresolvable: {},
    skipped: { 9: 'Nonartifact creature with MV <= 5' },
  });
  assert.match(out, /new since the file was generated/);
  assert.doesNotMatch(out, /skipped as unused/);
});

test('skipping does not make a resolved template look missing', () => {
  const out = capture([{ id: 'a', t: [7] }], {
    templates: { 7: 'Persist Creature' },
    unresolvable: {},
    skipped: { 9: 'Nonartifact creature with MV <= 5' },
  });
  assert.match(out, /Every template the combos ask for/);
});
