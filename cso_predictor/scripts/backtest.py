"""Replay held-out storms, tune decision thresholds and report operating points."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cso_predictor.backtest import backtest
from cso_predictor.model import ARTIFACT_DIR


def main() -> None:
    parser = argparse.ArgumentParser(description="Backtest and tune CSO thresholds")
    parser.add_argument("--hours", type=int, default=24 * 180,
                        help="length of the held-out replay history")
    parser.add_argument("--seed", type=int, default=2024,
                        help="seed for the held-out storms (differs from training)")
    parser.add_argument("--min-precision", type=float, default=0.5,
                        help="precision floor when picking the operating point")
    args = parser.parse_args()

    results = backtest(hours=args.hours, seed=args.seed,
                       min_precision=args.min_precision)

    print("\nLead-time-aware backtest (held-out storms)\n" + "=" * 60)
    for r in results:
        op = r.operating_point
        print(f"\n{r.outfall_id}  {r.name}   ({r.n_events} spill events)")
        print(f"  recommended threshold = {op.threshold:.2f}")
        print(f"    precision {op.precision:.2f} | recall {op.recall:.2f} | "
              f"F1 {op.f1:.2f} | {op.false_alarms_per_day:.2f} false alarms/day")

    out = {r.outfall_id: r.to_dict() for r in results}
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    path = ARTIFACT_DIR / "backtest.json"
    path.write_text(json.dumps(out, indent=2))
    print(f"\nSaved full sweep -> {path}")


if __name__ == "__main__":
    main()
