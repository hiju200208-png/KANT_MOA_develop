from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response
from pydantic import BaseModel, ConfigDict, Field

from auth.presentation.dependencies import CurrentUser, SessionDep, get_current_user
from core.errors import ApiError
from core.schemas import PageResponse
from products.application.wishlist_service import WishlistService
from products.domain.product import ProductNotFound
from products.presentation.schemas import ProductSummary, summary

router = APIRouter(prefix="/wishlist", tags=["wishlist"])
AuthenticatedUser = Annotated[CurrentUser, Depends(get_current_user)]
ProductId = Annotated[int, Path(ge=1, le=9_223_372_036_854_775_807)]


class WishlistQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page: int = Field(default=1, ge=1, le=2_147_483_647)
    size: int = Field(default=20, ge=1, le=100)


class WishlistState(BaseModel):
    product_id: int
    is_wished: bool


@router.get("", response_model=PageResponse[ProductSummary], summary="내 찜 목록")
async def wishlist(query: Annotated[WishlistQuery, Query()], user: AuthenticatedUser,
                   session: SessionDep, response: Response):
    response.headers["Cache-Control"] = "private, no-store"
    products, total = await WishlistService(session).list_products(user.id, **query.model_dump())
    return PageResponse(items=[summary(p) for p in products], total=total, page=query.page, size=query.size)


@router.get("/ids", response_model=list[int], summary="내 공개 상품 찜 ID 목록")
async def wishlist_ids(user: AuthenticatedUser, session: SessionDep, response: Response):
    response.headers["Cache-Control"] = "private, no-store"
    return await WishlistService(session).ids(user.id)


@router.put("/{product_id}", response_model=WishlistState, summary="상품 찜 추가 (멱등)")
async def add_wishlist(product_id: ProductId, user: AuthenticatedUser, session: SessionDep):
    try:
        await WishlistService(session).set_wished(user.id, product_id, wished=True)
    except ProductNotFound as error:
        raise ApiError(404, "UNKNOWN", str(error)) from error
    return WishlistState(product_id=product_id, is_wished=True)


@router.delete("/{product_id}", response_model=WishlistState, summary="상품 찜 해제 (멱등)")
async def remove_wishlist(product_id: ProductId, user: AuthenticatedUser, session: SessionDep):
    await WishlistService(session).set_wished(user.id, product_id, wished=False)
    return WishlistState(product_id=product_id, is_wished=False)
