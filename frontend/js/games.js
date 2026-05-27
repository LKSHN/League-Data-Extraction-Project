// ── Games view ───────────────────────────────────────────
// Renders the game-results table grouped into series (BO1/BO3/BO5).

function formatDuration(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = String(Math.floor(secs % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

// DD/MM/YYYY (French format)
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = dateStr.slice(0, 10).split('-');
  return `${d[2]}/${d[1]}/${d[0]}`;
}

// ── Team filter ───────────────────────────────────────────

function getGameTeamFilter() {
  return (document.getElementById('game-team-search')?.value || '').toLowerCase();
}

// ── Series grouping ───────────────────────────────────────

function groupBySeries(games) {
  const map = new Map();
  games.forEach(g => {
    const date = g.date ? g.date.slice(0, 10) : '';
    const pair = [g.blue_team, g.red_team].sort();
    const key  = `${date}|${pair[0]}|${pair[1]}`;
    if (!map.has(key)) {
      map.set(key, {
        date,
        split:  g.split,
        patch:  g.patch,
        teamA:  pair[0],
        teamB:  pair[1],
        winsA:  0,
        winsB:  0,
        games:  [],
      });
    }
    const s = map.get(key);
    const winner = g.winner === 'blue' ? g.blue_team : g.red_team;
    if (winner === s.teamA) s.winsA++; else s.winsB++;
    s.games.push(g);
  });
  return [...map.values()];
}

function boType(s) {
  const maxW = Math.max(s.winsA, s.winsB);
  if (maxW >= 3) return 'BO5';
  if (maxW >= 2) return 'BO3';
  return 'BO1';
}

// ── Champion picks strip ──────────────────────────────────

function picksHTML(champions) {
  if (!champions || !champions.length) return '';
  return `<div class="game-picks">${
    champions.map(c => champImg(c, 'champ-icon-xs')).join('')
  }</div>`;
}

// ── Row builders ─────────────────────────────────────────

function buildSeriesRow(s) {
  const bo    = boType(s);
  const aWins = s.winsA > s.winsB;
  const aLogo = teamImg(s.teamA, 'team-logo');
  const bLogo = teamImg(s.teamB, 'team-logo');
  const aCls  = aWins ? 'rec-w' : 'rec-l';
  const bCls  = aWins ? 'rec-l' : 'rec-w';
  const meta  = [s.split, s.patch].filter(Boolean).join(' · ');

  const tr = document.createElement('tr');
  tr.className = 'series-row';
  tr.innerHTML = `<td colspan="4" class="series-cell">
    <div class="series-inner">
      <span class="series-chevron">▸</span>
      <span class="series-date">${formatDate(s.date)}<span class="series-meta">${meta ? ' · ' + meta : ''}</span></span>
      <span class="series-matchup">
        <span class="series-team">${aLogo}<span>${s.teamA}</span></span>
        <span class="series-score">
          <span class="${aCls}">${s.winsA}</span>
          <span class="rec-sep">–</span>
          <span class="${bCls}">${s.winsB}</span>
        </span>
        <span class="series-team"><span>${s.teamB}</span>${bLogo}</span>
      </span>
      <span class="bo-badge bo-${bo.toLowerCase()}">${bo}</span>
    </div>
  </td>`;
  return tr;
}

function buildGameRows(series) {
  return series.games.map((g, i) => {
    const bCls = g.winner === 'blue' ? 'win' : 'loss';
    const rCls = g.winner === 'red'  ? 'win' : 'loss';
    const bImg = teamImg(g.blue_team, 'team-logo');
    const rImg = teamImg(g.red_team,  'team-logo');
    const tr   = document.createElement('tr');
    tr.className = 'game-row hidden';
    tr.innerHTML = `
      <td class="game-num">G${i + 1}</td>
      <td class="game-team blue-side ${bCls}">
        <div class="game-team-name">${bImg}${g.blue_team || '—'}</div>
        ${picksHTML(g.blue_picks)}
      </td>
      <td class="game-team red-side ${rCls}">
        <div class="game-team-name">${rImg}${g.red_team || '—'}</div>
        ${picksHTML(g.red_picks)}
      </td>
      <td class="game-dur">${formatDuration(g.gamelength)}</td>
    `;
    return tr;
  });
}

// ── Render ────────────────────────────────────────────────

function renderGames(games) {
  const tbody = document.getElementById('games-tbody');
  tbody.innerHTML = '';

  const q = getGameTeamFilter();
  const seriesList = groupBySeries(games).filter(s =>
    !q || s.teamA.toLowerCase().includes(q) || s.teamB.toLowerCase().includes(q)
  );

  if (!seriesList.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading">No results</td></tr>';
    return;
  }

  seriesList.forEach(s => {
    const seriesRow = buildSeriesRow(s);
    const gameRows  = buildGameRows(s);

    seriesRow.addEventListener('click', () => {
      const expanded = seriesRow.classList.toggle('expanded');
      gameRows.forEach(r => r.classList.toggle('hidden', !expanded));
    });

    tbody.appendChild(seriesRow);
    gameRows.forEach(r => tbody.appendChild(r));
  });
}
