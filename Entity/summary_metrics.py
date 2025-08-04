from dataclasses import dataclass

from Repository.hardware_repository import get_hardware_metrics


@dataclass
class SummaryMetrics:
    cpu_pct_total: float
    cpu_pct_max:   int
    cpus:          int
    mem_used:      int    # bytes !
    mem_total:     int
    hardware = get_hardware_metrics()
    total_ram = hardware['total_ram']
    cpu_count = hardware['cpu_count']

    def as_dict(self):
        return self.__dict__
