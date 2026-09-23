import { useEffect, useState } from "react";
import { ArrowRight, Check, Info, Plus, RotateCcw } from "lucide-react";
import { AppShell, navigation } from "./components/AppShell";
import { Button, Notice } from "./components/ui";
import { Modal } from "./components/Modal";
import { RecommendationDrawer } from "./components/RecommendationDrawer";
import { Overview } from "./pages/Overview";
import { Recommendations } from "./pages/Recommendations";
import { Orders } from "./pages/Orders";
import { Data } from "./pages/Data";
import { Suppliers } from "./pages/Suppliers";
import { initialSuppliers } from "./fixtures/demo";
import { downloadCsv } from "./lib/export";
import { runOrders, runRecommendations } from "./api/mapper";
import { useBackend } from "./api/useBackend";
import { useLocalState } from "./hooks/useLocalState";
import type { DataQualityWarning } from "./api/schema";
import type {
  Design,
  Page,
  Recommendation,
  RecommendationFilters,
  Supplier,
} from "./types";

const readPage = (): Page =>
  navigation.find((n) => n.id === location.hash.replace("#/", "").split("?")[0])
    ?.id || "data";
const emptyFilters: RecommendationFilters = {
  q: "",
  supplier_id: "all",
  urgency: "all",
  status: "all",
};
const isDesign = (v: unknown): v is Design =>
  v === "soft" || v === "studio" || v === "focus";
function isSuppliers(value: unknown): value is Supplier[] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(
      (s) =>
        s &&
        initialSuppliers.some((i) => i.id === s.id) &&
        typeof s.name === "string" &&
        s.policy &&
        Number.isInteger(s.policy.lead_time_days) &&
        s.policy.lead_time_days >= 1 &&
        Number.isInteger(s.policy.review_period_days) &&
        s.policy.review_period_days >= 0 &&
        s.policy.lead_time_days + s.policy.review_period_days <= 365 &&
        (typeof s.policy.assumption_note === "string" ||
          s.policy.assumption_note === null),
    )
  );
}
function summarizeQualityWarnings(warnings: DataQualityWarning[]) {
  return Array.from(warnings.reduce((groups, warning) => {
    const current = groups.get(warning.code) ?? { ...warning, count: 0 };
    current.count += 1;
    groups.set(warning.code, current);
    return groups;
  }, new Map<string, DataQualityWarning & { count: number }>()).values());
}

export default function App() {
  const backend = useBackend();
  const rows = backend.run ? runRecommendations(backend.run) : [];
  const orders = backend.run ? runOrders(backend.run) : [];
  const qualityWarnings = backend.run ? summarizeQualityWarnings(backend.run.data_quality) : [];
  const missingCurrentStock = qualityWarnings.some((warning) =>
    warning.code === "CURRENT_STOCK_MISSING_FOR_SKU" || warning.code === "NO_CALCULABLE_ITEMS",
  );
  const [page, setPage] = useState<Page>(readPage);
  const [design, setDesign] = useLocalState<Design>(
    "ekt.design.v1",
    "soft",
    isDesign,
  );
  const [dense, setDense] = useLocalState(
    "ekt.dense.v1",
    false,
    (v): v is boolean => typeof v === "boolean",
  );
  const [suppliers, setSuppliers, supplierStorageError] = useLocalState<
    Supplier[]
  >("ekt.demo.suppliers.v1", initialSuppliers, isSuppliers);
  const [filters, setFilters] = useState<RecommendationFilters>(emptyFilters);
  const [selected, setSelected] = useState<string[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Recommendation | null>(null);
  const [dialog, setDialog] = useState<
    "appearance" | "calculation" | "reset" | null
  >(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const update = () => setPage(readPage());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    document.title = `${navigation.find((n) => n.id === page)?.label} · EKT`;
  }, [page]);
  function navigate(next: Page) {
    location.hash = `/${next}`;
    setPage(next);
  }
  function openOrder() {
    if (!backend.run || !orders.length) {
      setToast("Сначала рассчитайте рекомендации с положительным заказом.");
      return;
    }
    setOrderId(orders[0].id);
    navigate("orders");
  }
  const action =
    page === "overview" ? (
      <Button variant="primary" onClick={() => navigate("recommendations")}>
        К закупкам
        <ArrowRight size={17} />
      </Button>
    ) : page === "recommendations" ? (
      <Button onClick={() => setDialog("calculation")}>
        <Info size={17} />
        Параметры расчёта
      </Button>
    ) : page === "orders" ? (
      <Button variant="primary" onClick={() => navigate("data")}>
        <Plus size={17} />
        Новый расчёт
      </Button>
    ) : page === "catalog" ? (
      <Button onClick={() => navigate("recommendations")}>
        К рекомендациям
        <ArrowRight size={17} />
      </Button>
    ) : null;

  return (
    <AppShell
      page={page}
      design={design}
      dense={dense}
      onNavigate={navigate}
      health={backend.health}
      dataOrigin={backend.run?.dataset_id === "synthetic-fixtures" ? "synthetic" : backend.run ? "partner" : null}
      action={action}
    >
      {supplierStorageError && (
        <Notice error>
          Браузер не разрешает сохранение. Изменения доступны только до закрытия
          страницы.
        </Notice>
      )}
      {backend.error && <Notice error>{backend.error}</Notice>}
      {backend.busy && <Notice>Идёт расчёт на сервере…</Notice>}
      {page === "overview" && (
        <Overview
          recommendations={rows}
          onNavigate={navigate}
          onDetail={setDetail}
        />
      )}
      {(page === "recommendations" || page === "catalog") && (
        <Recommendations
          rows={rows}
          filters={filters}
          onFilters={setFilters}
          selected={selected}
          onSelected={setSelected}
          onDetail={setDetail}
          onCreate={openOrder}
          serverRun
          blockedByMissingStock={missingCurrentStock}
          onLoadData={() => navigate("data")}
          catalog={page === "catalog"}
          onExport={(rows) =>
            downloadCsv(
              `ekt-${backend.run?.run_id ?? "recommendations"}.csv`,
              [["Код 1С", "Товар", "Поставщик", "Ед.", "Количество", "Остаток", "В пути", "Прогноз", "Обоснование"],
                ...rows.map((row) => [row.sku, row.name, row.supplier_name, row.unit, row.recommended_qty, row.available_stock, row.incoming_qty, row.forecast_qty, row.explanation])],
            )
          }
        />
      )}
      {page === "orders" && (
        <Orders
          orders={orders}
          selectedId={orderId}
          recommendations={rows}
          onSelect={setOrderId}
          onCreate={() => navigate("data")}
          onDetail={setDetail}
          onSave={async (_order, lineId, quantity, reason) => {
            await backend.adjust(lineId, quantity, reason);
            setToast("Количество сохранено на сервере.");
          }}
          onApprove={async () => {
            await backend.approve();
            setToast("Весь расчёт подтверждён менеджером.");
          }}
          onExport={async (_order, format) => { await backend.exportOrder(format); }}
        />
      )}
      {page === "data" && (
        <Data
          onDemo={async () => {
            await backend.calculateSynthetic();
            setFilters(emptyFilters);
            navigate("recommendations");
            setToast("Синтетические сценарии рассчитаны сервером.");
          }}
          onCalculate={async (previewId, label, options) => {
            await backend.importAndCalculate(previewId, label, options);
            setFilters(emptyFilters);
            navigate("recommendations");
            setToast("Набор сохранён; расчёт выполнен сервером.");
          }}
        />
      )}
      {page === "suppliers" && (
        <Suppliers
          suppliers={suppliers}
          recommendations={rows}
          onSave={(supplier) => {
            setSuppliers((current) =>
              current.map((s) => (s.id === supplier.id ? supplier : s)),
            );
            setToast(
              "Демонстрационные настройки сохранены в браузере. Рекомендации не пересчитаны.",
            );
          }}
          onCatalog={(id) => {
            setFilters({ ...emptyFilters, supplier_id: id });
            navigate("catalog");
          }}
        />
      )}
      {detail && (
        <RecommendationDrawer row={detail} onClose={() => setDetail(null)} />
      )}
      {dialog === "appearance" && (
        <Modal title="Настройки оформления" onClose={() => setDialog(null)}>
          <p className="ek-muted-note">
            Три направления в одной сине-жёлтой палитре.
          </p>
          <div className="ek-design-options">
            {(
              [
                [
                  "soft",
                  "01 · Мягкий",
                  "Карточки и скругления — близко к референсу.",
                ],
                [
                  "studio",
                  "02 · Студия",
                  "Синяя боковая навигация и спокойные поверхности.",
                ],
                [
                  "focus",
                  "03 · Фокус",
                  "Белый фон, тонкие линии, меньше визуального шума.",
                ],
              ] as const
            ).map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                aria-pressed={design === value}
                className={design === value ? "is-selected" : ""}
                onClick={() => setDesign(value)}
              >
                <strong>
                  {label}
                  {design === value && <Check size={17} />}
                </strong>
                <small>{description}</small>
              </button>
            ))}
          </div>
          <label className="ek-check-label">
            <input
              type="checkbox"
              checked={dense}
              onChange={(e) => setDense(e.target.checked)}
            />
            Компактные строки таблицы
          </label>
          <div className="ek-settings-footer">
            <Button variant="primary" onClick={() => setDialog(null)}>
              Готово
            </Button>
            <Button variant="link" onClick={() => setDialog("reset")}>
              <RotateCcw size={16} />
              Сбросить настройки
            </Button>
          </div>
        </Modal>
      )}
      {dialog === "calculation" && (
        <Modal
          title="Параметры расчёта"
          onClose={() => setDialog(null)}
        >
          <dl className="ek-facts">
            <div>
              <dt>Набор</dt>
              <dd>{backend.run?.dataset_id ?? "Расчёт ещё не выполнен"}</dd>
            </div>
            <div>
              <dt>Версия алгоритма</dt>
              <dd>{backend.run?.algorithm_version ?? "—"}</dd>
            </div>
            <div>
              <dt>Дата расчёта</dt>
              <dd>{backend.run?.calculation_date ?? "—"}</dd>
            </div>
            <div>
              <dt>Поставка / пересмотр</dt>
              <dd>{backend.run ? `${backend.run.parameters.default_lead_time_days} / ${backend.run.parameters.review_period_days} дней` : "—"}</dd>
            </div>
          </dl>
          <Notice>
            {backend.run?.dataset_id === "synthetic-fixtures"
              ? "Это синтетические сценарии, рассчитанные сервером."
              : "Результат получен от локального сервера; ошибки качества данных показаны над таблицей."}
          </Notice>
          <Button variant="primary" onClick={() => setDialog(null)}>
            Понятно
          </Button>
        </Modal>
      )}
      {dialog === "reset" && (
        <Modal title="Сбросить настройки интерфейса?" onClose={() => setDialog(null)}>
          <p className="ek-muted-note">
            Будут сброшены локальные настройки поставщиков. Серверный расчёт и
            загруженные данные останутся доступными.
          </p>
          <div className="ek-actions">
            <Button
              variant="primary"
              onClick={() => {
                setSuppliers(initialSuppliers);
                setOrderId(null);
                setDialog(null);
                setToast("Локальные настройки сброшены.");
              }}
            >
              Сбросить настройки
            </Button>
            <Button onClick={() => setDialog(null)}>Отмена</Button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="ek-toast" role="status">
          {toast}
        </div>
      )}
    </AppShell>
  );
}
