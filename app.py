import os

from flask import Flask, current_app
from sqlalchemy.exc import SQLAlchemyError
from extensions import db, migrate

# Blueprints / services
from Controller.association_controller import bp as home_bp
from Controller.geocode_controller import geo_bp
from Controller.dashboard_controller import dashboard_bp
from Controller.metric_controller import metrics_bp
from Repository.association_repository import AssociationRepository
# from Service.docker_service import start_metrics_task


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
    migrate.init_app(app, db)          # optionnel si tu n’utilises pas encore les migrations

    # ─── Création automatique des tables (une seule fois) ────────────────
    with app.app_context():
        db.create_all()

    # ─── Blueprints ───────────────────────────────────────────────────────
    app.register_blueprint(home_bp)
    app.register_blueprint(geo_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(metrics_bp)

    # ▶️  start_metrics_task()     # dé-commenter si besoin

    # ─── Sync data au 1er appel ───────────────────────────────────────────
    @app.before_request
    def _sync_data():
        repo = AssociationRepository()
        try:
            repo.ensure_populated()
        except SQLAlchemyError as exc:
            current_app.logger.error("Sync associations failed: %s", exc)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
