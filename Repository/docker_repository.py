# Repository/docker_repository.py

import os
import re

import docker
import psutil
import paramiko
from paramiko import AutoAddPolicy, Ed25519Key
from Entity.container_metrics import ContainerMetrics
from Entity.summary_metrics   import SummaryMetrics

# client Docker *local* (via /var/run/docker.sock monté dans compose)
client = docker.from_env()

# helper pour convertir "15.5MiB" / "1GiB" en octets
def _parse_size(sz: str) -> int:
    match = re.match(r"([\d\.]+)\s*([KMG]i?)B", sz)
    if not match:
        return 0
    val, unit = float(match.group(1)), match.group(2)
    mul = {
      'B': 1,
      'Ki': 1024,
      'Mi': 1024**2,
      'Gi': 1024**3,
      'K': 1000,
      'M': 1000**2,
      'G': 1000**3,
    }[unit]
    return int(val * mul)

def get_snapshot_and_summary():
    """
    Récupère la liste et stats des conteneurs **du VPS** via SSH+docker CLI.
    """
    # 1) Récupère la liste statistique en une seule commande
    cmd = (
      "docker stats --no-stream "
      "--format '{{.Container}};{{.Name}};{{.CPUPerc}};{{.MemUsage}}'"
    )
    out = _run_remote(cmd)
    rows, total_cpu, total_mem = [], 0.0, 0
    # 2) Pour chaque ligne, on parse
    for line in out.splitlines():
        cid, name, cpu_s, mem_s = line.split(';')
        cpu_pct = float(cpu_s.strip('%'))
        used_s, total_s = [x.strip() for x in mem_s.split('/')]
        used_b  = _parse_size(used_s)
        total_b = _parse_size(total_s)
        mem_pct = round(used_b / total_b * 100, 2) if total_b else 0.0

        # construit l'objet ContainerMetrics
        m = ContainerMetrics(
            id=cid,
            name=name,
            cpu_pct=cpu_pct,
            mem_pct=mem_pct,
            mem_used=used_b,
            mem_lim= total_b,
            rd_mb=0.0,    # on ne récupère pas I/O ici
            wr_mb=0.0,
            cpus=psutil.cpu_count(logical=True) or 1
        )
        rows.append(m)
        total_cpu += cpu_pct
        total_mem += used_b

    # 3) Résumé global
    # On peut aussi récupérer la RAM totale du VPS
    ram_total = _run_remote("free -b | awk '/Mem:/ {print $2}'")
    try:
        ram_total = int(ram_total.strip())
    except:
        ram_total = psutil.virtual_memory().total

    summary = SummaryMetrics(
        cpu_pct_total=round(total_cpu,2),
        cpu_pct_max=100 * (psutil.cpu_count(logical=True) or 1),
        cpus=psutil.cpu_count(logical=True) or 1,
        mem_used=total_mem,
        mem_total=ram_total
    )

    # on renvoie la liste de dicts pour le front
    return [m.as_dict() for m in rows], summary.as_dict()

def get_host_hardware_info() -> dict:
    """
    Récupère CPU, RAM et Disque localement via psutil.
    """
    cpu_info  = psutil.cpu_freq()
    disk_info = psutil.disk_usage("/")

    return {
        "cpu_name":  cpu_info.max if cpu_info else 0,
        "cpu_count": psutil.cpu_count(logical=False) or 1,
        "ram_total": psutil.virtual_memory().total,
        "disk_device": "/",
        "disk_total": disk_info.total,
        "disk_free":  disk_info.free,
    }


# ─── SSH helper pour exécuter une commande distante ──────────────────────
def _run_remote(cmd: str) -> str:
    """
    Se connecte en SSH au VPS et exécute `cmd`, retourne la sortie stdout.
    Nécessite les variables d'env :
      SSH_HOST, SSH_PORT, SSH_USER, SSH_KEY_PATH (ou SSH_PASSWORD)
    """
    host     = os.environ.get("SSH_HOST")
    port     = int(os.environ.get("SSH_PORT", 22))
    user     = os.environ.get("SSH_USER")
    key_path = os.environ.get("SSH_KEY_PATH")
    password = os.environ.get("SSH_PASSWORD")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(AutoAddPolicy())

    connect_kwargs = {
        "hostname": host,
        "port":     port,
        "username": user,
        "timeout":  10,
    }
    if key_path:
        connect_kwargs["pkey"] = Ed25519Key.from_private_key_file(key_path)
    elif password:
        connect_kwargs["password"] = password
    else:
        raise RuntimeError("Ni SSH_KEY_PATH ni SSH_PASSWORD défini dans l’environnement")

    client.connect(**connect_kwargs)
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode()
    client.close()
    return out.strip()


def get_hardware_info_remote() -> dict:
    """
    Récupère via SSH le disque racine (df -B1) et retourne un dict :
      disk_device, disk_total, disk_used, disk_free (en bytes)
    """
    out = _run_remote("df -B1 --output=source,size,used,avail / | tail -1")
    parts = out.split()
    if len(parts) >= 4:
        device, total, used, free = parts[0], int(parts[1]), int(parts[2]), int(parts[3])
        return {
            "disk_device": device,
            "disk_total":  total,
            "disk_used":   used,
            "disk_free":   free
        }
    # valeur par défaut si parsing échoue
    return {
        "disk_device": "",
        "disk_total":  0,
        "disk_used":   0,
        "disk_free":   0
    }
