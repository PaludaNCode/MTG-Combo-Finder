// Wiring shared by all three shopping prototypes, so that the buttons on them are
// real rather than drawn. Clicking Copy list really copies; the store buttons carry
// the URL that shopping-cart-links.js actually builds, and the page prints it
// underneath so it can be read, pasted into a browser and settled.
//
// That last part is the reason this file exists at all. A mock of a Buy button proves
// nothing about the only genuinely uncertain half of this feature — whether a store's
// mass-entry URL takes a five-card list and fills a cart with it. These pages hand you
// the string to test with.
//
// Markup contract, one attribute each:
//
//   [data-cart-actions="<subid>"]   store buttons are appended here
//   [data-cart-copy]                copies the basket as text
//   [data-cart-built]               the built URL is printed here
//
// The basket is the same five cards on every page — the tuning deck's top suggestions,
// measured 8 Aug 2026 — because the three prototypes are a comparison and a comparison
// with different contents in each arm is not one.
(function () {
  'use strict';

  const BASKET = [
    { qty: 1, name: 'Herd Baloth' },
    { qty: 1, name: "Ashnod's Altar" },
    { qty: 1, name: 'Cleric Class' },
    { qty: 1, name: 'Light of Promise' },
    { qty: 1, name: 'Pitiless Plunderer' }
  ];

  const Cart = window.CartLinks;
  if (!Cart) return;

  function storeButton(offer, printTo) {
    // A store with no URL contract gets a span, not an anchor. An <a> with no href is
    // not focusable and reads as nothing to a screen reader, and an <a> pointing at a
    // login page is worse than either — it looks like the feature working.
    if (!offer.href) {
      const dead = document.createElement('span');
      dead.className = 'proto-store is-listonly';
      dead.title = offer.label + ' has no public list-import URL — use Copy list.';
      dead.textContent = offer.label;
      const region = document.createElement('span');
      region.className = 'proto-region';
      region.textContent = ' ' + offer.region + ' · list only';
      dead.appendChild(region);
      return dead;
    }

    const a = document.createElement('a');
    a.className = 'proto-store';
    a.href = offer.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Buy on ' + offer.label;

    const region = document.createElement('span');
    region.className = 'proto-region';
    region.textContent = ' ' + offer.region;
    a.appendChild(region);

    if (!offer.verified) {
      const flag = document.createElement('span');
      flag.className = 'proto-unverified';
      flag.title = 'This URL format has never been opened in a browser from here — '
        + 'every store host 403s at CONNECT in this sandbox. Click it and find out.';
      flag.textContent = 'unverified';
      a.appendChild(flag);
    }

    // Printing the URL rather than only linking it: the click opens a tab that this
    // sandbox cannot reach, and the string is the thing worth carrying away.
    if (printTo) {
      a.addEventListener('mouseenter', () => { printTo.textContent = offer.href; });
      a.addEventListener('focus', () => { printTo.textContent = offer.href; });
    }
    return a;
  }

  document.querySelectorAll('[data-cart-actions]').forEach((host) => {
    const subid = host.getAttribute('data-cart-actions');
    const printTo = document.querySelector('[data-cart-built]');
    Cart.offers(BASKET, subid).forEach((offer) => host.appendChild(storeButton(offer, printTo)));
    if (printTo) {
      printTo.textContent = 'Hover or focus a store button to read the URL it builds. '
        + 'subid on this page: ' + subid;
    }
  });

  document.querySelectorAll('[data-cart-copy]').forEach((button) => {
    button.addEventListener('click', () => {
      const text = Cart.asText(BASKET);
      const done = () => {
        const was = button.textContent;
        button.textContent = 'Copied ' + Cart.totalCards(BASKET) + ' cards';
        setTimeout(() => { button.textContent = was; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        done();
      }
    });
  });
})();
