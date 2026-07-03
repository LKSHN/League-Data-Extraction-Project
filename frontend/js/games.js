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

// ── Card builders ────────────────────────────────────────

function buildSeriesHeader(s) {
  const bo    = boType(s);
  const aWins = s.winsA > s.winsB;
  const aLogo = teamImg(s.teamA, 'team-logo');
  const bLogo = teamImg(s.teamB, 'team-logo');
  const aCls  = aWins ? 'rec-w' : 'rec-l';
  const bCls  = aWins ? 'rec-l' : 'rec-w';
  const meta  = [s.split, s.patch].filter(Boolean).join(' · ');

  const header = document.createElement('div');
  header.className = 'series-card-header';
  header.innerHTML = `
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
  `;
  return header;
}

function buildGameRow(g, i) {
  const bCls = g.winner === 'blue' ? 'win' : 'loss';
  const rCls = g.winner === 'red'  ? 'win' : 'loss';
  const bImg = teamImg(g.blue_team, 'team-logo');
  const rImg = teamImg(g.red_team,  'team-logo');
  const row  = document.createElement('div');
  row.className = 'game-row';
  row.innerHTML = `
    <span class="game-num">G${i + 1}</span>
    <span class="game-team blue-side ${bCls}">
      <span class="game-team-name">${bImg}${g.blue_team || '—'}</span>
      ${picksHTML(g.blue_picks)}
    </span>
    <span class="game-team red-side ${rCls}">
      <span class="game-team-name">${rImg}${g.red_team || '—'}</span>
      ${picksHTML(g.red_picks)}
    </span>
    <span class="game-dur">${formatDuration(g.gamelength)}</span>
  `;
  return row;
}

function buildSeriesCard(s) {
  const card = document.createElement('div');
  card.className = 'series-card';

  const header = buildSeriesHeader(s);
  const body   = document.createElement('div');
  body.className = 'series-card-games';
  s.games.forEach((g, i) => body.appendChild(buildGameRow(g, i)));

  header.addEventListener('click', () => {
    card.classList.toggle('expanded');
  });

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

// ── Render ────────────────────────────────────────────────

function renderGames(games) {
  const list = document.getElementById('games-list');
  list.innerHTML = '';

  const q = getGameTeamFilter();
  const seriesList = groupBySeries(games).filter(s =>
    !q || s.teamA.toLowerCase().includes(q) || s.teamB.toLowerCase().includes(q)
  );

  if (!seriesList.length) {
    list.innerHTML = '<div class="loading">No results</div>';
    return;
  }

  seriesList.forEach(s => list.appendChild(buildSeriesCard(s)));
}
