import json
import time
from pathlib import Path
from typing import Dict, Any, Optional

from .base import BaseEstimator
from ..config import ESTIMATOR_MODEL_PATH, PROMPTS_PATH

try:
    import joblib
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

class BaselineTfidfEstimator(BaseEstimator):
    """
    Calibrated TF-IDF + Logistic Regression complexity classifier.
    Produces well-calibrated class probabilities with <5ms inference latency.
    """
    def __init__(self, model_path: Optional[Path] = None):
        self.model_path = model_path or ESTIMATOR_MODEL_PATH
        self.pipeline = None
        self.classes_ = ["easy", "medium", "hard"]
        self._load_or_train()

    def _load_or_train(self):
        if not HAS_SKLEARN:
            return

        if self.model_path.exists():
            try:
                self.pipeline = joblib.load(self.model_path)
                return
            except Exception as e:
                print(f"[BaselineTfidfEstimator] Failed to load model from {self.model_path}: {e}")

        # Train on prompts_300.json if file exists
        if PROMPTS_PATH.exists():
            try:
                with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                texts = [item["prompt"] for item in data]
                labels = [item["tier"] for item in data]
                self.train(texts, labels, save=True)
            except Exception as e:
                print(f"[BaselineTfidfEstimator] Failed auto-training: {e}")

    def train(self, texts, labels, save: bool = True):
        if not HAS_SKLEARN:
            raise RuntimeError("scikit-learn is required to train BaselineTfidfEstimator")

        self.pipeline = Pipeline([
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), max_features=5000, sublinear_tf=True)),
            ("clf", LogisticRegression(C=1.5, max_iter=200, class_weight="balanced", random_state=42))
        ])
        self.pipeline.fit(texts, labels)
        self.classes_ = list(self.pipeline.named_steps["clf"].classes_)
        if save:
            self.model_path.parent.mkdir(parents=True, exist_ok=True)
            joblib.dump(self.pipeline, self.model_path)

    def predict(self, prompt: str) -> Dict[str, Any]:
        t0 = time.perf_counter()

        if self.pipeline is None or not HAS_SKLEARN:
            # Fallback path if model not trained
            latency = (time.perf_counter() - t0) * 1000.0
            return {
                "tier": "medium",
                "confidence": 0.50,
                "path": "baseline_tfidf_fallback",
                "latency_ms": max(0.1, round(latency, 2)),
                "probabilities": {"easy": 0.33, "medium": 0.34, "hard": 0.33}
            }

        probs = self.pipeline.predict_proba([prompt])[0]
        prob_dict = {str(cls): float(p) for cls, p in zip(self.classes_, probs)}

        # Find predicted class and confidence
        best_tier = str(max(prob_dict, key=prob_dict.get))
        confidence = float(prob_dict[best_tier])

        latency = (time.perf_counter() - t0) * 1000.0

        return {
            "tier": best_tier,
            "confidence": round(confidence, 4),
            "path": "baseline_tfidf_calibrated",
            "latency_ms": max(0.1, round(latency, 2)),
            "probabilities": prob_dict
        }
