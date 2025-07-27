# Service/association_service.py
from sqlalchemy import or_
from Entity.association_entity import Association
from extensions import db
import pandas as pd
from Repository.association_repository import AssociationRepository


class AssociationService:
    def __init__(self):
        self.repo = AssociationRepository()

    # ­───────── données ─────────
    def get_all(self, refresh: bool = False):
        return self.repo.ensure_populated(force=refresh)

    def get_filtered(self, cat=None, sub=None, site=None):
        """Filtre directement en SQL ; renvoie une liste d’objets."""
        qry = db.session.query(Association)

        if cat:
            qry = qry.filter(Association.category == cat)

        if sub:
            qry = qry.filter(Association.sub_category == sub)

        if site == "with":
            qry = qry.filter(Association.website != "")
        elif site == "without":
            qry = qry.filter(or_(Association.website == "", Association.website == None))  # noqa

        return qry.all()

    # ­───────── stats ─────────
    def stats_by_category(self):
        data = [a.to_dict() for a in self.repo.ensure_populated()]
        if not data:
            return {}
        df = pd.DataFrame(data)
        return df["category"].value_counts().to_dict()
