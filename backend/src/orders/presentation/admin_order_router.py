# [presentation] 이 라우터 전체는 서버에서 검증한 ADMIN만 접근한다.
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict

from auth.presentation.dependencies import require_admin
from core.schemas import ErrorResponse, PageResponse
from orders.application.admin_order_service import AdminOrderService
from orders.domain.exceptions import OrderDomainError
from orders.presentation.dependencies import get_admin_order_service
from orders.presentation.errors import to_api_error
from orders.presentation.order_schemas import OrderQuery, OrderResponse, order_response

router = APIRouter(prefix="/admin", tags=["admin-orders"], dependencies=[Depends(require_admin)])
ERRORS = {code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 422)}


class AdminOrderQuery(OrderQuery):
    shipping_status: Literal["preparing", "shipped", "delivered"] | None = None


class ShippingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["shipped", "delivered"]


class AdminOrderResponse(OrderResponse):
    user_id: UUID
    shipping_status: Literal["not_applicable", "preparing", "shipped", "delivered"]
    shipped_at: datetime | None
    delivered_at: datetime | None


def response(order, shipment):
    return AdminOrderResponse(**order_response(order).model_dump(), user_id=order.user_id,
                              shipping_status=shipment.status if order.status.value == "paid" else "not_applicable",
                              shipped_at=shipment.shipped_at, delivered_at=shipment.delivered_at)


@router.get("", response_model=PageResponse[AdminOrderResponse], responses=ERRORS)
async def list_admin_orders(query: Annotated[AdminOrderQuery, Query()],
                            service: AdminOrderService = Depends(get_admin_order_service)):
    rows, total = await service.list(query.status, query.shipping_status, query.q, query.page, query.size)
    return PageResponse(items=[response(order, shipment) for order, shipment in rows], total=total,
                        page=query.page, size=query.size)


@router.patch("/{order_id}/shipping", response_model=AdminOrderResponse, responses=ERRORS)
async def update_shipping(order_id: UUID, body: ShippingRequest, admin=Depends(require_admin),
                          service: AdminOrderService = Depends(get_admin_order_service)):
    try:
        order, shipment = await service.advance(order_id, admin.id, body.status)
        return response(order, shipment)
    except OrderDomainError as error:
        raise to_api_error(error) from error
