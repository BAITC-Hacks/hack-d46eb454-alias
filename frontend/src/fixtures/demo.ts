import type { DemandPoint, Recommendation, Supplier, Urgency } from "../types";

/** Только синтетические UI-примеры. Это НЕ результат обработки таблиц партнёра. */
export const DEMO_DATASET_ID = "ds_ui_demo_v1";
export const DEMO_CALCULATION_ID = "calc_ui_demo_v1";
export const AS_OF_DATE = "2026-08-31";
export const initialSuppliers: Supplier[] = [
  {
    id: "sup_iek",
    name: "IEK",
    config_revision: 1,
    policy: {
      lead_time_days: 10,
      review_period_days: 2,
      assumption_note:
        "Сроки заданы для демонстрации, не подтверждены поставщиком.",
    },
  },
  {
    id: "sup_systeme",
    name: "Systeme Electric",
    config_revision: 1,
    policy: {
      lead_time_days: 14,
      review_period_days: 7,
      assumption_note:
        "Сроки заданы для демонстрации, не подтверждены поставщиком.",
    },
  },
];

interface FixtureInput {
  id: number;
  name: string;
  sku: string;
  supplier: number;
  unit?: string;
  stock: number | null;
  incoming: number | null;
  forecast: number;
  safety: number;
  qty: number | null;
  need: number | null;
  step: number;
  urgency: Urgency;
  note?: string;
}
const fixtures: FixtureInput[] = [
  {
    id: 1,
    name: "Автомат ВА47-29, 1P, 16А",
    sku: "MVA20-1-016-C",
    supplier: 0,
    stock: 35,
    incoming: 25,
    forecast: 120,
    safety: 20,
    need: 80,
    qty: 84,
    step: 12,
    urgency: "critical",
  },
  {
    id: 2,
    name: "Розетка AtlasDesign, белая",
    sku: "ATN000143",
    supplier: 1,
    stock: 48,
    incoming: 0,
    forecast: 90,
    safety: 18,
    need: 60,
    qty: 60,
    step: 10,
    urgency: "high",
  },
  {
    id: 3,
    name: "Кабель U/UTP, кат. 5Е",
    sku: "LC1-C5E04-111",
    supplier: 0,
    unit: "м",
    stock: 150,
    incoming: 0,
    forecast: 350,
    safety: 50,
    need: 250,
    qty: 305,
    step: 305,
    urgency: "critical",
  },
  {
    id: 4,
    name: "Выключатель AtlasDesign",
    sku: "ATN000112",
    supplier: 1,
    stock: 32,
    incoming: 20,
    forecast: 100,
    safety: 12,
    need: 60,
    qty: 60,
    step: 10,
    urgency: "high",
  },
  {
    id: 5,
    name: "Контактор КМИ, 25А",
    sku: "KKM11-025-230-10",
    supplier: 0,
    stock: 8,
    incoming: 10,
    forecast: 30,
    safety: 8,
    need: 20,
    qty: 20,
    step: 1,
    urgency: "high",
  },
  {
    id: 6,
    name: "Рамка AtlasDesign, 2 поста",
    sku: "ATN000102",
    supplier: 1,
    stock: 160,
    incoming: 0,
    forecast: 90,
    safety: 18,
    need: 0,
    qty: 0,
    step: 10,
    urgency: "normal",
  },
  {
    id: 7,
    name: "Светильник ДПА 5030-1",
    sku: "LDPA0-5030-1H-K01",
    supplier: 0,
    stock: null,
    incoming: 0,
    forecast: 30,
    safety: 6,
    need: null,
    qty: null,
    step: 1,
    urgency: "unknown",
    note: "Нет подтверждённого остатка на дату среза.",
  },
  {
    id: 8,
    name: "Переключатель AtlasDesign",
    sku: "ATN000163",
    supplier: 1,
    stock: 10,
    incoming: null,
    forecast: 32,
    safety: 8,
    need: null,
    qty: null,
    step: 10,
    urgency: "unknown",
    note: "Не подтверждена полнота товаров в пути.",
  },
];

export const demoRecommendations: Recommendation[] = fixtures.map((f) => {
  const supplier = initialSuppliers[f.supplier];
  const unit = f.unit || "шт";
  const status =
    f.qty === null ? "blocked" : f.qty === 0 ? "no_order" : "recommended";
  const explanation =
    f.note ||
    (f.qty === 0
      ? "Свободный остаток покрывает прогноз и страховой запас. Дополнительный заказ не требуется."
      : `Прогноз ${f.forecast} ${unit} + страховой запас ${f.safety} − остаток ${f.stock} − в пути ${f.incoming} = ${f.need} ${unit}. С учётом кратности ${f.step}: ${f.qty} ${unit}.`);
  return {
    id: `rec_demo_${f.id}`,
    calculation_id: DEMO_CALCULATION_ID,
    product_id: `prd_demo_${f.id}`,
    internal_code: `DEMO-${String(f.id).padStart(4, "0")}`,
    sku: f.sku,
    supplier_sku: f.sku,
    name: f.name,
    unit,
    warehouse_id: "wh_almaty",
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    category_id: f.supplier ? "cat_accessories" : "cat_electrical",
    status,
    recommended_qty: f.qty,
    preview_qty: null,
    urgency: f.urgency,
    explanation,
    available_stock: f.stock,
    incoming_qty: f.incoming,
    forecast_qty: f.forecast,
    safety_stock: f.safety,
    breakdown: {
      forecast_qty: f.forecast,
      safety_stock: f.safety,
      available_stock: f.stock,
      incoming_within_horizon_qty: f.incoming,
      incoming_excluded_qty: 0,
      net_requirement: f.need,
      moq_qty: f.step,
      pack_multiple: f.step,
      unit_step: 1,
      purchase_unit: unit === "м" ? "бухта" : unit,
      purchase_to_stock_factor: unit === "м" ? 305 : 1,
      purchase_qty: f.qty === null ? null : unit === "м" ? f.qty / 305 : f.qty,
      rounded_qty: f.qty,
      rounding_delta: f.qty === null || f.need === null ? null : f.qty - f.need,
      horizon_days: f.supplier ? 21 : 12,
      lead_time_days: f.supplier ? 14 : 10,
      review_period_days: f.supplier ? 7 : 2,
      safety_days: 2,
      growth_override_percent: 0,
      growth_mode: "none",
      estimated_lost_sales_qty: f.id === 1 ? 18 : 0,
      excluded_anomaly_qty: f.id === 1 ? 600 : 0,
      stock_snapshot_date: f.stock === null ? null : AS_OF_DATE,
      earliest_shortage_date: f.urgency === "critical" ? "2026-09-04" : null,
      history_start_date: "2024-01-01",
      history_end_date: AS_OF_DATE,
      forecast_method: "ui_fixture_not_calculated",
      seasonality_used: true,
      trend_used: true,
      stockout_compensation_used: f.id === 1,
      customer_detection_used: f.id === 1,
    },
    data_warnings: f.note
      ? [
          {
            code: f.stock === null ? "STOCK_MISSING" : "INBOUND_INCOMPLETE",
            message: f.note,
            severity: "blocking",
            field: null,
            product_id: `prd_demo_${f.id}`,
          },
        ]
      : [],
    blocker_codes: f.note
      ? [f.stock === null ? "STOCK_MISSING" : "INBOUND_INCOMPLETE"]
      : [],
  };
});

/** Иллюстративный месячный ряд одного товара; не распространяется на все SKU. */
export const demoDemandSeries: DemandPoint[] = [
  ["2026-03-01", 34, 34, null],
  ["2026-04-01", 642, 42, null],
  ["2026-05-01", 20, 38, null],
  ["2026-06-01", 53, 53, null],
  ["2026-07-01", 62, 62, null],
  ["2026-08-01", 68, 68, null],
  ["2026-09-01", null, null, 79],
  ["2026-10-01", null, null, 86],
].map(([date, observed, adjusted, forecast]) => ({
  date: date as string,
  period: "month",
  observed_sales_qty: observed as number | null,
  adjusted_demand_qty: adjusted as number | null,
  forecast_qty: forecast as number | null,
  returns_qty: 0,
  excluded_anomaly_qty: date === "2026-04-01" ? 600 : 0,
  estimated_lost_sales_qty: date === "2026-05-01" ? 18 : 0,
  stockout_days: date === "2026-05-01" ? 9 : 0,
}));
