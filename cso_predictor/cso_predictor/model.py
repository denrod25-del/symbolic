"""Overflow probability model: train, evaluate, persist and predict.

Uses scikit-learn's HistGradientBoostingClassifier so the project runs with no
extra installs. To upgrade, install lightgbm and swap the estimator in
`_make_estimator` — the feature contract is unchanged.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import average_precision_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

from cso_predictor.config import CONFIG, Config
from cso_predictor.features import build_feature_columns

ARTIFACT_DIR = Path(__file__).resolve().parent.parent / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "model.joblib"


@dataclass
class Metrics:
    """Evaluation metrics tuned for rare, imbalanced overflow events."""

    pr_auc: float
    precision: float
    recall: float
    positive_rate: float
    n_test: int

    def to_dict(self) -> dict[str, float]:
        return {
            "pr_auc": round(self.pr_auc, 4),
            "precision": round(self.precision, 4),
            "recall": round(self.recall, 4),
            "positive_rate": round(self.positive_rate, 4),
            "n_test": self.n_test,
        }


def _make_estimator(config: Config) -> HistGradientBoostingClassifier:
    return HistGradientBoostingClassifier(
        max_iter=300,
        learning_rate=0.06,
        max_depth=6,
        l2_regularization=1.0,
        class_weight="balanced",  # CSO events are rare
        random_state=config.random_seed,
    )


def train(x: pd.DataFrame, y: pd.Series, *, config: Config = CONFIG):
    """Train the classifier and return (model, metrics) on a held-out split."""
    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.25, random_state=config.random_seed, stratify=y,
    )
    model = _make_estimator(config)
    model.fit(x_train, y_train)

    proba = model.predict_proba(x_test)[:, 1]
    pred = (proba >= 0.5).astype(int)
    metrics = Metrics(
        pr_auc=float(average_precision_score(y_test, proba)),
        precision=float(precision_score(y_test, pred, zero_division=0)),
        recall=float(recall_score(y_test, pred, zero_division=0)),
        positive_rate=float(np.mean(y_test)),
        n_test=int(len(y_test)),
    )
    return model, metrics


def save_model(model, path: Path = MODEL_PATH) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "features": build_feature_columns()}, path)
    return path


def load_model(path: Path | None = None):
    """Load a persisted model bundle; raises if it has not been trained yet."""
    path = path or MODEL_PATH
    if not path.exists():
        raise FileNotFoundError(
            f"No model at {path}. Run `python scripts/train.py` first."
        )
    return joblib.load(path)


def predict_proba(bundle, features: pd.DataFrame) -> np.ndarray:
    """Return P(overflow within horizon) for each feature row."""
    model = bundle["model"]
    ordered = features[bundle["features"]]
    return model.predict_proba(ordered)[:, 1]
