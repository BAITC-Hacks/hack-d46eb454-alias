/** View models интерфейса. Контракт сервера: ../../contracts/openapi.yaml. */
export type Page =
  "overview" | "recommendations" | "orders" | "data" | "catalog" | "suppliers";
export type Design = "soft" | "studio" | "focus";
export type Urgency = "critical" | "high" | "normal" | "low" | "unknown";
export type RecommendationStatus = "recommended" | "no_order" | "blocked";
export interface DataNotice {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
  field: string | null;
  product_id: string | null;
}
export interface CalculationBreakdown {
  raw_demand_qty?: number;
  adjusted_regular_demand_qty?: number;
  seasonality_coefficient?: number;
  trend_multiplier?: number;
  demand_stddev_over_lead_time?: number;
  eligible_inbound?: { quantity: number; expected_date: string; included: boolean; reason: string }[];
  forecast_qty: number | null;
  safety_stock: number | null;
  available_stock: number | null;
  incoming_within_horizon_qty: number | null;
  incoming_excluded_qty: number | null;
  net_requirement: number | null;
  moq_qty: number | null;
  pack_multiple: number | null;
  unit_step: number | null;
  purchase_unit: string | null;
  purchase_to_stock_factor: number | null;
  purchase_qty: number | null;
  rounded_qty: number | null;
  rounding_delta: number | null;
  horizon_days: number | null;
  lead_time_days: number | null;
  review_period_days: number | null;
  safety_days: number | null;
  growth_override_percent: number;
  growth_mode: "none" | "additional" | "override";
  estimated_lost_sales_qty: number | null;
  excluded_anomaly_qty: number;
  stock_snapshot_date: string | null;
  earliest_shortage_date: string | null;
  history_start_date: string | null;
  history_end_date: string | null;
  forecast_method: string;
  seasonality_used: boolean;
  trend_used: boolean;
  stockout_compensation_used: boolean;
  customer_detection_used: boolean;
}
export interface Recommendation {
  id: string;
  calculation_id: string;
  product_id: string;
  internal_code: string;
  supplier_sku: string | null;
  sku: string;
  name: string;
  unit: string;
  warehouse_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  category_id: string | null;
  status: RecommendationStatus;
  recommended_qty: number | null;
  preview_qty: number | null;
  urgency: Urgency;
  explanation: string;
  available_stock: number | null;
  incoming_qty: number | null;
  forecast_qty: number | null;
  safety_stock: number | null;
  breakdown: CalculationBreakdown;
  data_warnings: DataNotice[];
  blocker_codes: string[];
  flags?: string[];
  data_origin?: "synthetic" | "partner";
}
export interface Supplier {
  id: string;
  name: string;
  config_revision: number;
  policy: {
    lead_time_days: number | null;
    review_period_days: number | null;
    assumption_note: string | null;
  };
}
export interface OrderLine {
  id: string;
  recommendation_id: string;
  product_id: string;
  internal_code: string;
  supplier_sku: string | null;
  sku: string;
  name: string;
  unit: string;
  recommended_qty: number;
  ordered_qty: number;
  purchase_unit: string;
  purchase_to_stock_factor: number;
  purchase_qty: number;
  change_reason: string | null;
  explanation: string;
  warnings: DataNotice[];
}
export interface AuditEvent {
  id: string;
  at: string;
  actor_source: "manager" | "system";
  action: "created" | "line_changed" | "approved";
  line_id: string | null;
  from_revision: number;
  to_revision: number;
  old_qty: number | null;
  new_qty: number | null;
  reason: string | null;
}
export interface PurchaseOrder {
  id: string;
  number: string;
  dataset_id: string;
  calculation_id: string;
  supplier_id: string;
  supplier_name: string;
  warehouse_id: string;
  status: "draft" | "approved" | "stale_after_edit";
  revision: number | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  lines: OrderLine[];
  audit_events: AuditEvent[];
}
export interface DemandPoint {
  date: string;
  period: "day" | "month";
  observed_sales_qty: number | null;
  returns_qty: number | null;
  excluded_anomaly_qty: number | null;
  estimated_lost_sales_qty: number | null;
  adjusted_demand_qty: number | null;
  forecast_qty: number | null;
  stockout_days: number | null;
}
export interface ApiList<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
export interface RecommendationFilters {
  q: string;
  supplier_id: string;
  urgency: string;
  status: string;
}
