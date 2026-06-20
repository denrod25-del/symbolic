"""Per-outfall decision thresholds, optionally loaded from a backtest.

Closes the loop: the backtest writes recommended operating points, and this
module turns them into `monitor / act / alert` bands the recommender uses,
falling back to the global config defaults for low-confidence outfalls.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from cso_predictor.config import CONFIG, Config
from cso_predictor.model import ARTIFACT_DIR

BACKTEST_PATH = ARTIFACT_DIR / "backtest.json"


@dataclass(frozen=True)
class Bands:
    """Probability cut-offs for the watch / act / alert risk bands."""

    watch: float
    act: float
    alert: float


def default_bands(config: Config = CONFIG) -> Bands:
    t = config.thresholds
    return Bands(watch=t.monitor, act=t.act, alert=t.alert)


def _bands_from_act(act: float) -> Bands:
    """Derive watch/alert bands around a tuned act threshold."""
    watch = max(0.05, round(act * 0.6, 2))
    alert = min(0.95, round(act + (1.0 - act) * 0.5, 2))
    return Bands(watch=min(watch, act), act=act, alert=max(alert, act))


def load_tuned_bands(
    path: Path = BACKTEST_PATH,
    *,
    config: Config = CONFIG,
    min_events: int = 10,
    min_precision: float = 0.4,
) -> dict[str, Bands]:
    """Build per-outfall bands from a backtest, falling back to defaults.

    An outfall keeps the global defaults unless its backtest has enough spill
    events and clears the precision floor — so low-confidence outfalls (few
    events) are not driven by an unreliable tuned threshold.
    """
    fallback = default_bands(config)
    bands = {o.id: fallback for o in config.outfalls}
    if not path.exists():
        return bands

    data = json.loads(path.read_text())
    for outfall_id, record in data.items():
        if outfall_id not in bands:
            continue
        op = record.get("operating_point", {})
        if (record.get("n_events", 0) >= min_events
                and op.get("precision", 0.0) >= min_precision):
            bands[outfall_id] = _bands_from_act(float(op["threshold"]))
    return bands
