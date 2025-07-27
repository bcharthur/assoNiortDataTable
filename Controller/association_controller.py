# Controller/association_controller.py
from flask import Blueprint, render_template, jsonify, request
from Service.association_service import AssociationService

bp = Blueprint("home", __name__)
_service = AssociationService()


@bp.route("/")
def index():
    return render_template("home/index.html")


@bp.route("/api/assos")
def api_assos():
    refresh = request.args.get("refresh") == "1"
    data = [a.to_dict() for a in _service.get_all(refresh)]
    return jsonify(data)


@bp.route("/api/stats/category")
def api_stats():
    return jsonify(_service.stats_by_category())
