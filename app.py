import os
from flask import Flask, current_app
from flask_socketio import SocketIO
from sqlalchemy.exc import SQLAlchemyError

from Service.docker_service import start_metrics_task
# Extensions
from extensions import db, migrate

socketio = SocketIO(cors_allowed_origins="*")

def create_app() -> Flask:
    app = Flask(
        __name__,
        static_folder="static",
        template_folder="templates"
    )

    # ─── Config DB ────────────────────────────────────────────────────────
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://astroweb:astroweb@db:5432/astroweb"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # ─── Extensions ──────────────────────────────────────────────────────
    db.init_app(app)
    migrate.init_app(app, db)

    # ─── Création automatique des tables (une seule fois) ────────────────
    with app.app_context():
        db.create_all()

    # ─── IMPORTS APRÈS INIT DB (évite la circular import) ────────────────
    from Controller.association_controller import bp as home_bp
    from Controller.geocode_controller     import geo_bp
    from Controller.dashboard_controller   import dashboard_bp
    from Controller.metric_controller      import metrics_bp
    from Controller.docker_controller      import docker_bp
    from Repository.association_repository import AssociationRepository
    from Repository.ssh_repository         import SSHRepository
    from Service.ssh_service               import SSHService

    # ─── Blueprints ───────────────────────────────────────────────────────
    app.register_blueprint(home_bp)
    app.register_blueprint(geo_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(metrics_bp)
    app.register_blueprint(docker_bp)

    # ─── Sync data au 1er appel ───────────────────────────────────────────
    @app.before_request
    def _sync_data():
        repo = AssociationRepository()
        try:
            repo.ensure_populated()
        except SQLAlchemyError as exc:
            current_app.logger.error("Sync associations failed: %s", exc)
            # libère la transaction pour ne pas bloquer la suite
            db.session.rollback()

    # ─── Contexte global : statut SSH pour la navbar ────────────────────
    @app.context_processor
    def inject_ssh_status():
        try:
            servers = SSHRepository.get_all()
            if not servers:
                return {'ssh_status_ok': None, 'ssh_status_msg': None}
            ok, msg = SSHService.test_connection(servers[0])
            return {
                'ssh_status_ok': ok,
                'ssh_status_msg': msg
            }
        except Exception as exc:
            current_app.logger.error("SSH status check failed: %s", exc)
            return {'ssh_status_ok': False, 'ssh_status_msg': str(exc)}

    # ─── Initialisation de SocketIO & lancement du background task ───────
    socketio.init_app(app)
    start_metrics_task(socketio)

    return app

# Pour Flask CLI (FLASK_APP="app:create_app") et exécution directe
app = create_app()

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)
