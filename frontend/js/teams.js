// ── Team & league logos ───────────────────────────────────
// Fetches team/league logo URLs from the server and caches them.

async function loadTeamLogos() {
  teamLogoMap = await fetch('/api/team-logos')
    .then(r => r.json()).catch(() => ({}));
}

async function loadLeagueLogos() {
  leagueLogoMap = await fetch('/api/league-logos')
    .then(r => r.json()).catch(() => ({}));
}

// Returns an <img> tag for a team logo, or '' if no logo is known.
function teamImg(name, cls) {
  const url = teamLogoMap[name] || '';
  return url ? `<img src="${url}" class="${cls}" />` : '';
}

// Returns an <img> tag for a league logo, or '' if no logo is known.
function leagueImg(code, cls) {
  const url = leagueLogoMap[code] || '';
  return url ? `<img src="${url}" class="${cls}" />` : '';
}
