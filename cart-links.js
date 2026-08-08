// Where to buy the cards this page just recommended.
//
// The whole of the store integration is here: what a basket looks like as text, which
// stores have a URL contract we can build, and how an affiliate id is attached. Two
// call sites use it — the Buy link on a suggestion row (render-rows.js) and the
// "Cards you've added" panel (render-suggestions.js) — and they differ only in the
// basket they hand over and the `subid` they tag it with.
//
// One builder rather than two is the point. A row link and a basket button that build
// URLs by different routes will eventually disagree about quantity, about escaping, or
// about which affiliate id is on them, and the one that disagrees is invisible: a wrong
// affiliate link still opens a working store page and still fills a cart. Nothing on
// screen or in a test would say the money had stopped arriving.
//
// No network, no DOM, no state — so `node --test` can reach all of it, which is where
// test/cart-links.test.js lives.
(function (global) {
  'use strict';

  // A basket entry is `{ quantity, card }` — the shape DeckParser already hands back for
  // a decklist line, so a basket *is* a decklist and every store's paste-a-list importer
  // already accepts one. That is not a coincidence to engineer around; it is why the
  // plain-text list below is a first-class action and not a consolation prize.
  function line(entry) {
    return entry.quantity + ' ' + entry.card;
  }

  // The plain-text list. This is the export that works for every reader, in every
  // region, forever — somebody buying at their local shop, pasting into a spreadsheet,
  // or using a store this file has never heard of — and it is the fallback every branch
  // below falls back to. It is offered first in the UI for that reason.
  function asText(basket) {
    return basket.map(line).join('\n');
  }

  function totalCards(basket) {
    return basket.reduce((n, entry) => n + (entry.quantity || 0), 0);
  }

  // A ceiling on the URL a store link may reach, past which the link is not offered at
  // all and the reader is left with the copy.
  //
  // 2,000 is well inside what every current browser accepts and is not the real limit —
  // the real limit is whatever the store's own front end truncates at, which is not
  // documented and not discoverable from here. A basket long enough to matter is rare:
  // 15 suggestions at this page's average card name is about 400 characters. What must
  // not happen is a link that silently arrives at the store carrying two thirds of the
  // list, because a cart with four of your six cards in it looks exactly like a cart
  // with all of them. Refusing is visible; truncating is not.
  const MAX_URL = 2000;

  // ---- affiliate ------------------------------------------------------------
  //
  // Deliberately a separate step from building the destination, and the reason is not
  // tidiness: **the unwrapped URL is what ships when a programme is not approved yet,
  // has lapsed, or is wrong for the reader's region.** A store link that stops earning
  // is a working feature; a store link that stops working is a bug on the page. Keeping
  // them apart is what makes the first outcome the failure mode.
  //
  // Turning this on is a two-line edit — `enabled: true` and the real ids — and it is a
  // deliberate act by somebody with an account, not something a code change should do by
  // accident. Until then every Buy button on the site is an ordinary store link, which
  // is a feature that works and earns nothing.
  //
  // The placeholders are intentionally not plausible-looking. An id that looks real is
  // an id somebody assumes was checked. README § *Buying the cards the page recommends*.
  const AFFILIATE = {
    tcgplayer: {
      enabled: false,
      // TCGplayer's programme runs through Impact, whose tracking links are a redirect
      // host carrying the destination as a parameter rather than a parameter bolted onto
      // the destination. The exact host and the three ids come from the Impact dashboard
      // on approval — this is the shape to fill in, not a shape to trust.
      host: 'https://tcgplayer.pxf.io/c/PUBLISHER_ID/CAMPAIGN_ID/MEDIA_ID',
      param: 'u',
    },
  };

  function wrap(destination, storeId) {
    const cfg = AFFILIATE[storeId];
    if (!cfg || !cfg.enabled) return destination;
    return cfg.host + '?' + cfg.param + '=' + encodeURIComponent(destination);
  }

  // How a placement is told apart in the affiliate network's own reporting — and on this
  // site it is the *only* conversion signal that exists. The page carries no analytics
  // and cannot: a third-party tag would breach the CSP both HTML files set
  // (`default-src 'none'`, `script-src 'self'`). So every button passes a subid naming
  // the shape it came from, and "which placement earns" is answered off the network's
  // dashboard rather than off anything this page records about its readers.
  //
  // It rides on the destination rather than on the wrapper because the destination is
  // what survives `enabled: false` — otherwise the tag would vanish exactly while the
  // links are unwrapped, which is the period somebody most wants to know what they do.
  function withSubid(url, subid) {
    if (!subid) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'subid=' + encodeURIComponent(subid);
  }

  // ---- the stores -----------------------------------------------------------
  //
  // One entry, for now, and that is a decision rather than a stub.
  //
  // TCGplayer's Mass Entry takes a quantity-and-name list in the query string, so a
  // basket becomes a cart in one ordinary link — no API, no key, no new origin in the
  // CSP, since navigation is not something a content policy restricts.
  //
  // Card Kingdom and Cardmarket are deliberately absent. Card Kingdom's deck builder may
  // be POST-only, and a POST to another origin is not an <a href> — it is a form, and
  // `form-action` does not inherit from `default-src`, so neither page's policy currently
  // says what happens. Cardmarket's want-list import appears to sit behind a login, and a
  // button that opens a sign-in page is worse than no button: it looks like the feature
  // working. Neither can be settled from this sandbox — every store host 403s at CONNECT
  // here — so neither ships. Adding one is a data edit to this array plus a person who
  // has opened the URL in a browser and watched a cart fill.
  //
  // A reader outside the US is served by the copy, which is why the copy is the primary
  // action in every shape this appears in.
  const STORES = [
    {
      id: 'tcgplayer',
      label: 'TCGplayer',
      region: 'US',
      build(basket) {
        return 'https://www.tcgplayer.com/massentry?productline=Magic&c='
          + encodeURIComponent(basket.map(line).join('||'));
      },
    },
  ];

  // What to offer for this basket. One entry per store, `href: null` where the link
  // would be over the ceiling — which the UI must render as something other than a dead
  // link, because an <a> with no href is not focusable and reads as nothing.
  function offers(basket, subid) {
    if (!basket || !basket.length) return [];
    return STORES.map((store) => {
      const destination = withSubid(store.build(basket), subid);
      const href = wrap(destination, store.id);
      return {
        id: store.id,
        label: store.label,
        region: store.region,
        href: href.length > MAX_URL ? null : href,
      };
    });
  }

  const api = { line, asText, totalCards, offers, wrap, withSubid, STORES, AFFILIATE, MAX_URL };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.CartLinks = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
