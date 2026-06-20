"""Decision layer: map overflow probability + asset state to preemptive actions."""

from __future__ import annotations

from dataclasses import dataclass

from cso_predictor.config import CONFIG, Config, Outfall


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


def _risk_band(prob: float, config: Config) -> str:
    t = config.thresholds
    if prob >= t.alert:
        return "high"
    if prob >= t.act:
        return "elevated"
    if prob >= t.monitor:
        return "watch"
    return "low"


def recommend(
    outfall: Outfall,
    probability: float,
    tank_level_m3: float,
    *,
    config: Config = CONFIG,
) -> Recommendation:
    """Turn a single outfall's predicted probability + state into actions."""
    risk = _risk_band(probability, config)
    t = config.thresholds
    actions: list[str] = []

    if risk == "low":
        actions.append("Monitor — no action required")
        return Recommendation(outfall.id, outfall.name, probability, risk,
                              outfall.lead_time_h, actions)

    headroom = outfall.tank_capacity_m3 - tank_level_m3
    if outfall.tank_capacity_m3 > 0 and headroom >= t.min_headroom_m3:
        actions.append(
            f"Pre-empt: draw down storage tank now (~{headroom:.0f} m^3 free)"
        )
    elif outfall.tank_capacity_m3 > 0:
        actions.append("Storage near full — limited buffer, prioritise diversion")

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
) -> list[Recommendation]:
    """Build recommendations for every configured outfall, highest risk first."""
    by_id = {o.id: o for o in config.outfalls}
    recs = [
        recommend(by_id[oid], prob, tank_levels.get(oid, 0.0), config=config)
        for oid, prob in probabilities.items()
        if oid in by_id
    ]
    return sorted(recs, key=lambda r: r.probability, reverse=True)
