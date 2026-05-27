// ── Bootstrap ────────────────────────────────────────────
// Entry point — runs once the DOM is ready.
// Wires up all event listeners and kicks off the initial data load.

function setupNav() {
  const btns  = document.querySelectorAll('nav button');
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
  const sel  = document.getElementById('year-select');
  info.years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    sel.appendChild(opt);
  });
  if (info.years.length > 0) sel.value = info.years[0];
  // Wire up the cascade: year → split → patch → reload
  sel.addEventListener('change', () => loadSplits(+sel.value || null));
  document.getElementById('split-select').addEventListener('change', loadPatches);
  document.getElementById('patch-select').addEventListener('change', reloadAll);
}

document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
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
  const year = +document.getElementById('year-select').value || null;
  // loadSplits triggers reloadAll internally, so no separate data fetch needed.
  await loadSplits(year);

  // Icons load asynchronously and re-render once ready without blocking data.
  loadDDragon().then(() => {
    renderTable(getFilteredSorted());
    renderPlayerTable(getFilteredSortedPlayers());
  });
  loadTeamLogos().then(() => {
    renderGames(gamesData);
    renderTeamTable(getFilteredSortedTeams());
  });
});
