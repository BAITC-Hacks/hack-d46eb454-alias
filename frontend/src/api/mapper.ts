import type { PurchaseOrder, Recommendation } from "../types";
import type { RecommendationItem, RecommendationRun } from "./schema";

const included = (item: RecommendationItem) =>
  item.components.eligible_inbound.filter((row) => row.included).reduce((total, row) => total + row.quantity, 0);
const excluded = (item: RecommendationItem) =>
  item.components.eligible_inbound.filter((row) => !row.included).reduce((total, row) => total + row.quantity, 0);

/** Every contract calculation component is represented in the breakdown. */
export function toRecommendation(item: RecommendationItem, run: RecommendationRun): Recommendation {
  const c = item.components;
  return {
    id: item.item_id,
    calculation_id: run.run_id,
    product_id: item.item_id,
    internal_code: item.sku,
    supplier_sku: item.supplier_article ?? null,
    sku: item.sku,
    name: item.item_name,
    unit: item.unit,
    warehouse_id: item.warehouse,
    supplier_id: item.supplier_id,
    supplier_name: item.supplier_name,
    category_id: item.category,
    status: item.recommended_quantity > 0 ? "recommended" : "no_order",
    recommended_qty: item.recommended_quantity,
    preview_qty: item.calculated_quantity,
    urgency: item.urgency,
    explanation: item.explanation,
    available_stock: c.available_stock,
    incoming_qty: included(item),
    forecast_qty: c.forecast_over_horizon,
    safety_stock: c.safety_stock,
    breakdown: {
      raw_demand_qty: c.raw_demand_quantity,
      adjusted_regular_demand_qty: c.adjusted_regular_demand_quantity,
      seasonality_coefficient: c.seasonality_coefficient,
      trend_multiplier: c.trend_multiplier,
      demand_stddev_over_lead_time: c.demand_stddev_over_lead_time,
      eligible_inbound: c.eligible_inbound,
      forecast_qty: c.forecast_over_horizon,
      safety_stock: c.safety_stock,
      available_stock: c.available_stock,
      incoming_within_horizon_qty: included(item),
      incoming_excluded_qty: excluded(item),
      net_requirement: c.net_need_before_rounding,
      moq_qty: c.moq,
      pack_multiple: c.pack_multiple,
      unit_step: null,
      purchase_unit: null,
      purchase_to_stock_factor: null,
      purchase_qty: null,
      rounded_qty: item.recommended_quantity,
      rounding_delta: c.rounding_delta,
      horizon_days: c.horizon_days,
      lead_time_days: run.parameters.default_lead_time_days,
      review_period_days: run.parameters.review_period_days,
      safety_days: null,
      growth_override_percent: c.growth_override_percent,
      growth_mode: c.growth_override_percent ? "additional" : "none",
      estimated_lost_sales_qty: c.lost_demand_estimate_quantity,
      excluded_anomaly_qty: c.excluded_outlier_quantity,
      stock_snapshot_date: c.available_stock_date,
      earliest_shortage_date: item.expected_stockout_date ?? null,
      history_start_date: null,
      history_end_date: null,
      forecast_method: run.parameters.trend_method,
      seasonality_used: item.flags.includes("seasonality_applied"),
      trend_used: item.flags.includes("trend_applied"),
      stockout_compensation_used: item.flags.includes("stockout_compensated"),
      customer_detection_used: false,
    },
    data_warnings: item.flags.map((flag) => ({
      code: flag, message: flag, severity: "warning" as const,
      field: null, product_id: item.item_id,
    })),
    blocker_codes: [],
    flags: item.flags,
    data_origin: run.dataset_id === "synthetic-fixtures" ? "synthetic" : "partner",
  };
}

/** Reverse mapping preserves values absent from the view model via the original item. */
export function toRecommendationItem(row: Recommendation, original: RecommendationItem): RecommendationItem {
  const b = row.breakdown;
  return {
    ...original,
    item_id: row.id,
    sku: row.sku,
    supplier_article: row.supplier_sku,
    item_name: row.name,
    category: row.category_id,
    warehouse: row.warehouse_id,
    unit: row.unit,
    supplier_id: row.supplier_id ?? original.supplier_id,
    supplier_name: row.supplier_name ?? original.supplier_name,
    urgency: row.urgency === "unknown" ? original.urgency : row.urgency,
    expected_stockout_date: b.earliest_shortage_date,
    recommended_quantity: row.recommended_qty ?? original.recommended_quantity,
    calculated_quantity: row.preview_qty ?? original.calculated_quantity,
    approved_quantity: row.recommended_qty === original.recommended_quantity
      ? original.approved_quantity
      : row.recommended_qty,
    explanation: row.explanation,
    flags: row.flags ?? original.flags,
    components: {
      ...original.components,
      raw_demand_quantity: b.raw_demand_qty ?? original.components.raw_demand_quantity,
      adjusted_regular_demand_quantity: b.adjusted_regular_demand_qty ?? original.components.adjusted_regular_demand_quantity,
      seasonality_coefficient: b.seasonality_coefficient ?? original.components.seasonality_coefficient,
      trend_multiplier: b.trend_multiplier ?? original.components.trend_multiplier,
      growth_override_percent: b.growth_override_percent ?? original.components.growth_override_percent,
      demand_stddev_over_lead_time: b.demand_stddev_over_lead_time ?? original.components.demand_stddev_over_lead_time,
      eligible_inbound: b.eligible_inbound ?? original.components.eligible_inbound,
      forecast_over_horizon: b.forecast_qty ?? original.components.forecast_over_horizon,
      safety_stock: b.safety_stock ?? original.components.safety_stock,
      available_stock: b.available_stock,
      available_stock_date: b.stock_snapshot_date,
      net_need_before_rounding: b.net_requirement ?? original.components.net_need_before_rounding,
      moq: b.moq_qty,
      pack_multiple: b.pack_multiple,
      rounding_delta: b.rounding_delta ?? original.components.rounding_delta,
      lost_demand_estimate_quantity: b.estimated_lost_sales_qty ?? original.components.lost_demand_estimate_quantity,
      excluded_outlier_quantity: b.excluded_anomaly_qty,
      horizon_days: b.horizon_days ?? original.components.horizon_days,
    },
  };
}

export function runRecommendations(run: RecommendationRun): Recommendation[] {
  return run.suppliers.flatMap((group) => group.items.map((item) => toRecommendation(item, run)));
}

/** Supplier sections are views of one run; approval/export still target the whole run. */
export function runOrders(run: RecommendationRun): PurchaseOrder[] {
  return run.suppliers.map((group) => ({
    id: `${run.run_id}:${group.supplier_id}`,
    number: run.run_id,
    dataset_id: run.dataset_id,
    calculation_id: run.run_id,
    supplier_id: group.supplier_id,
    supplier_name: group.supplier_name,
    warehouse_id: group.items[0]?.warehouse ?? "",
    status: run.status,
    revision: null,
    created_at: run.calculation_date,
    updated_at: run.calculation_date,
    approved_at: null,
    lines: group.items.filter((item) => item.calculated_quantity > 0 || item.recommended_quantity > 0).map((item) => ({
      id: item.item_id,
      recommendation_id: item.item_id,
      product_id: item.item_id,
      internal_code: item.sku,
      supplier_sku: item.supplier_article ?? null,
      sku: item.sku,
      name: item.item_name,
      unit: item.unit,
      recommended_qty: item.calculated_quantity,
      ordered_qty: item.recommended_quantity,
      purchase_unit: item.unit,
      purchase_to_stock_factor: 1,
      purchase_qty: item.recommended_quantity,
      change_reason: item.manager_adjustment_reason ?? null,
      explanation: item.explanation,
      warnings: item.flags.map((flag) => ({ code: flag, message: flag, severity: "warning" as const, field: null, product_id: item.item_id })),
    })),
    audit_events: [],
  })).filter((order) => order.lines.length > 0);
}
