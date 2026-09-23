from backend.importer import _code, _date, _month, _same_warehouse, dataset_to_inputs
from backend import storage
from backend.replenishment import calculate_item


def test_1c_code_and_date_are_not_normalized_away():
    assert _code("0012300_") == "0012300_"
    assert _date("22.09.2026 16:15:38").isoformat() == "2026-09-22"
    assert _month("сент. 2026") == "2026-09"


def test_warehouse_match_ignores_case_and_outer_whitespace():
    assert _same_warehouse("Алматы", "алматы")
    assert _same_warehouse("  АЛМАТЫ  ", "Алматы")
    assert not _same_warehouse("Астана", "Алматы")


def test_dataset_requires_current_stock():
    dataset = {
        "data": {
            "sales_detail": [{"sku": "001_", "date": "2026-09-22", "quantity": 10, "name": "Тест", "unit": "шт", "customer_id": None,
                              "source": {"file": "synthetic.xlsx", "sheet": "Продажи", "row": 2}}],
            "monthly_sales": [], "monthly_stock": [], "inbound": [], "moq": [], "seasonality": {}, "current_stock": [], "categories": [], "stockouts": [],
        },
        "issues": [],
    }
    request = {"calculation_date": "2026-09-23", "warehouse_scope": "Алматы", "review_period_days": 7,
               "default_lead_time_days": 21, "service_level_z": 1.65}
    inputs, warnings = dataset_to_inputs(dataset, request)
    assert not inputs
    assert any(w["code"] == "CURRENT_STOCK_MISSING_FOR_SKU" for w in warnings)
    dataset["data"]["current_stock"] = [{"sku": "001_", "quantity": 5, "date": "2026-09-22"}]
    inputs, warnings = dataset_to_inputs(dataset, request)
    assert len(inputs) == 1
    assert inputs[0].sku == "001_"
    assert inputs[0].available_stock == 5
    baseline = calculate_item(inputs[0])
    dataset["data"]["categories"] = [{"sku": "001_", "category": "Критичный"}]
    request["category_settings"] = [{"category": "Критичный", "service_level_z": 2.5, "growth_override_percent": 10}]
    categorized, _ = dataset_to_inputs(dataset, request)
    assert categorized[0].category == "Критичный"
    assert categorized[0].service_level_z == 2.5
    assert categorized[0].growth_override_percent == 10
    changed = calculate_item(categorized[0])
    assert changed["components"]["safety_stock"] > baseline["components"]["safety_stock"]
    assert changed["components"]["forecast_over_horizon"] > baseline["components"]["forecast_over_horizon"]


def test_preview_commit_is_idempotent(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "DATA_DIR", tmp_path)
    preview_id = storage.save_preview({"data": {"sales_detail": []}, "issues": []})
    first = storage.commit_preview(preview_id, "synthetic")
    second = storage.commit_preview(preview_id, "different label")
    assert second == first
