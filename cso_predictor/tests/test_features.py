from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd

from cso_predictor.config import CONFIG
from cso_predictor.features import antecedent_index, build_feature_columns, make_features


def _series(values: list[float]) -> pd.Series:
    index = pd.date_range("2024-01-01", periods=len(values), freq="h")
    return pd.Series(values, index=index)


def test_antecedent_index_decays_past_rainfall():
    api = antecedent_index(_series([10.0, 0.0, 0.0]), decay=0.5)
    assert api.iloc[0] == 10.0
    assert api.iloc[1] == 5.0
    assert api.iloc[2] == 2.5


def test_make_features_returns_expected_columns():
    rain = _series([1.0, 2.0, 0.0, 4.0])
    tank = _series([0.0, 50.0, 80.0, 120.0])
    feats = make_features(rain, tank, CONFIG.outfalls[0])
    assert list(feats.columns) == build_feature_columns()
    assert len(feats) == 4


def test_rolling_rain_sum_uses_window():
    rain = _series([1.0, 2.0, 3.0, 4.0])
    feats = make_features(rain, _series([0.0] * 4), CONFIG.outfalls[0])
    # 3-hour rolling sum at the last step covers 2+3+4.
    assert feats["rain_3h"].iloc[-1] == 9.0
