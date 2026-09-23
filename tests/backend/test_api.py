import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import app


FIXTURES = json.loads((Path(__file__).parents[1] / "fixtures" / "replenishment_scenarios.json").read_text(encoding="utf-8"))
REQUEST = {
    "dataset_id": "synthetic-fixtures", "calculation_date": FIXTURES["calculation_date"],
    "warehouse_scope": "Алматы", "review_period_days": 7,
    "default_lead_time_days": 21, "service_level_z": 1.65,
}


def test_calculate_endpoint_returns_six_contract_items():
    client = TestClient(app)
    response = client.post("/api/recommendations/calculate", json=REQUEST)
    assert response.status_code == 200, response.text
    run = response.json()
    assert run["dataset_id"] == "synthetic-fixtures"
    assert run["status"] == "draft"
    assert run["totals"]["item_count"] == 6
    assert {group["supplier_id"] for group in run["suppliers"]} == {"supplier_a", "supplier_b", "supplier_c"}
    for group in run["suppliers"]:
        for item in group["items"]:
            assert item["explanation"]
            assert "excluded_operations" not in item
    assert client.get(f"/api/recommendations/runs/{run['run_id']}").json() == run


def test_adjust_approve_export_and_stale_version():
    client = TestClient(app)
    run = client.post("/api/recommendations/calculate", json=REQUEST).json()
    run_id = run["run_id"]
    item_id = run["suppliers"][0]["items"][0]["item_id"]
    assert client.get(f"/api/orders/{run_id}/export?format=csv").status_code == 409
    approval = client.post(f"/api/orders/{run_id}/approve", json={"approved_by": "manager"})
    assert approval.status_code == 200
    export = client.get(f"/api/orders/{run_id}/export?format=csv")
    assert export.status_code == 200
    assert export.content.startswith("\ufeff".encode())
    workbook = client.get(f"/api/orders/{run_id}/export?format=xlsx")
    assert workbook.status_code == 200
    assert workbook.content[:2] == b"PK"
    change = client.patch(f"/api/recommendations/runs/{run_id}/items/{item_id}/adjust", json={"approved_quantity": 17, "reason": "Согласовано менеджером", "changed_by": "manager"})
    assert change.status_code == 200
    assert change.json()["recommended_quantity"] == 17
    assert change.json()["calculated_quantity"] != 17
    assert client.get(f"/api/recommendations/runs/{run_id}").json()["status"] == "stale_after_edit"
    assert client.get(f"/api/orders/{run_id}/export?format=csv").status_code == 409
