// The one control only shape C has: a per-row Buy link, which is a single-card basket
// and therefore the same URL builder with a list of one.
//
// That equivalence is the point rather than a convenience. If the row link and the
// basket button build their URLs by different routes they will eventually disagree
// about quantity, about escaping, or about which affiliate id is on them — and the one
// that disagrees is invisible, because a wrong affiliate link still opens a working
// store page. One builder, two call sites, different `subid`.
(function () {
  'use strict';

  const Cart = window.CartLinks;
  if (!Cart) return;

  document.querySelectorAll('[data-buy]').forEach((a) => {
    const name = a.getAttribute('data-buy');
    const offer = Cart.offers([{ qty: 1, name }], 'row-buy')
      .find((o) => o.id === 'tcgplayer');
    if (!offer || !offer.href) return;

    a.href = offer.href;
    a.target = '_blank';
    a.rel = 'noopener';
    // Spelled out for a screen reader and on hover, the same way `.add-card` does it:
    // "Buy" beside two links that read about a card does not say which card, and does
    // not say that this one leaves the site.
    const spoken = 'Buy ' + name + ' on TCGplayer — opens in a new tab';
    a.title = spoken;
    a.setAttribute('aria-label', spoken);

    const printTo = document.querySelector('[data-cart-built]');
    if (printTo) {
      a.addEventListener('mouseenter', () => { printTo.textContent = offer.href; });
      a.addEventListener('focus', () => { printTo.textContent = offer.href; });
    }
  });
})();
