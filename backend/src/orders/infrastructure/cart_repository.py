# [infrastructure] 장바구니 저장소: cart_items + P2 상품·옵션 정보를 읽어 도메인 객체로 바꾼다. commit하지 않는다.
# 상품·옵션은 P2 ORM 모델을 읽기 전용으로만 쓴다 (재고·상태를 바꾸지 않음).
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from orders.domain.cart import CartLine, CartVariant
from orders.infrastructure.locks import lock_user
from orders.infrastructure.models import CartItemModel, OrderItemModel, OrderModel
from products.infrastructure.models import ProductModel, ProductVariantModel

# 옵션 판매 정보를 한 번에 읽는 조회 (옵션 + 상품)
_VARIANT_COLUMNS = (
    ProductVariantModel.id,
    ProductVariantModel.product_id,
    ProductModel.name,
    ProductModel.thumbnail_path,
    ProductVariantModel.option_name,
    (ProductModel.price + ProductVariantModel.extra_price).label("unit_price"),
    ProductVariantModel.stock,
    ProductVariantModel.max_per_user,
    ProductModel.status,
)


def _variant_query():
    return select(*_VARIANT_COLUMNS).join(ProductModel, ProductModel.id == ProductVariantModel.product_id)


def _to_variant(row) -> CartVariant:
    return CartVariant(
        variant_id=row.id,
        product_id=row.product_id,
        product_name=row.name,
        thumbnail_path=row.thumbnail_path,
        option_name=row.option_name,
        unit_price=int(row.unit_price),
        stock=row.stock,
        max_per_user=row.max_per_user,
        product_status=row.status,
    )


class CartRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def lock_owner(self, user_id: UUID) -> None:
        """같은 사람의 장바구니 변경을 한 줄로 세운다 (같은 옵션 동시 담기 시 수량 덮어쓰기 방지)."""
        await lock_user(self._session, user_id)

    async def list_lines(self, user_id: UUID) -> list[CartLine]:
        """내 장바구니 전체 (담은 순서대로). 숨김 상품 제외는 도메인 build_cart가 한다."""
        query = (
            _variant_query()
            .add_columns(CartItemModel.quantity)
            .join(CartItemModel, CartItemModel.variant_id == ProductVariantModel.id)
            .where(CartItemModel.user_id == user_id)
            .order_by(CartItemModel.created_at, CartItemModel.id)
        )
        rows = (await self._session.execute(query)).all()
        return [CartLine(_to_variant(row), row.quantity) for row in rows]

    async def get_variant(self, variant_id: int) -> CartVariant | None:
        row = (await self._session.execute(_variant_query().where(ProductVariantModel.id == variant_id))).first()
        return _to_variant(row) if row else None

    async def get_variants(self, variant_ids: list[int]) -> dict[int, CartVariant]:
        if not variant_ids:
            return {}
        rows = (await self._session.execute(_variant_query().where(ProductVariantModel.id.in_(variant_ids)))).all()
        return {row.id: _to_variant(row) for row in rows}

    async def get_quantity(self, user_id: UUID, variant_id: int) -> int | None:
        query = select(CartItemModel.quantity).where(CartItemModel.user_id == user_id,
                                                     CartItemModel.variant_id == variant_id)
        return (await self._session.execute(query)).scalar_one_or_none()

    async def paid_quantity(self, user_id: UUID, variant_id: int) -> int:
        """규칙(구매 제한): 내가 이미 결제(paid)한 이 옵션의 수량 합. 결제 대기·취소 주문은 세지 않는다."""
        query = (
            select(func.coalesce(func.sum(OrderItemModel.quantity), 0))
            .join(OrderModel, OrderModel.id == OrderItemModel.order_id)
            .where(OrderModel.user_id == user_id, OrderModel.status == "paid", OrderItemModel.variant_id == variant_id)
        )
        return int((await self._session.execute(query)).scalar_one())

    async def set_quantity(self, user_id: UUID, variant_id: int, quantity: int) -> None:
        """이 옵션의 장바구니 수량을 quantity로 맞춘다 (없으면 새 줄, 있으면 수량만 바꿈)."""
        statement = insert(CartItemModel).values(user_id=user_id, variant_id=variant_id, quantity=quantity)
        statement = statement.on_conflict_do_update(
            index_elements=[CartItemModel.user_id, CartItemModel.variant_id],
            set_={"quantity": statement.excluded.quantity},
        )
        await self._session.execute(statement)

    async def delete_item(self, user_id: UUID, variant_id: int) -> bool:
        result = await self._session.execute(
            delete(CartItemModel)
            .where(CartItemModel.user_id == user_id, CartItemModel.variant_id == variant_id)
            .returning(CartItemModel.id)
        )
        return result.scalar_one_or_none() is not None
