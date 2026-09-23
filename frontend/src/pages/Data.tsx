import { useRef, useState } from "react";
import {
  ArrowUpRight,
  FileSpreadsheet,
  FlaskConical,
  FolderOpen,
  Table2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, Notice } from "../components/ui";
import { api } from "../api/client";
import type { CalculateRecommendationsRequest, ImportPreviewResponse } from "../api/schema";

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
          <h3>Проверено файлов: {preview.files.length}</h3>
          <p>Распознано строк: {Object.entries(preview.row_counts).map(([kind, count]) => `${kind}: ${count}`).join(" · ")}</p>
          <p>Проблем и замечаний: {preview.warnings.length}</p>
          {preview.warnings.slice(0, 10).map((warning, index) =>
            <Notice key={`${warning.code}-${index}`} error={warning.severity === "error"}>{warning.message}</Notice>
          )}
          {preview.warnings.length > 10 && <p>Показаны первые 10 замечаний. Остальные сохранены в наборе.</p>}
          {preview.unsupported_fields.length > 0 && <p>Недостающие поля: {preview.unsupported_fields.join(", ")}</p>}
        </div>}
        {preview && <div className="ek-filterrow">
          <label className="ek-field">Дата расчёта<input className="ek-input" type="date" value={calculationDate} onChange={(event) => setCalculationDate(event.target.value)} /></label>
          <label className="ek-field">Пересмотр, дней<input className="ek-input" type="number" min="1" value={reviewDays} onChange={(event) => setReviewDays(Number(event.target.value))} /></label>
          <label className="ek-field">Поставка, дней<input className="ek-input" type="number" min="0" value={leadDays} onChange={(event) => setLeadDays(Number(event.target.value))} /></label>
          <label className="ek-field">Коэффициент z<input className="ek-input" type="number" min="0" step="0.01" value={serviceLevel} onChange={(event) => setServiceLevel(Number(event.target.value))} /></label>
          <label className="ek-field">Плановый прирост, %<input className="ek-input" type="number" step="0.1" value={growth} onChange={(event) => setGrowth(Number(event.target.value))} /></label>
        </div>}
        {preview && <Button variant="primary" disabled={busy || !warehouse.trim() || reviewDays < 1 || leadDays < 0 || serviceLevel < 0} onClick={() => void commitAndCalculate()}>
          Сохранить набор и рассчитать
        </Button>}
      </section>
      <div>
        <section className="ek-panel">
          <div className="ek-panelhead">
            <h2>Начать с примера</h2>
            <FlaskConical size={19} />
          </div>
          <div className="ek-demochoice">
            <div>
              <h3>Синтетический расчёт сервера</h3>
              <p className="ek-small">
                6 сценариев · 3 поставщика
                <br />
                Сезонность, дефицит и выбросы
              </p>
            </div>
            <button
              type="button"
              className="ek-circle"
              aria-label="Открыть синтетический пример"
              onClick={() => { setBusy(true); void onDemo().catch((cause) => setError(cause instanceof Error ? cause.message : "Ошибка расчёта.")).finally(() => setBusy(false)); }}
            >
              <ArrowUpRight size={19} />
            </button>
          </div>
          <div className="ek-demochoice">
            <div>
              <h3>Данные партнёра</h3>
              <p className="ek-small">
                IEK · загрузка локального архива
                <br />
                Проверка качества перед расчётом
              </p>
            </div>
            <span className="ek-tag ek-quiet">Локально</span>
          </div>
          <Notice>
            Демо не подменяет реальные таблицы. Для каждого результата должно
            быть видно происхождение данных.
          </Notice>
        </section>
        <section className="ek-panel ek-section-gap">
          <div className="ek-panelhead">
            <h2>Стандартный шаблон</h2>
            <Table2 size={19} />
          </div>
          <p className="ek-muted-note">
            Продажи, товары, поставщики, склады, остатки, поставки, stockout,
            ограничения партий и настройки категорий.
          </p>
          <p className="ek-small">
            Для реального заказа нужен текущий остаток с датой: Код 1С,
            Остаток, Дата, Склад. Архив IEK.zip сам по себе его не содержит.
          </p>
        </section>
      </div>
    </div>
  );
}
