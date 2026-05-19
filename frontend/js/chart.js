// ── Patch history chart ──────────────────────────────────
// Pure SVG-string builders. buildPatchChart is the public entry point;
// the _patch* helpers are internal and only called from here.

function _patchDotColor(wr) {
  return wr >= 55 ? '#27ae60' : wr <= 45 ? '#c0392b' : '#c89b3c';
}

// Draws a dashed 50% reference line if 50 falls within the visible Y range.
function _patchRef(lo, hi, x1, x2, yS) {
  if (lo > 50 || hi < 50) return '';
  const y = yS(50).toFixed(1);
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"
      stroke="#1e2d45" stroke-dasharray="3,3"/>
    <text x="${x2 + 4}" y="${+y + 4}" text-anchor="start"
      fill="#6b7a90" font-size="10">50%</text>`;
}

// Draws the connecting line between all data points.
function _patchLine(patches, xS, yS) {
  const pts = patches.map((p, i) =>
    `${xS(i).toFixed(1)},${yS(p.win_rate).toFixed(1)}`
  ).join(' ');
  return `<polyline points="${pts}" fill="none"
    stroke="#c89b3c" stroke-width="1.5"/>`;
}

// Draws a colored dot + win-rate label for each patch.
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

// Pick-count bars drawn below the line chart, scaled to max games.
// The tallest bar always fills the full bar area height.
function _patchBars(patches, xS, yBase, barH) {
  const maxG = Math.max(...patches.map(p => p.games));
  const bw   = Math.max(10, Math.min(36,
    (xS(1) - xS(0)) * 0.5)); // bar width: 50% of gap, clamped
  return patches.map((p, i) => {
    const cx   = xS(i);
    const h    = (p.games / maxG) * barH;
    const x    = (cx - bw / 2).toFixed(1);
    const y    = (yBase + barH - h).toFixed(1);
    // Show count inside bar if tall enough, otherwise just above it.
    const lblY = h >= 14
      ? (yBase + barH - h + 10).toFixed(1)
      : (yBase + barH - h - 3).toFixed(1);
    return `<rect x="${x}" y="${y}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"
        fill="#1e2d45" rx="2"/>
      <text x="${cx.toFixed(1)}" y="${lblY}" text-anchor="middle"
        fill="#6b7a90" font-size="8">${p.games}</text>`;
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

// Assembles the full patch chart HTML. Returns '' if fewer than 2 patches.
function buildPatchChart(patches) {
  if (patches.length < 2) return '';
  const ml = 36, mr = 36, mt = 14, ph = 60, bh = 55;
  const mb = patches.length > 5 ? 52 : 30;
  const W  = 560, pw = W - ml - mr;
  const H  = mt + ph + bh + mb;
  // Y range pads ±20 around the actual min/max so dots aren't clipped.
  const lo = Math.max(0,   Math.min(...patches.map(p => p.win_rate)) - 20);
  const hi = Math.min(100, Math.max(...patches.map(p => p.win_rate)) + 20);
  const xS = i  => ml + (i / (patches.length - 1)) * pw;
  const yS = wr => mt + ph * (1 - (wr - lo) / (hi - lo));
  return [
    '<div class="patch-chart-wrap">',
    '<div class="patch-chart-label">WIN RATE BY PATCH</div>',
    `<svg viewBox="0 0 ${W} ${H}" style="width:100%;overflow:visible">`,
    _patchRef(lo, hi, ml, ml + pw, yS),
    _patchLine(patches, xS, yS),
    _patchDots(patches, xS, yS),
    _patchBars(patches, xS, mt + ph + 2, bh - 2),
    _patchXLabels(patches, xS, mt + ph + bh),
    '</svg></div>',
  ].join('');
}
