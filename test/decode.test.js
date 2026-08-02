'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { decode } = require('../combos.js');

// The published payload interns the two fields that repeat — card names in `c`,
// result strings in `p` — into tables at the top of the file. decode() is the only
// thing that knows: it resolves the indices once, on the way out of JSON.parse, and
// every other line in this repository goes on reading strings.
//
// Worth testing properly despite being nine lines, because it sits between the
// download and everything else. A decode that quietly produces `undefined` for one
// index does not throw; it renders a combo with a blank card in it.

const interned = () => ({
  updatedAt: '2026-08-02T00:00:00Z',
  names: ['Basalt Monolith', 'Rings of Brighthearth', 'Scurry Oak'],
  results: ['Infinite colorless mana', 'Infinite creature tokens'],
  combos: [
    { id: 'a', c: [0, 1], p: [0], i: 'C' },
    { id: 'b', c: [2], p: [1, 0], i: 'G' },
  ],
});

test('indices become the strings they point at', () => {
  const data = decode(interned());
  assert.deepStrictEqual(data.combos[0].c, ['Basalt Monolith', 'Rings of Brighthearth']);
  assert.deepStrictEqual(data.combos[0].p, ['Infinite colorless mana']);
  assert.deepStrictEqual(data.combos[1].c, ['Scurry Oak']);
  assert.deepStrictEqual(data.combos[1].p, ['Infinite creature tokens', 'Infinite colorless mana']);
});

// The whole point. If these were separate strings the payload would be back to
// half a million of them and 69 MB of heap, which is the thing interning exists to
// avoid — so it is asserted rather than assumed.
test('every occurrence is the same string object, which is where the memory goes', () => {
  const data = decode({
    names: ['Infinite ETB'],
    results: ['Infinite ETB'],
    combos: [{ id: 'a', c: [0], p: [0] }, { id: 'b', c: [0], p: [0] }],
  });
  const [first, second] = data.combos;
  // Object identity, not equality: two equal strings would pass a deepStrictEqual
  // and fail the only thing this is for.
  assert.ok(first.c[0] === second.c[0]);
  assert.ok(first.p[0] === second.p[0]);
});

// Order carries nothing in `c` — the page sorts card names itself — but `p` is
// ranked, and reordering it would change which result a row leads with.
test('order within a row survives', () => {
  const data = decode({
    names: ['A', 'B'],
    results: ['first', 'second', 'third'],
    combos: [{ id: 'a', c: [1, 0], p: [2, 0, 1] }],
  });
  assert.deepStrictEqual(data.combos[0].c, ['B', 'A']);
  assert.deepStrictEqual(data.combos[0].p, ['third', 'first', 'second']);
});

// The tables are dropped on the way out, which is what makes a second call safe —
// and a second call happens, because more than one tool loads the same file.
test('decoding twice is decoding once', () => {
  const data = decode(interned());
  assert.strictEqual(data.names, undefined);
  assert.strictEqual(data.results, undefined);
  const again = decode(data);
  assert.deepStrictEqual(again.combos[0].c, ['Basalt Monolith', 'Rings of Brighthearth']);
});

// The fixtures are written with plain strings, and so is any combos.json produced
// before the tables existed. Both have to keep working, or every test in this
// repository would need rewriting to test the shipped path.
test('a payload with no tables is handed back untouched', () => {
  const plain = { combos: [{ id: 'a', c: ['Sol Ring'], p: ['Ramp'] }] };
  const out = decode(plain);
  assert.strictEqual(out, plain);
  assert.deepStrictEqual(out.combos[0].c, ['Sol Ring']);
});

test('nothing at all is not an error', () => {
  assert.strictEqual(decode(null), null);
  assert.strictEqual(decode(undefined), undefined);
  assert.deepStrictEqual(decode({ names: ['A'], results: [] }), {});
});

// A row without one of the fields keeps not having it, rather than gaining an
// empty array that the rest of the code would then have to distinguish from a
// genuinely empty one.
test('a field a row does not have stays absent', () => {
  const data = decode({ names: ['A'], results: ['r'], combos: [{ id: 'a', c: [0] }] });
  assert.deepStrictEqual(data.combos[0].c, ['A']);
  assert.ok(!('p' in data.combos[0]));
});

// Not a shape decode() should ever see — tools/check-snapshot.js refuses to publish
// a payload whose indices do not land — but if one arrives, it is better to know
// what happens than to find out from a blank combo on the page.
test('an index past the end of the table resolves to undefined, not a throw', () => {
  const data = decode({ names: ['A'], results: [], combos: [{ id: 'a', c: [0, 9], p: [3] }] });
  assert.deepStrictEqual(data.combos[0].c, ['A', undefined]);
  assert.deepStrictEqual(data.combos[0].p, [undefined]);
});
