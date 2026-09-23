import {
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Files,
  FileSearch,
  Package,
  Truck,
} from "lucide-react";
import { Button, EmptyState, Notice, RiskBadge } from "../components/ui";
import { formatNumber } from "../lib/format";
import type { Page, Recommendation, Urgency } from "../types";

interface OverviewProps {
  recommendations: Recommendation[];
  onNavigate: (page: Page) => void;
  onDetail: (row: Recommendation) => void;
}

// Синтетический ряд только для дизайна графика. Не участвует в закупочном расчёте.
const demandExample = [
  { month: "апр", observed: 34, forecast: 40 },
  { month: "май", observed: 42, forecast: 49 },
  { month: "июн", observed: 38, forecast: 44 },
  { month: "июл", observed: 53, forecast: 60 },
  { month: "авг", observed: 62, forecast: 68 },
  { month: "сен", observed: 68, forecast: 79 },
];
const priority: Record<Urgency, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
  unknown: 4,
};

export function Overview({
  recommendations,
  onNavigate,
  onDetail,
}: OverviewProps) {
  const toOrder = recommendations.filter(
    (row) => row.status === "recommended" && (row.recommended_qty ?? 0) > 0,
  );
  const criticalCount = recommendations.filter(
    (row) => row.urgency === "critical",
  ).length;
  const incomingCount = recommendations.filter(
    (row) => row.incoming_qty !== null && row.incoming_qty > 0,
  ).length;
  const sufficientCount = recommendations.filter(
    (row) => row.status === "no_order" && row.urgency === "normal",
  ).length;
  const blockedCount = recommendations.filter(
    (row) => row.status === "blocked",
  ).length;
  const supplierNames = [
    ...new Map(
      toOrder
        .filter((row) => row.supplier_id !== null)
        .map((row) => [row.supplier_id, row.supplier_name ?? "Без названия"]),
    ).values(),
  ];
  const topRows = [...toOrder]
    .sort((a, b) => priority[a.urgency] - priority[b.urgency])
    .slice(0, 4);
  const taskCount = Number(criticalCount > 0) + Number(blockedCount > 0);

  if (recommendations.length === 0) {
    return (
      <section className="ek-panel">
        <EmptyState title="Обзор появится после расчёта">
          Выберите демонстрационный набор или загрузите данные, чтобы увидеть
          состояние закупок.
        </EmptyState>
        <div className="ek-actions">
          <Button variant="primary" onClick={() => onNavigate("data")}>
            Перейти к данным <ArrowRight size={16} />
          </Button>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="ek-overview-grid">
        <section
          className="ek-panel ek-feature"
          aria-label="Рекомендуемые закупки"
        >
          <div className="ek-feature-top">
            <h2>Рекомендуем заказать</h2>
            <ArrowUpRight size={18} />
          </div>
          <div className="ek-feature-value ek-num">
            {formatNumber(toOrder.length)}
            <span>позиций</span>
          </div>
          <p>
            Поставщиков: {formatNumber(supplierNames.length)} · выбранный расчёт
          </p>
          <div className="ek-feature-bottom">
            <div
              className="ek-supplierdots"
              aria-label={supplierNames.join(", ")}
            >
              {supplierNames.slice(0, 3).map((name) => (
                <span key={name} className="ek-supplierdot" title={name}>
                  {name === "Systeme Electric" ? "SE" : name.slice(0, 3)}
                </span>
              ))}
            </div>
            <Button
              variant="yellow"
              onClick={() => onNavigate("recommendations")}
            >
              Смотреть закупки <ArrowRight size={15} />
            </Button>
          </div>
        </section>

        <div
          className="ek-mini-grid"
          aria-label="Показатели выбранного расчёта"
        >
          <div className="ek-mini ek-highlight">
            <div className="ek-mini-top">
              Риск дефицита <CircleAlert size={17} />
            </div>
            <strong className="ek-num">{formatNumber(criticalCount)}</strong>
            <span className="ek-small">
              Требуют внимания
              <br />в ближайшие дни
            </span>
          </div>
          <div className="ek-mini">
            <div className="ek-mini-top">
              В пути <Truck size={17} />
            </div>
            <strong className="ek-num">{formatNumber(incomingCount)}</strong>
            <span className="ek-small">
              Позиции с ожидаемым
              <br />
              поступлением
            </span>
          </div>
          <div className="ek-mini">
            <div className="ek-mini-top">
              В норме <Check size={17} />
            </div>
            <strong className="ek-num">{formatNumber(sufficientCount)}</strong>
            <span className="ek-small">Закупка не требуется</span>
          </div>
          <div className="ek-mini">
            <div className="ek-mini-top">
              Нужны данные <FileSearch size={17} />
            </div>
            <strong className="ek-num">{formatNumber(blockedCount)}</strong>
            <span className="ek-small">Проверить источники</span>
          </div>
        </div>

        <section className="ek-panel" aria-labelledby="overview-demand-title">
          <div className="ek-panelhead">
            <h2 id="overview-demand-title">Как меняется спрос</h2>
            <ChartNoAxesCombined size={18} />
          </div>
          <div className="ek-small">
            Синтетический пример · выключатели, шт.
          </div>
          <div
            className="ek-bars"
            role="img"
            aria-label="Пример графика, не данные текущего расчёта. С апреля по сентябрь продажи: 34, 42, 38, 53, 62, 68 штук. Модельный прогноз: 40, 49, 44, 60, 68, 79 штук."
          >
            <div className="ek-scale">
              <span>80</span>
              <span>40</span>
              <span>0</span>
            </div>
            <div className="ek-barplot">
              {demandExample.map((point) => (
                <div
                  className="ek-barcol"
                  key={point.month}
                  title={`${point.month}: продажи ${point.observed}, прогноз ${point.forecast} шт.`}
                >
                  <b style={{ height: `${(point.observed / 80) * 100}%` }} />
                  <b
                    className="forecast"
                    style={{ height: `${(point.forecast / 80) * 100}%` }}
                  />
                  <span>{point.month}</span>
                </div>
              ))}
            </div>
          </div>
          <div
            className="ek-chart-head"
            style={{ justifyContent: "flex-end", marginTop: 10 }}
          >
            <span className="ek-key">Продажи</span>
            <span className="ek-key ek-forecast">Прогноз</span>
          </div>
          <p className="ek-small" style={{ marginTop: 12 }}>
            Иллюстрация интерфейса, не прогноз по загруженным данным.
          </p>
        </section>
      </div>

      <div className="ek-bottomgrid">
        <section className="ek-panel">
          <div className="ek-panelhead">
            <h2>В фокусе сегодня</h2>
            <span className="ek-small">
              {String(taskCount).padStart(2, "0")}
            </span>
          </div>
          {criticalCount > 0 && (
            <div className="ek-task">
              <span className="ek-task-icon">
                <Clock3 size={18} />
              </span>
              <div>
                <h3>Проверить срочные позиции</h3>
                <p>
                  Позиций с высоким риском дефицита:{" "}
                  {formatNumber(criticalCount)}.
                </p>
                <Button
                  variant="link"
                  onClick={() => onNavigate("recommendations")}
                >
                  Открыть <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}
          {blockedCount > 0 && (
            <div className="ek-task">
              <span className="ek-task-icon">
                <Files size={18} />
              </span>
              <div>
                <h3>Дополнить исходные данные</h3>
                <p>
                  Позиций с заблокированным расчётом:{" "}
                  {formatNumber(blockedCount)}.
                </p>
                <Button variant="link" onClick={() => onNavigate("data")}>
                  К источникам <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}
          {taskCount === 0 && (
            <Notice>
              Срочных позиций и блокирующих ошибок в выбранном расчёте нет.
            </Notice>
          )}
          <div
            style={{ paddingTop: 14, borderTop: "1px solid var(--ekt-line)" }}
          >
            <span className="ek-small">Данные выбранного расчёта</span>
            <p style={{ marginTop: 6, fontSize: 11 }}>
              Проверено позиций: {formatNumber(recommendations.length)}
            </p>
          </div>
        </section>

        <section className="ek-panel">
          <div className="ek-panelhead">
            <h2>Приоритетные закупки</h2>
            <Button
              variant="link"
              onClick={() => onNavigate("recommendations")}
            >
              Все позиции <ArrowUpRight size={14} />
            </Button>
          </div>
          {topRows.length === 0 ? (
            <EmptyState title="Закупка пока не требуется">
              Проверьте заблокированные позиции, если они есть.
            </EmptyState>
          ) : (
            topRows.map((row) => (
              <div className="ek-lineitem" key={row.id}>
                <span className="ek-item-icon">
                  <Package size={18} />
                </span>
                <div className="ek-lineitem-main">
                  <h3>{row.name}</h3>
                  <small>
                    {row.supplier_name ?? "Поставщик не указан"} · {row.sku}
                  </small>
                </div>
                <div className="ek-lineitem-qty ek-num">
                  {formatNumber(row.recommended_qty)}{" "}
                  <span className="ek-small">{row.unit}</span>
                  <div style={{ marginTop: 4 }}>
                    <RiskBadge urgency={row.urgency} />
                  </div>
                </div>
                <button
                  type="button"
                  className="ek-iconbutton"
                  onClick={() => onDetail(row)}
                  aria-label={`Обоснование: ${row.name}`}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  );
}
