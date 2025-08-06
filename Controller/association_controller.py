# Controller/association_controller.py
from flask import Blueprint, render_template, jsonify, request

# from Repository.docker_repository import get_hardware_info_remote
from Service.association_service import AssociationService

bp = Blueprint("home", __name__)
_service = AssociationService()


@bp.route("/")
def index():
    # hwinfo = get_hardware_info_remote()      # retourne un objet/dict
    return render_template("home/index.html"
                           # , hwinfo=hwinfo
                           )


@bp.route("/api/assos")
def api_assos():
    """Retourne les assos (filtrées ou non)."""
    refresh = request.args.get("refresh") == "1"

    # paramètres de filtre  
    cat  = request.args.get("cat") or None
    sub  = request.args.get("sub") or None
    site = request.args.get("site") or None   # '', 'with', 'without'

    if cat or sub or site:
        assos = _service.get_filtered(cat, sub, site)
    else:
        assos = _service.get_all(refresh)

    return jsonify([a.to_dict() for a in assos])


@bp.route("/api/stats/category")
def api_stats():
    return jsonify(_service.stats_by_category())
