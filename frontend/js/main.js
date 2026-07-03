// ── Bootstrap ────────────────────────────────────────────
// Entry point — runs once the DOM is ready.
// Wires up all event listeners and kicks off the initial data load.

function setupNav() {
  const btns  = document.querySelectorAll('.side-nav button');
  const views = document.querySelectorAll('.view');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.view).classList.add('active');
    });
  });
}

async function loadInfo() {
  const info = await fetch('/api/info').then(r => r.json());
  loadYears(info.years);
}

document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  setupFilterDrawer();
  setupSortHeaders();
  setupPlayerSortHeaders();
  setupTeamSortHeaders();

  document.getElementById('search')
    .addEventListener('input', () => renderTable(getFilteredSorted()));
  document.getElementById('player-search')
    .addEventListener('input', () => renderPlayerTable(getFilteredSortedPlayers()));
  document.getElementById('team-search')
    .addEventListener('input', () => renderTeamTable(getFilteredSortedTeams()));
  document.getElementById('game-team-search')
    .addEventListener('input', () => renderGames(gamesData));

  await loadInfo();
  await loadLeagues();
  reloadAll();

  // Icons load asynchronously and re-render once ready without blocking data.
  loadDDragon().then(() => {
    renderTable(getFilteredSorted());
    renderPlayerTable(getFilteredSortedPlayers());
    renderChampStatTiles();
  });
  loadTeamLogos().then(() => {
    renderGames(gamesData);
    renderTeamTable(getFilteredSortedTeams());
    renderGamesStatTiles();
    renderTeamStatTiles();
  });
  loadLeagueLogos().then(() => _refreshDrawerIfShowing('league'));
});
