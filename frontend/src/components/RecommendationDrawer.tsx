import { ChevronDown, ScanLine } from "lucide-react";
import type { Recommendation } from "../types";
import { demoDemandSeries } from "../fixtures/demo";
import { formatDate, formatNumber as n } from "../lib/format";
import { Modal } from "./Modal";
import { DemandChart } from "./DemandChart";
import { Button, Notice, RiskBadge } from "./ui";

export function RecommendationDrawer({
  row,
  onClose,
}: {
  row: Recommendation;
  onClose: () => void;
}) {
  const b = row.breakdown;
  return (
    <Modal title="Обоснование рекомендации" drawer onClose={onClose}>
      <span className="ek-tag">{row.supplier_name}</span>
      <p className="ek-overline">{row.sku}</p>
      <h2 className="ek-detail-title">{row.name}</h2>
      <RiskBadge urgency={row.urgency} />
      {row.id === "rec_demo_1" ? (
        <DemandChart series={demoDemandSeries} unit={row.unit} />
      ) : (
        <p className="ek-muted-note">
          Сервер передаёт числовые компоненты расчёта. Временной ряд по датам
          пока не входит в согласованный API.
        </p>
      )}
      <div className="ek-formula">
        <h3>Из чего складывается заказ</h3>
        {[
          ["Прогноз спроса", b.forecast_qty, ""],
          ["Страховой запас", b.safety_stock, "+ "],
          ["Свободный остаток", b.available_stock, "− "],
          ["Поступит в срок", b.incoming_within_horizon_qty, "− "],
        ].map(([label, value, sign]) => (
          <div className="ek-formula-row" key={String(label)}>
            <span>{label}</span>
            <span>
              {value === null
                ? "—"
                : `${sign}${n(value as number)} ${row.unit}`}
            </span>
          </div>
        ))}
        <div className="ek-formula-row total">
          <span>Потребность</span>
          <span>
            {n(b.net_requirement)} {row.unit}
          </span>
        </div>
      </div>
      <div className="ek-roundbox">
        <div>
          <h3>
            {row.status === "blocked"
              ? "Расчёт заблокирован"
              : row.status === "no_order"
                ? "Заказ не требуется"
                : "Рекомендуем заказать"}
          </h3>
          <p className="ek-small">
            Кратность: {n(b.pack_multiple)} {row.unit}
          </p>
        </div>
        <strong>
          {n(row.recommended_qty)} <small>{row.unit}</small>
        </strong>
      </div>
      {b.purchase_unit !== row.unit && (
        <p className="ek-muted-note">
          К закупке: {n(b.purchase_qty)} {b.purchase_unit}. Одна{" "}
          {b.purchase_unit} = {n(b.purchase_to_stock_factor)} {row.unit}.
        </p>
      )}
      <Notice>{row.explanation}</Notice>
      <dl className="ek-facts">
        <div>
          <dt>Срез остатков</dt>
          <dd>
            {b.stock_snapshot_date
              ? formatDate(b.stock_snapshot_date)
              : "Не предоставлен"}
          </dd>
        </div>
        <div>
          <dt>Горизонт</dt>
          <dd>{b.horizon_days} дней</dd>
        </div>
        <div>
          <dt>Поставка / пересмотр</dt>
          <dd>
            {b.lead_time_days} / {b.review_period_days} дней
          </dd>
        </div>
      </dl>
      <details className="ek-quality">
        <summary>
          <ScanLine size={17} />
          Качество данных и методика
          <ChevronDown size={16} />
        </summary>
        <p>
          {row.data_origin === "synthetic"
            ? "Синтетический сценарий рассчитан сервером."
            : "Значения получены из серверного расчёта загруженного набора."}
        </p>
        <ul>
          <li>Сезонность и тренд представлены в демонстрационном прогнозе.</li>
          <li>
            Исключено разовых продаж: {n(b.excluded_anomaly_qty)} {row.unit}.
          </li>
          <li>
            Восстановлено исторического спроса: {n(b.estimated_lost_sales_qty)}{" "}
            {row.unit}. Он уже учтён в прогнозе и не прибавляется повторно.
          </li>
        </ul>
        {row.data_warnings.map((w) => (
          <Notice key={w.code} error={w.severity === "blocking"}>
            {w.message}
          </Notice>
        ))}
      </details>
      <Button onClick={onClose}>Закрыть</Button>
    </Modal>
  );
}
