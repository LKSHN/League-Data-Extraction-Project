#
# File: data/teams.py
# Creator: LKSHN
# Created: Wed May 13 2026
# Description:
# Fetches team/league logo URLs from the lolesports API.
# The API key is read from the LOLESPORTS_API_KEY environment variable
# (set via .env at project root) if present. Otherwise falls back to
# the public key lolesports.com itself ships to every visitor's
# browser — it's not a secret, just an access token for their public
# read-only esports data, so this keeps logos working without forcing
# everyone to register for their own key.
#

import os
import requests

_API        = 'https://esports-api.lolesports.com/persisted/gw'
_PUBLIC_KEY = '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z'
_KEY        = os.environ.get('LOLESPORTS_API_KEY') or _PUBLIC_KEY
_HEAD       = {'x-api-key': _KEY}

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


_league_cache = None


def _build_league_map(leagues):
    """Map both name and slug (uppercased) to the league's logo image.

    Oracle's Elixir league codes (e.g. 'LEC', 'LFL') match either the
    lolesports league name or its slug depending on the league, so both
    are indexed to maximise hits.
    """
    mapping = {}
    for l in leagues:
        url = l.get('image', '')
        if not url:
            continue
        name = (l.get('name') or '').strip().upper()
        slug = (l.get('slug') or '').strip().upper()
        if name and name not in mapping:
            mapping[name] = url
        if slug and slug not in mapping:
            mapping[slug] = url
    return mapping


def fetch_league_logos():
    global _league_cache
    if _league_cache is not None:
        return _league_cache
    try:
        r = requests.get(
            f'{_API}/getLeagues?hl=en-US',
            headers=_HEAD,
            timeout=10,
        )
        leagues = r.json().get('data', {}).get('leagues', [])
        _league_cache = _build_league_map(leagues)
    except Exception:
        _league_cache = {}
    return _league_cache
