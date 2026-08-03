// The decklist's own comings and goings: keeping it between visits, putting it in a
// shareable link, reading it out of a dropped file, and clearing it.
//
// Split out of app.js because none of it renders anything. It reads and writes two
// textareas, localStorage and the address bar, and the only thing it puts on screen is a
// status line — so a change to how a file is accepted no longer lands in the same file as
// the combo map.
//
// The parsing itself is parser.js and the wording is view-model.js. What is left here is
// the plumbing between them and the DOM, which is why this file is untested for the same
// reason app.js is: `node --test` cannot reach it, and everything worth a test was
// already somewhere it could.
(function (global) {
  'use strict';

  const Dom = global.PageDom || (typeof require === 'function' ? require('./page-dom.js') : null);
  const { $, setStatus } = Dom;

  // ---- keeping the decklist ------------------------------------------------
  //
  // A reload used to lose whatever was pasted in, which is a strange thing for a
  // page whose entire input is a long paste. The list is kept locally — it never
  // leaves the browser — and a link can carry it deliberately.
  const DECK_KEY = 'mtg-combo-finder.deck';

  function saveDeck() {
    try {
      localStorage.setItem(DECK_KEY, JSON.stringify({
        decklist: $('decklist').value,
        commanders: $('commanders').value,
      }));
    } catch (err) {
      /* private mode, or over quota — not worth bothering the reader about */
    }
  }

  // base64url, because a decklist is full of newlines and commas and the URL has
  // to survive being pasted into a chat window.
  function encodeDeck(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeDeck(param) {
    const padded = param.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function shareLink() {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('deck', encodeDeck($('decklist').value));
    const commanders = $('commanders').value.trim();
    if (commanders) url.searchParams.set('cmd', encodeDeck(commanders));
    return url.href;
  }

  // A link wins over the stored list: someone who opens a shared deck means to
  // see that deck, not the one they were last working on.
  function restoreDeck() {
    const params = new URLSearchParams(location.search);
    if (params.has('deck')) {
      try {
        $('decklist').value = decodeDeck(params.get('deck'));
        $('commanders').value = params.has('cmd') ? decodeDeck(params.get('cmd')) : '';
        setStatus('Deck loaded from the link. Press “Find combos”.');
        return;
      } catch (err) {
        setStatus('That shared link’s decklist could not be read — paste the list below instead.', true);
      }
    }
    try {
      const saved = JSON.parse(localStorage.getItem(DECK_KEY)) || {};
      if (saved.decklist) $('decklist').value = saved.decklist;
      if (saved.commanders) $('commanders').value = saved.commanders;
    } catch (err) {
      /* nothing kept, or junk in there */
    }
  }

  function clearDeck() {
    $('decklist').value = '';
    $('commanders').value = '';
    $('deck-url').value = '';
    try {
      localStorage.removeItem(DECK_KEY);
    } catch (err) {
      /* nothing to remove */
    }
    // Leaving ?deck= in the address bar would resurrect the list on reload.
    if (location.search) history.replaceState(null, '', location.pathname);
    $('results').hidden = true;
    $('diagnostics').hidden = true;
    const age = $('data-age');
    if (age) age.hidden = true;
    setStatus('Cleared.');
    $('decklist').focus();
  }

  // ---- a deck that arrives as a file -----------------------------------------
  //
  // Every deck site exports a text file, including the ones whose API a browser
  // can never read — so this is the one import path that works everywhere, and it
  // needs no CORS, no API and no new origin in the CSP.
  //
  // Both ways in, because they are not interchangeable: dragging is the obvious
  // one on a desktop and impossible on a phone or from a keyboard, and the file
  // picker is the one screen readers can drive.
  //
  // Only the wiring is here. Whether a file is worth reading (parser.js
  // acceptDeckFile/looksLikeText) and what the page then says (view-model.js
  // fileLoaded/fileRefusal) live where `node --test` can reach them.
  function refuse(reason, name) {
    setStatus(DeckView.fileRefusal(reason, name, DeckParser.MAX_DECK_FILE_BYTES), true);
  }

  function useDeckFile(file) {
    const verdict = DeckParser.acceptDeckFile(file);
    if (!verdict.ok) {
      refuse(verdict.reason, verdict.name);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => refuse('unreadable', file.name);
    reader.onload = () => {
      const text = String(reader.result || '');
      // The check that matters, and the only honest one: a .txt extension is a
      // claim, and this is the test. A binary file decoded as UTF-8 arrives full
      // of replacement characters and would otherwise land in the box as a wall
      // of lines the parser silently threw away.
      if (!DeckParser.looksLikeText(text)) {
        refuse('unreadable', file.name);
        return;
      }
      const parsed = DeckParser.parseDecklist(text);
      if (!parsed.main.length && !parsed.commanders.length) {
        refuse('no-cards', file.name);
        return;
      }

      // Into the box rather than straight into a search: the reader can see what
      // arrived, fix a line, and press the button themselves. It also means a
      // dropped file behaves exactly like a paste from here on.
      $('decklist').value = text.trim();
      // Commanders marked inline (*CMDR*) are the parser's business and stay in
      // the list; the separate box is only cleared so a previous deck's
      // commanders cannot survive into this one.
      $('commanders').value = '';
      saveDeck();
      setStatus(DeckView.fileLoaded(file.name, {
        main: parsed.main.length,
        commanders: parsed.commanders.length,
        skipped: (parsed.skipped || []).length,
      }));
    };
    reader.readAsText(file);
  }

  function wireDeckFiles() {
    const box = $('decklist');
    const picker = $('deck-file');
    const zone = $('deck-form');

    if (picker) {
      picker.addEventListener('change', () => {
        if (picker.files && picker.files[0]) useDeckFile(picker.files[0]);
        // Cleared so choosing the same file twice fires `change` again — without
        // this, fixing the file and re-picking it does nothing at all.
        picker.value = '';
      });
      const button = $('choose-file');
      if (button) button.addEventListener('click', () => picker.click());
    }

    if (!zone) return;
    // dragover must be cancelled or the browser navigates to the file and the
    // page is simply gone, decklist and all.
    const over = (on) => (e) => {
      if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') === -1) return;
      e.preventDefault();
      box.classList.toggle('dropping', on);
    };
    zone.addEventListener('dragover', over(true));
    zone.addEventListener('dragenter', over(true));
    zone.addEventListener('dragleave', over(false));
    zone.addEventListener('drop', (e) => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      e.preventDefault();
      box.classList.remove('dropping');
      // One deck at a time. Silently reading the first of five would look like
      // the other four failed.
      if (files.length > 1) {
        setStatus('Drop one decklist at a time — ' + files.length + ' files arrived together.', true);
        return;
      }
      useDeckFile(files[0]);
    });
  }

  let saveTimer = null;
  function saveDeckSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDeck, 400);
  }

  const api = {
    saveDeck, saveDeckSoon, encodeDeck, decodeDeck, shareLink, restoreDeck, clearDeck,
    useDeckFile, wireDeckFiles,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.DeckIO = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
