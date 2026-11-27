# Express Stock Count Variance API (FastAPI)

Read-only API that returns Express physical-count variance rows
(`PhysicalBalance`, `LocationBalance`, `DifferentQty`) using the STTAK3 formula:

`DifferentQty = PHYBAL − LOCBAL`

## Setup

```powershell
cd external/express-variance-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env`:

- `EXPRESS_DB_PATH` — company folder containing `STTAK.DBF`, `STLOC.DBF`, `STMAS.DBF`
- `VARIANCE_API_TOKEN` — Bearer token clients must send

## Run

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8090
```

## Example

```powershell
Invoke-RestMethod `
  -Headers @{ Authorization = 'Bearer change-me' } `
  -Uri 'http://127.0.0.1:8090/api/stockcount/variance/countdate/2026-03-11/locations/24A1'
```

## Tests

```powershell
pytest -v
```
