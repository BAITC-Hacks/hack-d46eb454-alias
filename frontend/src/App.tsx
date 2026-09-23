import { useEffect, useState } from "react";
import { Info, Plus } from "lucide-react";
import { AppShell, navigation } from "./components/AppShell";
import { Button, Notice } from "./components/ui";
import { Modal } from "./components/Modal";
import { RecommendationDrawer } from "./components/RecommendationDrawer";
import { Recommendations } from "./pages/Recommendations";
import { Orders } from "./pages/Orders";
import { Data } from "./pages/Data";
import { runOrders, runRecommendations } from "./api/mapper";
import { useBackend } from "./api/useBackend";
import type {
  Page,
  Recommendation,
  RecommendationFilters,
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
export default function App() {
  const backend = useBackend();
  const rows = backend.run ? runRecommendations(backend.run) : [];
  const orders = backend.run ? runOrders(backend.run) : [];
  const [page, setPage] = useState<Page>(readPage);
  const [filters, setFilters] = useState<RecommendationFilters>(emptyFilters);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Recommendation | null>(null);
  const [dialog, setDialog] = useState<"calculation" | null>(null);
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
    page === "recommendations" ? (
      <Button onClick={() => setDialog("calculation")}>
        <Info size={17} />
        Параметры расчёта
      </Button>
    ) : page === "orders" ? (
      <Button variant="primary" onClick={() => navigate("data")}>
        <Plus size={17} />
        Новый расчёт
      </Button>
    ) : null;

  return (
    <AppShell
      page={page}
      onNavigate={navigate}
      health={backend.health}
      dataOrigin={backend.run?.dataset_id === "synthetic-fixtures" ? "synthetic" : backend.run ? "partner" : null}
      action={action}
    >
      {page === "recommendations" && (
        <Recommendations
          rows={rows}
          filters={filters}
          onFilters={setFilters}
          onDetail={setDetail}
          onCreate={openOrder}
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
      <div hidden={page !== "data"}>
        <Data
          onRecommendations={() => navigate("recommendations")}
          onCalculate={async (previewId, label, options) => {
            const result = await backend.importAndCalculate(previewId, label, options);
            setFilters(emptyFilters);
            return result;
          }}
        />
      </div>
      {detail && (
        <RecommendationDrawer row={detail} onClose={() => setDetail(null)} />
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
              : "Результат рассчитан по загруженным данным. Отчёт проверки доступен на странице «Данные» до обновления страницы."}
          </Notice>
          <Button variant="primary" onClick={() => setDialog(null)}>
            Понятно
          </Button>
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
