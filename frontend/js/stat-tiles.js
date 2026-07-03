// ── Stat tiles ────────────────────────────────────────────
// Small summary cards shown above each view's table, computed
// client-side from the already-fetched list data (no extra API calls).

function statTileHTML(value, label, sub) {
  return `<div class="stat-tile">
    <div class="stat-tile-value">${value}</div>
    <div class="stat-tile-label">${label}</div>
    ${sub != null ? `<div class="stat-tile-sub">${sub}</div>` : ''}
  </div>`;
}

function renderChampStatTiles() {
  const el = document.getElementById('champ-stat-tiles');
  if (!el) return;
  if (!allData.length) { el.innerHTML = ''; return; }

  const mostPicked = allData.reduce((a, b) => b.total_games > a.total_games ? b : a);
  const bestWR     = allData.reduce((a, b) => b.win_rate > a.win_rate ? b : a);
  const mostBanned = allData.reduce((a, b) => (b.ban_rate || 0) > (a.ban_rate || 0) ? b : a);

  el.innerHTML = [
    statTileHTML(allData.length, 'CHAMPIONS TRACKED'),
    statTileHTML(
      `${champImg(mostPicked.champion, 'stat-tile-icon')}${mostPicked.champion}`,
      'MOST PICKED', `${mostPicked.total_games} games`),
    statTileHTML(
      `${champImg(bestWR.champion, 'stat-tile-icon')}${bestWR.champion}`,
      'HIGHEST WIN RATE', `${bestWR.win_rate}%`),
    statTileHTML(
      `${champImg(mostBanned.champion, 'stat-tile-icon')}${mostBanned.champion}`,
      'MOST BANNED', `${mostBanned.ban_rate ?? 0}% ban rate`),
  ].join('');
}

function renderPlayerStatTiles() {
  const el = document.getElementById('player-stat-tiles');
  if (!el) return;
  if (!playerData.length) { el.innerHTML = ''; return; }

  const bestKDA   = playerData.reduce((a, b) => b.kda > a.kda ? b : a);
  const bestWR    = playerData.reduce((a, b) => b.win_rate > a.win_rate ? b : a);
  const mostGames = playerData.reduce((a, b) => b.games > a.games ? b : a);

  el.innerHTML = [
    statTileHTML(playerData.length, 'PLAYERS TRACKED'),
    statTileHTML(bestKDA.playername, 'BEST KDA', `${bestKDA.kda} KDA`),
    statTileHTML(bestWR.playername, 'HIGHEST WIN RATE', `${bestWR.win_rate}%`),
    statTileHTML(mostGames.playername, 'MOST GAMES', `${mostGames.games} games`),
  ].join('');
}

function renderTeamStatTiles() {
  const el = document.getElementById('team-stat-tiles');
  if (!el) return;
  if (!teamData.length) { el.innerHTML = ''; return; }

  const bestWR    = teamData.reduce((a, b) => b.win_rate > a.win_rate ? b : a);
  const mostGames = teamData.reduce((a, b) => b.games > a.games ? b : a);
  const lengths   = teamData.map(t => t.avg_game_min).filter(v => v != null);
  const avgLen    = lengths.length
    ? (lengths.reduce((a, b) => a + b, 0) / lengths.length).toFixed(1)
    : '—';

  el.innerHTML = [
    statTileHTML(teamData.length, 'TEAMS TRACKED'),
    statTileHTML(
      `${teamImg(bestWR.teamname, 'stat-tile-icon')}${bestWR.teamname}`,
      'TOP WIN RATE', `${bestWR.win_rate}%`),
    statTileHTML(
      `${teamImg(mostGames.teamname, 'stat-tile-icon')}${mostGames.teamname}`,
      'MOST GAMES', `${mostGames.games} games`),
    statTileHTML(`${avgLen}m`, 'AVG GAME LENGTH'),
  ].join('');
}

function renderGamesStatTiles() {
  const el = document.getElementById('games-stat-tiles');
  if (!el) return;
  if (!gamesData.length) { el.innerHTML = ''; return; }

  const seriesCount = groupBySeries(gamesData).length;
  const durations   = gamesData.map(g => g.gamelength).filter(Boolean);
  const avgDur      = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;
  const longest     = gamesData.reduce(
    (a, b) => (b.gamelength || 0) > (a.gamelength || 0) ? b : a);

  el.innerHTML = [
    statTileHTML(seriesCount, 'SERIES'),
    statTileHTML(gamesData.length, 'GAMES'),
    statTileHTML(formatDuration(avgDur), 'AVG DURATION'),
    statTileHTML(
      formatDuration(longest.gamelength),
      'LONGEST GAME', `${longest.blue_team || '—'} vs ${longest.red_team || '—'}`),
  ].join('');
}
