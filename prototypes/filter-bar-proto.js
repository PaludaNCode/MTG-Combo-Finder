// Makes the filter bar real: the chips filter the deck's actual 233 combos, the counts
// on them are what pressing them would leave, and the panel rebuilds from the result.
//
// The filtering itself is deliberately the same shape as tools/deck-filters.js —
// predicates over one flat list — because that tool is what measured the numbers in the
// page's comment, and a drawing that filters differently to the thing that measured it is
// a drawing of something else.
(function () {
  'use strict';

  const data = window.FILTER_DATA;
  const combos = data.combos;
  const commander = (data.commander || [])[0] || null;

  // `phrase` is what the chip becomes in the caption's sentence, which is not its label:
  // "Showing 1 of 233 combos — wins only and 2-card" is a list of button names, and
  // "…that win the game and need only two cards" is what the reader actually asked for.
  const CHIPS = [
    { id: 'commander', label: 'Uses my commander', phrase: 'use your commander', match: (c) => c.commander, needsCommander: true },
    { id: 'win', label: 'Wins only', phrase: 'win the game', match: (c) => c.tier === 'win' },
    { id: 'two', label: '2-card', phrase: 'need only two cards', match: (c) => c.size <= 2 },
    // The odd one out, and on the bar anyway: it acts on the panel below rather than on
    // this one. Its count is rows of ours, not combos, which is why the label says so.
    { id: 'unofficial', label: 'Hide unofficial', match: () => true, other: 50 },
  ];

  // `?on=commander,two` opens the page with those chips pressed, which is how a state is
  // screenshotted (a headless run cannot click) and how one gets linked to in a review.
  const state = {
    on: new Set((new URLSearchParams(location.search).get('on') || '').split(',').filter(Boolean)),
    hasCommander: true,
  };

  const bar = document.getElementById('proto-bar');
  const rowsEl = document.getElementById('proto-rows');
  const captionEl = document.getElementById('proto-caption');
  const countEl = document.getElementById('proto-panel-count');
  const unofficialEl = document.getElementById('proto-unofficial');

  // ---- the arithmetic ------------------------------------------------------

  function keep(active) {
    const on = CHIPS.filter((c) => active.has(c.id) && c.id !== 'unofficial');
    return combos.filter((combo) => on.every((chip) => chip.match(combo)));
  }

  // One row per deck card carrying at least one surviving combo, ranked as the panel
  // ranks them: most combos first, then by name so the order is stable rather than
  // whatever the data happened to be in.
  function rowsFor(kept) {
    const byCard = new Map();
    for (const combo of kept) {
      for (const card of combo.deckCards) {
        if (!byCard.has(card)) byCard.set(card, []);
        byCard.get(card).push(combo);
      }
    }
    return [...byCard.entries()]
      .map(([card, list]) => ({ card, combos: list }))
      .sort((a, b) => b.combos.length - a.combos.length || a.card.localeCompare(b.card));
  }

  // ---- the bar -------------------------------------------------------------

  function drawBar() {
    bar.textContent = '';
    const label = document.createElement('span');
    label.className = 'proto-filters-label';
    label.textContent = 'Show only';
    bar.appendChild(label);

    CHIPS.forEach((chip) => {
      // Absent, not empty. A chip reading 0 is a claim that the commander is in no
      // combo; a deck that never named a commander has made no such claim.
      if (chip.needsCommander && !state.hasCommander) return;

      const on = state.on.has(chip.id);
      // Every chip answers one question: **with this on, and whatever else is on, how
      // many combos are left?** So an inactive chip is a prediction and an active one is
      // the panel's current count — which is why two active chips read the same number.
      //
      // The other reading was built first and is wrong in a way that looks right: an
      // active chip showing what *releasing* it would give. Pressed "Uses Chatterfang"
      // and "2-card" then read 9 and 11 over a panel holding 1, and there is no way to
      // tell from the bar that neither number is the answer.
      const would = new Set(state.on);
      would.add(chip.id);
      const n = chip.id === 'unofficial' ? chip.other : keep(would).length;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'proto-chip';
      button.setAttribute('aria-pressed', String(on));
      const text = document.createElement('span');
      text.textContent = chip.id === 'commander' && commander
        ? 'Uses ' + commander.split(',')[0]
        : chip.label;
      button.appendChild(text);
      const count = document.createElement('span');
      count.className = 'proto-chip-count';
      count.textContent = String(n);
      button.appendChild(count);
      // Pressing it would leave nothing, so it is readable, honest about its zero and
      // not pressable. Hiding it instead would make the bar change shape under the
      // pointer as you press its neighbour.
      if (!on && n === 0) button.disabled = true;
      button.addEventListener('click', () => {
        if (on) state.on.delete(chip.id); else state.on.add(chip.id);
        draw();
      });
      bar.appendChild(button);
    });

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'proto-clear';
    clear.textContent = 'Clear filters';
    clear.hidden = state.on.size === 0;
    clear.addEventListener('click', () => { state.on.clear(); draw(); });
    bar.appendChild(clear);
  }

  // ---- the panel -----------------------------------------------------------

  function sizePills(list) {
    const bySize = new Map();
    for (const c of list) bySize.set(c.size, (bySize.get(c.size) || 0) + 1);
    const sizes = [...bySize.entries()].sort((a, b) => a[0] - b[0]);
    const only = sizes.length === 1 && sizes[0][1] === 1;
    const wrap = document.createElement('span');
    wrap.className = 'sizes';
    sizes.forEach(([size, count]) => {
      const pill = document.createElement('span');
      pill.className = 'size' + (size <= 2 ? ' is-easiest' : '');
      pill.textContent = only ? size + '-card' : count + ' × ' + size + '-card';
      wrap.appendChild(pill);
    });
    return wrap;
  }

  function drawRows(rows) {
    rowsEl.textContent = '';
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'No combo in this deck matches all of those. Let one of them go.';
      rowsEl.appendChild(empty);
      return;
    }

    rows.slice(0, 8).forEach((row) => {
      const card = document.createElement('article');
      card.className = 'combo suggestion';

      const gutter = document.createElement('div');
      gutter.className = 'row-numbers';
      const total = document.createElement('span');
      total.className = 'row-total';
      total.textContent = String(row.combos.length);
      total.title = 'in ' + row.combos.length + ' combo' + (row.combos.length === 1 ? '' : 's');
      gutter.appendChild(total);
      const word = document.createElement('span');
      word.className = 'row-total-label';
      word.textContent = row.combos.length === 1 ? 'combo' : 'combos';
      gutter.appendChild(word);
      card.appendChild(gutter);

      const main = document.createElement('div');
      main.className = 'row-main';
      const head = document.createElement('h3');
      head.className = 'row-name';
      const name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = row.card;
      head.appendChild(name);
      if (commander && row.card === commander) {
        const pin = document.createElement('span');
        pin.className = 'commander-pin';
        pin.textContent = 'Commander';
        head.appendChild(document.createTextNode(' '));
        head.appendChild(pin);
      }
      main.appendChild(head);

      const links = document.createElement('p');
      links.className = 'card-links';
      links.appendChild(document.createTextNode('EDHREC · Scryfall '));
      const remove = document.createElement('button');
      remove.className = 'remove-card';
      remove.type = 'button';
      remove.textContent = '− Remove';
      links.appendChild(remove);
      main.appendChild(links);
      main.appendChild(sizePills(row.combos));

      // Standing in for the disclosure, which this prototype does not build: what it
      // would open onto, one line, so a filtered row can be checked by eye.
      const why = document.createElement('p');
      why.className = 'proto-why';
      const first = row.combos[0];
      why.textContent = 'e.g. ' + first.cards.join(' + ') + ' → ' + first.result;
      main.appendChild(why);

      card.appendChild(main);
      rowsEl.appendChild(card);
    });

    if (rows.length > 8) {
      const more = document.createElement('p');
      more.className = 'empty';
      more.textContent = '…and ' + (rows.length - 8) + ' more cards.';
      rowsEl.appendChild(more);
    }
  }

  function draw() {
    const kept = keep(state.on);
    const rows = rowsFor(kept);
    drawBar();
    countEl.textContent = String(kept.length);

    // Both numbers, always — the badge counts combos and the rows are cards, and under a
    // filter the pair is the only place the filter's effect is visible at all when it
    // removes combos without removing rows ("Wins only": 182 of 233, 40 of 40).
    const filters = [...state.on].filter((id) => id !== 'unofficial');
    const phrases = filters.map((id) => CHIPS.find((c) => c.id === id).phrase);
    captionEl.textContent = filters.length
      ? `Showing the ${kept.length} of ${combos.length} combos that ${phrases.join(' and ')}, `
        + `carried by ${rows.length} of your ${rowsFor(keep(new Set())).length} cards.`
      : `${kept.length} combos, carried by ${rows.length} of your cards.`;

    unofficialEl.hidden = state.on.has('unofficial');
    drawRows(rows);
  }

  // The two states of the commander chip, switchable because the one that ships broken
  // is the one no fixture deck is in.
  const lede = document.getElementById('proto-mode-lede');
  const said = document.getElementById('proto-mode-said');
  const toggle = document.getElementById('proto-toggle-cmdr');
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    state.hasCommander = !state.hasCommander;
    if (!state.hasCommander) state.on.delete('commander');
    lede.textContent = state.hasCommander ? 'Commander declared.' : 'No commander declared.';
    said.textContent = state.hasCommander
      ? ' The deck says Chatterfang, Squirrel General is its commander, so the chip is on the bar. '
      : ' The pasted list never said who its commander is, so the chip is absent rather than reading 0. ';
    toggle.textContent = state.hasCommander
      ? 'Show a deck with no commander declared'
      : 'Show a deck with a commander declared';
    draw();
  });
  toggle.textContent = 'Show a deck with no commander declared';

  draw();
}());
