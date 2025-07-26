# Repository/association_repository.py
import json, requests, unicodedata
from bs4 import BeautifulSoup
from Entity.association_entity import Association

URL = "https://niort-associations.fr/index.php?action=Assos"
CACHE = "assos_cache.json"

LABEL_MAP = {
    "Titre": "title",
    "Catégorie": "category",
    "Sous-Catégorie": "sub_category",
    "Site internet": "website",
    "Responsable": "manager",
    "Contact": "contact",
    "Telephone": "phone",
    "Portable": "mobile",
    "Mail": "mail",
    "Adresse": "address",
    "Description": "description",
}

class AssociationRepository:
    @staticmethod
    def _clean(txt: str) -> str:
        txt = unicodedata.normalize("NFKD", txt).strip()
        return txt.replace("\xa0", " ")

    @classmethod
    def _parse_html(cls, html: str):
        soup = BeautifulSoup(html, "html.parser")
        for tr in soup.find_all("tr"):
            cells = tr.find_all("td")
            if not cells:
                continue  # saute les lignes vides / <thead>
            data = {v: "" for v in LABEL_MAP.values()}  # valeurs par défaut

            for td in cells:
                raw_label = td.get("data-label", "").strip(" :")
                key = LABEL_MAP.get(raw_label)
                if not key:
                    continue
                # lien cliquable ?
                if key in ("website", "mail"):
                    a = td.find("a")
                    data[key] = a["href"] if a else cls._clean(td.text)
                else:
                    data[key] = cls._clean(td.text)

            # crée l’entité
            yield Association(**data)

    def fetch_all(self, force: bool = False):
        if not force:
            try:
                with open(CACHE, "r", encoding="utf-8") as f:
                    return [Association(**obj) for obj in json.load(f)]
            except FileNotFoundError:
                pass

        resp = requests.get(URL, timeout=15)
        resp.raise_for_status()
        assos = list(self._parse_html(resp.text))

        with open(CACHE, "w", encoding="utf-8") as f:
            json.dump([a.to_dict() for a in assos], f, ensure_ascii=False, indent=2)
        return assos
