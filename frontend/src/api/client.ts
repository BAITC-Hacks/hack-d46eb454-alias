import type {
  CalculateRecommendationsRequest,
  DatasetSnapshot,
  ImportPreviewResponse,
  OrderApproval,
  RecommendationItem,
  RecommendationRun,
} from "./schema";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function fail(response: Response): Promise<never> {
  const data = await response.json().catch(() => null);
  const detail = data?.detail;
  const message = typeof detail === "string"
    ? detail
    : Array.isArray(detail)
      ? detail.map((entry) => entry.msg).join("; ")
      : "Не удалось выполнить запрос к серверу.";
  throw new ApiError(response.status, "HTTP_ERROR", message);
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, { ...init, headers });
  if (!response.ok) return fail(response);
  const data = await response.json().catch(() => null);
  if (data === null) throw new ApiError(response.status, "INVALID_RESPONSE", "Сервер вернул неожиданный ответ.");
  return data as T;
}

const id = encodeURIComponent;
export const api = {
  health: () => request<{ status: "ok"; version: string }>("/health"),
  previewImport: (files: File[], warehouseScope: string) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    form.append("warehouse_scope", warehouseScope);
    return request<ImportPreviewResponse>("/import/preview", { method: "POST", body: form });
  },
  commitImport: (previewId: string, label: string) =>
    request<DatasetSnapshot>("/import/commit", {
      method: "POST", body: JSON.stringify({ preview_id: previewId, label }),
    }),
  calculate: (body: CalculateRecommendationsRequest) =>
    request<RecommendationRun>("/recommendations/calculate", { method: "POST", body: JSON.stringify(body) }),
  getRun: (runId: string, signal?: AbortSignal) =>
    request<RecommendationRun>(`/recommendations/runs/${id(runId)}`, { signal }),
  adjustItem: (runId: string, itemId: string, quantity: number, reason: string, changedBy: string) =>
    request<RecommendationItem>(`/recommendations/runs/${id(runId)}/items/${id(itemId)}/adjust`, {
      method: "PATCH", body: JSON.stringify({ approved_quantity: quantity, reason, changed_by: changedBy }),
    }),
  approveOrder: (runId: string, approvedBy: string) =>
    request<OrderApproval>(`/orders/${id(runId)}/approve`, {
      method: "POST", body: JSON.stringify({ approved_by: approvedBy }),
    }),
  exportOrder: async (runId: string, format: "csv" | "xlsx") => {
    const response = await fetch(`/api/orders/${id(runId)}/export?format=${format}`);
    if (!response.ok) return fail(response);
    return response.blob();
  },
};
