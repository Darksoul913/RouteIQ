import time
from typing import Dict, Any, Optional
from .base import BaseEstimator
from .heuristic import HeuristicEstimator
from .baseline_tfidf import BaselineTfidfEstimator
from .laya_systemone import LayaSystemOneEstimator
from ..config import ESTIMATOR_CONFIDENCE_THRESHOLD, TIER_CAPABILITY_MAP

class MultiEstimatorConsensus:
    """
    Consensus & Uncertainty Hedge Engine.
    Combines primary estimator, System 1 non-autoregressive classifier,
    and deterministic heuristic safety net.
    
    Rule Supremacy:
    Rules decide. AI only advises.
    When uncertainty is high or estimators disagree, the system safely raises
    the required capability tier to guarantee quality.
    """
    def __init__(
        self,
        primary: Optional[BaseEstimator] = None,
        secondary: Optional[BaseEstimator] = None,
        heuristic: Optional[BaseEstimator] = None,
        confidence_threshold: float = ESTIMATOR_CONFIDENCE_THRESHOLD
    ):
        self.primary = primary or BaselineTfidfEstimator()
        self.secondary = secondary or LayaSystemOneEstimator()
        self.heuristic = heuristic or HeuristicEstimator()
        self.confidence_threshold = confidence_threshold

    @staticmethod
    def _bump_tier(tier: str) -> str:
        if tier == "easy":
            return "medium"
        elif tier == "medium":
            return "hard"
        return "hard"

    def evaluate(self, prompt: str, user_min_capability: float = 0.0) -> Dict[str, Any]:
        t0 = time.perf_counter()

        # 1. Primary evaluation
        try:
            res_primary = self.primary.predict(prompt)
        except Exception:
            # Fallback to secondary if primary fails
            res_primary = self.secondary.predict(prompt)
            res_primary["path"] = f"fallback_to_{res_primary['path']}"

        # 2. Secondary System 1 evaluation
        try:
            res_secondary = self.secondary.predict(prompt)
        except Exception:
            res_secondary = None

        # 3. Deterministic heuristic evaluation
        res_heuristic = self.heuristic.predict(prompt)

        raw_tier = res_primary["tier"]
        confidence = res_primary["confidence"]
        path = res_primary["path"]
        elevated = False
        elevation_reason = None

        # Uncertainty Hedging (Rule 4)
        if confidence < self.confidence_threshold:
            effective_tier = self._bump_tier(raw_tier)
            elevated = True
            elevation_reason = f"Low confidence ({confidence:.2f} < {self.confidence_threshold:.2f})"
        elif raw_tier != res_heuristic["tier"]:
            effective_tier = self._bump_tier(raw_tier)
            elevated = True
            elevation_reason = f"Estimator disagreement ({raw_tier} vs {res_heuristic['tier']})"
        else:
            effective_tier = raw_tier

        # Map tier to capability threshold
        tier_capability = TIER_CAPABILITY_MAP.get(effective_tier, 0.35)
        required_capability = max(user_min_capability, tier_capability)

        total_latency = (time.perf_counter() - t0) * 1000.0

        return {
            "tier": effective_tier,
            "raw_tier": raw_tier,
            "confidence": confidence,
            "path": path,
            "elevated": elevated,
            "elevation_reason": elevation_reason,
            "required_capability": round(required_capability, 2),
            "tier_capability": tier_capability,
            "latency_ms": round(total_latency, 2),
            "primary_result": res_primary,
            "secondary_result": res_secondary,
            "heuristic_result": res_heuristic,
            "probabilities": res_primary.get("probabilities", {})
        }
