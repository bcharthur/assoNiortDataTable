# Repository/forfait_repository.py
import json
from typing import List, Optional, Dict, Any
from extensions import db
from Entity.forfait_entity import Forfait


class ForfaitRepository:

    @staticmethod
    def get_all(active_only: bool = False) -> List[Forfait]:
        q = Forfait.query
        if active_only:
            q = q.filter(Forfait.is_active.is_(True))
        return q.order_by(Forfait.id.asc()).all()

    @staticmethod
    def get_by_id(fid: int) -> Optional[Forfait]:
        return Forfait.query.get(fid)

    @staticmethod
    def get_by_name(name: str) -> Optional[Forfait]:
        return Forfait.query.filter(Forfait.name == name).first()

    @staticmethod
    def exists_by_name(name: str) -> bool:
        return Forfait.query.filter(Forfait.name == name).first() is not None

    @staticmethod
    def create(data: Dict[str, Any]) -> Forfait:
        f = Forfait(**data)
        db.session.add(f)
        db.session.commit()
        return f

    @staticmethod
    def update(fid: int, data: Dict[str, Any]) -> Optional[Forfait]:
        f = ForfaitRepository.get_by_id(fid)
        if not f:
            return None
        for k, v in data.items():
            if hasattr(f, k):
                setattr(f, k, v)
        db.session.commit()
        return f

    @staticmethod
    def delete(fid: int) -> bool:
        f = ForfaitRepository.get_by_id(fid)
        if not f:
            return False
        db.session.delete(f)
        db.session.commit()
        return True

    @staticmethod
    def upsert_defaults(defaults: List[Dict[str, Any]]) -> List[Forfait]:
        out = []
        for d in defaults:
            f = ForfaitRepository.get_by_name(d["name"])
            if f:
                to_update = {**d}
                if f.pricing_rules_json and d.get("pricing_rules_json"):
                    to_update.pop("pricing_rules_json", None)
                ForfaitRepository.update(f.id, to_update)
            else:
                f = ForfaitRepository.create(d)
            out.append(f)
        return out
