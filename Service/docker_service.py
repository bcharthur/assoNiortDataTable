# Service/docker_service.py

from Repository.docker_repository import get_snapshot_and_summary, get_hardware_info_remote
import eventlet

def _background(socketio):
    while True:
        rows, summary = get_snapshot_and_summary()
        hw = get_hardware_info_remote()
        # Fusionne les dicts summary + hw pour n'envoyer qu'un seul objet
        summary_payload = {**summary, **hw}
        socketio.emit('stats', rows)
        socketio.emit('summary', summary_payload)
        socketio.sleep(0.5)

def start_metrics_task(socketio):
    socketio.start_background_task(_background, socketio)
