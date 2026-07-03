#
# File: scripts/update_data.py
# Description:
# CI-safe daily update script.
# Downloads the current year's CSV and refreshes only that year's
# rows in the DB. Exits non-zero if the download fails (e.g. a
# Google Drive rate-limit) so the GitHub Actions run shows as failed
# instead of silently skipping the update.
#

import sys
import os

# Allow imports from the project root when run as a script.
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

from server.config import (
    FOLDER_ID, YEAR, DOWNLOADS_DIR, DB_PATH, LEAGUE,
)
from data.downloader import (
    _find_local, _scrape_file_id, _download_single,
)
from data.db import update_year


def main():
    os.makedirs(DOWNLOADS_DIR, exist_ok=True)

    # Re-use an already-downloaded CSV if it's there.
    if _find_local(DOWNLOADS_DIR, YEAR):
        print(f'CSV for {YEAR} already present, refreshing DB...')
    else:
        print(f'Downloading {YEAR} CSV from Google Drive...')
        file_id = _scrape_file_id(FOLDER_ID, YEAR)
        if not file_id:
            print('Could not find file ID — failing so this shows up in CI.')
            sys.exit(1)
        path = _download_single(file_id, DOWNLOADS_DIR, YEAR)
        if not path:
            print('Download failed (rate-limited?) — failing so this shows up in CI.')
            sys.exit(1)

    if not os.path.exists(DB_PATH):
        print(f'DB not found at {DB_PATH} — failing so this shows up in CI.')
        sys.exit(1)

    update_year(DOWNLOADS_DIR, DB_PATH, YEAR, league=LEAGUE)
    print('Done.')


if __name__ == '__main__':
    main()
