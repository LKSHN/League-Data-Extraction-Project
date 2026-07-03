#
# File: server/app.py
# Creator: LKSHN
# Created: Wed May 13 2026
# Description:
# Flask application factory and route definitions
#

import os
from flask import Flask, jsonify, request, send_from_directory

from data.db import (
    get_champion_avg_stats, get_champion_items, get_champion_patches,
    get_champion_splits, get_games, get_leagues, get_stats,
    get_years,
    get_players, get_player_stats, get_player_champions, get_player_splits,
    get_player_rankings, get_player_split_history,
    get_teams, get_team_stats, get_team_matchups, get_team_champions,
    get_team_roster,
)
from data.teams import fetch_team_logos, fetch_league_logos
from server.config import FOLDER_ID, LEAGUE

FRONTEND = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', 'frontend')
)
_FOLDER_URL = 'https://drive.google.com/drive/folders/{}'


def create_app(db_path):
    app = Flask(
        __name__,
        static_folder=FRONTEND,
        static_url_path='',
    )

    def _leagues():
        """Read the repeated ?league=X&league=Y query params, or None."""
        return request.args.getlist('league') or None

    @app.route('/')
    def index():
        return send_from_directory(FRONTEND, 'index.html')

    @app.route('/api/data')
    def api_data():
        year    = request.args.getlist('year', type=int) or None
        split   = request.args.get('split') or None
        patch   = request.args.get('patch') or None
        leagues = _leagues()
        min_g   = 3 if (split or patch) else 10
        return jsonify(
            get_stats(db_path, year=year, split=split, patch=patch,
                      leagues=leagues, min_games=min_g)
        )

    @app.route('/api/games')
    def api_games():
        year  = request.args.getlist('year', type=int) or None
        split = request.args.get('split') or None
        patch = request.args.get('patch') or None
        return jsonify(
            get_games(db_path, year=year, split=split, patch=patch,
                      leagues=_leagues())
        )

    @app.route('/api/leagues')
    def api_leagues():
        return jsonify(get_leagues(db_path))

    @app.route('/api/champion-stats')
    def api_champion_stats():
        champ = request.args.get('champion')
        year  = request.args.getlist('year', type=int) or None
        split = request.args.get('split') or None
        patch = request.args.get('patch') or None
        if not champ:
            return jsonify({})
        return jsonify(
            get_champion_avg_stats(
                db_path, champ, year=year, split=split, patch=patch,
                leagues=_leagues(),
            )
        )

    @app.route('/api/champion-items')
    def api_champion_items():
        champ = request.args.get('champion')
        year  = request.args.getlist('year', type=int) or None
        if not champ:
            return jsonify([])
        return jsonify(get_champion_items(db_path, champ, year=year))

    @app.route('/api/champion-splits')
    def api_champion_splits():
        champ = request.args.get('champion')
        year  = request.args.getlist('year', type=int) or None
        if not champ:
            return jsonify([])
        return jsonify(
            get_champion_splits(db_path, champ, year=year, leagues=_leagues())
        )

    @app.route('/api/champion-patches')
    def api_champion_patches():
        champ = request.args.get('champion')
        year  = request.args.getlist('year', type=int) or None
        split = request.args.get('split') or None
        if not champ:
            return jsonify([])
        return jsonify(
            get_champion_patches(db_path, champ, year=year, split=split,
                                  leagues=_leagues())
        )

    @app.route('/api/team-logos')
    def api_team_logos():
        return jsonify(fetch_team_logos())

    @app.route('/api/league-logos')
    def api_league_logos():
        return jsonify(fetch_league_logos())

    @app.route('/api/info')
    def api_info():
        return jsonify({
            'years': get_years(db_path),
            'league': LEAGUE,
            'folder_url': _FOLDER_URL.format(FOLDER_ID),
        })

    # ── Players ──────────────────────────────────────────────────────────────

    @app.route('/api/players')
    def api_players():
        year  = request.args.getlist('year', type=int) or None
        split = request.args.get('split') or None
        patch = request.args.get('patch') or None
        return jsonify(
            get_players(db_path, year=year, split=split, patch=patch,
                        leagues=_leagues())
        )

    @app.route('/api/player-stats')
    def api_player_stats():
        player = request.args.get('player')
        year   = request.args.getlist('year', type=int) or None
        split  = request.args.get('split') or None
        patch  = request.args.get('patch') or None
        if not player:
            return jsonify({})
        try:
            return jsonify(
                get_player_stats(db_path, player, year=year, split=split,
                                 patch=patch, leagues=_leagues())
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500

    @app.route('/api/player-champions')
    def api_player_champions():
        player = request.args.get('player')
        year   = request.args.getlist('year', type=int) or None
        split  = request.args.get('split') or None
        patch  = request.args.get('patch') or None
        if not player:
            return jsonify([])
        return jsonify(
            get_player_champions(db_path, player, year=year, split=split,
                                 patch=patch, leagues=_leagues())
        )

    @app.route('/api/player-splits')
    def api_player_splits():
        player = request.args.get('player')
        if not player:
            return jsonify([])
        return jsonify(get_player_splits(db_path, player))

    @app.route('/api/player-rankings')
    def api_player_rankings():
        player = request.args.get('player')
        year   = request.args.getlist('year', type=int) or None
        split  = request.args.get('split') or None
        patch  = request.args.get('patch') or None
        if not player:
            return jsonify({})
        return jsonify(
            get_player_rankings(db_path, player, year=year, split=split,
                                patch=patch, leagues=_leagues())
        )

    @app.route('/api/player-split-history')
    def api_player_split_history():
        player = request.args.get('player')
        if not player:
            return jsonify([])
        return jsonify(get_player_split_history(db_path, player))

    # ── Teams ─────────────────────────────────────────────────────────────────

    @app.route('/api/teams')
    def api_teams():
        year  = request.args.getlist('year', type=int) or None
        split = request.args.get('split') or None
        patch = request.args.get('patch') or None
        return jsonify(
            get_teams(db_path, year=year, split=split, patch=patch,
                      leagues=_leagues())
        )

    @app.route('/api/team-stats')
    def api_team_stats():
        team  = request.args.get('team')
        year  = request.args.getlist('year', type=int) or None
        split = request.args.get('split') or None
        patch = request.args.get('patch') or None
        if not team:
            return jsonify({})
        return jsonify(
            get_team_stats(db_path, team, year=year, split=split,
                           patch=patch, leagues=_leagues())
        )

    @app.route('/api/team-matchups')
    def api_team_matchups():
        team  = request.args.get('team')
        year  = request.args.getlist('year', type=int) or None
        split = request.args.get('split') or None
        patch = request.args.get('patch') or None
        if not team:
            return jsonify([])
        return jsonify(
            get_team_matchups(db_path, team, year=year, split=split,
                              patch=patch, leagues=_leagues())
        )

    @app.route('/api/team-champions')
    def api_team_champions():
        team  = request.args.get('team')
        year  = request.args.getlist('year', type=int) or None
        split = request.args.get('split') or None
        patch = request.args.get('patch') or None
        if not team:
            return jsonify({'picks': [], 'bans': []})
        return jsonify(
            get_team_champions(db_path, team, year=year, split=split,
                               patch=patch, leagues=_leagues())
        )

    @app.route('/api/team-roster')
    def api_team_roster():
        team  = request.args.get('team')
        year  = request.args.getlist('year', type=int) or None
        split = request.args.get('split') or None
        patch = request.args.get('patch') or None
        if not team:
            return jsonify([])
        return jsonify(
            get_team_roster(db_path, team, year=year, split=split,
                            patch=patch, leagues=_leagues())
        )

    return app
