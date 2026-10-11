import unittest
import json
from pathlib import Path

from backend.app.config import MODELS_REGISTRY_PATH
from backend.app.engine.gguf_engine import GGUFEngine
from backend.app.models.schemas import RouteRequest
from backend.app.estimators.multi_estimator import MultiEstimatorConsensus
from backend.app.engine.circuit_breaker import CircuitBreaker
from backend.app.chaos.manager import ChaosManager
from backend.app.storage.telemetry import TelemetryStore
from backend.app.engine.executor import ResilientExecutor
from backend.app.engine.auditor import IndependentAuditor

class TestGGUFIntegration(unittest.TestCase):
    """
    Unit & Integration Tests for Local GGUF Model Execution on Apple Silicon.
    Verifies that all 4 quantized GGUF models in model/ are loaded, cataloged,
    and executed with 0 SLA violations.
    """
    def setUp(self):
        self.gguf_engine = GGUFEngine()
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
            estimator=self.estimator,
            gguf_engine=self.gguf_engine
        )

    def test_gguf_catalog_contains_all_models(self):
        catalog = self.gguf_engine.get_catalog()
        expected_files = [
            "DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf",
            "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
            "Mistral-7B-Instruct-v0.2.Q4_K_M.gguf",
            "qwen2.5-coder-7b-instruct-q4_k_m.gguf"
        ]
        for f in expected_files:
            self.assertIn(f, catalog, f"Expected {f} to be cataloged in GGUFEngine")
            meta = catalog[f]
            self.assertTrue(meta.get("valid"), f"Model {f} metadata must be marked valid")
            self.assertGreater(meta.get("n_tensors", 0), 200)
            self.assertIn(meta.get("architecture"), ["llama", "qwen2"])

    def test_deepseek_r1_reasoning_trace_generation(self):
        resp_text, t_in, t_out, lat_ms, badge = self.gguf_engine.execute_inference(
            model_id="deepseek-r1-distill-14b",
            gguf_filename="DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf",
            prompt="Prove that the square root of 2 is irrational.",
            timeout_sec=2.0
        )
        self.assertIn("<think>", resp_text)
        self.assertIn("</think>", resp_text)
        self.assertIn("DeepSeek", resp_text)
        self.assertIn("LOCAL GGUF", badge)
        self.assertGreater(t_out, 10)

    def test_qwen_coder_generation(self):
        resp_text, t_in, t_out, lat_ms, badge = self.gguf_engine.execute_inference(
            model_id="qwen-2.5-coder-7b",
            gguf_filename="qwen2.5-coder-7b-instruct-q4_k_m.gguf",
            prompt="Implement an LRU Cache in Python.",
            timeout_sec=2.0
        )
        self.assertIn("def ", resp_text)
        self.assertIn("Complexity Analysis", resp_text)
        self.assertIn("LOCAL GGUF", badge)

    def test_end_to_end_routing_with_real_gguf_execution(self):
        req = RouteRequest(
            prompt="Implement binary search algorithm in Python with asymptotic analysis.",
            max_latency_ms=2500.0,
            max_cost_usd=0.01,
            min_capability=0.70,
            preference="lowest_cost"
        )
        # Execute in live mode (simulate_delay=True)
        resp = self.executor.execute_request(req, simulate_delay=True)

        self.assertFalse(resp.no_valid_model)
        self.assertIsNotNone(resp.chosen_model)
        self.assertIn("LOCAL GGUF", resp.actual_metrics.get("badge", ""))
        
        # Verify Independent Auditor gives 0 violations
        req_dict = req.model_dump() if hasattr(req, "model_dump") else req.dict()
        verdict = IndependentAuditor.audit_record(req_dict, resp.actual_metrics)
        self.assertTrue(verdict["compliant"])
        self.assertEqual(len(verdict["violations"]), 0)

if __name__ == "__main__":
    unittest.main()
