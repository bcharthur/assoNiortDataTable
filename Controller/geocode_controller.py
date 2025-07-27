from flask import Blueprint, request, jsonify

geo_bp = Blueprint("geo", __name__, url_prefix="/api")

@geo_bp.route("/geocode")
def geocode():
    # import ici → évite le cycle
    from Service.geocoding_service import GeocodingService

    address = request.args.get("q")
    if not address:
        return jsonify({"error": "missing q"}), 400

    result = GeocodingService.geocode(address)
    if not result:
        return jsonify({"error": "not_found"}), 404

    return jsonify(result)
