// ── Champion table ───────────────────────────────────────
// Row markup for the champion list; sorting/filtering/rendering
// mechanics are shared via data-table.js.

function buildRowHTML(d) {
  const cls = wrClass(d.win_rate);
  const img = champImg(d.champion, 'champ-icon');
  return `<td class="name">${img}${d.champion}</td>`
    + `<td class="num">${d.total_games}</td>`
    + `<td class="num">${d.wins}</td>`
    + `<td class="wr ${cls}">${d.win_rate}%</td>`
    + `<td class="num">${d.presence != null ? d.presence + '%' : '—'}</td>`;
}

const champTable = createSortableTable({
  tbodyId: 'champ-tbody',
  colAttr: 'data-col',
  defaultSort: { col: 'win_rate', dir: 'desc' },
  ascCols: ['champion'],
  getData: () => allData,
  matchesQuery: (d, q) => d.champion.toLowerCase().includes(q),
  buildRowHTML,
  isSelected: d => selectedChamp?.champion === d.champion,
  onSelect: d => selectChamp(d),
});

function renderTable(data) {
  champTable.render(data);
}

function getFilteredSorted() {
  const q = document.getElementById('search').value;
  return champTable.getFilteredSorted(q);
}

function setupSortHeaders() {
  champTable.setupSortHeaders(() => renderTable(getFilteredSorted()));
}
