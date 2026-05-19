// ── Cascading filters ────────────────────────────────────
// Manages the year → split → patch dropdown chain.
// Each level resets its children before fetching new options.

// Returns the currently selected { year, split, patch } from the dropdowns.
function getFilters() {
  const year  = +document.getElementById('year-select').value || null;
  const split = document.getElementById('split-select').value || null;
  const patch = document.getElementById('patch-select').value || null;
  return { year, split, patch };
}

// Empties a <select> back to its placeholder and disables it.
function resetSelect(id, placeholder) {
  const el = document.getElementById(id);
  el.innerHTML = `<option value="">${placeholder}</option>`;
  el.disabled = true;
}

// Called when year changes — resets split + patch, fetches new splits.
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

// Called when split changes — resets patch, fetches new patches.
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
