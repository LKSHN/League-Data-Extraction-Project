#
# File: data/teams.py
# Creator: LKSHN
# Created: Wed May 13 2026
# Description:
# Fetches team logo URLs from the lolesports API.
# The API key is read from the LOLESPORTS_API_KEY environment
# variable (set via .env at project root).
#

import os
import requests

_API  = 'https://esports-api.lolesports.com/persisted/gw'
_KEY  = os.environ.get('LOLESPORTS_API_KEY', '')  # loaded from .env by main.py
_HEAD = {'x-api-key': _KEY}

_cache = None


def _build_map(teams):
    mapping = {}
    for t in teams:
        url = t.get('image', '')
        if not url:
            continue
        if t.get('name'):
            mapping[t['name']] = url
        if t.get('code'):
            mapping[t['code']] = url
    return mapping


def fetch_team_logos():
    global _cache
    if _cache is not None:
        return _cache
    try:
        r = requests.get(
            f'{_API}/getTeams?hl=en-US',
            headers=_HEAD,
            timeout=10,
        )
        teams = r.json().get('data', {}).get('teams', [])
        _cache = _build_map(teams)
    except Exception:
        _cache = {}
    return _cache
