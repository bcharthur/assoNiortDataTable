# Entity/container_metrics.py

from dataclasses import dataclass

@dataclass
class ContainerMetrics:
    id: str
    name: str
    cpu_pct: float
    mem_pct: float
    mem_used: int
    mem_lim:  int
    rd_mb:    float
    wr_mb:    float
    cpus:     int

    @classmethod
    def from_stats(cls, container):
        """
        Prend un objet docker.models.containers.Container,
        récupère son stats dict, et en extrait les métriques.
        """
        stats = container.stats(stream=False)

        # Calcul CPU
        cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] \
                  - stats["precpu_stats"]["cpu_usage"]["total_usage"]
        sys_delta = stats["cpu_stats"]["system_cpu_usage"] \
                  - stats["precpu_stats"]["system_cpu_usage"]
        percpu = len(stats["cpu_stats"]["cpu_usage"].get("percpu_usage", [])) or 1
        cpu_pct = (cpu_delta / sys_delta * percpu * 100) if sys_delta > 0 else 0.0

        # Calcul Mémoire
        mem_usage = stats["memory_stats"]["usage"] \
                  - stats["memory_stats"].get("stats", {}).get("cache", 0)
        mem_limit = stats["memory_stats"]["limit"]
        mem_pct   = (mem_usage / mem_limit * 100) if mem_limit > 0 else 0.0

        # I/O
        blkio = stats.get("blkio_stats", {}).get("io_service_bytes_recursive", [])
        rd = next((x["value"] for x in blkio if x["op"].lower()=="read"), 0)
        wr = next((x["value"] for x in blkio if x["op"].lower()=="write"),0)

        # Nombre de CPU
        nb_cpu = stats["cpu_stats"].get("online_cpus") or percpu

        return cls(
            id=container.short_id,
            name=container.name,
            cpu_pct=round(cpu_pct,2),
            mem_pct=round(mem_pct,2),
            mem_used=mem_usage,
            mem_lim=mem_limit,
            rd_mb=round(rd/1e6,1),
            wr_mb=round(wr/1e6,1),
            cpus=nb_cpu
        )

    def as_dict(self):
        return self.__dict__
