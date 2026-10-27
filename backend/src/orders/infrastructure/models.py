# [infrastructure] P3 테이블 ORM 매핑: 001_create_tables.sql에 이미 있는 테이블과 똑같이 맞춘다. DDL 실행 없음.
# 다른 담당 테이블(users: P1, product_variants: P2)을 가리키는 FK는 DB에만 있고 여기서는 선언하지 않는다.
# (그 ORM 모델이 함께 import되지 않으면 저장할 때 '참조 테이블을 찾을 수 없음' 오류가 나기 때문. P1 병합 후 다시 맞춘다)
from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Identity, Index, Integer, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class AddressModel(Base):
    """배송지 (addresses). 주문은 주소를 문자열로 따로 저장하므로 orders와 FK가 없다."""

    __tablename__ = "addresses"
    __table_args__ = (
        # 규칙: 사용자마다 기본 배송지는 최대 1개 (DB 부분 UNIQUE 인덱스와 같은 이름·조건)
        Index("addresses_one_default_per_user", "user_id", unique=True, postgresql_where=text("is_default")),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True))
    label: Mapped[str | None] = mapped_column(Text)
    recipient_name: Mapped[str] = mapped_column(Text)
    recipient_phone: Mapped[str] = mapped_column(Text)
    postal_code: Mapped[str] = mapped_column(Text)
    address1: Mapped[str] = mapped_column(Text)
    address2: Mapped[str | None] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class CartItemModel(Base):
    """장바구니 한 줄 (cart_items). 사용자·옵션 조합은 하나뿐이다."""

    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("user_id", "variant_id"), CheckConstraint("quantity > 0"))

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True))
    variant_id: Mapped[int] = mapped_column(BigInteger)
    quantity: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


class OrderModel(Base):
    """주문 (orders). 받는 분·주소는 주문 당시 값을 문자열로 저장한다 (배송지를 고쳐도 지난 주문은 그대로)."""

    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("status in ('pending', 'paid', 'cancelled')"),
        CheckConstraint("total_price >= 0"),
        CheckConstraint("shipping_fee >= 0"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True))
    status: Mapped[str] = mapped_column(Text, server_default=text("'pending'"))
    total_price: Mapped[int] = mapped_column(Integer)
    recipient_name: Mapped[str] = mapped_column(Text)
    recipient_phone: Mapped[str] = mapped_column(Text)
    address: Mapped[str] = mapped_column(Text)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    shipping_fee: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    is_direct: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))


class OrderItemModel(Base):
    """주문 상품 (order_items). 상품명·옵션명·단가는 주문 당시 값을 복사해 둔다 (스냅샷)."""

    __tablename__ = "order_items"
    __table_args__ = (
        UniqueConstraint("order_id", "variant_id"),
        CheckConstraint("unit_price >= 0"),
        CheckConstraint("quantity > 0"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    order_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"))
    variant_id: Mapped[int] = mapped_column(BigInteger)
    product_name: Mapped[str] = mapped_column(Text)
    option_name: Mapped[str] = mapped_column(Text)
    unit_price: Mapped[int] = mapped_column(Integer)
    quantity: Mapped[int] = mapped_column(Integer)
