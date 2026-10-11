from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseEstimator(ABC):
    @abstractmethod
    def predict(self, prompt: str) -> Dict[str, Any]:
        """
        Evaluate prompt complexity.
        Returns:
            {
                "tier": "easy" | "medium" | "hard",
                "confidence": float (0.0 to 1.0),
                "path": str,
                "latency_ms": float,
                "probabilities": Dict[str, float]
            }
        """
        pass
