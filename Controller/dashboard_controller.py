from flask import Blueprint, render_template

from Repository.docker_repository import get_hardware_info_remote
from Repository.hardware_repository import get_hardware_metrics

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/')
def index():
    hwinfo = get_hardware_info_remote()
    return render_template('home/index.html', hwinfo=hwinfo)

@dashboard_bp.route('/api/hardware')
def api_hardware():
    return get_hardware_metrics()