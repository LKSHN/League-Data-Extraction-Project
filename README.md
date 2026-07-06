---
title: League Dashboard
emoji: 🎮
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
---

# League Esports Data Analysis

A local web application that loads Oracle's Elixir match data, stores it in
SQLite, and serves an interactive dashboard for exploring champion, player,
and team statistics across any league.

---

## Features

- **Year → Split → Patch** cascading filter — narrow all stats to any time window
- **Champion Details** — sortable table (games, wins, win rate, presence) with a
  detail card showing KDA, DPM, GOLD@15, CSPM, DMG%, DIFF@15, VISION, pick/ban
  rates (Fearless Draft-aware), most-bought items, and a per-patch / per-split
  win-rate trend chart
- **Players** — sortable table with role filter; detail card shows broadcast-style
  stats grid with positional rankings, champion pool (sortable by games or WR),
  and full career split history
- **Teams** — sortable table; detail card shows win rate, avg game time, head-to-head
  matchup record, current roster, and champion picks by role (sortable by games or WR)
  plus bans
- **Game Results** — full game log sorted newest-first with team logos, split,
  patch, and duration
- **Auto-download** — on first run the app tries to download the current year's
  CSV from Oracle's Elixir Google Drive; falls back to a manual prompt if
  Google Drive rate-limits the request
- **Team logos** from the lolesports API, **champion icons** from Riot Data
  Dragon — both load asynchronously without blocking the UI

---

## Screenshots

### Champions
![Champion Details](screenshots/champion-details-v2.png)
*Sortable champion table (games, wins, win rate, presence) with a detail card showing
KDA, DPM, GOLD@15, CSPM, DMG%, DIFF@15, VISION score, pick/ban rates, most-bought items,
and a per-patch win-rate trend chart with split grouping.*

### Players
![Player Details](screenshots/player-details.png)
*Player list filterable by role, with a broadcast-style detail card: stats grid ranked
against peers at the same position, champion pool sortable by games or win rate,
and full career split history.*

### Teams
![Team Details](screenshots/team-details.png)
*Team overview with win rate, average game time, head-to-head matchup record,
current roster, and champion picks organised by role (sortable by games or WR) plus bans.*

### Games
![Game Results](screenshots/game-results-v2.png)
*Full game log with series grouping, champion picks per side, and game duration.
Filterable by team name.*

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3 + Flask |
| Data | pandas + SQLite (`sqlite3`) |
| Download | gdown + requests |
| Frontend | Vanilla JS + SVG charts |
| Styling | CSS custom properties |
| Champion icons | Riot Data Dragon CDN |
| Team logos | lolesports API |
| Item data | Leaguepedia (MediaWiki API) |

---

## Project Structure

```
League Data Extraction Project/
│
├── main.py                   # Entry point: download → build DB → serve
│
├── server/
│   ├── app.py                # Flask factory + all API routes
│   └── config.py             # Constants (port, league, paths)
│
├── data/
│   ├── downloader.py         # Fetch CSVs from Google Drive
│   ├── loader.py             # Parse OE CSVs into DataFrames
│   ├── db.py                 # Build and query the SQLite database
│   ├── stats.py              # Per-champion win-rate aggregation
│   ├── leaguepedia.py        # Fetch item build data from Leaguepedia
│   └── teams.py              # Fetch team logos from lolesports API
│
├── frontend/
│   ├── index.html            # Single-page shell
│   ├── style.css             # Dark League-themed styles
│   └── js/
│       ├── state.js          # Shared state (filters, selections, sort)
│       ├── api.js            # URL builder helpers
│       ├── filters.js        # Year/Split/Patch cascading filter logic
│       ├── ddragon.js        # Champion icon URLs (Data Dragon)
│       ├── teams.js          # Team logo map
│       ├── chart.js          # SVG patch/split win-rate trend chart
│       ├── champion-table.js # Champion list table + sorting
│       ├── detail-card.js    # Champion detail card + async sections
│       ├── player-view.js    # Player list table + detail card
│       ├── team-view.js      # Team list table + detail card
│       ├── games.js          # Game results table
│       └── main.js           # Bootstrap: load data, wire navigation
│
└── downloads/                # Created at runtime — not committed
    ├── *.csv                 # Oracle's Elixir per-year data files
    └── league_data.db        # SQLite database built from the CSVs
```

---

## Prerequisites

```bash
pip install flask pandas requests gdown mwclient
```

---

## Running the App

```bash
python main.py
```

On first run:
1. The app checks `downloads/` for a CSV matching the current year.
2. If none is found it attempts an automated download from Google Drive —
   via the Drive API if `GOOGLE_DRIVE_API_KEY` is set (see
   [Configuration](#configuration)), otherwise by scraping the folder page.
   Transient failures are retried with backoff before falling back.
3. If Google Drive rate-limits the download, a browser window opens with the
   direct link — download the file manually and place it in `downloads/`, then
   re-run.
4. All CSVs in `downloads/` are loaded into `downloads/league_data.db`.
5. Flask starts on `http://localhost:5000` and the browser opens automatically.

On subsequent runs the cached CSVs are reused; only the DB rebuild happens.

---

## Configuration

Edit `server/config.py` to change behaviour:

| Constant | Default | Description |
|---|---|---|
| `PORT` | `5000` | Flask port |
| `LEAGUE` | `'LEC'` | League filter applied to the data (`'LCK'`, `'LCS'`, `''` for all) |
| `YEAR` | auto | Current year — controls which CSV is auto-downloaded |
| `FOLDER_ID` | OE folder | Google Drive folder ID for Oracle's Elixir data |
| `DOWNLOADS_DIR` | `'downloads'` | Local directory for CSVs and the DB |

Set `GOOGLE_DRIVE_API_KEY` in `.env` (see `.env.example`) to download via the
Drive API v3 instead of scraping the folder page — a free Google Cloud API
key with the Drive API enabled, using a separate quota from the anonymous
web-download page that Google Drive rate-limits.

---

## Data Source

Match data comes from **[Oracle's Elixir](https://oracleselixir.com)** —
community-maintained per-player CSV files covering most major leagues back
to 2014. Each row represents one player in one game; team-level summary rows
are also included and used to build the game-results table.

Item build data is fetched from **[Leaguepedia](https://lol.fandom.com)** via
the MediaWiki API.

---

## API Endpoints

### Champions
| Endpoint | Params | Returns |
|---|---|---|
| `GET /api/data` | `year`, `split`, `patch` | champion win-rate stats with presence |
| `GET /api/champion-stats` | `champion`, `year`, `split`, `patch` | avg KDA, DPM, CSPM, pick/ban rates |
| `GET /api/champion-items` | `champion`, `year` | most-bought items from Leaguepedia |
| `GET /api/champion-patches` | `champion`, `year`, `split` | per-patch win-rate trend |
| `GET /api/champion-splits` | `champion`, `year` | per-split win-rate trend |

### Players
| Endpoint | Params | Returns |
|---|---|---|
| `GET /api/players` | `year`, `split`, `patch` | player list with KDA, DPM, WR |
| `GET /api/player-stats` | `player`, `year`, `split`, `patch` | detailed stats + blue/red side WR |
| `GET /api/player-champions` | `player`, `year`, `split`, `patch` | champion pool |
| `GET /api/player-rankings` | `player`, `year`, `split`, `patch` | positional stat rankings |
| `GET /api/player-split-history` | `player` | career split-by-split history |

### Teams
| Endpoint | Params | Returns |
|---|---|---|
| `GET /api/teams` | `year`, `split`, `patch` | team list with WR and avg game time |
| `GET /api/team-stats` | `team`, `year`, `split`, `patch` | detailed team stats |
| `GET /api/team-matchups` | `team`, `year`, `split`, `patch` | head-to-head record vs each opponent |
| `GET /api/team-champions` | `team`, `year`, `split`, `patch` | picks by role + bans |
| `GET /api/team-roster` | `team`, `year`, `split`, `patch` | current roster |

### Meta
| Endpoint | Params | Returns |
|---|---|---|
| `GET /api/info` | — | years available, league, download URL |
| `GET /api/splits` | `year` | splits available for that year |
| `GET /api/patches` | `year`, `split` | patches available |
| `GET /api/games` | `year`, `split`, `patch` | game results list |
| `GET /api/team-logos` | — | `{name: imageUrl}` map |

---

**Author**: LKSHN  
**Data**: Oracle's Elixir (oracleselixir.com)
