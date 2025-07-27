# Entity/geocode_cache.py
from datetime import datetime
from app import db

class GeocodeCache(db.Model):
    __tablename__ = "geocode_cache"
    id        = db.Column(db.Integer, primary_key=True)
    address   = db.Column(db.String, unique=True, nullable=False, index=True)
    lat       = db.Column(db.Float,  nullable=False)
    lon       = db.Column(db.Float,  nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)
