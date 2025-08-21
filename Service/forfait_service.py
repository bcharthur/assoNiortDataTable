# Service/forfait_service.py
import json
from typing import Dict, Any, List, Optional
from Repository.forfait_repository import ForfaitRepository
from Entity.forfait_entity import Forfait


class ForfaitService:

    @staticmethod
    def seed_defaults() -> List[Forfait]:
        # Tiers par défaut (modulables ensuite)
        assoc_rules = {"tiers":[
            {"max_daily": 500,   "delta": 0},
            {"max_daily": 2000,  "delta": 20},
            {"max_daily": 10000, "delta": 50},
            {"max_daily": None,  "delta": 100},
        ]}
        part_rules = {"tiers":[
            {"max_daily": 500,   "delta": 0},
            {"max_daily": 2000,  "delta": 30},
            {"max_daily": 10000, "delta": 60},
            {"max_daily": None,  "delta": 120},
        ]}
        pro_rules = {"tiers":[
            {"max_daily": 500,   "delta": 0},
            {"max_daily": 2000,  "delta": 50},
            {"max_daily": 10000, "delta": 100},
            {"max_daily": None,  "delta": 200},
        ]}

        defaults = [
            {
                "name": "Association",
                "audience": "associations",
                "monthly_base_eur": 80.0,
                "maintenance_included": True,
                "hosting_included": True,
                "security_included": True,
                "site_creation_free": True,
                "site_creation_note": "Création sur-mesure GRATUITE",
                "can_unlock_aid": True,
                "ai_integration": False,
                "pricing_rules_json": json.dumps(assoc_rules, ensure_ascii=False),
                "is_active": True,
            },
            {
                "name": "Particulier",
                "audience": "particuliers",
                "monthly_base_eur": 100.0,
                "maintenance_included": True,
                "hosting_included": True,
                "security_included": True,
                "site_creation_free": False,
                "site_creation_note": "Création sur-mesure payante (selon l'existant)",
                "can_unlock_aid": False,
                "ai_integration": True,
                "pricing_rules_json": json.dumps(part_rules, ensure_ascii=False),
                "is_active": True,
            },
            {
                "name": "Professionnel",
                "audience": "professionnels",
                "monthly_base_eur": 200.0,
                "maintenance_included": True,
                "hosting_included": True,
                "security_included": True,
                "site_creation_free": False,
                "site_creation_note": "Création sur-mesure payante (selon l'existant)",
                "can_unlock_aid": False,
                "ai_integration": True,
                "pricing_rules_json": json.dumps(pro_rules, ensure_ascii=False),
                "is_active": True,
            },
        ]
        return ForfaitRepository.upsert_defaults(defaults)

    @staticmethod
    def compute_monthly_price(forfait: Forfait, daily_visitors: int) -> float:
        rules = forfait.pricing_rules().get("tiers", [])
        delta = 0.0
        for tier in rules:
            max_daily = tier.get("max_daily", None)
            if max_daily is None or daily_visitors <= max_daily:
                delta = float(tier.get("delta", 0.0))
                break
        return round(float(forfait.monthly_base_eur or 0.0) + delta, 2)

    @staticmethod
    def update_forfait(fid: int, payload: Dict[str, Any]) -> Optional[Forfait]:
        if "pricing_rules" in payload and isinstance(payload["pricing_rules"], dict):
            payload["pricing_rules_json"] = json.dumps(payload.pop("pricing_rules"), ensure_ascii=False)
        return ForfaitRepository.update(fid, payload)

    @staticmethod
    def create_forfait(payload: Dict[str, Any]) -> Forfait:
        # validation minimale
        name = (payload.get("name") or "").strip()
        audience = (payload.get("audience") or "").strip()
        if not name or not audience:
            raise ValueError("name et audience sont requis")
        if ForfaitRepository.exists_by_name(name):
            raise ValueError("Un forfait avec ce nom existe déjà")

        # sérialiser pricing_rules si dict fourni
        if "pricing_rules" in payload and isinstance(payload["pricing_rules"], dict):
            payload["pricing_rules_json"] = json.dumps(payload.pop("pricing_rules"), ensure_ascii=False)

        return ForfaitRepository.create(payload)

    @staticmethod
    def delete_forfait(fid: int) -> bool:
        return ForfaitRepository.delete(fid)