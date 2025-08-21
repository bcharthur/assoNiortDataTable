# Service/docker_service.py
import logging

from Repository.docker_repository import (
    get_snapshot_and_summary,
    get_hardware_info_remote,
    _run_remote,
)

log = logging.getLogger(__name__)

def _safe_int(s: str, default: int = 0) -> int:
    try:
        return int(str(s).strip())
    except Exception:
        return default

def _fetch_remote_enrichment():
    """CPU logiques, RAM totale (bytes) et disque du VPS."""
    cpus = _safe_int(_run_remote("nproc 2>/dev/null || getconf _NPROCESSORS_ONLN || echo 0"), 0)
    ram_total = _safe_int(_run_remote("free -b | awk '/Mem:/ {print $2}'"), 0)
    disk = get_hardware_info_remote()
    return cpus, ram_total, disk

def _background(socketio):
    log.info("Docker metrics background task started")
    last_rows = []
    last_summary = {
        'cpu_pct_total': 0.0,
        'cpus': 0,
        'mem_used': 0,
        'mem_total': 0,
        'disk_total': 0,
        'disk_free': 0
    }

    # petit délai au démarrage
    socketio.sleep(1.0)

    while True:
        try:
            # 1) Conteneurs (VPS)
            rows, summary = get_snapshot_and_summary()

            # 2) Enrichissements 100% distants
            cpus, ram_total, disk = _fetch_remote_enrichment()

            # 3) Résumé normalisé pour le front
            summary_out = {
                'cpu_pct_total': float(summary.get('cpu_pct_total', 0.0)),
                'cpus': int(cpus or summary.get('cpus', 0)),
                'mem_used': int(summary.get('mem_used', 0)),
                'mem_total': int(ram_total or summary.get('mem_total', 0)),
                'disk_total': int(disk.get('disk_total', 0)),
                'disk_free': int(disk.get('disk_free', 0)),
            }

            # 4) Émettre à tous les clients (plus de param broadcast)
            socketio.emit('stats', rows)
            socketio.emit('summary', summary_out)

            last_rows = rows
            last_summary = summary_out

        except Exception as exc:
            log.exception("Docker metrics loop error: %s", exc)
            # même chose: pas de broadcast param
            socketio.emit('stats', last_rows)
            socketio.emit('summary', last_summary)

        socketio.sleep(3.0)

def start_metrics_task(socketio):
    import os
    if os.environ.get('DISABLE_BG') == '1':
        log.warning("Docker metrics background task disabled by DISABLE_BG=1")
        return
    socketio.start_background_task(_background, socketio)
    log.info("Docker metrics background task scheduled")
