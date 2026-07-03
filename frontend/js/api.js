// ── API helpers ──────────────────────────────────────────
// buildUrl and the two data-reload functions used by filters and bootstrap.

// Generic URL builder — omits any param whose value is null/empty.
// Array values (e.g. leagues) are appended as repeated keys:
// { league: ['LEC','LCK'] } → ?league=LEC&league=LCK
function buildUrl(base, params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || v === '') return;
    if (Array.isArray(v)) v.forEach(item => p.append(k, item));
    else p.set(k, v);
  });
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

async function reloadData() {
  const url = buildUrl('/api/data', getFilters());
  allData = await fetch(url).then(r => r.json());
  selectedChamp = null;
  document.getElementById('detail-card').innerHTML =
    '<div class="empty">Select a champion</div>';
  renderTable(getFilteredSorted());
  renderChampStatTiles();
}

async function reloadGames() {
  const list = document.getElementById('games-list');
  list.innerHTML = '<div class="loading">Loading…</div>';
  gamesData = await fetch(
    buildUrl('/api/games', getFilters())
  ).then(r => r.json());
  renderGames(gamesData);
  renderGamesStatTiles();
}

async function reloadPlayers() {
  playerData = await fetch(
    buildUrl('/api/players', getFilters())
  ).then(r => r.json());
  selectedPlayer = null;
  document.getElementById('player-detail-card').innerHTML =
    '<div class="empty">Select a player</div>';
  renderPlayerTable(getFilteredSortedPlayers());
  renderPlayerStatTiles();
}

async function reloadTeams() {
  teamData = await fetch(
    buildUrl('/api/teams', getFilters())
  ).then(r => r.json());
  selectedTeam = null;
  document.getElementById('team-detail-card').innerHTML =
    '<div class="empty">Select a team</div>';
  renderTeamTable(getFilteredSortedTeams());
  renderTeamStatTiles();
}

function reloadAll() {
  reloadData();
  reloadGames();
  reloadPlayers();
  reloadTeams();
}
