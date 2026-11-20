// Launch Desk's page: one static board, no fetch, no network.
//
// Reads window.RADAR (written by main.ts from the same board), renders the ranked board with
// search, category and chain filters, a watchlist toggle and five sorts, a detail view for every
// protocol with its model breakdown and farm plan, the live-token view at market values, and the
// model view with the calibration table the snapshot produced.
//
// Deep links, for the screenshots and for sharing a view:
//   ?view=board|live|model   ?detail=<slug>   ?cat=<category>   ?chain=<chain>   ?watchlist=1   ?q=<text>

(function () {
  'use strict';
  var R = window.RADAR;
  if (!R || !Array.isArray(R.rows)) {
    document.getElementById('board-body').innerHTML = '<tr><td colspan="8">No radar data loaded.</td></tr>';
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var state = {
    view: params.get('view') || 'board',
    q: (params.get('q') || '').toLowerCase(),
    cat: params.get('cat') || '',
    chain: params.get('chain') || '',
    watchlistOnly: params.get('watchlist') === '1',
    sort: params.get('sort') || 'implied',
    detail: params.get('detail') || '',
  };

  function $(id) { return document.getElementById(id); }

  function fmtMoney(n) {
    if (n === null || n === undefined) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return '$' + Math.round(n);
  }

  function fmtPct(v) {
    if (v === null || v === undefined) return '—';
    var s = (v > 0 ? '+' : '') + v.toFixed(1) + '%';
    return s;
  }

  function pctClass(v) {
    if (v === null || v === undefined) return 'flat';
    return v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
  }

  function ageLabel(days) {
    if (days === null || days === undefined) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    var y = Math.floor(days / 365);
    var m = Math.round((days % 365) / 30);
    return y + 'y' + (m > 0 ? ' ' + m + 'mo' : '');
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fillSelect(el, values) {
    var cur = el.value;
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      el.appendChild(o);
    });
    el.value = cur;
  }

  var categories = [];
  var chains = [];
  R.rows.forEach(function (r) {
    if (r.category && categories.indexOf(r.category) === -1) categories.push(r.category);
    (r.chains || []).forEach(function (c) { if (chains.indexOf(c) === -1) chains.push(c); });
  });
  categories.sort();
  chains.sort();
  fillSelect($('cat'), categories);
  fillSelect($('chain'), chains);

  function filteredRows() {
    var rows = R.rows.filter(function (r) {
      if (state.watchlistOnly && !r.watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) === -1) return false;
      if (state.q && (r.name + ' ' + r.slug).toLowerCase().indexOf(state.q) === -1) return false;
      return true;
    });
    var by = {
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d === null ? -1e9 : b.change_7d) - (a.change_7d === null ? -1e9 : a.change_7d); },
      age: function (a, b) { return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days); },
      name: function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; },
    };
    rows.sort(by[state.sort] || by.implied);
    return rows;
  }

  function renderBoard() {
    var rows = filteredRows();
    var body = $('board-body');
    body.innerHTML = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      if (state.detail === r.slug) tr.className = 'selected';
      tr.innerHTML =
        '<td class="num">' + r.rank + '</td>' +
        '<td class="name"><b>' + esc(r.name) + '</b><span class="slug">' + esc(r.slug) + '</span>' + (r.watchlist ? '<span class="badge">Watchlist</span>' : '') + '</td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc((r.chains || []).slice(0, 2).join(', ') || '—') + '</td>' +
        '<td class="num">' + fmtMoney(r.tvl_usd) + '</td>' +
        '<td class="num"><span class="' + pctClass(r.change_7d) + '">' + fmtPct(r.change_7d) + '</span></td>' +
        '<td class="num">' + ageLabel(r.age_days) + '</td>' +
        '<td class="num implied">' + fmtMoney(r.implied_value_usd) + '</td>';
      tr.addEventListener('click', function () { openDetail(r.slug, true); });
      body.appendChild(tr);
    });
    $('count').textContent = rows.length + ' of ' + R.rows.length + ' protocols shown' +
      (state.watchlistOnly ? ' — watchlist only' : '') +
      (state.cat ? ' — ' + state.cat : '') +
      (state.chain ? ' — ' + state.chain : '') + '.';
    $('board-note').textContent = 'Implied value is this desk\u2019s own claim from the snapshot\u2019s figures: category multiple \u00d7 TVL, dampened 7-day growth, log age and chain breadth. Click any row for its breakdown and farm plan.';
  }

  function barRow(label, value, max, display) {
    var pct = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
    return '<div class="bar-row"><span>' + esc(label) + '</span><span class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></span><span class="val">' + esc(display) + '</span></div>';
  }

  function renderDetail(slug) {
    var box = $('detail');
    var r = null;
    for (var i = 0; i < R.rows.length; i++) if (R.rows[i].slug === slug) { r = R.rows[i]; break; }
    if (!r) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    var maxBase = 0;
    R.rows.forEach(function (x) { if (x.base_value_usd > maxBase) maxBase = x.base_value_usd; });
    var steps = (r.farm_steps || []).map(function (s, i) {
      var m = s.match(/ Cost: (.*)\. Time: (.*)\.$/);
      var text = m ? s.slice(0, m.index) : s;
      var meta = m ? '<span class="meta"><b>Cost</b> ' + esc(m[1]) + ' &middot; <b>Time</b> ' + esc(m[2]) + '</span>' : '';
      return '<li><span>' + esc(text) + '</span>' + meta + '</li>';
    }).join('');
    box.innerHTML =
      '<h2>' + esc(r.name) + ' <span class="badge">' + (r.watchlist ? 'Watchlist' : 'Early radar') + '</span></h2>' +
      '<p class="sub">' + esc(r.category || 'Uncategorized') + ' &middot; ' + esc((r.chains || []).join(', ') || 'no chain listed') + ' &middot; tracked since ' + esc(r.listed_at || 'unknown') + '</p>' +
      '<div class="detail-grid"><div>' +
      '<div class="stat"><span>Implied value</span><span>' + fmtMoney(r.implied_value_usd) + '</span></div>' +
      '<div class="stat"><span>TVL</span><span>' + fmtMoney(r.tvl_usd) + '</span></div>' +
      '<div class="stat"><span>7-day change</span><span class="' + pctClass(r.change_7d) + '">' + fmtPct(r.change_7d) + '</span></div>' +
      '<div class="stat"><span>Age with no token</span><span>' + ageLabel(r.age_days) + '</span></div>' +
      '<div class="stat"><span>Token status</span><span>Records no token</span></div>' +
      '</div><div>' +
      '<div class="stat"><span>Category multiple</span><span>' + r.multiple.toFixed(2) + '×</span></div>' +
      '<div class="stat"><span>Base value (TVL × multiple)</span><span>' + fmtMoney(r.base_value_usd) + '</span></div>' +
      '<div class="stat"><span>Growth multiplier</span><span>' + r.growth_multiplier.toFixed(2) + '×</span></div>' +
      '<div class="stat"><span>Maturity multiplier</span><span>' + r.maturity_multiplier.toFixed(2) + '×</span></div>' +
      '<div class="stat"><span>Chain multiplier</span><span>' + r.chain_multiplier.toFixed(2) + '×</span></div>' +
      '</div></div>' +
      '<div class="bars">' +
      barRow('Base value', r.base_value_usd, maxBase, fmtMoney(r.base_value_usd)) +
      barRow('Implied value', r.implied_value_usd, R.rows[0].implied_value_usd, fmtMoney(r.implied_value_usd)) +
      '</div>' +
      '<h2>Farm plan</h2><ol class="steps">' + steps + '</ol>';
    box.classList.remove('hidden');
  }

  function openDetail(slug, scroll) {
    state.detail = slug;
    renderBoard();
    renderDetail(slug);
    if (scroll) $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderLive() {
    var body = $('live-body');
    body.innerHTML = '';
    R.live.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="name"><b>' + esc(r.name) + '</b><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc((r.chains || []).slice(0, 2).join(', ') || '—') + '</td>' +
        '<td class="num">' + fmtMoney(r.tvl_usd) + '</td>' +
        '<td class="num implied">' + fmtMoney(r.mcap_usd) + '</td>' +
        '<td class="num"><span class="' + pctClass(r.change_7d) + '">' + fmtPct(r.change_7d) + '</span></td>';
      body.appendChild(tr);
    });
  }

  function renderModel() {
    var m = R.model;
    $('formula').innerHTML =
      '<li><b>Calibrate.</b> For each category, take the median market-cap-to-TVL ratio of its tokenized protocols, shrink it toward the global median (' + m.global_median_multiple.toFixed(2) + '×) where the category has few peers, and clamp it to ' + m.multiple_floor.toFixed(2) + '–' + m.multiple_cap.toFixed(2) + '×. The category multiple is the market\u2019s own price for that kind of protocol.</li>' +
      '<li><b>Base.</b> <code>base = TVL \u00d7 category multiple</code> — what the protocol would be worth at its peers\u2019 valuation.</li>' +
      '<li><b>Growth.</b> <code>1 + 0.35 \u00d7 tanh(7-day change / 50)</code> — a hot week helps, but a single week cannot multiply a value; a protocol with no reported change scores neutral.</li>' +
      '<li><b>Maturity.</b> <code>0.75 + 0.25 \u00d7 ln(1 + age) / ln(1 + 1095)</code> — longer with no token counts for more, with diminishing returns; unknown age falls back to the snapshot\u2019s median age of ' + m.median_age_days + ' days.</li>' +
      '<li><b>Breadth.</b> <code>1 + 0.05 \u00d7 min(chains \u2212 1, 4)</code> — a protocol live on more chains reaches more users.</li>' +
      '<li><b>Implied value.</b> <code>base \u00d7 growth \u00d7 maturity \u00d7 breadth</code>, rounded to whole dollars. No name is ever special-cased.</li>';
    var body = $('cal-body');
    body.innerHTML = '';
    m.categories.forEach(function (c) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + esc(c.category) + '</td><td class="num">' + c.peers + '</td><td class="num">' + c.median_multiple.toFixed(2) + '×</td><td class="num implied">' + c.effective_multiple.toFixed(2) + '×</td>';
      body.appendChild(tr);
    });
  }

  function renderMast() {
    var top = R.rows[0];
    $('mast-stats').innerHTML =
      '<dt>Snapshot</dt><dd>' + esc(R.as_of) + '</dd>' +
      '<dt>Board</dt><dd>' + R.board_size + ' rows</dd>' +
      '<dt>Watchlist</dt><dd>' + R.watchlist_size + ' covered</dd>' +
      '<dt>Top implied value</dt><dd>' + fmtMoney(top ? top.implied_value_usd : 0) + '</dd>' +
      '<dt>Model</dt><dd>' + esc(R.model_version) + '</dd>';
    $('foot-source').textContent = 'Snapshot: ' + R.source + '. Floor for the watchlist: ' + fmtMoney(R.floor_usd) + ' of TVL.';
  }

  function showView(view) {
    state.view = view;
    ['board', 'live', 'model'].forEach(function (v) {
      $('view-' + v).classList.toggle('hidden', v !== view);
    });
    var tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });
    if (view === 'live') renderLive();
    if (view === 'model') renderModel();
  }

  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { showView(b.getAttribute('data-view')); });
  });
  $('q').value = state.q;
  $('cat').value = state.cat;
  $('chain').value = state.chain;
  $('watchlist-only').checked = state.watchlistOnly;
  $('sort').value = state.sort;
  $('q').addEventListener('input', function () { state.q = this.value.toLowerCase(); renderBoard(); });
  $('cat').addEventListener('change', function () { state.cat = this.value; renderBoard(); });
  $('chain').addEventListener('change', function () { state.chain = this.value; renderBoard(); });
  $('watchlist-only').addEventListener('change', function () { state.watchlistOnly = this.checked; renderBoard(); });
  $('sort').addEventListener('change', function () { state.sort = this.value; renderBoard(); });

  renderMast();
  renderBoard();
  renderDetail(state.detail);
  showView(state.view);
  if (state.detail) {
    // A deep-linked detail is the point of the visit, so it sits above the board instead of
    // at the bottom of a 178-row table; no scrolling is needed, it is already at the top.
    var detailEl = $('detail');
    detailEl.parentNode.insertBefore(detailEl, $('view-board'));
  }
})();
