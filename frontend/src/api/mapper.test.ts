import { describe, expect, it } from "vitest";
import example from "../../../contracts/example-recommendations-response.json";
import type { RecommendationRun } from "./schema";
import { runOrders, runRecommendations, toRecommendation, toRecommendationItem } from "./mapper";

const run = example as RecommendationRun;

describe("contract to view model", () => {
  it("maps every numeric component without changing the server explanation", () => {
    const item = run.suppliers[0].items[0];
    const row = toRecommendation(item, run);
    expect(row.id).toBe(item.item_id);
    expect(row.product_id).toBe(item.item_id);
    expect(row.sku).toBe(item.sku);
    expect(row.name).toBe(item.item_name);
    expect(row.recommended_qty).toBe(item.recommended_quantity);
    expect(row.preview_qty).toBe(item.calculated_quantity);
    expect(row.breakdown.forecast_qty).toBe(item.components.forecast_over_horizon);
    expect(row.breakdown.net_requirement).toBe(item.components.net_need_before_rounding);
    expect(row.breakdown.moq_qty).toBe(item.components.moq);
    expect(row.breakdown.pack_multiple).toBe(item.components.pack_multiple);
    expect(row.breakdown.raw_demand_qty).toBe(item.components.raw_demand_quantity);
    expect(row.breakdown.adjusted_regular_demand_qty).toBe(item.components.adjusted_regular_demand_quantity);
    expect(row.breakdown.eligible_inbound).toEqual(item.components.eligible_inbound);
    expect(row.explanation).toBe(item.explanation);
    expect(row.blocker_codes).toEqual([]);
    expect(row.data_warnings).toHaveLength(item.flags.length);
    expect(toRecommendationItem(row, item)).toEqual(item);
    expect(toRecommendationItem({ ...row, recommended_qty: 210 }, item).approved_quantity).toBe(210);
  });

  it("builds supplier sections from one run and keeps server status", () => {
    expect(runRecommendations(run)).toHaveLength(2);
    const orders = runOrders({ ...run, status: "stale_after_edit" });
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe("stale_after_edit");
    expect(orders[0].revision).toBeNull();
    expect(orders[0].lines[0].recommended_qty).toBe(run.suppliers[0].items[0].calculated_quantity);
  });
});
