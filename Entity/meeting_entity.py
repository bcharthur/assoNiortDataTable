# Entity/meeting_entity.py
from datetime import datetime
from extensions import db

class Meeting(db.Model):
    __tablename__ = "meetings"
    id = db.Column(db.Integer, primary_key=True)
    deal_id = db.Column(db.Integer, db.ForeignKey("deals.id"), nullable=False, index=True)
    scheduled_at = db.Column(db.DateTime, nullable=False)
    with_person = db.Column(db.String(32), nullable=True)  # Theo | Rick | Loic
    status = db.Column(db.String(16), nullable=False, default="SCHEDULED")  # SCHEDULED|DONE|CANCELLED|NO_SHOW
    result = db.Column(db.String(16))  # POSITIVE|NEGATIVE|NEUTRAL
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
