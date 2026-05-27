#
# File: data/db.py
# Creator: LKSHN
# Created: Wed May 13 2026
# Description:
# Builds and queries a SQLite database from OE CSV files.
#
# Two tables are maintained:
#   'games'          — one row per player-game (champion, result, split, patch, year)
#   'game_summaries' — one row per game        (teams, winner, duration, split, patch, year)
#

import os
import re
import sqlite3
import pandas as pd

from data.loader import load_game_summaries, load_games
from data.stats import compute_stats

TABLE     = 'games'           # per-player rows; used for champion stats
SUMMARIES = 'game_summaries'  # per-game rows;   used for the game-results list
ITEMS     = 'champion_items'  # aggregated item counts from Leaguepedia


def _year_from_filename(path):
    """Extract a 4-digit year from a filename like '2024_OraclesElixir.csv'."""
    m = re.search(r'(\d{4})', os.path.basename(path))
    return int(m.group(1)) if m else None


def _build_where(filters):
    """Build a parameterised WHERE clause from a dict of {column: value}.

    Entries whose value is None are skipped, so callers can pass all possible
    filter keys and only the non-None ones end up in the SQL.

    Returns (clause_string, params_list).
    Example: {'year': 2024, 'split': None} → (' WHERE year = ?', [2024])
    """
    conds, params = [], []
    for col, val in filters.items():
        if val is not None:
            conds.append(f'{col} = ?')
            params.append(val)
    if not conds:
        return '', []
    return ' WHERE ' + ' AND '.join(conds), params


def _load_csv(conn, path, year, league):
    df = load_games(path, league=league)
    df['year'] = year
    df.to_sql(TABLE, conn, if_exists='append', index=False)

    gs = load_game_summaries(path, league=league)
    gs['year'] = year
    gs.to_sql(
        SUMMARIES, conn, if_exists='append', index=False
    )


def build_db(downloads_dir, db_path, league=None):
    """Drop and rebuild both tables from every CSV in `downloads_dir`."""
    conn = sqlite3.connect(db_path)
    conn.execute(f'DROP TABLE IF EXISTS {TABLE}')
    conn.execute(f'DROP TABLE IF EXISTS {SUMMARIES}')
    conn.commit()
    loaded = 0
    for fname in sorted(os.listdir(downloads_dir)):
        if not fname.endswith('.csv'):
            continue
        year = _year_from_filename(fname)
        if not year:
            continue
        path = os.path.join(downloads_dir, fname)
        print(f'Loading {fname}...')
        _load_csv(conn, path, year, league)
        loaded += 1
    conn.close()
    if not loaded:
        raise FileNotFoundError(
            f'No CSV files found in {downloads_dir}'
        )
    print(f'Database built from {loaded} file(s).')


def get_years(db_path):
    """Return a descending list of years that have data in the DB."""
    with sqlite3.connect(db_path) as conn:
        rows = pd.read_sql(
            f'SELECT DISTINCT year FROM {TABLE}'
            ' ORDER BY year DESC',
            conn,
        )
    return rows['year'].tolist()


def get_stats(db_path, year=None, split=None,
              patch=None, min_games=10):
    """Return champion win-rate stats, optionally filtered by year/split/patch."""
    where, params = _build_where(
        {'year': year, 'split': split, 'patch': patch}
    )
    q = f'SELECT champion, result FROM {TABLE}{where}'
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    return compute_stats(df, min_games=min_games)


def get_games(db_path, year=None, split=None, patch=None):
    """Return game results sorted newest-first, optionally filtered."""
    cols = (
        'date, split, patch, blue_team, red_team,'
        ' winner, gamelength'
    )
    where, params = _build_where(
        {'year': year, 'split': split, 'patch': patch}
    )
    q = (f'SELECT {cols} FROM {SUMMARIES}{where}'
         ' ORDER BY date DESC')
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    return df.to_dict(orient='records')


def get_splits(db_path, year=None):
    """Return distinct split names for a given year (or all years)."""
    where, params = _build_where({'year': year})
    q = (f'SELECT DISTINCT split FROM {SUMMARIES}{where}'
         ' ORDER BY split')
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    return [s for s in df['split'].tolist() if s]


def get_patches(db_path, year=None, split=None):
    """Return distinct patch strings for a given year/split combination."""
    where, params = _build_where(
        {'year': year, 'split': split}
    )
    q = (f'SELECT DISTINCT patch FROM {SUMMARIES}{where}'
         ' ORDER BY patch')
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    return [p for p in df['patch'].tolist() if p]


def _find_year_csv(downloads_dir, year):
    """Return the path to the CSV for `year` in downloads_dir, or None."""
    for fname in os.listdir(downloads_dir):
        if fname.endswith('.csv') and str(year) in fname:
            return os.path.join(downloads_dir, fname)
    return None


def update_year(downloads_dir, db_path, year, league=None):
    """Remove existing data for `year` and reload it from the matching CSV.

    Used by the daily CI job so only the current year is refreshed —
    no need to re-download or re-process all historical CSVs.
    """
    path = _find_year_csv(downloads_dir, year)
    if not path:
        raise FileNotFoundError(
            f'No CSV found for {year} in {downloads_dir}'
        )
    conn = sqlite3.connect(db_path)
    conn.execute(f'DELETE FROM {TABLE}     WHERE year = ?', [year])
    conn.execute(f'DELETE FROM {SUMMARIES} WHERE year = ?', [year])
    conn.commit()
    _load_csv(conn, path, year, league)
    conn.close()
    print(f'Updated {year} data in {db_path}')


def build_champion_items(db_path, league):
    """Fetch item data from Leaguepedia and store aggregated pick counts.

    Called once during --rebuild or --items.  Safe to re-run: drops and
    recreates the champion_items table each time.
    Returns True on success, False if the API was unavailable.
    """
    from data.leaguepedia import fetch_champion_items
    try:
        records = fetch_champion_items(league)
    except Exception as e:
        print(f'Could not fetch item data from Leaguepedia ({e}).')
        print('Run  python main.py --items  later to retry.')
        return False
    if not records:
        print('No item data returned from Leaguepedia — skipping.')
        print('Run  python main.py --items  later to retry.')
        return False

    # Aggregate: (champion, item_name, year) → total picks
    counts = {}
    for champ, item, year in records:
        key = (champ, item, year)
        counts[key] = counts.get(key, 0) + 1

    conn = sqlite3.connect(db_path)
    conn.execute(f'DROP TABLE IF EXISTS {ITEMS}')
    conn.execute(f'''
        CREATE TABLE {ITEMS} (
            champion  TEXT,
            item_name TEXT,
            year      INTEGER,
            picks     INTEGER
        )
    ''')
    conn.executemany(
        f'INSERT INTO {ITEMS} VALUES (?, ?, ?, ?)',
        [(c, i, y, n) for (c, i, y), n in counts.items()],
    )
    conn.commit()
    conn.close()
    print(f'champion_items table built ({len(counts)} rows).')
    return True


def get_champion_items(db_path, champion, year=None, top_n=10):
    """Return the top_n most-bought items for a champion."""
    with sqlite3.connect(db_path) as conn:
        exists = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            [ITEMS],
        ).fetchone()
    if not exists:
        return []

    where, params = _build_where({'champion': champion, 'year': year})
    q = (f'SELECT item_name, SUM(picks) AS total'
         f' FROM {ITEMS}{where}'
         f' GROUP BY item_name ORDER BY total DESC LIMIT {top_n}')
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    return [{'item_name': r['item_name'], 'picks': int(r['total'])}
            for _, r in df.iterrows()]


def get_champion_avg_stats(db_path, champion,
                           year=None, split=None, patch=None):
    """Return average per-game stats for one champion.

    Used to populate the stats grid in the champion detail card.
    KDA is computed as (kills + assists) / max(deaths, 1) to avoid
    division by zero on deathless games.
    """
    where, params = _build_where(
        {'champion': champion, 'year': year,
         'split': split, 'patch': patch}
    )
    q = f'''
        SELECT
            ROUND(AVG(kills),   2) AS avg_kills,
            ROUND(AVG(deaths),  2) AS avg_deaths,
            ROUND(AVG(assists), 2) AS avg_assists,
            ROUND(AVG(
                CAST(kills + assists AS FLOAT) / MAX(deaths, 1)
            ), 2)                  AS kda,
            ROUND(AVG(dpm),         0) AS dpm,
            ROUND(AVG(cspm),        2) AS cspm,
            ROUND(AVG(damageshare) * 100, 1) AS damage_share,
            ROUND(AVG(goldat15),    0) AS avg_gold15,
            ROUND(AVG(golddiffat15),0) AS gold_diff15,
            ROUND(AVG(visionscore), 1) AS vision_score
        FROM {TABLE}{where}
    '''
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(q, params).fetchone()
    if not row:
        return {}
    keys = [
        'avg_kills', 'avg_deaths', 'avg_assists', 'kda',
        'dpm', 'cspm', 'damage_share',
        'avg_gold15', 'gold_diff15', 'vision_score',
    ]
    return {k: v for k, v in zip(keys, row) if v is not None}


def get_champion_splits(db_path, champion, year=None):
    """Return per-(year, split) win-rate data for one champion.

    Includes ALL (year, split) buckets that exist in the window, not just
    the ones where the champion was played.  Missing buckets get games=0
    and win_rate=None so the chart shows 'not picked' markers.
    """
    # ── All (year, split) buckets in the window ──────────────
    all_where, all_params = _build_where({'year': year})
    q_all = (f'SELECT DISTINCT year, split FROM {SUMMARIES}{all_where}'
             ' ORDER BY year, split')
    with sqlite3.connect(db_path) as conn:
        all_df = pd.read_sql(q_all, conn, params=all_params or None)
    all_df = all_df.dropna(subset=['split'])
    all_buckets = [
        (int(r.year), r.split) for r in all_df.itertuples()
    ]

    # ── Champion-specific rows ───────────────────────────────
    where, params = _build_where({'champion': champion, 'year': year})
    q = f'SELECT year, split, result FROM {TABLE}{where}'
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    df = df.dropna(subset=['split'])

    champ = {}
    for (yr, split), grp in df.groupby(['year', 'split']):
        wins  = int(grp['result'].sum())
        total = len(grp)
        champ[(int(yr), split)] = {
            'games':    total,
            'wins':     wins,
            'win_rate': round(wins / total * 100, 1),
        }

    # ── Merge: fill 0 for buckets where champion wasn't played ─
    rows = []
    for (yr, split) in all_buckets:
        label = f'{split} {yr}'
        played = champ.get((yr, split))
        if played:
            rows.append({'patch': label, **played})
        else:
            rows.append({'patch': label, 'games': 0,
                         'wins': 0, 'win_rate': None})
    return rows




def get_champion_patches(db_path, champion,
                         year=None, split=None):
    """Return per-patch win-rate data for one champion.

    Includes ALL patches that occurred in the year/split window, not just
    the ones where the champion was played.  Patches with no appearances
    get games=0 and win_rate=None so the chart can render a 'not picked'
    marker and break the connecting line at those points.
    """
    # ── All patches in the window ────────────────────────────
    all_where, all_params = _build_where({'year': year, 'split': split})
    q_all = (f'SELECT DISTINCT patch FROM {SUMMARIES}{all_where}'
             ' ORDER BY patch')
    with sqlite3.connect(db_path) as conn:
        all_patches = [
            p for p in
            pd.read_sql(q_all, conn, params=all_params or None)['patch']
            if p
        ]

    # ── Champion-specific rows ───────────────────────────────
    where, params = _build_where(
        {'champion': champion, 'year': year, 'split': split}
    )
    q = f'SELECT patch, result FROM {TABLE}{where}'
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    df = df.dropna(subset=['patch'])

    champ = {}
    for patch, grp in df.groupby('patch'):
        wins  = int(grp['result'].sum())
        total = len(grp)
        champ[patch] = {
            'patch':    patch,
            'games':    total,
            'wins':     wins,
            'win_rate': round(wins / total * 100, 1),
        }

    # ── Merge: fill 0 for patches where champion wasn't played ─
    rows = []
    for p in all_patches:
        rows.append(champ.get(p, {
            'patch':    p,
            'games':    0,
            'wins':     0,
            'win_rate': None,
        }))
    return rows


# ── Players ───────────────────────────────────────────────────────────────────

def get_players(db_path, year=None, split=None, patch=None, min_games=3):
    """Return all players with aggregate stats for the current filter."""
    where, params = _build_where(
        {'year': year, 'split': split, 'patch': patch}
    )
    q = f'''
        SELECT playername, teamname, position,
            COUNT(DISTINCT gameid)  AS games,
            COUNT(DISTINCT CASE WHEN result=1 THEN gameid END) AS wins,
            ROUND(100.0*COUNT(DISTINCT CASE WHEN result=1 THEN gameid END)/
                  COUNT(DISTINCT gameid), 1) AS win_rate,
            ROUND(AVG(kills),  2) AS avg_kills,
            ROUND(AVG(deaths), 2) AS avg_deaths,
            ROUND(AVG(assists),2) AS avg_assists,
            ROUND(AVG(CAST(kills+assists AS FLOAT)/
                  CASE WHEN deaths=0 THEN 1 ELSE deaths END), 2) AS kda,
            ROUND(AVG(dpm),  0) AS dpm,
            ROUND(AVG(cspm), 2) AS cspm,
            ROUND(AVG(vspm), 2) AS vspm
        FROM {TABLE}{where}
        GROUP BY playername, teamname, position
        HAVING COUNT(DISTINCT gameid) >= {min_games}
        ORDER BY playername
    '''
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    # If a player appears with multiple team/position combos, keep the most-played row.
    df = (df.sort_values('games', ascending=False)
            .drop_duplicates(subset=['playername'])
            .reset_index(drop=True))
    return df.to_dict(orient='records')


def get_player_stats(db_path, player, year=None, split=None, patch=None):
    """Return detailed aggregate stats for one player."""
    where, params = _build_where(
        {'playername': player, 'year': year, 'split': split, 'patch': patch}
    )
    q = f'''
        SELECT
            COUNT(DISTINCT gameid) AS games,
            COUNT(DISTINCT CASE WHEN result=1 THEN gameid END) AS wins,
            ROUND(100.0*COUNT(DISTINCT CASE WHEN result=1 THEN gameid END)/
                  COUNT(DISTINCT gameid), 1) AS win_rate,
            ROUND(AVG(kills),  2) AS avg_kills,
            ROUND(AVG(deaths), 2) AS avg_deaths,
            ROUND(AVG(assists),2) AS avg_assists,
            ROUND(AVG(CAST(kills+assists AS FLOAT)/
                  CASE WHEN deaths=0 THEN 1 ELSE deaths END), 2) AS kda,
            ROUND(AVG(dpm),  0) AS dpm,
            ROUND(AVG(damageshare)*100, 1) AS damage_share,
            ROUND(AVG(cspm), 2) AS cspm,
            ROUND(AVG(vspm), 2) AS vspm,
            ROUND(AVG(golddiffat15), 0) AS gold_diff15,
            ROUND(AVG(xpdiffat15),  0) AS xp_diff15,
            ROUND(AVG(csdiffat15),  1) AS cs_diff15,
            ROUND(AVG(goldat15),    0) AS avg_gold15,
            COUNT(DISTINCT CASE WHEN side='Blue' THEN gameid END) AS blue_games,
            COUNT(DISTINCT CASE WHEN side='Blue' AND result=1 THEN gameid END) AS blue_wins,
            COUNT(DISTINCT CASE WHEN side='Red'  THEN gameid END) AS red_games,
            COUNT(DISTINCT CASE WHEN side='Red'  AND result=1 THEN gameid END) AS red_wins,
            MAX(teamname) AS teamname,
            MAX(position) AS position
        FROM {TABLE}{where}
    '''
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    if df.empty or not df['games'].iloc[0]:
        return {}
    row = {k: (None if pd.isna(v) else (v.item() if hasattr(v, 'item') else v)) for k, v in df.iloc[0].items()}
    row['losses']  = int(row['games']) - int(row['wins'])
    row['blue_wr'] = (round(100*row['blue_wins']/row['blue_games'], 1)
                      if row['blue_games'] else None)
    row['red_wr']  = (round(100*row['red_wins']/row['red_games'], 1)
                      if row['red_games'] else None)
    return row


def get_player_champions(db_path, player,
                         year=None, split=None, patch=None, top_n=8):
    """Return the player's most-played champions with stats."""
    where, params = _build_where(
        {'playername': player, 'year': year, 'split': split, 'patch': patch}
    )
    q = f'''
        SELECT champion,
            COUNT(DISTINCT gameid) AS games,
            COUNT(DISTINCT CASE WHEN result=1 THEN gameid END) AS wins,
            ROUND(100.0*COUNT(DISTINCT CASE WHEN result=1 THEN gameid END)/
                  COUNT(DISTINCT gameid), 1) AS win_rate,
            ROUND(AVG(CAST(kills+assists AS FLOAT)/
                  CASE WHEN deaths=0 THEN 1 ELSE deaths END), 2) AS kda
        FROM {TABLE}{where}
        GROUP BY champion
        ORDER BY games DESC
        LIMIT {top_n}
    '''
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    return df.to_dict(orient='records')


_SPLIT_ORDER = {
    'winter': 0, 'spring': 1, 'summer': 2,
    'finals': 3, 'versus': 4,
}

def get_player_splits(db_path, player):
    """Return win rate by year+split for the player's career history chart."""
    where, params = _build_where({'playername': player})
    q = f'''
        SELECT year, split,
            COUNT(DISTINCT gameid) AS games,
            COUNT(DISTINCT CASE WHEN result=1 THEN gameid END) AS wins,
            ROUND(100.0*COUNT(DISTINCT CASE WHEN result=1 THEN gameid END)/
                  COUNT(DISTINCT gameid), 1) AS win_rate
        FROM {TABLE}{where}
        GROUP BY year, split
    '''
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    rows = []
    for _, r in df.iterrows():
        sp = r['split'] if pd.notna(r['split']) else ''
        if not sp:
            continue
        yr = int(r['year']) if pd.notna(r['year']) else 0
        rows.append({
            'patch':    f'{sp} {yr}',
            'games':    int(r['games']),
            'wins':     int(r['wins']),
            'win_rate': float(r['win_rate']) if pd.notna(r['win_rate']) else None,
            '_sort':    (yr, _SPLIT_ORDER.get(sp.lower(), 99)),
        })
    rows.sort(key=lambda x: x['_sort'])
    for r in rows:
        del r['_sort']
    return rows


# ── Teams ─────────────────────────────────────────────────────────────────────

def get_teams(db_path, year=None, split=None, patch=None, min_games=3):
    """Return all teams with aggregate stats."""
    where, params = _build_where(
        {'year': year, 'split': split, 'patch': patch}
    )
    q = f'''
        SELECT teamname,
            COUNT(DISTINCT gameid) AS games,
            COUNT(DISTINCT CASE WHEN result=1 THEN gameid END) AS wins,
            ROUND(100.0*COUNT(DISTINCT CASE WHEN result=1 THEN gameid END)/
                  COUNT(DISTINCT gameid), 1) AS win_rate,
            ROUND(AVG(gamelength)/60.0, 1) AS avg_game_min
        FROM {TABLE}{where}
        GROUP BY teamname
        HAVING COUNT(DISTINCT gameid) >= {min_games}
        ORDER BY win_rate DESC
    '''
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    return df.to_dict(orient='records')


def get_team_stats(db_path, team, year=None, split=None, patch=None):
    """Return detailed stats for one team."""
    where, params = _build_where(
        {'teamname': team, 'year': year, 'split': split, 'patch': patch}
    )
    q = f'''
        SELECT
            COUNT(DISTINCT gameid) AS games,
            COUNT(DISTINCT CASE WHEN result=1 THEN gameid END) AS wins,
            ROUND(100.0*COUNT(DISTINCT CASE WHEN result=1 THEN gameid END)/
                  COUNT(DISTINCT gameid), 1) AS win_rate,
            ROUND(AVG(gamelength)/60.0, 1) AS avg_game_min,
            ROUND(SUM(kills)*1.0  / COUNT(DISTINCT gameid), 1) AS avg_kills,
            ROUND(SUM(deaths)*1.0 / COUNT(DISTINCT gameid), 1) AS avg_deaths,
            COUNT(DISTINCT CASE WHEN side='Blue' THEN gameid END) AS blue_games,
            COUNT(DISTINCT CASE WHEN side='Blue' AND result=1 THEN gameid END) AS blue_wins,
            COUNT(DISTINCT CASE WHEN side='Red'  THEN gameid END) AS red_games,
            COUNT(DISTINCT CASE WHEN side='Red'  AND result=1 THEN gameid END) AS red_wins
        FROM {TABLE}{where}
    '''
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    if df.empty or not df['games'].iloc[0]:
        return {}
    row = {k: (None if pd.isna(v) else (v.item() if hasattr(v, 'item') else v)) for k, v in df.iloc[0].items()}
    row['losses']  = int(row['games']) - int(row['wins'])
    row['blue_wr'] = (round(100*row['blue_wins']/row['blue_games'], 1)
                      if row['blue_games'] else None)
    row['red_wr']  = (round(100*row['red_wins']/row['red_games'], 1)
                      if row['red_games'] else None)
    return row


def get_team_matchups(db_path, team, year=None, split=None, patch=None):
    """Return head-to-head record vs each opponent."""
    where_b, params_b = _build_where(
        {'blue_team': team, 'year': year, 'split': split, 'patch': patch}
    )
    where_r, params_r = _build_where(
        {'red_team': team, 'year': year, 'split': split, 'patch': patch}
    )
    q = f'''
        SELECT opponent,
            SUM(wins)   AS wins,
            SUM(losses) AS losses,
            SUM(wins) + SUM(losses) AS games
        FROM (
            SELECT red_team AS opponent,
                CASE WHEN winner='blue' THEN 1 ELSE 0 END AS wins,
                CASE WHEN winner='red'  THEN 1 ELSE 0 END AS losses
            FROM {SUMMARIES}{where_b}
            UNION ALL
            SELECT blue_team AS opponent,
                CASE WHEN winner='red'  THEN 1 ELSE 0 END AS wins,
                CASE WHEN winner='blue' THEN 1 ELSE 0 END AS losses
            FROM {SUMMARIES}{where_r}
        )
        GROUP BY opponent
        ORDER BY games DESC, wins DESC
    '''
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=(params_b + params_r) or None)
    return df.to_dict(orient='records')


def get_team_champions(db_path, team, year=None, split=None, patch=None, top_n=8):
    """Return most-picked and most-banned champions for a team."""
    where, params = _build_where(
        {'teamname': team, 'year': year, 'split': split, 'patch': patch}
    )
    q_pick = f'''
        SELECT champion,
            COUNT(DISTINCT gameid) AS games,
            COUNT(DISTINCT CASE WHEN result=1 THEN gameid END) AS wins,
            ROUND(100.0*COUNT(DISTINCT CASE WHEN result=1 THEN gameid END)/
                  COUNT(DISTINCT gameid), 1) AS win_rate
        FROM {TABLE}{where}
        GROUP BY champion
        ORDER BY games DESC
        LIMIT {top_n}
    '''
    # Load raw ban rows, dedup by gameid so each ban is counted once per game.
    q_bans = f'SELECT DISTINCT gameid, ban1, ban2, ban3, ban4, ban5 FROM {TABLE}{where}'
    with sqlite3.connect(db_path) as conn:
        df_pick = pd.read_sql(q_pick, conn, params=params or None)
        df_bans = pd.read_sql(q_bans, conn, params=params or None)

    df_bans = df_bans.drop_duplicates(subset=['gameid'])
    ban_counts = {}
    for col in ['ban1', 'ban2', 'ban3', 'ban4', 'ban5']:
        for val in df_bans[col].dropna():
            if val and str(val).strip():
                ban_counts[val] = ban_counts.get(val, 0) + 1
    bans = [{'champion': k, 'games': v}
            for k, v in sorted(ban_counts.items(), key=lambda x: -x[1])[:top_n]]

    return {
        'picks': df_pick.to_dict(orient='records'),
        'bans':  bans,
    }


def get_team_roster(db_path, team, year=None, split=None, patch=None):
    """Return roster with per-player stats, sorted by role."""
    where, params = _build_where(
        {'teamname': team, 'year': year, 'split': split, 'patch': patch}
    )
    q = f'''
        SELECT playername, position,
            COUNT(DISTINCT gameid) AS games,
            COUNT(DISTINCT CASE WHEN result=1 THEN gameid END) AS wins,
            ROUND(100.0*COUNT(DISTINCT CASE WHEN result=1 THEN gameid END)/
                  COUNT(DISTINCT gameid), 1) AS win_rate,
            ROUND(AVG(CAST(kills+assists AS FLOAT)/
                  CASE WHEN deaths=0 THEN 1 ELSE deaths END), 2) AS kda,
            ROUND(AVG(dpm),  0) AS dpm,
            ROUND(AVG(cspm), 2) AS cspm
        FROM {TABLE}{where}
        GROUP BY playername, position
        ORDER BY games DESC
    '''
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    df = df.drop_duplicates(subset=['playername'])
    pos_order = {'top': 0, 'jng': 1, 'mid': 2, 'bot': 3, 'sup': 4}
    df['_ord'] = df['position'].map(pos_order).fillna(5).astype(int)
    df = df.sort_values('_ord').drop(columns=['_ord']).reset_index(drop=True)
    return df.to_dict(orient='records')
