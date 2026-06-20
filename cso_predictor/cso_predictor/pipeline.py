"""End-to-end inference: forecast -> features -> probability -> recommendation."""

from __future__ import annotations

import numpy as np
import pandas as pd

from cso_predictor.config import CONFIG, Config, Outfall
from cso_predictor.features import make_features
from cso_predictor.ingestion import fetch_rainfall_forecast
from cso_predictor.model import load_model, predict_proba
from cso_predictor.recommend import Recommendation, recommend_all


def estimate_tank_levels(rain: pd.Series, outfall: Outfall) -> pd.Series:
    """Estimate tank level over a rainfall series using simple fill/drain dynamics.

    Stands in for live SCADA tank telemetry in the demo. Mirrors the dynamics
    used to generate training data so train/serve stay consistent.
    """
    level = 0.0
    out = np.zeros(len(rain))
    for i, value in enumerate(rain.to_numpy()):
        inflow = value * outfall.tank_capacity_m3 * 0.04
        level = min(max(0.0, level + inflow - 25.0), outfall.tank_capacity_m3)
        out[i] = level
    return pd.Series(out, index=rain.index)


def run_cycle(
    *,
    hours: int = 24,
    allow_network: bool = True,
    config: Config = CONFIG,
) -> list[Recommendation]:
    """Run one prediction cycle and return recommendations per outfall.

    Headline risk for each outfall is the peak predicted probability across the
    forecast horizon; the tank level used for recommendations is taken at that
    peak hour.
    """
    bundle = load_model()
    forecast = fetch_rainfall_forecast(hours=hours, allow_network=allow_network)

    probabilities: dict[str, float] = {}
    tank_at_peak: dict[str, float] = {}
    for outfall in config.outfalls:
        rain = forecast[outfall.id]
        tank = estimate_tank_levels(rain, outfall)
        features = make_features(rain, tank, outfall, config=config)
        proba = predict_proba(bundle, features)

        peak = int(np.argmax(proba))
        probabilities[outfall.id] = float(proba[peak])
        tank_at_peak[outfall.id] = float(tank.iloc[peak])

    return recommend_all(probabilities, tank_at_peak, config=config)
