// Makes the ranking real: the twelve suggestions below are the tuning deck's actual top
// twelve with their actual combo counts and size breakdowns, and the three orderings are
// computed rather than pre-arranged, so switching "Rank by" shows what shipping it would
// show.
//
// THE PRICES ARE PLACEHOLDERS. Scryfall is 403 at CONNECT from this sandbox, so they were
// typed by hand and are deliberately round — see the banner on the page and budget.md. The
// one card with `price: null` is there on purpose: it is the case that ships broken.
(function () {
  'use strict';

  // combos + sizes: node tools/deck-cards.js and computeSuggestions() on
  // test/fixtures/deck.txt, 13 Aug 2026. price: invented.
  const SUGGESTIONS = [
    { card: 'Herd Baloth', combos: 10, sizes: [[2, 1], [3, 9]], price: 0.25 },
    { card: "Ashnod's Altar", combos: 7, sizes: [[3, 7]], price: 8 },
    { card: 'Heliod, Sun-Crowned', combos: 7, sizes: [[2, 1], [3, 6]], price: 4 },
    { card: 'Cleric Class', combos: 7, sizes: [[2, 1], [3, 6]], price: 2 },
    { card: 'Light of Promise', combos: 7, sizes: [[2, 1], [3, 6]], price: 0.5 },
    { card: 'Sunbond', combos: 7, sizes: [[2, 1], [3, 6]], price: 1 },
    { card: 'Spider-Man, Peter Parker', combos: 7, sizes: [[2, 1], [3, 6]], price: 4 },
    // The unpriced one. A card too new to have a market price is the common cause, and
    // reading its absent price as 0 is what puts it top of "cheapest first".
    { card: 'The Destined White Mage', combos: 7, sizes: [[2, 1], [3, 6]], price: null },
    { card: 'Pitiless Plunderer', combos: 6, sizes: [[2, 1], [4, 5]], price: 2 },
    { card: "Soul's Attendant", combos: 5, sizes: [[3, 5]], price: 1 },
    { card: 'Suture Priest', combos: 5, sizes: [[3, 5]], price: 2 },
    { card: "Ajani's Welcome", combos: 5, sizes: [[3, 5]], price: 0.5 },
  ];

  const SNAPSHOT = 'placeholder prices, not a real snapshot';
  const CAP = 2;

  const state = {
    sort: new URLSearchParams(location.search).get('sort') || 'tiebreak',
    cap: new URLSearchParams(location.search).get('cap') === '1',
  };

  const sortEl = document.getElementById('proto-sort');
  const capEl = document.getElementById('proto-cap');
  const rowsEl = document.getElementById('proto-rows');
  const captionEl = document.getElementById('proto-caption');
  const countEl = document.getElementById('proto-count');

  // Always two decimals, including on a whole number: this is a column a reader compares
  // down, and "$4" beside "$0.50" makes the eye do the alignment the digits should.
  const money = (n) => '$' + n.toFixed(2);

  // Every ordering puts an unpriced card last, whichever way the list is pointing. That is
  // one line and it is the whole of decision 3: sorting on `price || 0` instead makes the
  // cards nobody can buy the page's best recommendations.
  function ordered(list) {
    const unknown = list.filter((s) => s.price == null);
    const priced = list.filter((s) => s.price != null);
    if (state.sort === 'tiebreak') {
      // The recommendation: the count still ranks the list, and price decides the ties it
      // leaves — which on this deck is 139 of 141 suggestions. Nothing a reader already
      // understood about the order changes; the arbitrary half of it becomes useful.
      priced.sort((a, b) => b.combos - a.combos || a.price - b.price);
    } else if (state.sort === 'cheapest') {
      priced.sort((a, b) => a.price - b.price || b.combos - a.combos);
    } else if (state.sort === 'per') {
      priced.sort((a, b) => (b.combos / b.price) - (a.combos / a.price) || b.combos - a.combos);
    } else {
      // The shipped order: combos first. The tie is what the other two orderings exist
      // for, and it is left in the data's own order here so the change is visible.
      priced.sort((a, b) => b.combos - a.combos);
      unknown.sort((a, b) => b.combos - a.combos);
      return priced.concat(unknown);
    }
    return priced.concat(unknown);
  }

  function sizePills(sizes) {
    const wrap = document.createElement('span');
    wrap.className = 'sizes';
    const only = sizes.length === 1 && sizes[0][1] === 1;
    sizes.forEach(([size, count]) => {
      const pill = document.createElement('span');
      pill.className = 'size' + (size <= 2 ? ' is-easiest' : '');
      pill.textContent = only ? size + '-card' : count + ' × ' + size + '-card';
      wrap.appendChild(pill);
    });
    return wrap;
  }

  function row(s) {
    const card = document.createElement('article');
    card.className = 'combo suggestion';

    const gutter = document.createElement('div');
    gutter.className = 'row-numbers';
    const total = document.createElement('span');
    total.className = 'row-total';
    const sign = document.createElement('span');
    sign.className = 'sign';
    sign.textContent = '+';
    total.appendChild(sign);
    total.appendChild(document.createTextNode(String(s.combos)));
    total.title = 'unlocks ' + s.combos + ' combos';
    gutter.appendChild(total);
    const word = document.createElement('span');
    word.className = 'row-total-label';
    word.textContent = 'combos';
    gutter.appendChild(word);
    card.appendChild(gutter);

    const main = document.createElement('div');
    main.className = 'row-main';
    const head = document.createElement('h3');
    head.className = 'row-name';
    const name = document.createElement('span');
    name.className = 'card-name';
    name.textContent = s.card;
    head.appendChild(name);
    main.appendChild(head);

    // The links line the shipped suggestion row already has, with the price on the end of
    // it — beside the Buy link rather than inside it, so nothing claims to be a quote for
    // the page that link opens.
    const links = document.createElement('p');
    links.className = 'card-links';
    links.appendChild(document.createTextNode('EDHREC · Scryfall · Buy · '));
    const price = document.createElement('span');
    if (s.price == null) {
      price.className = 'proto-price is-unknown';
      price.textContent = 'no price';
      price.title = 'No market price in the snapshot — usually a card too new to have one. '
        + 'Sorted last rather than treated as free.';
    } else {
      price.className = 'proto-price';
      price.textContent = money(s.price);
      price.title = 'About ' + money(s.price) + ' — market price, one printing, before postage ('
        + SNAPSHOT + ')';
    }
    links.appendChild(price);
    // Only where it is the thing being ranked on: a second derived number on every row,
    // all the time, is a column nobody reads.
    if (state.sort === 'per' && s.price != null) {
      const per = document.createElement('span');
      per.className = 'proto-per';
      per.textContent = ' · ' + (s.combos / s.price).toFixed(1) + ' per $1';
      links.appendChild(per);
    }
    const add = document.createElement('button');
    add.className = 'add-card';
    add.type = 'button';
    add.textContent = '+ Add to deck';
    links.appendChild(document.createTextNode(' '));
    links.appendChild(add);
    main.appendChild(links);

    main.appendChild(sizePills(s.sizes));
    card.appendChild(main);
    return card;
  }

  function draw() {
    // The cap keeps the unpriced card: it has not been shown to be over the cap, and
    // dropping it silently would be the same "absent means zero" mistake in reverse.
    const list = state.cap
      ? SUGGESTIONS.filter((s) => s.price == null || s.price <= CAP)
      : SUGGESTIONS.slice();
    const rows = ordered(list);

    countEl.textContent = String(rows.length);
    const how = state.sort === 'cheapest' ? 'cheapest first'
      : state.sort === 'per' ? 'most combos per $1 first'
        : state.sort === 'tiebreak' ? 'most combos first, cheapest breaking the tie'
          : 'most combos first, popularity breaking the tie';
    captionEl.textContent = `${rows.length} of the deck’s 141 suggestions, ${how}`
      + (state.cap ? `, under ${money(CAP)}` : '')
      + '. Seven of them unlock exactly 7 combos, so what orders those seven is whatever comes'
      + ' after the count — popularity today, price here. Prices are placeholders.';

    sortEl.value = state.sort;
    capEl.setAttribute('aria-pressed', String(state.cap));

    rowsEl.textContent = '';
    rows.forEach((s) => rowsEl.appendChild(row(s)));

    if (state.cap) {
      const note = document.createElement('p');
      note.className = 'empty';
      note.textContent = 'Cards with no price are kept: unpriced is not the same as over the cap.';
      rowsEl.appendChild(note);
    }
  }

  sortEl.addEventListener('change', () => { state.sort = sortEl.value; draw(); });
  capEl.addEventListener('click', () => { state.cap = !state.cap; draw(); });
  draw();
}());
