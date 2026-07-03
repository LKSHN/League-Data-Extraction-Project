// ── Shared state ─────────────────────────────────────────
// Single source of truth for all mutable app-level variables.
// Every other module reads and writes these directly.
// Per-table sort state now lives inside each createSortableTable
// instance (see data-table.js) rather than here.

let allData       = [];   // champion stats array from /api/data
let selectedChamp = null; // currently highlighted champion object
let champIconMap  = {};   // { championName: ddKeyId } built from Data Dragon
let ddVersion     = '';   // latest Data Dragon version string (e.g. "14.10.1")
let teamLogoMap   = {};   // { teamName: imageUrl } from lolesports API
let gamesData     = [];   // game-results array from /api/games
let chartZoom     = 'patch'; // 'patch' or 'split' — controls chart granularity

let playerData    = [];   // player list from /api/players
let selectedPlayer = null;
let playerRoleFilter = null; // null = all roles

let teamData      = [];   // team list from /api/teams
let selectedTeam  = null;
