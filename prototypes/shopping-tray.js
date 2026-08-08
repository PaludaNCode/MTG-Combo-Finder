// The two controls that only shape B has: opening the tray, and pinning it to the
// window so it can be judged as a thing that follows you rather than as a rectangle.
//
// Kept out of shopping-proto.js because that file is the part all three prototypes
// share, and a comparison is worth less the moment one arm quietly carries code the
// others do not.
(function () {
  'use strict';

  // Open/close. `hidden` rather than a height transition, and the reason is in the
  // stylesheet beside .proto-tray-list: a collapsed container lays nothing out, so a
  // check that measures the list without pressing this first measures zeroes and
  // passes. Whatever ships here, its checker presses the toggle.
  document.querySelectorAll('[data-tray-toggle]').forEach((button) => {
    const tray = button.closest('.proto-tray');
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      button.textContent = open ? 'Show list ▴' : 'Hide list ▾';
      let list = tray.querySelector('.proto-tray-list');
      if (!list) {
        // The closed tray in the first mock has no list in its markup at all, which is
        // the honest shape: there is nothing to hide until there is something to show.
        list = document.createElement('div');
        list.className = 'proto-tray-list';
        list.innerHTML = '<div class="proto-tray-row"><span class="proto-qty">1</span>'
          + '<span class="proto-basket-name">Herd Baloth</span>'
          + '<span class="proto-in">in 18 combos</span></div>'
          + '<div class="proto-tray-row"><span class="proto-qty">1</span>'
          + '<span class="proto-basket-name">Ashnod’s Altar</span>'
          + '<span class="proto-in">in 11 combos</span></div>'
          + '<div class="proto-tray-row"><span class="proto-qty">1</span>'
          + '<span class="proto-basket-name">Cleric Class</span>'
          + '<span class="proto-in">in 10 combos</span></div>';
        tray.insertBefore(list, tray.firstChild);
        return;
      }
      list.hidden = open;
    });
  });

  // Pinning. Toggles a class on <body> rather than styling the element here, because
  // the padding the page needs and the position the tray takes are one decision — the
  // tray covering the footer forever is what happens when they are two.
  document.querySelectorAll('[data-dock]').forEach((button) => {
    button.addEventListener('click', () => {
      const real = document.querySelector('[data-real-tray]');
      const docked = document.body.classList.toggle('proto-docked');
      if (real) real.hidden = !docked;
    });
  });
})();
