// ── Team view ─────────────────────────────────────────────
// Renders the team list table and detail card.

// ── Team list table ───────────────────────────────────────
// Sorting/filtering/rendering mechanics are shared via data-table.js.

function buildTeamRowHTML(t) {
  const wrCls = wrClass(t.win_rate);
  return `<td class="name">${teamImg(t.teamname, 'team-logo')}${t.teamname}</td>`
    + `<td class="num">${t.games}</td>`
    + `<td class="wr ${wrCls}">${t.win_rate}%</td>`
    + `<td class="num">${t.avg_game_min != null ? t.avg_game_min + 'm' : '—'}</td>`;
}

const teamTable = createSortableTable({
  tbodyId: 'team-tbody',
  colAttr: 'data-col-t',
  defaultSort: { col: 'win_rate', dir: 'desc' },
  ascCols: ['teamname'],
  getData: () => teamData,
  matchesQuery: (t, q) => t.teamname.toLowerCase().includes(q),
  buildRowHTML: buildTeamRowHTML,
  isSelected: t => selectedTeam?.teamname === t.teamname,
  onSelect: t => selectTeam(t),
});

function renderTeamTable(data) {
  teamTable.render(data);
}

function getFilteredSortedTeams() {
  const q = document.getElementById('team-search')?.value || '';
  return teamTable.getFilteredSorted(q);
}

function setupTeamSortHeaders() {
  teamTable.setupSortHeaders(() => renderTeamTable(getFilteredSortedTeams()));
}

// ── Team detail card ──────────────────────────────────────

// ── Team champion pool (by role) ──────────────────────────

let _teamPicksData   = {};   // picks_by_role from API
let _teamPicksSort   = 'games';

const _ROLE_LABEL = { top: 'TOP', jng: 'JNG', mid: 'MID', bot: 'BOT', sup: 'SUP' };

function _teamPoolIcon(c, showWR) {
  const wr       = c.win_rate ?? 50;
  const barColor = wr >= 55 ? '#27ae60' : wr <= 45 ? '#c0392b' : '#c89b3c';
  const overlay  = showWR
    ? `<div class="pool-hover-overlay"><span class="pool-hover-wr" style="color:${barColor}">${wr}%</span></div>` : '';
  const bar      = showWR
    ? `<div class="pool-wr-bar-bg"><div class="pool-wr-bar-fill" style="width:${wr}%;background:${barColor}"></div></div>` : '';
  return `<div class="pool-icon">
    ${champImg(c.champion, 'pool-champ-icon')}
    ${overlay}
    ${bar}
    <div class="pool-games">${c.games}</div>
  </div>`;
}

function _renderTeamPool() {
  for (const pos of ['top', 'jng', 'mid', 'bot', 'sup']) {
    const el = document.getElementById(`team-pool-${pos}`);
    if (!el) continue;
    const champs = [...(_teamPicksData[pos] || [])].sort((a, b) =>
      _teamPicksSort === 'wr'
        ? (b.win_rate ?? 0) - (a.win_rate ?? 0)
        : b.games - a.games
    );
    el.innerHTML = champs.map(c => _teamPoolIcon(c, true)).join('');
  }
}

function setTeamPicksSort(key) {
  _teamPicksSort = key;
  document.querySelectorAll('.team-pool-sort-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.sort === key)
  );
  _renderTeamPool();
}

function buildTeamChampsHTML(data) {
  if (!data) return '';

  _teamPicksData = data.picks_by_role || {};
  _teamPicksSort = 'games';

  const roleSections = ['top', 'jng', 'mid', 'bot', 'sup'].map(pos => {
    const label = _ROLE_LABEL[pos];
    return `<div class="bc-section-title" style="margin-top:14px">
        <span class="pos-badge pos-${pos}">${label}</span>
      </div>
      <div class="pool-grid" id="team-pool-${pos}"></div>`;
  }).join('');

  const bans = (data.bans || []).map(c => _teamPoolIcon(c, false)).join('');

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">
      <div class="bc-section-title" style="margin:0">PICKS BY ROLE</div>
      <span class="pool-sort-btns">
        <button class="team-pool-sort-btn pool-sort-btn active" data-sort="games" onclick="setTeamPicksSort('games')">BY GAMES</button>
        <button class="team-pool-sort-btn pool-sort-btn"        data-sort="wr"    onclick="setTeamPicksSort('wr')">BY WR</button>
      </span>
    </div>
    ${roleSections}
    <div class="bc-section-title" style="margin-top:16px">MOST BANNED</div>
    <div class="pool-grid">${bans}</div>
  `;
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
  return `<div class="bc-section-title" style="margin-top:16px">HEAD-TO-HEAD</div><div>${rows}</div>`;
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
  return `<div class="bc-section-title" style="margin-top:16px">ROSTER</div><div>${rows}</div>`;
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

    <div class="bc-kda-row">
      <div class="bc-kda-main">${stats.avg_kills ?? '—'}<span class="bc-kda-label"> AVG K</span></div>
      <div class="bc-kda-breakdown" style="color:var(--text-dim)">
        <span class="kda-d">${stats.avg_deaths ?? '—'} D</span>
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
    <div class="bc-grid">
      <div class="bc-row">
        <div class="bc-cell"><div class="bc-label">AVG GAME</div><div class="bc-value">${stats.avg_game_min != null ? stats.avg_game_min + 'm' : '—'}</div></div>
        <div class="bc-cell"><div class="bc-label">AVG KILLS</div><div class="bc-value">${stats.avg_kills ?? '—'}</div></div>
        <div class="bc-cell"><div class="bc-label">AVG DEATHS</div><div class="bc-value">${stats.avg_deaths ?? '—'}</div></div>
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

  const { year, split, patch, league } = getFilters();

  const stats = await fetch(
    buildUrl('/api/team-stats', { team: t.teamname, year, split, patch, league })
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
      { team: t.teamname, year, split, patch, league })).then(r => r.json()),
    fetch(buildUrl('/api/team-matchups',
      { team: t.teamname, year, split, patch, league })).then(r => r.json()),
    fetch(buildUrl('/api/team-roster',
      { team: t.teamname, year, split, patch, league })).then(r => r.json()),
  ]);

  const champsEl   = document.getElementById('team-champs-placeholder');
  const matchupsEl = document.getElementById('team-matchups-placeholder');
  const rosterEl   = document.getElementById('team-roster-placeholder');

  if (champsEl)   { champsEl.innerHTML = buildTeamChampsHTML(champs); _renderTeamPool(); }
  if (matchupsEl) matchupsEl.innerHTML = buildTeamMatchupsHTML(matchups);
  if (rosterEl)   rosterEl.innerHTML   = buildTeamRosterHTML(roster);
}

// Switch from team roster to a specific player in the Players view.
function switchToPlayer(playerName) {
  document.querySelectorAll('.side-nav button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const btn = document.querySelector('.side-nav button[data-view="view-players"]');
  if (btn) btn.classList.add('active');
  document.getElementById('view-players')?.classList.add('active');

  const p = playerData.find(p => p.playername === playerName);
  if (p) selectPlayer(p);
}
