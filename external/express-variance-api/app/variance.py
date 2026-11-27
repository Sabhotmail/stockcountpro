from __future__ import annotations

import struct
from datetime import date, datetime
from pathlib import Path
from typing import Any

from dbfread import DBF

from app.validation import different_qty, is_valid_count_date


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
) -> dict[str, Any]:
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


def _as_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        if len(value) < 8:
            return None
        return float(struct.unpack("<d", value[:8])[0])
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_date(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    if len(text) == 8 and text.isdigit():
        return f"{text[0:4]}-{text[4:6]}-{text[6:8]}"
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]
    return None


def _open_dbf(path: Path) -> DBF:
    try:
        return DBF(str(path), encoding="cp874", ignore_missing_memofile=True, char_decode_errors="ignore")
    except UnicodeError:
        return DBF(str(path), encoding="latin-1", ignore_missing_memofile=True, char_decode_errors="ignore")


def load_variance_rows(
    db_path: str,
    count_date: str,
    location_codes: list[str],
) -> list[dict[str, Any]]:
    if not is_valid_count_date(count_date):
        raise ValueError("Invalid countDate")

    root = Path(db_path)
    sttak_path = root / "STTAK.DBF"
    stloc_path = root / "STLOC.DBF"
    stmas_path = root / "STMAS.DBF"
    if not sttak_path.exists():
        # also try lowercase
        sttak_path = root / "sttak.dbf"
        stloc_path = root / "stloc.dbf"
        stmas_path = root / "stmas.dbf"
    if not sttak_path.exists():
        raise FileNotFoundError(f"STTAK.DBF not found under {db_path}")

    location_set = {c.upper() for c in location_codes}
    tak_rows: list[dict[str, Any]] = []
    product_codes: set[str] = set()

    for record in _open_dbf(sttak_path):
        flag = _as_str(record.get("TAKFLG"))
        if flag not in {"2", "3"}:
            continue
        loc = _as_str(record.get("LOCCOD")).upper()
        if loc not in location_set:
            continue
        row_date = _normalize_date(record.get("TAKDAT"))
        if row_date != count_date:
            continue
        stk = _as_str(record.get("STKCOD")).upper()
        tak_rows.append(
            {
                "location_code": loc,
                "product_code": stk,
                "area": _as_str(record.get("AREA")),
                "physical_balance": _as_float(record.get("PHYBAL")),
                "count_flag": flag,
            }
        )
        product_codes.add(stk)

    if not tak_rows:
        return []

    stloc_map: dict[tuple[str, str], dict[str, Any]] = {}
    if stloc_path.exists():
        for record in _open_dbf(stloc_path):
            loc = _as_str(record.get("LOCCOD")).upper()
            if loc not in location_set:
                continue
            stk = _as_str(record.get("STKCOD")).upper()
            stloc_map[(stk, loc)] = {
                "LOCBAL": _as_float(record.get("LOCBAL")),
                "AREA": _as_str(record.get("AREA")),
            }

    stmas_map: dict[str, str] = {}
    if stmas_path.exists() and product_codes:
        for record in _open_dbf(stmas_path):
            stk = _as_str(record.get("STKCOD")).upper()
            if stk in product_codes:
                stmas_map[stk] = _as_str(record.get("STKDES"))

    rows: list[dict[str, Any]] = []
    for item in tak_rows:
        loc_info = stloc_map.get((item["product_code"], item["location_code"]))
        loc_bal = None if loc_info is None else loc_info["LOCBAL"]
        area = item["area"]
        if loc_info and loc_info["AREA"]:
            area = loc_info["AREA"]
        rows.append(
            build_variance_row(
                location_code=item["location_code"],
                product_code=item["product_code"],
                product_name=stmas_map.get(item["product_code"], ""),
                area=area,
                count_date=count_date,
                physical_balance=item["physical_balance"],
                location_balance=loc_bal,
                count_flag=item["count_flag"],
            )
        )
    return rows


def load_location_balances(db_path: str, location_code: str) -> list[dict[str, Any]]:
    """Read live STLOC.LOCBAL for one warehouse (pre-push compare)."""
    loc = _as_str(location_code).upper()
    if not loc:
        raise ValueError("Invalid location")

    root = Path(db_path)
    stloc_path = root / "STLOC.DBF"
    if not stloc_path.exists():
        stloc_path = root / "stloc.dbf"
    if not stloc_path.exists():
        raise FileNotFoundError(f"STLOC.DBF not found under {db_path}")

    balances: list[dict[str, Any]] = []
    for record in _open_dbf(stloc_path):
        row_loc = _as_str(record.get("LOCCOD")).upper()
        if row_loc != loc:
            continue
        stk = _as_str(record.get("STKCOD")).upper()
        if not stk:
            continue
        balances.append(
            {
                "ProductCode": stk,
                "LocationBalance": _as_float(record.get("LOCBAL")),
            }
        )
    return balances
