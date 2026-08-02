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

// ---- rebuilding the combo id ------------------------------------------------
//
// A Spellbook variant id is the combo's card ids ascending joined with `-`, then
// each distinct template id ascending prefixed with `--`. Publishing one id per
// distinct card instead of one composite id per combo was 27.5% of the wire.
//
// Tested harder than its size suggests, for one reason: this builds the URL behind
// "View on Commander Spellbook". A wrong id is not a broken page, it is a link that
// works and shows somebody a different combo.

const { rebuildId } = require('../combos.js');

test('cards ascending, joined with a dash — whatever order the row lists them', () => {
  assert.strictEqual(rebuildId({ c: [0, 1, 2] }, [4559, 413, 7839]), '413-4559-7839');
  assert.strictEqual(rebuildId({ c: [2, 0, 1] }, [4559, 413, 7839]), '413-4559-7839');
});

test('each template id gets its own double dash, ascending', () => {
  assert.strictEqual(rebuildId({ c: [0], t: [112] }, [7839]), '7839--112');
  assert.strictEqual(rebuildId({ c: [0, 1], t: [181, 85] }, [215, 579]), '215-579--85--181');
});

// `t` repeats an id when a combo needs two of that slot filled; the published id
// names it once. Getting this wrong produced 335 wrong links in the first pass.
test('a template needed twice is still named once', () => {
  assert.strictEqual(rebuildId({ c: [0], t: [44, 44] }, [3967]), '3967--44');
});

// compact() records a requirement whose id it could not read as null, deliberately.
// A null must never become "0" in a URL.
test('an unreadable template id refuses to build rather than guessing', () => {
  assert.strictEqual(rebuildId({ c: [0], t: [null] }, [3967]), null);
  assert.strictEqual(rebuildId({ c: [0], t: [44, null] }, [3967]), null);
});

test('a card whose id was never solved refuses too', () => {
  assert.strictEqual(rebuildId({ c: [0, 1] }, [413, null]), null);
  assert.strictEqual(rebuildId({ c: [0, 5] }, [413]), null);
});

test('decode rebuilds the id of a row that arrives without one', () => {
  const data = decode({
    names: ['A', 'B'],
    results: ['r'],
    cardIds: [4559, 413],
    combos: [{ c: [0, 1], p: [0] }],
  });
  assert.strictEqual(data.combos[0].id, '413-4559');
  assert.deepStrictEqual(data.combos[0].c, ['A', 'B'], 'the cards still resolve');
});

// The fetcher only drops an id it has rebuilt and checked, so a row that arrives
// *with* one kept it because it could not be rebuilt. Overwriting it would undo
// the one safeguard the whole scheme rests on.
test('a row that kept its own id keeps it', () => {
  const data = decode({
    names: ['A'],
    results: [],
    cardIds: [null],
    combos: [{ id: 'kept-me', c: [0] }],
  });
  assert.strictEqual(data.combos[0].id, 'kept-me');
});

test('the cardIds table is dropped on the way out, like the others', () => {
  const data = decode({ names: ['A'], results: [], cardIds: [1], combos: [{ c: [0] }] });
  assert.strictEqual(data.cardIds, undefined);
});

// An older payload has ids on every row and no table. Nothing should be touched.
test('a payload with no cardIds leaves every id alone', () => {
  const data = decode({
    names: ['A'],
    results: [],
    combos: [{ id: '413', c: [0] }],
  });
  assert.strictEqual(data.combos[0].id, '413');
});
