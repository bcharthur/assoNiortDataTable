import eventlet
from Repository.docker_repository import (
    get_snapshot_and_summary,
    get_host_hardware_info
)

def _background(socketio):
    """
    En boucle, récupère les metrics Docker + hardware local,
    et les émet via Socket.IO.
    """
    while True:
        rows, summary = get_snapshot_and_summary()
        hw = get_host_hardware_info()
        # fusionne résumé et hardware pour le front
        payload = {**summary, **hw}

        # émet les données
        socketio.emit('stats', rows)
        socketio.emit('summary', payload)

        # pause demi-seconde
        eventlet.sleep(0.5)

def start_metrics_task(socketio):
    """
    Démarre la tâche en arrière-plan pour diffuser les metrics.
    """
    socketio.start_background_task(_background, socketio)
