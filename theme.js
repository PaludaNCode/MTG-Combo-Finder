'use strict';
// The theme, and the reader's say in it.
//
// Dark is the base. Light used to arrive from `prefers-color-scheme` alone, which
// meant the page decided for you — and browsers report `light` for everyone who has
// never chosen, so the default quietly flipped for most visitors. A control fixes
// that in the honest direction: the system's answer is still what you get until you
// say otherwise, and once you do, that is remembered.
//
// Loaded from <head>, synchronously and before the stylesheet, so the attribute is
// on <html> before anything is painted. A theme applied after first paint is a white
// flash on a dark page. It cannot be an inline script — the CSP here is
// `script-src 'self'` and that is worth more than the one saved request.
//
// The decision itself is three pure functions at the top, exported for the unit
// tests, because "which theme should this be" is worth checking without a browser.
(function (global) {
  const KEY = 'mtg-combo-finder.theme';
  const THEMES = ['dark', 'light'];
  const DEFAULT = 'dark';

  // The reader's choice if they made one, the system's answer otherwise. Junk in
  // storage is not a choice — someone else's key, or a half-written value — so it
  // falls through to the system rather than being applied.
  function resolveTheme(choice, systemAnswer) {
    if (THEMES.includes(choice)) return choice;
    return THEMES.includes(systemAnswer) ? systemAnswer : DEFAULT;
  }

  function otherTheme(theme) {
    return theme === 'light' ? 'dark' : 'light';
  }

  // The button says what pressing it will do, not what the page currently is. Both
  // readings are defensible and this one is testable against the label: a button
  // reading "Light mode" on a light page is a bug either way.
  function labelFor(theme) {
    return otherTheme(theme) === 'light' ? 'Light mode' : 'Dark mode';
  }

  const api = { resolveTheme, otherTheme, labelFor, KEY, THEMES };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return; // node: the decision is all there is to test
  }
  global.DeckTheme = api;

  // ---- the browser half ----------------------------------------------------

  const media = typeof global.matchMedia === 'function'
    ? global.matchMedia('(prefers-color-scheme: light)')
    : null;

  function systemTheme() {
    return media && media.matches ? 'light' : DEFAULT;
  }

  function storedChoice() {
    try {
      return localStorage.getItem(KEY);
    } catch (err) {
      return null; // private mode, or storage turned off
    }
  }

  // Written on <html> rather than <body> so the tokens are in scope for everything,
  // including the scrollbar and the overscroll area that `color-scheme` colours.
  function apply(theme) {
    const root = global.document && global.document.documentElement;
    if (root) root.dataset.theme = theme;
    return theme;
  }

  let current = apply(resolveTheme(storedChoice(), systemTheme()));

  // The icon is chosen by CSS off the same `data-theme` attribute, so nothing here
  // touches the button's contents — writing text into it would delete the two SVGs
  // that are the whole control. What is left is the part CSS cannot do: saying out
  // loud what pressing it will do, for a screen reader and on hover, since an icon
  // on its own says neither.
  function dress(button) {
    button.hidden = false;
    const spoken = 'Switch to ' + labelFor(current).toLowerCase();
    button.title = spoken;
    button.setAttribute('aria-label', spoken);
  }

  function wire() {
    // Every page carrying the stylesheet carries the button; neither has more than
    // one, and a page without it is not an error.
    const button = global.document.getElementById('theme-toggle');
    if (!button) return;
    // Hidden in the markup and shown here: a control that cannot work without this
    // script should not be on screen if the script never arrived.
    dress(button);
    button.addEventListener('click', () => {
      current = apply(otherTheme(current));
      try {
        localStorage.setItem(KEY, current);
      } catch (err) {
        /* the theme still changes for this visit; nothing worth interrupting for */
      }
      dress(button);
    });
  }

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  // Following the system is what "no choice yet" means, so it keeps following —
  // changing the OS setting at noon should move the page with it. Once a choice is
  // stored this does nothing, which is the point of storing one.
  if (media && typeof media.addEventListener === 'function') {
    media.addEventListener('change', () => {
      if (storedChoice()) return;
      current = apply(systemTheme());
      const button = global.document.getElementById('theme-toggle');
      if (button) dress(button);
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
