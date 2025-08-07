# Controller/association_controller.py
from flask import Blueprint, render_template, jsonify, request, current_app
from Service.association_service import AssociationService
from Service.geocoding_service import GeocodingService
bp = Blueprint("home", __name__)
_service = AssociationService()

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

@bp.route("/api/stats/category")
def api_stats():
    return jsonify(_service.stats_by_category())
