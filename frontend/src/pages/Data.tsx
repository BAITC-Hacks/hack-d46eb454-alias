import { useRef, useState } from "react";
import {
  FileSpreadsheet,
  FolderOpen,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, Notice } from "../components/ui";
import { api } from "../api/client";
import type { CalculateRecommendationsRequest, ImportPreviewResponse } from "../api/schema";

const qualityLabels: Record<string, string> = {
  INVALID_MOQ: "Некорректные минимальные партии",
  CURRENT_STOCK_MISSING: "Нет актуальных остатков",
  STOCKOUT_INTERVALS_MISSING: "Нет подтверждённых периодов дефицита",
  CATEGORIES_MISSING: "Нет справочника категорий",
  LEAD_TIME_DIRECTORY_MISSING: "Нет справочника сроков поставки",
};

export function Data({ onDemo, onCalculate }: {
  onDemo: () => Promise<void>;
  onCalculate: (previewId: string, label: string, options: Omit<CalculateRecommendationsRequest, "dataset_id">) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [warehouse, setWarehouse] = useState("Алматы");
  const [calculationDate, setCalculationDate] = useState(new Date().toISOString().slice(0, 10));
  const [reviewDays, setReviewDays] = useState(7);
  const [leadDays, setLeadDays] = useState(21);
  const [serviceLevel, setServiceLevel] = useState(1.65);
  const [growth, setGrowth] = useState(0);
  const warningGroups = preview
    ? Array.from(preview.warnings.reduce((groups, warning) => {
      const current = groups.get(warning.code) ?? { ...warning, count: 0 };
      current.count += 1;
      groups.set(warning.code, current);
      return groups;
    }, new Map<string, ImportPreviewResponse["warnings"][number] & { count: number }>()).values())
    : [];
  function choose(incoming: File[]) {
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
    if (!problem) { setFiles(next); setPreview(null); }
  }
  async function inspectFiles() {
    if (!files.length) { setError("Выберите XLSX или ZIP."); return; }
    setBusy(true); setError("");
    try { setPreview(await api.previewImport(files, warehouse)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось проверить файлы."); }
    finally { setBusy(false); }
  }
  async function commitAndCalculate() {
    if (!preview) return;
    setBusy(true); setError("");
    try {
      await onCalculate(preview.preview_id, files.map((file) => file.name).join(", "), {
        calculation_date: calculationDate, warehouse_scope: warehouse,
        review_period_days: reviewDays, default_lead_time_days: leadDays,
        service_level_z: serviceLevel, growth_override_percent: growth,
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось рассчитать рекомендации."); }
    finally { setBusy(false); }
  }
  return (
    <div className="ek-importflow">
      <section className="ek-panel">
        <div className="ek-panelhead">
          <h2>Новый расчёт</h2>
          <span className="ek-tag">Excel / ZIP</span>
        </div>
        <ol className="ek-import-steps" aria-label="Этапы расчёта">
          <li className="is-active">1. Загрузите архив</li>
          <li>2. Проверьте данные</li>
          <li>3. Получите рекомендации</li>
        </ol>
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
          <h3>Загрузите IEK.zip</h3>
          <p>Или выберите отдельные Excel-выгрузки продаж, остатков и поставок.</p>
          <Button variant="primary" onClick={() => input.current?.click()}>
            <FolderOpen size={17} />
            Выбрать файлы
          </Button>
          <input
            ref={input}
            type="file"
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
                onClick={() => { setFiles(files.filter((_, i) => i !== index)); setPreview(null); }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
        <label className="ek-field">Склад
          <input className="ek-input" value={warehouse} onChange={(event) => { setWarehouse(event.target.value); setPreview(null); }} />
        </label>
        <Button className="ek-import-preview" variant="primary" disabled={busy || !files.length} onClick={() => void inspectFiles()}>
          {busy ? "Проверяем…" : "Проверить файлы"}
        </Button>
        {preview && <div className="ek-quality" aria-label="Результат проверки импорта">
          <h3>Данные проверены</h3>
          <p>Файлов: {preview.files.length} · строк распознано: {Object.values(preview.row_counts).reduce((sum, value) => sum + value, 0)}</p>
          {warningGroups.slice(0, 5).map((warning) =>
            <Notice key={warning.code} error={warning.severity === "error"}>
              {qualityLabels[warning.code] ?? "Требуется проверка данных"}: {warning.count}.
            </Notice>
          )}
          {preview.unsupported_fields.length > 0 && <p>Недостающие поля: {preview.unsupported_fields.join(", ")}</p>}
        </div>}
        {preview && <details className="ek-advanced">
          <summary>Настройки расчёта</summary>
          <div className="ek-filterrow">
            <label className="ek-field">Дата расчёта<input className="ek-input" type="date" value={calculationDate} onChange={(event) => setCalculationDate(event.target.value)} /></label>
            <label className="ek-field">Пересмотр, дней<input className="ek-input" type="number" min="1" value={reviewDays} onChange={(event) => setReviewDays(Number(event.target.value))} /></label>
            <label className="ek-field">Поставка, дней<input className="ek-input" type="number" min="0" value={leadDays} onChange={(event) => setLeadDays(Number(event.target.value))} /></label>
            <label className="ek-field">Коэффициент z<input className="ek-input" type="number" min="0" step="0.01" value={serviceLevel} onChange={(event) => setServiceLevel(Number(event.target.value))} /></label>
            <label className="ek-field">Плановый прирост, %<input className="ek-input" type="number" step="0.1" value={growth} onChange={(event) => setGrowth(Number(event.target.value))} /></label>
          </div>
        </details>}
        {preview && <Button className="ek-import-calculate" variant="primary" disabled={busy || !warehouse.trim() || reviewDays < 1 || leadDays < 0 || serviceLevel < 0} onClick={() => void commitAndCalculate()}>
          Рассчитать рекомендации
        </Button>}
        <Button className="ek-demo-link" variant="link" disabled={busy} onClick={() => { setBusy(true); void onDemo().catch((cause) => setError(cause instanceof Error ? cause.message : "Ошибка расчёта.")).finally(() => setBusy(false)); }}>
          Открыть демонстрационный пример
        </Button>
      </section>
    </div>
  );
}
