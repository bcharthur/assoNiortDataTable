# Entity/container_metrics.py
from dataclasses import dataclass

BYTES_MB = 1_000_000            # MB décimal (Docker Desktop)

@dataclass
class ContainerMetrics:
    id: str
    name: str
    cpu_pct: float
    mem_pct: float
    mem_used: int          # bytes
    mem_lim:  int          # bytes
    rd_mb:    float
    wr_mb:    float
    cpus:     int          # vCPU visibles dans le cgroup

    @classmethod
    def from_stats(cls, container):
        s = container.stats(stream=False)

        # ---------- CPU ----------
        cpu_total   = s['cpu_stats']['cpu_usage']['total_usage']
        cpu_system  = s['cpu_stats']['system_cpu_usage']
        pcpu_total  = s['precpu_stats']['cpu_usage']['total_usage']
        pcpu_system = s['precpu_stats']['system_cpu_usage']

        cpu_delta = cpu_total - pcpu_total
        sys_delta = cpu_system - pcpu_system
        per_cpu   = s['cpu_stats']['cpu_usage'].get('percpu_usage', [])
        nb_cpu    = len(per_cpu) or 1
        cpu_pct   = (cpu_delta / sys_delta) * nb_cpu * 100 if sys_delta else 0

        # -------- Mémoire --------
        mem = s['memory_stats']
        usage = mem['usage']
        cache = mem['stats'].get('cache', 0)  # 🠚  retire tout le cache
        mem_used = usage - cache

        mem_lim = mem['limit'] or 1
        mem_pct = mem_used / mem_lim * 100

        # ---------- Block I/O ----------
        blkio = s['blkio_stats']['io_service_bytes_recursive']
        rd = sum(x['value'] for x in blkio if x.get('op') == 'Read')
        wr = sum(x['value'] for x in blkio if x.get('op') == 'Write')

        return cls(
            id       = container.short_id,
            name     = container.name,
            cpu_pct  = round(cpu_pct, 2),
            mem_pct  = round(mem_pct, 2),
            mem_used = mem_used,
            mem_lim  = mem_lim,
            rd_mb    = round(rd / BYTES_MB, 1),
            wr_mb    = round(wr / BYTES_MB, 1),
            cpus     = nb_cpu
        )

    def as_dict(self):
        return self.__dict__
