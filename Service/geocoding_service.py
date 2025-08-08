# Service/geocoding_service.py
import time
import requests
from collections import deque
from flask import abort
from app import db
from Entity.geocode_cache import GeocodeCache
from sqlalchemy.exc import IntegrityError


class GeocodingService:
    NOMINATIM = "https://nominatim.openstreetmap.org/search"
    UA = {"User-Agent": "asso-niort-demo/1.0 (https://github.com/...)"}

    # --- nouveau : mémorise les 10 derniers appels (timestamps) -----------
    _last_calls = deque(maxlen=10)   # garde au plus 10 timestamps

    @classmethod
    def _respect_rate_limit(cls):
        """Ne pas dépasser 10 requêtes externes par seconde."""
        if len(cls._last_calls) < cls._last_calls.maxlen:
            return  # on est encore sous le seuil

        now = time.time()
        earliest = cls._last_calls[0]
        elapsed = now - earliest
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)  # on attend le temps nécessaire

    # ----------------------------------------------------------------------

    @classmethod
    def geocode(cls, address: str):
        """Retourne {'lat':..., 'lon':...} ou None."""
        if not address:
            return None

        # 1) cache DB
        cached = GeocodeCache.query.filter_by(address=address).first()
        if cached:
            return {"lat": cached.lat, "lon": cached.lon}

        # 2) appel externe – on applique la règle des 10 / s
        cls._respect_rate_limit()

        try:
            params = {"q": address, "format": "json", "limit": 1}
            resp = requests.get(
                cls.NOMINATIM, params=params, headers=cls.UA, timeout=10
            )

            cls._last_calls.append(time.time())  # on mémorise l'appel

            if resp.status_code == 429:          # rate‑limit Nominatim
                abort(429)
            resp.raise_for_status()

            data = resp.json()
            if not data:  # adresse non trouvée
                abort(404)

            lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
        except requests.RequestException:
            abort(503)

        # 3) on enregistre le nouveau point en base
        entry = GeocodeCache(address=address, lat=lat, lon=lon)
        db.session.add(entry)
        db.session.commit()

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()

        return {"lat": lat, "lon": lon}
