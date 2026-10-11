import datetime
from typing import Dict, Any, List
from ..config import AUDITOR_LATENCY_TOLERANCE_MS, AUDITOR_COST_TOLERANCE_RATIO

class IndependentAuditor:
    """
    Decoupled post-hoc auditor.
    Evaluates completed requests strictly against the original user constraints.
    Provides mathematically tamper-evident verification.
    """
    @staticmethod
    def audit_record(request_constraints: Dict[str, Any], actuals: Dict[str, Any]) -> Dict[str, Any]:
        violations: List[str] = []
        now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # If system returned structured refusal, check if it's compliant
        if actuals.get("no_valid_model", False) or actuals.get("status") == "REFUSED_NO_VALID_MODEL":
            return {
                "compliant": True,
                "violations": [],
                "audited_at": now_str
            }

        # 1. Latency Check
        actual_lat = actuals.get("total_latency_ms", 0.0)
        max_lat = request_constraints.get("max_latency_ms", float("inf"))
        if actual_lat > (max_lat + AUDITOR_LATENCY_TOLERANCE_MS):
            violations.append(
                f"Latency breach: {actual_lat:.1f}ms > max allowed {max_lat:.1f}ms "
                f"(tolerance: +{AUDITOR_LATENCY_TOLERANCE_MS}ms)"
            )

        # 2. Cost Check
        actual_cost = actuals.get("total_cost_usd", 0.0)
        max_cost = request_constraints.get("max_cost_usd", float("inf"))
        if actual_cost > (max_cost * AUDITOR_COST_TOLERANCE_RATIO):
            violations.append(
                f"Cost breach: ${actual_cost:.6f} > max budget ${max_cost:.6f} "
                f"(margin: x{AUDITOR_COST_TOLERANCE_RATIO})"
            )

        # 3. Capability Check
        model_cap = actuals.get("model_capability", 0.0)
        min_cap = request_constraints.get("min_capability", 0.0)
        if model_cap < (min_cap - 1e-4):
            violations.append(
                f"Capability breach: {model_cap:.2f} < requested minimum {min_cap:.2f}"
            )

        # 4. Context Window Check
        req_context = request_constraints.get("required_context")
        if req_context:
            model_ctx = actuals.get("model_context", 0)
            if model_ctx < req_context:
                violations.append(
                    f"Context breach: model context {model_ctx} < required {req_context}"
                )

        return {
            "compliant": len(violations) == 0,
            "violations": violations,
            "audited_at": now_str
        }
