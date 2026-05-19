// ── API helpers ──────────────────────────────────────────
// buildUrl and the two data-reload functions used by filters and bootstrap.

// Generic URL builder — omits any param whose value is null/empty.
function buildUrl(base, params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') p.set(k, v);
  });
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

async function reloadData() {
  const url = buildUrl('/api/data', getFilters());
  allData = await fetch(url).then(r => r.json());
  selectedChamp = null;
  // Clear the detail card so stale stats from the previous filter don't linger.
  document.getElementById('detail-card').innerHTML =
    '<div class="empty">Select a champion</div>';
  renderTable(getFilteredSorted());
}

async function reloadGames() {
  const tbody = document.getElementById('games-tbody');
  tbody.innerHTML =
    '<tr><td colspan="6" class="loading">Loading…</td></tr>';
  gamesData = await fetch(
    buildUrl('/api/games', getFilters())
  ).then(r => r.json());
  renderGames(gamesData);
}

function reloadAll() {
  reloadData();
  reloadGames();
}
