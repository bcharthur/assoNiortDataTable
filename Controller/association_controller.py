# Controller/association_controller.py
import re
from flask import Blueprint, render_template, jsonify, request, current_app, abort
from sqlalchemy import or_
from datetime import datetime

from Entity.association_entity import Association
from Service.association_service import AssociationService
from Service.geocoding_service import GeocodingService
from extensions import db

bp = Blueprint("home", __name__)
_service = AssociationService()

def _normalize_address(addr: str) -> str:
    if not addr:
        return ""
    s = addr.strip()

    # supprime préfixes peu utiles
    s = re.sub(r'^(Maison\s+des\s+Associations|M(aison)?\.*\s*des\s*Associations)\s*-\s*', '', s, flags=re.I)
    s = re.sub(r'^(Mairie(\s+Annexe)?|Chez\s+(M\.|Mme|Mlle)\s+[A-Za-zÀ-ÿ\'\-\s]+)\s*-\s*', '', s, flags=re.I)

    # enlève mentions postales
    s = re.sub(r'\bB\.?\s*P\.?\s*\d+\b', '', s, flags=re.I)         # BP 1234
    s = re.sub(r'\bC[ÉE]DEX\b', '', s, flags=re.I)                  # CEDEX / CÉDEX

    # remplace abréviations courantes
    rep = {
        r'\bav\.?\b': 'avenue',
        r'\bbd\.?\b': 'boulevard',
        r'\br\.?\b': 'rue',
        r'\bpl\.?\b': 'place',
    }
    for pat, repl in rep.items():
        s = re.sub(pat, repl, s, flags=re.I)

    # espaces/ponctuation propres
    s = re.sub(r'\s+', ' ', s)
    s = s.replace(' ,', ',').strip(', ').strip()

    up = s.upper()
    if 'NIORT' not in up:
        s += ' 79000 Niort'
    if 'FRANCE' not in up:
        s += ', France'
    return s

@bp.route("/")
def index():
    return render_template("home/index.html")

@bp.route("/api/assos")
def api_assos():
    refresh = request.args.get("refresh") == "1"
    cat, sub, site = (request.args.get(k) or None for k in ("cat","sub","site"))
    if cat or sub or site:
        assos = _service.get_filtered(cat, sub, site)
    else:
        assos = _service.get_all(refresh)
    return jsonify([a.to_dict() for a in assos])

@bp.route("/api/assos_geo", methods=["GET"])
def assos_with_coords():
    """
    Renvoie les associations avec lat/lon.
    Si aucun point n'est en base et que ?fill_if_empty=1, on géocode à la volée un petit lot
    (limit param) et on le renvoie (et on peut persister si ?persist=1).
    """
    try:
        limit = int(request.args.get("limit", 200))
    except Exception:
        limit = 200
    fill_if_empty = request.args.get("fill_if_empty", "0") in ("1", "true", "yes")
    persist       = request.args.get("persist", "0") in ("1", "true", "yes")

    # 1) D'abord on renvoie ce qu'on a déjà en base (lat/lon non NULL)
    rows = (
        db.session.query(
            Association.id,
            Association.title.label("title"),
            Association.address.label("address"),
            Association.website.label("website"),
            Association.lat.label("lat"),
            Association.lon.label("lon"),
        )
        .filter(Association.lat.isnot(None))
        .filter(Association.lon.isnot(None))
        .limit(limit)
        .all()
    )
    if rows:
        out = [
            {
                "id": r.id,
                "title": r.title,
                "address": r.address,
                "website": r.website,
                "lat": float(r.lat),
                "lon": float(r.lon),
            }
            for r in rows
            if r.lat is not None and r.lon is not None
        ]
        return jsonify(out)

    # 2) Sinon, si demandé, on géocode à la volée un petit lot
    if fill_if_empty:
        current_app.logger.info("[/api/assos_geo] Aucun point en base → géocodage à la volée (limit=%s, persist=%s)", limit, persist)
        # On prend des associations qui ont une adresse non vide
        todo = (
            db.session.query(Association)
            .filter(Association.address.isnot(None))
            .filter(Association.address != "")
            .limit(limit)
            .all()
        )
        out = []
        updated = 0
        for a in todo:
            addr = _normalize_address(a.address or "")
            if not addr:
                continue
            try:
                pos = GeocodingService.geocode(addr)
                if not pos:
                    continue
                lat = float(pos["lat"])
                lon = float(pos["lon"])
                out.append({
                    "id": a.id,
                    "title": a.title,
                    "address": a.address,
                    "website": a.website,
                    "lat": lat,
                    "lon": lon,
                })
                if persist:
                    a.lat = lat
                    a.lon = lon
                    a.geocoded_at = datetime.utcnow()
                    updated += 1
            except Exception as e:
                current_app.logger.warning("Geocode fail '%s' (%s): %s", a.title, addr, e)

        if persist and updated:
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                current_app.logger.error("Commit geocode persist failed: %s", e)

        return jsonify(out)

    # 3) Rien à renvoyer (pas de fallback demandé)
    return jsonify([])

@bp.route("/api/stats/category")
def api_stats():
    return jsonify(_service.stats_by_category())

@bp.get("/api/assos_geo_fill")
def assos_geo_fill():
    """
    Géocode en base N premières associations sans lat/lon et renvoie le bilan.
    Utilise GeocodingService, écrit lat/lon/geocoded_at en base.
    """
    try:
        limit = int(request.args.get("limit", 200))
    except Exception:
        limit = 200

    todo = (
        db.session.query(Association)
        .filter(Association.lat.is_(None), Association.lon.is_(None))
        .limit(limit)
        .all()
    )

    ok = 0
    ko = 0
    for a in todo:
        try:
            addr = _normalize_address(a.address or "")
            if not addr:
                raise ValueError("empty address")
            res = GeocodingService.geocode(addr)
            a.lat = float(res["lat"])
            a.lon = float(res["lon"])
            a.geocoded_at = datetime.utcnow()
            db.session.commit()
            ok += 1
        except Exception as e:
            db.session.rollback()
            ko += 1
            current_app.logger.warning("Geocode fail '%s': %s", a.address, e)

    remaining = (
        db.session.query(Association)
        .filter(Association.lat.is_(None))
        .count()
    )
    return jsonify({"updated": ok, "failed": ko, "remaining": remaining})
