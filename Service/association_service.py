# Service/association_service.py
import pandas as pd

from Repository.association_repository import AssociationRepository

class AssociationService:
    def __init__(self):
        self.repo = AssociationRepository()

    # ---------------------------
    # Data access
    # ---------------------------
    def get_all(self, refresh: bool = False):
        return self.repo.ensure_populated(force=refresh)

    # ---------------------------
    # Stats
    # ---------------------------
    def stats_by_category(self):
        data = [a.to_dict() for a in self.repo.ensure_populated()]
        if not data:
            return {}

        df = pd.DataFrame(data)
        return df["category"].value_counts().to_dict()
