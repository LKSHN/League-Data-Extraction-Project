// ── Team view ─────────────────────────────────────────────
// Renders the team list table and detail card.

// ── Team list table ───────────────────────────────────────

function buildTeamRowHTML(t) {
  const wrCls = wrClass(t.win_rate);
  return `<td class="name">${teamImg(t.teamname, 'team-logo')}${t.teamname}</td>`
    + `<td class="num">${t.games}</td>`
    + `<td class="wr ${wrCls}">${t.win_rate}%</td>`
    + `<td class="num">${t.avg_game_min != null ? t.avg_game_min + 'm' : '—'}</td>`;
}

function renderTeamTable(data) {
  const tbody = document.getElementById('team-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  data.forEach(t => {
    const tr = document.createElement('tr');
    if (selectedTeam?.teamname === t.teamname) tr.classList.add('selected');
    tr.innerHTML = buildTeamRowHTML(t);
    tr.addEventListener('click', () => selectTeam(t));
    tbody.appendChild(tr);
  });
}

function getFilteredSortedTeams() {
  const q = (document.getElementById('team-search')?.value || '').toLowerCase();
  const rows = teamData.filter(t => t.teamname.toLowerCase().includes(q));
  rows.sort((a, b) => {
    const av = typeof a[teamSortCol] === 'string' ? a[teamSortCol] : +a[teamSortCol];
    const bv = typeof b[teamSortCol] === 'string' ? b[teamSortCol] : +b[teamSortCol];
    if (av < bv) return teamSortDir === 'asc' ? -1 :  1;
    if (av > bv) return teamSortDir === 'asc' ?  1 : -1;
    return 0;
  });
  return rows;
}

function setupTeamSortHeaders() {
  document.querySelectorAll('thead th[data-col-t]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.colT;
      teamSortDir = teamSortCol === col
        ? (teamSortDir === 'asc' ? 'desc' : 'asc')
        : (col === 'teamname' ? 'asc' : 'desc');
      teamSortCol = col;
      document.querySelectorAll('thead th[data-col-t]')
        .forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(teamSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      renderTeamTable(getFilteredSortedTeams());
    });
  });
  const defaultTh = document.querySelector('thead th[data-col-t="win_rate"]');
  if (defaultTh) defaultTh.classList.add('sort-desc');
}

// ── Team detail card ──────────────────────────────────────

function buildTeamChampsHTML(data) {
  if (!data) return '';

  const cell = (c, showWR) => {
    const img   = champImg(c.champion, 'champ-icon-sm');
    const wrCls = wrClass(c.win_rate);
    const wr    = showWR && c.win_rate != null
      ? `<span class="wr ${wrCls}" style="font-size:9px">${c.win_rate}%</span>` : '';
    return `<div class="item-cell" title="${c.champion} — ${c.games}g${showWR && c.win_rate != null ? ' · ' + c.win_rate + '% WR' : ''}">
      ${img}
      <span class="item-picks">${c.games}</span>
      ${wr}
    </div>`;
  };

  const picks = (data.picks || []).map(c => cell(c, true)).join('');
  const bans  = (data.bans  || []).map(c => cell(c, false)).join('');

  return `<div class="items-section">
      <div class="ds-group-title">MOST PICKED</div>
      <div class="items-grid">${picks}</div>
    </div>
    <div class="items-section">
      <div class="ds-group-title">MOST BANNED</div>
      <div class="items-grid">${bans}</div>
    </div>`;
}

function buildTeamMatchupsHTML(matchups) {
  if (!matchups || !matchups.length) return '';
  const rows = matchups.map(m => {
    const wrPct = Math.round(m.wins / m.games * 100);
    const wrCls = wrClass(wrPct);
    return `<div class="ds-row">
      <span class="ds-label">${teamImg(m.opponent, 'team-logo')}${m.opponent}</span>
      <span class="ds-value" style="display:flex;align-items:center;gap:6px">
        <span><span class="rec-w">${m.wins}</span><span class="rec-sep">–</span><span class="rec-l">${m.losses}</span></span>
        <span class="wr ${wrCls}" style="font-size:11px">${wrPct}%</span>
      </span>
    </div>`;
  }).join('');
  return `<div class="team-section-title">HEAD-TO-HEAD</div><div>${rows}</div>`;
}

function buildTeamRosterHTML(roster) {
  if (!roster || !roster.length) return '';
  const rows = roster.map(p => {
    const wrCls = wrClass(p.win_rate);
    const pos   = (POS_LABEL || {})[p.position] || (p.position || '').toUpperCase();
    return `<div class="ds-row roster-row" onclick="switchToPlayer('${p.playername}')">
      <span class="ds-label">
        <span class="pos-badge pos-${p.position}">${pos}</span>
        <span style="margin-left:6px">${p.playername}</span>
      </span>
      <span class="ds-value" style="display:flex;align-items:center;gap:8px">
        <span class="num" style="font-size:11px">${p.games}g · ${p.kda} KDA</span>
        <span class="wr ${wrCls}">${p.win_rate}%</span>
      </span>
    </div>`;
  }).join('');
  return `<div class="team-section-title">ROSTER</div><div>${rows}</div>`;
}

function buildTeamDetailHTML(t, stats) {
  const wrCls   = wrClass(stats.win_rate);
  const lossRate = (100 - stats.win_rate).toFixed(1);
  const logo    = teamImg(t.teamname, 'champ-icon-lg');

  return `
    <div class="detail-header">
      ${logo || `<div class="champ-icon-lg" style="display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--text-dim)">${t.teamname.slice(0,2)}</div>`}
      <div class="detail-header-info">
        <div class="detail-name">${t.teamname}</div>
        <div class="detail-record">
          <span class="rec-w">${stats.wins}W</span>
          <span class="rec-sep"> · </span>
          <span class="rec-l">${stats.losses}L</span>
          <span class="rec-sep"> · </span>
          <span class="rec-g">${stats.games} games</span>
        </div>
      </div>
      <div class="detail-wr ${wrCls}">${stats.win_rate}%</div>
    </div>

    <div class="wr-bar-bg">
      <div class="wr-bar-fill" id="team-wr-fill" style="width:0%"></div>
    </div>
    <div class="wr-bar-numbers">
      <span class="w">${stats.win_rate}% W</span>
      <span class="l">${lossRate}% L</span>
    </div>

    <div class="detail-stats">
      <div class="ds-columns">
        <div class="ds-group">
          <div class="ds-group-title">OVERVIEW</div>
          <div class="ds-row">
            <span class="ds-label">AVG GAME</span>
            <span class="ds-value">${stats.avg_game_min != null ? stats.avg_game_min + 'm' : '—'}</span>
          </div>
          <div class="ds-row">
            <span class="ds-label">AVG KILLS</span>
            <span class="ds-value">${stats.avg_kills ?? '—'}</span>
          </div>
          <div class="ds-row">
            <span class="ds-label">AVG DEATHS</span>
            <span class="ds-value">${stats.avg_deaths ?? '—'}</span>
          </div>
        </div>
        <div class="ds-group">
          <div class="ds-group-title">SIDE WIN RATE</div>
          <div class="ds-row">
            <span class="ds-label"><span style="color:#4a9eff">●</span> BLUE <span class="rec-g">(${stats.blue_games ?? 0}g)</span></span>
            <span class="ds-value">${stats.blue_wr != null ? stats.blue_wr + '%' : '—'}</span>
          </div>
          <div class="ds-row">
            <span class="ds-label"><span style="color:#ff4a4a">●</span> RED <span class="rec-g">(${stats.red_games ?? 0}g)</span></span>
            <span class="ds-value">${stats.red_wr != null ? stats.red_wr + '%' : '—'}</span>
          </div>
        </div>
      </div>
    </div>

    <div id="team-champs-placeholder"></div>
    <div id="team-matchups-placeholder"></div>
    <div id="team-roster-placeholder"></div>
  `;
}

async function selectTeam(t) {
  selectedTeam = t;
  renderTeamTable(getFilteredSortedTeams());

  const card = document.getElementById('team-detail-card');
  card.innerHTML = '<div class="empty">Loading…</div>';

  const { year, split, patch } = getFilters();

  const stats = await fetch(
    buildUrl('/api/team-stats', { team: t.teamname, year, split, patch })
  ).then(r => r.json());

  if (!stats || !stats.games) {
    card.innerHTML = '<div class="empty">No data</div>';
    return;
  }

  card.innerHTML = buildTeamDetailHTML(t, stats);

  setTimeout(() => {
    const fill = document.getElementById('team-wr-fill');
    if (fill) fill.style.width = stats.win_rate + '%';
  }, 20);

  const [champs, matchups, roster] = await Promise.all([
    fetch(buildUrl('/api/team-champions',
      { team: t.teamname, year, split, patch })).then(r => r.json()),
    fetch(buildUrl('/api/team-matchups',
      { team: t.teamname, year, split, patch })).then(r => r.json()),
    fetch(buildUrl('/api/team-roster',
      { team: t.teamname, year, split, patch })).then(r => r.json()),
  ]);

  const champsEl   = document.getElementById('team-champs-placeholder');
  const matchupsEl = document.getElementById('team-matchups-placeholder');
  const rosterEl   = document.getElementById('team-roster-placeholder');

  if (champsEl)   champsEl.innerHTML   = buildTeamChampsHTML(champs);
  if (matchupsEl) matchupsEl.innerHTML = buildTeamMatchupsHTML(matchups);
  if (rosterEl)   rosterEl.innerHTML   = buildTeamRosterHTML(roster);
}

// Switch from team roster to a specific player in the Players view.
function switchToPlayer(playerName) {
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const btn = document.querySelector('nav button[data-view="view-players"]');
  if (btn) btn.classList.add('active');
  document.getElementById('view-players')?.classList.add('active');

  const p = playerData.find(p => p.playername === playerName);
  if (p) selectPlayer(p);
}
