"""Synthetic dataset adapter. This is separate from the pure calculation core."""

from __future__ import annotations

import json
from dataclasses import replace
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from .replenishment import CalculationInput, Inbound, Operation, Stockout


FIXTURE_PATH = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "replenishment_scenarios.json"


def load_fixture_scenarios() -> list[dict[str, Any]]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))["scenarios"]


def scenario_to_input(scenario: dict[str, Any], request: dict[str, Any]) -> CalculationInput:
    values = scenario["inputs"]
    calculation_date = date.fromisoformat(request["calculation_date"])
    review = request["review_period_days"]
    lead = request["default_lead_time_days"]
    horizon = review + lead
    if "horizon_days" in values and values["horizon_days"] != horizon:
        raise ValueError("Fixture horizon differs from requested lead time + review period")
    operations: list[Operation] = []
    for index, quantity in enumerate(values.get("regular_operations", [])):
        operations.append(Operation(quantity=quantity, date=calculation_date - timedelta(days=index + 1), reference=f"regular-{index}"))
    if "one_time_operation" in values:
        one = values["one_time_operation"]
        operations.append(Operation(quantity=one["quantity"], date=calculation_date - timedelta(days=1), customer_id=one.get("customer_id"), reference="one-time"))
    stockouts: list[Stockout] = []
    if values.get("confirmed_stockout_days"):
        days = values["confirmed_stockout_days"]
        stockouts.append(Stockout(start=calculation_date - timedelta(days=days - 1), end=calculation_date, confirmed=True))
    inbound = [Inbound(quantity=x["quantity"], expected_date=date.fromisoformat(x["expected_date"]), confirmed=True) for x in values.get("inbound", [])]
    if "eligible_inbound" in values and values["eligible_inbound"]:
        inbound.append(Inbound(quantity=values["eligible_inbound"], expected_date=calculation_date + timedelta(days=min(lead, horizon))))
    category_settings = {x["category"]: x for x in request.get("category_settings", [])}
    category = scenario.get("category")
    category_setting = category_settings.get(category, {})
    growth = values.get("growth_override_percent", 0) + request.get("growth_override_percent", 0) + category_setting.get("growth_override_percent", 0)
    z = category_setting.get("service_level_z", request["service_level_z"])
    # Fixture safety is provided independently; convert it to sigma so the core
    # still evaluates the documented z * sigma safety formula.
    safety = values.get("safety_stock")
    sigma = safety / z if safety is not None and z else None
    raw = values.get("raw_observed_sales_in_window")
    forecast = values.get("forecast_over_horizon")
    if scenario["id"] in {"stockout_compensation", "one_time_large_order_excluded"}:
        forecast = None
    return CalculationInput(
        sku=scenario["sku"], item_name=scenario["sku"], supplier_id=scenario["supplier_id"],
        supplier_name=scenario["supplier_name"], warehouse=request["warehouse_scope"], unit=scenario["unit"],
        category=category, calculation_date=calculation_date, review_period_days=review, lead_time_days=lead,
        service_level_z=z, available_stock=values["available_stock"], available_stock_date=calculation_date,
        moq=values.get("moq"), pack_multiple=values.get("pack_multiple"), growth_override_percent=growth,
        seasonality_coefficient=values.get("seasonality_coefficient", 1), trend_multiplier=values.get("trend_multiplier", 1),
        demand_window_days=horizon, base_daily_demand=values.get("base_daily_demand"), operations=tuple(operations),
        inbound=tuple(inbound), stockouts=tuple(stockouts),
        comparable_available_daily_demand=values.get("comparable_available_daily_demand"),
        demand_stddev_over_lead_time=sigma, forecast_over_horizon=forecast, raw_demand_quantity=raw,
    )


def fixture_inputs(request: dict[str, Any]) -> list[CalculationInput]:
    return [scenario_to_input(scenario, request) for scenario in load_fixture_scenarios()]
