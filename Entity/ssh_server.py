# app/models/ssh_server.py
from app import db

class SSHServer(db.Model):
    __tablename__ = "ssh_servers"
    id       = db.Column(db.Integer, primary_key=True)
    name     = db.Column(db.String(50), nullable=False)
    host     = db.Column(db.String(100), nullable=False)
    port     = db.Column(db.Integer, default=22)
    user     = db.Column(db.String(50), nullable=False)
    key_path = db.Column(db.String(200), nullable=True)   # chemin vers id_ed25519
    password = db.Column(db.String(200), nullable=True)   # ou mot de passe
