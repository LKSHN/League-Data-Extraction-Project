#
# File: server/config.py
# Creator: LKSHN
# Created: Wed May 13 2026
# Description:
# Server configuration constants — edit here to change league,
# port, or data paths without touching application code.
#

from datetime import datetime

PORT          = 5000                                    # Flask dev server port
FOLDER_ID     = '1gLSw0RLjBbtaNy0dgnGQDAZOHIgCe-HH'  # Oracle's Elixir Google Drive folder
YEAR          = datetime.now().year                     # auto-detected; used for the initial CSV download
LEAGUE        = 'LEC'                                   # row filter on the 'league' column; '' = all leagues
DOWNLOADS_DIR = 'downloads'                             # local cache for CSVs; DB lives here too
DB_PATH       = 'downloads/league_data.db'              # SQLite file rebuilt from CSVs on every startup
