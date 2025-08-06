# Repository/docker_repository.py
import docker
import psutil
from Entity.container_metrics import ContainerMetrics
from Entity.summary_metrics import SummaryMetrics

# client Docker *local* (via /var/run/docker.sock monté dans docker-compose)
client = docker.from_env()


# ──────────────────────────────────────────────────────────────
def get_snapshot_and_summary():
    """
    Renvoie le détail par conteneur + un résumé global.
    Equivalent à l’ancienne fonction mais sans SSH.
    """
    rows, total_cpu, total_mem = [], 0.0, 0
    cpus_max = 0

    for c in client.containers.list(all=True):
        m = ContainerMetrics.from_stats(c)
        rows.append(m)
        total_cpu += m.cpu_pct
        total_mem += m.mem_used
        cpus_max = max(cpus_max, m.cpus)

    # Mémoire totale du host (si socket Docker ne le donne pas correctement)
    mem_total = psutil.virtual_memory().total

    summary = SummaryMetrics(
        cpu_pct_total=round(total_cpu, 2),
        cpu_pct_max=cpus_max * 100,
        cpus=cpus_max,
        mem_used=total_mem,
        mem_total=mem_total
    )
    return [r.as_dict() for r in rows], summary.as_dict()


# ──────────────────────────────────────────────────────────────
def get_host_hardware_info():
    """
    Remplace get_hardware_info_remote().
    Utilise psutil pour récupérer les infos CPU/RAM/Disque localement.
    """
    cpu_info = psutil.cpu_freq()
    disk_info = psutil.disk_usage("/")

    return {
        "cpu_name": cpu_info or "N/A",
        "cpu_count": psutil.cpu_count(logical=False) or 1,
        "ram_total": psutil.virtual_memory().total,
        "disk_device": "/",
        "disk_total": disk_info.total,
        "disk_free": disk_info.free,
    }
