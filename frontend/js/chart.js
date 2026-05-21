// ── Patch history chart ──────────────────────────────────
// Pure SVG-string builders. buildPatchChart is the public entry point;
// the _patch* helpers are internal and only called from here.
//
// Layout: one unified chart area where the area chart (game counts) sits
// behind the win-rate line. Both share the same X-axis but have independent
// Y scales that map to the same pixel range.

function _patchDotColor(wr) {
  return wr >= 55 ? '#27ae60' : wr <= 45 ? '#c0392b' : '#c89b3c';
}

// Dashed 50 % reference line (win-rate scale).
function _patchRef(lo, hi, x1, x2, yWR) {
  if (lo > 50 || hi < 50) return '';
  const y = yWR(50).toFixed(1);
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"
      stroke="#1e2d45" stroke-dasharray="3,3"/>
    <text x="${x2 + 4}" y="${+y + 4}" text-anchor="start"
      fill="#6b7a90" font-size="10">50%</text>`;
}

// Area chart for game counts — bottom layer.
// yG maps a game count to a Y pixel using its own 0→maxG scale.
function _patchArea(patches, xS, yG, yBot) {
  const topPts = patches.map((p, i) =>
    `${xS(i).toFixed(1)},${(p.games > 0 ? yG(p.games) : yBot).toFixed(1)}`
  ).join(' L ');
  const x0  = xS(0).toFixed(1);
  const xN  = xS(patches.length - 1).toFixed(1);
  const yBs = yBot.toFixed(1);

  const area = `<path d="M ${x0},${yBs} L ${topPts} L ${xN},${yBs} Z"
    fill="rgba(29,161,200,0.10)" stroke="rgba(29,161,200,0.30)" stroke-width="1"/>`;

  // Small game-count labels just above each peak.
  const labels = patches.map((p, i) => {
    if (p.games === 0) return '';
    const cx = xS(i).toFixed(1);
    const cy = (yG(p.games) - 4).toFixed(1);
    return `<text x="${cx}" y="${cy}" text-anchor="middle"
      fill="rgba(29,161,200,0.65)" font-size="8">${p.games}</text>`;
  }).join('');

  return area + labels;
}

// Win-rate line, breaking at unpicked patches (games === 0).
function _patchLine(patches, xS, yWR) {
  let result = '';
  let seg    = [];
  const flush = () => {
    if (seg.length >= 2)
      result += `<polyline points="${seg.join(' ')}" fill="none"
        stroke="#c89b3c" stroke-width="1.5"/>`;
    seg = [];
  };
  patches.forEach((p, i) => {
    if (p.games > 0 && p.win_rate != null)
      seg.push(`${xS(i).toFixed(1)},${yWR(p.win_rate).toFixed(1)}`);
    else
      flush();
  });
  flush();
  return result;
}

// Colored dots + win-rate labels for played patches;
// hollow grey ring at the baseline for unpicked patches.
function _patchDots(patches, xS, yWR, yBot) {
  return patches.map((p, i) => {
    const cx = xS(i).toFixed(1);
    if (p.games > 0 && p.win_rate != null) {
      const cy = yWR(p.win_rate).toFixed(1);
      return `<circle cx="${cx}" cy="${cy}" r="3.5"
          fill="${_patchDotColor(p.win_rate)}"
          stroke="#060b14" stroke-width="1.5"/>
        <text x="${cx}" y="${+cy - 7}" text-anchor="middle"
          fill="#c8aa6e" font-size="9">${p.win_rate}%</text>`;
    }
    return `<circle cx="${cx}" cy="${yBot.toFixed(1)}" r="3"
        fill="none" stroke="#2a3a52" stroke-width="1.5"/>`;
  }).join('');
}

// X-axis labels, always rotated -40°. Dim for unpicked patches.
function _patchXLabels(patches, xS, yBase) {
  return patches.map((p, i) => {
    const x   = xS(i).toFixed(1);
    const col = p.games === 0 ? '#2a3a52' : '#6b7a90';
    return `<text x="${x}" y="${yBase + 12}"
      text-anchor="end" transform="rotate(-40,${x},${yBase + 12})"
      fill="${col}" font-size="10">${p.patch}</text>`;
  }).join('');
}

// Assembles the full combo chart (area + line) in one SVG.
function buildPatchChart(patches) {
  if (!patches || patches.length < 2) {
    return '<p style="color:#6b7a90;font-size:12px;padding:12px 0">Not enough data</p>';
  }
  const played = patches.filter(p => p.games > 0);
  if (played.length < 2) {
    return '<p style="color:#6b7a90;font-size:12px;padding:12px 0">Not enough data</p>';
  }

  const ml = 36, mr = 36, mt = 18, ch = 110, mb = 52;
  const PER_COL = 65;
  const pw = Math.max(560 - ml - mr, (patches.length - 1) * PER_COL);
  const W  = ml + pw + mr;
  const H  = mt + ch + mb;

  // Win-rate Y scale — based on played patches only.
  const lo  = Math.max(0,   Math.min(...played.map(p => p.win_rate)) - 20);
  const hi  = Math.min(100, Math.max(...played.map(p => p.win_rate)) + 20);
  // Games Y scale — 0→maxG mapped to the same pixel range.
  const maxG = Math.max(...played.map(p => p.games));

  const xS  = i  => ml + (i / (patches.length - 1)) * pw;
  const yWR = wr => mt + ch * (1 - (wr - lo) / (hi - lo));
  const yG  = g  => mt + ch * (1 - g / maxG);
  const yBot = mt + ch;

  return [
    '<div class="patch-chart-scroll">',
    `<svg viewBox="0 0 ${W} ${H}" style="width:${W}px;min-width:100%;overflow:visible">`,
    _patchRef(lo, hi, ml, ml + pw, yWR),
    _patchArea(patches, xS, yG, yBot),
    _patchLine(patches, xS, yWR),
    _patchDots(patches, xS, yWR, yBot),
    _patchXLabels(patches, xS, yBot),
    '</svg>',
    '</div>',
  ].join('');
}
