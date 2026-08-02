// The tier review page. Reads the same published combos.json the deck page
// reads, counts how often each result appears, and lays the whole classification
// out for review.
//
// It exists in the repository rather than as a screenshot for one reason: when
// Spellbook adds results with a new set, they are not in result-tiers.js and the
// deck page shows them grey. That is the intended default, but it should never
// be a silent one. This page loads the live data every time, so anything
// unclassified appears at the top, in red, with the exact lines to paste in.
(function () {
  'use strict';

  const DATA_URL = /github\.io$/.test(location.hostname)
    ? 'https://raw.githubusercontent.com/PaludaNCode/MTG-Combo-Finder/data/combos.json'
    : 'combos.json';

  const $ = (id) => document.getElementById(id);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  const TIERS = [
    {
      key: 'win',
      label: 'Green — this wins',
      note: 'Explicit wins, plus the results that end games in every normal case. Green does not '
        + 'claim you cannot lose from here; it claims you have won unless something unusual is true.',
    },
    {
      key: 'decisive',
      label: 'Yellow — needs a payoff',
      note: 'Real value that something else still has to convert. Each row carries the reason it '
        + 'is not a win.',
    },
    {
      key: 'other',
      label: 'Grey — loop plumbing',
      note: 'How the loop runs rather than why you built it. Shown, but quiet.',
    },
  ];

  const state = { rows: [], q: '', on: { win: true, decisive: true, other: true }, max: 1 };

  // A magnitude bar behind each count. Square-rooted, or the 14k rows flatten
  // everything else to a sliver.
  function countCell(n) {
    const cell = el('div', 'count');
    const bar = el('div', 'bar');
    bar.style.width = Math.max(2, Math.round((Math.sqrt(n) / Math.sqrt(state.max)) * 100)) + '%';
    cell.appendChild(bar);
    cell.appendChild(el('span', null, n.toLocaleString()));
    return cell;
  }

  function row(r) {
    const li = el('li');
    li.appendChild(el('div', 'stripe'));
    const name = el('div', 'name');
    name.appendChild(el('b', null, r.name));
    if (r.why) name.appendChild(el('span', 'why', r.why));
    li.appendChild(name);
    li.appendChild(countCell(r.n));
    return li;
  }

  function renderUnclassified(rows) {
    const box = $('unclassified');
    if (!rows.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.textContent = '';
    box.className = 'unclassified';

    const combos = rows.reduce((sum, r) => sum + r.n, 0);
    box.appendChild(el('h2', null,
      `${rows.length} result${rows.length === 1 ? '' : 's'} not classified yet`));
    box.appendChild(el('p', null,
      `Spellbook has published ${rows.length === 1 ? 'a result' : 'results'} that result-tiers.js `
      + `does not list, affecting ${combos.toLocaleString()} combo${combos === 1 ? '' : 's'}. `
      + 'They show as grey on the deck page until someone decides where they belong.'));

    const list = el('ol', 'rows');
    rows.forEach((r) => list.appendChild(row(r)));
    box.appendChild(list);

    // Paste-ready, because the point is to make fixing this trivial.
    const snippet = rows.map((r) => "      '" + r.name.replace(/'/g, "\\'") + "',").join('\n');
    const pre = el('pre', 'snippet', snippet);
    box.appendChild(el('p', 'snippet-label', 'Paste into the right list in result-tiers.js:'));
    box.appendChild(pre);

    const copy = el('button', 'copy-btn', 'Copy');
    copy.type = 'button';
    copy.addEventListener('click', () => {
      navigator.clipboard.writeText(snippet).then(
        () => { copy.textContent = 'Copied'; },
        () => { copy.textContent = 'Press Ctrl+C to copy'; }
      );
    });
    box.appendChild(copy);
  }

  function render() {
    const host = $('tiers');
    host.textContent = '';
    const needle = state.q.trim().toLowerCase();

    TIERS.forEach((t) => {
      if (!state.on[t.key]) return;
      const matches = state.rows.filter(
        (r) => r.tier === t.key && (!needle || r.name.toLowerCase().indexOf(needle) !== -1)
      );

      const section = el('section', 'tier t-' + t.key);
      const head = el('div', 'tier-head');
      head.appendChild(el('h2', null, t.label));
      const combos = matches.reduce((sum, r) => sum + r.n, 0);
      head.appendChild(el('span', 'meta',
        `${matches.length} result${matches.length === 1 ? '' : 's'} · ${combos.toLocaleString()} combos`));
      section.appendChild(head);
      section.appendChild(el('p', 'tier-note', t.note));

      const list = el('ol', 'rows');
      if (matches.length) {
        matches.forEach((r) => list.appendChild(row(r)));
      } else {
        list.appendChild(el('p', 'empty', `Nothing in this tier matches “${state.q}”.`));
      }
      section.appendChild(list);
      host.appendChild(section);
    });
  }

  async function load() {
    let data;
    try {
      const res = await fetch(DATA_URL, { cache: 'default' });
      if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
      // Interned indices back into strings. Without it `combo.p` is a list of
      // integers, `tierOf(3)` matches nothing, and the sort dies on
      // `localeCompare` of a number — after the fetch succeeded, so the page sits
      // on "Loading the combo database…" with no error on screen.
      data = window.DeckCombos.decode(await res.json());
    } catch (err) {
      $('status').textContent = 'Could not load the combo database from ' + DATA_URL + ' — ' + err.message;
      $('status').classList.add('error');
      return;
    }

    const counts = new Map();
    for (const combo of data.combos || []) {
      for (const result of combo.p || []) counts.set(result, (counts.get(result) || 0) + 1);
    }

    const rows = [];
    const unclassified = [];
    for (const [name, n] of counts) {
      const { tier, why } = window.ResultTiers.tierOf(name);
      const listed = tier !== 'other' || window.ResultTiers.OTHER.indexOf(name) !== -1;
      const entry = { name, n, tier, why };
      rows.push(entry);
      if (!listed) unclassified.push(entry);
    }

    const byCount = (a, b) => b.n - a.n || a.name.localeCompare(b.name);
    rows.sort(byCount);
    unclassified.sort(byCount);

    state.rows = rows;
    state.max = rows.length ? rows[0].n : 1;

    const tally = { win: 0, decisive: 0, other: 0 };
    rows.forEach((r) => { tally[r.tier] += 1; });
    Object.keys(tally).forEach((k) => {
      document.querySelector('[data-count="' + k + '"]').textContent = tally[k];
    });

    const stamp = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'unknown date';
    $('status').textContent = `${rows.length.toLocaleString()} distinct results across `
      + `${(data.count || (data.combos || []).length).toLocaleString()} combos, `
      + `from the data published ${stamp}.`;

    $('controls').hidden = false;
    renderUnclassified(unclassified);
    render();
  }

  $('q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
  Array.prototype.forEach.call(document.querySelectorAll('.chip'), (chip) => {
    chip.addEventListener('click', () => {
      const tier = chip.dataset.tier;
      state.on[tier] = !state.on[tier];
      chip.setAttribute('aria-pressed', String(state.on[tier]));
      render();
    });
  });

  load();
})();
