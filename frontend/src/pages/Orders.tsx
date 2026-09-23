import { useState } from "react";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Download,
  FileCheck2,
  Save,
  ShieldCheck,
} from "lucide-react";
import type { OrderLine, PurchaseOrder, Recommendation } from "../types";
import { formatDate, formatNumber as n } from "../lib/format";
import { Button, EmptyState, Notice } from "../components/ui";
import { Modal } from "../components/Modal";

interface Props {
  orders: PurchaseOrder[];
  selectedId: string | null;
  recommendations: Recommendation[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDetail: (row: Recommendation) => void;
  onSave: (
    order: PurchaseOrder,
    lineId: string,
    quantity: number,
    reason: string,
  ) => Promise<void>;
  onApprove: (order: PurchaseOrder) => Promise<void>;
  onExport: (order: PurchaseOrder, format: "csv" | "xlsx") => Promise<void>;
}
export function Orders(props: Props) {
  const order =
    props.orders.find((o) => o.id === props.selectedId) || props.orders[0];
  if (!order)
    return (
      <section className="ek-panel">
        <EmptyState title="Здесь появится заказ по расчёту">
          Загрузите данные и выполните расчёт. Поставщики будут показаны отдельными разделами.
        </EmptyState>
        <div className="ek-empty-action">
          <Button variant="primary" onClick={props.onCreate}>
            К данным
            <ArrowRight size={17} />
          </Button>
        </div>
      </section>
    );
  return (
    <div className="ek-ordergrid">
      <section className="ek-panel">
        <div className="ek-panelhead">
          <h2>Поставщики расчёта</h2>
          <span className="ek-tag">Всего: {props.orders.length}</span>
        </div>
        {props.orders.map((item) => (
          <article
            className={`ek-ordercard ${item.id === order.id ? "is-selected" : ""}`}
            key={item.id}
          >
            <div className="ek-ordercard-head">
              <div>
                <div className="ek-orderlabel">РАСЧЁТ {item.number}</div>
                <h3>{item.supplier_name}</h3>
              </div>
              <span
                className={`ek-tag ${item.status === "approved" ? "ek-ok" : "ek-quiet"}`}
              >
                {item.status === "approved" ? "Подтверждён" : item.status === "stale_after_edit" ? "Нужно повторное подтверждение" : "Черновик"}
              </span>
            </div>
            <div className="ek-order-meta">
              <span>{formatDate(item.created_at)}</span>
              <span>Позиций: {item.lines.length}</span>
              <span>Алматы</span>
            </div>
            <Button variant="link" onClick={() => props.onSelect(item.id)}>
              Открыть заказ
              <ArrowRight size={17} />
            </Button>
          </article>
        ))}
        <Notice>
          Все разделы относятся к одному серверному расчёту. Подтверждение и
          экспорт охватывают весь расчёт; поставщику ничего не отправляется.
        </Notice>
      </section>
      <OrderEditor key={order.id} {...props} order={order} />
    </div>
  );
}

function OrderEditor({
  order,
  orders,
  recommendations,
  onSave,
  onApprove,
  onExport,
  onDetail,
}: Props & { order: PurchaseOrder }) {
  const [confirmation, setConfirmation] = useState(false);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const unsaved = Object.values(dirty).some(Boolean);
  const approved = order.status === "approved";
  return (
    <section className="ek-panel">
      <div className="ek-panelhead">
        <div>
          <div className="ek-orderlabel">
            {approved ? "ПОДТВЕРЖДЁННЫЙ РАСЧЁТ" : order.status === "stale_after_edit" ? "ТРЕБУЕТ ПОВТОРНОГО ПОДТВЕРЖДЕНИЯ" : "РЕДАКТИРОВАНИЕ ЗАКАЗА"}
          </div>
          <h2 className="ek-detail-title">{order.supplier_name}</h2>
        </div>
        <ClipboardList size={23} />
      </div>
      {order.lines.map((line) => (
        <EditableLine
          key={`${line.id}-${line.ordered_qty}-${line.change_reason}`}
          line={line}
          row={recommendations.find((r) => r.id === line.recommendation_id)!}
          onDirty={(value) =>
            setDirty((previous) => ({ ...previous, [line.id]: value }))
          }
          onSave={async (quantity, reason) => {
            await onSave(order, line.id, quantity, reason);
            setDirty((previous) => ({ ...previous, [line.id]: false }));
          }}
        />
      ))}
      <Notice>
        <ShieldCheck size={16} />{" "}
        {approved
          ? "Весь расчёт подтверждён и готов к экспорту. Правка количества снимет утверждение."
          : "Проверьте состав и количество всех поставщиков. Подтверждение относится ко всему расчёту."}
      </Notice>
      {unsaved && (
        <p className="ek-form-message" role="status">
          Сохраните изменения строк перед подтверждением или экспортом.
        </p>
      )}
      <div className="ek-actions">
        {approved ? (
          <Button variant="primary" disabled={unsaved} onClick={() => { void onExport(order, "csv").catch((cause) => setError(cause instanceof Error ? cause.message : "Ошибка экспорта.")); }}>
            <Download size={17} />
            Скачать заказ CSV
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={unsaved || !order.lines.some((l) => l.ordered_qty > 0)}
            onClick={() => setConfirmation(true)}
          >
            <Check size={17} />
            Подтвердить весь расчёт
          </Button>
        )}
        {approved && <Button disabled={unsaved} onClick={() => { void onExport(order, "xlsx").catch((cause) => setError(cause instanceof Error ? cause.message : "Ошибка XLSX-экспорта.")); }}>
          <Download size={17} /> Скачать заказ XLSX
        </Button>}
        <Button
          onClick={() => {
            const row = recommendations.find(
              (r) => r.id === order.lines[0]?.recommendation_id,
            );
            if (row) onDetail(row);
          }}
        >
          Обоснование
        </Button>
      </div>
      {error && !confirmation && <Notice error>{error}</Notice>}
      {order.revision !== null && <details className="ek-quality">
        <summary>История действий · ревизия {order.revision}</summary>
        <ol>
          {order.audit_events.map((event) => (
            <li key={event.id}>
              {formatDate(event.at)} —{" "}
              {
                {
                  created: "Черновик создан",
                  line_changed: "Количество изменено",
                  approved: "Заказ подтверждён",
                }[event.action]
              }
              {event.action === "line_changed" &&
                `: ${n(event.old_qty)} → ${n(event.new_qty)}`}
              {event.reason && <span> · {event.reason}</span>}
            </li>
          ))}
        </ol>
      </details>}
      {confirmation && (
        <Modal
          title="Подтвердить весь расчёт?"
          onClose={() => setConfirmation(false)}
        >
          <span className="ek-tag">
            {order.supplier_name} · {order.number}
          </span>
          <p className="ek-muted-note">
            Подтверждение коснётся всех {orders.length} поставщиков.
            Текущий раздел содержит {order.lines.filter((l) => l.ordered_qty > 0).length} позиций к закупке.
          </p>
          <ul className="ek-confirm-lines">
            {order.lines
              .filter((l) => l.ordered_qty > 0)
              .map((line) => (
                <li key={line.id}>
                  <span>{line.name}</span>
                  <strong>
                    {n(line.ordered_qty)} {line.unit}
                  </strong>
                  {line.change_reason && (
                    <small>
                      Изменено с {n(line.recommended_qty)}: {line.change_reason}
                    </small>
                  )}
                </li>
              ))}
          </ul>
          <Notice>
            Подтверждение сохраняется на сервере. Автоматической отправки поставщику нет.
          </Notice>
          {error && <Notice error>{error}</Notice>}
          <div className="ek-actions">
            <Button
              variant="primary"
              onClick={() => {
                try {
                  void onApprove(order).then(() => setConfirmation(false)).catch((cause) =>
                    setError(cause instanceof Error ? cause.message : "Ошибка подтверждения."));
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Ошибка подтверждения.",
                  );
                }
              }}
            >
              <FileCheck2 size={17} />
              Подтвердить
            </Button>
            <Button onClick={() => setConfirmation(false)}>Вернуться</Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function EditableLine({
  line,
  row,
  onSave,
  onDirty,
}: {
  line: OrderLine;
  row: Recommendation;
  onSave: (quantity: number, reason: string) => Promise<void>;
  onDirty: (dirty: boolean) => void;
}) {
  const [quantity, setQuantity] = useState(String(line.ordered_qty));
  const [reason, setReason] = useState(line.change_reason || "");
  const [error, setError] = useState("");
  const dirty =
    quantity !== String(line.ordered_qty) ||
    reason !== (line.change_reason || "");
  function update(nextQuantity: string, nextReason: string) {
    setQuantity(nextQuantity);
    setReason(nextReason);
    setError("");
    onDirty(
      nextQuantity !== String(line.ordered_qty) ||
        nextReason !== (line.change_reason || ""),
    );
  }
  return (
    <form
      className="ek-orderline-form"
      onSubmit={(event) => {
        event.preventDefault();
        const value = quantity.trim() === "" ? NaN : Number(quantity);
        const problem = !Number.isFinite(value) || value < 0
          ? "Укажите количество не меньше нуля."
          : !reason.trim()
            ? "Укажите причину изменения."
            : null;
        if (problem) {
          setError(problem);
          return;
        }
        void onSave(value, reason).catch((cause) =>
          setError(cause instanceof Error ? cause.message : "Не удалось сохранить строку."));
      }}
    >
      <div className="ek-orderline">
        <div>
          <h3>{line.name}</h3>
          <small>
            Рекомендовано: {n(line.recommended_qty)} {line.unit} · кратность{" "}
            {n(row.breakdown.pack_multiple)}
          </small>
        </div>
        <label className="ek-field">
          <span>Заказать, {line.unit}</span>
          <input
            type="number"
            min="0"
            step="any"
            value={quantity}
            required
            aria-label={`Количество ${line.name}`}
            onChange={(e) => update(e.target.value, reason)}
          />
        </label>
      </div>
      {(Number(quantity) !== line.ordered_qty || reason) && (
        <label className="ek-field ek-reason">
          Причина изменения
          <textarea
            className="ek-input"
            value={reason}
            minLength={1}
            maxLength={500}
            required
            aria-label={`Причина изменения ${line.name}`}
            onChange={(e) => update(quantity, e.target.value)}
            placeholder="Например, ожидается дополнительный проектный заказ"
          />
        </label>
      )}
      {line.purchase_unit !== line.unit && (
        <p className="ek-small">
          Закупочная единица: {line.purchase_unit}; коэффициент{" "}
          {line.purchase_to_stock_factor} {line.unit}.
        </p>
      )}
      {line.change_reason && (
        <p className="ek-muted-note">Причина: {line.change_reason}</p>
      )}
      {error && (
        <p className="ek-field-error" role="alert">
          {error}
        </p>
      )}
      {dirty && (
        <Button type="submit" variant="link">
          <Save size={16} />
          Сохранить строку
        </Button>
      )}
    </form>
  );
}
