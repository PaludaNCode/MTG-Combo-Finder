const test = require('node:test');
const assert = require('node:assert');
const { createVariantScanner, compact } = require('../tools/fetch-combos.js');

// Feeds `text` through the scanner in fixed-size slices, so object boundaries
// land mid-token the way real network chunks do.
function scan(text, chunkSize) {
  const out = [];
  const push = createVariantScanner((v) => out.push(v));
  for (let i = 0; i < text.length; i += chunkSize) {
    push(text.slice(i, i + chunkSize));
  }
  return out;
}

const DOC = JSON.stringify({
  variants: [
    { id: '1', uses: [{ card: { name: 'Basalt Monolith' } }] },
    { id: '2', uses: [{ card: { name: 'Rings of Brighthearth' } }], identity: 'C' },
    { id: '3', uses: [{ card: { name: 'Krark-Clan Ironworks' } }], nested: { deep: { deeper: true } } },
  ],
});

test('scanner: extracts every variant regardless of chunk size', () => {
  for (const size of [1, 3, 7, 16, 64, 4096]) {
    const got = scan(DOC, size);
    assert.strictEqual(got.length, 3, `chunk size ${size}`);
    assert.deepStrictEqual(got.map((v) => v.id), ['1', '2', '3'], `chunk size ${size}`);
  }
});

test('scanner: braces inside strings do not break object boundaries', () => {
  const doc = JSON.stringify({
    variants: [
      { id: 'a', description: 'Tap {T} to add {C}{C}, then untap it' },
      { id: 'b', description: 'A closing brace } and an open one {' },
      { id: 'c', description: 'quote \\" then a brace }' },
    ],
  });
  for (const size of [1, 5, 33]) {
    const got = scan(doc, size);
    assert.deepStrictEqual(got.map((v) => v.id), ['a', 'b', 'c'], `chunk size ${size}`);
    assert.strictEqual(got[0].description, 'Tap {T} to add {C}{C}, then untap it');
  }
});

test('scanner: escaped backslash before a quote is handled', () => {
  const doc = JSON.stringify({ variants: [{ id: 'x', note: 'ends with backslash \\\\' }, { id: 'y' }] });
  assert.deepStrictEqual(scan(doc, 2).map((v) => v.id), ['x', 'y']);
});

test('scanner: stops at the end of the variants array', () => {
  const doc = '{"variants":[{"id":"1"}],"other":[{"id":"ignored"}]}';
  assert.deepStrictEqual(scan(doc, 4).map((v) => v.id), ['1']);
});

test('scanner: leading keys before variants are skipped', () => {
  const doc = '{"updatedAt":"2026-07-30","count":2,"variants":[{"id":"1"},{"id":"2"}]}';
  assert.deepStrictEqual(scan(doc, 6).map((v) => v.id), ['1', '2']);
});

test('scanner: empty variants array yields nothing', () => {
  assert.deepStrictEqual(scan('{"variants":[]}', 3), []);
});

test('compact: keeps only what the page needs', () => {
  const row = compact({
    id: 42,
    uses: [{ card: { name: 'Basalt Monolith' } }, { card: { name: 'Rings of Brighthearth' } }],
    produces: [{ feature: { name: 'Infinite colorless mana' } }],
    requires: [],
    identity: 'C',
    popularity: 1234,
    description: 'a long description that should not be carried',
  });
  assert.deepStrictEqual(row, {
    id: '42',
    c: ['Basalt Monolith', 'Rings of Brighthearth'],
    p: ['Infinite colorless mana'],
    i: 'C',
    t: undefined,
    pop: 1234,
  });
});

test('compact: records template count and drops cardless variants', () => {
  const withTemplate = compact({
    id: '1',
    uses: [{ card: { name: 'Basalt Monolith' } }],
    requires: [{ template: { name: 'a sacrifice outlet' } }],
  });
  assert.strictEqual(withTemplate.t, 1);
  assert.strictEqual(compact({ id: '2', uses: [] }), null);
});

test('scanner: bare-array documents (Scryfall bulk) are supported', () => {
  const doc = JSON.stringify([
    { name: 'Sol Ring', color_identity: [] },
    { name: 'Kinnan, Bonder Prodigy', color_identity: ['G', 'U'] },
    { name: 'Valki, God of Lies // Tibalt, Cosmic Impostor', color_identity: ['B', 'R'] },
  ]);
  for (const size of [1, 9, 512]) {
    const out = [];
    const push = createVariantScanner((c) => out.push(c), null);
    for (let i = 0; i < doc.length; i += size) push(doc.slice(i, i + size));
    assert.deepStrictEqual(out.map((c) => c.name), [
      'Sol Ring', 'Kinnan, Bonder Prodigy', 'Valki, God of Lies // Tibalt, Cosmic Impostor',
    ], `chunk size ${size}`);
    assert.deepStrictEqual(out[1].color_identity, ['G', 'U']);
  }
});

test('scanner: a keyed document still ignores earlier arrays', () => {
  const doc = '{"other":[{"id":"skip"}],"variants":[{"id":"keep"}]}';
  const out = [];
  const push = createVariantScanner((v) => out.push(v));
  for (let i = 0; i < doc.length; i += 5) push(doc.slice(i, i + 5));
  assert.deepStrictEqual(out.map((v) => v.id), ['keep']);
});

test('bodyChunks: gzipped bodies are decompressed, plain bodies pass through', async () => {
  const zlib = require('node:zlib');
  const { bodyChunks } = require('../tools/fetch-combos.js');
  const text = '{"name":"Sol Ring","color_identity":[]}\n{"name":"Kinnan","color_identity":["G","U"]}\n';

  const fakeRes = (buf, chunkSize) => ({
    body: (async function* () {
      for (let i = 0; i < buf.length; i += chunkSize) yield buf.subarray(i, i + chunkSize);
    })(),
  });
  const collect = async (res) => {
    let out = '';
    const dec = new TextDecoder('utf-8');
    for await (const c of bodyChunks(res)) out += dec.decode(c, { stream: true });
    return out + dec.decode();
  };

  const gz = zlib.gzipSync(Buffer.from(text));
  for (const size of [1, 13, 4096]) {
    assert.strictEqual(await collect(fakeRes(gz, size)), text, `gzip chunk ${size}`);
    assert.strictEqual(await collect(fakeRes(Buffer.from(text), size)), text, `plain chunk ${size}`);
  }
});
