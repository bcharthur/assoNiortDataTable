# Controller/docker_controller.py

from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from Repository.ssh_repository import SSHRepository
from Service.ssh_service import SSHService

docker_bp = Blueprint('docker', __name__, url_prefix='/docker')

@docker_bp.route('/', methods=['GET'])
def index():
    servers = SSHRepository.get_all()
    return render_template('docker/index.html', servers=servers)

@docker_bp.route('/test/<int:server_id>', methods=['POST'])
def test_server(server_id):
    server = SSHRepository.get_by_id(server_id)
    ok, msg = SSHService.test_connection(server)

    # Détection d'une requête AJAX / JSON
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    wants_json = request.accept_mimetypes.accept_json
    if is_ajax or wants_json:
        # Utilisation du ternaire Python (et non JS) pour le champ 'status'
        status_str = 'success' if ok else 'error'
        payload = {
            'status': status_str,
            'message': msg
        }
        # renvoie (body, status_code)
        return jsonify(payload), (200 if ok else 500)

    # sinon comportement classique
    if ok:
        flash(msg, 'success')
    else:
        flash(f'Échec de la connexion : {msg}', 'danger')
    return redirect(url_for('docker.index'))
