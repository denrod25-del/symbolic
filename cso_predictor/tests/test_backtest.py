from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np

from cso_predictor.backtest import (
    backtest,
    lead_time_label,
    pick_operating_point,
    score_threshold,
    sweep_thresholds,
)
from cso_predictor.config import CONFIG
from cso_predictor.data import generate_history
from cso_predictor.features import make_training_matrix
from cso_predictor.model import save_model, train


def test_lead_time_label_requires_minimum_lead():
    spill = np.array([0, 0, 0, 1, 0, 0])
    # lead 2, horizon 3: at t=1 the spill at index 3 is 2h away -> actionable.
    label = lead_time_label(spill, lead_h=2, horizon_h=3)
    assert label[1]
    # at t=2 the spill is only 1h away (< lead) and none within [4,5] -> not actionable.
    assert not label[2]


def test_score_threshold_perfect_separation():
    proba = np.array([0.1, 0.2, 0.8, 0.9])
    y_lead = np.array([0, 0, 1, 1], dtype=bool)
    score = score_threshold(proba, y_lead, threshold=0.5, n_hours=4)
    assert score.precision == 1.0
    assert score.recall == 1.0
    assert score.fp == 0


def test_pick_operating_point_respects_precision_floor():
    proba = np.concatenate([np.full(50, 0.9), np.full(50, 0.1)])
    y_lead = np.concatenate([np.ones(50), np.zeros(50)]).astype(bool)
    scores = sweep_thresholds(proba, y_lead)
    op = pick_operating_point(scores, min_precision=0.9)
    assert op.precision >= 0.9


def test_backtest_runs_and_tunes_thresholds(tmp_path):
    history = generate_history(hours=24 * 60)
    x, y = make_training_matrix(history)
    model, _ = train(x, y)
    save_model(model, tmp_path / "model.joblib")

    import cso_predictor.model as model_module
    original = model_module.MODEL_PATH
    model_module.MODEL_PATH = tmp_path / "model.joblib"
    try:
        results = backtest(hours=24 * 60, seed=999)
    finally:
        model_module.MODEL_PATH = original

    assert len(results) == len(CONFIG.outfalls)
    for r in results:
        assert 0.05 <= r.operating_point.threshold <= 0.95
        assert 0.0 <= r.operating_point.recall <= 1.0
