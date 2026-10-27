# [presentation] 주문 API. 사용자는 로그인 토큰(get_current_user)으로만 정하고, 가격·합계는 요청에서 받지 않는다.
# main.py 등록(app.include_router)은 P1 인증 PR이 main에 들어온 뒤 희주님과 협의해서 한다.
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from core.schemas import ErrorResponse, PageResponse
from orders.application.order_service import OrderService
from orders.domain.checkout import Recipient
from orders.domain.exceptions import OrderDomainError
from orders.domain.order import Order
from orders.presentation.dependencies import get_current_user, get_order_service
from orders.presentation.errors import to_api_error
from orders.presentation.order_schemas import (
    DirectOrderRequest,
    OrderCreateRequest,
    OrderItemResponse,
    OrderQuery,
    OrderResponse,
    ShippingPolicyResponse,
)

router = APIRouter(prefix="/orders", tags=["orders"])

_READ_ERRORS = {code: {"model": ErrorResponse} for code in (401, 403, 404, 422)}
_WRITE_ERRORS = {code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 422)}


def _to_response(order: Order) -> OrderResponse:
    return OrderResponse(
        id=order.id, status=order.status.value, items_price=order.items_price, shipping_fee=order.shipping_fee,
        total_price=order.total_price, is_direct=order.is_direct, recipient_name=order.recipient_name,
        recipient_phone=order.recipient_phone, address=order.address,
        items=[OrderItemResponse(variant_id=i.variant_id, product_name=i.product_name, option_name=i.option_name,
                                 unit_price=i.unit_price, quantity=i.quantity, line_price=i.line_price)
               for i in order.items],
        created_at=order.created_at, paid_at=order.paid_at, cancelled_at=order.cancelled_at,
    )


def _recipient(body: OrderCreateRequest) -> Recipient:
    return Recipient(name=body.recipient_name, phone=body.recipient_phone, address=body.address)


@router.get("", response_model=PageResponse[OrderResponse], responses=_READ_ERRORS, summary="내 주문 목록 (최신순)")
async def list_orders(
    query: Annotated[OrderQuery, Query()],
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
) -> PageResponse[OrderResponse]:
    items, total = await service.list(user.id, query.status, query.q, query.page, query.size)
    return PageResponse[OrderResponse](items=[_to_response(o) for o in items], total=total,
                                       page=query.page, size=query.size)


# /{order_id}보다 먼저 등록해야 "shipping-policy"가 주문 id로 해석되지 않는다
@router.get("/shipping-policy", response_model=ShippingPolicyResponse,
            summary="배송비 안내 (로그인 불필요, 장바구니·주문서 표시용)")
async def get_shipping_policy(service: OrderService = Depends(get_order_service)) -> ShippingPolicyResponse:
    policy = await service.shipping_policy()
    # 설정이 없으면 주문 생성과 같은 규칙으로 배송비 0
    if policy is None:
        return ShippingPolicyResponse(free_shipping_threshold=0, shipping_fee=0)
    return ShippingPolicyResponse(free_shipping_threshold=policy.free_shipping_threshold,
                                  shipping_fee=policy.shipping_fee)


@router.get("/{order_id}", response_model=OrderResponse, responses=_READ_ERRORS, summary="주문 상세")
async def get_order(
    order_id: UUID,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
) -> OrderResponse:
    try:
        return _to_response(await service.get(user.id, order_id))
    except OrderDomainError as error:
        raise to_api_error(error) from error


@router.post("", status_code=201, response_model=OrderResponse, responses=_WRITE_ERRORS,
             summary="장바구니 전체로 주문 생성 (결제 대기, 재고 차감 없음)")
async def create_order(
    body: OrderCreateRequest,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
) -> OrderResponse:
    try:
        return _to_response(await service.create_from_cart(user.id, _recipient(body)))
    except OrderDomainError as error:
        raise to_api_error(error) from error


@router.post("/direct", status_code=201, response_model=OrderResponse, responses=_WRITE_ERRORS,
             summary="바로 구매 주문 생성 (옵션 하나, 장바구니와 무관)")
async def create_direct_order(
    body: DirectOrderRequest,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
) -> OrderResponse:
    try:
        return _to_response(await service.create_direct(user.id, _recipient(body), body.variant_id, body.quantity))
    except OrderDomainError as error:
        raise to_api_error(error) from error


@router.post("/{order_id}/pay", response_model=OrderResponse, responses=_WRITE_ERRORS,
             summary="모의 결제 (구매 제한 최종 검사 + 재고 차감 + paid)")
async def pay_order(
    order_id: UUID,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
) -> OrderResponse:
    try:
        return _to_response(await service.pay(user.id, order_id))
    except OrderDomainError as error:
        raise to_api_error(error) from error


@router.post("/{order_id}/cancel", response_model=OrderResponse, responses=_WRITE_ERRORS,
             summary="주문 취소 (결제 완료 주문은 재고 복구)")
async def cancel_order(
    order_id: UUID,
    user=Depends(get_current_user),
    service: OrderService = Depends(get_order_service),
) -> OrderResponse:
    try:
        return _to_response(await service.cancel(user.id, order_id))
    except OrderDomainError as error:
        raise to_api_error(error) from error
