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
    get_champion_avg_stats, get_champion_patches, get_champion_splits,
    get_games, get_patches, get_splits, get_stats, get_years,
)
from data.teams import fetch_team_logos
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

    @app.route('/')
    def index():
        return send_from_directory(FRONTEND, 'index.html')

    @app.route('/api/data')
    def api_data():
        year  = request.args.get('year',  type=int)
        split = request.args.get('split') or None
        patch = request.args.get('patch') or None
        # Fewer games per champion when narrowed to a split or patch,
        # so lower the threshold to avoid filtering everything out.
        min_g = 3 if (split or patch) else 10
        return jsonify(
            get_stats(db_path, year=year, split=split,
                      patch=patch, min_games=min_g)
        )

    @app.route('/api/games')
    def api_games():
        year  = request.args.get('year',  type=int)
        split = request.args.get('split') or None
        patch = request.args.get('patch') or None
        return jsonify(
            get_games(db_path, year=year,
                      split=split, patch=patch)
        )

    @app.route('/api/splits')
    def api_splits():
        year = request.args.get('year', type=int)
        return jsonify(get_splits(db_path, year=year))

    @app.route('/api/champion-stats')
    def api_champion_stats():
        champ = request.args.get('champion')
        year  = request.args.get('year',  type=int)
        split = request.args.get('split') or None
        patch = request.args.get('patch') or None
        if not champ:
            return jsonify({})
        return jsonify(
            get_champion_avg_stats(
                db_path, champ,
                year=year, split=split, patch=patch,
            )
        )

    @app.route('/api/champion-splits')
    def api_champion_splits():
        champ = request.args.get('champion')
        year  = request.args.get('year', type=int)
        if not champ:
            return jsonify([])
        return jsonify(get_champion_splits(db_path, champ, year=year))

    @app.route('/api/champion-patches')
    def api_champion_patches():
        champ = request.args.get('champion')
        year  = request.args.get('year',  type=int)
        split = request.args.get('split') or None
        if not champ:
            return jsonify([])
        return jsonify(
            get_champion_patches(
                db_path, champ, year=year, split=split
            )
        )

    @app.route('/api/patches')
    def api_patches():
        year  = request.args.get('year',  type=int)
        split = request.args.get('split') or None
        return jsonify(
            get_patches(db_path, year=year, split=split)
        )

    @app.route('/api/team-logos')
    def api_team_logos():
        return jsonify(fetch_team_logos())

    @app.route('/api/info')
    def api_info():
        return jsonify({
            'years': get_years(db_path),
            'league': LEAGUE,
            'folder_url': _FOLDER_URL.format(FOLDER_ID),
        })

    return app
