from flask import Blueprint, render_template

from Repository.docker_repository import get_snapshot_and_summary, get_host_hardware_info, get_hardware_info_remote
from Repository.hardware_repository import get_hardware_metrics

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/')
def index():
    hw = get_hardware_info_remote()
    rows, summary = get_snapshot_and_summary()
    return render_template('home/index.html',
        containers = rows,
        summary = summary,
        hardware = hw
    )

@dashboard_bp.route('/api/hardware')
def api_hardware():
    return get_hardware_metrics()