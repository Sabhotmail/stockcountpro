from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.auth import require_bearer
from app.config import get_settings
from datetime import datetime, timezone

from app.validation import is_valid_count_date, parse_location_codes
from app.variance import load_location_balances, load_variance_rows

app = FastAPI(title="Express Stock Count Variance API")


def _error(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "message": message},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    message = exc.detail if isinstance(exc.detail, str) else "Error"
    return _error(exc.status_code, message)


@app.get("/api/stockcount/variance/countdate/{count_date}/locations/{locations}")
def get_variance(
    count_date: str,
    locations: str,
    _: None = Depends(require_bearer),
):
    if not is_valid_count_date(count_date):
        return _error(400, "Invalid countDate")
    try:
        codes = parse_location_codes(locations)
    except ValueError:
        return _error(400, "Invalid locations")

    settings = get_settings()
    try:
        rows = load_variance_rows(settings.express_db_path, count_date, codes)
    except FileNotFoundError:
        return _error(500, "Internal error")
    except Exception:
        return _error(500, "Internal error")

    if not rows:
        return _error(404, "Variance data not found")

    return {
        "success": True,
        "countDate": count_date,
        "locations": codes,
        "varianceData": rows,
    }


@app.get("/api/stockcount/locations/{location_code}/balances")
def get_location_balances(
    location_code: str,
    _: None = Depends(require_bearer),
):
    try:
        codes = parse_location_codes(location_code)
    except ValueError:
        return _error(400, "Invalid location")
    if len(codes) != 1:
        return _error(400, "Invalid location")

    settings = get_settings()
    try:
        balances = load_location_balances(settings.express_db_path, codes[0])
    except FileNotFoundError:
        return _error(500, "Internal error")
    except Exception:
        return _error(500, "Internal error")

    return {
        "success": True,
        "locationCode": codes[0],
        "fetchedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "balances": balances,
    }
