"""Synthetic training data.

Generates a long hourly history of rainfall, sensor state (tank level) and a
physically-motivated overflow label per outfall, so the ML pipeline can be
trained and evaluated without real telemetry.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

from cso_predictor.config import CONFIG, Config


def generate_history(hours: int = 24 * 365, *, config: Config = CONFIG) -> pd.DataFrame:
    """Return a long-format history with one row per (timestamp, outfall).

    Columns: timestamp, outfall_id, rain_mm, tank_level_m3, overflow.
    `overflow` is 1 if the outfall spills within the next `horizon_h` hours.
    """
    rng = np.random.default_rng(config.random_seed)
    start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    start -= timedelta(hours=hours)
    index = pd.DatetimeIndex([start + timedelta(hours=h) for h in range(hours)])

    frames = []
    for outfall in config.outfalls:
        rain = _simulate_rain(hours, rng)
        api = _antecedent_index(rain, config.api_decay)

        # Tank fills with rainfall-driven inflow and slowly drains.
        tank = np.zeros(hours)
        level = 0.0
        for t in range(hours):
            inflow = rain[t] * outfall.tank_capacity_m3 * 0.04
            level = max(0.0, level + inflow - 25.0)  # constant pump-out
            level = min(level, outfall.tank_capacity_m3)
            tank[t] = level

        # Instantaneous spill pressure: rainfall + saturation + full storage,
        # relative to catchment capacity. Converted to a probability + sampled.
        headroom = 1.0 - (tank / max(outfall.tank_capacity_m3, 1.0))
        load = rain + 0.5 * api
        margin = load - outfall.capacity_mm * (0.6 + 0.4 * headroom)
        spill_prob = 1.0 / (1.0 + np.exp(-1.2 * margin))
        spill = rng.uniform(size=hours) < spill_prob

        # Label = spill occurs within the forecast horizon.
        label = _future_any(spill, config.horizon_h)

        frames.append(pd.DataFrame({
            "timestamp": index,
            "outfall_id": outfall.id,
            "rain_mm": np.round(rain, 3),
            "tank_level_m3": np.round(tank, 2),
            "overflow": label.astype(int),
        }))

    return pd.concat(frames, ignore_index=True)


def _simulate_rain(hours: int, rng: np.random.Generator) -> np.ndarray:
    """Intermittent hourly rainfall: dry spells punctuated by storms."""
    rain = np.zeros(hours)
    t = 0
    while t < hours:
        dry = rng.integers(12, 96)  # dry spell, hours
        t += dry
        if t >= hours:
            break
        duration = rng.integers(2, 10)
        intensity = rng.gamma(shape=2.0, scale=2.5)
        for k in range(duration):
            if t + k >= hours:
                break
            rain[t + k] += intensity * rng.uniform(0.3, 1.0)
        t += duration
    return rain


def _antecedent_index(rain: np.ndarray, decay: float) -> np.ndarray:
    """Antecedent Precipitation Index: decaying memory of past rainfall."""
    api = np.zeros_like(rain)
    acc = 0.0
    for t in range(len(rain)):
        acc = decay * acc + rain[t]
        api[t] = acc
    return api


def _future_any(spill: np.ndarray, horizon: int) -> np.ndarray:
    """True at t if a spill occurs at any of t+1 .. t+horizon."""
    n = len(spill)
    out = np.zeros(n, dtype=bool)
    for t in range(n):
        end = min(n, t + 1 + horizon)
        out[t] = spill[t + 1:end].any()
    return out
