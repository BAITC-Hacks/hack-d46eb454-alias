"""FastAPI application implementing contracts/openapi.yaml."""

from __future__ import annotations

import csv
from datetime import date
from io import BytesIO, StringIO
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from openpyxl import Workbook
from pydantic import BaseModel, Field
import yaml

from .fixtures import fixture_inputs
from .replenishment import ALGORITHM_VERSION, calculate_item, group_by_supplier
from .storage import append_audit, commit_preview, get_dataset, get_run, now_iso, save_exclusions, save_run


app = FastAPI(title="HACKALEM AI Replenishment API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"], allow_methods=["*"], allow_headers=["*"])


def agreed_openapi() -> dict:
    if app.openapi_schema is None:
        contract = Path(__file__).resolve().parents[1] / "contracts" / "openapi.yaml"
        app.openapi_schema = yaml.safe_load(contract.read_text(encoding="utf-8"))
    return app.openapi_schema


app.openapi = agreed_openapi


class CategorySetting(BaseModel):
    category: str
    service_level_z: float = Field(ge=0)
    growth_override_percent: float = 0


class CalculateRequest(BaseModel):
    dataset_id: str
    calculation_date: date
    warehouse_scope: str
    review_period_days: int = Field(ge=1)
    default_lead_time_days: int = Field(ge=0)
    service_level_z: float = Field(ge=0)
    growth_override_percent: float = 0
    include_unapproved_stockout_estimates: bool = False
    category_settings: list[CategorySetting] = Field(default_factory=list)


class CommitRequest(BaseModel):
    preview_id: str
    label: str = "IEK local dataset"


class AdjustRequest(BaseModel):
    approved_quantity: float = Field(ge=0)
    reason: str = Field(min_length=1)
    changed_by: str = Field(min_length=1)


class ApproveRequest(BaseModel):
    approved_by: str = Field(min_length=1)
    comment: str | None = None


def _request_dict(request: CalculateRequest) -> dict:
    values = request.model_dump(mode="json")
    return values


def _run_response(request: CalculateRequest, items: list[dict], warnings: list[dict]) -> dict:
    return {
        "run_id": f"run_{uuid4().hex}", "dataset_id": request.dataset_id,
        "calculation_date": request.calculation_date.isoformat(), "algorithm_version": ALGORITHM_VERSION,
        "status": "draft",
        "parameters": {
            "review_period_days": request.review_period_days, "default_lead_time_days": request.default_lead_time_days,
            "service_level_z": request.service_level_z, "demand_window_days": 90, "trend_method": "rolling_window",
            "outlier_method": "MAD by operation quantity and customer_id when available",
            "seasonality_source": "Сезонность ИЭК.xlsx", "safety_stock_method": "z * sigma(demand over lead time)",
        },
        "totals": {
            "item_count": len(items), "recommended_item_count": sum(x["recommended_quantity"] > 0 for x in items),
            "total_recommended_quantity": round(sum(x["recommended_quantity"] for x in items), 6),
        },
        "suppliers": group_by_supplier(items), "data_quality": warnings,
    }


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}


@app.post("/api/recommendations/calculate")
def calculate_recommendations(request: CalculateRequest) -> dict:
    values = _request_dict(request)
    if request.dataset_id == "synthetic-fixtures":
        try:
            inputs = fixture_inputs(values)
            items = [calculate_item(source) for source in inputs]
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        warnings = [{"code": "SYNTHETIC_DATA", "severity": "info", "message": "Расчёт выполнен на синтетических сценариях; результаты не являются заказом по данным партнёра.", "sku": None}]
    else:
        try:
            dataset = get_dataset(request.dataset_id)
        except KeyError as error:
            raise HTTPException(status_code=404, detail="Dataset not found") from error
        from .importer import dataset_to_inputs
        inputs, warnings = dataset_to_inputs(dataset, values)
        items = []
        for source in inputs:
            try:
                items.append(calculate_item(source))
            except ValueError as error:
                warnings.append({"code": "RECOMMENDATION_BLOCKED", "severity": "error", "message": str(error), "sku": source.sku})
    run = _run_response(request, items, warnings)
    for item in items:
        save_exclusions(run["run_id"], item["item_id"], item.pop("excluded_operations", []))
    save_run(run)
    return run


@app.get("/api/recommendations/runs/{run_id}")
def read_run(run_id: str) -> dict:
    try:
        return get_run(run_id)[0]
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Run not found") from error


@app.patch("/api/recommendations/runs/{run_id}/items/{item_id}/adjust")
def adjust_item(run_id: str, item_id: str, request: AdjustRequest) -> dict:
    try:
        run, revision, _, _ = get_run(run_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Run not found") from error
    item = next((item for group in run["suppliers"] for item in group["items"] if item["item_id"] == item_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    old_quantity = item["recommended_quantity"]
    item["approved_quantity"] = request.approved_quantity
    item["recommended_quantity"] = request.approved_quantity
    item["manager_adjustment_reason"] = request.reason
    item["flags"] = sorted(set(item["flags"] + ["manager_adjusted"]))
    if run["status"] == "approved":
        run["status"] = "stale_after_edit"
    run["totals"]["recommended_item_count"] = sum(x["recommended_quantity"] > 0 for group in run["suppliers"] for x in group["items"])
    run["totals"]["total_recommended_quantity"] = round(sum(x["recommended_quantity"] for group in run["suppliers"] for x in group["items"]), 6)
    save_run(run, revision + 1)
    append_audit(run_id, revision + 1, "adjust", request.changed_by, request.reason, item_id, old_quantity, request.approved_quantity)
    return item


@app.post("/api/orders/{run_id}/approve")
def approve_order(run_id: str, request: ApproveRequest) -> dict:
    try:
        run, revision, _, _ = get_run(run_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Run not found") from error
    if any(warning["severity"] == "error" for warning in run["data_quality"]):
        raise HTTPException(status_code=409, detail="Data quality errors block approval")
    run["status"] = "approved"
    approved_at = now_iso()
    save_run(run, revision + 1, request.approved_by, approved_at)
    append_audit(run_id, revision + 1, "approve", request.approved_by, request.comment)
    return {"run_id": run_id, "status": "approved", "approved_by": request.approved_by, "approved_at": approved_at}


@app.get("/api/orders/{run_id}/export")
def export_order(run_id: str, format: str) -> Response:
    if format not in {"csv", "xlsx"}:
        raise HTTPException(status_code=422, detail="format must be csv or xlsx")
    try:
        run, _, _, _ = get_run(run_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Run not found") from error
    if run["status"] != "approved":
        raise HTTPException(status_code=409, detail="Order must be approved before export")
    rows = [
        ["Поставщик", "Код 1С", "Артикул поставщика", "Наименование", "Склад", "Ед.", "Количество", "Обоснование"]
    ]
    for group in run["suppliers"]:
        for item in group["items"]:
            if item["recommended_quantity"] > 0:
                rows.append([group["supplier_name"], item["sku"], item.get("supplier_article") or "", item["item_name"], item["warehouse"], item["unit"], item["recommended_quantity"], item["explanation"]])
    if format == "csv":
        output = StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerows(rows)
        return Response(content="\ufeff" + output.getvalue(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="order-{run_id}.csv"'})
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Заказ"
    for row in rows:
        sheet.append(row)
    output = BytesIO()
    workbook.save(output)
    return Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="order-{run_id}.xlsx"'})


@app.post("/api/import/preview")
async def preview_import(files: list[UploadFile] = File(...), warehouse_scope: str = Form("Алматы")) -> dict:
    from .importer import preview_files
    try:
        return await preview_files(files, warehouse_scope)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/api/import/commit", status_code=201)
def commit_import(request: CommitRequest) -> dict:
    try:
        return commit_preview(request.preview_id, request.label)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Preview not found") from error
