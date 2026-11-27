import pytest

from app.validation import different_qty, is_valid_count_date, parse_location_codes
from app.variance import build_variance_row


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


def test_build_variance_row_diff():
    row = build_variance_row(
        location_code="24A1",
        product_code="X",
        product_name="n",
        area="A",
        count_date="2026-03-11",
        physical_balance=3648.0,
        location_balance=3600.0,
        count_flag="3",
    )
    assert row["DifferentQty"] == 48.0

