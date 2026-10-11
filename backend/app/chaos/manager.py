import random
import threading
from typing import Dict, Any, Tuple

class ChaosManager:
    """
    Judge Chaos Studio Manager.
    Allows judges to inject artificial latency, activate kill switches,
    or set probabilistic error rates to test resilience and failovers in real-time.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._chaos: Dict[str, Dict[str, Any]] = {}

    def set_chaos(
        self,
        model_id: str,
        add_latency_ms: float = 0.0,
        kill_switch: bool = False,
        error_rate: float = 0.0
    ):
        with self._lock:
            self._chaos[model_id] = {
                "model_id": model_id,
                "add_latency_ms": max(0.0, float(add_latency_ms)),
                "kill_switch": bool(kill_switch),
                "error_rate": max(0.0, min(1.0, float(error_rate)))
            }

    def get_chaos(self, model_id: str) -> Dict[str, Any]:
        with self._lock:
            if model_id not in self._chaos:
                return {
                    "model_id": model_id,
                    "add_latency_ms": 0.0,
                    "kill_switch": False,
                    "error_rate": 0.0
                }
            return dict(self._chaos[model_id])

    def get_all_chaos(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            return {k: dict(v) for k, v in self._chaos.items()}

    def get_injected_latency(self, model_id: str) -> float:
        with self._lock:
            entry = self._chaos.get(model_id)
            if not entry:
                return 0.0
            return entry.get("add_latency_ms", 0.0)

    def should_inject_failure(self, model_id: str) -> Tuple[bool, str]:
        with self._lock:
            entry = self._chaos.get(model_id)
            if not entry:
                return False, ""

            if entry.get("kill_switch", False):
                return True, f"Chaos Kill-Switch activated for model '{model_id}'"

            error_rate = entry.get("error_rate", 0.0)
            if error_rate > 0.0 and random.random() < error_rate:
                return True, f"Chaos injected simulated upstream 503 error (rate={error_rate*100:.0f}%)"

            return False, ""

    def reset_all(self):
        with self._lock:
            self._chaos.clear()
