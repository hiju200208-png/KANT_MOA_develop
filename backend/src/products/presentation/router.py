from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.errors import ApiError
from core.schemas import PageResponse
from database import get_session
from products.application.catalog_service import CatalogService
from products.domain.product import ProductNotFound
from products.infrastructure.catalog import CatalogRepository
from products.presentation.schemas import CategoryResponse, ProductDetail, ProductQuery, ProductSummary, detail, summary
from products.presentation.discovery_router import router as discovery_router

router = APIRouter(tags=["products"])
router.include_router(discovery_router)  # /products/best must precede /products/{product_id}.
Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("/products", response_model=PageResponse[ProductSummary], summary="공개 상품 목록·검색")
async def list_products(query: Annotated[ProductQuery, Query()], session: Session):
    products, total = await CatalogService(CatalogRepository(session)).list_products(**query.model_dump())
    return PageResponse(items=[summary(p) for p in products], total=total, page=query.page, size=query.size)


@router.get("/products/{product_id}", response_model=ProductDetail, summary="공개 상품 상세")
async def get_product(
    product_id: Annotated[int, Path(ge=1, le=9_223_372_036_854_775_807)], session: Session,
):
    try:
        product = await CatalogService(CatalogRepository(session)).get_product(product_id)
    except ProductNotFound as error:
        raise ApiError(404, "UNKNOWN", str(error)) from error
    return detail(product)


@router.get("/categories", response_model=list[CategoryResponse], summary="활성 카테고리 목록")
async def categories(session: Session):
    return await CatalogRepository(session).categories()
