# Repository/docker_repository.py

import os
import re
import paramiko
from paramiko import AutoAddPolicy, Ed25519Key

from Entity.container_metrics import ContainerMetrics
from Entity.summary_metrics   import SummaryMetrics


# ──────────────────────────────────────────────────────────────
# SSH helper
# ──────────────────────────────────────────────────────────────

def _run_remote(cmd: str) -> str:
    """
    Exécute `cmd` en SSH sur le VPS et renvoie stdout.strip().
    Requiert SSH_HOST, SSH_PORT, SSH_USER et SSH_KEY_PATH (ou SSH_PASSWORD).
    """
    host     = os.environ.get("SSH_HOST")
    port     = int(os.environ.get("SSH_PORT", 22))
    user     = os.environ.get("SSH_USER")
    key_path = os.environ.get("SSH_KEY_PATH")
    password = os.environ.get("SSH_PASSWORD")

    if not host or not user:
        raise RuntimeError("SSH_HOST et SSH_USER doivent être définis.")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(AutoAddPolicy())

    connect_kwargs = {
        "hostname": host,
        "port":     port,
        "username": user,
        "timeout":  15,
    }
    if key_path:
        connect_kwargs["pkey"] = Ed25519Key.from_private_key_file(key_path)
    elif password:
        connect_kwargs["password"] = password
    else:
        raise RuntimeError("Ni SSH_KEY_PATH ni SSH_PASSWORD défini dans l’environnement.")

    client.connect(**connect_kwargs)
    try:
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode("utf-8", errors="ignore")
        err = stderr.read().decode("utf-8", errors="ignore")
        # docker peut écrire des warnings sur stderr → on n’échoue que si out est vide.
        if err and not out:
            raise RuntimeError(f"SSH cmd error: {err.strip()}")
        return out.strip()
    finally:
        client.close()


# ──────────────────────────────────────────────────────────────
# Helpers parsing + infos matérielles
# ──────────────────────────────────────────────────────────────

def _parse_size(sz: str) -> int:
    """
    Convertit '15.5MiB' / '1GiB' etc. → octets.
    Supporte iB (base 1024) et B (base 1000).
    """
    sz = sz.strip()
    m = re.match(r"^\s*([\d.,]+)\s*([KMG]i?)B\s*$", sz, re.IGNORECASE)
    if not m:
        if sz.upper().endswith("B"):
            try:
                return int(float(sz[:-1]))
            except Exception:
                return 0
        return 0

    val_str, unit = m.group(1).replace(",", "."), m.group(2)
    val = float(val_str)
    unit = unit[0].upper() + ("i" if len(unit) > 1 and unit[1].lower() == "i" else "")
    mul = {
        "K": 1000, "M": 1000**2, "G": 1000**3,
        "Ki": 1024, "Mi": 1024**2, "Gi": 1024**3,
    }[unit]
    return int(val * mul)


def _remote_cpu_count() -> int:
    out = _run_remote("nproc 2>/dev/null || getconf _NPROCESSORS_ONLN 2>/dev/null || echo 1")
    try:
        n = int(out.strip().splitlines()[0])
        return max(n, 1)
    except Exception:
        return 1


# ──────────────────────────────────────────────────────────────
# 🚀 Nouvelles commandes “rognées” → ne renvoient que des nombres
# ──────────────────────────────────────────────────────────────

def _remote_cpu_percent() -> float:
    """
    Renvoie le % CPU global de l’hôte (0–100) moyenné sur ~1s.
    Sortie SSH: ex. "4.43"
    """
    cmd = r"""awk 'BEGIN{
        getline l1 < "/proc/stat"; split(l1,a)
        u1=a[2]+a[3]+a[4]; t1=u1+a[5]+a[6]+a[7]+a[8]; close("/proc/stat")
        system("sleep 1")
        getline l2 < "/proc/stat"; split(l2,b)
        u2=b[2]+b[3]+b[4]; t2=u2+b[5]+b[6]+b[7]+b[8]; close("/proc/stat")
        printf "%.2f\n", (u2-u1)/(t2-t1)*100
    }'"""
    out = _run_remote(cmd)
    try:
        return float(out.strip().replace(",", "."))
    except Exception:
        return 0.0


def _remote_mem_stats():
    """
    Renvoie (used_bytes, total_bytes, pct_used) pour la RAM hôte.
    Sortie SSH: "USED TOTAL PCT"
    """
    cmd = r"""free -b | awk '/Mem:/ {printf "%s %s %.2f\n", $3, $2, ($3/$2)*100}'"""
    out = _run_remote(cmd)
    parts = out.split()
    if len(parts) >= 3:
        try:
            used = int(parts[0]); total = int(parts[1]); pct = float(parts[2].replace(",", "."))
            return used, total, pct
        except Exception:
            pass
    return 0, 0, 0.0


def _remote_disk_stats():
    """
    Renvoie (used_bytes, total_bytes, pct_used) pour le disque racine.
    Sortie SSH: "USED TOTAL PCT"
    """
    cmd = r"""df -B1 / | awk 'NR==2 {printf "%s %s %.2f\n", $3, $2, ($3/$2)*100}'"""
    out = _run_remote(cmd)
    parts = out.split()
    if len(parts) >= 3:
        try:
            used = int(parts[0]); total = int(parts[1]); pct = float(parts[2].replace(",", "."))
            return used, total, pct
        except Exception:
            pass
    return 0, 0, 0.0


# ──────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────

def get_snapshot_and_summary():
    """
    - Récupère les conteneurs via `docker stats --no-stream` (parse côté Python).
    - Récupère CPU/MEM/DISK hôte via commandes “rognées” qui renvoient
      directement des nombres.
    """
    # 1) Conteneurs (une passe, sans stream)
    cmd = "docker stats --no-stream --format '{{.Container}};{{.Name}};{{.CPUPerc}};{{.MemUsage}}'"
    out = _run_remote(cmd)

    rows = []
    total_cpu_sum = 0.0  # somme brute des % par conteneur (valeur Docker “par cœur”)
    total_mem_used = 0

    if out:
        for line in out.splitlines():
            parts = line.split(";")
            if len(parts) < 4:
                continue
            cid, name, cpu_s, mem_s = [p.strip() for p in parts[:4]]

            # CPU % fourni par Docker (par cœur)
            try:
                cpu_pct = float(cpu_s.replace("%", "").replace(",", ".").strip())
            except Exception:
                cpu_pct = 0.0

            # Mémoire "USED / LIMIT" (ex: "300.9MiB / 15.24GiB")
            if "/" in mem_s:
                used_s, total_s = [x.strip() for x in mem_s.split("/", 1)]
            else:
                used_s, total_s = mem_s, ""

            used_b  = _parse_size(used_s)
            total_b = _parse_size(total_s) if total_s else 0
            mem_pct = round((used_b / total_b * 100), 2) if total_b else 0.0

            m = ContainerMetrics(
                id=cid, name=name,
                cpu_pct=round(cpu_pct, 2),
                mem_pct=mem_pct,
                mem_used=used_b, mem_lim=total_b,
                rd_mb=0.0, wr_mb=0.0,
                cpus=_remote_cpu_count(),
            )
            rows.append(m)
            total_cpu_sum += cpu_pct
            total_mem_used += used_b

    # 2) Hôte (commandes qui ne renvoient que des nombres)
    vps_cpus                 = _remote_cpu_count()
    cpu_host_pct             = _remote_cpu_percent()              # 0–100
    mem_used_b, mem_tot_b, _ = _remote_mem_stats()                # bytes + %
    disk_used_b, disk_tot_b, _= _remote_disk_stats()              # bytes + %

    # 3) Résumé pour le front
    summary = SummaryMetrics(
        cpu_pct_total=round(cpu_host_pct, 2),  # % CPU hôte “vrai”
        cpu_pct_max=vps_cpus * 100,
        cpus=vps_cpus,
        mem_used=int(mem_used_b) if mem_used_b else total_mem_used,
        mem_total=int(mem_tot_b) if mem_tot_b else 0
    ).as_dict()

    # Ajout disque + somme brute conteneurs (utile en debug/affichage)
    summary.update({
        "disk_total": int(disk_tot_b),
        "disk_free":  int(max(0, disk_tot_b - disk_used_b)),
        "cpu_containers_sum": round(total_cpu_sum, 2),
    })

    return [m.as_dict() for m in rows], summary


def get_hardware_info_remote() -> dict:
    """
    (Toujours dispo) Retourne disque racine du VPS en bytes.
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
    return {"disk_device": "", "disk_total": 0, "disk_used": 0, "disk_free": 0}
