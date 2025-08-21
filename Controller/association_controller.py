# Controller/association_controller.py
import re
from flask import Blueprint, render_template, jsonify, request, current_app
from sqlalchemy import or_
from datetime import datetime

from Entity.association_entity import Association
from Service.association_service import AssociationService
from Service.geocoding_service import GeocodingService
from extensions import db

bp = Blueprint("home", __name__)
_service = AssociationService()

def _normalize_address(addr: str) -> str:
    """Nettoie les libellés 'Maison des Associations - ...' et sécurise la localité."""
    if not addr:
        return ""
    s = addr.strip()

    # Supprime le préfixe peu utile pour la géoloc
    s = re.sub(r'^Maison des Associations\s*-\s*', '', s, flags=re.I)

    # Espaces/virgules propres
    s = re.sub(r'\s+', ' ', s)
    s = s.replace(' ,', ',')

    # Assure la ville/pays (si jamais absents)
    if 'NIORT' not in s.upper():
        s += ' 79000 Niort'
    if 'FRANCE' not in s.upper():
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
    Renvoie UNIQUEMENT les associations qui ont déjà lat/lon,
    sans tenter de géocoder. On inclut 'website' pour colorer les pins.
    """
    rows = (
        db.session.query(
            Association.title.label("title"),
            Association.address.label("address"),
            Association.website.label("website"),
            Association.lat.label("lat"),
            Association.lon.label("lon"),
        )
        .filter(Association.lat.isnot(None))
        .filter(Association.lon.isnot(None))
        .all()
    )
    return jsonify([
        {
            "title": r.title,
            "address": r.address,
            "website": r.website,
            "lat": r.lat,
            "lon": r.lon,
        }
        for r in rows
    ])


@bp.route("/api/stats/category")
def api_stats():
    return jsonify(_service.stats_by_category())

@bp.get("/api/assos_geo_fill")
def assos_geo_fill():
    """Géocode en base N premières associations sans lat/lon et renvoie le bilan."""
    limit = int(request.args.get("limit", 200))
    todo = (db.session.query(Association)
            .filter(Association.lat.is_(None), Association.lon.is_(None))
            .limit(limit).all())
    ok = 0; ko = 0
    for a in todo:
        try:
            res = GeocodingService.geocode(a.address)
            a.lat = res["lat"]; a.lon = res["lon"]; a.geocoded_at = datetime.utcnow()
            db.session.commit(); ok += 1
        except Exception as e:
            db.session.rollback(); ko += 1
            current_app.logger.warning("Geocode fail '%s': %s", a.address, e)
    return jsonify({"updated": ok, "failed": ko, "remaining": Association.query.filter(Association.lat.is_(None)).count()})