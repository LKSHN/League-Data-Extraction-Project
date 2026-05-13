// ── State ────────────────────────────────────────────────
let allData       = [];   // champion stats array from /api/data
let sortCol       = 'win_rate';
let sortDir       = 'desc';
let selectedChamp = null; // currently highlighted champion object
let champIconMap  = {};   // {championName: ddKeyId} built from Data Dragon
let ddVersion     = '';   // latest Data Dragon version string (e.g. "14.10.1")
let teamLogoMap   = {};   // {teamName: imageUrl} from lolesports API
let gamesData     = [];   // game-results array from /api/games

// ── Team logos ───────────────────────────────────────────
async function loadTeamLogos() {
  teamLogoMap = await fetch('/api/team-logos')
    .then(r => r.json()).catch(() => ({}));
}

// Returns an <img> tag for a team, or '' if no logo is known.
function teamImg(name, cls) {
  const url = teamLogoMap[name] || '';
  return url ? `<img src="${url}" class="${cls}" />` : '';
}

// ── Data Dragon ──────────────────────────────────────────
// Data Dragon is Riot's CDN for static assets (icons, splash art, etc.).
const _DD = 'https://ddragon.leagueoflegends.com';

async function loadDDragon() {
  const versions = await fetch(`${_DD}/api/versions.json`)
    .then(r => r.json()).catch(() => []);
  if (!versions.length) return;
  ddVersion = versions[0];
  const champs = await fetch(
    `${_DD}/cdn/${ddVersion}/data/en_US/champion.json`
  ).then(r => r.json()).catch(() => ({ data: {} }));
  // champion.json uses the internal key (e.g. "MissFortune") not the
  // display name ("Miss Fortune"), so we map display → key for the URL.
  Object.values(champs.data).forEach(c => {
    champIconMap[c.name] = c.id;
  });
}

function champIconUrl(name) {
  const key = champIconMap[name];
  if (!key) return '';
  return `${_DD}/cdn/${ddVersion}/img/champion/${key}.png`;
}

// Returns an <img> tag for a champion icon, or '' while icons are loading.
function champImg(name, cls) {
  const url = champIconUrl(name);
  return url ? `<img src="${url}" class="${cls}" />` : '';
}

// ── Navigation ───────────────────────────────────────────
function setupNav() {
  const btns  = document.querySelectorAll('nav button');
  const views = document.querySelectorAll('.view');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.view)
        .classList.add('active');
    });
  });
}

// ── Detail card helpers ──────────────────────────────────
// Returns a CSS class name based on win rate thresholds.
function wrClass(wr) {
  if (wr >= 55) return 'high';
  if (wr <= 45) return 'low';
  return 'mid';
}

function statRow(label, value, color) {
  const s = color ? ` style="color:${color}"` : '';
  return '<div class="stat-row">'
    + `<span class="stat-label">${label}</span>`
    + `<span class="stat-value"${s}>${value}</span>`
    + '</div>';
}

function wrRateRow(d) {
  const cls = wrClass(d.win_rate);
  return '<div class="stat-row">'
    + '<span class="stat-label">WIN RATE</span>'
    + `<span class="stat-value ${cls}"`
    + ` style="font-size:22px">${d.win_rate}%`
    + '</span></div>';
}

function wrBarHTML(d) {
  return '<div class="wr-bar-wrap">'
    + '<div class="wr-bar-label">WIN / LOSS SPLIT</div>'
    + '<div class="wr-bar-bg">'
    + '<div class="wr-bar-fill" id="wr-fill"'
    + ' style="width:0%"></div></div>'
    + '<div class="wr-bar-numbers">'
    + `<span class="w">${d.win_rate}% W</span>`
    + `<span class="l">${d.loss_rate}% L</span>`
    + '</div></div>';
}

function buildDetailHTML(d) {
  const losses = d.total_games - d.wins;
  const img = champImg(d.champion, 'champ-icon-lg');
  return [
    `<div class="detail-header">${img}`
    + `<div class="detail-name">${d.champion}</div></div>`,
    statRow('GAMES PLAYED', d.total_games),
    statRow('WINS', d.wins, 'var(--win)'),
    statRow('LOSSES', losses, 'var(--loss)'),
    wrRateRow(d),
    wrBarHTML(d),
    '<div id="patch-chart"></div>',  // filled asynchronously after card renders
  ].join('');
}

// ── Champion table ───────────────────────────────────────
function buildRowHTML(d) {
  const cls = wrClass(d.win_rate);
  const img = champImg(d.champion, 'champ-icon');
  return `<td class="name">${img}${d.champion}</td>`
    + `<td class="num">${d.total_games}</td>`
    + `<td class="num">${d.wins}</td>`
    + `<td class="wr ${cls}">${d.win_rate}%</td>`;
}

function renderTable(data) {
  const tbody = document.getElementById('champ-tbody');
  tbody.innerHTML = '';
  data.forEach(d => {
    const tr = document.createElement('tr');
    if (selectedChamp?.champion === d.champion)
      tr.classList.add('selected');
    tr.innerHTML = buildRowHTML(d);
    tr.addEventListener('click', () => selectChamp(d));
    tbody.appendChild(tr);
  });
}

function getFilteredSorted() {
  const q = document.getElementById('search')
    .value.toLowerCase();
  const rows = allData.filter(
    d => d.champion.toLowerCase().includes(q)
  );
  rows.sort((a, b) => {
    const av = typeof a[sortCol] === 'string'
      ? a[sortCol] : +a[sortCol];
    const bv = typeof b[sortCol] === 'string'
      ? b[sortCol] : +b[sortCol];
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });
  return rows;
}

async function selectChamp(d) {
  selectedChamp = d;
  renderTable(getFilteredSorted());
  const card = document.getElementById('detail-card');
  card.innerHTML = buildDetailHTML(d);
  // Animate the win-rate bar on next tick so the transition fires.
  setTimeout(() => {
    const fill = document.getElementById('wr-fill');
    if (fill) fill.style.width = d.win_rate + '%';
  }, 20);
  // Fetch per-patch win-rate history and render the trend chart.
  const { year, split } = getFilters();
  const url = buildUrl('/api/champion-patches',
    { champion: d.champion, year, split });
  const patches = await fetch(url).then(r => r.json());
  const chart = document.getElementById('patch-chart');
  if (chart) chart.innerHTML = buildPatchChart(patches);
}

function setupSortHeaders() {
  document.querySelectorAll('thead th[data-col]')
    .forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        sortDir = sortCol === col
          ? (sortDir === 'asc' ? 'desc' : 'asc')
          : (col === 'champion' ? 'asc' : 'desc');
        sortCol = col;
        document.querySelectorAll('thead th')
          .forEach(h => h.classList.remove(
            'sort-asc', 'sort-desc'
          ));
        th.classList.add(
          sortDir === 'asc' ? 'sort-asc' : 'sort-desc'
        );
        renderTable(getFilteredSorted());
      });
    });
  document.querySelector('thead th[data-col="win_rate"]')
    .classList.add('sort-desc');
}

// ── Games view ───────────────────────────────────────────
function formatDuration(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = String(Math.floor(secs % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

function buildGameRowHTML(g) {
  const bCls = g.winner === 'blue' ? 'win' : 'loss';
  const rCls = g.winner === 'red'  ? 'win' : 'loss';
  const date = g.date ? g.date.slice(0, 10) : '—';
  const bImg = teamImg(g.blue_team, 'team-logo');
  const rImg = teamImg(g.red_team, 'team-logo');
  return `<td class="game-date">${date}</td>`
    + `<td class="game-split">${g.split || '—'}</td>`
    + `<td class="game-patch">${g.patch || '—'}</td>`
    + `<td class="game-team blue-side ${bCls}">`
    +   `${bImg}${g.blue_team || '—'}</td>`
    + `<td class="game-team red-side ${rCls}">`
    +   `${rImg}${g.red_team || '—'}</td>`
    + `<td class="game-dur">${formatDuration(g.gamelength)}</td>`;
}

function renderGames(games) {
  const tbody = document.getElementById('games-tbody');
  tbody.innerHTML = '';
  games.forEach(g => {
    const tr = document.createElement('tr');
    tr.innerHTML = buildGameRowHTML(g);
    tbody.appendChild(tr);
  });
}

// ── Patch history chart ──────────────────────────────────
// All _patch* helpers are pure SVG-string builders; buildPatchChart
// assembles them into the final HTML injected into #patch-chart.

function _patchDotColor(wr) {
  return wr >= 55 ? '#27ae60' : wr <= 45 ? '#c0392b' : '#c89b3c';
}

// Draws a dashed 50% reference line if 50 falls within the visible Y range.
function _patchRef(lo, hi, x1, x2, yS) {
  if (lo > 50 || hi < 50) return '';
  const y = yS(50).toFixed(1);
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"
      stroke="#1e2d45" stroke-dasharray="3,3"/>
    <text x="${x1 - 4}" y="${+y + 4}" text-anchor="end"
      fill="#6b7a90" font-size="10">50%</text>`;
}

function _patchLine(patches, xS, yS) {
  const pts = patches.map((p, i) =>
    `${xS(i).toFixed(1)},${yS(p.win_rate).toFixed(1)}`
  ).join(' ');
  return `<polyline points="${pts}" fill="none"
    stroke="#c89b3c" stroke-width="1.5"/>`;
}

function _patchDots(patches, xS, yS) {
  return patches.map((p, i) => {
    const cx = xS(i).toFixed(1);
    const cy = yS(p.win_rate).toFixed(1);
    return `<circle cx="${cx}" cy="${cy}" r="3.5"
        fill="${_patchDotColor(p.win_rate)}"
        stroke="#060b14" stroke-width="1.5"/>
      <text x="${cx}" y="${+cy - 7}" text-anchor="middle"
        fill="#c8aa6e" font-size="9">${p.win_rate}%</text>`;
  }).join('');
}

// Rotates labels 40° when there are more than 5 patches to avoid overlap.
function _patchXLabels(patches, xS, yBase) {
  const rot  = patches.length > 5 ? -40 : 0;
  const anch = rot ? 'end' : 'middle';
  return patches.map((p, i) => {
    const x  = xS(i).toFixed(1);
    const tr = rot ? `rotate(${rot},${x},${yBase + 12})` : '';
    return `<text x="${x}" y="${yBase + 12}"
      text-anchor="${anch}" transform="${tr}"
      fill="#6b7a90" font-size="10">${p.patch}</text>`;
  }).join('');
}

function buildPatchChart(patches) {
  if (patches.length < 2) return ''; // need at least 2 points for a meaningful line
  const ml = 36, mr = 8, mt = 20, ph = 90;
  const mb = patches.length > 5 ? 52 : 28; // taller bottom margin when labels are rotated
  const W  = 272, pw = W - ml - mr;
  const H  = mt + ph + mb;
  // Y range pads ±8 around the actual min/max so dots aren't clipped at the edge.
  const lo = Math.max(0,   Math.min(...patches.map(p => p.win_rate)) - 8);
  const hi = Math.min(100, Math.max(...patches.map(p => p.win_rate)) + 8);
  const xS = i  => ml + (i / (patches.length - 1)) * pw;
  const yS = wr => mt + ph * (1 - (wr - lo) / (hi - lo));
  return [
    '<div class="patch-chart-wrap">',
    '<div class="patch-chart-label">WIN RATE BY PATCH</div>',
    `<svg viewBox="0 0 ${W} ${H}" style="width:100%;overflow:visible">`,
    _patchRef(lo, hi, ml, ml + pw, yS),
    _patchLine(patches, xS, yS),
    _patchDots(patches, xS, yS),
    _patchXLabels(patches, xS, mt + ph),
    '</svg></div>',
  ].join('');
}

// ── Filter helpers ───────────────────────────────────────
// Returns the currently selected {year, split, patch} from the cascade dropdowns.
function getFilters() {
  const year  = +document.getElementById('year-select').value
    || null;
  const split = document.getElementById('split-select').value
    || null;
  const patch = document.getElementById('patch-select').value
    || null;
  return { year, split, patch };
}

// Generic URL builder — omits any param whose value is null/empty.
function buildUrl(base, params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') p.set(k, v);
  });
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

// Empties a <select> back to its placeholder and disables it.
// Called when a parent filter changes and the child is no longer valid.
function resetSelect(id, placeholder) {
  const el = document.getElementById(id);
  el.innerHTML = `<option value="">${placeholder}</option>`;
  el.disabled = true;
}

// ── Data reload ──────────────────────────────────────────
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

// ── Cascading filters ────────────────────────────────────
// Changing year resets split and patch, then reloads data.
async function loadSplits(year) {
  resetSelect('split-select', 'All splits');
  resetSelect('patch-select', 'All patches');
  if (year) {
    const splits = await fetch(`/api/splits?year=${year}`)
      .then(r => r.json());
    const sel = document.getElementById('split-select');
    splits.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      sel.appendChild(opt);
    });
    sel.disabled = splits.length === 0;
  }
  reloadAll();
}

// Changing split resets patch, then reloads data.
async function loadPatches() {
  const { year, split } = getFilters();
  resetSelect('patch-select', 'All patches');
  if (split) {
    const url = buildUrl('/api/patches', { year, split });
    const patches = await fetch(url).then(r => r.json());
    const sel = document.getElementById('patch-select');
    patches.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p; opt.textContent = p;
      sel.appendChild(opt);
    });
    sel.disabled = patches.length === 0;
  }
  reloadAll();
}

// ── Info + year selector ─────────────────────────────────
async function loadInfo() {
  const info = await fetch('/api/info').then(r => r.json());
  const sel = document.getElementById('year-select');
  info.years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    sel.appendChild(opt);
  });
  if (info.years.length > 0) sel.value = info.years[0];
  document.getElementById('download-btn').href =
    info.folder_url;
  // Wire up the cascade: year → split → patch → reload
  sel.addEventListener('change', () =>
    loadSplits(+sel.value || null)
  );
  document.getElementById('split-select')
    .addEventListener('change', loadPatches);
  document.getElementById('patch-select')
    .addEventListener('change', reloadAll);
}

// ── Bootstrap ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  setupSortHeaders();
  document.getElementById('search')
    .addEventListener('input',
      () => renderTable(getFilteredSorted()));
  await loadInfo();
  const year = +document.getElementById('year-select').value
    || null;
  // loadSplits triggers reloadAll internally, so no separate data fetch needed.
  await loadSplits(year);
  // Icons load asynchronously and re-render once ready without blocking data.
  loadDDragon().then(() => renderTable(getFilteredSorted()));
  loadTeamLogos().then(() => renderGames(gamesData));
});
