#
# File: main.py
# Creator: LKSHN
# Created: Wed May 13 2026
# Description:
# Entry point - builds database, starts server, opens browser
#

import threading
import webbrowser

from dotenv import load_dotenv
load_dotenv()  # loads .env into os.environ before any module reads it

from data.db import build_db
from data.downloader import ensure_data
from server.app import create_app
from server.config import (
    DB_PATH, DOWNLOADS_DIR, FOLDER_ID, LEAGUE, PORT, YEAR,
)


def open_browser():
    webbrowser.open(f'http://localhost:{PORT}')


def main():
    ensure_data(FOLDER_ID, YEAR, DOWNLOADS_DIR)
    build_db(DOWNLOADS_DIR, DB_PATH, league=LEAGUE)
    app = create_app(DB_PATH)
    threading.Timer(0.8, open_browser).start()
    print(f'Server at http://localhost:{PORT}')
    app.run(port=PORT, debug=False)


if __name__ == '__main__':
    main()
