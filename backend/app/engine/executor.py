import time
import json
import uuid
import datetime
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional, Tuple

from ..models.schemas import RouteRequest, RouteResponse, CandidateAudit
from .constraints import evaluate_candidates
from .ranker import rank_candidates
from .circuit_breaker import CircuitBreaker
from ..chaos.manager import ChaosManager
from ..storage.telemetry import TelemetryStore
from ..estimators.multi_estimator import MultiEstimatorConsensus
from ..config import OLLAMA_BASE_URL

class ResilientExecutor:
    """
    Unified Dual-Mode Model Executor with Shrinking-Budget Failover.
    Enforces the Core Axiom:
    "Failover can never relax a constraint. Subsequent retries operate strictly
    under remaining time and budget: L_rem = L_orig - t_spent."
    """
    def __init__(
        self,
        models: List[Dict[str, Any]],
        circuit_breakers: Dict[str, CircuitBreaker],
        chaos_manager: ChaosManager,
        telemetry: TelemetryStore,
        estimator: MultiEstimatorConsensus
    ):
        self.models = models
        self.models_map = {m["id"]: m for m in models}
        self.circuit_breakers = circuit_breakers
        self.chaos_manager = chaos_manager
        self.telemetry = telemetry
        self.estimator = estimator

    def _is_ollama_available(self, ollama_name: Optional[str]) -> bool:
        if not ollama_name:
            return False
        try:
            req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags", method="GET")
            with urllib.request.urlopen(req, timeout=0.15) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    models = [m.get("name") for m in data.get("models", [])]
                    return any(ollama_name in m for m in models)
        except Exception:
            return False
        return False

    def _call_ollama(self, ollama_name: str, prompt: str, timeout_sec: float) -> Tuple[str, int, int]:
        req_data = json.dumps({
            "model": ollama_name,
            "prompt": prompt,
            "stream": False
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{OLLAMA_BASE_URL}/api/generate",
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = data.get("response", "")
            eval_count = data.get("eval_count", 50)
            prompt_eval_count = data.get("prompt_eval_count", len(prompt.split()) * 2)
            return text, prompt_eval_count, eval_count

    def _simulate_model_call(
        self,
        model: Dict[str, Any],
        prompt: str,
        timeout_sec: float,
        injected_lat_ms: float = 0.0
    ) -> Tuple[str, int, int, float, str]:
        """
        Deterministic offline model simulator with calibrated latencies.
        """
        base_lat_ms = model["base_latency_ms"]
        target_lat_ms = base_lat_ms + injected_lat_ms
        target_sleep_sec = target_lat_ms / 1000.0

        if target_sleep_sec > timeout_sec:
            # Emulate timeout
            time.sleep(timeout_sec)
            raise TimeoutError(f"Model call exceeded allocated timeout ({timeout_sec*1000:.0f}ms)")

        # Normal execution simulation
        time.sleep(target_sleep_sec)

        tokens_in = max(10, len(prompt.split()) * 2)
        tokens_out = min(model["context_window"] - tokens_in, 120)

        # Content generation reflecting model capability
        cap = model["capability_score"]
        name = model["name"]

        if cap >= 0.90:
            resp_text = (
                f"[RouteIQ Frontier Response — {name}]\n"
                f"Analysis completed with multi-step logical verification.\n"
                f"Prompt query evaluated: '{prompt[:60]}...'\n"
                f"Synthesized comprehensive answer adhering strictly to mathematical correctness and context boundaries."
            )
        elif cap >= 0.70:
            resp_text = (
                f"[RouteIQ Mid-Tier Response — {name}]\n"
                f"Successfully processed query: '{prompt[:50]}...'\n"
                f"Provided structured solution with code/analytical reasoning."
            )
        else:
            resp_text = (
                f"[RouteIQ Compact Response — {name}]\n"
                f"Direct response to query: '{prompt[:40]}...'\n"
                f"Fast execution optimized for minimal cost and latency."
            )

        badge = "[INJECTED]" if injected_lat_ms > 0 else "[SIMULATED]"
        return resp_text, tokens_in, tokens_out, target_lat_ms, badge

    def execute_request(self, request: RouteRequest) -> RouteResponse:
        t_global_start = time.perf_counter()
        request_id = f"req_{uuid.uuid4().hex[:10]}"
        timestamp_str = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Step 1: Complexity estimation & uncertainty hedge
        est_result = self.estimator.evaluate(request.prompt, request.min_capability)
        effective_min_capability = est_result["required_capability"]

        prompt_tokens = max(10, len(request.prompt.split()) * 2)
        expected_output_tokens = request.expected_output_tokens or 150

        remaining_latency_ms = request.max_latency_ms
        remaining_cost_usd = request.max_cost_usd

        failover_chain: List[Dict[str, Any]] = []
        attempted_model_ids = set()
        last_audits: List[CandidateAudit] = []
        last_closest_miss: Optional[str] = None

        while remaining_latency_ms > 20.0 and remaining_cost_usd > 0.0:
            # 1. Hard constraint evaluation under remaining budgets
            available_models = [m for m in self.models if m["id"] not in attempted_model_ids]
            if not available_models:
                break

            audits, closest_miss = evaluate_candidates(
                models=available_models,
                prompt_tokens=prompt_tokens,
                expected_output_tokens=expected_output_tokens,
                remaining_latency_ms=remaining_latency_ms,
                remaining_cost_usd=remaining_cost_usd,
                required_capability=effective_min_capability,
                required_context=request.required_context,
                circuit_breakers=self.circuit_breakers,
                chaos_manager=self.chaos_manager,
                telemetry=self.telemetry
            )
            last_audits = audits
            last_closest_miss = closest_miss

            valid_candidates = [a for a in audits if a.passed]
            if not valid_candidates:
                # No valid candidate satisfies current remaining budget!
                break

            # 2. Preference Ranking
            ranked = rank_candidates(valid_candidates, request.preference)
            chosen_candidate = ranked[0]
            m_id = chosen_candidate.model_id
            m_config = self.models_map[m_id]
            attempted_model_ids.add(m_id)

            # 3. Model Execution Attempt
            call_start = time.perf_counter()
            injected_lat = self.chaos_manager.get_injected_latency(m_id)
            allocated_timeout_sec = remaining_latency_ms / 1000.0

            try:
                # Check chaos kill-switch or error rate first
                chaos_failed, chaos_reason = self.chaos_manager.should_inject_failure(m_id)
                if chaos_failed:
                    raise RuntimeError(chaos_reason)

                # Attempt Live Ollama if available
                ollama_name = m_config.get("ollama_name")
                if self._is_ollama_available(ollama_name):
                    resp_text, tokens_in, tokens_out = self._call_ollama(
                        ollama_name, request.prompt, allocated_timeout_sec
                    )
                    badge = "[MEASURED]"
                    call_elapsed_ms = (time.perf_counter() - call_start) * 1000.0
                else:
                    # Deterministic offline model simulator
                    resp_text, tokens_in, tokens_out, _, badge = self._simulate_model_call(
                        m_config, request.prompt, allocated_timeout_sec, injected_lat
                    )
                    call_elapsed_ms = (time.perf_counter() - call_start) * 1000.0

                actual_cost_usd = (tokens_in / 1000.0 * m_config["input_cost_per_1k"]) + \
                                  (tokens_out / 1000.0 * m_config["output_cost_per_1k"])

                # Success accounting
                cb = self.circuit_breakers.get(m_id)
                if cb:
                    cb.record_success()
                self.telemetry.record_call(m_id, call_elapsed_ms, success=True, tokens_in=tokens_in, tokens_out=tokens_out)

                total_elapsed_ms = (time.perf_counter() - t_global_start) * 1000.0

                actual_metrics = {
                    "total_latency_ms": round(total_elapsed_ms, 2),
                    "model_execution_ms": round(call_elapsed_ms, 2),
                    "total_cost_usd": round(actual_cost_usd, 6),
                    "tokens_in": tokens_in,
                    "tokens_out": tokens_out,
                    "model_capability": m_config["capability_score"],
                    "model_context": m_config["context_window"],
                    "badge": badge,
                    "status": "SUCCESS"
                }

                # Evaluate all models for the full decision audit table
                full_audits, _ = evaluate_candidates(
                    models=self.models,
                    prompt_tokens=prompt_tokens,
                    expected_output_tokens=expected_output_tokens,
                    remaining_latency_ms=request.max_latency_ms,
                    remaining_cost_usd=request.max_cost_usd,
                    required_capability=effective_min_capability,
                    required_context=request.required_context,
                    circuit_breakers=self.circuit_breakers,
                    chaos_manager=self.chaos_manager,
                    telemetry=self.telemetry
                )

                return RouteResponse(
                    request_id=request_id,
                    chosen_model=m_id,
                    response_text=resp_text,
                    no_valid_model=False,
                    closest_miss_suggestion=None,
                    estimator=est_result,
                    candidates=full_audits,
                    failover_chain=failover_chain,
                    actual_metrics=actual_metrics,
                    auditor={},  # Decoupled auditor populates this
                    timestamp=timestamp_str
                )

            except Exception as exc:
                call_elapsed_ms = (time.perf_counter() - call_start) * 1000.0
                cb = self.circuit_breakers.get(m_id)
                if cb:
                    cb.record_failure()
                self.telemetry.record_call(m_id, call_elapsed_ms, success=False)

                # Shrinking Budget calculation:
                # Deduct spent time from remaining budget
                remaining_latency_ms -= call_elapsed_ms

                failover_chain.append({
                    "model_id": m_id,
                    "model_name": m_config["name"],
                    "error": str(exc),
                    "time_spent_ms": round(call_elapsed_ms, 1),
                    "remaining_latency_ms": max(0.0, round(remaining_latency_ms, 1))
                })

        # No valid model can satisfy remaining constraints -> Return structured refusal
        total_elapsed_ms = (time.perf_counter() - t_global_start) * 1000.0

        full_audits, closest_miss = evaluate_candidates(
            models=self.models,
            prompt_tokens=prompt_tokens,
            expected_output_tokens=expected_output_tokens,
            remaining_latency_ms=request.max_latency_ms,
            remaining_cost_usd=request.max_cost_usd,
            required_capability=effective_min_capability,
            required_context=request.required_context,
            circuit_breakers=self.circuit_breakers,
            chaos_manager=self.chaos_manager,
            telemetry=self.telemetry
        )

        return RouteResponse(
            request_id=request_id,
            chosen_model=None,
            response_text="[RouteIQ Refusal] No model satisfied the hard constraints under the available budget.",
            no_valid_model=True,
            closest_miss_suggestion=closest_miss or last_closest_miss,
            estimator=est_result,
            candidates=full_audits,
            failover_chain=failover_chain,
            actual_metrics={
                "total_latency_ms": round(total_elapsed_ms, 2),
                "total_cost_usd": 0.0,
                "model_capability": 0.0,
                "model_context": 0,
                "badge": "[RULE_ENFORCED]",
                "status": "REFUSED_NO_VALID_MODEL"
            },
            auditor={},
            timestamp=timestamp_str
        )
