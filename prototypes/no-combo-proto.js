// Makes the three tabs real, and nothing else. The shipped strip in
// render-suggestions.js does the same three things — is-active, aria-selected,
// roving tabindex — plus arrow keys, which are left out here because what this
// prototype is asking is whether the *grouping* is right, not whether a tablist
// works.
(function () {
  'use strict';

  const tabs = [...document.querySelectorAll('.tab')];
  const panes = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      tabs.forEach((other, j) => {
        const active = i === j;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-selected', String(active));
        other.tabIndex = active ? 0 : -1;
        panes[j].hidden = !active;
      });
    });
  });

  // The panel head folds, because a prototype about a panel that would ship
  // collapsed should let you collapse it.
  const head = document.querySelector('.panel-head');
  head.addEventListener('click', () => {
    const panel = head.closest('.panel');
    const collapsed = !panel.classList.contains('is-collapsed');
    panel.classList.toggle('is-collapsed', collapsed);
    head.setAttribute('aria-expanded', String(!collapsed));
    document.getElementById('panel-nocombo').hidden = collapsed;
  });
}());
