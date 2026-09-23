import {
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  Download,
  Package,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react";
import type { Recommendation, RecommendationFilters } from "../types";
import { formatNumber as n } from "../lib/format";
import { Button, EmptyState, RiskBadge } from "../components/ui";

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
  selected: string[];
  onSelected: (ids: string[]) => void;
  onDetail: (row: Recommendation) => void;
  onCreate: () => void;
  onExport: (rows: Recommendation[]) => void;
  catalog?: boolean;
  serverRun?: boolean;
  blockedByMissingStock?: boolean;
  onLoadData?: () => void;
}
export function Recommendations({
  rows,
  filters,
  onFilters,
  selected,
  onSelected,
  onDetail,
  onCreate,
  onExport,
  catalog = false,
  serverRun = false,
  blockedByMissingStock = false,
  onLoadData,
}: Props) {
  const visible = filterRecommendations(rows, filters);
  const suppliers = [
    ...new Map(rows.map((r) => [r.supplier_id, r.supplier_name])).entries(),
  ];
  const selectable = visible.filter(
    (r) => r.status === "recommended" && r.supplier_id,
  );
  const everySelected =
    selectable.length > 0 && selectable.every((r) => selected.includes(r.id));
  const toggleAll = () =>
    onSelected(
      everySelected
        ? selected.filter((id) => !selectable.some((r) => r.id === id))
        : [...new Set([...selected, ...selectable.map((r) => r.id)])],
    );
  return (
    <>
      {!catalog && !blockedByMissingStock && (
        <div className="ek-stats">
          <div className="ek-stat">
            <div>
              <small>Рекомендовано к закупке</small>
              <div>
                <strong>
                  {rows.filter((r) => r.status === "recommended").length}
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
      )}
      <section className="ek-panel">
        {blockedByMissingStock ? (
          <EmptyState title="Расчёт ждёт актуальные остатки">
            В архиве нет остатка по каждому товару на дату расчёта. Добавьте XLSX
            с колонками «Код 1С», «Остаток», «Дата», «Склад» и загрузите набор снова.
            {onLoadData && <Button variant="primary" onClick={onLoadData}>К загрузке данных</Button>}
          </EmptyState>
        ) : <>
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
              <option value="blocked">Недостаточно данных</option>
            </select>
          </div>
          <span className="ek-small">Найдено: {visible.length}</span>
        </div>
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
                {catalog
                  ? "Каталог товаров"
                  : "Рекомендации, сгруппированные по поставщикам"}
              </caption>
              <thead>
                <tr>
                  <th>
                    {catalog || serverRun ? (
                      <Package size={17} />
                    ) : (
                      <input
                        type="checkbox"
                        aria-label="Выбрать все доступные строки на экране"
                        checked={everySelected}
                        disabled={!selectable.length}
                        onChange={toggleAll}
                      />
                    )}
                  </th>
                  <th>Товар / артикул</th>
                  <th className="ek-right">Остаток</th>
                  <th className="ek-right">В пути</th>
                  <th className="ek-right">К заказу</th>
                  <th>Приоритет</th>
                  <th>Обоснование</th>
                  <th></th>
                </tr>
              </thead>
              {suppliers.map(([supplierId, supplierName]) => {
                const group = visible.filter(
                  (r) => r.supplier_id === supplierId,
                );
                if (!group.length) return null;
                return (
                  <tbody key={supplierId}>
                    <tr className="ek-group-row">
                      <th scope="rowgroup" colSpan={8}>
                        {supplierName || "Поставщик не указан"}{" "}
                        <span>{group.length} позиций</span>
                      </th>
                    </tr>
                    {group.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {catalog || serverRun ? (
                            <Package size={17} />
                          ) : (
                            <input
                              type="checkbox"
                              aria-label={`Выбрать ${row.name}`}
                              disabled={
                                row.status !== "recommended" || !row.supplier_id
                              }
                              checked={selected.includes(row.id)}
                              onChange={(e) =>
                                onSelected(
                                  e.target.checked
                                    ? [...selected, row.id]
                                    : selected.filter((id) => id !== row.id),
                                )
                              }
                            />
                          )}
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
                          <span className="ek-small">{row.unit}</span>
                        </td>
                        <td className="ek-right">{n(row.incoming_qty)}</td>
                        <td className="ek-right ek-qty">
                          {n(row.recommended_qty)}{" "}
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
        <div className="ek-tablefoot">
          <span className="ek-small">
            {catalog
              ? `${visible.length} из ${rows.length} товаров`
              : serverRun ? `Позиций: ${visible.length} · заказ включает весь расчёт` : `Выбрано позиций: ${selected.length} · заказ отдельно по каждому поставщику`}
          </span>
          <div className="ek-actions">
            <Button
              onClick={() => onExport(visible)}
              disabled={!visible.length}
            >
              <Download size={17} />
              Экспорт CSV
            </Button>
            {!catalog && (
              <Button
                variant="primary"
                onClick={onCreate}
                disabled={serverRun ? !rows.some((row) => row.status === "recommended") : !selected.length}
              >
                {serverRun ? "Открыть заказ" : "Создать заказ"}
                <ArrowRight size={17} />
              </Button>
            )}
          </div>
        </div>
        </>}
      </section>
    </>
  );
}
