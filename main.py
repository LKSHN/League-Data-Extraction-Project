#
# File: main.py
# Creator: LKSHN
# Created: Wed May 13 2026
# Description:
# Entry point - builds database, starts server, opens browser.
#
# Usage:
#   python main.py             → skip rebuild if DB exists, just serve
#   python main.py --rebuild   → re-download current year CSV + rebuild DB
#   python main.py --items     → rebuild only the champion_items table (no CSV re-download)
#   python main.py --server    → production mode: skip download/build, serve only
#

import os
import threading
import webbrowser
import argparse

from dotenv import load_dotenv
load_dotenv()  # loads .env into os.environ before any module reads it

from data.db import build_db, build_champion_items
from data.downloader import ensure_data
from server.app import create_app
from server.config import (
    DB_PATH, DOWNLOADS_DIR, FOLDER_ID, LEAGUE, PORT, YEAR,
)


def open_browser():
    webbrowser.open(f'http://localhost:{PORT}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--rebuild', action='store_true',
        help='Re-download current year CSV and rebuild the database',
    )
    parser.add_argument(
        '--server', action='store_true',
        help='Production mode: skip download/build and serve existing DB',
    )
    parser.add_argument(
        '--items', action='store_true',
        help='Rebuild only the champion_items table from Leaguepedia (no CSV re-download)',
    )
    args = parser.parse_args()

    if args.items:
        # Only (re)fetch item data — useful when Leaguepedia was rate-limited
        # during a previous --rebuild.
        if not os.path.exists(DB_PATH):
            raise FileNotFoundError(
                f'DB not found at {DB_PATH}. Run --rebuild first.'
            )
        print(f'Rebuilding champion_items table...')
        build_champion_items(DB_PATH, LEAGUE)
        print('Done. Starting server...')
    elif args.server:
        # Production: DB is pre-built and committed to the repo via Git LFS.
        # Never download or rebuild on the host — just serve.
        if not os.path.exists(DB_PATH):
            raise FileNotFoundError(
                f'DB not found at {DB_PATH}. '
                'Run locally with --rebuild first, then commit the DB.'
            )
        print(f'Server mode: serving existing DB ({DB_PATH})')
    elif args.rebuild or not os.path.exists(DB_PATH):
        # force=True skips the cache check and re-downloads, overwriting the existing CSV.
        ensure_data(FOLDER_ID, YEAR, DOWNLOADS_DIR, force=args.rebuild)
        build_db(DOWNLOADS_DIR, DB_PATH, league=LEAGUE)
        build_champion_items(DB_PATH, LEAGUE)
    else:
        print(f'Using existing DB: {DB_PATH}')

    app = create_app(DB_PATH)
    if not args.server:
        threading.Timer(0.8, open_browser).start()
    print(f'Server at http://localhost:{PORT}')
    app.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', PORT)),
        debug=False,
    )


if __name__ == '__main__':
    main()
