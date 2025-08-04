# Repository/docker_repository.py
import os
import docker
import paramiko
from dotenv import load_dotenv
from Entity.container_metrics import ContainerMetrics
from Entity.summary_metrics import SummaryMetrics

# Charge les variables d'environnement depuis .env
load_dotenv()

# Lecture des variables SSH depuis .env
SSH_HOST     = os.getenv('SSH_HOST')
SSH_USER     = os.getenv('SSH_USER')
SSH_KEY_PATH = os.getenv('SSH_KEY_PATH')  # chemin vers la clé privée, ou vide
SSH_PASSWORD = os.getenv('SSH_PASSWORD')  # mot de passe en clair dans .env

# Client Docker local pointant vers le Docker du VPS via tunnel SSH
client = (
    docker.DockerClient(base_url=os.getenv("DOCKER_HOST_URL"))
    if os.getenv("DOCKER_HOST_URL")
    else docker.from_env()          # gère npipe://, ssh://, unix://, etc.
)


def _ssh_cmd(cmd: str) -> str:
    """
    Exécute une commande sur le VPS via Paramiko, sans prompt.
    Utilise la clé si configurée, sinon le mot de passe SSH.
    """
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    # Tentative par clé privée
    try:
        if SSH_KEY_PATH and os.path.exists(SSH_KEY_PATH):
            ssh.connect(
                SSH_HOST,
                username=SSH_USER,
                key_filename=SSH_KEY_PATH,
                timeout=10
            )
        else:
            raise paramiko.AuthenticationException()
    except paramiko.AuthenticationException:
        # Fallback mot de passe
        ssh.connect(
            SSH_HOST,
            username=SSH_USER,
            password=SSH_PASSWORD,
            timeout=10
        )

    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    ssh.close()
    return out.strip()


def get_snapshot_and_summary():
    rows, total_cpu, total_mem = [], 0.0, 0
    cpus_max = 0

    for c in client.containers.list(all=True):
        m = ContainerMetrics.from_stats(c)
        rows.append(m)
        total_cpu += m.cpu_pct
        total_mem += m.mem_used
        cpus_max = max(cpus_max, m.cpus)

    mem_total = client.info().get('MemTotal') or (rows[0].mem_lim if rows else 0)

    summary = SummaryMetrics(
        cpu_pct_total=round(total_cpu, 2),
        cpu_pct_max=cpus_max * 100,
        cpus=cpus_max,
        mem_used=total_mem,
        mem_total=mem_total
    )
    return [r.as_dict() for r in rows], summary.as_dict()


def get_hardware_info_remote():
    """
    Récupère CPU, RAM et disque du VPS via SSH Paramiko.
    """
    # RAM via /proc/meminfo
    meminfo = _ssh_cmd("grep '^MemTotal:' /proc/meminfo")
    parts = meminfo.split()
    ram_total = int(parts[1]) * 1024 if len(parts) >= 2 else 0

    # CPU count
    try:
        cpu_count = int(_ssh_cmd('nproc'))
    except Exception:
        cpu_count = 1

    # CPU model
    cpu_model = _ssh_cmd(
        "grep '^model name' /proc/cpuinfo | head -1 | awk -F ':' '{print $2}'"
    ) or 'N/A'

    # Disque via df
    df = _ssh_cmd("df -B1 / | tail -1")
    df_parts = df.split()
    if len(df_parts) >= 5:
        disk_device = df_parts[0]
        disk_total = int(df_parts[1])
        disk_free = int(df_parts[3])
    else:
        disk_device, disk_total, disk_free = '/', 0, 0

    return {
        'cpu_name': cpu_model.strip(),
        'cpu_count': cpu_count,
        'ram_total': ram_total,
        'disk_device': disk_device,
        'disk_total': disk_total,
        'disk_free': disk_free,
    }
