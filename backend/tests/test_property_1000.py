import unittest
import json
import random
from pathlib import Path

from backend.app.config import MODELS_REGISTRY_PATH, PROMPTS_PATH
from backend.app.models.schemas import RouteRequest
from backend.app.estimators.multi_estimator import MultiEstimatorConsensus
from backend.app.engine.circuit_breaker import CircuitBreaker
from backend.app.chaos.manager import ChaosManager
from backend.app.storage.telemetry import TelemetryStore
from backend.app.engine.auditor import IndependentAuditor
from backend.app.engine.executor import ResilientExecutor

class TestProperty1000Invariants(unittest.TestCase):
    """
    1,000 Randomized Property Tests.
    Proves the mathematical invariant:
    Regardless of prompt, chaos state, budget boundaries, and failure cascades,
    the Independent Auditor detects ZERO constraint violations.
    """
    def setUp(self):
        with open(MODELS_REGISTRY_PATH, "r", encoding="utf-8") as f:
            self.models = json.load(f)

        with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
            self.prompts = [p["prompt"] for p in json.load(f)]

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

    def test_1000_random_requests_zero_violations(self):
        random.seed(1337)
        total_requests = 1000
        violation_count = 0
        refusal_count = 0
        success_count = 0
        violations_log = []

        preferences = ["lowest_cost", "lowest_latency", "highest_capability", "balanced_pareto"]

        for i in range(total_requests):
            prompt = random.choice(self.prompts)
            max_lat = random.uniform(100.0, 2500.0)
            max_cost = random.uniform(0.0002, 0.04)
            min_cap = random.choice([0.0, 0.35, 0.50, 0.70, 0.85, 0.95, 0.99])
            req_ctx = random.choice([None, None, 4000, 10000, 40000, 100000])
            pref = random.choice(preferences)

            # Randomly inject chaos on 10% of iterations
            if random.random() < 0.10:
                random_model = random.choice(self.models)["id"]
                self.chaos_manager.set_chaos(
                    random_model,
                    add_latency_ms=random.choice([0.0, 100.0, 300.0]),
                    kill_switch=(random.random() < 0.20),
                    error_rate=random.choice([0.0, 0.10, 0.30])
                )

            req = RouteRequest(
                prompt=prompt,
                max_latency_ms=max_lat,
                max_cost_usd=max_cost,
                min_capability=min_cap,
                required_context=req_ctx,
                preference=pref
            )

            resp = self.executor.execute_request(req, simulate_delay=False)

            if resp.no_valid_model:
                refusal_count += 1
            else:
                success_count += 1

            # Audit response strictly
            req_dict = req.model_dump() if hasattr(req, "model_dump") else req.dict()
            actuals = resp.actual_metrics
            actuals["no_valid_model"] = resp.no_valid_model

            verdict = IndependentAuditor.audit_record(req_dict, actuals)
            if not verdict["compliant"]:
                violation_count += 1
                violations_log.append({
                    "iteration": i,
                    "prompt": prompt[:40],
                    "violations": verdict["violations"],
                    "actuals": actuals
                })

            # Periodically reset chaos to simulate recovering systems
            if (i + 1) % 100 == 0:
                self.chaos_manager.reset_all()

        print(f"\n[Property Test Summary]")
        print(f"Total Requests: {total_requests}")
        print(f"Success Routed: {success_count} ({success_count/total_requests*100:.1f}%)")
        print(f"Refused (No Valid Model): {refusal_count} ({refusal_count/total_requests*100:.1f}%)")
        print(f"Constraint Violations: {violation_count} of {total_requests}")

        if violations_log:
            print("First 3 violations:")
            for v in violations_log[:3]:
                print(v)

        self.assertEqual(
            violation_count,
            0,
            f"Expected 0 violations across 1000 requests, got {violation_count}"
        )

if __name__ == "__main__":
    unittest.main()
