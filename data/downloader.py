#
# File: data/downloader.py
# Creator: LKSHN
# Created: Wed May 13 2026
# Description:
# Downloads a specific year's CSV from the Oracle's Elixir
# Google Drive folder. Caches locally so the download only
# runs once per year. Falls back to a manual prompt if
# Google Drive rate-limits the automated download.
#

import os
import re
import webbrowser
import requests
import gdown
from gdown.exceptions import FileURLRetrievalError

_HEADERS    = {'User-Agent': 'Mozilla/5.0'}  # mimic a browser to avoid bot blocks
_FOLDER_URL = 'https://drive.google.com/drive/folders/{}'
_GDRIVE_DL  = 'https://drive.google.com/uc?id={}'


def _find_local(dest, year):
    """Return the path of an already-downloaded CSV for `year`, or None."""
    for name in os.listdir(dest):
        if str(year) in name and name.endswith('.csv'):
            return os.path.join(dest, name)
    return None


def _scrape_file_id(folder_id, year):
    """Scrape the Drive folder HTML to find the file ID for `year`'s CSV.

    Drive folder pages embed file metadata as JSON-like strings. The regex
    looks for a 25+ char alphanumeric ID that appears within ~400 chars of
    both the target year and '.csv', which reliably identifies the annual file.
    """
    try:
        r = requests.get(
            _FOLDER_URL.format(folder_id),
            headers=_HEADERS,
            timeout=10,
        )
        pattern = (
            r'"([a-zA-Z0-9_-]{25,})"'
            r'(?=[^}]{0,300}'
            + str(year)
            + r'[^}]{0,100}\.csv)'
        )
        m = re.search(pattern, r.text)
        return m.group(1) if m else None
    except Exception:
        return None


def _download_single(file_id, dest, year):
    """Download a single file by its Drive ID using gdown.

    Returns the local path on success, or None if gdown reports a
    rate-limit error (FileURLRetrievalError).
    """
    out = os.path.join(dest, f'{year}_OraclesElixir.csv')
    try:
        gdown.download(
            url=_GDRIVE_DL.format(file_id),
            output=out,
            quiet=False,
        )
        return out if os.path.exists(out) else None
    except FileURLRetrievalError:
        # Google Drive blocks automated downloads of popular files.
        # Signal the caller to fall back to a manual prompt.
        return None


def _prompt_manual(file_id, dest, year):
    """Open the download URL in the browser and print instructions."""
    url = _GDRIVE_DL.format(file_id)
    abs_dest = os.path.abspath(dest)
    print(
        '\nGoogle Drive is rate-limiting automated downloads.\n'
        f'Please download the {year} CSV manually:\n'
        f'  {url}\n'
        f'Then place the .csv file in:\n'
        f'  {abs_dest}\n'
        'Re-run the app once the file is there.'
    )
    webbrowser.open(url)


def ensure_data(folder_id, year, dest='downloads'):
    """Ensure a CSV for `year` exists in `dest`.

    Flow:
      1. Return immediately if a matching CSV is already cached.
      2. Scrape the Drive folder for the file ID.
      3. Try an automated gdown download.
      4. If rate-limited, open the file in the browser and prompt the user.
      5. If the file ID can't be found at all, open the folder page instead.
    """
    os.makedirs(dest, exist_ok=True)

    cached = _find_local(dest, year)
    if cached:
        print(f'Using cached: {os.path.basename(cached)}')
        return cached

    print(f'Looking for {year} data in Google Drive...')
    file_id = _scrape_file_id(folder_id, year)

    if file_id:
        print(f'Found file ID: {file_id}')
        path = _download_single(file_id, dest, year)
        if path:
            return path
        _prompt_manual(file_id, dest, year)
        return None

    print('Could not locate file. Opening folder in browser...')
    webbrowser.open(_FOLDER_URL.format(folder_id))
    print(
        f'Download the {year} CSV and place it in:\n'
        f'  {os.path.abspath(dest)}'
    )
    return None
