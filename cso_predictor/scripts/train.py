"""Generate synthetic history, train the overflow model and save artifacts."""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow running as `python scripts/train.py` without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cso_predictor.data import generate_history
from cso_predictor.features import make_training_matrix
from cso_predictor.model import (
    ARTIFACT_DIR,
    backend_name,
    feature_importance,
    save_model,
    train,
)


def main() -> None:
    print("Generating synthetic history (1 year hourly)...")
    history = generate_history()
    x, y = make_training_matrix(history)
    print(f"Training matrix: {x.shape[0]} rows, {x.shape[1]} features, "
          f"overflow rate {y.mean():.3%}")

    print(f"Training classifier (backend: {backend_name()})...")
    model, metrics = train(x, y)
    path = save_model(model)

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    metrics_path = ARTIFACT_DIR / "metrics.json"
    metrics_path.write_text(json.dumps(metrics.to_dict(), indent=2))

    print("Computing feature importance...")
    importance = feature_importance(model, x, y)
    importance_path = ARTIFACT_DIR / "feature_importance.json"
    importance_path.write_text(json.dumps(importance, indent=2))

    print(f"\nSaved model      -> {path}")
    print(f"Saved metrics    -> {metrics_path}")
    print(f"Saved importance -> {importance_path}")
    print("\nEvaluation (held-out 25%):")
    for key, value in metrics.to_dict().items():
        print(f"  {key:14s} {value}")
    print("\nTop feature importance:")
    for name, weight in list(importance.items())[:6]:
        print(f"  {name:14s} {weight:.3f}")


if __name__ == "__main__":
    main()
