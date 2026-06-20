from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cso_predictor.config import CONFIG
from cso_predictor.recommend import recommend, recommend_all


def _outfall(oid: str):
    return next(o for o in CONFIG.outfalls if o.id == oid)


def test_low_probability_recommends_monitor_only():
    rec = recommend(_outfall("CSO-01"), probability=0.05, tank_level_m3=0.0)
    assert rec.risk == "low"
    assert rec.actions == ["Monitor — no action required"]


def test_high_probability_includes_drawdown_and_alert():
    rec = recommend(_outfall("CSO-01"), probability=0.9, tank_level_m3=0.0)
    assert rec.risk == "high"
    joined = " ".join(rec.actions)
    assert "draw down" in joined
    assert "pre-alert" in joined


def test_outfall_without_reroute_omits_diversion():
    rec = recommend(_outfall("CSO-02"), probability=0.8, tank_level_m3=0.0)
    assert all("interconnector" not in a for a in rec.actions)


def test_recommend_all_sorted_by_probability_desc():
    recs = recommend_all(
        {"CSO-01": 0.2, "CSO-02": 0.9, "CSO-03": 0.5},
        {"CSO-01": 0.0, "CSO-02": 0.0, "CSO-03": 0.0},
    )
    probs = [r.probability for r in recs]
    assert probs == sorted(probs, reverse=True)
