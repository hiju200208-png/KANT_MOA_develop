# [presentation] 장바구니 API. 사용자는 로그인 토큰(get_current_user)으로만 정하고, 변경 API는 갱신된 장바구니 전체를 돌려준다.
# 장바구니는 화면 계약(API_SPEC 4장)상 항목+합계 한 덩어리라 페이지를 나누지 않는다.
# main.py 등록(app.include_router)은 P1 인증 PR이 main에 들어온 뒤 희주님과 협의해서 한다.
from typing import Annotated

from fastapi import APIRouter, Depends, Path

from core.schemas import ErrorResponse
from orders.application.cart_service import CartService
from orders.domain.cart import Cart
from orders.domain.exceptions import OrderDomainError
from orders.presentation.cart_schemas import (
    CartAddRequest,
    CartItemResponse,
    CartMergeRequest,
    CartProduct,
    CartQuantityRequest,
    CartResponse,
)
from orders.presentation.dependencies import get_cart_service, get_current_user
from orders.presentation.errors import to_api_error

router = APIRouter(prefix="/cart", tags=["cart"])

_ERRORS = {code: {"model": ErrorResponse} for code in (401, 404, 409, 422)}

VariantId = Annotated[int, Path(ge=1)]


def _to_response(cart: Cart) -> CartResponse:
    return CartResponse(
        items=[
            CartItemResponse(
                variant_id=line.variant.variant_id,
                quantity=line.quantity,
                product=CartProduct(id=line.variant.product_id, name=line.variant.product_name,
                                    thumbnail_url=line.variant.thumbnail_path),
                option_name=line.variant.option_name,
                unit_price=line.variant.unit_price,
                stock=line.variant.stock,
                max_per_user=line.variant.max_per_user,
                is_available=line.is_available,
            )
            for line in cart.lines
        ],
        total_quantity=cart.total_quantity,
        total_price=cart.total_price,
    )


@router.get("", response_model=CartResponse, responses={401: {"model": ErrorResponse}}, summary="내 장바구니")
async def get_cart(user=Depends(get_current_user), service: CartService = Depends(get_cart_service)) -> CartResponse:
    return _to_response(await service.get_cart(user.id))


@router.post("/items", response_model=CartResponse, responses=_ERRORS, summary="장바구니 담기 (같은 옵션이면 수량 더함)")
async def add_item(
    body: CartAddRequest,
    user=Depends(get_current_user),
    service: CartService = Depends(get_cart_service),
) -> CartResponse:
    try:
        return _to_response(await service.add(user.id, body.variant_id, body.quantity))
    except OrderDomainError as error:
        raise to_api_error(error) from error


@router.patch("/items/{variant_id}", response_model=CartResponse, responses=_ERRORS, summary="수량 변경")
async def change_quantity(
    variant_id: VariantId,
    body: CartQuantityRequest,
    user=Depends(get_current_user),
    service: CartService = Depends(get_cart_service),
) -> CartResponse:
    try:
        return _to_response(await service.change_quantity(user.id, variant_id, body.quantity))
    except OrderDomainError as error:
        raise to_api_error(error) from error


@router.delete("/items/{variant_id}", response_model=CartResponse, responses=_ERRORS, summary="장바구니에서 빼기")
async def remove_item(
    variant_id: VariantId,
    user=Depends(get_current_user),
    service: CartService = Depends(get_cart_service),
) -> CartResponse:
    try:
        return _to_response(await service.remove(user.id, variant_id))
    except OrderDomainError as error:
        raise to_api_error(error) from error


@router.post("/merge", response_model=CartResponse, responses=_ERRORS,
             summary="비회원 장바구니 병합 (로그인 직후, 상한 min(재고, 구매 제한))")
async def merge_guest_cart(
    body: CartMergeRequest,
    user=Depends(get_current_user),
    service: CartService = Depends(get_cart_service),
) -> CartResponse:
    try:
        items = [(item.variant_id, item.quantity) for item in body.items]
        return _to_response(await service.merge_guest(user.id, items))
    except OrderDomainError as error:
        raise to_api_error(error) from error
