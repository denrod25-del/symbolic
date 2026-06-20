from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd

from cso_predictor.config import CONFIG
from cso_predictor.hydraulic import overflow_volume, predict_series


def _series(values: list[float]) -> pd.Series:
    index = pd.date_range("2024-01-01", periods=len(values), freq="h")
    return pd.Series(values, index=index)


def test_dry_weather_gives_near_zero_risk():
    rain = _series([0.0] * 12)
    tank = _series([0.0] * 12)
    risk = predict_series(rain, tank, CONFIG.outfalls[0])
    assert risk.max() < 0.2


def test_heavy_rain_drives_high_risk_and_overflow():
    rain = _series([0.0, 0.0, 30.0, 30.0, 30.0])
    tank = _series([0.0] * 5)
    risk = predict_series(rain, tank, CONFIG.outfalls[0])
    vol = overflow_volume(rain, tank, CONFIG.outfalls[0])
    assert risk.max() > 0.9
    assert vol.max() > 0.0


def test_full_tank_increases_risk_vs_empty():
    rain = _series([0.0, 0.0, 12.0, 12.0])
    empty = predict_series(rain, _series([0.0] * 4), CONFIG.outfalls[0])
    full_level = CONFIG.outfalls[0].tank_capacity_m3
    full = predict_series(rain, _series([full_level] * 4), CONFIG.outfalls[0])
    assert full.max() >= empty.max()
