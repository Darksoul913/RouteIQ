import json
import time
import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import classification_report, confusion_matrix

from backend.app.config import PROMPTS_PATH, ESTIMATOR_MODEL_PATH
from backend.app.estimators.baseline_tfidf import BaselineTfidfEstimator

def main():
    print("=" * 60)
    print("RouteIQ Estimator Training & Calibration")
    print("=" * 60)

    if not PROMPTS_PATH.exists():
        print(f"Error: dataset file not found at {PROMPTS_PATH}")
        return

    with open(PROMPTS_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    prompts = [item["prompt"] for item in dataset]
    labels = [item["tier"] for item in dataset]

    print(f"Loaded {len(prompts)} prompts across {len(set(labels))} classes: {sorted(list(set(labels)))}")

    estimator = BaselineTfidfEstimator(model_path=ESTIMATOR_MODEL_PATH)
    t0 = time.perf_counter()
    estimator.train(prompts, labels, save=True)
    train_duration = (time.perf_counter() - t0) * 1000.0

    print(f"Trained & Calibrated TF-IDF + Logistic Regression in {train_duration:.1f}ms")
    print(f"Model saved to: {ESTIMATOR_MODEL_PATH}")

    # Evaluate 5-fold cross-validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    preds = cross_val_predict(estimator.pipeline, prompts, labels, cv=cv)

    print("\nClassification Report (5-Fold Cross Validation):")
    print(classification_report(labels, preds, digits=3))

    print("\nConfusion Matrix:")
    labels_order = ["easy", "medium", "hard"]
    cm = confusion_matrix(labels, preds, labels=labels_order)
    print(f"{'':>10} {'easy':>8} {'medium':>8} {'hard':>8}")
    for idx, row in enumerate(cm):
        print(f"{labels_order[idx]:>10} {row[0]:>8} {row[1]:>8} {row[2]:>8}")

    # Test sample inference latency
    test_sample = "Solve step by step: A train travels at 60 mph. How long does it take to travel 180 miles?"
    t_start = time.perf_counter()
    res = estimator.predict(test_sample)
    latency = (time.perf_counter() - t_start) * 1000.0
    print(f"\nSample Prediction Test:")
    print(f"Prompt: '{test_sample}'")
    print(f"Result: tier={res['tier']}, confidence={res['confidence']:.3f}, latency={latency:.2f}ms")
    print(f"Probabilities: {res['probabilities']}")
    print("=" * 60)

if __name__ == "__main__":
    main()
