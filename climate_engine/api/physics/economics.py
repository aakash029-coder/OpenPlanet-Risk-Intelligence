"""
climate_engine/api/physics/economics.py — Burke (2018) + ILO economic damage model.
"""
from __future__ import annotations


def apply_burke_formula(gdp_share: float, t_mean: float) -> float:
    """
    Simplified Burke (2018) macroeconomic damage function.
    Optimum annual temperature is ~13C. Only apply chronic heat penalty
    when annual mean exceeds the 13C optimum.
    """
    # Only apply chronic heat penalty when annual mean exceeds the 13°C optimum
    if t_mean <= 13.0:
        return 0.0
    temp_diff = t_mean - 13.0
    penalty_pct = (0.0127 * (temp_diff ** 2)) / 100.0
    return gdp_share * penalty_pct


def compute_hybrid_economic_loss(
    city_gdp: float,
    t_mean: float,
    tx5d: float,
    hw_days: float,
) -> float:
    """
    Resolves economic damages using a bipartite modeling approach:
    1. Baseline chronic heat operation (applies when annual t_mean > 13°C)
    2. Acute heatwave shock (applies to every city with heatwave days exceeding local adaptation threshold)
    """
    total_days = 365
    hw_days_capped = min(365.0, max(0.0, float(hw_days)))
    normal_days = total_days - hw_days_capped

    # 1. Baseline chronic heat operation (applies when annual t_mean > 13°C)
    normal_economy_share = (normal_days / total_days) * city_gdp
    baseline_loss = apply_burke_formula(normal_economy_share, t_mean)

    # 2. Acute heatwave shock (applies to every city with heatwave days)
    extreme_economy_share = (hw_days_capped / total_days) * city_gdp

    # Local acclimatization threshold: 26°C for cool cities, scaling up to 34°C for hot cities
    adaptation_threshold = min(34.0, max(26.0, t_mean + 8.0))

    if tx5d > adaptation_threshold:
        # ILO-aligned productivity & infrastructure disruption per °C above local threshold
        heat_penalty_pct = (tx5d - adaptation_threshold) * 0.012
        extreme_loss = extreme_economy_share * heat_penalty_pct
    else:
        extreme_loss = apply_burke_formula(extreme_economy_share, t_mean)

    return baseline_loss + extreme_loss
