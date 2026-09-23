/** Types corresponding to contracts/openapi.yaml, independent of UI view models. */
export interface DataQualityWarning {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  sku?: string | null;
}

export interface InboundComponent {
  quantity: number;
  expected_date: string;
  included: boolean;
  reason: string;
}

export interface CalculationComponents {
  horizon_days: number;
  raw_demand_quantity: number;
  excluded_outlier_quantity: number;
  adjusted_regular_demand_quantity: number;
  lost_demand_estimate_quantity: number;
  seasonality_coefficient: number;
  trend_multiplier: number;
  growth_override_percent: number;
  forecast_over_horizon: number;
  demand_stddev_over_lead_time: number;
  safety_stock: number;
  available_stock: number | null;
  available_stock_date: string | null;
  eligible_inbound: InboundComponent[];
  net_need_before_rounding: number;
  moq: number | null;
  pack_multiple: number | null;
  rounding_delta: number;
}

export interface RecommendationItem {
  item_id: string;
  sku: string;
  supplier_article?: string | null;
  item_name: string;
  category: string | null;
  warehouse: string;
  unit: string;
  supplier_id: string;
  supplier_name: string;
  urgency: "critical" | "high" | "normal" | "low";
  expected_stockout_date?: string | null;
  recommended_quantity: number;
  calculated_quantity: number;
  approved_quantity: number | null;
  manager_adjustment_reason?: string | null;
  components: CalculationComponents;
  explanation: string;
  flags: string[];
}

export interface SupplierRecommendationGroup {
  supplier_id: string;
  supplier_name: string;
  items: RecommendationItem[];
}

export interface RecommendationRun {
  run_id: string;
  dataset_id: string;
  calculation_date: string;
  algorithm_version: string;
  status: "draft" | "approved" | "stale_after_edit";
  parameters: {
    review_period_days: number;
    default_lead_time_days: number;
    service_level_z: number;
    demand_window_days: number;
    trend_method: "rolling_window" | "exponential_smoothing";
    outlier_method: string;
    seasonality_source: string;
    safety_stock_method: string;
  };
  totals: { item_count: number; recommended_item_count: number; total_recommended_quantity: number };
  suppliers: SupplierRecommendationGroup[];
  data_quality: DataQualityWarning[];
}

export interface CalculateRecommendationsRequest {
  dataset_id: string;
  calculation_date: string;
  warehouse_scope: string;
  review_period_days: number;
  default_lead_time_days: number;
  service_level_z: number;
  growth_override_percent?: number;
  include_unapproved_stockout_estimates?: boolean;
  category_settings?: { category: string; service_level_z: number; growth_override_percent?: number }[];
}

export interface ImportPreviewResponse {
  preview_id: string; // Server adds this so commit can reference the preview.
  files: { file_name: string; sheet_names: string[]; detected_type: string }[];
  row_counts: Record<string, number>;
  warnings: DataQualityWarning[];
  unsupported_fields: string[];
}

export interface DatasetSnapshot {
  dataset_id: string;
  created_at: string;
  label: string;
}

export interface OrderApproval {
  run_id: string;
  status: "approved";
  approved_by: string;
  approved_at: string;
}
