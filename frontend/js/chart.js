// ── Patch / split history chart ───────────────────────────
// Bar chart (game count) + line overlay (win rate).
// Matches the "Most Watched Esports" aesthetic:
//   - Solid coloured bars for volume
//   - White line with dot markers for win rate
//   - Labels above bars and beside dots

// ── Helpers ───────────────────────────────────────────────

function _wrColor(wr) {
  return wr >= 55 ? '#27ae60' : wr <= 45 ? '#c0392b' : '#c89b3c';
}

// Dashed 50% reference line
function _refLine(lo, hi, x1, x2, yWR) {
  if (lo > 50 || hi < 50) return '';
  const y = yWR(50).toFixed(1);
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"
      stroke="#1e2d45" stroke-dasharray="4,3" stroke-width="1"/>
    <text x="${+x2 + 4}" y="${+y + 4}" fill="#6b7a90" font-size="10">50%</text>`;
}

// Vertical bars for game count
function _bars(patches, xS, yBar, yBot, barW) {
  return patches.map((p, i) => {
    if (!p.games) return '';
    const cx = xS(i);
    const x  = cx - barW / 2;
    const y  = yBar(p.games);
    const h  = yBot - y;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}"
        width="${barW.toFixed(1)}" height="${h.toFixed(1)}"
        fill="#c0392b" rx="2" opacity="0.85"/>
      <text x="${cx.toFixed(1)}" y="${(y - 6).toFixed(1)}"
        text-anchor="middle" fill="#e8e8e8"
        font-size="11" font-weight="700">${p.games}</text>`;
  }).join('');
}

// White line connecting played patches (breaks at gaps)
function _wrLine(patches, xS, yWR) {
  let result = '';
  let seg    = [];
  const flush = () => {
    if (seg.length >= 2)
      result += `<polyline points="${seg.join(' ')}"
        fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/>`;
    seg = [];
  };
  patches.forEach((p, i) => {
    if (p.games > 0 && p.win_rate != null)
      seg.push(`${xS(i).toFixed(1)},${yWR(p.win_rate).toFixed(1)}`);
    else flush();
  });
  flush();
  return result;
}

// White-ring dots + WR label beside each dot
function _wrDots(patches, xS, yWR, yBot) {
  return patches.map((p, i) => {
    const cx = xS(i);
    if (!p.games || p.win_rate == null) {
      // hollow grey ring at baseline for absent patches
      return `<circle cx="${cx.toFixed(1)}" cy="${yBot.toFixed(1)}" r="3"
          fill="none" stroke="#2a3a52" stroke-width="1.5"/>`;
    }
    const cy   = yWR(p.win_rate);
    const col  = _wrColor(p.win_rate);
    // Position label to avoid overlap with bars — push to the right
    const lx   = (cx + 9).toFixed(1);
    const ly   = (cy + 4).toFixed(1);
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5"
        fill="#060b14" stroke="white" stroke-width="2"/>
      <text x="${lx}" y="${ly}"
        fill="${col}" font-size="10" font-weight="600">${p.win_rate}%</text>`;
  }).join('');
}

// Rotated X-axis labels
function _xLabels(patches, xS, yBase) {
  return patches.map((p, i) => {
    const x   = xS(i).toFixed(1);
    const col = p.games === 0 ? '#2a3a52' : '#8a9ab0';
    return `<text x="${x}" y="${yBase + 14}"
      text-anchor="end" transform="rotate(-40,${x},${yBase + 14})"
      fill="${col}" font-size="10">${p.patch}</text>`;
  }).join('');
}

// ── Public entry point ────────────────────────────────────

function buildPatchChart(patches) {
  if (!patches || patches.length < 2) {
    return '<p class="chart-empty">Not enough data</p>';
  }
  const played = patches.filter(p => p.games > 0);
  if (played.length < 2) {
    return '<p class="chart-empty">Not enough data</p>';
  }

  // Layout
  const ml = 8, mr = 48, mt = 28, ch = 120, mb = 54;
  const PER_COL = 72;
  const pw = Math.max(500 - ml - mr, (patches.length - 1) * PER_COL);
  const W  = ml + pw + mr;
  const H  = mt + ch + mb;

  const colW = pw / Math.max(patches.length - 1, 1);
  const barW = Math.min(colW * 0.45, 36);

  // Scales
  const maxG = Math.max(...played.map(p => p.games));
  const wrVals = played.map(p => p.win_rate).filter(v => v != null);
  const lo  = Math.max(0,   Math.min(...wrVals) - 15);
  const hi  = Math.min(100, Math.max(...wrVals) + 15);

  const xS   = i  => ml + (patches.length === 1 ? pw / 2 : (i / (patches.length - 1)) * pw);
  const yWR  = wr => mt + ch * (1 - (wr - lo)  / (hi - lo));
  const yBar = g  => mt + ch * (1 - g / maxG);
  const yBot = mt + ch;

  return [
    '<div class="patch-chart-scroll">',
    `<svg viewBox="0 0 ${W} ${H}" style="width:${W}px;min-width:100%;overflow:visible;display:block">`,
    _refLine(lo, hi, ml, ml + pw, yWR),
    _bars(patches, xS, yBar, yBot, barW),
    _wrLine(patches, xS, yWR),
    _wrDots(patches, xS, yWR, yBot),
    _xLabels(patches, xS, yBot),
    '</svg>',
    '</div>',
  ].join('\n');
}
