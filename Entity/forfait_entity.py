# Entity/forfait_entity.py
from datetime import datetime
import json
from typing import Optional, Dict, Any, List
from extensions import db


class Forfait(db.Model):
    __tablename__ = "forfaits"

    id                  = db.Column(db.Integer, primary_key=True)
    name                = db.Column(db.String(64), unique=True, nullable=False)   # "Association" / "Particulier" / "Professionnel"
    audience            = db.Column(db.String(64), nullable=False)                # "associations" / "particuliers" / "professionnels"

    monthly_base_eur    = db.Column(db.Float, nullable=False, default=0.0)        # abonnement de base (€/mois)

    maintenance_included = db.Column(db.Boolean, nullable=False, default=True)
    hosting_included     = db.Column(db.Boolean, nullable=False, default=True)
    security_included    = db.Column(db.Boolean, nullable=False, default=True)

    site_creation_free   = db.Column(db.Boolean, nullable=False, default=False)   # création sur-mesure gratuite ?
    site_creation_note   = db.Column(db.String(255), nullable=True)               # ex: "payante selon l'existant"

    can_unlock_aid       = db.Column(db.Boolean, nullable=False, default=False)   # intermédiation aides ?
    ai_integration       = db.Column(db.Boolean, nullable=False, default=False)   # intégration IA possible ?

    # Règles d'évolution du prix mensuel selon le trafic (JSON texte pour compat DB)
    # Format par défaut :
    # {"tiers":[
    #   {"max_daily": 500,   "delta": 0},
    #   {"max_daily": 2000,  "delta": 20},
    #   {"max_daily": 10000, "delta": 50},
    #   {"max_daily": null,  "delta": 100}
    # ]}
    pricing_rules_json   = db.Column(db.Text, nullable=True)

    is_active           = db.Column(db.Boolean, nullable=False, default=True)
    updated_at          = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # -------- helpers --------
    def pricing_rules(self) -> Dict[str, Any]:
        if not self.pricing_rules_json:
            return {"tiers": []}
        try:
            return json.loads(self.pricing_rules_json)
        except Exception:
            return {"tiers": []}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "audience": self.audience,
            "monthly_base_eur": round(float(self.monthly_base_eur or 0.0), 2),

            "maintenance_included": bool(self.maintenance_included),
            "hosting_included":     bool(self.hosting_included),
            "security_included":    bool(self.security_included),

            "site_creation_free": bool(self.site_creation_free),
            "site_creation_note": self.site_creation_note or "",

            "can_unlock_aid": bool(self.can_unlock_aid),
            "ai_integration": bool(self.ai_integration),

            "pricing_rules": self.pricing_rules(),
            "is_active": bool(self.is_active),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
