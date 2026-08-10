from __future__ import annotations

import sys
from dataclasses import replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import joblib

from cso_predictor.config import CONFIG
from cso_predictor.data import generate_history
from cso_predictor.features import build_feature_columns, make_training_matrix
from cso_predictor.model import predict_proba, save_model, train


def test_save_model_persists_custom_feature_schema(tmp_path):
    # Train with non-default rainfall windows so the schema differs from defaults.
    cfg = replace(CONFIG, rain_windows_h=(1, 2))
    history = generate_history(hours=24 * 60, config=cfg)
    x, y = make_training_matrix(history, config=cfg)
    model, _ = train(x, y, config=cfg)

    path = tmp_path / "model.joblib"
    save_model(model, path, features=list(x.columns))
    bundle = joblib.load(path)

    assert bundle["features"] == list(x.columns)
    assert bundle["features"] != build_feature_columns()  # not the defaults
    # The persisted schema lets predict_proba select the right columns.
    proba = predict_proba(bundle, x.head(10))
    assert len(proba) == 10


def test_save_model_recovers_schema_from_fitted_estimator(tmp_path):
    cfg = replace(CONFIG, rain_windows_h=(1, 2))
    history = generate_history(hours=24 * 60, config=cfg)
    x, y = make_training_matrix(history, config=cfg)
    model, _ = train(x, y, config=cfg)

    # No explicit features -> recovered from the fitted estimator, not defaults.
    path = tmp_path / "model.joblib"
    save_model(model, path)
    bundle = joblib.load(path)
    assert bundle["features"] == list(x.columns)
