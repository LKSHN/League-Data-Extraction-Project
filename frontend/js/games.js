// ── Games view ───────────────────────────────────────────
// Renders the game-results table in the Games tab.

// Converts a duration in seconds to "MM:SS" format.
function formatDuration(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = String(Math.floor(secs % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

// Builds a single game row's inner HTML.
function buildGameRowHTML(g) {
  const bCls = g.winner === 'blue' ? 'win' : 'loss';
  const rCls = g.winner === 'red'  ? 'win' : 'loss';
  const date = g.date ? g.date.slice(0, 10) : '—';
  const bImg = teamImg(g.blue_team, 'team-logo');
  const rImg = teamImg(g.red_team,  'team-logo');
  return `<td class="game-date">${date}</td>`
    + `<td class="game-split">${g.split || '—'}</td>`
    + `<td class="game-patch">${g.patch || '—'}</td>`
    + `<td class="game-team blue-side ${bCls}">${bImg}${g.blue_team || '—'}</td>`
    + `<td class="game-team red-side  ${rCls}">${rImg}${g.red_team  || '—'}</td>`
    + `<td class="game-dur">${formatDuration(g.gamelength)}</td>`;
}

// Re-renders the games table body from an array of game objects.
function renderGames(games) {
  const tbody = document.getElementById('games-tbody');
  tbody.innerHTML = '';
  games.forEach(g => {
    const tr = document.createElement('tr');
    tr.innerHTML = buildGameRowHTML(g);
    tbody.appendChild(tr);
  });
}
