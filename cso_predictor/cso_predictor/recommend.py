"""Decision layer: map overflow probability + asset state to preemptive actions."""

from __future__ import annotations

from dataclasses import dataclass

from cso_predictor.config import CONFIG, Config, Outfall
from cso_predictor.tuning import Bands, default_bands


@dataclass
class Recommendation:
    outfall_id: str
    name: str
    probability: float
    risk: str
    lead_time_h: float
    actions: list[str]

    def to_dict(self) -> dict:
        return {
            "outfall_id": self.outfall_id,
            "name": self.name,
            "probability": round(self.probability, 3),
            "risk": self.risk,
            "lead_time_h": self.lead_time_h,
            "actions": self.actions,
        }


def _risk_band(prob: float, bands: Bands) -> str:
    if prob >= bands.alert:
        return "high"
    if prob >= bands.act:
        return "elevated"
    if prob >= bands.watch:
        return "watch"
    return "low"


def recommend(
    outfall: Outfall,
    probability: float,
    tank_level_m3: float,
    *,
    config: Config = CONFIG,
    bands: Bands | None = None,
) -> Recommendation:
    """Turn a single outfall's predicted probability + state into actions.

    `bands` overrides the global config thresholds (e.g. tuned per-outfall
    values from a backtest); defaults to the config bands when omitted.
    """
    bands = bands or default_bands(config)
    risk = _risk_band(probability, bands)
    t = config.thresholds
    actions: list[str] = []

    if risk == "low":
        actions.append("Monitor — no action required")
        return Recommendation(outfall.id, outfall.name, probability, risk,
                              outfall.lead_time_h, actions)

    if outfall.tank_capacity_m3 > 0:
        stored = max(0.0, tank_level_m3)
        headroom = outfall.tank_capacity_m3 - stored
        if stored >= t.min_pumpable_m3:
            # Pumping out stored water creates buffer ahead of the storm.
            actions.append(
                f"Pre-empt: draw down storage tank now "
                f"(~{stored:.0f} m^3 stored) to free capacity"
            )
        elif headroom >= t.min_headroom_m3:
            actions.append(
                f"Storage has ~{headroom:.0f} m^3 free buffer — monitor level"
            )
        else:
            actions.append("Storage near full, little pumpable — prioritise diversion")

    if outfall.can_reroute and risk in ("elevated", "high"):
        actions.append("Open interconnector to divert flow to spare capacity")

    actions.append(
        f"Notify duty operator (lead time {outfall.lead_time_h:.0f} h)"
    )
    if risk == "high":
        actions.append("Issue environmental discharge pre-alert")

    return Recommendation(outfall.id, outfall.name, probability, risk,
                          outfall.lead_time_h, actions)


def recommend_all(
    probabilities: dict[str, float],
    tank_levels: dict[str, float],
    *,
    config: Config = CONFIG,
    bands_by_id: dict[str, Bands] | None = None,
) -> list[Recommendation]:
    """Build recommendations for every configured outfall, highest risk first.

    `bands_by_id` supplies per-outfall thresholds (e.g. from `load_tuned_bands`);
    outfalls without an entry use the global config bands.
    """
    by_id = {o.id: o for o in config.outfalls}
    recs = [
        recommend(
            by_id[oid], prob, tank_levels.get(oid, 0.0), config=config,
            bands=(bands_by_id or {}).get(oid),
        )
        for oid, prob in probabilities.items()
        if oid in by_id
    ]
    return sorted(recs, key=lambda r: r.probability, reverse=True)
