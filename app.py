import os
import secrets

from flask import Flask, current_app, request
from flask_socketio import SocketIO
from sqlalchemy.exc import SQLAlchemyError

from Service.docker_service import start_metrics_task
from extensions import db, migrate

# Force le mode eventlet et CORS ouvert (comme avant)
socketio = SocketIO(async_mode="eventlet", cors_allowed_origins="*")

@socketio.on('connect')
def _on_connect():
    try:
        from flask import request, current_app
        current_app.logger.info("Socket.IO client connected: %s", request.sid)
    except Exception:
        pass

def create_app() -> Flask:
    app = Flask(__name__, static_folder="static", template_folder="templates")

    app.config['SECRET_KEY'] = (
            os.environ.get('SECRET_KEY')
            or os.environ.get('FLASK_SECRET')
            or secrets.token_hex(32)
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

    # ─── Création automatique des tables ─────────────────────────────────
    with app.app_context():
        db.create_all()

    # ─── IMPORTS APRÈS INIT DB (évite circular imports) ─────────────────
    from Controller.association_controller import bp as home_bp
    from Controller.geocode_controller     import geo_bp
    from Controller.dashboard_controller   import dashboard_bp
    from Controller.metric_controller      import metrics_bp
    from Controller.docker_controller      import docker_bp
    from Controller.forfait_controller import forfait_bp
    from Controller.deal_controller import deals_bp

    from Repository.association_repository import AssociationRepository
    from Repository.ssh_repository         import SSHRepository

    from Service.ssh_service               import SSHService
    from Entity.ssh_server                 import SSHServer

    # ─── Blueprints ──────────────────────────────────────────────────────
    app.register_blueprint(home_bp)
    app.register_blueprint(geo_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(metrics_bp)
    app.register_blueprint(docker_bp)
    app.register_blueprint(forfait_bp)
    app.register_blueprint(deals_bp)

    # ─── Sync data "léger" au premier vrai hit HTTP (pas statique) ──────
    @app.before_request
    def _sync_data():
        # Ignore les fichiers statiques / favicon etc.
        if not request.endpoint or request.endpoint.startswith("static"):
            return
        try:
            AssociationRepository().ensure_populated()
        except SQLAlchemyError as exc:
            current_app.logger.error("Sync associations failed: %s", exc)
            # Libère la transaction pour ne pas bloquer la suite
            db.session.rollback()

    # ─── Contexte global : statut SSH pour la navbar ────────────────────
    @app.context_processor
    def inject_ssh_status():
        try:
            # On essaie d’abord en base
            servers = SSHRepository.get_all()
            srv = servers[0] if servers else None

            # Fallback variables d’environnement
            if not srv:
                host = os.getenv("SSH_HOST")
                port = int(os.getenv("SSH_PORT", "22"))
                user = os.getenv("SSH_USER")
                key  = os.getenv("SSH_KEY_PATH")
                pwd  = os.getenv("SSH_PASSWORD")
                if host and user and (key or pwd):
                    srv = SSHServer(
                        name="ENV SSH",
                        host=host,
                        port=port,
                        user=user,
                        key_path=key,
                        password=pwd
                    )
                else:
                    return {'ssh_status_ok': None, 'ssh_status_msg': 'SSH non configuré'}

            ok, msg = SSHService.test_connection(srv)
            return {'ssh_status_ok': ok, 'ssh_status_msg': msg}

        except Exception as exc:
            current_app.logger.error("SSH status check failed: %s", exc)
            return {'ssh_status_ok': False, 'ssh_status_msg': str(exc)}

    # ─── SocketIO & background task (désactivables) ─────────────────────
    if not os.environ.get("DISABLE_BG"):
        socketio.init_app(app)
        start_metrics_task(socketio)
    else:
        app.logger.warning("Docker metrics background task disabled by DISABLE_BG=1")

    return app


# Pour Flask CLI (FLASK_APP="app:create_app") et exécution directe
app = create_app()

if __name__ == "__main__":
    # Gunicorn prend le relai en prod; ici pour run local direct
    socketio.run(app, host="0.0.0.0", port=5000)
