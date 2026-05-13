# League Esports Data Analysis

A local web application that loads Oracle's Elixir match data, stores it in
SQLite, and serves an interactive dashboard for exploring champion statistics
and game results across any league.

---

## Features

- **Year → Split → Patch** cascading filter — narrow stats to any time window
- **Champion Details** — sortable table with per-champion win rate, wins, and
  games played; click any champion for a detail card that includes a win-rate
  trend line across patches
- **Game Results** — full game log sorted newest-first with team logos, split,
  patch, and duration
- **Auto-download** — on first run the app tries to download the current year's
  CSV from Oracle's Elixir Google Drive; falls back to a manual prompt if
  Google Drive rate-limits the request
- **Team logos** from the lolesports API, **champion icons** from Riot Data
  Dragon — both load asynchronously without blocking the UI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.14 + Flask |
| Data | pandas + SQLite (`sqlite3`) |
| Download | gdown + requests |
| Frontend | Vanilla JS + SVG charts |
| Styling | CSS custom properties |
| Champion icons | Riot Data Dragon CDN |
| Team logos | lolesports API |

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
│   └── teams.py              # Fetch team logos from lolesports API
│
├── frontend/
│   ├── index.html            # Single-page shell
│   ├── app.js                # All UI logic (filters, tables, SVG chart)
│   └── style.css             # Dark League-themed styles
│
└── downloads/                # Created at runtime — not committed
    ├── *.csv                 # Oracle's Elixir per-year data files
    └── league_data.db        # SQLite database built from the CSVs
```

---

## Prerequisites

```bash
pip install flask pandas requests gdown
```

---

## Running the App

```bash
python main.py
```

On first run:
1. The app checks `downloads/` for a CSV matching the current year.
2. If none is found it attempts an automated download from Google Drive.
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

---

## Data Source

Match data comes from **[Oracle's Elixir](https://oracleselixir.com)** —
community-maintained per-player CSV files covering most major leagues back
to 2014. Each row represents one player in one game; team-level summary rows
are also included and used to build the game-results table.

---

## API Endpoints

| Endpoint | Params | Returns |
|---|---|---|
| `GET /api/info` | — | years available, league, download URL |
| `GET /api/data` | `year`, `split`, `patch` | champion win-rate stats |
| `GET /api/games` | `year`, `split`, `patch` | game results list |
| `GET /api/splits` | `year` | splits available for that year |
| `GET /api/patches` | `year`, `split` | patches available |
| `GET /api/champion-patches` | `champion`, `year`, `split` | per-patch win-rate trend |
| `GET /api/team-logos` | — | `{name: imageUrl}` map |

---

**Author**: LKSHN  
**Data**: Oracle's Elixir (oracleselixir.com)
