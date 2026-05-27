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

function setRoleFilter(role) {
  playerRoleFilter = (playerRoleFilter === role) ? null : role;
  document.querySelectorAll('.role-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.role === playerRoleFilter);
  });
  renderPlayerTable(getFilteredSortedPlayers());
}

function getFilteredSortedPlayers() {
  const q = (document.getElementById('player-search')?.value || '').toLowerCase();
  const rows = playerData.filter(p => {
    if (playerRoleFilter && p.position !== playerRoleFilter) return false;
    return p.playername.toLowerCase().includes(q)
      || (p.teamname || '').toLowerCase().includes(q);
  });
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

function _ordinal(n) {
  if (!n) return '';
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function _bcCell(label, value, rank) {
  const rankStr = rank ? `<sup class="bc-rank">${_ordinal(rank)}</sup>` : '';
  return `<div class="bc-cell">
    <div class="bc-label">${label}</div>
    <div class="bc-value">${value != null ? value : '—'}${rankStr}</div>
  </div>`;
}

function buildBroadcastGrid(stats, rankings) {
  const r = rankings || {};
  const tot = r.total || '?';
  const sign = v => v != null ? (v > 0 ? `+${v}` : `${v}`) : '—';

  return `
  <div class="bc-section-title">STATS <span class="bc-vs-label">vs ${tot} ${(POS_LABEL[stats.position] || '').toLowerCase()}s</span></div>
  <div class="bc-grid">
    <div class="bc-row">
      ${_bcCell('GD@15',     sign(stats.gold_diff15),              r.gd15_rank)}
      ${_bcCell('CSD@15',    sign(stats.cs_diff15),                r.csd15_rank)}
      ${_bcCell('XPD@15',    sign(stats.xp_diff15),                r.xpd15_rank)}
    </div>
    <div class="bc-row">
      ${_bcCell('DPM',       stats.dpm,                            r.dpm_rank)}
      ${_bcCell('DMG%',      stats.damage_share != null ? stats.damage_share + '%' : null, r.dmg_share_rank)}
      ${_bcCell('KDA',       stats.kda,                            r.kda_rank)}
    </div>
    <div class="bc-row">
      ${_bcCell('CSPM',      stats.cspm,                           r.cspm_rank)}
      ${_bcCell('VSPM',      stats.vspm,                           r.vspm_rank)}
      ${_bcCell('GOLD@15',   stats.avg_gold15 != null ? Math.round(stats.avg_gold15).toLocaleString() : null, r.gold15_rank)}
    </div>
  </div>`;
}

function buildSplitHistoryTable(history) {
  if (!history || !history.length) return '';
  const rows = history.map(h => {
    const wrCls = wrClass(h.win_rate);
    const gd    = h.gd15 != null ? (h.gd15 > 0 ? `+${h.gd15}` : h.gd15) : '—';
    const csd   = h.csd15 != null ? (h.csd15 > 0 ? `+${h.csd15}` : h.csd15) : '—';
    return `<tr>
      <td class="sh-label">${h.label}</td>
      <td class="sh-num">${h.games}g</td>
      <td class="sh-wr ${wrCls}">${h.win_rate ?? '—'}%</td>
      <td class="sh-num">${h.kda ?? '—'}</td>
      <td class="sh-num">${h.dpm ?? '—'}</td>
      <td class="sh-diff">${gd}</td>
      <td class="sh-diff">${csd}</td>
    </tr>`;
  }).join('');
  return `<div class="bc-section-title" style="margin-top:16px">CAREER HISTORY</div>
  <div class="sh-wrap">
    <table class="sh-table">
      <thead>
        <tr>
          <th>SPLIT</th><th>G</th><th>WR</th><th>KDA</th><th>DPM</th><th>GD@15</th><th>CSD@15</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

let _poolChamps = [];
let _poolSort   = 'games';

function _sortedPool() {
  return [..._poolChamps].sort((a, b) =>
    _poolSort === 'wr'
      ? (b.win_rate ?? 0) - (a.win_rate ?? 0)
      : b.games - a.games
  );
}

function _renderPool() {
  const el = document.getElementById('pool-grid');
  if (!el) return;
  el.innerHTML = _sortedPool().map(c => {
    const tooltip  = `${c.champion} — ${c.games}g · ${c.win_rate}% WR · ${c.kda} KDA`;
    const wr       = c.win_rate ?? 50;
    const barColor = wr >= 55 ? '#27ae60' : wr <= 45 ? '#c0392b' : '#c89b3c';
    return `<div class="pool-icon">
      ${champImg(c.champion, 'pool-champ-icon')}
      <div class="pool-hover-overlay">
        <span class="pool-hover-wr" style="color:${barColor}">${wr}%</span>
      </div>
      <div class="pool-wr-bar-bg">
        <div class="pool-wr-bar-fill" style="width:${wr}%;background:${barColor}"></div>
      </div>
      <div class="pool-games">${c.games}</div>
    </div>`;
  }).join('');
}

function setPoolSort(key) {
  _poolSort = key;
  document.querySelectorAll('.pool-sort-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.sort === key)
  );
  _renderPool();
}

function buildPlayerChampsHTML(champs) {
  if (!champs || !champs.length) return '';
  _poolChamps = champs;
  _poolSort   = 'games';
  return `
  <div class="bc-section-title" style="display:flex;align-items:center;justify-content:space-between">
    <span>CHAMPION POOL</span>
    <span class="pool-sort-btns">
      <button class="pool-sort-btn active" data-sort="games" onclick="setPoolSort('games')">BY GAMES</button>
      <button class="pool-sort-btn"        data-sort="wr"    onclick="setPoolSort('wr')">BY WR</button>
    </span>
  </div>
  <div class="pool-grid" id="pool-grid"></div>`;
}

function buildPlayerDetailHTML(stats) {
  const losses   = stats.losses ?? 0;
  const wrCls    = wrClass(stats.win_rate);
  const lossRate = (100 - stats.win_rate).toFixed(1);
  const pos      = POS_LABEL[stats.position] || (stats.position || '').toUpperCase();

  return `
    <div class="detail-header">
      <div class="detail-header-info">
        <div class="detail-name">${stats.playername ?? ''}</div>
        <div class="detail-record">
          <span class="pos-badge pos-${stats.position}">${pos}</span>
          <span class="rec-sep"> · </span>
          ${teamImg(stats.teamname, 'team-logo')}
          <span style="color:var(--text)">${stats.teamname || '—'}</span>
        </div>
      </div>
      <div style="text-align:right">
        <div class="detail-wr ${wrCls}">${stats.win_rate}%</div>
        <div class="detail-record" style="justify-content:flex-end;margin-top:2px">
          <span class="rec-w">${stats.wins}W</span>
          <span class="rec-sep"> · </span>
          <span class="rec-l">${losses}L</span>
          <span class="rec-sep"> · </span>
          <span class="rec-g">${stats.games}g</span>
        </div>
      </div>
    </div>

    <div class="wr-bar-bg">
      <div class="wr-bar-fill" id="player-wr-fill" style="width:0%"></div>
    </div>
    <div class="wr-bar-numbers">
      <span class="w">${stats.win_rate}% W</span>
      <span class="l">${lossRate}% L</span>
    </div>

    <div class="bc-kda-row">
      <div class="bc-kda-main">${stats.kda ?? '—'}<span class="bc-kda-label"> KDA</span></div>
      <div class="bc-kda-breakdown">
        <span class="kda-k">${stats.avg_kills ?? '—'}</span>
        <span class="kda-sep"> / </span>
        <span class="kda-d">${stats.avg_deaths ?? '—'}</span>
        <span class="kda-sep"> / </span>
        <span class="kda-a">${stats.avg_assists ?? '—'}</span>
      </div>
      <div class="bc-side-wr">
        <span style="color:#4a9eff">●</span>
        <span class="bc-side-label">BLUE</span>
        <span class="bc-side-val">${stats.blue_wr != null ? stats.blue_wr + '%' : '—'}</span>
        <span class="rec-g">(${stats.blue_games ?? 0}g)</span>
        <span style="color:#ff4a4a;margin-left:10px">●</span>
        <span class="bc-side-label">RED</span>
        <span class="bc-side-val">${stats.red_wr != null ? stats.red_wr + '%' : '—'}</span>
        <span class="rec-g">(${stats.red_games ?? 0}g)</span>
      </div>
    </div>

    <div id="bc-grid-placeholder"></div>

    <div id="player-champs-placeholder"></div>

    <div id="bc-history-placeholder"></div>
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

  const [champs, rankings, history] = await Promise.all([
    fetch(buildUrl('/api/player-champions',
      { player: p.playername, year, split, patch })).then(r => r.json()),
    fetch(buildUrl('/api/player-rankings',
      { player: p.playername, year, split, patch })).then(r => r.json()),
    fetch(buildUrl('/api/player-split-history',
      { player: p.playername })).then(r => r.json()),
  ]);

  const gridEl    = document.getElementById('bc-grid-placeholder');
  const champsEl  = document.getElementById('player-champs-placeholder');
  const historyEl = document.getElementById('bc-history-placeholder');

  if (gridEl)    gridEl.innerHTML    = buildBroadcastGrid(stats, rankings);
  if (champsEl)  { champsEl.innerHTML = buildPlayerChampsHTML(champs); _renderPool(); }
  if (historyEl) historyEl.innerHTML = buildSplitHistoryTable(history);
}
