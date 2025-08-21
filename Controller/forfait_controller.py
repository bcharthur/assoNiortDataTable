# Controller/forfait_controller.py
import json
from typing import Any, Dict
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash, abort
from Repository.forfait_repository import ForfaitRepository
from Service.forfait_service import ForfaitService

forfait_bp = Blueprint("forfait", __name__, url_prefix="/forfait")


@forfait_bp.route("/", methods=["GET"])
def index():
    forfaits = ForfaitRepository.get_all()
    return render_template("forfait/index.html", forfaits=forfaits)


@forfait_bp.route("/seed", methods=["POST"])
def seed_defaults():
    ForfaitService.seed_defaults()
    flash("Forfaits par défaut créés/mis à jour.", "success")
    return redirect(url_for("forfait.index"))


# ---------- Modales (fragments HTML) ----------

@forfait_bp.get("/modal/add")
def modal_add():
    return render_template("forfait/fragments/add.html")

@forfait_bp.get("/modal/<int:fid>/edit")
def modal_edit(fid: int):
    f = ForfaitRepository.get_by_id(fid)
    if not f:
        abort(404)
    return render_template("forfait/fragments/edit.html", f=f)

@forfait_bp.get("/modal/<int:fid>/delete")
def modal_delete(fid: int):
    f = ForfaitRepository.get_by_id(fid)
    if not f:
        abort(404)
    return render_template("forfait/fragments/delete.html", f=f)


# ---------- Formulaires (POST) ----------

@forfait_bp.post("/create")
def create_form():
    try:
        data: Dict[str, Any] = {
            "name": (request.form.get("name") or "").strip(),
            "audience": (request.form.get("audience") or "").strip(),
            "monthly_base_eur": float(request.form.get("monthly_base_eur") or 0.0),
            "maintenance_included": bool(request.form.get("maintenance_included")),
            "hosting_included": bool(request.form.get("hosting_included")),
            "security_included": bool(request.form.get("security_included")),
            "site_creation_free": bool(request.form.get("site_creation_free")),
            "site_creation_note": request.form.get("site_creation_note") or "",
            "can_unlock_aid": bool(request.form.get("can_unlock_aid")),
            "ai_integration": bool(request.form.get("ai_integration")),
            "is_active": bool(request.form.get("is_active")),
        }
        rules_text = request.form.get("pricing_rules_json") or ""
        if rules_text.strip():
            json.loads(rules_text)  # valid
            data["pricing_rules_json"] = rules_text

        ForfaitService.create_forfait(data)
        flash("Forfait créé.", "success")
    except ValueError as ve:
        flash(str(ve), "danger")
    except Exception as e:
        flash(f"Erreur création: {e}", "danger")

    return redirect(url_for("forfait.index"))


@forfait_bp.post("/<int:fid>/update")
def update_form(fid: int):
    data: Dict[str, Any] = {
        "monthly_base_eur": float(request.form.get("monthly_base_eur") or 0.0),
        "maintenance_included": bool(request.form.get("maintenance_included")),
        "hosting_included": bool(request.form.get("hosting_included")),
        "security_included": bool(request.form.get("security_included")),
        "site_creation_free": bool(request.form.get("site_creation_free")),
        "site_creation_note": request.form.get("site_creation_note") or "",
        "can_unlock_aid": bool(request.form.get("can_unlock_aid")),
        "ai_integration": bool(request.form.get("ai_integration")),
        "is_active": bool(request.form.get("is_active")),
    }
    rules_text = request.form.get("pricing_rules_json") or ""
    if rules_text.strip():
        try:
            json.loads(rules_text)
            data["pricing_rules_json"] = rules_text
        except Exception:
            flash("Le JSON des règles de tarification est invalide.", "danger")
            return redirect(url_for("forfait.index"))

    f = ForfaitService.update_forfait(fid, data)
    if not f:
        flash("Forfait introuvable.", "danger")
    else:
        flash("Forfait mis à jour.", "success")
    return redirect(url_for("forfait.index"))


@forfait_bp.post("/<int:fid>/delete")
def delete_form(fid: int):
    ok = ForfaitService.delete_forfait(fid)
    flash("Forfait supprimé." if ok else "Forfait introuvable.", "success" if ok else "danger")
    return redirect(url_for("forfait.index"))


# ---------- API JSON (inchangé / optionnel) ----------

@forfait_bp.get("/api")
def api_list():
    return jsonify([f.to_dict() for f in ForfaitRepository.get_all()])

@forfait_bp.post("/api/seed")
def api_seed():
    forfaits = ForfaitService.seed_defaults()
    return jsonify([f.to_dict() for f in forfaits]), 201

@forfait_bp.patch("/api/<int:fid>")
def api_update(fid: int):
    payload = request.get_json(silent=True) or {}
    f = ForfaitService.update_forfait(fid, payload)
    if not f:
        return jsonify({"error": "not_found"}), 404
    return jsonify(f.to_dict())

@forfait_bp.get("/api/price")
def api_price():
    fid = int(request.args.get("forfait_id", "0") or "0")
    daily = int(request.args.get("daily_visitors", "0") or "0")
    f = ForfaitRepository.get_by_id(fid)
    if not f:
        return jsonify({"error": "not_found"}), 404
    price = ForfaitService.compute_monthly_price(f, daily)
    return jsonify({"forfait_id": f.id, "name": f.name, "daily_visitors": daily, "monthly_price_eur": price})
