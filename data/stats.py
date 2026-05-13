#
# File: data/stats.py
# Creator: LKSHN
# Created: Wed May 13 2026
# Description:
# Computes per-champion win rate statistics from a DataFrame
# of individual player-game rows.
#


def _add_rates(stats):
    # Oracle's Elixir encodes result as 1 (win) or 0 (loss),
    # so sum() == wins and count() == total games.
    stats['win_rate'] = (
        stats['wins'] / stats['total_games'] * 100
    ).round(2)
    stats['loss_rate'] = (
        100 - stats['win_rate']
    ).round(2)
    return stats


def compute_stats(df, min_games=10):
    # min_games filters out champions with too few appearances
    # to produce a statistically meaningful win rate.
    # The threshold is lowered to 3 by the API when a split or
    # patch filter is active, since the sample size is smaller.
    stats = df.groupby('champion').agg(
        wins=('result', 'sum'),
        total_games=('result', 'count'),
    ).reset_index()
    stats = _add_rates(stats)
    stats = stats[stats['total_games'] >= min_games]
    return (
        stats
        .sort_values('win_rate', ascending=False)
        .to_dict(orient='records')
    )
