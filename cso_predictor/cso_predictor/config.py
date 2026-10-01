"""Network configuration: outfalls, drainage capacity and decision thresholds.

In a real deployment this comes from the asset register / hydraulic model. Here
it is a small static table so the pipeline is fully self-contained.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Outfall:
    """A combined-sewer overflow point and the catchment draining to it."""

    id: str
    name: str
    # Catchment runoff capacity before the network spills, in mm of rainfall
    # accumulated over the response window. Higher = more headroom.
    capacity_mm: float
    # Storage tank associated with the outfall, in m^3 (0.0 = no storage asset).
    tank_capacity_m3: float
    # Hours of lead time operators need to act on an alert.
    lead_time_h: float
    # Whether flow can be diverted to a neighbouring catchment with spare capacity.
    can_reroute: bool


@dataclass(frozen=True)
class Thresholds:
    """Probability cut-offs that drive the recommendation layer."""

    monitor: float = 0.30
    act: float = 0.50
    alert: float = 0.70
    # Minimum free tank volume (m^3) to count as a useful existing buffer.
    min_headroom_m3: float = 50.0
    # Minimum stored (pumpable) volume (m^3) worth drawing down preemptively.
    min_pumpable_m3: float = 50.0


@dataclass(frozen=True)
class Config:
    outfalls: list[Outfall]
    thresholds: Thresholds = field(default_factory=Thresholds)
    # Forecast / response window the model predicts over.
    horizon_h: int = 6
    # Antecedent Precipitation Index decay (0-1); higher = longer memory.
    api_decay: float = 0.90
    # Rolling rainfall windows (hours) used as features.
    rain_windows_h: tuple[int, ...] = (1, 3, 6, 24)
    random_seed: int = 42


CONFIG = Config(
    outfalls=[
        Outfall("CSO-01", "Riverside Interceptor", capacity_mm=18.0,
                tank_capacity_m3=400.0, lead_time_h=3.0, can_reroute=True),
        Outfall("CSO-02", "Mill Lane Weir", capacity_mm=12.0,
                tank_capacity_m3=120.0, lead_time_h=2.0, can_reroute=False),
        Outfall("CSO-03", "Harbour Outfall", capacity_mm=25.0,
                tank_capacity_m3=0.0, lead_time_h=4.0, can_reroute=True),
    ],
)
