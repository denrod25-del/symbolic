# CSO Predictor

Combined-Sewer Overflow (CSO) prediction. It combines a rainfall forecast with
per-catchment drainage capacity to predict overflow events at sewer outfalls in
the next few hours, and recommends preemptive actions (draw down storage,
reroute flow, alert operators).

This is the **ML-first** build: a gradient-boosting classifier trained on
features derived from rainfall and live sensor state. It ships with a synthetic
data generator so the whole pipeline runs end to end without any external data
or a calibrated hydraulic model.

## What's here

```
cso_predictor/
├── cso_predictor/        # library
│   ├── config.py         # outfalls + capacity table + thresholds
│   ├── ingestion.py      # rainfall forecast (Open-Meteo, offline fallback)
│   ├── data.py           # synthetic rainfall + sensor + label generator
│   ├── features.py       # antecedent precip index, rolling rain, dry-weather flow
│   ├── model.py          # train / predict (LightGBM or scikit-learn) + importance
│   ├── hydraulic.py      # physics-based engine (SWMM-swappable, no training)
│   ├── recommend.py      # probability -> preemptive actions
│   ├── tuning.py         # per-outfall thresholds from the backtest
│   ├── backtest.py       # lead-time-aware scoring + threshold sweep
│   └── pipeline.py       # forecast -> features -> predict -> recommend
├── scripts/
│   ├── train.py          # generate data, train, save model + metrics + importance
│   ├── predict.py        # run one forecast cycle, print risk + actions
│   └── backtest.py       # replay storms, tune thresholds, write backtest.json
├── serving/api.py        # FastAPI endpoint (optional dep)
├── dashboard/app.py      # Streamlit dashboard (optional dep)
└── tests/                # pytest unit tests
```

## Quickstart

```bash
cd cso_predictor
pip install -r requirements.txt

# 1. train on synthetic data (writes artifacts/model.joblib + metrics.json)
python scripts/train.py

# 2. run one prediction cycle (prints per-outfall risk + recommended actions)
python scripts/predict.py

# 3. backtest + tune decision thresholds (writes artifacts/backtest.json)
python scripts/backtest.py

# 4. predict using the tuned per-outfall thresholds
python scripts/predict.py --tuned

# or run the physics-based engine (no trained model needed)
python scripts/predict.py --engine hydraulic
```

Optional surfaces:

```bash
# REST API
pip install fastapi uvicorn
uvicorn serving.api:app --reload     # GET /predictions

# Dashboard
pip install streamlit plotly
streamlit run dashboard/app.py
```

## How it works

1. **Ingestion** pulls an hourly rainfall forecast per catchment. With network
   access it uses the free Open-Meteo API; offline it falls back to a synthetic
   storm so the pipeline always runs.
2. **Features** turn rainfall + sensor state into predictors. The strongest are
   the **Antecedent Precipitation Index** (how saturated the network already is),
   multi-window **rolling rainfall sums**, and **storage headroom**.
3. **Model** predicts `P(overflow in next 6h)` per outfall. CSO events are rare,
   so training uses class weighting and reports **precision/recall + PR-AUC**,
   not accuracy. Uses **LightGBM** when installed and falls back to scikit-learn's
   HistGradientBoosting otherwise; `train.py` also writes permutation
   **feature importance** to `artifacts/feature_importance.json`.
4. **Recommend** maps probability + asset state to concrete preemptive actions
   with the available lead time, using global or tuned per-outfall thresholds.

## Prediction engines

Two interchangeable engines produce the per-hour overflow risk:

- **`ml`** (default) — the trained boosting classifier.
- **`hydraulic`** — a transparent physics-based rainfall-runoff + storage-routing
  model that needs no training (`cso_predictor/hydraulic.py`). For a calibrated
  network, swap its `predict_series` for a SWMM run via `pyswmm` that reads node
  flooding per outfall; the rest of the pipeline is unchanged.

## Backtesting & threshold tuning

`scripts/backtest.py` replays an independent (unseen-seed) storm history and
scores predictions against a **lead-time-aware** label: an alarm at time *t* is
only credited if it fires at least the outfall's `lead_time_h` ahead of an
actual spill — i.e. early enough to act on. It sweeps decision thresholds and,
per outfall, recommends the threshold that maximises recall subject to a
precision floor (`--min-precision`, default 0.5), writing the full sweep to
`artifacts/backtest.json`.

Run `predict.py --tuned` to apply these per-outfall thresholds automatically
(loaded from `artifacts/backtest.json` via `cso_predictor/tuning.py`). Outfalls
with too few events or low precision (e.g. CSO-03 in the demo) safely fall back
to the global `config.py` bands rather than trusting an unreliable threshold — a
real, useful finding rather than a hidden risk.

## Notes

- Self-contained under `cso_predictor/`; it does not touch the JS/TS app.
- To go physics-based, swap `model.predict_proba` for a `pyswmm` SWMM run that
  reads predicted flooding per outfall — the rest of the pipeline is unchanged.
