from Entity.hardware_metrics import HardwareMetrics

def get_hardware_metrics():
    return HardwareMetrics.get().as_dict()
