"""Physics-based hydraulic routing engine (no training required).

A transparent conceptual rainfall-runoff + storage-routing model that predicts
overflow per outfall directly from rainfall and tank state. It exposes the same
per-hour interface as the ML model so the pipeline can swap engines.

For a fully calibrated network, replace `predict_series` with a SWMM run via
`pyswmm` that reads node flooding per outfall — the rest of the pipeline is
unchanged. (pyswmm is intentionally not a hard dependency here.)
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from cso_predictor.config import CONFIG, Config, Outfall


def overflow_volume(
    rain: pd.Series, tank_level: pd.Series, outfall: Outfall, *, config: Config = CONFIG
) -> np.ndarray:
    """Per-hour overflow depth (mm-equivalent) from a mass balance.

    Effective load = rainfall plus a saturation term (antecedent precipitation).
    The network conveys up to `capacity_mm`; the storage tank's free volume adds
    a buffer; anything beyond both spills.
    """
    rain_v = rain.to_numpy()
    api = _antecedent_index(rain_v, config.api_decay)
    load = rain_v + 0.5 * api

    cap = max(outfall.tank_capacity_m3, 1.0)
    headroom_frac = 1.0 - np.clip(tank_level.to_numpy() / cap, 0.0, 1.0)
    # Free storage expressed in the same mm-equivalent units as capacity.
    storage_buffer = headroom_frac * outfall.capacity_mm * 0.4

    spill = load - (outfall.capacity_mm * 0.6 + storage_buffer)
    return np.clip(spill, 0.0, None)


def predict_series(
    rain: pd.Series, tank_level: pd.Series, outfall: Outfall, *, config: Config = CONFIG
) -> np.ndarray:
    """Per-hour overflow risk in [0, 1] from the hydraulic margin.

    Same shape/units as the ML model's `predict_proba`, so it is a drop-in
    engine for the pipeline. Risk is a logistic of the spill margin severity.
    """
    rain_v = rain.to_numpy()
    api = _antecedent_index(rain_v, config.api_decay)
    load = rain_v + 0.5 * api

    cap = max(outfall.tank_capacity_m3, 1.0)
    headroom_frac = 1.0 - np.clip(tank_level.to_numpy() / cap, 0.0, 1.0)
    threshold = outfall.capacity_mm * (0.6 + 0.4 * headroom_frac)
    margin = load - threshold
    return 1.0 / (1.0 + np.exp(-1.2 * margin))


def _antecedent_index(rain: np.ndarray, decay: float) -> np.ndarray:
    api = np.zeros_like(rain)
    acc = 0.0
    for t in range(len(rain)):
        acc = decay * acc + rain[t]
        api[t] = acc
    return api
