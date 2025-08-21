# Entity/deal_entity.py
from datetime import datetime
from extensions import db

class Deal(db.Model):
    __tablename__ = "deals"
    id = db.Column(db.Integer, primary_key=True)
    association_id = db.Column(db.Integer, db.ForeignKey("associations.id"), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    owner = db.Column(db.String(32), nullable=True)  # "Theo" | "Rick" | "Loic"
    stage = db.Column(db.String(32), nullable=False, default="CONTACTED")
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class DealStageHistory(db.Model):
    __tablename__ = "deal_stage_history"
    id = db.Column(db.Integer, primary_key=True)
    deal_id = db.Column(db.Integer, db.ForeignKey("deals.id"), nullable=False, index=True)
    from_stage = db.Column(db.String(32))
    to_stage = db.Column(db.String(32), nullable=False)
    changed_by = db.Column(db.String(64))
    comment = db.Column(db.Text)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

def as_dict(self, association_title=None):
    return {
        "id": self.id,
        "title": self.title,
        "owner": self.owner,
        "stage": self.stage,
        "association_id": self.association_id,
        "association_title": association_title,
        "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        "created_at": self.created_at.isoformat() if self.created_at else None,
    }