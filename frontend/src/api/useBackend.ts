import { useEffect, useRef, useState } from "react";
import { api } from "./client";
import type { CalculateRecommendationsRequest, RecommendationRun } from "./schema";

const RUN_KEY = "ekt.active_run_id";
const syntheticRequest: CalculateRecommendationsRequest = {
  dataset_id: "synthetic-fixtures",
  calculation_date: "2026-09-23",
  warehouse_scope: "Алматы",
  review_period_days: 7,
  default_lead_time_days: 21,
  service_level_z: 1.65,
};

export function useBackend() {
  const [run, setRun] = useState<RecommendationRun | null>(null);
  const [health, setHealth] = useState<{ status: "ok"; version: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);

  useEffect(() => {
    let active = true;
    api.health().then((value) => { if (active) setHealth(value); }).catch(() => {
      if (active) setError("Сервер недоступен. Запустите FastAPI на порту 8000.");
    });
    const savedRun = sessionStorage.getItem(RUN_KEY);
    if (savedRun) {
      api.getRun(savedRun).then((value) => { if (active) setRun(value); }).catch(() => {
        sessionStorage.removeItem(RUN_KEY);
      });
    }
    return () => { active = false; };
  }, []);

  async function loadRun(runId: string) {
    const version = ++sequence.current;
    const next = await api.getRun(runId);
    if (version === sequence.current) {
      setRun(next);
      sessionStorage.setItem(RUN_KEY, next.run_id);
    }
    return next;
  }

  async function calculate(body: CalculateRecommendationsRequest) {
    const version = ++sequence.current;
    setBusy(true);
    setError("");
    try {
      const next = await api.calculate(body);
      if (version === sequence.current) {
        setRun(next);
        sessionStorage.setItem(RUN_KEY, next.run_id);
      }
      return next;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Не удалось рассчитать рекомендации.";
      if (version === sequence.current) setError(message);
      throw cause;
    } finally {
      if (version === sequence.current) setBusy(false);
    }
  }

  async function importAndCalculate(previewId: string, label: string, options: Omit<CalculateRecommendationsRequest, "dataset_id">) {
    setBusy(true);
    try {
      const dataset = await api.commitImport(previewId, label);
      return await calculate({ ...options, dataset_id: dataset.dataset_id });
    } finally {
      setBusy(false);
    }
  }

  async function adjust(itemId: string, quantity: number, reason: string) {
    if (!run) throw new Error("Сначала выполните расчёт.");
    await api.adjustItem(run.run_id, itemId, quantity, reason, "purchase_manager");
    return loadRun(run.run_id);
  }

  async function approve() {
    if (!run) throw new Error("Сначала выполните расчёт.");
    await api.approveOrder(run.run_id, "purchase_manager");
    return loadRun(run.run_id);
  }

  async function exportOrder(format: "csv" | "xlsx") {
    if (!run) throw new Error("Сначала выполните расчёт.");
    const blob = await api.exportOrder(run.run_id, format);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ekt-${run.run_id}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { run, health, busy, error, setError, calculate, calculateSynthetic: () => calculate(syntheticRequest),
    importAndCalculate, adjust, approve, exportOrder, loadRun };
}
