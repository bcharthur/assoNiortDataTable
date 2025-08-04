"""
app.py – point d’entrée Flask
─────────────────────────────
• Configure Flask, SQLAlchemy, Migrate
• Enregistre les blueprints
• Lance une synchronisation automatique ≈ assos_cache.json d’origine
"""
import eventlet
eventlet.monkey_patch()

import os
from flask import Flask, current_app
from sqlalchemy.exc import SQLAlchemyError

from Controller.dashboard_controller import dashboard_bp
from Controller.geocode_controller import geo_bp
from Service.docker_service import start_metrics_task
from extensions import db, migrate
from Controller.association_controller import bp as home_bp
from Repository.association_repository import AssociationRepository


def create_app() -> Flask:
    app = Flask(__name__,
                static_folder="static",
                template_folder="templates")

    # ─── Config DB ────────────────────────────────────────────────────────
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://astroweb:astroweb@db:5432/astroweb"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # ─── Extensions ──────────────────────────────────────────────────────
    db.init_app(app)
    migrate.init_app(app, db)

    # ─── Blueprints ───────────────────────────────────────────────────────
    app.register_blueprint(home_bp)
    app.register_blueprint(geo_bp)
    app.register_blueprint(dashboard_bp)

    socketio = SocketIO(app,
                        async_mode='eventlet',
                        cors_allowed_origins='*',
                        logger=True, engineio_logger=False)

    # ▶️  lance la boucle qui émet les stats toutes les 2 s
    start_metrics_task(socketio)

    # ─── Sync data au 1er appel ───────────────────────────────────────────
    @app.before_request
    def _sync_data():
        """S’assure qu’il y a des données avant toute requête."""
        repo = AssociationRepository()
        try:
            repo.ensure_populated()
        except SQLAlchemyError as exc:
            current_app.logger.error("Sync associations failed: %s", exc)

    return app


# Visibilité pour `flask run`
app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
