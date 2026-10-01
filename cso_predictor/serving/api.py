"""FastAPI surface for the CSO predictor (optional dependency).

Run with:  uvicorn serving.api:app --reload
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, Query

from cso_predictor.pipeline import run_cycle

app = FastAPI(title="CSO Predictor", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/predictions")
def predictions(
    hours: int = Query(24, ge=1, le=168),
    offline: bool = Query(False, description="use synthetic storm instead of the API"),
) -> dict:
    """Return per-outfall overflow risk and recommended actions."""
    recs = run_cycle(hours=hours, allow_network=not offline)
    return {"predictions": [r.to_dict() for r in recs]}
