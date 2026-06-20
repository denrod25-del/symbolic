"""Run one prediction cycle and print per-outfall risk and recommended actions."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cso_predictor.pipeline import run_cycle

_RISK_TAG = {"high": "[HIGH]", "elevated": "[ELEV]", "watch": "[WATCH]", "low": "[ low]"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Predict combined-sewer overflow risk")
    parser.add_argument("--hours", type=int, default=24, help="forecast horizon to scan")
    parser.add_argument("--offline", action="store_true",
                        help="skip the rainfall API and use a synthetic storm")
    args = parser.parse_args()

    recs = run_cycle(hours=args.hours, allow_network=not args.offline)

    print("\nCombined-Sewer Overflow risk (peak over forecast)\n" + "=" * 52)
    for r in recs:
        tag = _RISK_TAG.get(r.risk, r.risk)
        print(f"\n{tag} {r.outfall_id}  {r.name}")
        print(f"      P(overflow) = {r.probability:.0%}   lead time = {r.lead_time_h:.0f} h")
        for action in r.actions:
            print(f"        - {action}")
    print()


if __name__ == "__main__":
    main()
