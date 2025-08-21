# Controller/deal_controller.py
from flask import Blueprint, jsonify, request, abort
from sqlalchemy.orm import joinedload
from datetime import datetime

from extensions import db
from Entity.deal_entity import Deal, DealStageHistory
from Entity.association_entity import Association

deals_bp = Blueprint("deals_api", __name__, url_prefix="/api/deals")

ALLOWED_STAGES = {
    "CONTACTED",
    "RESPONSE_POSITIVE",
    "MEETING_SCHEDULED",
    "MEETING_DONE_POSITIVE",
    "MOCKUP_DONE",
    "QUOTE_SENT",
    "WON",
    "LOST",
    # supplémentaires si tu en crées :
    "RESPONSE_NEGATIVE",
    "QUOTE_ACCEPTED",
    "QUOTE_REJECTED",
}

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _now():
    return datetime.utcnow()

def _ensure_association(assoc_id):
    """Renvoie l'Association par id, ou None si assoc_id est None/''."""
    if assoc_id in (None, "", "null"):
        return None
    try:
        assoc_id_int = int(assoc_id)
    except Exception:
        abort(400, description="association_id must be integer or null")
    assoc = Association.query.get(assoc_id_int)
    if not assoc:
        abort(404, description="association not found")
    return assoc

def _add_stage_history(deal: Deal, from_stage: str, to_stage: str, changed_by: str = None, comment: str = None):
    hist = DealStageHistory(
        deal_id=deal.id,
        from_stage=(from_stage or None),
        to_stage=to_stage,
        changed_by=(changed_by or None),
        comment=(comment or None),
        changed_at=_now(),
    )
    db.session.add(hist)

# ─────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────

@deals_bp.route("/", methods=["GET"])
def list_deals():
    q = (db.session.query(Deal, Association.title.label("association_title"))
         .outerjoin(Association, Deal.association_id == Association.id)
         .order_by(Deal.updated_at.desc()))
    rows = q.all()
    out = []
    for d, assoc_title in rows:
        out.append({
            "id": d.id,
            "title": d.title,
            "owner": d.owner,
            "stage": d.stage,
            "association_id": d.association_id,
            "association_title": assoc_title,
            "notes": d.notes,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        })
    return jsonify(out)

@deals_bp.route("/", methods=["POST"])
def create_deal():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    assoc_id = data.get("association_id")
    owner = (data.get("owner") or "").strip()
    stage = (data.get("stage") or "CONTACTED").strip().upper()
    notes = (data.get("notes") or "").strip()

    if not title:
        abort(400, description="title is required")
    if stage not in ALLOWED_STAGES:
        abort(400, description="invalid stage")

    assoc = _ensure_association(assoc_id)

    d = Deal(
        title=title,
        association_id=(assoc.id if assoc else None),
        owner=owner or None,
        stage=stage,
        notes=notes or None,
        created_at=_now(),
        updated_at=_now(),
    )
    db.session.add(d)
    db.session.flush()  # pour avoir d.id

    _add_stage_history(d, from_stage=None, to_stage=stage, changed_by=owner or None, comment="created")
    db.session.commit()

    return jsonify({"ok": True, "id": d.id}), 201

@deals_bp.route("/<int:deal_id>/stage", methods=["PATCH"])
def patch_stage(deal_id):
    data = request.get_json(silent=True) or {}
    to_stage = (data.get("to_stage") or "").strip().upper()
    changed_by = (data.get("changed_by") or "").strip()
    comment = (data.get("comment") or "").strip()

    if to_stage not in ALLOWED_STAGES:
        abort(400, description="Invalid stage")

    deal = Deal.query.get_or_404(deal_id)
    from_stage = (deal.stage or "").upper()
    if from_stage == to_stage:
        return jsonify({"ok": True, "unchanged": True, "id": deal.id, "stage": deal.stage})

    deal.stage = to_stage
    deal.updated_at = _now()
    db.session.add(deal)

    _add_stage_history(deal, from_stage=from_stage, to_stage=to_stage, changed_by=changed_by or None, comment=comment or None)
    db.session.commit()

    return jsonify({"ok": True, "id": deal.id, "stage": deal.stage})

# ─────────────────────────────────────────────────────────────
# PATCH association uniquement (utilisé par le bouton "unlink")
# ─────────────────────────────────────────────────────────────
@deals_bp.route("/<int:deal_id>/association", methods=["PATCH"])
def patch_association(deal_id):
    data = request.get_json(silent=True) or {}
    assoc_id = data.get("association_id", None)

    deal = Deal.query.get_or_404(deal_id)
    old_assoc_id = deal.association_id

    assoc = _ensure_association(assoc_id)  # None si null / '', sinon Association
    deal.association_id = assoc.id if assoc else None
    deal.updated_at = _now()
    db.session.add(deal)

    # On journalise dans l'historique de stage (même stage, commentaire)
    _add_stage_history(
        deal,
        from_stage=(deal.stage or None),
        to_stage=(deal.stage or None),
        changed_by=None,
        comment=f"association changed: {old_assoc_id} -> {deal.association_id}"
    )

    db.session.commit()
    return jsonify({"ok": True, "id": deal.id, "association_id": deal.association_id})

# ─────────────────────────────────────────────────────────────
# PATCH générique (title, owner, notes, association_id, et/ou stage)
# ─────────────────────────────────────────────────────────────
@deals_bp.route("/<int:deal_id>", methods=["PATCH"])
def patch_deal(deal_id):
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        abort(400, description="JSON object expected")

    deal = Deal.query.get_or_404(deal_id)

    # title / owner / notes
    if "title" in data:
        deal.title = (data.get("title") or "").strip() or None
    if "owner" in data:
        deal.owner = (data.get("owner") or "").strip() or None
    if "notes" in data:
        deal.notes = (data.get("notes") or "").strip() or None

    # association_id
    if "association_id" in data:
        assoc = _ensure_association(data.get("association_id"))
        old_assoc_id = deal.association_id
        deal.association_id = assoc.id if assoc else None
        # on loggue le changement d'association dans l'historique via un "comment"
        _add_stage_history(
            deal,
            from_stage=(deal.stage or None),
            to_stage=(deal.stage or None),
            changed_by=None,
            comment=f"association changed: {old_assoc_id} -> {deal.association_id}"
        )

    # stage (optionnel) — si présent, on historise correctement
    if "stage" in data and data.get("stage"):
        to_stage = str(data.get("stage")).strip().upper()
        if to_stage not in ALLOWED_STAGES:
            abort(400, description="Invalid stage")
        from_stage = (deal.stage or "").upper()
        if from_stage != to_stage:
            deal.stage = to_stage
            _add_stage_history(
                deal,
                from_stage=from_stage,
                to_stage=to_stage,
                changed_by=(data.get("changed_by") or None),
                comment=(data.get("comment") or None)
            )

    deal.updated_at = _now()
    db.session.add(deal)
    db.session.commit()

    return jsonify({
        "ok": True,
        "id": deal.id,
        "title": deal.title,
        "owner": deal.owner,
        "notes": deal.notes,
        "stage": deal.stage,
        "association_id": deal.association_id,
    })
