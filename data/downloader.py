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
    """Download a single file by its Drive ID.

    Tries two methods in order:
      1. Session-based request that follows Drive's virus-scan confirmation
         page — more reliable than a one-shot URL on popular files.
      2. gdown as fallback.

    Returns the local path on success, or None on failure.
    """
    out = os.path.join(dest, f'{year}_OraclesElixir.csv')
    session = requests.Session()

    # Method 1: session-based download.
    # Drive shows an HTML confirmation page for large files; we parse it
    # for the confirm token and uuid, then fire the real download request.
    try:
        r = session.get(
            _GDRIVE_DL.format(file_id),
            headers=_HEADERS,
            timeout=30,
        )
        if 'text/html' in r.headers.get('content-type', ''):
            confirm = re.search(r'confirm=([0-9A-Za-z_\-]+)', r.text)
            uuid    = re.search(r'uuid=([0-9A-Za-z_\-]+)',    r.text)
            params  = f'confirm={confirm.group(1)}' if confirm else 'confirm=t'
            if uuid:
                params += f'&uuid={uuid.group(1)}'
            dl_url = (
                f'https://drive.usercontent.google.com/download'
                f'?id={file_id}&export=download&{params}'
            )
            r = session.get(dl_url, headers=_HEADERS, stream=True, timeout=120)
        else:
            r.raw.decode_content = True

        if r.status_code == 200 and 'text/html' not in r.headers.get('content-type', ''):
            with open(out, 'wb') as f:
                for chunk in r.iter_content(chunk_size=32_768):
                    f.write(chunk)
            if os.path.exists(out) and os.path.getsize(out) > 10_000:
                return out
    except Exception:
        pass

    # Method 2: gdown fallback.
    try:
        gdown.download(
            url=_GDRIVE_DL.format(file_id),
            output=out,
            quiet=False,
        )
        return out if os.path.exists(out) else None
    except FileURLRetrievalError:
        # Google Drive is actively rate-limiting — signal the caller.
        return None


def _prompt_manual(file_id, dest, year):
    """Print manual download instructions without opening the browser.

    We intentionally do NOT call webbrowser.open() here — that would send
    the file to the OS default downloads folder instead of `dest`.
    """
    url      = _GDRIVE_DL.format(file_id)
    abs_dest = os.path.abspath(dest)
    print(
        '\nGoogle Drive is rate-limiting automated downloads.\n'
        f'Please download the {year} CSV manually:\n'
        f'  {url}\n'
        f'Save the file into THIS folder (not your default Downloads):\n'
        f'  {abs_dest}\n'
        'Then re-run the app.'
    )


def ensure_data(folder_id, year, dest='downloads', force=False):
    """Ensure a CSV for `year` exists in `dest`.

    Flow:
      1. Return immediately if a matching CSV is already cached (unless force=True).
      2. Scrape the Drive folder for the file ID.
      3. Try an automated download.
      4. If rate-limited, print manual download instructions.
      5. If the file ID can't be found at all, print the folder URL.
    """
    os.makedirs(dest, exist_ok=True)

    cached = _find_local(dest, year)
    if cached and not force:
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

    print(
        f'Could not locate {year} CSV in the Drive folder.\n'
        f'Download it manually from:\n'
        f'  {_FOLDER_URL.format(folder_id)}\n'
        f'And place the .csv file in:\n'
        f'  {os.path.abspath(dest)}'
    )
    return None
