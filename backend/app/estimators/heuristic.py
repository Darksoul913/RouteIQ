import re
import time
from typing import Dict, Any
from .base import BaseEstimator

class HeuristicEstimator(BaseEstimator):
    """
    Deterministic rule-based safety net inspecting token length,
    syntax structures, code blocks, and complex reasoning patterns.
    """
    def __init__(self):
        self.hard_keywords = re.compile(
            r"\b(derive|prove|step by step|byzantine|nash equilibrium|optimal|calculus|differential|bellman|gradient|quicksort|recurrence|snark|concurrency|race condition)\b",
            re.IGNORECASE
        )
        self.code_keywords = re.compile(
            r"\b(def |class |function |import |SELECT |FROM |WHERE |public static|void |async def|return )\b|```",
            re.IGNORECASE
        )
        self.summarize_keywords = re.compile(
            r"\b(summarize|bullet points|extract|transcript|report|quarterly|memo|condense)\b",
            re.IGNORECASE
        )

    def predict(self, prompt: str) -> Dict[str, Any]:
        t0 = time.perf_counter()
        words = prompt.strip().split()
        word_count = len(words)

        has_hard = bool(self.hard_keywords.search(prompt))
        has_code = bool(self.code_keywords.search(prompt))
        has_summarize = bool(self.summarize_keywords.search(prompt))

        # Decision rules
        if has_hard or word_count > 150:
            tier = "hard"
            probs = {"easy": 0.05, "medium": 0.20, "hard": 0.75}
            confidence = 0.75
        elif has_code or has_summarize or word_count > 45:
            tier = "medium"
            probs = {"easy": 0.15, "medium": 0.70, "hard": 0.15}
            confidence = 0.70
        else:
            tier = "easy"
            probs = {"easy": 0.80, "medium": 0.15, "hard": 0.05}
            confidence = 0.80

        latency = (time.perf_counter() - t0) * 1000.0

        return {
            "tier": tier,
            "confidence": confidence,
            "path": "heuristic_safety_net",
            "latency_ms": max(0.1, round(latency, 2)),
            "probabilities": probs
        }
