import os

import pytest
from fastapi.testclient import TestClient

os.environ["EXPRESS_DB_PATH"] = r"C:\tmp\express-db"
os.environ["VARIANCE_API_TOKEN"] = "test-token"

from app.config import get_settings
from app import main as main_mod
from app.main import app


@pytest.fixture()
def client(monkeypatch):
    get_settings.cache_clear()

    def fake_load(db_path, count_date, location_codes):
        assert count_date == "2026-03-11"
        assert location_codes == ["24A1"]
        return [
            {
                "LocationCode": "24A1",
                "ProductCode": "1060010004",
                "ProductName": "ตัวอย่าง",
                "Area": "A-01",
                "CountDate": "2026-03-11",
                "PhysicalBalance": 3648.0,
                "LocationBalance": 3600.0,
                "DifferentQty": 48.0,
                "CountFlag": "3",
            }
        ]

    # Patch the symbol used by the route module (not app.variance).
    monkeypatch.setattr(main_mod, "load_variance_rows", fake_load)
    return TestClient(app)


def test_unauthorized(client):
    r = client.get("/api/stockcount/variance/countdate/2026-03-11/locations/24A1")
    assert r.status_code == 401
    assert r.json()["success"] is False
    assert r.json()["message"] == "Unauthorized"


def test_ok(client):
    r = client.get(
        "/api/stockcount/variance/countdate/2026-03-11/locations/24A1",
        headers={"Authorization": "Bearer test-token"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["varianceData"][0]["DifferentQty"] == 48.0


def test_bad_date(client):
    r = client.get(
        "/api/stockcount/variance/countdate/2026-03-11x/locations/24A1",
        headers={"Authorization": "Bearer test-token"},
    )
    assert r.status_code == 400
    assert r.json()["message"] == "Invalid countDate"


def test_empty_404(client, monkeypatch):
    monkeypatch.setattr(main_mod, "load_variance_rows", lambda *a, **k: [])
    r = client.get(
        "/api/stockcount/variance/countdate/2026-03-11/locations/24A1",
        headers={"Authorization": "Bearer test-token"},
    )
    assert r.status_code == 404
    assert r.json()["message"] == "Variance data not found"
