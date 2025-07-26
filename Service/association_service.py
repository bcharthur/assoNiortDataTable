from Repository.association_repository import AssociationRepository
import pandas as pd

class AssociationService:
    repo = AssociationRepository()

    def get_all(self, refresh=False):
        return self.repo.fetch_all(force=refresh)

    def stats_by_category(self):
        df = pd.DataFrame([a.to_dict() for a in self.repo.fetch_all()])
        if df.empty or "category" not in df.columns:
            return {}
        return df["category"].value_counts().to_dict()

