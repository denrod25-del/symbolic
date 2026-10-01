"""Feature engineering shared by training and inference.

Turns a per-outfall hourly rainfall + tank series into the predictors the model
consumes. Keeping this in one place guarantees train/serve parity.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from cso_predictor.config import CONFIG, Config, Outfall

FEATURE_COLUMNS = None  # populated lazily from build_feature_columns()


def build_feature_columns(config: Config = CONFIG) -> list[str]:
    """Return the ordered feature column names the model expects."""
    cols = ["rain_mm", "api", "tank_level_m3", "headroom_frac",
            "capacity_mm", "hour_sin", "hour_cos", "dow"]
    cols += [f"rain_{w}h" for w in config.rain_windows_h]
    return cols


def antecedent_index(rain: pd.Series, decay: float) -> pd.Series:
    """Decaying-memory Antecedent Precipitation Index over a rainfall series."""
    out = np.zeros(len(rain))
    acc = 0.0
    for i, value in enumerate(rain.to_numpy()):
        acc = decay * acc + value
        out[i] = acc
    return pd.Series(out, index=rain.index)


def make_features(
    rain: pd.Series,
    tank_level: pd.Series,
    outfall: Outfall,
    *,
    config: Config = CONFIG,
) -> pd.DataFrame:
    """Build the feature frame for one outfall from aligned rainfall + tank series.

    `rain` and `tank_level` are timestamp-indexed hourly series. Returns a frame
    with `FEATURE_COLUMNS`, one row per timestamp.
    """
    frame = pd.DataFrame(index=rain.index)
    frame["rain_mm"] = rain.to_numpy()
    frame["api"] = antecedent_index(rain, config.api_decay).to_numpy()
    frame["tank_level_m3"] = tank_level.to_numpy()

    cap = max(outfall.tank_capacity_m3, 1.0)
    frame["headroom_frac"] = 1.0 - (tank_level.to_numpy() / cap)
    frame["capacity_mm"] = outfall.capacity_mm

    hour = rain.index.hour.to_numpy()
    frame["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    frame["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    frame["dow"] = rain.index.dayofweek.to_numpy()

    for window in config.rain_windows_h:
        frame[f"rain_{window}h"] = (
            rain.rolling(window, min_periods=1).sum().to_numpy()
        )

    return frame[build_feature_columns(config)]


def make_training_matrix(history: pd.DataFrame, *, config: Config = CONFIG):
    """Build (X, y) from a long-format history produced by `data.generate_history`."""
    by_id = {o.id: o for o in config.outfalls}
    feature_frames, labels = [], []
    for outfall_id, group in history.groupby("outfall_id"):
        group = group.sort_values("timestamp").set_index("timestamp")
        feats = make_features(
            group["rain_mm"], group["tank_level_m3"], by_id[outfall_id],
            config=config,
        )
        feature_frames.append(feats)
        labels.append(group["overflow"])

    x = pd.concat(feature_frames, ignore_index=True)
    y = pd.concat(labels, ignore_index=True)
    return x, y


FEATURE_COLUMNS = build_feature_columns()
