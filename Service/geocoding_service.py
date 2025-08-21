# Service/geocoding_service.py
import re, time, math, requests
from flask import abort, current_app
from app import db
from Entity.geocode_cache import GeocodeCache

class GeocodingService:
    NOMINATIM = "https://nominatim.openstreetmap.org/search"
    UA = {"User-Agent": "asso-niort-demo/1.0 (https://github.com/...)"}

    # Référence géographique Niort
    NIORT_LAT = 46.325
    NIORT_LON = -0.455
    MAX_KM_FROM_NIORT = 45.0
    # viewbox = "lonW,latN,lonE,latS" (Niort et proches)
    VIEWBOX_NIORT = "-0.80,46.55,-0.20,46.10"

    _last_call_ts = 0.0  # 1 req/s (polite)

    # ─────────────────────────────────────────────────────────────
    # 1) Alias → adresses canoniques NIORT   (regex -> "adresse")
    # ─────────────────────────────────────────────────────────────
    ALIASES_ADDR = (
        (r"(?i)\b(mda|mad|maison\s+des\s+associations|niort\s*associations)\b",
         "12 rue Joseph Cugnot, 79000 Niort, France"),
        (r"(?i)\bmaison\s+des\s+syndicats\b",
         "8 rue Joseph Cugnot, 79000 Niort, France"),
        (r"(?i)\bgare\s*sncf\b",
         "Place Pierre Sémard, 79000 Niort, France"),
        (r"(?i)\b(centre|espace)\s+du?guesclin\b",
         "Place Chanzy, 79000 Niort, France"),
        (r"(?i)\bcsc\s*(grand\s*nord)?\b",
         "63 rue de Cholette, 79000 Niort, France"),
        (r"(?i)\bcsc\s*(ste|sainte)\s*pe?zenne\b",
         "4 rue du Coteau Saint-Hubert, 79000 Niort, France"),
        (r"(?i)\b(hopital|hôpital|centre\s+hospitalier)\b",
         "40 avenue Charles de Gaulle, 79000 Niort, France"),
        (r"(?i)\bpatinoire\b",
         "103 avenue de la Venise Verte, 79000 Niort, France"),
        (r"(?i)\bmaison\s+du\s+sport\b",
         "28 rue de la Blauderie, 79000 Niort, France"),
        (r"(?i)\ba[ée]rodrome\s+de\s+souch[ée]\b",
         "578 avenue de Limoges, 79000 Niort, France"),
        (r"(?i)\bespace\s+culturel\s+leclerc\b|\bculturel\s+leclerc\b",
         "37 rue Jean Couzinet, 79000 Niort, France"),
        (r"(?i)\bpiscine\s+(de\s+)?pr[ée]\s*leroy\b",
         "82 rue de Bessac, 79000 Niort, France"),
        (r"(?i)\bmaison\s+du\s+combattant\b.*\b95\s*rue\s+des\s+[eé]quarts\b",
         "95 rue des Équarts, 79000 Niort, France"),
        (r"(?i)\bzi\s*sa?int\s*florent\b.*\b200\s*rue\s+jean\s+jaur[eè]s\b",
         "200 rue Jean Jaurès, 79000 Niort, France"),
    )

    # ─────────────────────────────────────────────────────────────
    # 2) Alias → coordonnées directes   (regex -> lat, lon)
    # ─────────────────────────────────────────────────────────────
    ALIASES_COORDS = (
        (r"(?i)\bpavillon\s+de\s+l['’]eau\b",                 46.32612, -0.46352),  # Pré-Leroy
        (r"(?i)\bbase\s+nautique\s+(de\s+)?noron\b",          46.33475, -0.47654),
        (r"(?i)\bhippodrome\s+de\s+romagn[ée]\b",             46.33155, -0.46990),
        (r"(?i)\bsalle\s+omnisports?\b.*\b8\s*rue\s+barra\b", 46.32738, -0.45063),
        (r"(?i)\bpr[ée]\s*leroy\b",                           46.32700, -0.46350),
    )

    # ─────────────────────────────────────────────────────────────
    # Utils
    # ─────────────────────────────────────────────────────────────
    @classmethod
    def _rate_limit(cls):
        now = time.time()
        if now - cls._last_call_ts < 1.0:
            time.sleep(1.0 - (now - cls._last_call_ts))
        cls._last_call_ts = time.time()

    @staticmethod
    def _haversine_km(lat1, lon1, lat2, lon2):
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat/2)**2 +
             math.cos(math.radians(lat1))*math.cos(math.radians(lat2)) *
             math.sin(dlon/2)**2)
        return 2 * R * math.asin(math.sqrt(a))

    @classmethod
    def _near_niort(cls, lat, lon) -> bool:
        return cls._haversine_km(lat, lon, cls.NIORT_LAT, cls.NIORT_LON) <= cls.MAX_KM_FROM_NIORT

    @staticmethod
    def _mentions_niort(addr: str) -> bool:
        """True si la chaîne contient 'niort' ou un CP 79xxx."""
        if not addr:
            return False
        a = addr.lower()
        if "niort" in a:
            return True
        return re.search(r"\b79\d{3}\b", a) is not None

    @staticmethod
    def _normalize_addr(addr: str) -> str:
        if not addr:
            return ""
        a = addr.strip()
        # guillemets/traits typographiques → ascii
        a = (a.replace("–","-").replace("—","-")
               .replace("’","'").replace("‒","-"))
        # Préfixes “chez … – …”
        a = re.sub(r"(?i)^\s*(chez|niort\s*associations)\b[^,–-]*[-–]\s*", "", a)

        # Typos fréquentes
        a = re.sub(r"(?i)\bpicavia\b", "Picabia", a)
        a = re.sub(r"(?i)\bjoseh\b", "Joseph", a)

        # BP / CEDEX / CS (tout jeter)
        a = re.sub(r"(?i)\bB\.?P\.?\s*\d+\b", "", a)
        a = re.sub(r"(?i)\bC[ÉE]DEX\b.*", "", a)
        a = re.sub(r"(?i)\bCS\s*\d+\b", "", a)

        # Abréviations courantes
        a = re.sub(r"(?i)\bav[\.]?\b", "avenue", a)
        a = re.sub(r"(?i)\bbd[\.]?\b", "boulevard", a)
        a = re.sub(r"(?i)\bpl[\.]?\b", "place", a)
        a = re.sub(r"(?i)\bst[\.]?\b", "saint", a)
        a = re.sub(r"(?i)\bste[\.]?\b", "sainte", a)

        # Nettoyage
        a = re.sub(r"\s{2,}", " ", a).strip(", -")
        return a

    @classmethod
    def _apply_aliases(cls, norm: str):
        # Coordonnées directes ?
        for pat, lat, lon in cls.ALIASES_COORDS:
            if re.search(pat, norm):
                return {"coords": (lat, lon)}
        # Adresses canoniques ?
        for pat, repl in cls.ALIASES_ADDR:
            if re.search(pat, norm):
                return {"address": repl}
        return {}

    @classmethod
    def _nomi(cls, params: dict):
        cls._rate_limit()
        r = requests.get(cls.NOMINATIM, params=params, headers=cls.UA, timeout=10)
        if r.status_code == 429:
            abort(429)
        r.raise_for_status()
        js = r.json()
        return js[0] if js else None

    @classmethod
    def _cache_and_return(cls, address: str, lat: float, lon: float):
        db.session.add(GeocodeCache(address=address, lat=lat, lon=lon))
        db.session.commit()
        return {"lat": lat, "lon": lon}

    # ─────────────────────────────────────────────────────────────
    # Public
    # ─────────────────────────────────────────────────────────────
    @classmethod
    def geocode(cls, address: str):
        if not address:
            abort(400)

        # Cache
        cached = GeocodeCache.query.filter_by(address=address).first()
        if cached:
            if cls._near_niort(cached.lat, cached.lon) or cls._mentions_niort(address):
                return {"lat": cached.lat, "lon": cached.lon}
            # sinon purge si vraiment hors zone et sans mention Niort
            db.session.delete(cached)
            db.session.commit()

        norm = cls._normalize_addr(address)

        # 1) Aliases (coords directes ou adresse canonique)
        alias = cls._apply_aliases(norm)
        if "coords" in alias:
            lat, lon = alias["coords"]
            return cls._cache_and_return(address, lat, lon)
        if "address" in alias:
            pA = {
                "q": alias["address"],
                "format": "json",
                "limit": 1,
                "countrycodes": "fr",
                "viewbox": cls.VIEWBOX_NIORT,
                "bounded": 1,
            }
            rA = cls._nomi(pA)
            if rA:
                lat, lon = float(rA["lat"]), float(rA["lon"])
                if cls._near_niort(lat, lon) or cls._mentions_niort(address):
                    return cls._cache_and_return(address, lat, lon)
                current_app.logger.warning(
                    "Geocode rejected (outside Niort): %s -> %.5f,%.5f", address, lat, lon
                )
                abort(404)

        # 2) Recherche structurée (city forcée = Niort)
        street = norm
        street = re.sub(r"(?i)\b79\s?000\b", "", street)
        street = re.sub(r"(?i)\bNiort\b", "", street)
        street = re.sub(r"(?i)\bFrance\b", "", street)
        street = re.sub(r"\s{2,}", " ", street).strip(", -")

        p1 = {
            "street": street,
            "city": "Niort",
            "county": "Deux-Sèvres",
            "state": "Nouvelle-Aquitaine",
            "postalcode": "79000",
            "country": "France",
            "countrycodes": "fr",
            "format": "json",
            "limit": 1,
        }
        r1 = cls._nomi(p1)
        if r1:
            lat, lon = float(r1["lat"]), float(r1["lon"])
            if cls._near_niort(lat, lon) or cls._mentions_niort(address):
                return cls._cache_and_return(address, lat, lon)
            current_app.logger.warning(
                "Geocode rejected (outside Niort): %s -> %.5f,%.5f", address, lat, lon
            )
            abort(404)

        # 3) Fallback : texte libre + viewbox Niort (borne)
        p2 = {
            "q": f"{street}, 79000 Niort, France",
            "format": "json",
            "limit": 1,
            "countrycodes": "fr",
            "viewbox": cls.VIEWBOX_NIORT,
            "bounded": 1,
        }
        r2 = cls._nomi(p2)
        if r2:
            lat, lon = float(r2["lat"]), float(r2["lon"])
            if cls._near_niort(lat, lon) or cls._mentions_niort(address):
                return cls._cache_and_return(address, lat, lon)
            # current_app.logger.warning(
            #     "Geocode rejected (outside Niort): %s -> %.5f,%.5f", address, lat, lon
            # )
            abort(404)

        # current_app.logger.warning("Geocode not found: %s", address)
        abort(404)
