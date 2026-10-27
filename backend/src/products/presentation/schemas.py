from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from products.domain.product import Product


class ProductQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(default=1, ge=1, le=2_147_483_647)
    size: int = Field(default=20, ge=1, le=100)
    q: str | None = Field(
        default=None, max_length=100,
        description="상품명·아티스트 한글/영문명 부분 검색. 생략하면 전체, 공백이면 빈 결과. %/_는 문자 그대로 검색합니다.",
    )
    artist: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=100)
    sort: Literal["latest", "price_asc", "price_desc"] = "latest"
    exclude_id: int | None = Field(default=None, ge=1, le=9_223_372_036_854_775_807)


class ArtistRef(BaseModel):
    slug: str
    name: str
    name_ko: str


class CategoryRef(BaseModel):
    slug: str
    name: str


class ProductSummary(BaseModel):
    id: int
    name: str
    price: int
    status: Literal["on_sale", "sold_out"]
    is_sold_out: bool
    thumbnail_path: str | None
    artist: ArtistRef
    category: CategoryRef
    is_limited: bool
    is_preorder: bool
    release_date: date | None
    created_at: datetime


class VariantResponse(BaseModel):
    id: int
    option_name: str
    extra_price: int
    price: int
    stock: int
    max_per_user: int | None
    is_sold_out: bool


class ProductDetail(ProductSummary):
    description: str | None
    gallery_paths: list[str]
    detail_paths: list[str]
    variants: list[VariantResponse]
    has_options: bool


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    slug: str


def summary(product: Product) -> ProductSummary:
    return ProductSummary(
        id=product.id, name=product.name, price=product.price, status=product.status,
        is_sold_out=product.is_sold_out, thumbnail_path=product.thumbnail_path,
        artist=ArtistRef(slug=product.artist_slug, name=product.artist_name, name_ko=product.artist_name_ko),
        category=CategoryRef(slug=product.category_slug, name=product.category_name),
        is_limited=product.is_limited, is_preorder=product.is_preorder,
        release_date=product.release_date, created_at=product.created_at,
    )


def detail(product: Product) -> ProductDetail:
    return ProductDetail(
        **summary(product).model_dump(), description=product.description,
        gallery_paths=[path for kind, path in product.images if kind == "gallery"],
        detail_paths=[path for kind, path in product.images if kind == "detail"],
        has_options=product.has_options,
        variants=[VariantResponse(
            id=v.id, option_name=v.option_name, extra_price=v.extra_price,
            price=product.price + v.extra_price, stock=v.stock,
            max_per_user=v.max_per_user, is_sold_out=v.stock == 0,
        ) for v in product.variants],
    )
