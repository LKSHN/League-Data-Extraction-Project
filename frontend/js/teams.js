// ── Team logos ───────────────────────────────────────────
// Fetches team logo URLs from the server and caches them in teamLogoMap.

async function loadTeamLogos() {
  teamLogoMap = await fetch('/api/team-logos')
    .then(r => r.json()).catch(() => ({}));
}

// Returns an <img> tag for a team logo, or '' if no logo is known.
function teamImg(name, cls) {
  const url = teamLogoMap[name] || '';
  return url ? `<img src="${url}" class="${cls}" />` : '';
}
