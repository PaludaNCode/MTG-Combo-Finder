// The one place a store's URL is spelled out — shared by all three shopping
// prototypes so that "what does the Buy button actually do" has a single answer.
//
// This is the part of the feature that is *not* a design question. Whichever of the
// three shapes wins, the thing behind the button is this module, and putting it here
// rather than three times over is the difference between choosing a layout and
// choosing a layout plus three drifting URL builders.
//
// ============================================================================
// NOTHING IN HERE HAS BEEN VERIFIED AGAINST A LIVE STORE.
// ============================================================================
// Every store host 403s at CONNECT from this sandbox — probed 8 Aug 2026:
//
//     www.tcgplayer.com   000 (blocked)
//     www.cardkingdom.com 000 (blocked)
//     www.cardmarket.com  000 (blocked)
//
// So each entry below carries `verified: false` and a `check` string naming exactly
// what somebody has to do to settle it. That is the honest state and it is also the
// point: a URL contract nobody has opened in a browser is a guess wearing a function
// signature, and this repository's whole culture is that an unmeasured number gets
// labelled rather than shipped. Flip `verified` to a date when you have pasted the
// built URL into a real browser and watched a real cart fill.
//
// prototypes/shopping.md § "What is not verified" is the list of what that costs.
(function (global) {
  'use strict';

  // A basket entry is `{ qty, name }` — the same shape DeckParser already hands back
  // for a decklist line, so a basket is a decklist and every store's paste-a-list
  // importer already accepts it. That is not a coincidence worth engineering around;
  // it is why "copy the list" is a first-class action rather than a consolation prize.
  function line(entry) {
    return entry.qty + ' ' + entry.name;
  }

  // The plain-text list, which is the *primary* export and the fallback for every
  // store below. Somebody buying at their local shop, pasting into a spreadsheet, or
  // using a store this module has never heard of is served by this and nothing else.
  function asText(basket) {
    return basket.map(line).join('\n');
  }

  function totalCards(basket) {
    return basket.reduce((n, entry) => n + entry.qty, 0);
  }

  // ---- affiliate wrapping ---------------------------------------------------
  //
  // Deliberately a separate step from building the destination URL. Two reasons, and
  // the second is the one that matters:
  //
  //  1. The destination is testable on its own — paste it in a browser, watch the cart
  //     fill — without any affiliate account existing yet.
  //  2. **The unwrapped URL is what ships if the programme is not approved, lapses, or
  //     is wrong for the reader's region.** A store link that stops working because an
  //     affiliate id went stale is a broken feature; a store link that merely stops
  //     *earning* is a working feature. Keeping them apart is what makes the second
  //     outcome the failure mode rather than the first.
  //
  // The placeholder is intentionally not a plausible-looking id: an id that looks real
  // is an id somebody assumes was checked.
  const AFFILIATE = {
    // TCGplayer's programme runs through Impact, so the wrapper is a redirect host that
    // takes the destination as a query parameter rather than a parameter added to the
    // destination itself. Shape below is UNVERIFIED — see the banner at the top.
    tcgplayer: {
      enabled: false,
      host: 'https://tcgplayer.pxf.io/c/PUBLISHER_ID/CAMPAIGN_ID/MEDIA_ID',
      param: 'u'
    },
    // Card Kingdom's partner links have historically been a parameter on the ordinary
    // URL rather than a redirect host. UNVERIFIED.
    cardkingdom: {
      enabled: false,
      param: 'partner',
      value: 'PARTNER_ID'
    }
  };

  // subid is how a placement is told apart in the affiliate network's own reporting,
  // and on this site it is the ONLY conversion signal available: the page carries no
  // analytics, and adding a third-party tag would breach the CSP that both HTML files
  // set (`default-src 'none'`). So every button passes one, naming the shape it came
  // from — `basket-panel`, `basket-tray`, `row-buy`, `panel-buy-all` — and the
  // question "which of the three did people use" is answered off the network's
  // dashboard rather than off anything this page records about its readers.
  function withSubid(url, store, subid) {
    if (!subid) return url;
    const glue = url.indexOf('?') === -1 ? '?' : '&';
    // The parameter name differs per network; `subid` is the common spelling and is
    // as unverified as everything else here.
    return url + glue + 'subid=' + encodeURIComponent(store + ':' + subid);
  }

  function wrap(destination, storeId) {
    const cfg = AFFILIATE[storeId];
    if (!cfg || !cfg.enabled) return destination;
    if (cfg.host) return cfg.host + '?' + cfg.param + '=' + encodeURIComponent(destination);
    const glue = destination.indexOf('?') === -1 ? '?' : '&';
    return destination + glue + cfg.param + '=' + encodeURIComponent(cfg.value);
  }

  // ---- the stores -----------------------------------------------------------
  //
  // `method` is load-bearing for the CSP, not just documentation:
  //
  //   'get'   — an ordinary <a href>. Navigation is not restricted by either page's
  //             policy, so this ships with no CSP change at all.
  //   'post'  — a <form method="post" action="…"> pointed off-origin. `form-action`
  //             does NOT inherit from `default-src`, and neither index.html nor
  //             tiers.html names it, so what happens is down to the browser rather
  //             than to a decision anybody here made. If a store needs this, add
  //             `form-action` to the policy explicitly and say which hosts.
  //   'none'  — no public URL contract; the list has to be pasted by hand. Not a
  //             failure of the store, and the reason `asText()` is the primary action.
  const STORES = [
    {
      id: 'tcgplayer',
      label: 'TCGplayer',
      region: 'US',
      method: 'get',
      verified: false,
      check: 'Paste a built URL into a browser and confirm all 5 cards land in the cart.',
      // Mass Entry takes quantity-and-name pairs separated by `||`. UNVERIFIED.
      build(basket) {
        const list = basket.map(line).join('||');
        return 'https://www.tcgplayer.com/massentry?productline=Magic&c=' + encodeURIComponent(list);
      }
    },
    {
      id: 'cardkingdom',
      label: 'Card Kingdom',
      region: 'US',
      method: 'post',
      verified: false,
      check: 'Confirm whether their deck builder accepts a GET. If it is POST-only, '
        + 'the CSP needs form-action before this button can ship.',
      build(basket) {
        // Modelled as a GET so the prototype has something to show. If this turns out
        // to be POST-only the button does not simply "work worse" — it stops being a
        // link, and the CSP question above has to be answered first.
        const list = basket.map(line).join('\n');
        return 'https://www.cardkingdom.com/builder?c=' + encodeURIComponent(list);
      }
    },
    {
      id: 'cardmarket',
      label: 'Cardmarket',
      region: 'EU',
      method: 'none',
      verified: false,
      check: 'Their want-list import is behind a login as far as anybody here knows. '
        + 'If that holds, this store is Copy-list-only and the button should say so '
        + 'rather than opening a page that asks the reader to sign in.',
      build() {
        return null;
      }
    }
  ];

  // What a given shape should offer, given a basket. Returns one entry per store with
  // the URL already wrapped and tagged, and `href: null` where the store has no URL
  // contract — which the UI must render as something other than a dead link.
  function offers(basket, subid) {
    return STORES.map((store) => {
      const destination = store.build(basket);
      return {
        id: store.id,
        label: store.label,
        region: store.region,
        method: store.method,
        verified: store.verified,
        href: destination ? withSubid(wrap(destination, store.id), store.id, subid) : null
      };
    });
  }

  const api = { line, asText, totalCards, offers, wrap, withSubid, STORES, AFFILIATE };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.CartLinks = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
