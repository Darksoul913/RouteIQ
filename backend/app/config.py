import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
APP_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"
MODELS_REGISTRY_PATH = APP_DIR / "models" / "registry.json"
DB_PATH = DATA_DIR / "routeiq_audit.db"
ESTIMATOR_MODEL_PATH = DATA_DIR / "estimator_tfidf.joblib"
PROMPTS_PATH = DATA_DIR / "prompts_300.json"
BENCHMARK_PATH = DATA_DIR / "benchmark_30.json"

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

# Hard Rule & Circuit Breaker Thresholds
CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3
CIRCUIT_BREAKER_COOLDOWN_SECONDS = 15.0
ESTIMATOR_CONFIDENCE_THRESHOLD = 0.70

# Independent Auditor Tolerances
AUDITOR_LATENCY_TOLERANCE_MS = 5.0
AUDITOR_COST_TOLERANCE_RATIO = 1.01

# System 1 / Laya Decision Engine Mapping
TIER_CAPABILITY_MAP = {
    "easy": 0.35,
    "medium": 0.65,
    "hard": 0.85
}

# Free / Low-Cost Online API Providers (Optional Zero-Cost Cloud Routing)
GROQ_BASE_URL = os.environ.get("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
GEMINI_BASE_URL = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
