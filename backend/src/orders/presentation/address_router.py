# [presentation] 배송지 API. 사용자는 항상 로그인 토큰(get_current_user)으로만 정하고, 요청 본문의 user_id는 받지 않는다.
# main.py 등록(app.include_router)은 P1 인증 PR이 main에 들어온 뒤 희주님과 협의해서 한다.
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response

from core.schemas import ErrorResponse, PageResponse
from orders.application.address_service import AddressService
from orders.domain.address import Address, AddressInput
from orders.domain.exceptions import OrderDomainError
from orders.presentation.address_schemas import AddressQuery, AddressRequest, AddressResponse
from orders.presentation.dependencies import get_address_service, get_current_user
from orders.presentation.errors import to_api_error

router = APIRouter(prefix="/addresses", tags=["addresses"])

_READ_ERRORS = {code: {"model": ErrorResponse} for code in (401, 403, 404, 422)}
_WRITE_ERRORS = {code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 422)}

AddressId = Annotated[int, Path(ge=1)]


def _to_response(address: Address) -> AddressResponse:
    c = address.content
    return AddressResponse(id=address.id, label=c.label, recipient_name=c.recipient_name,
                           recipient_phone=c.recipient_phone, postal_code=c.postal_code, address1=c.address1,
                           address2=c.address2, is_default=address.is_default, created_at=address.created_at)


def _to_input(body: AddressRequest) -> AddressInput:
    return AddressInput(recipient_name=body.recipient_name, recipient_phone=body.recipient_phone,
                        postal_code=body.postal_code, address1=body.address1, address2=body.address2,
                        label=body.label)


@router.get("", response_model=PageResponse[AddressResponse], responses=_READ_ERRORS,
            summary="내 배송지 목록 (기본 배송지 맨 앞, 나머지 최신순)")
async def list_addresses(
    query: Annotated[AddressQuery, Query()],
    user=Depends(get_current_user),
    service: AddressService = Depends(get_address_service),
) -> PageResponse[AddressResponse]:
    items, total = await service.list(user.id, query.q, query.page, query.size)
    return PageResponse[AddressResponse](items=[_to_response(a) for a in items], total=total,
                                         page=query.page, size=query.size)


@router.get("/{address_id}", response_model=AddressResponse, responses=_READ_ERRORS, summary="배송지 상세")
async def get_address(
    address_id: AddressId,
    user=Depends(get_current_user),
    service: AddressService = Depends(get_address_service),
) -> AddressResponse:
    try:
        return _to_response(await service.get(user.id, address_id))
    except OrderDomainError as error:
        raise to_api_error(error) from error


@router.post("", status_code=201, response_model=AddressResponse, responses=_WRITE_ERRORS,
             summary="배송지 등록 (첫 배송지는 자동으로 기본)")
async def create_address(
    body: AddressRequest,
    user=Depends(get_current_user),
    service: AddressService = Depends(get_address_service),
) -> AddressResponse:
    try:
        return _to_response(await service.create(user.id, _to_input(body), body.is_default))
    except OrderDomainError as error:
        raise to_api_error(error) from error


@router.put("/{address_id}", response_model=AddressResponse, responses=_WRITE_ERRORS, summary="배송지 수정 (전체 내용)")
async def update_address(
    address_id: AddressId,
    body: AddressRequest,
    user=Depends(get_current_user),
    service: AddressService = Depends(get_address_service),
) -> AddressResponse:
    try:
        return _to_response(await service.update(user.id, address_id, _to_input(body), body.is_default))
    except OrderDomainError as error:
        raise to_api_error(error) from error


@router.delete("/{address_id}", status_code=204, responses=_WRITE_ERRORS,
               summary="배송지 삭제 (기본이면 남은 것 중 최신이 기본)")
async def delete_address(
    address_id: AddressId,
    user=Depends(get_current_user),
    service: AddressService = Depends(get_address_service),
) -> Response:
    try:
        await service.delete(user.id, address_id)
    except OrderDomainError as error:
        raise to_api_error(error) from error
    return Response(status_code=204)


@router.patch("/{address_id}/default", status_code=204, responses=_WRITE_ERRORS, summary="기본 배송지로 지정")
async def set_default_address(
    address_id: AddressId,
    user=Depends(get_current_user),
    service: AddressService = Depends(get_address_service),
) -> Response:
    try:
        await service.set_default(user.id, address_id)
    except OrderDomainError as error:
        raise to_api_error(error) from error
    return Response(status_code=204)
