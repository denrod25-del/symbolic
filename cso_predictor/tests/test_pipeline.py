from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cso_predictor.config import CONFIG
from cso_predictor.data import generate_history
from cso_predictor.features import make_training_matrix
from cso_predictor.model import predict_proba, save_model, train
from cso_predictor.pipeline import run_cycle


def test_train_and_run_cycle_offline(tmp_path):
    # Train a small model on a short synthetic history and persist it.
    history = generate_history(hours=24 * 60)
    x, y = make_training_matrix(history)
    model, metrics = train(x, y)
    assert 0.0 <= metrics.pr_auc <= 1.0

    bundle_path = tmp_path / "model.joblib"
    save_model(model, bundle_path)

    import cso_predictor.model as model_module
    original = model_module.MODEL_PATH
    model_module.MODEL_PATH = bundle_path
    try:
        recs = run_cycle(hours=24, allow_network=False)
    finally:
        model_module.MODEL_PATH = original

    assert len(recs) == len(CONFIG.outfalls)
    assert all(0.0 <= r.probability <= 1.0 for r in recs)


def test_predict_proba_in_unit_range():
    history = generate_history(hours=24 * 60)
    x, y = make_training_matrix(history)
    model, _ = train(x, y)
    bundle = {"model": model, "features": list(x.columns)}
    proba = predict_proba(bundle, x.head(50))
    assert proba.min() >= 0.0 and proba.max() <= 1.0
