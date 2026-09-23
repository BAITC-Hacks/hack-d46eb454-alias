"""Pure, deterministic replenishment calculations.

No HTTP, database, filesystem or workbook access belongs in this module.
Inputs are stock-unit quantities; a caller must validate unit conversions.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from math import ceil, sqrt
from statistics import median, pstdev
from typing import Any


ALGORITHM_VERSION = "replenishment-v0.1"


@dataclass(frozen=True)
class Operation:
    quantity: float
    date: date | None = None
    customer_id: str | None = None
    reference: str | None = None


@dataclass(frozen=True)
class Inbound:
    quantity: float
    expected_date: date
    confirmed: bool = True


@dataclass(frozen=True)
class Stockout:
    start: date
    end: date
    confirmed: bool = True


@dataclass(frozen=True)
class CalculationInput:
    sku: str
    item_name: str
    supplier_id: str
    supplier_name: str
    warehouse: str
    unit: str
    category: str | None
    calculation_date: date
    review_period_days: int
    lead_time_days: int
    service_level_z: float
    available_stock: float | None
    available_stock_date: date | None = None
    supplier_article: str | None = None
    moq: float | None = None
    pack_multiple: float | None = None
    growth_override_percent: float = 0
    seasonality_coefficient: float = 1
    seasonality_profile: tuple[float, ...] | None = None
    trend_multiplier: float | None = None
    demand_window_days: int = 90
    base_daily_demand: float | None = None
    operations: tuple[Operation, ...] = ()
    inbound: tuple[Inbound, ...] = ()
    stockouts: tuple[Stockout, ...] = ()
    comparable_available_daily_demand: float | None = None
    demand_stddev_over_lead_time: float | None = None
    # A known scenario or an externally computed forecast may supply this value.
    # Production history uses base_daily_demand/operations instead.
    forecast_over_horizon: float | None = None
    raw_demand_quantity: float | None = None
    safety_stock: float | None = None
    metadata_flags: tuple[str, ...] = ()


def _round(value: float) -> float:
    return round(value, 6)


def _mad_outliers(operations: tuple[Operation, ...]) -> tuple[float, list[dict[str, Any]]]:
    """Remove isolated, abnormally large positive operations.

    The threshold combines robust MAD with a multiple of the usual operation;
    recurring purchases from the same anonymized customer are retained.
    """
    positives = [op for op in operations if op.quantity > 0]
    if len(positives) < 5:
        return 0.0, []
    sizes = [op.quantity for op in positives]
    center = median(sizes)
    mad = median(abs(q - center) for q in sizes)
    threshold = max(center * 3, center + 3.5 * 1.4826 * mad)
    customer_ops: dict[str, list[Operation]] = {}
    for op in positives:
        if op.customer_id:
            customer_ops.setdefault(op.customer_id, []).append(op)
    excluded: list[dict[str, Any]] = []
    for index, op in enumerate(operations):
        if op.quantity <= 0:
            continue
        if op.quantity <= threshold:
            continue
        repeated = False
        if op.customer_id:
            history = customer_ops[op.customer_id]
            repeated = len(history) >= 3 and len({x.date for x in history if x.date}) >= 3
        if repeated:
            continue
        concentration = bool(op.customer_id) and op.quantity / sum(sizes) >= 0.4
        excluded.append({
            "index": index,
            "quantity": op.quantity,
            "customer_id": op.customer_id,
            "reference": op.reference,
            "reason": "MAD + разовая концентрация клиента" if concentration else "MAD по объёму операции",
        })
    return _round(sum(x["quantity"] for x in excluded)), excluded


def _rolling_trend(operations: tuple[Operation, ...], calculation_date: date, profile: tuple[float, ...] | None = None) -> float:
    """Ratio of two adjacent 28-day windows, capped to resist short spikes."""
    if not operations or any(op.date is None for op in operations):
        return 1.0
    recent_start = calculation_date - timedelta(days=27)
    prior_start = recent_start - timedelta(days=28)
    def deseasonalized(op: Operation) -> float:
        return op.quantity / profile[op.date.month - 1] if profile and op.date else op.quantity
    recent = sum(deseasonalized(op) for op in operations if op.quantity > 0 and op.date and recent_start <= op.date <= calculation_date)
    prior = sum(deseasonalized(op) for op in operations if op.quantity > 0 and op.date and prior_start <= op.date < recent_start)
    if prior <= 0 or recent <= 0:
        return 1.0
    return _round(min(2.0, max(0.5, recent / prior)))


def _daily_sigma(operations: tuple[Operation, ...], calculation_date: date, window_days: int, lead_time_days: int) -> float:
    if window_days < 2 or lead_time_days <= 0:
        return 0.0
    start = calculation_date - timedelta(days=window_days - 1)
    daily = [0.0] * window_days
    for operation in operations:
        if operation.date and start <= operation.date <= calculation_date and operation.quantity > 0:
            daily[(operation.date - start).days] += operation.quantity
    return pstdev(daily) * sqrt(lead_time_days)


def _confirmed_stockout_days(stockouts: tuple[Stockout, ...], window_start: date, calculation_date: date) -> int:
    covered: set[date] = set()
    for interval in stockouts:
        if not interval.confirmed:
            continue
        day = max(interval.start, window_start)
        end = min(interval.end, calculation_date)
        while day <= end:
            covered.add(day)
            day += timedelta(days=1)
    return len(covered)


def _inbound_components(inbound: tuple[Inbound, ...], calculation_date: date, horizon_days: int) -> tuple[list[dict[str, Any]], float, float]:
    horizon_end = calculation_date + timedelta(days=horizon_days)
    components: list[dict[str, Any]] = []
    eligible = late = 0.0
    for arrival in inbound:
        inside = arrival.confirmed and calculation_date < arrival.expected_date <= horizon_end
        if inside:
            eligible += arrival.quantity
            reason = "Подтверждено внутри горизонта расчёта"
        elif not arrival.confirmed:
            reason = "Поступление не подтверждено"
        elif arrival.expected_date > horizon_end:
            late += arrival.quantity
            reason = "После горизонта расчёта"
        else:
            reason = "Дата поступления уже прошла; получение не подтверждено"
        components.append({"quantity": _round(arrival.quantity), "expected_date": arrival.expected_date.isoformat(), "included": inside, "reason": reason})
    return components, _round(eligible), _round(late)


def _rounded_order(net_need: float, moq: float | None, pack_multiple: float | None) -> float:
    if net_need <= 0:
        return 0.0
    quantity = max(net_need, moq or 0)
    if pack_multiple and pack_multiple > 0:
        quantity = ceil((quantity - 1e-9) / pack_multiple) * pack_multiple
    return _round(quantity)


def _expected_stockout_date(stock: float, daily_demand: float, inbound: tuple[Inbound, ...], calculation_date: date, horizon_days: int) -> date | None:
    if daily_demand <= 0:
        return None
    balance = stock
    arrivals: dict[date, float] = {}
    for x in inbound:
        if x.confirmed and x.expected_date > calculation_date:
            arrivals[x.expected_date] = arrivals.get(x.expected_date, 0) + x.quantity
    for offset in range(1, horizon_days + 1):
        day = calculation_date + timedelta(days=offset)
        balance += arrivals.get(day, 0)
        balance -= daily_demand
        if balance < 0:
            return day
    return None


def calculate_item(item: CalculationInput) -> dict[str, Any]:
    """Return one contract-shaped recommendation without external side effects."""
    if item.available_stock is None:
        raise ValueError(f"{item.sku}: current available stock is missing")
    if item.available_stock < 0 or item.review_period_days < 1 or item.lead_time_days < 0 or item.service_level_z < 0:
        raise ValueError(f"{item.sku}: invalid stock or planning parameters")
    if item.seasonality_coefficient <= 0 or (item.moq is not None and item.moq < 0) or (item.pack_multiple is not None and item.pack_multiple <= 0):
        raise ValueError(f"{item.sku}: invalid seasonality or purchase conditions")
    horizon = item.lead_time_days + item.review_period_days
    excluded, outlier_details = _mad_outliers(item.operations)
    excluded_indices = {detail["index"] for detail in outlier_details}
    regular_operations = tuple(operation for index, operation in enumerate(item.operations) if index not in excluded_indices)
    raw = item.raw_demand_quantity if item.raw_demand_quantity is not None else sum(op.quantity for op in item.operations if op.quantity > 0)
    adjusted = max(0.0, raw - excluded)
    stockout_days = _confirmed_stockout_days(item.stockouts, item.calculation_date - timedelta(days=item.demand_window_days - 1), item.calculation_date)
    comparable = item.comparable_available_daily_demand
    if comparable is None and item.demand_window_days > stockout_days:
        comparable = adjusted / (item.demand_window_days - stockout_days)
    lost = min(stockout_days * comparable, max(adjusted, 0.0)) if comparable is not None else 0.0
    trend = item.trend_multiplier if item.trend_multiplier is not None else _rolling_trend(regular_operations, item.calculation_date, item.seasonality_profile)
    if item.forecast_over_horizon is not None:
        forecast = item.forecast_over_horizon
    else:
        if item.base_daily_demand is not None:
            base_daily = item.base_daily_demand
        elif item.seasonality_profile and regular_operations:
            base_daily = (
                sum(op.quantity / item.seasonality_profile[op.date.month - 1] for op in regular_operations if op.date and op.quantity > 0)
                + lost / item.seasonality_profile[item.calculation_date.month - 1]
            ) / item.demand_window_days
        else:
            base_daily = (adjusted + lost) / item.demand_window_days
        forecast = base_daily * horizon * item.seasonality_coefficient * trend * (1 + item.growth_override_percent / 100)
    forecast = _round(max(0.0, forecast))
    if item.demand_stddev_over_lead_time is not None:
        sigma = item.demand_stddev_over_lead_time
    elif item.safety_stock is not None and item.service_level_z:
        sigma = item.safety_stock / item.service_level_z
    else:
        sigma = _daily_sigma(regular_operations, item.calculation_date, item.demand_window_days, item.lead_time_days)
    safety = _round(item.service_level_z * sigma)
    inbound_components, eligible, late = _inbound_components(item.inbound, item.calculation_date, horizon)
    net = _round(max(0.0, forecast + safety - item.available_stock - eligible))
    recommended = _rounded_order(net, item.moq, item.pack_multiple)
    stockout_date = _expected_stockout_date(item.available_stock, forecast / horizon if horizon else 0, item.inbound, item.calculation_date, horizon)
    arrival_date = item.calculation_date + timedelta(days=item.lead_time_days)
    urgency = "critical" if stockout_date and stockout_date < arrival_date else "high" if stockout_date else "normal" if net > 0 else "low"
    flags = list(item.metadata_flags)
    if excluded:
        flags.append("outlier_excluded")
    if lost:
        flags.append("stockout_compensated")
    if item.seasonality_coefficient != 1:
        flags.append("seasonality_applied")
    if trend != 1:
        flags.append("trend_applied")
    if late:
        flags.append("late_inbound_ignored_for_current_horizon")
    if recommended > net and item.pack_multiple:
        flags.append("rounded_to_pack_multiple")
    if stockout_date and stockout_date < arrival_date:
        flags.append("stockout_before_new_delivery")
    fmt = lambda x: f"{x:g}"
    explanation = (
        f"Прогноз на {horizon} дней: {fmt(forecast)} {item.unit} "
        f"(сезонность {fmt(item.seasonality_coefficient)}, тренд {fmt(trend)}, плановый прирост {fmt(item.growth_override_percent)}%). "
        f"Страховой запас {fmt(safety)} {item.unit}; доступный остаток {fmt(item.available_stock)} {item.unit}; "
        f"поступления внутри горизонта {fmt(eligible)} {item.unit}. "
        f"Потребность {fmt(net)} {item.unit}; после MOQ и кратности рекомендовано {fmt(recommended)} {item.unit}."
    )
    if excluded:
        explanation += f" Разовые операции на {fmt(excluded)} {item.unit} исключены из регулярного спроса."
    if lost:
        explanation += f" Подтверждённый stockout: оценка упущенного спроса {fmt(lost)} {item.unit}."
    if stockout_date and stockout_date < arrival_date:
        explanation += f" Возможный дефицит {stockout_date.isoformat()} раньше новой поставки {arrival_date.isoformat()}."
    return {
        "item_id": f"item_{item.sku}", "sku": item.sku, "supplier_article": item.supplier_article,
        "item_name": item.item_name, "category": item.category, "warehouse": item.warehouse, "unit": item.unit,
        "supplier_id": item.supplier_id, "supplier_name": item.supplier_name, "urgency": urgency,
        "expected_stockout_date": stockout_date.isoformat() if stockout_date else None,
        "recommended_quantity": recommended, "calculated_quantity": recommended, "approved_quantity": None,
        "manager_adjustment_reason": None,
        "components": {
            "horizon_days": horizon, "raw_demand_quantity": _round(raw), "excluded_outlier_quantity": excluded,
            "adjusted_regular_demand_quantity": _round(adjusted), "lost_demand_estimate_quantity": _round(lost),
            "seasonality_coefficient": item.seasonality_coefficient, "trend_multiplier": trend,
            "growth_override_percent": item.growth_override_percent, "forecast_over_horizon": forecast,
            "demand_stddev_over_lead_time": _round(sigma), "safety_stock": safety,
            "available_stock": item.available_stock, "available_stock_date": item.available_stock_date.isoformat() if item.available_stock_date else None,
            "eligible_inbound": inbound_components, "net_need_before_rounding": net,
            "moq": item.moq, "pack_multiple": item.pack_multiple, "rounding_delta": _round(recommended - net),
        },
        "explanation": explanation, "flags": flags,
        "excluded_operations": outlier_details,
    }


def group_by_supplier(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = {}
    for item in items:
        group = groups.setdefault(item["supplier_id"], {"supplier_id": item["supplier_id"], "supplier_name": item["supplier_name"], "items": []})
        group["items"].append(item)
    return [groups[key] for key in sorted(groups)]
