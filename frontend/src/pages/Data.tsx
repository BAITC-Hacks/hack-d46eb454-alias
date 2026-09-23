import { useRef, useState } from "react";
import {
  FileSpreadsheet,
  FolderOpen,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, Notice } from "../components/ui";
import { api } from "../api/client";
import type { CalculateRecommendationsRequest, ImportPreviewResponse, RecommendationRun } from "../api/schema";

const rowCountLabels: Record<string, string> = {
  sales_detail: "продажи",
  monthly_sales: "месячные продажи",
  monthly_stock: "месячные остатки",
  inbound: "поставки в пути",
  moq: "условия MOQ",
  seasonality: "коэффициенты сезонности",
  current_stock: "актуальные остатки",
  categories: "категории",
  stockouts: "интервалы отсутствия",
};

const missingFieldLabels: Record<string, string> = {
  current_available_stock: "Фактические остатки с датой и складом — нужны для подтверждённого заказа; прогноз доступен без них",
  confirmed_stockout_intervals: "Подтверждённые интервалы отсутствия — компенсация stockout без них не применяется",
  category_mapping: "Справочник категорий — без него используются общие настройки",
};

export function Data({ onCalculate, onRecommendations }: {
  onCalculate: (previewId: string, label: string, options: Omit<CalculateRecommendationsRequest, "dataset_id">) => Promise<RecommendationRun>;
  onRecommendations: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [report, setReport] = useState<RecommendationRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [warehouse, setWarehouse] = useState("Алматы");
  const [calculationDate, setCalculationDate] = useState(new Date().toISOString().slice(0, 10));
  const [reviewDays, setReviewDays] = useState(7);
  const [leadDays, setLeadDays] = useState(21);
  const [serviceLevel, setServiceLevel] = useState(1.65);
  const [growth, setGrowth] = useState(0);
  const [estimateStock, setEstimateStock] = useState(false);
  function choose(incoming: File[]) {
    if (busy) return;
    const next = [
      ...files,
      ...incoming.filter(
        (file) =>
          !files.some(
            (f) =>
              f.name === file.name &&
              f.size === file.size &&
              f.lastModified === file.lastModified,
          ),
      ),
    ];
    const problem =
      next.length > 12
        ? "Не больше 12 файлов за один импорт."
        : next.some((f) => !/\.(xlsx|zip)$/i.test(f.name))
          ? "Поддерживаются XLSX и ZIP с книгами Excel."
          : next.some((f) => f.size > 25 * 1024 * 1024)
            ? "Один файл не должен превышать 25 МиБ."
            : next.reduce((sum, f) => sum + f.size, 0) > 64 * 1024 * 1024
              ? "Общий размер не должен превышать 64 МиБ."
              : next.some((f) => !f.size)
                ? "Пустой файл нельзя импортировать."
                : "";
    setError(problem);
    if (!problem) { setFiles(next); setPreview(null); setReport(null); }
  }
  async function inspectFiles() {
    if (!files.length) { setError("Выберите XLSX или ZIP."); return; }
    setBusy(true); setError(""); setReport(null);
    try { setPreview(await api.previewImport(files, warehouse)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось проверить файлы."); }
    finally { setBusy(false); }
  }
  async function commitAndCalculate() {
    if (!preview) return;
    setBusy(true); setError(""); setReport(null);
    try {
      setReport(await onCalculate(preview.preview_id, files.map((file) => file.name).join(", "), {
        calculation_date: calculationDate, warehouse_scope: warehouse,
        review_period_days: reviewDays, default_lead_time_days: leadDays,
        service_level_z: serviceLevel, growth_override_percent: growth,
        stock_mode: estimateStock ? "monthly_estimate" : "actual_only",
      }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось рассчитать рекомендации."); }
    finally { setBusy(false); }
  }
  return (
    <div className="ek-importgrid">
      <section className="ek-panel">
        <div className="ek-panelhead">
          <h2>Загрузить свои данные</h2>
          <span className="ek-tag">Excel / ZIP</span>
        </div>
        <div
          className={`ek-drop ${dragging ? "is-dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(Array.from(e.dataTransfer.files));
          }}
        >
          <span className="ek-drop-icon">
            <Upload size={24} />
          </span>
          <h3>Добавьте файлы выгрузки</h3>
          <p>Перетащите сюда таблицы продаж, остатков и поставок.</p>
          <Button variant="primary" disabled={busy} onClick={() => input.current?.click()}>
            <FolderOpen size={17} />
            Выбрать файлы
          </Button>
          <input
            ref={input}
            type="file"
            disabled={busy}
            hidden
            multiple
            accept=".xlsx,.zip"
            onChange={(e) => {
              choose(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
          <span className="ek-small">
            До 12 файлов · 25 МиБ на файл · 64 МиБ всего
          </span>
        </div>
        {error && <Notice error>{error}</Notice>}
        <div className="ek-filelist">
          {files.map((file, index) => (
            <div
              className="ek-file"
              key={`${file.name}-${file.size}-${file.lastModified}`}
            >
              <span className="ek-file-icon">
                <FileSpreadsheet size={19} />
              </span>
              <div className="ek-file-name">
                <h3>{file.name}</h3>
                <span className="ek-small">
                  {(file.size / 1024).toFixed(1)} КБ · выбран, не обработан
                </span>
              </div>
              <button
                type="button"
                className="ek-iconbutton"
                aria-label={`Убрать ${file.name}`}
                disabled={busy}
                onClick={() => { setFiles(files.filter((_, i) => i !== index)); setPreview(null); setReport(null); }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
        <label className="ek-field">Склад
          <input className="ek-input" disabled={busy} value={warehouse} onChange={(event) => { setWarehouse(event.target.value); setPreview(null); setReport(null); }} />
        </label>
        <Button className="ek-import-preview" variant="primary" disabled={busy || !files.length} onClick={() => void inspectFiles()}>
          {busy ? "Проверяем…" : "Проверить файлы"}
        </Button>
        {preview && <div className="ek-quality" aria-label="Результат проверки импорта">
          <h3>Проверено файлов: {preview.files.length}</h3>
          <p>
            Распознано: {Object.entries(preview.row_counts)
              .filter(([kind]) => kind in rowCountLabels)
              .map(([kind, count]) => `${rowCountLabels[kind]}: ${count}`)
              .join(" · ")}
          </p>
          <p>Источники объединены по коду товара. Отчёт о качестве появится после расчёта.</p>
        </div>}
        {report && <section className="ek-quality" aria-label="Отчёт после расчёта">
          <h3>Результат расчёта</h3>
          <p>Рассчитано позиций: {report.totals.item_count}</p>
          <p>Прогноз спроса доступен для рассчитанных позиций. Количество заказа показывается только при наличии фактического остатка или выбранной оценки.</p>
          {Array.from(new Map([...(preview?.warnings ?? []), ...report.data_quality].map(w => [`${w.code}:${w.sku ?? ""}:${w.message}`, w])).values()).map((warning, index) =>
            <Notice key={`${warning.code}-${index}`} error={warning.severity === "error"}>{warning.sku ? `${warning.sku}: ` : ""}{warning.message}</Notice>
          )}
          {!!preview?.unsupported_fields.length && (
            <div>
              <h4>Для полного расчёта не хватает</h4>
              <ul>
                {preview.unsupported_fields.map((field) => (
                  <li key={field}>{missingFieldLabels[field] ?? field}</li>
                ))}
              </ul>
            </div>
          )}
          {report.totals.item_count > 0 && <Button variant="primary" onClick={onRecommendations}>Посмотреть рекомендации</Button>}
        </section>}
        {preview && <div className="ek-filterrow">
          <label className="ek-field">Дата расчёта<input className="ek-input" type="date" value={calculationDate} onChange={(event) => setCalculationDate(event.target.value)} /></label>
          <label className="ek-field">Пересмотр, дней<input className="ek-input" type="number" min="1" value={reviewDays} onChange={(event) => setReviewDays(Number(event.target.value))} /></label>
          <label className="ek-field">Поставка, дней<input className="ek-input" type="number" min="0" value={leadDays} onChange={(event) => setLeadDays(Number(event.target.value))} /></label>
          <label className="ek-field">Коэффициент z<input className="ek-input" type="number" min="0" step="0.01" value={serviceLevel} onChange={(event) => setServiceLevel(Number(event.target.value))} /></label>
          <label className="ek-field">Плановый прирост, %<input className="ek-input" type="number" step="0.1" value={growth} onChange={(event) => setGrowth(Number(event.target.value))} /></label>
        </div>}
        {preview && <label className="ek-field">
          <span><input type="checkbox" checked={estimateStock} disabled={busy} onChange={event => { setEstimateStock(event.target.checked); setReport(null); }} /> Предварительный план по оценке месячного остатка</span>
          <span className="ek-small">Оценка = max(0, остаток на начало текущего месяца − продажи с начала месяца). Выбирая режим, считаю месячный источник относящимся к указанному складу; неучтённые приходы, возвраты и перемещения не учитываются. Это не фактический остаток и не подтверждённый заказ. Без этой опции рассчитывается прогноз спроса.</span>
        </label>}
        {preview && <Button variant="primary" disabled={busy || !warehouse.trim() || reviewDays < 1 || leadDays < 0 || serviceLevel < 0} onClick={() => void commitAndCalculate()}>
          Сохранить набор и рассчитать
        </Button>}
      </section>
      <div>
        <section className="ek-panel ek-section-gap">
          <div className="ek-panelhead">
            <h2>Поддерживаемые таблицы</h2>
            <Table2 size={19} />
          </div>
          <p className="ek-muted-note">
            Продажи, остатки, поставки, MOQ, категории и интервалы отсутствия
            можно загружать отдельными файлами, листами или общей таблицей.
            Связь — по коду товара; у каждого источника свой набор столбцов.
          </p>
          <p className="ek-small">
            Для реального заказа нужен текущий остаток с датой: Код 1С,
            Остаток, Дата, Склад. В общей таблице продаж указывайте отдельную
            «Дату остатка». Неизвестные структуры и противоречащие значения
            отмечаются в отчёте, а не подставляются автоматически.
          </p>
        </section>
      </div>
    </div>
  );
}
