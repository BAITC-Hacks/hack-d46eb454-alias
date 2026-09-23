import {
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  Package,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react";
import type { Recommendation, RecommendationFilters } from "../types";
import { formatNumber as n } from "../lib/format";
import { Button, EmptyState, RiskBadge } from "../components/ui";
import { Pagination } from "../components/Pagination";
import { usePagination } from "../lib/pagination";

export function filterRecommendations(
  rows: Recommendation[],
  filters: RecommendationFilters,
) {
  return rows.filter(
    (r) =>
      (!filters.q ||
        `${r.name} ${r.sku} ${r.internal_code}`
          .toLocaleLowerCase("ru")
          .includes(filters.q.toLocaleLowerCase("ru"))) &&
      (filters.supplier_id === "all" ||
        r.supplier_id === filters.supplier_id) &&
      (filters.urgency === "all" || r.urgency === filters.urgency) &&
      (filters.status === "all" || r.status === filters.status),
  );
}
interface Props {
  rows: Recommendation[];
  filters: RecommendationFilters;
  onFilters: (filters: RecommendationFilters) => void;
  onDetail: (row: Recommendation) => void;
  onCreate: () => void;
}
export function Recommendations({
  rows,
  filters,
  onFilters,
  onDetail,
  onCreate,
}: Props) {
  const visible = filterRecommendations(rows, filters);
  const pagination = usePagination(visible, JSON.stringify([rows[0]?.calculation_id, filters]));
  const suppliers = [
    ...new Map(rows.map((r) => [r.supplier_id, r.supplier_name])).entries(),
  ];
  return (
    <>
      <div className="ek-stats">
          <div className="ek-stat">
            <div>
              <small>{rows.length && rows.every(r => r.recommended_qty === null) ? "Рассчитан прогноз спроса" : rows.some(r => r.flags?.includes("estimated_stock")) ? "В предварительном плане" : "Рекомендовано к закупке"}</small>
              <div>
                <strong>
                  {rows.length && rows.every(r => r.recommended_qty === null) ? rows.length : rows.filter((r) => r.status === "recommended").length}
                </strong>{" "}
                <span className="ek-small">позиций</span>
              </div>
            </div>
            <ShoppingBag />
          </div>
          <div className="ek-stat">
            <div>
              <small>Поставщики</small>
              <div>
                <strong>{suppliers.length}</strong>{" "}
                <span className="ek-small">в этом расчёте</span>
              </div>
            </div>
            <Truck />
          </div>
          <div className="ek-stat">
            <div>
              <small>Срочное пополнение</small>
              <div>
                <strong>
                  {rows.filter((r) => r.urgency === "critical").length}
                </strong>{" "}
                <span className="ek-small">позиции</span>
              </div>
            </div>
            <CircleAlert />
          </div>
      </div>
      <section className="ek-panel">
        <div className="ek-toolbar">
          <div className="ek-filterrow">
            <div className="ek-inputwrap">
              <Search size={17} />
              <input
                className="ek-input"
                aria-label="Поиск по товарам"
                placeholder="Название или артикул"
                value={filters.q}
                onChange={(e) => onFilters({ ...filters, q: e.target.value })}
              />
            </div>
            <select
              className="ek-select"
              aria-label="Поставщик"
              value={filters.supplier_id}
              onChange={(e) =>
                onFilters({ ...filters, supplier_id: e.target.value })
              }
            >
              <option value="all">Все поставщики</option>
              {suppliers.map(([id, name]) => (
                <option key={id} value={id || ""}>
                  {name || "Не указан"}
                </option>
              ))}
            </select>
            <select
              className="ek-select"
              aria-label="Срочность"
              value={filters.urgency}
              onChange={(e) =>
                onFilters({ ...filters, urgency: e.target.value })
              }
            >
              <option value="all">Любая срочность</option>
              <option value="critical">Срочно</option>
              <option value="high">На этой неделе</option>
              <option value="normal">В норме</option>
              <option value="low">Низкий</option>
              <option value="unknown">Нужны данные</option>
            </select>
            <select
              className="ek-select"
              aria-label="Статус расчёта"
              value={filters.status}
              onChange={(e) =>
                onFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="all">Все позиции</option>
              <option value="recommended">К закупке</option>
              <option value="no_order">Запаса достаточно</option>
              <option value="blocked">Только прогноз — нет остатка</option>
            </select>
          </div>
          <span className="ek-small">Найдено: {visible.length}</span>
        </div>
        <Pagination {...pagination} label="Страницы закупок сверху" />
        {visible.length === 0 ? (
          <EmptyState title="Ничего не найдено">
            Попробуйте другой запрос или сбросьте фильтры.{" "}
            <Button
              variant="link"
              onClick={() =>
                onFilters({
                  q: "",
                  supplier_id: "all",
                  urgency: "all",
                  status: "all",
                })
              }
            >
              Сбросить фильтры
            </Button>
          </EmptyState>
        ) : (
          <div className="ek-tablewrap">
            <table className="ek-table">
              <caption className="sr-only">
                Рекомендации, сгруппированные по поставщикам
              </caption>
              <thead>
                <tr>
                  <th>
                    <Package size={17} />
                  </th>
                  <th>Товар / артикул</th>
                  <th className="ek-right">Остаток</th>
                  <th className="ek-right">В пути</th>
                  <th className="ek-right">Прогноз спроса</th>
                  <th className="ek-right">К заказу</th>
                  <th>Приоритет</th>
                  <th>Обоснование</th>
                  <th></th>
                </tr>
              </thead>
              {suppliers.map(([supplierId, supplierName]) => {
                const group = pagination.rows.filter(
                  (r) => r.supplier_id === supplierId,
                );
                if (!group.length) return null;
                return (
                  <tbody key={supplierId}>
                    <tr className="ek-group-row">
                      <th scope="rowgroup" colSpan={9}>
                        {supplierName || "Поставщик не указан"}{" "}
                        <span>{group.length} позиций на странице</span>
                      </th>
                    </tr>
                    {group.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Package size={17} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ek-product"
                            onClick={() => onDetail(row)}
                          >
                            <span>
                              <strong>{row.name}</strong>
                              <small>{row.sku}</small>
                            </span>
                          </button>
                        </td>
                        <td className="ek-right">
                          {n(row.available_stock)}{" "}
                          {row.flags?.includes("estimated_stock") && <small>оценка</small>}
                          <span className="ek-small">{row.unit}</span>
                        </td>
                        <td className="ek-right">{n(row.incoming_qty)}</td>
                        <td className="ek-right">{n(row.forecast_qty)} <span className="ek-small">{row.unit}</span></td>
                        <td className="ek-right ek-qty">
                          {row.recommended_qty === null ? "Нет данных об остатке" : n(row.recommended_qty)}{" "}
                          {row.flags?.includes("estimated_stock") && <small>предварительно</small>}
                          <span className="ek-small">{row.unit}</span>
                        </td>
                        <td>
                          <RiskBadge urgency={row.urgency} />
                        </td>
                        <td className="ek-explanation">{row.explanation}</td>
                        <td>
                          <button
                            type="button"
                            className="ek-iconbutton"
                            aria-label={`Обоснование: ${row.name}`}
                            onClick={() => onDetail(row)}
                          >
                            <ArrowUpRight size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
        <Pagination {...pagination} label="Страницы закупок снизу" />
        <div className="ek-tablefoot">
          <span className="ek-small">
            Позиций: {visible.length} · заказ включает весь расчёт
          </span>
          <div className="ek-actions">
            <Button
              variant="primary"
              onClick={onCreate}
              disabled={!rows.some((row) => row.status === "recommended")}
            >
              Открыть заказ
              <ArrowRight size={17} />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
