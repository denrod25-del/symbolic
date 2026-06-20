from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cso_predictor.config import CONFIG
from cso_predictor.tuning import default_bands, load_tuned_bands


def _write_backtest(path: Path, records: dict) -> None:
    path.write_text(json.dumps(records))


def test_missing_file_returns_defaults():
    bands = load_tuned_bands(Path("/no/such/backtest.json"))
    default = default_bands()
    assert all(b == default for b in bands.values())


def test_confident_outfall_uses_tuned_threshold(tmp_path):
    path = tmp_path / "backtest.json"
    _write_backtest(path, {
        "CSO-01": {"n_events": 30,
                   "operating_point": {"threshold": 0.6, "precision": 0.55}},
    })
    bands = load_tuned_bands(path)
    assert bands["CSO-01"].act == 0.6
    assert bands["CSO-01"].watch <= 0.6 <= bands["CSO-01"].alert


def test_low_confidence_outfall_falls_back_to_default(tmp_path):
    path = tmp_path / "backtest.json"
    _write_backtest(path, {
        "CSO-03": {"n_events": 3,
                   "operating_point": {"threshold": 0.85, "precision": 0.17}},
    })
    bands = load_tuned_bands(path)
    assert bands["CSO-03"] == default_bands()
