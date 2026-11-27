# FastAPI Express Stock Count Variance API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone FastAPI service that returns Express STTAK3-style stock-count variance rows for a date and locations, authenticated with a static Bearer token from `.env`.

**Architecture:** New package under `external/express-variance-api/` with config, bearer auth, pure validation/diff helpers, DBF loaders for `STTAK`/`STLOC`/`STMAS`, and one GET route matching the existing stockcount variance path. No StockCount Pro UI and no Pode migration in this plan.

**Tech Stack:** Python 3.11+, FastAPI, Uvicorn, Pydantic Settings, `dbfread`, pytest, httpx (for TestClient).

## Global Constraints

- Create code only under `external/express-variance-api/` (plus this plan/docs); do not edit OneDrive ExpressAPI originals.
- Endpoint path must be exactly: `GET /api/stockcount/variance/countdate/{yyyy-MM-dd}/locations/{codes}`.
- Formula: `DifferentQty = PhysicalBalance - LocationBalance` with `PhysicalBalance = STTAK.PHYBAL`, `LocationBalance = STLOC.LOCBAL`.
- Include only `TAKFLG` in `{'2','3'}`.
- Missing `STLOC` row → keep STTAK line with `LocationBalance = null` and `DifferentQty = null`.
- Empty result → HTTP 404 `Variance data not found`.
- Auth: `Authorization: Bearer {VARIANCE_API_TOKEN}` from env (MVP); mismatch/missing → 401 `Unauthorized`.
- Location codes: trim, uppercase, `^[A-Z0-9]+$`, non-empty list; commas in path stay literal.
- Default listen port **8090** (avoid Pode 8080).
- Do not commit real secrets; ship `.env.example` only.
- PowerShell prototype on `feature/express-stockcount-variance` is not deleted by this plan; FastAPI is the primary path.

## File map

| File | Responsibility |
|------|----------------|
| `external/express-variance-api/requirements.txt` | Dependencies |
| `external/express-variance-api/.env.example` | Env template |
| `external/express-variance-api/app/__init__.py` | Package marker |
| `external/express-variance-api/app/config.py` | Settings |
| `external/express-variance-api/app/validation.py` | Date/location parse + diff math |
| `external/express-variance-api/app/auth.py` | Bearer dependency |
| `external/express-variance-api/app/variance.py` | DBF read + join |
| `external/express-variance-api/app/main.py` | FastAPI routes |
| `external/express-variance-api/tests/test_validation.py` | Unit tests for validation/diff |
| `external/express-variance-api/tests/test_api.py` | HTTP tests with TestClient |
| `external/express-variance-api/README.md` | How to run |

---

### Task 1: Scaffold + validation helpers (TDD)

**Files:**
- Create: `external/express-variance-api/requirements.txt`
- Create: `external/express-variance-api/app/__init__.py`
- Create: `external/express-variance-api/app/validation.py`
- Create: `external/express-variance-api/tests/test_validation.py`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `is_valid_count_date(count_date: str) -> bool`
  - `parse_location_codes(locations_segment: str) -> list[str]` — raises `ValueError` with message starting `Invalid location` or `Invalid locations`
  - `different_qty(physical: float | None, location: float | None) -> float | None`

- [ ] **Step 1: Write failing tests**

`tests/test_validation.py`:

```python
import pytest

from app.validation import different_qty, is_valid_count_date, parse_location_codes


def test_valid_count_date():
    assert is_valid_count_date("2026-03-11") is True
    assert is_valid_count_date("2026/03/11") is False
    assert is_valid_count_date("26-03-11") is False


def test_parse_location_codes_normalizes():
    assert parse_location_codes("24a1, 24GA") == ["24A1", "24GA"]


def test_parse_location_codes_rejects_bad():
    with pytest.raises(ValueError, match="Invalid location"):
        parse_location_codes("24A1/../X")
    with pytest.raises(ValueError, match="Invalid locations"):
        parse_location_codes("  ,  ")


def test_different_qty():
    assert different_qty(3648, 3600) == 48
    assert different_qty(10, 12) == -2
    assert different_qty(10, None) is None
    assert different_qty(None, 10) is None
```

- [ ] **Step 2: Install deps and run tests (expect fail)**

```powershell
cd external/express-variance-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install fastapi uvicorn pydantic-settings dbfread pytest httpx
pip freeze > requirements.txt
pytest tests/test_validation.py -v
```

Expected: FAIL — `ModuleNotFoundError: app.validation` (or similar).

Also create empty `app/__init__.py`.

- [ ] **Step 3: Implement `app/validation.py`**

```python
import re

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_LOC_RE = re.compile(r"^[A-Z0-9]+$")


def is_valid_count_date(count_date: str) -> bool:
    return bool(_DATE_RE.match(count_date))


def parse_location_codes(locations_segment: str) -> list[str]:
    codes: list[str] = []
    for raw in locations_segment.split(","):
        code = raw.strip().upper()
        if not code:
            continue
        if not _LOC_RE.match(code):
            raise ValueError(f"Invalid location code: {raw.strip()}")
        codes.append(code)
    if not codes:
        raise ValueError("Invalid locations")
    return codes


def different_qty(physical: float | None, location: float | None) -> float | None:
    if physical is None or location is None:
        return None
    return float(physical) - float(location)
```

- [ ] **Step 4: Re-run tests — expect pass**

```powershell
pytest tests/test_validation.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add external/express-variance-api/app/__init__.py external/express-variance-api/app/validation.py external/express-variance-api/tests/test_validation.py external/express-variance-api/requirements.txt
git commit -m "Add FastAPI variance validation helpers with unit tests."
```

---

### Task 2: Config, auth, variance loader

**Files:**
- Create: `external/express-variance-api/app/config.py`
- Create: `external/express-variance-api/app/auth.py`
- Create: `external/express-variance-api/app/variance.py`
- Create: `external/express-variance-api/.env.example`
- Create: `external/express-variance-api/tests/test_variance_loader.py` (optional fixture-based; if no real DBF, test pure join helper with in-memory dicts)

**Interfaces:**
- Consumes: `different_qty`, `is_valid_count_date`, `parse_location_codes`
- Produces:
  - `Settings` with `express_db_path: str`, `variance_api_token: str`, `host: str = "127.0.0.1"`, `port: int = 8090`
  - `require_bearer(authorization: str | None) -> None` — raises `HTTPException(401)` if missing/wrong
  - `load_variance_rows(db_path: str, count_date: str, location_codes: list[str]) -> list[dict]`
  - Row dict keys exactly: `LocationCode`, `ProductCode`, `ProductName`, `Area`, `CountDate`, `PhysicalBalance`, `LocationBalance`, `DifferentQty`, `CountFlag`

- [ ] **Step 1: Add `.env.example` and `config.py`**

`.env.example`:

```env
EXPRESS_DB_PATH=D:\path\to\ExpressCompanyFolder
VARIANCE_API_TOKEN=change-me
HOST=127.0.0.1
PORT=8090
```

`app/config.py`:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    express_db_path: str
    variance_api_token: str
    host: str = "127.0.0.1"
    port: int = 8090


def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 2: Implement `auth.py`**

```python
from fastapi import Header, HTTPException

from app.config import get_settings


def require_bearer(authorization: str | None = Header(default=None)) -> None:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ", 1)[1].strip()
    expected = get_settings().variance_api_token
    if not expected or token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")
```

- [ ] **Step 3: Implement DBF loader in `variance.py`**

Use `dbfread.DBF(..., encoding="cp874", ignore_missing_memofile=True)` (Thai Express installs often use cp874; if garbled names, try `latin-1` without changing numeric fields).

Algorithm:

1. Validate `count_date` via `is_valid_count_date`; raise `ValueError("Invalid countDate")` if bad.
2. Open `STTAK.DBF` under `db_path`; keep rows where:
   - date field `TAKDAT` equals `count_date` (normalize `datetime.date` → `yyyy-MM-dd`)
   - `str(TAKFLG).strip()` in `{"2","3"}`
   - `str(LOCCOD).strip().upper()` in `location_codes` set
3. Build `stloc_map[(stk, loc)] = {LOCBAL, AREA}` from `STLOC.DBF` filtered to requested locations.
4. Build `stmas_map[stk] = STKDES` from `STMAS.DBF` for product codes seen.
5. For each STTAK row emit dict using `different_qty(...)`.
6. Coerce numeric fields with a helper that returns `None` for missing values; if `dbfread` returns `bytes` for FoxPro binary doubles, unpack with `struct.unpack("<d", value[:8])[0]`.

Extract a pure function for easier testing:

```python
def build_variance_row(
    *,
    location_code: str,
    product_code: str,
    product_name: str,
    area: str,
    count_date: str,
    physical_balance: float | None,
    location_balance: float | None,
    count_flag: str,
) -> dict:
    return {
        "LocationCode": location_code,
        "ProductCode": product_code,
        "ProductName": product_name,
        "Area": area,
        "CountDate": count_date,
        "PhysicalBalance": physical_balance,
        "LocationBalance": location_balance,
        "DifferentQty": different_qty(physical_balance, location_balance),
        "CountFlag": count_flag,
    }
```

- [ ] **Step 4: Unit test `build_variance_row`**

Add to `tests/test_validation.py` or `tests/test_variance_loader.py`:

```python
from app.variance import build_variance_row

def test_build_variance_row_null_locbal():
    row = build_variance_row(
        location_code="24A1",
        product_code="X",
        product_name="n",
        area="A",
        count_date="2026-03-11",
        physical_balance=10.0,
        location_balance=None,
        count_flag="3",
    )
    assert row["DifferentQty"] is None
    assert row["LocationBalance"] is None
```

Run: `pytest tests/ -v` → PASS

- [ ] **Step 5: Commit**

```bash
git add external/express-variance-api/app/config.py external/express-variance-api/app/auth.py external/express-variance-api/app/variance.py external/express-variance-api/.env.example external/express-variance-api/tests
git commit -m "Add FastAPI variance config, auth, and DBF loader."
```

---

### Task 3: FastAPI route + HTTP tests + README

**Files:**
- Create: `external/express-variance-api/app/main.py`
- Create: `external/express-variance-api/tests/test_api.py`
- Create: `external/express-variance-api/README.md`
- Modify: root `.gitignore` to ignore `external/express-variance-api/.venv/` and `external/express-variance-api/.env`

**Interfaces:**
- Consumes: `require_bearer`, `parse_location_codes`, `is_valid_count_date`, `load_variance_rows`, `get_settings`
- Produces: JSON body shape from the design spec

- [ ] **Step 1: Write failing API tests with dependency overrides**

`tests/test_api.py`:

```python
import os

import pytest
from fastapi.testclient import TestClient

# Ensure settings can load before import
os.environ.setdefault("EXPRESS_DB_PATH", "C:\\tmp\\express-db")
os.environ.setdefault("VARIANCE_API_TOKEN", "test-token")

from app.main import app
from app import variance as variance_mod


@pytest.fixture()
def client(monkeypatch):
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

    monkeypatch.setattr(variance_mod, "load_variance_rows", fake_load)
    return TestClient(app)


def test_unauthorized(client):
    r = client.get("/api/stockcount/variance/countdate/2026-03-11/locations/24A1")
    assert r.status_code == 401


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
        "/api/stockcount/variance/countdate/2026-13-40/locations/24A1",
        headers={"Authorization": "Bearer test-token"},
    )
    assert r.status_code == 400


def test_empty_404(client, monkeypatch):
    monkeypatch.setattr(variance_mod, "load_variance_rows", lambda *a, **k: [])
    r = client.get(
        "/api/stockcount/variance/countdate/2026-03-11/locations/24A1",
        headers={"Authorization": "Bearer test-token"},
    )
    assert r.status_code == 404
```

- [ ] **Step 2: Implement `app/main.py`**

```python
from fastapi import Depends, FastAPI, HTTPException

from app.auth import require_bearer
from app.config import get_settings
from app.validation import is_valid_count_date, parse_location_codes
from app.variance import load_variance_rows

app = FastAPI(title="Express Stock Count Variance API")


@app.get("/api/stockcount/variance/countdate/{count_date}/locations/{locations}")
def get_variance(
    count_date: str,
    locations: str,
    _: None = Depends(require_bearer),
):
    if not is_valid_count_date(count_date):
        raise HTTPException(status_code=400, detail="Invalid countDate")
    try:
        codes = parse_location_codes(locations)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid locations") from None

    settings = get_settings()
    try:
        rows = load_variance_rows(settings.express_db_path, count_date, codes)
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Internal error") from None
    except Exception:
        raise HTTPException(status_code=500, detail="Internal error") from None

    if not rows:
        raise HTTPException(status_code=404, detail="Variance data not found")

    return {
        "success": True,
        "countDate": count_date,
        "locations": codes,
        "varianceData": rows,
    }
```

Note: FastAPI may wrap `detail` as `{"detail":"..."}`; that is acceptable for MVP. If matching Pode `{success:false,message:...}` is required, switch to `JSONResponse` — prefer Pode-compatible shape if easy:

```python
return JSONResponse(status_code=404, content={"success": False, "message": "Variance data not found"})
```

Use Pode-compatible `{success, message}` for 4xx/5xx and keep 200 body as in the design spec.

- [ ] **Step 3: Run tests**

```powershell
pytest tests/ -v
```

Expected: all PASS

- [ ] **Step 4: README + gitignore**

README: how to create venv, copy `.env.example`, set path/token, run:

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8090
```

Example curl with Bearer.

Add to repo `.gitignore`:

```gitignore
external/express-variance-api/.venv/
external/express-variance-api/.env
```

- [ ] **Step 5: Manual smoke (when DB path accessible)**

```powershell
$env:EXPRESS_DB_PATH='\\192.168.10.11\...\CompanyFolder'
$env:VARIANCE_API_TOKEN='dev-token'
uvicorn app.main:app --port 8090
# other terminal:
Invoke-RestMethod -Headers @{Authorization='Bearer dev-token'} `
  -Uri 'http://127.0.0.1:8090/api/stockcount/variance/countdate/YYYY-MM-DD/locations/XXXX'
```

- [ ] **Step 6: Commit**

```bash
git add external/express-variance-api .gitignore
git commit -m "Expose FastAPI stock-count variance endpoint with bearer auth."
git push -u origin HEAD
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| FastAPI under `external/express-variance-api/` | Tasks 1–3 |
| Exact variance URL | Task 3 |
| Env token auth | Task 2–3 |
| STTAK3 formula + TAKFLG filter | Task 2 |
| Null STLOC handling | Task 2 |
| 401/400/404/500 | Task 3 |
| Port 8090 default | Task 2 config |
| No Phase 2 UI | Global |
| Unit + HTTP tests | Tasks 1, 3 |

## Placeholder scan

No TBD left; DBF encoding fallback documented as cp874 then latin-1 without changing API contract.
