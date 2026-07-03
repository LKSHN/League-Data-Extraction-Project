// ── Filters: year + multi-select league ──────────────────
// Replaces the old year → split → patch cascade. Splits/patches are no
// longer filterable from the top bar; only year and a lolesports-style
// multi-select league picker (grouped into Major / International /
// Regional) remain.

// Best-effort grouping of Oracle's Elixir league codes. Anything not
// listed here falls into "Regional" automatically.
const LEAGUE_GROUPS = {
  'Major':         ['LEC', 'LCK', 'LPL', 'LCS'],
  'International': ['MSI', 'EWC', 'FST', 'Asia Master'],
};

let selectedLeagues = []; // [] = no filter (all leagues)

// Returns the currently selected { year, league } filters. `league` is an
// array (or null for no filter) — buildUrl serialises it as repeated
// ?league=X&league=Y params, matching what the Flask routes read.
function getFilters() {
  const year = +document.getElementById('year-select').value || null;
  return { year, league: selectedLeagues.length ? selectedLeagues : null };
}

function _groupFor(league) {
  for (const [group, codes] of Object.entries(LEAGUE_GROUPS)) {
    if (codes.includes(league)) return group;
  }
  return 'Regional';
}

function _updateLeagueButtonLabel() {
  const btn = document.getElementById('league-filter-btn');
  if (!btn) return;
  const caret = '<span class="league-filter-caret">▾</span>';
  const n = selectedLeagues.length;
  const label = n === 0 ? 'All Leagues'
    : n === 1 ? selectedLeagues[0]
    : `${n} Leagues`;
  btn.innerHTML = `${label} ${caret}`;
}

function _leagueOptionHTML(code) {
  const checked = selectedLeagues.includes(code) ? 'checked' : '';
  return `<label class="league-option">
    <input type="checkbox" value="${code}" ${checked}> ${code}
  </label>`;
}

function _renderLeaguePanel(leagues) {
  const panel = document.getElementById('league-filter-panel');
  if (!panel) return;

  const groups = { 'Major': [], 'International': [], 'Regional': [] };
  leagues.forEach(l => groups[_groupFor(l)].push(l));

  const sections = Object.entries(groups)
    .filter(([, codes]) => codes.length)
    .map(([group, codes]) => `
      <div class="league-group">
        <div class="league-group-title">${group.toUpperCase()}</div>
        ${codes.map(_leagueOptionHTML).join('')}
      </div>
    `).join('');

  panel.innerHTML = `
    ${sections}
    <div class="league-filter-actions">
      <button type="button" id="league-clear-btn">Clear</button>
    </div>
  `;

  panel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      selectedLeagues = [...panel.querySelectorAll('input:checked')]
        .map(c => c.value);
      _updateLeagueButtonLabel();
      reloadAll();
    });
  });

  const clearBtn = document.getElementById('league-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    selectedLeagues = [];
    panel.querySelectorAll('input:checked').forEach(cb => cb.checked = false);
    _updateLeagueButtonLabel();
    reloadAll();
  });
}

// Fetches the league list and builds the dropdown once at startup.
async function loadLeagues() {
  const leagues = await fetch('/api/leagues').then(r => r.json());
  _renderLeaguePanel(leagues);

  const filterEl = document.getElementById('league-filter');
  const btn       = document.getElementById('league-filter-btn');
  btn.addEventListener('click', () => filterEl.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!filterEl.contains(e.target)) filterEl.classList.remove('open');
  });
}
