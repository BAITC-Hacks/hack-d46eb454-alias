"""Each agreed fixture is a separate, independently specified check."""

import json
from dataclasses import replace
from datetime import date, timedelta
from pathlib import Path

import pytest

from backend.fixtures import scenario_to_input
from backend.replenishment import Inbound, Operation, calculate_item, group_by_supplier


DATA = json.loads((Path(__file__).parents[1] / "fixtures" / "replenishment_scenarios.json").read_text(encoding="utf-8"))
REQUEST = {
    "dataset_id": "synthetic-fixtures", "calculation_date": DATA["calculation_date"],
    "warehouse_scope": DATA["defaults"]["warehouse"],
    "review_period_days": DATA["defaults"]["review_period_days"],
    "default_lead_time_days": DATA["defaults"]["lead_time_days"],
    "service_level_z": DATA["defaults"]["service_level_z"],
}


@pytest.mark.parametrize("scenario", DATA["scenarios"], ids=lambda x: x["id"])
def test_agreed_scenario(scenario):
    item = calculate_item(scenario_to_input(scenario, REQUEST))
    expected = scenario["expected"]
    components = item["components"]
    for key in ("forecast_over_horizon", "excluded_outlier_quantity", "net_need_before_rounding", "rounding_delta"):
        if key in expected:
            assert components[key] == pytest.approx(expected[key]), f"{scenario['id']} {key}"
    assert item["recommended_quantity"] == pytest.approx(expected["recommended_quantity"])
    for flag in expected.get("flags", []):
        assert flag in item["flags"]
    for number in expected.get("explanation_contains", []):
        assert str(number) in item["explanation"]
    if "eligible_inbound" in expected:
        assert sum(x["quantity"] for x in components["eligible_inbound"] if x["included"]) == expected["eligible_inbound"]
    if "ignored_late_inbound" in expected:
        assert sum(x["quantity"] for x in components["eligible_inbound"] if not x["included"]) == expected["ignored_late_inbound"]
    if "increase_vs_raw_sales_calculation" in expected:
        assert item["recommended_quantity"] - (
            scenario["inputs"]["forecast_over_horizon_without_stockout"] + scenario["inputs"]["safety_stock"] - scenario["inputs"]["available_stock"]
        ) == expected["increase_vs_raw_sales_calculation"]
    if "flat_average_forecast_without_seasonality" in expected:
        assert scenario["inputs"]["base_daily_demand"] * components["horizon_days"] == expected["flat_average_forecast_without_seasonality"]
        assert components["forecast_over_horizon"] > expected["flat_average_forecast_without_seasonality"]
    if "max_allowed_forecast_change_vs_without_outlier" in expected:
        assert abs(components["forecast_over_horizon"] - scenario["inputs"]["expected_regular_forecast_over_horizon"]) <= expected["max_allowed_forecast_change_vs_without_outlier"]
    if "supplier_group_key" in expected:
        groups = group_by_supplier([item])
        assert groups[0]["supplier_id"] == expected["supplier_group_key"]
    for sensitivity in expected.get("sensitivity_checks", []):
        field, increment = sensitivity["change"].split(" + ")
        changed = dict(scenario)
        changed["inputs"] = dict(scenario["inputs"], **{field: scenario["inputs"][field] + int(increment)})
        changed_item = calculate_item(scenario_to_input(changed, REQUEST))
        assert changed_item["recommended_quantity"] == sensitivity["expected_recommended_quantity"]


def test_zero_need_stays_zero_despite_moq():
    scenario = next(x for x in DATA["scenarios"] if x["id"] == "supplier_grouping_explanation_moq")
    item_input = scenario_to_input(scenario, REQUEST)
    result = calculate_item(replace(item_input, available_stock=1000))
    assert result["recommended_quantity"] == 0


def test_missing_stock_preserves_forecast_without_inventing_order():
    scenario = DATA["scenarios"][0]
    result = calculate_item(replace(scenario_to_input(scenario, REQUEST), available_stock=None))
    assert result["components"]["forecast_over_horizon"] > 0
    assert result["components"]["available_stock"] is None
    assert result["recommended_quantity"] is None
    assert result["components"]["net_need_before_rounding"] is None
    assert result["urgency"] == "unknown"


def test_unconfirmed_stockout_does_not_increase_demand():
    scenario = next(x for x in DATA["scenarios"] if x["id"] == "stockout_compensation")
    source = scenario_to_input(scenario, REQUEST)
    result = calculate_item(replace(source, stockouts=()))
    assert result["components"]["lost_demand_estimate_quantity"] == 0
    assert result["recommended_quantity"] == 60


def test_recurring_large_customer_is_preserved():
    scenario = next(x for x in DATA["scenarios"] if x["id"] == "one_time_large_order_excluded")
    source = scenario_to_input(scenario, REQUEST)
    regular = tuple(Operation(quantity=10, date=date(2026, 9, 22) - timedelta(days=index), reference=f"small-{index}") for index in range(7))
    recurring = tuple(Operation(quantity=160, date=date(2026, 9, 1) + timedelta(days=7 * index), customer_id="anon-recurring", reference=f"big-{index}") for index in range(3))
    result = calculate_item(replace(source, operations=regular + recurring, raw_demand_quantity=None))
    assert result["components"]["excluded_outlier_quantity"] == 0
    assert "outlier_excluded" not in result["flags"]


def test_growth_and_category_safety_change_result():
    scenario = next(x for x in DATA["scenarios"] if x["id"] == "seasonality_and_growth")
    source = scenario_to_input(scenario, REQUEST)
    grown = calculate_item(replace(source, growth_override_percent=10))
    baseline = calculate_item(source)
    assert grown["components"]["forecast_over_horizon"] == pytest.approx(554.4)
    assert grown["recommended_quantity"] > baseline["recommended_quantity"]
    more_safety = calculate_item(replace(source, service_level_z=2.0, demand_stddev_over_lead_time=10))
    assert more_safety["components"]["safety_stock"] == 20


def test_late_arrival_is_not_counted_and_early_shortage_is_flagged():
    scenario = next(x for x in DATA["scenarios"] if x["id"] == "late_inbound_does_not_hide_shortage")
    source = scenario_to_input(scenario, REQUEST)
    result = calculate_item(source)
    assert result["components"]["net_need_before_rounding"] == 50
    assert "stockout_before_new_delivery" in result["flags"]


def test_confirmed_inbound_is_sensitive_to_date():
    scenario = DATA["scenarios"][0]
    source = scenario_to_input(scenario, REQUEST)
    late = replace(source, inbound=(Inbound(quantity=40, expected_date=date(2026, 12, 1)),))
    assert calculate_item(late)["recommended_quantity"] == 90
