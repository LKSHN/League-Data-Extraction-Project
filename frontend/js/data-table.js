// ── Shared sortable table controller ────────────────────
// Filtering, sorting, header wiring, and row rendering used to be
// hand-duplicated across the Champions/Players/Teams list tables. This
// factory captures that shared behaviour once; each view still owns its
// own row markup, selection state, and search/filter predicate.

function createSortableTable({
  tbodyId,        // <tbody> element id to render into
  colAttr,        // attribute name on sortable <th>s, e.g. 'data-col-p'
  defaultSort,    // { col, dir }
  ascCols = [],   // columns that should default to ascending on first click
  getData,        // () => full unfiltered array
  matchesQuery,   // (row, lowerCaseQuery) => bool
  buildRowHTML,   // row => td...td html string
  isSelected,     // row => bool
  onSelect,       // row => void
}) {
  let sortCol = defaultSort.col;
  let sortDir = defaultSort.dir;
  let extraFilter = null; // e.g. the player role-pill filter

  function setExtraFilter(fn) { extraFilter = fn; }

  function getFilteredSorted(query) {
    const q = (query || '').toLowerCase();
    let rows = getData().filter(row => matchesQuery(row, q));
    if (extraFilter) rows = rows.filter(extraFilter);
    rows.sort((a, b) => {
      const av = typeof a[sortCol] === 'string' ? a[sortCol] : +a[sortCol];
      const bv = typeof b[sortCol] === 'string' ? b[sortCol] : +b[sortCol];
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
    return rows;
  }

  function render(data) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach(row => {
      const tr = document.createElement('tr');
      if (isSelected(row)) tr.classList.add('selected');
      tr.innerHTML = buildRowHTML(row);
      tr.addEventListener('click', () => onSelect(row));
      tbody.appendChild(tr);
    });
  }

  // `onChange` is called after a header click updates sortCol/sortDir —
  // the view re-fetches its filtered+sorted rows and re-renders.
  function setupSortHeaders(onChange) {
    document.querySelectorAll(`thead th[${colAttr}]`).forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute(colAttr);
        sortDir = sortCol === col
          ? (sortDir === 'asc' ? 'desc' : 'asc')
          : (ascCols.includes(col) ? 'asc' : 'desc');
        sortCol = col;
        document.querySelectorAll(`thead th[${colAttr}]`)
          .forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        onChange();
      });
    });
    const defaultTh = document.querySelector(`thead th[${colAttr}="${defaultSort.col}"]`);
    if (defaultTh) defaultTh.classList.add(defaultSort.dir === 'asc' ? 'sort-asc' : 'sort-desc');
  }

  return { getFilteredSorted, render, setupSortHeaders, setExtraFilter };
}
