"""Rainfall forecast ingestion.

Uses the free Open-Meteo API when the network is reachable; otherwise falls back
to a synthetic storm so the pipeline always produces a forecast.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

from cso_predictor.config import CONFIG

# Approximate catchment centroids (lat, lon) for the demo outfalls.
_CATCHMENT_COORDS = {
    "CSO-01": (51.45, -2.59),
    "CSO-02": (51.46, -2.60),
    "CSO-03": (51.44, -2.62),
}

_OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def fetch_rainfall_forecast(hours: int = 24, *, allow_network: bool = True) -> pd.DataFrame:
    """Return an hourly rainfall forecast (mm) per outfall.

    The frame is indexed by timestamp with one column per outfall id. Falls back
    to a synthetic storm if the network is unavailable or disabled.
    """
    if allow_network:
        frame = _try_open_meteo(hours)
        if frame is not None:
            return frame
    return synthetic_forecast(hours)


def _try_open_meteo(hours: int) -> pd.DataFrame | None:
    try:
        import requests
    except ImportError:
        return None

    series: dict[str, pd.Series] = {}
    index: pd.DatetimeIndex | None = None
    for outfall_id, (lat, lon) in _CATCHMENT_COORDS.items():
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "precipitation",
            "forecast_days": max(1, (hours + 23) // 24),
        }
        try:
            resp = requests.get(_OPEN_METEO_URL, params=params, timeout=8)
            resp.raise_for_status()
            hourly = resp.json()["hourly"]
        except Exception:
            return None
        times = pd.to_datetime(hourly["time"])
        values = np.asarray(hourly["precipitation"], dtype=float)
        if index is None:
            index = times[:hours]
        series[outfall_id] = pd.Series(values[:hours], index=times[:hours])

    if index is None:
        return None
    return pd.DataFrame(series).reindex(index)


def synthetic_forecast(hours: int = 24, *, seed: int | None = None) -> pd.DataFrame:
    """Generate a plausible hourly storm hyetograph per outfall."""
    rng = np.random.default_rng(CONFIG.random_seed if seed is None else seed)
    start = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    index = pd.DatetimeIndex([start + timedelta(hours=h) for h in range(hours)])

    series: dict[str, np.ndarray] = {}
    for outfall in CONFIG.outfalls:
        rain = np.zeros(hours)
        # One or two convective bursts of a few hours each.
        for _ in range(rng.integers(1, 3)):
            peak = rng.integers(0, hours)
            width = rng.integers(2, 5)
            intensity = rng.uniform(2.0, 9.0)
            window = np.exp(-0.5 * ((np.arange(hours) - peak) / width) ** 2)
            rain += intensity * window
        rain += rng.uniform(0.0, 0.3, hours)  # drizzle baseline
        series[outfall.id] = np.round(rain, 3)
    return pd.DataFrame(series, index=index)
