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

    def fake_balances(db_path, location_code):
        assert location_code == "2425"
        return [
            {"ProductCode": "1010030003", "LocationBalance": 7483.0},
            {"ProductCode": "1010010001", "LocationBalance": 72.0},
        ]

    monkeypatch.setattr(main_mod, "load_location_balances", fake_balances)
    return TestClient(app)


def test_balances_unauthorized(client):
    r = client.get("/api/stockcount/locations/2425/balances")
    assert r.status_code == 401


def test_balances_ok(client):
    r = client.get(
        "/api/stockcount/locations/2425/balances",
        headers={"Authorization": "Bearer test-token"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["locationCode"] == "2425"
    assert body["fetchedAt"]
    assert body["balances"][0]["ProductCode"] == "1010030003"
    assert body["balances"][0]["LocationBalance"] == 7483.0


def test_balances_empty(client, monkeypatch):
    monkeypatch.setattr(main_mod, "load_location_balances", lambda *a, **k: [])
    r = client.get(
        "/api/stockcount/locations/2425/balances",
        headers={"Authorization": "Bearer test-token"},
    )
    assert r.status_code == 200
    assert r.json()["balances"] == []


def test_balances_invalid_location(client):
    r = client.get(
        "/api/stockcount/locations/bad-code!/balances",
        headers={"Authorization": "Bearer test-token"},
    )
    assert r.status_code == 400
    assert r.json()["message"] == "Invalid location"
