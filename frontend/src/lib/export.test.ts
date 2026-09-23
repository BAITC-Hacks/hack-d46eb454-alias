import { describe, expect, it } from "vitest";
import { csvCell, makeCsv } from "./export";
import { filterRecommendations } from "../pages/Recommendations";
import { demoRecommendations as rows } from "../fixtures/demo";

describe("CSV и локальная фильтрация", () => {
  it("защищает текстовые ячейки от формул Excel", () => {
    expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');
    expect(csvCell("  +123")).toBe('"\'  +123"');
    expect(csvCell(-12)).toBe("-12");
    expect(csvCell(null)).toBe("");
    expect(makeCsv([["Артикул", "Количество"], ["001", null]])).toBe('\uFEFF"Артикул";"Количество"\r\n"001";');
  });
  it("комбинирует поиск и фильтры в уже полученном списке", () => {
    expect(filterRecommendations(rows, { q: "ва47", supplier_id: "sup_iek", status: "recommended", urgency: "critical" })).toHaveLength(1);
    expect(filterRecommendations(rows, { q: "нет такого", supplier_id: "all", status: "all", urgency: "all" })).toHaveLength(0);
  });
});
