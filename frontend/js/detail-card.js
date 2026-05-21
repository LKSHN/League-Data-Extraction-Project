// ── Champion detail card ─────────────────────────────────
// Builds and renders the right-hand panel when a champion is selected.

// Returns a CSS class for win-rate colour coding.
function wrClass(wr) {
  if (wr >= 55) return 'high';
  if (wr <= 45) return 'low';
  return 'mid';
}

// Builds the stats grid HTML from the /api/champion-stats response.
function buildStatsGrid(s) {
  if (!s || !Object.keys(s).length) return '';

  const fmt     = v => v != null ? v : '—';
  const fmtGold = v => v != null
    ? `<span class="${v >= 0 ? 'positive' : 'negative'}">${v >= 0 ? '+' : ''}${Math.round(v).toLocaleString()}</span>`
    : '—';

  // KDA highlight box
  const kda = s.kda != null
    ? `<div class="kda-box">
        <div class="kda-number">${s.kda}</div>
        <div class="kda-label">KDA</div>
        <div class="kda-breakdown">
          <span class="kda-k">${fmt(s.avg_kills)}</span>
          <span class="kda-sep"> / </span>
          <span class="kda-d">${fmt(s.avg_deaths)}</span>
          <span class="kda-sep"> / </span>
          <span class="kda-a">${fmt(s.avg_assists)}</span>
        </div>
      </div>` : '';

  const row = (label, val) =>
    `<div class="ds-row"><span class="ds-label">${label}</span><span class="ds-value">${val}</span></div>`;

  const combat = '<div class="ds-group">'
    + '<div class="ds-group-title">COMBAT</div>'
    + row('DPM',       fmt(s.dpm))
    + row('DMG SHARE', s.damage_share != null ? s.damage_share + '%' : '—')
    + row('VISION',    fmt(s.vision_score))
    + '</div>';

  const economy = '<div class="ds-group">'
    + '<div class="ds-group-title">ECONOMY</div>'
    + row('CSPM',      fmt(s.cspm))
    + row('GOLD @15',  s.avg_gold15  != null ? Math.round(s.avg_gold15).toLocaleString() : '—')
    + row('DIFF @15',  fmtGold(s.gold_diff15))
    + '</div>';

  return '<div class="detail-stats">'
    + kda
    + '<div class="ds-columns">' + combat + economy + '</div>'
    + '</div>';
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
      <div class="detail-wr ${wrCls}">${d.win_rate}%</div>
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
  chart.innerHTML = buildPatchChart(data);
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
