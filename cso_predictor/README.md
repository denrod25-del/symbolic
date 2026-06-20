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
│   ├── model.py          # train / predict (scikit-learn, LightGBM-ready)
│   ├── recommend.py      # probability -> preemptive actions
│   └── pipeline.py       # forecast -> features -> predict -> recommend
├── scripts/
│   ├── train.py          # generate data, train, save model + metrics
│   └── predict.py        # run one forecast cycle, print risk + actions
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
   not accuracy.
4. **Recommend** maps probability + asset state to concrete preemptive actions
   with the available lead time.

## Notes

- Self-contained under `cso_predictor/`; it does not touch the JS/TS app.
- To go physics-based, swap `model.predict_proba` for a `pyswmm` SWMM run that
  reads predicted flooding per outfall — the rest of the pipeline is unchanged.
