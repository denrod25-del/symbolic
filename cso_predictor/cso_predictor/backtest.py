"""Lead-time-aware backtesting and threshold tuning.

Replays a held-out storm history, scores predictions against a *lead-time-aware*
label (an alarm only counts if it fires early enough to act), sweeps decision
thresholds, and recommends an operating point per outfall.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from cso_predictor.config import CONFIG, Config
from cso_predictor.data import generate_history
from cso_predictor.features import make_features
from cso_predictor.model import load_model, predict_proba


def lead_time_label(spill: np.ndarray, lead_h: int, horizon_h: int) -> np.ndarray:
    """Actionable label: True at t if a spill occurs in [t+lead_h, t+horizon_h].

    Requiring the spill to be at least `lead_h` hours away means a prediction at
    t can only be credited if it leaves enough time to act.
    """
    n = len(spill)
    out = np.zeros(n, dtype=bool)
    for t in range(n):
        start = min(n, t + lead_h)
        end = min(n, t + horizon_h + 1)
        if start < end:
            out[t] = spill[start:end].any()
    return out


@dataclass
class ThresholdScore:
    threshold: float
    precision: float
    recall: float
    f1: float
    false_alarms_per_day: float
    tp: int
    fp: int
    fn: int

    def to_dict(self) -> dict:
        return {
            "threshold": round(self.threshold, 3),
            "precision": round(self.precision, 4),
            "recall": round(self.recall, 4),
            "f1": round(self.f1, 4),
            "false_alarms_per_day": round(self.false_alarms_per_day, 3),
            "tp": self.tp, "fp": self.fp, "fn": self.fn,
        }


def score_threshold(
    proba: np.ndarray, y_lead: np.ndarray, threshold: float, n_hours: int
) -> ThresholdScore:
    """Confusion-based metrics for one threshold on lead-time-aware labels."""
    pred = proba >= threshold
    tp = int(np.sum(pred & y_lead))
    fp = int(np.sum(pred & ~y_lead))
    fn = int(np.sum(~pred & y_lead))
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    fa_per_day = fp / (n_hours / 24) if n_hours else 0.0
    return ThresholdScore(threshold, precision, recall, f1, fa_per_day, tp, fp, fn)


def sweep_thresholds(
    proba: np.ndarray, y_lead: np.ndarray, *, steps: int = 19
) -> list[ThresholdScore]:
    """Score a grid of thresholds from 0.05 to 0.95."""
    n = len(proba)
    grid = np.linspace(0.05, 0.95, steps)
    return [score_threshold(proba, y_lead, float(t), n) for t in grid]


def pick_operating_point(
    scores: list[ThresholdScore], *, min_precision: float = 0.5
) -> ThresholdScore:
    """Choose the threshold maximising recall subject to a precision floor.

    Falls back to the best-F1 threshold if no point clears the precision floor.
    """
    feasible = [s for s in scores if s.precision >= min_precision]
    if feasible:
        return max(feasible, key=lambda s: (s.recall, s.f1))
    return max(scores, key=lambda s: s.f1)


@dataclass
class OutfallBacktest:
    outfall_id: str
    name: str
    n_events: int
    operating_point: ThresholdScore
    sweep: list[ThresholdScore]

    def to_dict(self) -> dict:
        return {
            "outfall_id": self.outfall_id,
            "name": self.name,
            "n_events": self.n_events,
            "operating_point": self.operating_point.to_dict(),
            "sweep": [s.to_dict() for s in self.sweep],
        }


def backtest(
    *,
    hours: int = 24 * 180,
    seed: int = 2024,
    min_precision: float = 0.5,
    config: Config = CONFIG,
) -> list[OutfallBacktest]:
    """Replay a held-out history and return a per-outfall backtest.

    `seed` differs from the training seed so the storms are unseen.
    """
    bundle = load_model()
    history = generate_history(hours=hours, config=config, seed=seed)
    by_id = {o.id: o for o in config.outfalls}

    results: list[OutfallBacktest] = []
    for outfall_id, group in history.groupby("outfall_id"):
        outfall = by_id[outfall_id]
        group = group.sort_values("timestamp").set_index("timestamp")
        features = make_features(
            group["rain_mm"], group["tank_level_m3"], outfall, config=config
        )
        proba = predict_proba(bundle, features)

        spill = group["spill"].to_numpy()
        lead_h = round(outfall.lead_time_h)
        y_lead = lead_time_label(spill, lead_h, config.horizon_h)

        sweep = sweep_thresholds(proba, y_lead)
        op = pick_operating_point(sweep, min_precision=min_precision)
        results.append(OutfallBacktest(
            outfall_id=outfall_id,
            name=outfall.name,
            n_events=int(_count_events(spill)),
            operating_point=op,
            sweep=sweep,
        ))
    return results


def _count_events(spill: np.ndarray) -> int:
    """Count distinct spill events (clusters of consecutive spill hours)."""
    if len(spill) == 0:
        return 0
    starts = spill & ~np.concatenate([[False], spill[:-1].astype(bool)])
    return int(np.sum(starts))
