// The DOM helpers every renderer needs, and the panel they all sit in.
//
// This file exists because `app.js` was being split up and every piece of it wanted the
// same four lines. Splitting the renderers apart without this first would have meant
// each one solving the dependency its own way — passing helpers in, or quietly keeping a
// second copy — and two copies of `el()` is how two pages stop agreeing about markup.
//
// It follows the same shape as every other module here: an IIFE that publishes one
// global in a browser and `module.exports` under Node. That is not for the unit tests —
// this is DOM code and `node --test` cannot reach it, exactly like `app.js` — it is so
// the shape is uniform and the load order in `index.html` reads the same way.
//
// What belongs here: markup plumbing shared by more than one renderer. What does not:
// anything that decides *what a sentence says* or *how a number is phrased*. That goes
// in `view-model.js`, where a test can reach it. The distinction is the whole reason
// this file is allowed to be untested.
(function (global) {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function link(href, text) {
    const a = el('a', null, text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  // The page's one line of chrome. It lives here rather than in app.js because both the
  // wiring there and the deck I/O split out of it write to the same element, and passing
  // a message-setter through two modules to reach one <p> is more structure than the job
  // needs. It is specific to index.html, which is the only page that loads this file.
  //
  // The local is `node`, not `el`: it used to shadow the helper above, which was harmless
  // and read like a bug every time.
  function setStatus(msg, isError) {
    const node = $('status');
    node.textContent = msg || '';
    node.classList.toggle('error', Boolean(isError));
  }

  // Remember which sections the reader closed, so a new search doesn't reopen
  // everything they just tidied away.
  const COLLAPSE_KEY = 'mtg-combo-finder.collapsed';

  function readCollapsed() {
    try {
      return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {};
    } catch (err) {
      return {}; // private mode, or someone put junk in there
    }
  }

  function writeCollapsed(state) {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state));
    } catch (err) {
      /* not worth bothering the reader about */
    }
  }

  // A titled section whose header is the collapse control. Using a real
  // <button> gets keyboard and screen-reader behaviour for free.
  function panel(container, key, title, count) {
    container.textContent = '';

    const section = el('section', 'panel');
    const head = el('button', 'panel-head');
    head.type = 'button';
    const bodyId = 'panel-' + key;
    head.setAttribute('aria-controls', bodyId);

    head.appendChild(el('span', 'chev', '▸'));
    head.appendChild(el('h2', 'panel-title', title));
    if (count != null) head.appendChild(el('span', 'panel-count', String(count)));

    const body = el('div', 'panel-body');
    body.id = bodyId;

    const apply = (collapsed) => {
      section.classList.toggle('is-collapsed', collapsed);
      head.setAttribute('aria-expanded', String(!collapsed));
      head.title = collapsed ? 'Expand' : 'Collapse';
      body.hidden = collapsed;
    };
    apply(Boolean(readCollapsed()[key]));

    head.addEventListener('click', () => {
      const collapsed = !section.classList.contains('is-collapsed');
      apply(collapsed);
      const state = readCollapsed();
      state[key] = collapsed;
      writeCollapsed(state);
    });

    section.appendChild(head);
    section.appendChild(body);
    container.appendChild(section);
    return body;
  }

  const api = { $, el, link, panel, setStatus, readCollapsed, writeCollapsed, COLLAPSE_KEY };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.PageDom = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
