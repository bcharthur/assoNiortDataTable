# metric_controller.py
"""
Expose /api/metrics endpoints:
  • /api/metrics/containers – per-container CPU/RAM
  • /api/metrics/host       – host-level CPU/RAM/DISK
Works as long as /var/run/docker.sock is mounted readonly in the container.
"""

import docker, psutil
from flask import Blueprint, jsonify

metrics_bp = Blueprint("metrics", __name__, url_prefix="/api/metrics")

# ──────────────────────────────────────────────────────────────
@metrics_bp.route("/containers")
def containers():
    cli = docker.DockerClient(base_url="unix://var/run/docker.sock")
    out = []
    for c in cli.containers.list():
        s = c.stats(stream=False)
        cpu_delta     = s["cpu_stats"]["cpu_usage"]["total_usage"] - s["precpu_stats"]["cpu_usage"]["total_usage"]
        sys_cpu_delta = s["cpu_stats"]["system_cpu_usage"]         - s["precpu_stats"]["system_cpu_usage"]
        nb_cpu        = len(s["cpu_stats"]["cpu_usage"].get("percpu_usage", [])) or 1
        cpu_pct       = round((cpu_delta / sys_cpu_delta) * nb_cpu * 100, 2) if sys_cpu_delta else 0
        mem_usage     = s["memory_stats"]["usage"]
        mem_limit     = s["memory_stats"]["limit"] or 1
        mem_pct       = round(mem_usage / mem_limit * 100, 2)

        out.append({
            "id"        : c.id[:12],
            "name"      : c.name,
            "cpu"       : cpu_pct,
            "mem"       : mem_pct,
            "mem_bytes" : mem_usage
        })
    return jsonify(out)

# ──────────────────────────────────────────────────────────────
@metrics_bp.route("/host")
def host():
    return jsonify({
        "cpu" : psutil.cpu_percent(interval=0.1),
        "mem" : psutil.virtual_memory().percent,
        "disk": psutil.disk_usage("/").percent
    })
