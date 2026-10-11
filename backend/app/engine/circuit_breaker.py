import time
import threading
from typing import Dict, Any

class CircuitBreaker:
    """
    3-State Circuit Breaker State Machine:
    - CLOSED: Normal operation, all traffic allowed.
    - OPEN: Trips after N consecutive failures. Rejects traffic immediately.
    - HALF_OPEN: After cooldown period, allows a single probe request to check recovery.
    """
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"

    def __init__(self, failure_threshold: int = 3, cooldown_seconds: float = 15.0):
        self._lock = threading.Lock()
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.state = self.CLOSED
        self.consecutive_failures = 0
        self.last_failure_time = 0.0
        self.total_trips = 0

    def allow_request(self) -> bool:
        with self._lock:
            now = time.time()
            if self.state == self.CLOSED:
                return True

            if self.state == self.OPEN:
                if (now - self.last_failure_time) >= self.cooldown_seconds:
                    self.state = self.HALF_OPEN
                    return True
                return False

            if self.state == self.HALF_OPEN:
                # In HALF_OPEN, allow 1 probe request
                return True

            return False

    def record_success(self):
        with self._lock:
            self.consecutive_failures = 0
            if self.state in (self.HALF_OPEN, self.OPEN):
                self.state = self.CLOSED

    def record_failure(self):
        with self._lock:
            self.consecutive_failures += 1
            self.last_failure_time = time.time()
            if self.consecutive_failures >= self.failure_threshold:
                if self.state != self.OPEN:
                    self.total_trips += 1
                self.state = self.OPEN

    def reset(self):
        with self._lock:
            self.state = self.CLOSED
            self.consecutive_failures = 0
            self.last_failure_time = 0.0

    def get_info(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "state": self.state,
                "consecutive_failures": self.consecutive_failures,
                "total_trips": self.total_trips,
                "cooldown_remaining_sec": max(
                    0.0,
                    round(self.cooldown_seconds - (time.time() - self.last_failure_time), 1)
                ) if self.state == self.OPEN else 0.0
            }
