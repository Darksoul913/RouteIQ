import unittest
import json
from pathlib import Path

from backend.app.config import MODELS_REGISTRY_PATH
from backend.app.models.schemas import RouteRequest
from backend.app.estimators.multi_estimator import MultiEstimatorConsensus
from backend.app.estimators.heuristic import HeuristicEstimator
from backend.app.engine.circuit_breaker import CircuitBreaker
from backend.app.chaos.manager import ChaosManager
from backend.app.storage.telemetry import TelemetryStore
from backend.app.storage.db import AuditDatabase
from backend.app.engine.auditor import IndependentAuditor
from backend.app.engine.executor import ResilientExecutor

class TestRouteIQAcceptanceCriteria(unittest.TestCase):
    """
    Formal Acceptance Tests for RouteIQ: T1 through T8.
    Verifies all mathematical invariants and problem statement guarantees.
    """
    def setUp(self):
        with open(MODELS_REGISTRY_PATH, "r", encoding="utf-8") as f:
            self.models = json.load(f)

        self.circuit_breakers = {m["id"]: CircuitBreaker() for m in self.models}
        self.chaos_manager = ChaosManager()
        self.telemetry = TelemetryStore()
        self.estimator = MultiEstimatorConsensus()
        self.executor = ResilientExecutor(
            models=self.models,
            circuit_breakers=self.circuit_breakers,
            chaos_manager=self.chaos_manager,
            telemetry=self.telemetry,
            estimator=self.estimator
        )

    def tearDown(self):
        self.chaos_manager.reset_all()

    def test_T1_exceeding_capability_returns_no_valid_model(self):
        """
        T1: When required capability exceeds all available models (e.g. 0.99),
        the gateway returns structured refusal (no_valid_model=True, chosen_model=None)
        and provides a closest miss suggestion.
        """
        req = RouteRequest(
            prompt="What is the capital of France?",
            max_latency_ms=2000.0,
            max_cost_usd=0.05,
            min_capability=0.99,  # Highest model is 0.98
            preference="lowest_cost"
        )
        resp = self.executor.execute_request(req, simulate_delay=False)

        self.assertTrue(resp.no_valid_model)
        self.assertIsNone(resp.chosen_model)
        self.assertIsNotNone(resp.closest_miss_suggestion)
        # Verify all candidates failed capability constraint
        for candidate in resp.candidates:
            self.assertFalse(candidate.passed)
            self.assertFalse(candidate.capability_fit)
            self.assertTrue(any("Capability" in r for r in candidate.rejection_reasons))

    def test_T2_killing_chosen_model_triggers_shrinking_budget_failover(self):
        """
        T2: When the chosen model has a kill-switch activated, the gateway
        fails over to the next compliant model, recording the failure in failover_chain
        and operating under remaining time budget: L_rem = L_orig - t_spent.
        """
        # Baseline: without kill switch, routes to llama-3.2-1b (cheapest)
        req = RouteRequest(
            prompt="What is the capital of France?",
            max_latency_ms=1000.0,
            max_cost_usd=0.01,
            min_capability=0.35,
            preference="lowest_cost"
        )
        resp_clean = self.executor.execute_request(req, simulate_delay=False)
        self.assertEqual(resp_clean.chosen_model, "llama-3.2-1b")

        # Now activate kill-switch on llama-3.2-1b
        self.chaos_manager.set_chaos("llama-3.2-1b", kill_switch=True)

        resp_failover = self.executor.execute_request(req, simulate_delay=False)
        self.assertFalse(resp_failover.no_valid_model)
        self.assertNotEqual(resp_failover.chosen_model, "llama-3.2-1b")
        self.assertEqual(len(resp_failover.failover_chain), 1)

        fail_record = resp_failover.failover_chain[0]
        self.assertEqual(fail_record["model_id"], "llama-3.2-1b")
        self.assertIn("Kill-Switch", fail_record["error"])
        # Verify remaining latency was reduced
        self.assertLess(fail_record["remaining_latency_ms"], req.max_latency_ms)

    def test_T3_failover_never_relaxes_constraints(self):
        """
        T3: Under shrinking-budget failover, constraints are never relaxed.
        If the remaining budget after a failed attempt is insufficient for all
        remaining candidates, the gateway returns no_valid_model=True.
        """
        # Set max latency to 300ms (only llama-3.2-1b at 180ms fits; next is mistral at 380ms)
        req = RouteRequest(
            prompt="What is the capital of France?",
            max_latency_ms=300.0,
            max_cost_usd=0.01,
            min_capability=0.35,
            preference="lowest_cost"
        )
        # Kill llama-3.2-1b
        self.chaos_manager.set_chaos("llama-3.2-1b", kill_switch=True)

        resp = self.executor.execute_request(req, simulate_delay=False)
        # Even though failover attempted, remaining latency (300 - 180 = 120ms) is too small
        self.assertTrue(resp.no_valid_model)
        self.assertIsNone(resp.chosen_model)
        self.assertEqual(len(resp.failover_chain), 1)

    def test_T4_estimator_fallback_records_path(self):
        """
        T4: When estimator fallback is triggered or normal paths are traversed,
        the decision metadata records the explicit path.
        """
        # Normal prediction path
        res = self.estimator.evaluate("What is the capital of Italy?")
        self.assertIn("path", res)
        self.assertTrue(len(res["path"]) > 0)

        # Force fallback by mocking primary error
        class BrokenEstimator:
            def predict(self, p):
                raise RuntimeError("Primary offline")

        fallback_consensus = MultiEstimatorConsensus(
            primary=BrokenEstimator(),
            secondary=HeuristicEstimator(),
            heuristic=HeuristicEstimator()
        )
        res_fb = fallback_consensus.evaluate("What is the boiling point of water?")
        self.assertTrue(res_fb["path"].startswith("fallback_to_"))

    def test_T5_context_overflow_rejected(self):
        """
        T5: Models with insufficient context window for required_context
        are strictly rejected with a clear context breach reason.
        """
        # Request context window of 10,000 tokens (llama-3.2-1b has 8192)
        req = RouteRequest(
            prompt="Summarize the legal brief.",
            max_latency_ms=2000.0,
            max_cost_usd=0.05,
            min_capability=0.35,
            required_context=10000,
            preference="lowest_cost"
        )
        resp = self.executor.execute_request(req, simulate_delay=False)
        self.assertFalse(resp.no_valid_model)
        # Llama 3.2 1B must be rejected on context window
        llama_audit = next(c for c in resp.candidates if c.model_id == "llama-3.2-1b")
        self.assertFalse(llama_audit.passed)
        self.assertFalse(llama_audit.context_fit)
        self.assertTrue(any("Context window exceeded" in r for r in llama_audit.rejection_reasons))

    def test_T6_low_confidence_raises_tier(self):
        """
        T6: Uncertainty Hedging:
        When confidence < 0.70 or estimators disagree, the system safely raises
        the required capability tier to guarantee quality.
        """
        class LowConfidenceEstimator:
            def predict(self, p):
                return {
                    "tier": "easy",
                    "confidence": 0.52,  # < 0.70 threshold
                    "path": "test_mock",
                    "latency_ms": 1.0,
                    "probabilities": {"easy": 0.52, "medium": 0.30, "hard": 0.18}
                }

        consensus = MultiEstimatorConsensus(
            primary=LowConfidenceEstimator(),
            heuristic=HeuristicEstimator(),
            confidence_threshold=0.70
        )
        eval_res = consensus.evaluate("Sample query", user_min_capability=0.0)
        self.assertTrue(eval_res["elevated"])
        self.assertIn("Low confidence", eval_res["elevation_reason"])
        # easy was bumped to medium (min capability raised to 0.65)
        self.assertEqual(eval_res["tier"], "medium")
        self.assertGreaterEqual(eval_res["required_capability"], 0.65)

    def test_T7_deterministic_replay(self):
        """
        T7: Deterministic replay:
        The exact same prompt, constraints, and system state produce identical
        routing decisions and candidates audit lists.
        """
        req = RouteRequest(
            prompt="Write a Python script to sort a dictionary by key.",
            max_latency_ms=800.0,
            max_cost_usd=0.005,
            min_capability=0.60,
            preference="lowest_cost"
        )
        resp1 = self.executor.execute_request(req, simulate_delay=False)
        resp2 = self.executor.execute_request(req, simulate_delay=False)

        self.assertEqual(resp1.chosen_model, resp2.chosen_model)
        self.assertEqual(resp1.no_valid_model, resp2.no_valid_model)
        self.assertEqual(len(resp1.candidates), len(resp2.candidates))
        for c1, c2 in zip(resp1.candidates, resp2.candidates):
            self.assertEqual(c1.model_id, c2.model_id)
            self.assertEqual(c1.passed, c2.passed)
            self.assertEqual(c1.rejection_reasons, c2.rejection_reasons)

    def test_T8_independent_auditor_reports_zero_violations(self):
        """
        T8: Independent constraint auditor reports zero violations across
        diverse workloads adhering strictly to user limits.
        """
        test_requests = [
            RouteRequest(prompt="Capital of Japan?", max_latency_ms=500.0, max_cost_usd=0.002, min_capability=0.35),
            RouteRequest(prompt="Explain quicksort O(n log n).", max_latency_ms=1200.0, max_cost_usd=0.005, min_capability=0.65),
            RouteRequest(prompt="Derive Nash equilibrium in Cournot duopoly.", max_latency_ms=1500.0, max_cost_usd=0.02, min_capability=0.85),
            RouteRequest(prompt="Impossible SLA request", max_latency_ms=50.0, max_cost_usd=0.00001, min_capability=0.99), # Refusal case
        ]

        for req in test_requests:
            resp = self.executor.execute_request(req, simulate_delay=False)
            req_dict = req.model_dump() if hasattr(req, "model_dump") else req.dict()
            actuals = resp.actual_metrics
            actuals["no_valid_model"] = resp.no_valid_model

            verdict = IndependentAuditor.audit_record(req_dict, actuals)
            self.assertTrue(
                verdict["compliant"],
                f"Auditor reported violation for prompt '{req.prompt}': {verdict['violations']}"
            )
            self.assertEqual(len(verdict["violations"]), 0)

if __name__ == "__main__":
    unittest.main()
