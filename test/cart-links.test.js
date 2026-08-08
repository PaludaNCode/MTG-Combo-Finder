'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Cart = require('../cart-links.js');

// What a store link is made of. Nothing here can prove that TCGplayer accepts the URL —
// that needs a browser and an account, and every store host 403s at CONNECT from the
// sandbox this was written in — so these check the half that *is* checkable: that the
// list is escaped, that both call sites build the same string, that a subid survives
// wrapping, and that an over-long basket refuses rather than truncating.
//
// README § *Buying the cards the page recommends* is where the unverified half is
// written down, and it is written down rather than tested because a test asserting a
// guess is worse than no test: it makes the guess look settled.

const BASKET = [
  { quantity: 1, card: 'Herd Baloth' },
  { quantity: 1, card: "Ashnod's Altar" },
  { quantity: 2, card: 'Cleric Class' },
];

test('cart-links: the text list is a decklist', () => {
  // The whole reason a basket entry is `{ quantity, card }` — DeckParser's own shape —
  // is that the copy is then a decklist, which every store's paste-a-list importer
  // accepts and every spreadsheet survives.
  assert.strictEqual(Cart.asText(BASKET), "1 Herd Baloth\n1 Ashnod's Altar\n2 Cleric Class");
  assert.strictEqual(Cart.totalCards(BASKET), 4);
});

test('cart-links: an empty basket offers nothing', () => {
  // Not "a link to an empty cart". The panel is absent in this state anyway, but a
  // builder that produced a URL here would be one refactor away from shipping it.
  assert.deepStrictEqual(Cart.offers([], 'basket-panel'), []);
  assert.deepStrictEqual(Cart.offers(null, 'basket-panel'), []);
});

test('cart-links: the mass-entry list is escaped, quantities included', () => {
  const [offer] = Cart.offers(BASKET, 'basket-panel');
  assert.strictEqual(offer.id, 'tcgplayer');
  // The apostrophe and the separator are the two things a hand-rolled builder gets
  // wrong. `||` between entries, and every entry "<qty> <name>".
  const list = decodeURIComponent(new URL(offer.href).searchParams.get('c'));
  assert.strictEqual(list, "1 Herd Baloth||1 Ashnod's Altar||2 Cleric Class");
});

test('cart-links: the subid names the placement and survives', () => {
  const [panel] = Cart.offers(BASKET, 'basket-panel');
  const [row] = Cart.offers([{ quantity: 1, card: 'Herd Baloth' }], 'row-buy');
  assert.strictEqual(new URL(panel.href).searchParams.get('subid'), 'basket-panel');
  assert.strictEqual(new URL(row.href).searchParams.get('subid'), 'row-buy');
  // The only conversion signal this site has — it carries no analytics and cannot, so a
  // placement that forgets its tag is a placement nobody can tell apart from another.
});

test('cart-links: the two call sites build the same URL for the same basket', () => {
  // The point of one builder. A row link and a panel button that disagreed about
  // escaping would both still open a working store page, so nothing on screen and no
  // other test here would ever say the money had stopped arriving.
  const one = Cart.offers([{ quantity: 1, card: "Ashnod's Altar" }], 'x')[0].href;
  const two = Cart.offers([{ quantity: 1, card: "Ashnod's Altar" }], 'x')[0].href;
  assert.strictEqual(one, two);
});

test('cart-links: affiliate wrapping is off, and off means an ordinary store link', () => {
  // The shipped state. Until somebody has an account, every Buy button is a plain link
  // to the store — a feature that works and earns nothing, which is the failure mode
  // this split exists to produce. The opposite arrangement fails by breaking the button.
  assert.strictEqual(Cart.AFFILIATE.tcgplayer.enabled, false);
  const [offer] = Cart.offers(BASKET, 'basket-panel');
  assert.ok(offer.href.startsWith('https://www.tcgplayer.com/massentry?'), offer.href);
  assert.ok(!offer.href.includes('PUBLISHER_ID'), 'a placeholder id reached a live URL');
});

test('cart-links: wrapping carries the destination whole, subid included', () => {
  // What flipping `enabled` does, without flipping it globally. The destination is
  // encoded into the wrapper's parameter, so the subid rides inside it rather than
  // being dropped — the tag is most wanted exactly while the links are unwrapped.
  const destination = Cart.withSubid('https://www.tcgplayer.com/massentry?c=x', 'basket-panel');
  const cfg = Cart.AFFILIATE.tcgplayer;
  const wrapped = Cart.wrap(destination, 'tcgplayer');
  assert.strictEqual(wrapped, destination, 'disabled must be a pass-through');

  cfg.enabled = true;
  try {
    const live = Cart.wrap(destination, 'tcgplayer');
    assert.ok(live.startsWith(cfg.host + '?u='), live);
    assert.strictEqual(decodeURIComponent(live.split('?u=')[1]), destination);
  } finally {
    cfg.enabled = false;
  }
});

test('cart-links: an over-long basket refuses rather than truncating', () => {
  // The one failure worth designing for. A cart holding four of your six cards looks
  // exactly like a cart holding all six, so a link that silently arrives short is
  // invisible; a missing link is not, and the panel says to use Copy list instead.
  const huge = Array.from({ length: 200 }, (_, i) => ({ quantity: 1, card: 'Card Number ' + i }));
  const [offer] = Cart.offers(huge, 'basket-panel');
  assert.strictEqual(offer.href, null);
  // …and the copy still works, which is the whole fallback.
  assert.strictEqual(Cart.asText(huge).split('\n').length, 200);
});

test('cart-links: only stores with a URL contract somebody could check are shipped', () => {
  // Card Kingdom may be POST-only — and `form-action` does not inherit from
  // `default-src`, so neither page's CSP currently says what a cross-origin POST does.
  // Cardmarket's want-list import appears to need a login, and a button opening a
  // sign-in page is worse than no button: it looks like the feature working.
  // Neither is settleable from this sandbox, so neither ships. Adding one is a data
  // edit plus a person who has watched a cart fill.
  assert.deepStrictEqual(Cart.STORES.map((s) => s.id), ['tcgplayer']);
});
