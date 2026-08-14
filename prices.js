// What a card costs, on the rows where the reader might buy one.
//
// A page-only module, like cart-links.js and for the same reason: nothing about a *search*
// needs a price, so this is in index.html and not in search-worker.js. A page without it
// keeps every panel and loses only the figures.
//
// Three things live here and nothing else does: fetching the table once, looking a card up
// in it, and the placeholder a row leaves for a figure that has not arrived yet. Every
// sentence and every formatted number is DeckView's — see priceLabel() there for why.
//
// **The fetch is late on purpose.** prices.json is a second download, and the page's
// first-search budget is already spent on combos.json (7.6 MB against 189 KB, measured
// 14 Aug 2026). So it starts after the results are on screen and the figures appear when
// they appear; nothing waits for them. That is also why a row leaves a placeholder rather
// than asking for a price it may not be able to get: the alternative is either delaying
// every panel or re-rendering them, and a list that re-orders itself under the pointer half
// a second after it appeared is worse than a number arriving late.
(function (global) {
  'use strict';

  const Dom = global.PageDom || (typeof require === 'function' ? require('./page-dom.js') : null);
  const DeckCombos = global.DeckCombos || (typeof require === 'function' ? require('./combos.js') : null);

  // **Resolved at call time, not at load time**, which is the one thing in this file that
  // was got wrong first. view-model.js is loaded *after* this script in index.html —
  // app.js is the only file that needs it in place at load — so a `const DeckView =
  // global.DeckView` here captured undefined, every paint threw, and the throw was
  // swallowed by the fetch's own catch two functions down. The page showed a dangling
  // separator where a figure should have been and reported nothing at all.
  //
  // Every other renderer reads that global inside its functions for the same reason. The
  // require() half is because this module, unlike them, is loaded by the tests.
  const view = () => global.DeckView || (typeof require === 'function' ? require('./view-model.js') : null);

  // What arrived, or null until it has. `pending` is the promise, kept so a second caller
  // joins the first request rather than starting another — every search calls load().
  let table = null;
  let pending = null;

  // Every placeholder currently in the document. Held rather than queried because the rows
  // are rebuilt on every search and a stale node must not be written into: a placeholder
  // from the previous deck is not on screen, and filling it would be work nobody sees.
  // Cleared whenever the results are rebuilt — see forget().
  let waiting = [];

  function of(name) {
    if (!table || !name) return null;
    const key = DeckCombos.nameKey(name);
    const price = table.usd && table.usd[key];
    return typeof price === 'number' && price > 0 ? price : null;
  }

  // The date the figures are from. A price is a fact about a day, so anything that prints
  // one has to be able to say which — the tooltip does.
  const snapshot = () => (table && (table.updatedAt || table.generated)) || null;

  // Fill one placeholder from whatever is known now. Also the whole of what happens when a
  // row is built after the table has arrived, which is why it is not inside the fetch.
  function paint(span) {
    const name = span.getAttribute('data-price-card');
    const price = of(name);
    if (!table) return;
    // A card the table does not cover says so rather than staying blank: blank reads as a
    // page that failed to load something, and this page cannot know a foil-only card's
    // non-foil price. **Never 0, never "free"** — tools/fetch-prices.js explains why the
    // gap exists at all.
    const label = view().priceLabel(price);
    span.textContent = label.text;
    span.title = view().priceTitle(price, snapshot());
    span.classList.toggle('is-unknown', !label.known);
    span.hidden = false;
  }

  // The placeholder a row leaves. Hidden until it has something to say, so a row that never
  // gets a figure looks like a row that was never going to have one.
  function tag(name) {
    const span = Dom.el('span', 'price');
    span.setAttribute('data-price-card', name);
    span.hidden = true;
    if (table) paint(span);
    else waiting.push(span);
    return span;
  }

  // Called by whatever is about to rebuild the results, so the queue does not accumulate
  // one deck's placeholders per search.
  function forget() {
    waiting = [];
  }

  // Start the download, once. Resolves either way: a page with no prices is a page with no
  // figures, which is a state this module is built to be in — the file does not exist on a
  // local checkout, and the deploy is what puts it beside combos.json.
  function load(url) {
    if (pending) return pending;
    // **The catch covers the fetch and nothing else.** It used to wrap the painting too,
    // which turned a load-order mistake in this file into a page that quietly showed no
    // figures and logged nothing — the failure took a screenshot to find. A network that
    // did not answer is expected and silent; a bug in paint() is not, and now it surfaces.
    pending = Promise.resolve()
      .then(() => fetch(url, { headers: { Accept: 'application/json' } }))
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((json) => {
        if (!json || !json.usd) return null;
        table = json;
        // Everything already on screen, then nothing: rows built from here on paint
        // themselves in tag().
        waiting.forEach(paint);
        waiting = [];
        return table;
      });
    return pending;
  }

  // What a basket of cards comes to, for the caption over "Cards you've added". Facts only
  // — the sentence is DeckView.basketPriceNote(), including the part where a total is
  // "about" and never exact.
  function totalOf(entries) {
    let sum = 0;
    let priced = 0;
    let unpriced = 0;
    for (const entry of entries || []) {
      const quantity = Math.max(1, Number(entry && entry.quantity) || 1);
      const price = of(entry && entry.card);
      if (price === null) { unpriced += 1; continue; }
      sum += price * quantity;
      priced += 1;
    }
    return { sum, priced, unpriced, snapshot: snapshot(), known: Boolean(table) };
  }

  const api = { load, of, tag, paint, forget, totalOf, snapshot, loaded: () => Boolean(table) };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    // The tests drive load() and totalOf() over made-up tables, and there is no other way
    // in: the fetch is the only writer. Not part of the browser's surface — it is here
    // because a module whose whole state arrives over the network is otherwise untestable.
    api.__setTable = (t) => { table = t; };
    api.__reset = () => { table = null; pending = null; waiting = []; };
  } else {
    global.CardPrices = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
