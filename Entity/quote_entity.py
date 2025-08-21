# Entity/quote_entity.py
from datetime import datetime
from extensions import db

class Quote(db.Model):
    __tablename__ = "quotes"
    id = db.Column(db.Integer, primary_key=True)
    deal_id = db.Column(db.Integer, db.ForeignKey("deals.id"), nullable=False, index=True)
    association_id = db.Column(db.Integer, db.ForeignKey("associations.id"), nullable=True)

    # Snapshot forfait
    forfait_id = db.Column(db.Integer, db.ForeignKey("forfaits.id"), nullable=True)
    forfait_name = db.Column(db.String(64))
    monthly_base_eur_at_issue = db.Column(db.Float)
    rules_json_at_issue = db.Column(db.Text)

    # Montants
    monthly_fee_eur = db.Column(db.Float, nullable=False, default=0.0)
    setup_fee_eur   = db.Column(db.Float, nullable=False, default=0.0)
    discount_eur    = db.Column(db.Float, nullable=False, default=0.0)
    total_monthly_eur = db.Column(db.Float, nullable=False, default=0.0)
    total_setup_eur   = db.Column(db.Float, nullable=False, default=0.0)

    status = db.Column(db.String(16), nullable=False, default="DRAFT")  # DRAFT|SENT|ACCEPTED|REJECTED|EXPIRED
    pdf_path = db.Column(db.String(512))
    sent_at = db.Column(db.DateTime)
    responded_at = db.Column(db.DateTime)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class QuoteItem(db.Model):
    __tablename__ = "quote_items"
    id = db.Column(db.Integer, primary_key=True)
    quote_id = db.Column(db.Integer, db.ForeignKey("quotes.id"), nullable=False, index=True)
    kind = db.Column(db.String(16), nullable=False, default="SERVICE")  # PAGE|SERVICE|AID
    description = db.Column(db.String(255), nullable=False)
    qty = db.Column(db.Float, nullable=False, default=1)
    unit_price_eur = db.Column(db.Float, nullable=False, default=0.0)
    total_eur = db.Column(db.Float, nullable=False, default=0.0)
    meta_json = db.Column(db.Text)
