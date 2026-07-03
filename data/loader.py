#
# File: data/loader.py
# Creator: LKSHN
# Created: Wed May 13 2026
# Description:
# Parses Oracle's Elixir (OE) CSV files into DataFrames.
#
# OE format: each game produces 12 rows — 10 player rows
# (position != 'team') and 2 team-level summary rows
# (position == 'team', one per side). Functions here handle
# each type separately.
#

import pandas as pd

# Columns needed to build the game-summary table.
# Keeping the list tight avoids loading unused columns for
# large multi-year CSVs.
_SUMMARY_COLS = [
    'gameid', 'date', 'league', 'split', 'patch',
    'side', 'teamname', 'result', 'gamelength', 'position',
]


def load_games(path, league=None):
    """Return one row per player-game with all available columns.

    All columns are kept so any stat from the CSV can be queried later
    without needing to rebuild the database.
    """
    df = pd.read_csv(path, low_memory=False)
    df = df[df['position'] != 'team']   # drop team-summary rows
    if league:
        df = df[df['league'] == league]
    for col in ('split', 'patch'):
        if col not in df.columns:       # older CSVs may lack these fields
            df[col] = None
    return df.dropna(subset=['champion', 'result'])


def _pivot_teams(df):
    # Each game has two team-summary rows (Blue and Red).
    # This pivot merges them into a single row per game so the
    # games table has one record per match instead of two.
    blue = (
        df[df['side'] == 'Blue']
        [['gameid', 'date', 'league', 'split', 'patch',
          'teamname', 'gamelength', 'result']]
        .rename(columns={
            'teamname': 'blue_team',
            'result': 'blue_won',
        })
    )
    red = (
        df[df['side'] == 'Red']
        [['gameid', 'teamname']]
        .rename(columns={'teamname': 'red_team'})
    )
    games = blue.merge(red, on='gameid')
    games['winner'] = games['blue_won'].map(
        {1: 'blue', 0: 'red'}
    )
    return games.drop(columns=['blue_won'])


def load_game_summaries(path, league=None):
    """Return one row per game with teams, winner, duration, split, patch."""
    df = pd.read_csv(
        path, low_memory=False,
        usecols=lambda c: c in _SUMMARY_COLS,
    )
    df = df[df['position'] == 'team'].copy()    # team-summary rows only
    if league:
        df = df[df['league'] == league]
    for col in ['split', 'gamelength']:
        if col not in df.columns:
            df[col] = None
    return _pivot_teams(df)
