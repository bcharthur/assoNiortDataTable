# Entity/association_entity.py
from datetime import datetime
from extensions import db


class Association(db.Model):
    __tablename__ = "associations"

    id            = db.Column(db.Integer, primary_key=True)
    title         = db.Column(db.String, nullable=False)
    category      = db.Column(db.String)
    sub_category  = db.Column(db.String)
    website       = db.Column(db.String)
    manager       = db.Column(db.String)
    contact       = db.Column(db.String)
    phone         = db.Column(db.String)
    mobile        = db.Column(db.String)
    mail          = db.Column(db.String)
    address       = db.Column(db.String)
    description   = db.Column(db.Text)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # ──────────────────────────────
    # Helpers
    # ──────────────────────────────
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "category": self.category,
            "sub_category": self.sub_category,
            "website": self.website,
            "manager": self.manager,
            "contact": self.contact,
            "phone": self.phone,
            "mobile": self.mobile,
            "mail": self.mail,
            "address": self.address,
            "description": self.description,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
