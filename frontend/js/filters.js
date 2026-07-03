// ── Filters: multi-select year + league drawer ───────────
// A single sliding drawer under the top bar hosts either the year
// checkboxes or the league checkboxes, depending on which button was
// clicked. Only one filter's content occupies the drawer at a time.

// League checkboxes are grouped as a tier hierarchy: international
// championships first, then each region's top league, then each
// region's second league, then whatever's left (lower divisions,
// wildcards, less common leagues) in one alphabetical "Other" bucket.
// Order within a tier is deliberate, not alphabetical.
const LEAGUE_TIERS = [
  { label: 'International', codes: ['MSI', 'EWC', 'FST', 'Asia Master'] },
  { label: 'Top League',    codes: ['LCK', 'LPL', 'LEC', 'LCS', 'CBLOL', 'LJL', 'VCS', 'PCS', 'LAS'] },
  { label: 'Second League', codes: ['LCKC', 'NACL', 'CD', 'LFL', 'LPLOL', 'LCP', 'LRN', 'LRS'] },
];

let allYears        = [];
let allLeagues       = [];
let selectedYears    = []; // strings; [] = no filter (all years)
let selectedLeagues  = []; // strings; [] = no filter (all leagues)

// Returns the currently selected { year, league } filters. Both are
// arrays (or null) — buildUrl serialises them as repeated query params.
function getFilters() {
  return {
    year:   selectedYears.length   ? selectedYears.map(Number) : null,
    league: selectedLeagues.length ? selectedLeagues : null,
  };
}

function _optionHTML(value, checked, img) {
  return `<label class="filter-option">
    <input type="checkbox" value="${value}" ${checked ? 'checked' : ''}>
    ${img || ''}${value}
  </label>`;
}

function _clearActionsHTML() {
  return `<div class="filter-drawer-actions">
    <button type="button" class="filter-clear-btn">Clear</button>
  </div>`;
}

function _yearBodyHTML() {
  const options = allYears.map(y => _optionHTML(y, selectedYears.includes(String(y))));
  return `<div class="filter-options-row">${options.join('')}</div>${_clearActionsHTML()}`;
}

function _leagueBodyHTML() {
  const present = new Set(allLeagues);
  const used     = new Set();
  const sections = [];

  for (const { label, codes } of LEAGUE_TIERS) {
    const codesInDb = codes.filter(c => present.has(c));
    codesInDb.forEach(c => used.add(c));
    if (codesInDb.length) sections.push([label, codesInDb]);
  }

  // Everything not placed in a tier above — alphabetical so it's easy
  // to scan (lower divisions, wildcards, less common leagues).
  const other = allLeagues.filter(l => !used.has(l)).sort();
  if (other.length) sections.push(['Other Leagues', other]);

  const html = sections.map(([group, codes]) => `
    <div class="filter-group">
      <div class="filter-group-title">${group.toUpperCase()}</div>
      <div class="filter-options-row">
        ${codes.map(c => _optionHTML(
          c, selectedLeagues.includes(c), leagueImg(c, 'filter-option-icon')
        )).join('')}
      </div>
    </div>
  `).join('');

  return html + _clearActionsHTML();
}

function _updateButtonLabel(kind) {
  const btn = document.getElementById(`${kind}-filter-btn`);
  if (!btn) return;
  const arr   = kind === 'year' ? selectedYears : selectedLeagues;
  const empty = kind === 'year' ? 'All Years' : 'All Leagues';
  const n     = arr.length;
  const label = n === 0 ? empty : n === 1 ? arr[0] : `${n} selected`;
  btn.innerHTML = `${label} <span class="filter-drawer-caret">▾</span>`;
}

function _renderDrawerBody(kind) {
  const body = document.getElementById('filter-drawer-body');
  body.innerHTML = kind === 'year' ? _yearBodyHTML() : _leagueBodyHTML();
  body.dataset.active = kind;
}

// Re-renders the drawer only if it's currently showing `kind` — used to
// pick up league logos once they've loaded, without forcing it open.
function _refreshDrawerIfShowing(kind) {
  const body = document.getElementById('filter-drawer-body');
  if (body && body.dataset.active === kind) _renderDrawerBody(kind);
}

function _openDrawer(kind) {
  _renderDrawerBody(kind);
  document.getElementById('filter-drawer').classList.add('open');
  document.querySelectorAll('.filter-drawer-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.kind === kind));
}

function _closeDrawer() {
  document.getElementById('filter-drawer').classList.remove('open');
  document.querySelectorAll('.filter-drawer-btn').forEach(b => b.classList.remove('active'));
}

function _toggleDrawer(kind) {
  const drawer = document.getElementById('filter-drawer');
  const body   = document.getElementById('filter-drawer-body');
  const isOpenSame = drawer.classList.contains('open') && body.dataset.active === kind;
  if (isOpenSame) _closeDrawer();
  else _openDrawer(kind);
}

// Populates the year list. Defaults to the most recent year selected,
// matching the old single-select's default behaviour.
function loadYears(years) {
  allYears = years;
  selectedYears = years.length ? [String(years[0])] : [];
  _updateButtonLabel('year');
}

async function loadLeagues() {
  allLeagues = await fetch('/api/leagues').then(r => r.json());
  _updateButtonLabel('league');
}

function setupFilterDrawer() {
  document.getElementById('year-filter-btn')
    .addEventListener('click', () => _toggleDrawer('year'));
  document.getElementById('league-filter-btn')
    .addEventListener('click', () => _toggleDrawer('league'));

  const body = document.getElementById('filter-drawer-body');

  body.addEventListener('change', e => {
    if (!e.target.matches('input[type="checkbox"]')) return;
    const kind   = body.dataset.active;
    const values = [...body.querySelectorAll('input:checked')].map(c => c.value);
    if (kind === 'year') selectedYears = values; else selectedLeagues = values;
    _updateButtonLabel(kind);
    reloadAll();
  });

  body.addEventListener('click', e => {
    if (!e.target.matches('.filter-clear-btn')) return;
    const kind = body.dataset.active;
    if (kind === 'year') selectedYears = []; else selectedLeagues = [];
    _renderDrawerBody(kind);
    _updateButtonLabel(kind);
    reloadAll();
  });

  document.addEventListener('click', e => {
    const drawer = document.getElementById('filter-drawer');
    const bar    = document.querySelector('.controls-bar');
    if (!drawer.contains(e.target) && !bar.contains(e.target)) _closeDrawer();
  });
}
