// ── Player view ───────────────────────────────────────────
// Renders the player list table and detail card.

const POS_LABEL = { top: 'TOP', jng: 'JNG', mid: 'MID', bot: 'BOT', sup: 'SUP' };

// ── Player list table ─────────────────────────────────────

function buildPlayerRowHTML(p) {
  const wrCls = wrClass(p.win_rate);
  const pos   = POS_LABEL[p.position] || (p.position || '').toUpperCase();
  return `<td class="name">${p.playername}</td>`
    + `<td><span class="pos-badge pos-${p.position}">${pos}</span></td>`
    + `<td class="name">${teamImg(p.teamname, 'team-logo')}${p.teamname || '—'}</td>`
    + `<td class="num">${p.games}</td>`
    + `<td class="num">${p.kda}</td>`
    + `<td class="num">${p.dpm}</td>`
    + `<td class="wr ${wrCls}">${p.win_rate}%</td>`;
}

function renderPlayerTable(data) {
  const tbody = document.getElementById('player-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  data.forEach(p => {
    const tr = document.createElement('tr');
    if (selectedPlayer?.playername === p.playername) tr.classList.add('selected');
    tr.innerHTML = buildPlayerRowHTML(p);
    tr.addEventListener('click', () => selectPlayer(p));
    tbody.appendChild(tr);
  });
}

function getFilteredSortedPlayers() {
  const q = (document.getElementById('player-search')?.value || '').toLowerCase();
  const rows = playerData.filter(
    p => p.playername.toLowerCase().includes(q)
      || (p.teamname || '').toLowerCase().includes(q)
  );
  rows.sort((a, b) => {
    const av = typeof a[playerSortCol] === 'string' ? a[playerSortCol] : +a[playerSortCol];
    const bv = typeof b[playerSortCol] === 'string' ? b[playerSortCol] : +b[playerSortCol];
    if (av < bv) return playerSortDir === 'asc' ? -1 :  1;
    if (av > bv) return playerSortDir === 'asc' ?  1 : -1;
    return 0;
  });
  return rows;
}

function setupPlayerSortHeaders() {
  document.querySelectorAll('thead th[data-col-p]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.colP;
      playerSortDir = playerSortCol === col
        ? (playerSortDir === 'asc' ? 'desc' : 'asc')
        : (col === 'playername' || col === 'teamname' || col === 'position' ? 'asc' : 'desc');
      playerSortCol = col;
      document.querySelectorAll('thead th[data-col-p]')
        .forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(playerSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      renderPlayerTable(getFilteredSortedPlayers());
    });
  });
  const defaultTh = document.querySelector('thead th[data-col-p="win_rate"]');
  if (defaultTh) defaultTh.classList.add('sort-desc');
}

// ── Player detail card ────────────────────────────────────

function _diffSpan(v, unit = '') {
  if (v == null) return '—';
  const n   = typeof v === 'number' ? v : parseFloat(v);
  const cls = n > 0 ? 'positive' : n < 0 ? 'negative' : '';
  return `<span class="${cls}">${n > 0 ? '+' : ''}${n}${unit}</span>`;
}

function buildPlayerChampsHTML(champs) {
  if (!champs || !champs.length) return '';
  const cells = champs.map(c => {
    const img   = champImg(c.champion, 'champ-icon');
    const wrCls = wrClass(c.win_rate);
    return `<div class="pchamp-cell" title="${c.champion}">
      <div class="pchamp-icon-row">${img}<span class="pchamp-name">${c.champion}</span></div>
      <div class="pchamp-stats">
        <span class="num">${c.games}g</span>
        <span class="wr ${wrCls}">${c.win_rate}%</span>
        <span class="num">${c.kda} KDA</span>
      </div>
    </div>`;
  }).join('');
  return `<div class="pchamp-section">
    <div class="ds-group-title">CHAMPION POOL</div>
    <div class="pchamp-grid">${cells}</div>
  </div>`;
}

function buildPlayerDetailHTML(stats) {
  const losses = stats.losses ?? 0;
  const wrCls  = wrClass(stats.win_rate);
  const lossRate = (100 - stats.win_rate).toFixed(1);
  const pos    = POS_LABEL[stats.position] || (stats.position || '').toUpperCase();

  return `
    <div class="detail-header">
      <div class="detail-header-info">
        <div class="detail-name">${stats.playername ?? ''}</div>
        <div class="detail-record">
          <span class="pos-badge pos-${stats.position}">${pos}</span>
          <span class="rec-sep"> · </span>
          ${teamImg(stats.teamname, 'team-logo')}
          <span style="color:var(--text)">${stats.teamname || '—'}</span>
          <span class="rec-sep"> · </span>
          <span class="rec-w">${stats.wins}W</span>
          <span class="rec-sep"> · </span>
          <span class="rec-l">${losses}L</span>
          <span class="rec-sep"> · </span>
          <span class="rec-g">${stats.games} games</span>
        </div>
      </div>
      <div class="detail-wr ${wrCls}">${stats.win_rate}%</div>
    </div>

    <div class="wr-bar-bg">
      <div class="wr-bar-fill" id="player-wr-fill" style="width:0%"></div>
    </div>
    <div class="wr-bar-numbers">
      <span class="w">${stats.win_rate}% W</span>
      <span class="l">${lossRate}% L</span>
    </div>

    <div class="detail-stats">
      <div class="kda-box">
        <div class="kda-number">${stats.kda ?? '—'}</div>
        <div class="kda-label">KDA</div>
        <div class="kda-breakdown">
          <span class="kda-k">${stats.avg_kills ?? '—'}</span>
          <span class="kda-sep"> / </span>
          <span class="kda-d">${stats.avg_deaths ?? '—'}</span>
          <span class="kda-sep"> / </span>
          <span class="kda-a">${stats.avg_assists ?? '—'}</span>
        </div>
      </div>

      <div class="ds-columns">
        <div class="ds-group">
          <div class="ds-group-title">PERFORMANCE</div>
          <div class="ds-row">
            <span class="ds-label">DPM</span>
            <span class="ds-value">${stats.dpm ?? '—'}</span>
          </div>
          <div class="ds-row">
            <span class="ds-label">DMG SHARE</span>
            <span class="ds-value">${stats.damage_share != null ? stats.damage_share + '%' : '—'}</span>
          </div>
          <div class="ds-row">
            <span class="ds-label">CSPM</span>
            <span class="ds-value">${stats.cspm ?? '—'}</span>
          </div>
          <div class="ds-row">
            <span class="ds-label">VSPM</span>
            <span class="ds-value">${stats.vspm ?? '—'}</span>
          </div>
        </div>
        <div class="ds-group">
          <div class="ds-group-title">LANING @15</div>
          <div class="ds-row">
            <span class="ds-label">GOLD DIFF</span>
            <span class="ds-value">${_diffSpan(stats.gold_diff15)}</span>
          </div>
          <div class="ds-row">
            <span class="ds-label">XP DIFF</span>
            <span class="ds-value">${_diffSpan(stats.xp_diff15)}</span>
          </div>
          <div class="ds-row">
            <span class="ds-label">CS DIFF</span>
            <span class="ds-value">${_diffSpan(stats.cs_diff15)}</span>
          </div>
          <div class="ds-row">
            <span class="ds-label">AVG GOLD</span>
            <span class="ds-value">${stats.avg_gold15 != null ? Math.round(stats.avg_gold15).toLocaleString() : '—'}</span>
          </div>
        </div>
      </div>

      <div class="side-wr-row">
        <div class="side-wr-item">
          <span class="side-dot" style="color:#4a9eff">●</span>
          <span class="ds-label">BLUE</span>
          <span class="ds-value">${stats.blue_wr != null ? stats.blue_wr + '%' : '—'}</span>
          <span class="rec-g"> (${stats.blue_games ?? 0}g)</span>
        </div>
        <div class="side-wr-item">
          <span class="side-dot" style="color:#ff4a4a">●</span>
          <span class="ds-label">RED</span>
          <span class="ds-value">${stats.red_wr != null ? stats.red_wr + '%' : '—'}</span>
          <span class="rec-g"> (${stats.red_games ?? 0}g)</span>
        </div>
      </div>
    </div>

    <div id="player-champs-placeholder"></div>

    <div class="patch-chart-wrap">
      <div class="patch-chart-label">WIN RATE HISTORY</div>
      <div id="player-history-chart"></div>
    </div>
  `;
}

async function selectPlayer(p) {
  selectedPlayer = p;
  renderPlayerTable(getFilteredSortedPlayers());

  const card = document.getElementById('player-detail-card');
  card.innerHTML = '<div class="empty">Loading…</div>';

  const { year, split, patch } = getFilters();

  let stats;
  try {
    const r = await fetch(buildUrl('/api/player-stats', { player: p.playername, year, split, patch }));
    const body = await r.json();
    if (!r.ok) { card.innerHTML = `<div class="empty">Error ${r.status}: ${body.error || ''}</div>`; return; }
    stats = body;
  } catch (e) {
    card.innerHTML = `<div class="empty">Error: ${e.message}</div>`;
    return;
  }

  if (!stats || !stats.games) {
    card.innerHTML = '<div class="empty">No data</div>';
    return;
  }

  // Carry playername from the list row since the stats query uses MAX(teamname) etc.
  stats.playername = p.playername;
  card.innerHTML = buildPlayerDetailHTML(stats);

  setTimeout(() => {
    const fill = document.getElementById('player-wr-fill');
    if (fill) fill.style.width = stats.win_rate + '%';
  }, 20);

  const [champs, history] = await Promise.all([
    fetch(buildUrl('/api/player-champions',
      { player: p.playername, year, split, patch })).then(r => r.json()),
    fetch(buildUrl('/api/player-splits',
      { player: p.playername, year })).then(r => r.json()),
  ]);

  const champsEl = document.getElementById('player-champs-placeholder');
  if (champsEl) champsEl.innerHTML = buildPlayerChampsHTML(champs);

  const chartEl = document.getElementById('player-history-chart');
  if (chartEl) {
    chartEl.innerHTML = buildPatchChart(history);
    const scroller = chartEl.querySelector('.patch-chart-scroll');
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }
}
