from dataclasses import dataclass
import psutil


@dataclass
class HardwareMetrics:
    total_ram: int  # en bytes
    cpu_count: int  # nombre de coeurs logiques
    cpu_model: str  # (optionnel, pour Linux)
    cpu_freq: float  # fréquence CPU (MHz)

    @classmethod
    def get(cls):
        total_ram = psutil.virtual_memory().total
        cpu_count = psutil.cpu_count(logical=True)
        try:
            cpu_freq = psutil.cpu_freq().max
        except Exception:
            cpu_freq = 0.0

        # Optionnel, récupère le modèle CPU sous Linux
        cpu_model = ''
        try:
            with open('/proc/cpuinfo') as f:
                for line in f:
                    if line.startswith('model name'):
                        cpu_model = line.split(':', 1)[1].strip()
                        break
        except Exception:
            pass

        return cls(
            total_ram=total_ram,
            cpu_count=cpu_count,
            cpu_model=cpu_model,
            cpu_freq=cpu_freq
        )

    def as_dict(self):
        return self.__dict__
