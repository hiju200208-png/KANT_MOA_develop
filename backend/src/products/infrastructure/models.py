"""001_create_tables.sql과 동일한 기존 테이블 매핑. DDL 실행 없음."""

from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Identity, Integer, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class ArtistModel(Base):
    __tablename__ = "artists"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    name_ko: Mapped[str] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(Text, unique=True)
    logo_path: Mapped[str | None] = mapped_column(Text)
    hero_image_path: Mapped[str | None] = mapped_column(Text)
    theme_color: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    tagline: Mapped[str | None] = mapped_column(Text)


class CategoryModel(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(Text, unique=True)
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))


class ProductModel(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("price >= 0"),
        CheckConstraint("status in ('on_sale', 'sold_out', 'hidden')"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    name: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text, server_default=text("'on_sale'"))
    thumbnail_path: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    is_limited: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    is_preorder: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    release_date: Mapped[date | None]


class ProductVariantModel(Base):
    __tablename__ = "product_variants"
    __table_args__ = (
        UniqueConstraint("product_id", "option_name"),
        CheckConstraint("extra_price >= 0"),
        CheckConstraint("stock >= 0"),
        CheckConstraint("max_per_user is null or max_per_user > 0"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    option_name: Mapped[str] = mapped_column(Text, server_default=text("'기본'"))
    extra_price: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    stock: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    # 명시적인 None은 무제한(NULL), 생략은 기본값 4로 저장한다.
    max_per_user: Mapped[int | None] = mapped_column(Integer().evaluates_none(), server_default=text("4"))
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"))


class ProductImageModel(Base):
    __tablename__ = "product_images"
    __table_args__ = (CheckConstraint("kind in ('gallery', 'detail')"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    image_path: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    kind: Mapped[str] = mapped_column(Text, server_default=text("'detail'"))
