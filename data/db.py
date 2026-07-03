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


def _records(df):
    """DataFrame -> list of dicts with NaN replaced by None.

    NaN isn't valid JSON; leaving it in breaks the frontend's
    response.json() call. Now that leagues beyond LEC are loaded,
    plenty of columns (split, patch, per-game stats) legitimately
    have gaps, so this can't be skipped.
    """
    return df.astype(object).where(pd.notnull(df), None).to_dict(orient='records')


def _year_from_filename(path):
    """Extract a 4-digit year from a filename like '2024_OraclesElixir.csv'."""
    m = re.search(r'(\d{4})', os.path.basename(path))
    return int(m.group(1)) if m else None


def _build_where(filters):
    """Build a parameterised WHERE clause from a dict of {column: value}.

    Entries whose value is None are skipped, so callers can pass all possible
    filter keys and only the non-None ones end up in the SQL. A list/tuple
    value builds an `IN (...)` clause instead of `= ?` (used for multi-league
    selection).

    Returns (clause_string, params_list).
    Example: {'year': 2024, 'split': None} → (' WHERE year = ?', [2024])
    """
    conds, params = [], []
    for col, val in filters.items():
        if val is None:
            continue
        if isinstance(val, (list, tuple, set)):
            if not val:
                continue
            placeholders = ','.join('?' * len(val))
            conds.append(f'{col} IN ({placeholders})')
            params.extend(val)
        else:
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
              patch=None, leagues=None, min_games=10):
    """Return champion win-rate stats with presence (pick+ban rate)."""
    where, params = _build_where(
        {'year': year, 'split': split, 'patch': patch, 'league': leagues}
    )
    q        = f'SELECT champion, result FROM {TABLE}{where}'
    q_total  = f'SELECT COUNT(DISTINCT gameid) FROM {SUMMARIES}{where}'
    # Bans live on the per-player `games` table (each side's 5 players share
    # the same ban1..ban5 for their team), so dedupe by gameid before
    # counting or every ban would be counted 5x.
    q_bans   = f'''
        WITH distinct_bans AS (
            SELECT DISTINCT gameid, ban1, ban2, ban3, ban4, ban5
            FROM {TABLE}{where}
        )
        SELECT champion, SUM(cnt) AS bans FROM (
            SELECT ban1 AS champion, COUNT(*) AS cnt FROM distinct_bans GROUP BY ban1
            UNION ALL
            SELECT ban2, COUNT(*) FROM distinct_bans GROUP BY ban2
            UNION ALL
            SELECT ban3, COUNT(*) FROM distinct_bans GROUP BY ban3
            UNION ALL
            SELECT ban4, COUNT(*) FROM distinct_bans GROUP BY ban4
            UNION ALL
            SELECT ban5, COUNT(*) FROM distinct_bans GROUP BY ban5
        ) WHERE champion IS NOT NULL AND champion != ''
        GROUP BY champion
    '''
    p = params or []
    with sqlite3.connect(db_path) as conn:
        df          = pd.read_sql(q, conn, params=p or None)
        total_games = conn.execute(q_total, p).fetchone()[0]
        bans_df     = pd.read_sql(q_bans, conn, params=p or None)

    stats = compute_stats(df, min_games=min_games)
    if total_games:
        ban_map = bans_df.dropna(subset=['champion']).set_index('champion')['bans'].to_dict()
        for row in stats:
            pr = round(row['total_games'] / total_games * 100, 1)
            br = round(ban_map.get(row['champion'], 0) / total_games * 100, 1)
            row['pick_rate'] = pr
            row['ban_rate']  = br
            row['presence']  = round(min(100.0, pr + br), 1)
    return stats


_POS_ORDER = {'top': 0, 'jng': 1, 'mid': 2, 'bot': 3, 'sup': 4}

def get_games(db_path, year=None, split=None, patch=None, leagues=None):
    """Return game results sorted newest-first with ordered champion picks."""
    where, params = _build_where(
        {'year': year, 'split': split, 'patch': patch, 'league': leagues}
    )
    q = (f'SELECT gameid, date, split, patch, blue_team, red_team,'
         f' winner, gamelength FROM {SUMMARIES}{where}'
         f' ORDER BY date DESC')
    with sqlite3.connect(db_path) as conn:
        games_df = pd.read_sql(q, conn, params=params or None)

    if games_df.empty:
        return []

    # Fetch ordered picks for all returned games in one query.
    gameids   = games_df['gameid'].tolist()
    placeholders = ','.join(['?'] * len(gameids))
    picks_q = (
        f'SELECT gameid, side, champion, position FROM {TABLE}'
        f' WHERE gameid IN ({placeholders})'
    )
    with sqlite3.connect(db_path) as conn:
        picks_df = pd.read_sql(picks_q, conn, params=gameids)

    # Group picks per (gameid, side) sorted by position order.
    picks_map = {}
    for _, row in picks_df.iterrows():
        key = (row['gameid'], row['side'])
        picks_map.setdefault(key, []).append(
            (row['champion'], _POS_ORDER.get(row['position'], 9))
        )
    for key in picks_map:
        picks_map[key] = [c for c, _ in sorted(picks_map[key], key=lambda x: x[1])]

    records = _records(games_df)
    for g in records:
        gid = g['gameid']
        g['blue_picks'] = picks_map.get((gid, 'Blue'), [])
        g['red_picks']  = picks_map.get((gid, 'Red'),  [])
    return records


def get_leagues(db_path):
    """Return distinct league codes present in the DB, alphabetically."""
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(
            f'SELECT DISTINCT league FROM {TABLE} ORDER BY league', conn,
        )
    return [l for l in df['league'].tolist() if pd.notna(l) and l]


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
                           year=None, split=None, patch=None, leagues=None):
    """Return average per-game stats for one champion.

    Used to populate the stats grid in the champion detail card.
    KDA is computed as (kills + assists) / max(deaths, 1) to avoid
    division by zero on deathless games.
    """
    where, params = _build_where(
        {'champion': champion, 'year': year,
         'split': split, 'patch': patch, 'league': leagues}
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
    # Ban rate + Fearless-aware pick rate
    where_b, params_b = _build_where(
        {'year': year, 'split': split, 'patch': patch, 'league': leagues}
    )
    # Player table has champion + bans; SUMMARIES has blue_team/red_team/date
    q_picks = f'SELECT DISTINCT gameid, champion, ban1, ban2, ban3, ban4, ban5 FROM {TABLE}{where_b} ORDER BY gameid'
    q_series = f'SELECT DISTINCT gameid, date, blue_team, red_team FROM {SUMMARIES}{where_b} ORDER BY gameid'
    with sqlite3.connect(db_path) as conn:
        row      = conn.execute(q, params).fetchone()
        picks_df = pd.read_sql(q_picks,  conn, params=params_b or None)
        series_df= pd.read_sql(q_series, conn, params=params_b or None)
    gdf = picks_df.merge(series_df, on='gameid', how='left')
    if not row:
        return {}

    keys = [
        'avg_kills', 'avg_deaths', 'avg_assists', 'kda',
        'dpm', 'cspm', 'damage_share',
        'avg_gold15', 'gold_diff15', 'vision_score',
    ]
    result = {k: v for k, v in zip(keys, row) if v is not None}

    # One row per game (dedup by gameid)
    games = gdf.drop_duplicates(subset=['gameid'])
    total_games = len(games)
    if not total_games:
        return result

    # Ban rate: champion in any ban slot / total games
    banned = games[
        (games['ban1'] == champion) | (games['ban2'] == champion) |
        (games['ban3'] == champion) | (games['ban4'] == champion) |
        (games['ban5'] == champion)
    ].shape[0]
    result['ban_rate'] = round(100.0 * banned / total_games, 1)

    # Fearless-aware pick rate
    # All 10 picks per game
    picks_per_game = gdf.groupby('gameid')['champion'].apply(set).to_dict()
    # Series key = (date, frozenset of the two teams)
    games = games.copy()
    games['series_key'] = games.apply(
        lambda r: (r['date'], frozenset([r['blue_team'], r['red_team']])), axis=1
    )
    # Bans per game (one row per game already deduped above)
    bans_per_game = {}
    for _, g in games.iterrows():
        bans_per_game[g['gameid']] = {
            b for b in [g['ban1'], g['ban2'], g['ban3'], g['ban4'], g['ban5']]
            if b and str(b) != 'nan'
        }

    pick_eligible = 0
    pick_count    = 0
    ban_eligible  = 0
    ban_count     = 0

    for _, series in games.groupby('series_key', sort=False):
        used_picks = set()
        used_bans  = set()
        for _, game in series.sort_values('gameid').iterrows():
            gid        = game['gameid']
            game_picks = picks_per_game.get(gid, set())
            game_bans  = bans_per_game.get(gid, set())

            if champion not in used_picks:
                pick_eligible += 1
                if champion in game_picks:
                    pick_count += 1
            if champion not in used_bans:
                ban_eligible += 1
                if champion in game_bans:
                    ban_count += 1

            used_picks.update(game_picks)
            used_bans.update(game_bans)

    if pick_eligible:
        result['pick_rate'] = round(100.0 * pick_count / pick_eligible, 1)
    if ban_eligible:
        result['ban_rate'] = round(100.0 * ban_count / ban_eligible, 1)

    return result


def get_champion_splits(db_path, champion, year=None, leagues=None):
    """Return per-(year, split) win-rate data for one champion.

    Includes ALL (year, split) buckets that exist in the window, not just
    the ones where the champion was played.  Missing buckets get games=0
    and win_rate=None so the chart shows 'not picked' markers.
    """
    # ── All (year, split) buckets in the window ──────────────
    all_where, all_params = _build_where({'year': year, 'league': leagues})
    q_all = (f'SELECT DISTINCT year, split FROM {SUMMARIES}{all_where}'
             ' ORDER BY year, split')
    with sqlite3.connect(db_path) as conn:
        all_df = pd.read_sql(q_all, conn, params=all_params or None)
    all_df = all_df.dropna(subset=['split'])
    all_buckets = [
        (int(r.year), r.split) for r in all_df.itertuples()
    ]

    # ── Champion-specific rows ───────────────────────────────
    where, params = _build_where(
        {'champion': champion, 'year': year, 'league': leagues}
    )
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
                         year=None, split=None, leagues=None):
    """Return per-patch win-rate data for one champion.

    Includes ALL patches that occurred in the year/split window, not just
    the ones where the champion was played.  Patches with no appearances
    get games=0 and win_rate=None so the chart can render a 'not picked'
    marker and break the connecting line at those points.
    """
    # ── All patches in the window ────────────────────────────
    all_where, all_params = _build_where(
        {'year': year, 'split': split, 'league': leagues}
    )
    q_all = (f'SELECT DISTINCT patch, split, year FROM {SUMMARIES}{all_where}'
             ' ORDER BY patch')
    with sqlite3.connect(db_path) as conn:
        meta_df = pd.read_sql(q_all, conn, params=all_params or None)
    meta_df = meta_df.dropna(subset=['patch'])
    # patch → "Split Year" label (use most common split if ambiguous)
    patch_split = {}
    for patch, grp in meta_df.groupby('patch'):
        row = grp.dropna(subset=['split'])
        if not row.empty:
            yr  = int(row.iloc[0]['year'])
            sp  = str(row.iloc[0]['split']).capitalize()
            patch_split[patch] = f'{sp} {yr}'
    all_patches = [p for p in meta_df['patch'].unique() if p]

    # ── Champion-specific rows ───────────────────────────────
    where, params = _build_where(
        {'champion': champion, 'year': year, 'split': split, 'league': leagues}
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
        base = champ.get(p, {'patch': p, 'games': 0, 'wins': 0, 'win_rate': None})
        base['split_label'] = patch_split.get(p)
        rows.append(base)
    return rows


# ── Players ───────────────────────────────────────────────────────────────────

def get_players(db_path, year=None, split=None, patch=None,
                leagues=None, min_games=3):
    """Return all players with aggregate stats for the current filter."""
    where, params = _build_where(
        {'year': year, 'split': split, 'patch': patch, 'league': leagues}
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
    return _records(df)


def get_player_stats(db_path, player, year=None, split=None,
                      patch=None, leagues=None):
    """Return detailed aggregate stats for one player."""
    where, params = _build_where(
        {'playername': player, 'year': year, 'split': split,
         'patch': patch, 'league': leagues}
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


def get_player_rankings(db_path, player, year=None, split=None,
                         patch=None, leagues=None):
    """Rank the player against same-position peers for key stats."""
    where, params = _build_where(
        {'year': year, 'split': split, 'patch': patch, 'league': leagues}
    )
    q = f'''
        SELECT
            playername,
            MAX(position) AS position,
            COUNT(DISTINCT gameid) AS games,
            ROUND(AVG(golddiffat15),   0) AS gd15,
            ROUND(AVG(xpdiffat15),     0) AS xpd15,
            ROUND(AVG(csdiffat15),     1) AS csd15,
            ROUND(AVG(dpm),            0) AS dpm,
            ROUND(AVG(damageshare)*100,1) AS dmg_share,
            ROUND(AVG(CAST(kills+assists AS FLOAT)/
                  CASE WHEN deaths=0 THEN 1 ELSE deaths END), 2) AS kda,
            ROUND(AVG(cspm),           2) AS cspm,
            ROUND(AVG(vspm),           2) AS vspm,
            ROUND(AVG(goldat15),       0) AS gold15
        FROM {TABLE}{where}
        GROUP BY playername
        HAVING COUNT(DISTINCT gameid) >= 3
    '''
    with sqlite3.connect(db_path) as conn:
        df = pd.read_sql(q, conn, params=params or None)
    if df.empty:
        return {}
    prow = df[df['playername'] == player]
    if prow.empty:
        return {}
    position = prow.iloc[0]['position']
    peers    = df[df['position'] == position].copy()
    STATS    = ['gd15', 'xpd15', 'csd15', 'dpm', 'dmg_share', 'kda', 'cspm', 'vspm', 'gold15']
    result   = {'total': int(len(peers))}
    for stat in STATS:
        val = prow.iloc[0][stat]
        if pd.isna(val):
            continue
        result[f'{stat}_rank'] = int((peers[stat] > val).sum()) + 1
    return result


def get_player_split_history(db_path, player):
    """Return per-split stats for the career history table."""
    where, params = _build_where({'playername': player})
    q = f'''
        SELECT year, split,
            COUNT(DISTINCT gameid) AS games,
            COUNT(DISTINCT CASE WHEN result=1 THEN gameid END) AS wins,
            ROUND(100.0*COUNT(DISTINCT CASE WHEN result=1 THEN gameid END)/
                  COUNT(DISTINCT gameid), 1) AS win_rate,
            ROUND(AVG(CAST(kills+assists AS FLOAT)/
                  CASE WHEN deaths=0 THEN 1 ELSE deaths END), 2) AS kda,
            ROUND(AVG(dpm), 0) AS dpm,
            ROUND(AVG(golddiffat15), 0) AS gd15,
            ROUND(AVG(csdiffat15),  1) AS csd15
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
            'label':    f'{sp} {yr}',
            'games':    int(r['games']),
            'wins':     int(r['wins']),
            'win_rate': float(r['win_rate']) if pd.notna(r['win_rate']) else None,
            'kda':      float(r['kda'])      if pd.notna(r['kda'])      else None,
            'dpm':      int(r['dpm'])        if pd.notna(r['dpm'])      else None,
            'gd15':     float(r['gd15'])     if pd.notna(r['gd15'])     else None,
            'csd15':    float(r['csd15'])    if pd.notna(r['csd15'])    else None,
            '_sort':    (yr, _SPLIT_ORDER.get(sp.lower(), 99)),
        })
    rows.sort(key=lambda x: x['_sort'], reverse=True)
    for r in rows:
        del r['_sort']
    return rows


def get_player_champions(db_path, player,
                         year=None, split=None, patch=None,
                         leagues=None, top_n=8):
    """Return the player's most-played champions with stats."""
    where, params = _build_where(
        {'playername': player, 'year': year, 'split': split,
         'patch': patch, 'league': leagues}
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
    return _records(df)


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

def get_teams(db_path, year=None, split=None, patch=None,
              leagues=None, min_games=3):
    """Return all teams with aggregate stats."""
    where, params = _build_where(
        {'year': year, 'split': split, 'patch': patch, 'league': leagues}
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
    return _records(df)


def get_team_stats(db_path, team, year=None, split=None,
                    patch=None, leagues=None):
    """Return detailed stats for one team."""
    where, params = _build_where(
        {'teamname': team, 'year': year, 'split': split,
         'patch': patch, 'league': leagues}
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


def get_team_matchups(db_path, team, year=None, split=None,
                       patch=None, leagues=None):
    """Return head-to-head record vs each opponent."""
    where_b, params_b = _build_where(
        {'blue_team': team, 'year': year, 'split': split,
         'patch': patch, 'league': leagues}
    )
    where_r, params_r = _build_where(
        {'red_team': team, 'year': year, 'split': split,
         'patch': patch, 'league': leagues}
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
    return _records(df)


def get_team_champions(db_path, team, year=None, split=None,
                        patch=None, leagues=None, top_n=8):
    """Return picks grouped by role and most-banned champions for a team."""
    where, params = _build_where(
        {'teamname': team, 'year': year, 'split': split,
         'patch': patch, 'league': leagues}
    )
    q_pick = f'''
        SELECT position, champion,
            COUNT(DISTINCT gameid) AS games,
            COUNT(DISTINCT CASE WHEN result=1 THEN gameid END) AS wins,
            ROUND(100.0*COUNT(DISTINCT CASE WHEN result=1 THEN gameid END)/
                  COUNT(DISTINCT gameid), 1) AS win_rate
        FROM {TABLE}{where}
        GROUP BY position, champion
        ORDER BY position, games DESC
    '''
    # Load raw ban rows, dedup by gameid so each ban is counted once per game.
    q_bans = f'SELECT DISTINCT gameid, ban1, ban2, ban3, ban4, ban5 FROM {TABLE}{where}'
    with sqlite3.connect(db_path) as conn:
        df_pick = pd.read_sql(q_pick, conn, params=params or None)
        df_bans = pd.read_sql(q_bans, conn, params=params or None)

    # Group picks by role
    picks_by_role = {}
    for pos in ['top', 'jng', 'mid', 'bot', 'sup']:
        rows = _records(df_pick[df_pick['position'] == pos])
        picks_by_role[pos] = [
            {k: (None if pd.isna(v) else (v.item() if hasattr(v, 'item') else v))
             for k, v in r.items()}
            for r in rows
        ]

    df_bans = df_bans.drop_duplicates(subset=['gameid'])
    ban_counts = {}
    for col in ['ban1', 'ban2', 'ban3', 'ban4', 'ban5']:
        for val in df_bans[col].dropna():
            if val and str(val).strip():
                ban_counts[val] = ban_counts.get(val, 0) + 1
    bans = [{'champion': k, 'games': v}
            for k, v in sorted(ban_counts.items(), key=lambda x: -x[1])[:top_n]]

    return {
        'picks_by_role': picks_by_role,
        'bans':          bans,
    }


def get_team_roster(db_path, team, year=None, split=None,
                     patch=None, leagues=None):
    """Return roster with per-player stats, sorted by role."""
    where, params = _build_where(
        {'teamname': team, 'year': year, 'split': split,
         'patch': patch, 'league': leagues}
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
    return _records(df)
