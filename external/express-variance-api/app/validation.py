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
