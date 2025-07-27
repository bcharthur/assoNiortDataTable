"""
extensions.py – expose les instances partagées (évite les imports circulaires)
"""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()
