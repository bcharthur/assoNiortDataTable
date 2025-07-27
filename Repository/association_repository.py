# Repository/association_repository.py
"""
Récupère (scraping) la liste des associations, remplit/MAJ la base,
puis sert d’accès aux données.
"""
import unicodedata
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from flask import current_app
from sqlalchemy import func, delete

from Entity.association_entity import Association
from extensions import db

URL   = "https://niort-associations.fr/index.php?action=Assos"

# Correspondance labels → champs
LABEL_MAP = {
    "Titre":            "title",
    "Catégorie":        "category",
    "Sous-Catégorie":   "sub_category",
    "Site internet":    "website",
    "Responsable":      "manager",
    "Contact":          "contact",
    "Telephone":        "phone",
    "Portable":         "mobile",
    "Mail":             "mail",
    "Adresse":          "address",
    "Description":      "description",
}


# ──────────────────────────────
# Scraping helpers
# ──────────────────────────────
def _clean(txt: str) -> str:
    txt = unicodedata.normalize("NFKD", txt).strip()
    return txt.replace("\xa0", " ")


def _parse_html(html: str):
    """Génère des dict prêts à instancier Association()."""
    soup = BeautifulSoup(html, "html.parser")

    for tr in soup.find_all("tr"):
        cells = tr.find_all("td")
        if not cells:
            continue                                     # header / ligne vide

        data = {v: "" for v in LABEL_MAP.values()}       # défauts

        for td in cells:
            raw_label = td.get("data-label", "").strip(" :")
            key = LABEL_MAP.get(raw_label)
            if not key:
                continue

            # Lien cliquable ?
            if key in ("website", "mail"):
                a = td.find("a")
                data[key] = a["href"] if a else _clean(td.text)
            else:
                data[key] = _clean(td.text)

        # Ajoute le timestamp d’import
        data["updated_at"] = datetime.utcnow()
        yield data


# ──────────────────────────────
# Repository class
# ──────────────────────────────
class AssociationRepository:
    # ---------------------------
    # Accès DB
    # ---------------------------
    @staticmethod
    def count() -> int:
        """Nombre de lignes dans la table."""
        return db.session.scalar(db.select(func.count()).select_from(Association))

    @staticmethod
    def all():
        """Retourne toutes les entités."""
        return Association.query.all()

    # ---------------------------
    # Sync distante → DB
    # ---------------------------
    def _refresh_from_remote(self) -> list[Association]:
        """Scrape le site, remplace le contenu de la table, retourne la liste."""
        resp = requests.get(URL, timeout=15)
        resp.raise_for_status()

        # Supprime tout et ré‑injecte (simple)
        db.session.execute(delete(Association))
        objs = [Association(**data) for data in _parse_html(resp.text)]
        db.session.add_all(objs)
        db.session.commit()

        current_app.logger.info("Table associations remplie (%s lignes)", len(objs))
        return objs

    # ---------------------------
    # Méthodes publiques
    # ---------------------------
    def ensure_populated(self, force: bool = False) -> list[Association]:
        """
        • Si `force` True ⇒ re‑scrape toujours.
        • Sinon, ne fait le scraping que si la table est vide.
        Renvoie la liste actuelle d’objets.
        """
        if force or self.count() == 0:
            return self._refresh_from_remote()
        return self.all()
