# Entity/mockup_entity.py
from datetime import datetime
from extensions import db

class Mockup(db.Model):
    __tablename__ = "mockups"
    id = db.Column(db.Integer, primary_key=True)
    deal_id = db.Column(db.Integer, db.ForeignKey("deals.id"), nullable=False, index=True)
    storage_path = db.Column(db.String(512), nullable=False)  # où tu mets le fichier
    preview_url = db.Column(db.String(512))
    status = db.Column(db.String(16), nullable=False, default="SENT")  # DRAFT|SENT|APPROVED|REJECTED
    created_by = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    notes = db.Column(db.Text)
