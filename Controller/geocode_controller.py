# Controller/geocode_controller.py
from flask import Blueprint, request, jsonify, current_app, abort
from Service.geocoding_service import GeocodingService

geo_bp = Blueprint("geo", __name__, url_prefix="/api")

@geo_bp.route("/geocode")
def geocode():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify(error="missing q"), 400
    try:
        pos = GeocodingService.geocode(q)
    except Exception as e:
        current_app.logger.warning("geocode failed for %s: %s", q, e)
        return jsonify(error="service_unavailable"), 503
    if not pos:
        return jsonify(error="not_found"), 404
    return jsonify(pos), 200
