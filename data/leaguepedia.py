#
# File: data/leaguepedia.py
# Description:
# Fetches per-game item build data from Leaguepedia's public Cargo API.
# No API key required. Used to populate the champion_items table.
#

import time
import requests

_API = 'https://lol.fandom.com/api.php'
_HEADERS = {'User-Agent': 'LeagueDashboard/1.0 (educational project)'}


def _cargo_query(fields, where='', limit=500, offset=0,
                 tables='ScoreboardPlayers', retries=3):
    params = {
        'action':  'cargoquery',
        'tables':  tables,
        'fields':  fields,
        'limit':   str(limit),
        'offset':  str(offset),
        'format':  'json',
    }
    if where:
        params['where'] = where

    for attempt in range(retries):
        r = requests.get(_API, params=params, timeout=30, headers=_HEADERS)
        data = r.json()

        if 'error' in data:
            code = data['error'].get('code', '')
            if code == 'ratelimited':
                wait = 30 * (attempt + 1)
                print(f'  Rate-limited by Leaguepedia, waiting {wait}s...')
                time.sleep(wait)
                continue
            raise RuntimeError(f'Leaguepedia API error: {data["error"]}')

        return [row['title'] for row in data.get('cargoquery', [])]

    raise RuntimeError('Leaguepedia API: still rate-limited after retries.')


def fetch_champion_items(league):
    """Fetch all player-game item records for *league* from Leaguepedia.

    Returns a list of (champion, item_name, year) tuples.
    Items are stored as pipe-separated names in the Items column, e.g.
    "Manamune|Trinity Force|Frozen Heart|...".

    OverviewPage on Leaguepedia follows the pattern:
      "LEC/2024 Season/Spring Season"
    so 'LEC%' catches all splits for the league.
    """
    where = (
        f"OverviewPage LIKE '{league}/%'"
        " AND Items IS NOT NULL AND Items != ''"
    )

    print(f'Fetching item data from Leaguepedia for {league}...')
    all_rows, offset, limit = [], 0, 500

    # Query Champion + Items + OverviewPage.
    # We derive the year from OverviewPage (e.g. "LEC/2024 Season/Spring")
    # rather than DateTime_UTC, which triggers a Cargo MWException when
    # combined with the list-type Items field.
    FIELDS = 'Champion,Items,OverviewPage'

    while True:
        rows = _cargo_query(
            fields=FIELDS,
            where=where,
            limit=limit,
            offset=offset,
        )
        if not rows:
            break
        all_rows.extend(rows)
        print(f'  {len(all_rows)} records fetched...')
        if len(rows) < limit:
            break
        offset += limit
        time.sleep(1.0)   # polite delay between pages

    if not all_rows:
        # Fallback: try without the slash in case OverviewPage format differs
        print(f'  No results with {league}/% filter, trying broader {league}% filter...')
        fallback_where = (
            f"OverviewPage LIKE '{league}%'"
            " AND Items IS NOT NULL AND Items != ''"
        )
        all_rows = _cargo_query(
            fields=FIELDS,
            where=fallback_where,
            limit=limit,
            offset=0,
        )
        if all_rows:
            print(f'  Fallback returned {len(all_rows)} rows, paginating...')
            offset = limit
            while len(all_rows) % limit == 0 and all_rows:
                time.sleep(1.0)
                more = _cargo_query(
                    fields=FIELDS,
                    where=fallback_where,
                    limit=limit,
                    offset=offset,
                )
                if not more:
                    break
                all_rows.extend(more)
                offset += limit

    import re
    _year_re = re.compile(r'/(\d{4})\s+Season')

    records = []
    for row in all_rows:
        champ     = (row.get('Champion')    or '').strip()
        items_str = (row.get('Items')       or '').strip()
        op        = (row.get('OverviewPage')or '').strip()

        # Extract year from "LEC/2024 Season/Spring Season"
        year = None
        m = _year_re.search(op)
        if m:
            year = int(m.group(1))

        if not champ or not items_str:
            continue

        for item in items_str.split('|'):
            item = item.strip()
            if item and item not in ('0', '', 'None', 'null'):
                records.append((champ, item, year))

    print(f'  Done — {len(records)} item records parsed from {len(all_rows)} player-game rows.')
    return records
