// ── Champion detail card ─────────────────────────────────
// Builds and renders the right-hand panel when a champion is selected.

// Returns a CSS class for win-rate colour coding.
function wrClass(wr) {
  if (wr >= 55) return 'high';
  if (wr <= 45) return 'low';
  return 'mid';
}

// Builds the top-items row from the /api/champion-items response.
function buildItemsHTML(items) {
  if (!items || !items.length) return '';
  const cells = items.map(it => {
    const url = itemIconUrl(it.item_name);
    const img = url
      ? `<img src="${url}" class="item-icon" alt="${it.item_name}"
             onerror="this.style.display='none'">`
      : `<div class="item-icon item-icon-missing"></div>`;
    return `<div class="item-cell" title="${it.item_name} — ${it.picks} games">
      ${img}
      <span class="item-picks">${it.picks}</span>
    </div>`;
  }).join('');
  return `<div class="items-section">
    <div class="ds-group-title">MOST BOUGHT</div>
    <div class="items-grid">${cells}</div>
  </div>`;
}

// Builds the stats grid HTML from the /api/champion-stats response.
function buildStatsGrid(s) {
  if (!s || !Object.keys(s).length) return '';

  const fmt  = v => v != null ? v : '—';
  const sign = v => v != null ? (v >= 0 ? `+${Math.round(v).toLocaleString()}` : `${Math.round(v).toLocaleString()}`) : '—';

  const cell = (label, value) => `<div class="bc-cell">
    <div class="bc-label">${label}</div>
    <div class="bc-value">${value}</div>
  </div>`;

  return `<div class="bc-kda-row">
    <div class="bc-kda-main">${s.kda ?? '—'}<span class="bc-kda-label"> KDA</span></div>
    <div class="bc-kda-breakdown">
      <span class="kda-k">${fmt(s.avg_kills)}</span>
      <span class="kda-sep"> / </span>
      <span class="kda-d">${fmt(s.avg_deaths)}</span>
      <span class="kda-sep"> / </span>
      <span class="kda-a">${fmt(s.avg_assists)}</span>
    </div>
  </div>
  <div id="items-grid"></div>
  <div class="bc-grid" style="margin-top:10px">
    <div class="bc-row">
      ${cell('DPM',      fmt(s.dpm))}
      ${cell('GOLD@15',  s.avg_gold15 != null ? Math.round(s.avg_gold15).toLocaleString() : '—')}
      ${cell('VISION',   fmt(s.vision_score))}
    </div>
    <div class="bc-row">
      ${cell('DMG%',     s.damage_share != null ? s.damage_share + '%' : '—')}
      ${cell('DIFF@15',  `<span class="${s.gold_diff15 >= 0 ? 'positive' : 'negative'}">${sign(s.gold_diff15)}</span>`)}
      ${cell('CSPM',     fmt(s.cspm))}
    </div>
  </div>`;
}

// Builds the static shell of the detail card (win rate, bar, placeholders).
// The stats grid and patch chart are filled in asynchronously by selectChamp.
function buildDetailHTML(d) {
  const losses = d.total_games - d.wins;
  const wrCls  = wrClass(d.win_rate);
  const img    = champImg(d.champion, 'champ-icon-lg');

  return `
    <div class="detail-header">
      ${img}
      <div class="detail-header-info">
        <div class="detail-name">${d.champion}</div>
        <div class="detail-record">
          <span class="rec-w">${d.wins}W</span>
          <span class="rec-sep"> · </span>
          <span class="rec-l">${losses}L</span>
          <span class="rec-sep"> · </span>
          <span class="rec-g">${d.total_games} games</span>
        </div>
      </div>
      <div style="text-align:right">
        <div class="detail-wr ${wrCls}">${d.win_rate}%</div>
        <div id="presence-rates"></div>
      </div>
    </div>

    <div class="wr-bar-bg">
      <div class="wr-bar-fill" id="wr-fill" style="width:0%"></div>
    </div>
    <div class="wr-bar-numbers">
      <span class="w">${d.win_rate}% W</span>
      <span class="l">${d.loss_rate}% L</span>
    </div>

    <div id="stats-grid"></div>

    <div class="patch-chart-wrap" data-zoom="${chartZoom}">
      <div class="patch-chart-label">
        WIN RATE HISTORY
        <div class="zoom-toggle">
          <button id="zoom-patch" class="zoom-btn${chartZoom === 'patch' ? ' active' : ''}"
                  onclick="setChartZoom('patch')">Patch</button>
          <button id="zoom-split" class="zoom-btn${chartZoom === 'split' ? ' active' : ''}"
                  onclick="setChartZoom('split')">Split</button>
        </div>
      </div>
      <div id="patch-chart"></div>
    </div>
  `;
}

// Renders the full detail card for a champion, then fetches and injects
// the async sections (stats grid, patch chart).
async function selectChamp(d) {
  selectedChamp = d;
  renderTable(getFilteredSorted());

  const card = document.getElementById('detail-card');
  card.innerHTML = buildDetailHTML(d);

  // Animate the win-rate bar on the next tick so the CSS transition fires.
  setTimeout(() => {
    const fill = document.getElementById('wr-fill');
    if (fill) fill.style.width = d.win_rate + '%';
  }, 20);

  const { year, split, patch } = getFilters();

  // Fetch average stats and render the stats grid.
  const statsUrl = buildUrl('/api/champion-stats',
    { champion: d.champion, year, split, patch });
  const stats = await fetch(statsUrl).then(r => r.json());
  const grid = document.getElementById('stats-grid');
  if (grid) grid.innerHTML = buildStatsGrid(stats);

  const presenceEl = document.getElementById('presence-rates');
  if (presenceEl) {
    const pr = stats.pick_rate != null ? stats.pick_rate + '%' : '—';
    const br = stats.ban_rate  != null ? stats.ban_rate  + '%' : '—';
    presenceEl.innerHTML = `
      <div class="presence-rates">
        <div class="presence-item">
          <span class="presence-label">PICK RATE</span>
          <span class="presence-val">${pr}</span>
        </div>
        <div class="presence-sep"></div>
        <div class="presence-item">
          <span class="presence-label">BAN RATE</span>
          <span class="presence-val">${br}</span>
        </div>
      </div>`;
  }



  // Fetch top items from Leaguepedia data and inject below KDA.
  const itemsUrl = buildUrl('/api/champion-items',
    { champion: d.champion, year });
  const items = await fetch(itemsUrl).then(r => r.json());
  const itemsEl = document.getElementById('items-grid');
  if (itemsEl) itemsEl.innerHTML = buildItemsHTML(items);

  // Fetch and render the trend chart for the current zoom level.
  // Read zoom from the global, but also check the DOM dataset as a fallback.
  const wrap = document.querySelector('.patch-chart-wrap');
  const activeZoom = (wrap && wrap.dataset.zoom) || chartZoom || 'patch';
  await _renderChartForZoom(d.champion, year, split, activeZoom);
}

// Fetches the correct data endpoint for the given mode and injects the chart.
// mode is passed explicitly — never read from the global to avoid scoping issues.
async function _renderChartForZoom(champion, year, split, mode) {
  const endpoint = mode === 'split'
    ? '/api/champion-splits'
    : '/api/champion-patches';
  const url = buildUrl(endpoint, { champion, year, split });
  const data = await fetch(url).then(r => r.json());
  const chart = document.getElementById('patch-chart');
  if (!chart) return;
  chart.innerHTML = buildPatchChart(data, chart.offsetWidth || 600);
  // Scroll to the right end so the most recent data is visible on load.
  const scroller = chart.querySelector('.patch-chart-scroll');
  if (scroller) scroller.scrollLeft = scroller.scrollWidth;
}

// Called by the Patch / Split toggle buttons.
async function setChartZoom(mode) {
  if (!selectedChamp) return;
  chartZoom = mode;

  // Flip active class using stable IDs.
  const pBtn = document.getElementById('zoom-patch');
  const sBtn = document.getElementById('zoom-split');
  if (pBtn) pBtn.classList.toggle('active', mode === 'patch');
  if (sBtn) sBtn.classList.toggle('active', mode === 'split');

  // Store mode on DOM as ground truth so selectChamp can read it back.
  const wrap = document.querySelector('.patch-chart-wrap');
  if (wrap) wrap.dataset.zoom = mode;

  const { year, split } = getFilters();
  await _renderChartForZoom(selectedChamp.champion, year, split, mode);
}
