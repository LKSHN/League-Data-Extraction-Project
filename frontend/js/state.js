// ── Shared state ─────────────────────────────────────────
// Single source of truth for all mutable app-level variables.
// Every other module reads and writes these directly.

let allData       = [];   // champion stats array from /api/data
let sortCol       = 'win_rate';
let sortDir       = 'desc';
let selectedChamp = null; // currently highlighted champion object
let champIconMap  = {};   // { championName: ddKeyId } built from Data Dragon
let ddVersion     = '';   // latest Data Dragon version string (e.g. "14.10.1")
let teamLogoMap   = {};   // { teamName: imageUrl } from lolesports API
let gamesData     = [];   // game-results array from /api/games
let chartZoom     = 'patch'; // 'patch' or 'split' — controls chart granularity

let playerData    = [];   // player list from /api/players
let selectedPlayer = null;
let playerSortCol  = 'win_rate';
let playerSortDir  = 'desc';
let playerRoleFilter = null; // null = all roles

let teamData      = [];   // team list from /api/teams
let selectedTeam  = null;
let teamSortCol   = 'win_rate';
let teamSortDir   = 'desc';
