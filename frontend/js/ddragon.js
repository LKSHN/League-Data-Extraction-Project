// ── Data Dragon ──────────────────────────────────────────
// Riot's CDN for static assets (champion icons, splash art, etc.).
// Icons are loaded once on startup and cached in champIconMap.

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
