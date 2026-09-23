import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  Save,
} from "lucide-react";
import { Button, EmptyState, Notice } from "../components/ui";
import { formatNumber } from "../lib/format";
import type { Recommendation, Supplier } from "../types";

interface SuppliersProps {
  suppliers: Supplier[];
  recommendations: Recommendation[];
  onSave: (supplier: Supplier) => void;
  onCatalog: (id: string) => void;
}

function SupplierCard({
  supplier,
  recommendations,
  onSave,
  onCatalog,
}: {
  supplier: Supplier;
  recommendations: Recommendation[];
  onSave: SuppliersProps["onSave"];
  onCatalog: SuppliersProps["onCatalog"];
}) {
  const [leadTime, setLeadTime] = useState(
    supplier.policy.lead_time_days?.toString() ?? "",
  );
  const [reviewPeriod, setReviewPeriod] = useState(
    supplier.policy.review_period_days?.toString() ?? "",
  );
  const [assumptionNote, setAssumptionNote] = useState(
    supplier.policy.assumption_note ?? "",
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const rows = recommendations.filter((row) => row.supplier_id === supplier.id);
  const productCount = new Set(rows.map((row) => row.product_id)).size;
  const recommendedCount = rows.filter(
    (row) => row.status === "recommended" && (row.recommended_qty ?? 0) > 0,
  ).length;
  const fieldPrefix = `supplier-${supplier.id}`;

  function updateField(setter: (value: string) => void, value: string) {
    setter(value);
    setSaved(false);
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lead = Number(leadTime);
    const review = Number(reviewPeriod);
    if (
      !leadTime.trim() ||
      !reviewPeriod.trim() ||
      !Number.isInteger(lead) ||
      !Number.isInteger(review) ||
      lead < 1 ||
      review < 0 ||
      lead > 365 ||
      review > 365
    ) {
      setError("Срок поставки: целое число 1–365 дней, пересмотр: 0–365 дней.");
      return;
    }
    if (lead + review > 365) {
      setError(
        "Сумма срока поставки и периода пересмотра не должна превышать 365 дней.",
      );
      return;
    }
    if (!assumptionNote.trim()) {
      setError(
        "Укажите основание сроков. Если это предположение, прямо обозначьте его как допущение.",
      );
      return;
    }
    setError("");
    onSave({
      ...supplier,
      config_revision: supplier.config_revision + 1,
      policy: {
        lead_time_days: lead,
        review_period_days: review,
        assumption_note: assumptionNote.trim(),
      },
    });
    setSaved(true);
  }

  return (
    <section className="ek-panel">
      <div className="ek-panelhead">
        <span className="ek-tag">Локальный пример</span>
        <ArrowUpRight size={18} />
      </div>
      <div className="ek-supplybrand">
        {supplier.name === "Systeme Electric" ? (
          <>
            Systeme
            <br />
            <span>Electric</span>
          </>
        ) : (
          supplier.name
        )}
      </div>
      <div className="ek-small">
        Товаров в наборе: {formatNumber(productCount)} · к заказу:{" "}
        {formatNumber(recommendedCount)}
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <div className="ek-formgrid">
          <label className="ek-field" htmlFor={`${fieldPrefix}-lead`}>
            Срок поставки, дней
            <input
              id={`${fieldPrefix}-lead`}
              className="ek-input"
              type="number"
              min={1}
              max={365}
              step={1}
              inputMode="numeric"
              value={leadTime}
              onChange={(event) => updateField(setLeadTime, event.target.value)}
              aria-label={`Срок поставки ${supplier.name}`}
              aria-invalid={Boolean(error)}
            />
          </label>
          <label className="ek-field" htmlFor={`${fieldPrefix}-review`}>
            Пересмотр заказа, дней
            <input
              id={`${fieldPrefix}-review`}
              className="ek-input"
              type="number"
              min={0}
              max={365}
              step={1}
              inputMode="numeric"
              value={reviewPeriod}
              onChange={(event) =>
                updateField(setReviewPeriod, event.target.value)
              }
              aria-label={`Период пересмотра ${supplier.name}`}
              aria-invalid={Boolean(error)}
            />
          </label>
        </div>
        <label className="ek-field" htmlFor={`${fieldPrefix}-note`}>
          Основание сроков / допущение
          <textarea
            id={`${fieldPrefix}-note`}
            className="ek-input"
            rows={3}
            style={{
              width: "100%",
              resize: "vertical",
              font: "inherit",
              padding: 12,
            }}
            value={assumptionNote}
            onChange={(event) =>
              updateField(setAssumptionNote, event.target.value)
            }
            placeholder="Например: допущение менеджера, сроки поставщика ещё не подтверждены"
          />
        </label>
        <Notice>
          Сроки задаются менеджером как допущение. Сохранение действует только в
          локальном демо и не меняет рекомендации: для новых количеств нужен
          новый серверный расчёт.
        </Notice>
        {error && <Notice error>{error}</Notice>}
        {saved && (
          <p className="ek-small" role="status" style={{ marginBottom: 12 }}>
            Настройки переданы в локальное демо. Сохранённые рекомендации не
            изменены.
          </p>
        )}
        <div className="ek-actions" style={{ justifyContent: "space-between" }}>
          <Button type="submit" variant="primary">
            <Save size={15} /> Сохранить сроки
          </Button>
          <Button variant="link" onClick={() => onCatalog(supplier.id)}>
            Товары поставщика <ArrowRight size={14} />
          </Button>
        </div>
      </form>
    </section>
  );
}

export function Suppliers({
  suppliers,
  recommendations,
  onSave,
  onCatalog,
}: SuppliersProps) {
  if (suppliers.length === 0) {
    return (
      <section className="ek-panel">
        <EmptyState title="Поставщики пока не добавлены">
          Загрузите набор с поставщиками или откройте демонстрационный пример.
        </EmptyState>
      </section>
    );
  }

  return (
    <>
      <div className="ek-supplygrid">
        {suppliers.map((supplier) => (
          <SupplierCard
            key={`${supplier.id}:${supplier.config_revision}`}
            supplier={supplier}
            recommendations={recommendations}
            onSave={onSave}
            onCatalog={onCatalog}
          />
        ))}
      </div>
      <section className="ek-panel" style={{ marginTop: 18 }}>
        <div className="ek-panelhead">
          <h2>Правила заказа</h2>
          <span className="ek-small">По каждой позиции</span>
        </div>
        <div className="ek-task">
          <span className="ek-task-icon">
            <Boxes size={18} />
          </span>
          <div>
            <h3>Минимальная партия и кратность</h3>
            <p>
              Параметры берутся из сохранённого расчёта по товару. Метры и бухты
              показываются отдельно, если известен коэффициент пересчёта.
            </p>
          </div>
        </div>
        <div className="ek-task">
          <span className="ek-task-icon">
            <CalendarClock size={18} />
          </span>
          <div>
            <h3>Учитываем даты поступлений</h3>
            <p>
              В расчёт входят поступления в нужном горизонте. Изменение сроков
              само по себе не пересчитывает уже сохранённый заказ.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
