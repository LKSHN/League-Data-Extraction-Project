// ── Champion table ───────────────────────────────────────
// Renders the sortable champion list and handles column sorting.

// Builds a single table row's inner HTML.
function buildRowHTML(d) {
  const cls = wrClass(d.win_rate);
  const img = champImg(d.champion, 'champ-icon');
  return `<td class="name">${img}${d.champion}</td>`
    + `<td class="num">${d.total_games}</td>`
    + `<td class="num">${d.wins}</td>`
    + `<td class="wr ${cls}">${d.win_rate}%</td>`
    + `<td class="num">${d.presence != null ? d.presence + '%' : '—'}</td>`;
}

// Re-renders the table body from a pre-filtered/sorted array.
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

// Applies the current search query and sort to allData.
function getFilteredSorted() {
  const q = document.getElementById('search').value.toLowerCase();
  const rows = allData.filter(
    d => d.champion.toLowerCase().includes(q)
  );
  rows.sort((a, b) => {
    const av = typeof a[sortCol] === 'string' ? a[sortCol] : +a[sortCol];
    const bv = typeof b[sortCol] === 'string' ? b[sortCol] : +b[sortCol];
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });
  return rows;
}

// Wires up click handlers on sortable column headers.
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
          .forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        renderTable(getFilteredSorted());
      });
    });
  // Mark the default sort column.
  document.querySelector('thead th[data-col="win_rate"]')
    .classList.add('sort-desc');
}
