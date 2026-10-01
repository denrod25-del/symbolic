"""Streamlit dashboard for the CSO predictor (optional dependency).

Run with:  streamlit run dashboard/app.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
import streamlit as st

from cso_predictor.config import CONFIG
from cso_predictor.ingestion import fetch_rainfall_forecast
from cso_predictor.pipeline import run_cycle

st.set_page_config(page_title="CSO Predictor", layout="wide")
st.title("Combined-Sewer Overflow Predictor")

offline = st.sidebar.checkbox("Offline (synthetic storm)", value=True)
hours = st.sidebar.slider("Forecast horizon (h)", 6, 72, 24)

_RISK_COLOR = {"high": "🔴", "elevated": "🟠", "watch": "🟡", "low": "🟢"}

try:
    recs = run_cycle(hours=hours, allow_network=not offline)
except FileNotFoundError as exc:
    st.error(f"{exc}")
    st.stop()

st.subheader("Risk by outfall (peak over forecast)")
cols = st.columns(len(recs))
for col, r in zip(cols, recs):
    col.metric(f"{_RISK_COLOR[r.risk]} {r.outfall_id}", f"{r.probability:.0%}", r.risk)

for r in recs:
    with st.expander(f"{_RISK_COLOR[r.risk]} {r.outfall_id} — {r.name} ({r.probability:.0%})"):
        st.write(f"Lead time: {r.lead_time_h:.0f} h")
        for action in r.actions:
            st.write(f"- {action}")

st.subheader("Rainfall forecast (mm/h)")
forecast = fetch_rainfall_forecast(hours=hours, allow_network=not offline)
st.line_chart(pd.DataFrame(forecast))
