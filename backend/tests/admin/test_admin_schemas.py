import pytest
from pydantic import ValidationError

from admin.presentation.schemas import (
    ProductStatusUpdate,
    StockAdjustmentRequest,
    StockAdjustmentResponse,
)


def test_stock_adjustment_request_accepts_valid_body():
    body = StockAdjustmentRequest.model_validate({"change": -5, "reason": "재고 실사"})
    assert body.change == -5 and body.reason == "재고 실사"


@pytest.mark.parametrize(
    "payload",
    [
        {"change": 0},
        {"change": 10001},
        {"change": -10001},
        {"change": "10"},
        {"change": 1.5},
        {"change": 1, "reason": "가" * 101},
        {"change": 1, "stock": 50},
        {},
    ],
)
def test_stock_adjustment_request_rejects_invalid_body(payload):
    with pytest.raises(ValidationError):
        StockAdjustmentRequest.model_validate(payload)


@pytest.mark.parametrize("status", ["on_sale", "sold_out", "hidden"])
def test_status_update_accepts_known_status(status):
    assert ProductStatusUpdate.model_validate({"status": status}).status == status


@pytest.mark.parametrize("status", ["deleted", "", None])
def test_status_update_rejects_unknown_status(status):
    with pytest.raises(ValidationError):
        ProductStatusUpdate.model_validate({"status": status})


def test_stock_adjustment_response_shape():
    body = StockAdjustmentResponse(variant_id=301, before=37, after=47, change=10)
    assert body.model_dump() == {"variant_id": 301, "before": 37, "after": 47, "change": 10}
