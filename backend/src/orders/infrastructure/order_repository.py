# [infrastructure] 주문 저장소: orders + order_items를 읽고 써서 도메인 Order로 바꾼다. commit하지 않는다.
from uuid import UUID

from sqlalchemy import func, insert, select, text, update, or_, cast, Text
from sqlalchemy.ext.asyncio import AsyncSession

from orders.domain.checkout import OrderDraft, ShippingPolicy
from orders.domain.order import Order, OrderItem
from orders.infrastructure.locks import lock_user
from orders.infrastructure.shipping_model import ShipmentModel
from orders.domain.shipping import Shipment
from orders.infrastructure.models import OrderItemModel, OrderModel


def _escape_like(keyword: str) -> str:
    """검색어의 %, _ 를 글자 그대로 찾도록 바꾼다."""
    return keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _to_order(row: OrderModel, items: list[OrderItemModel]) -> Order:
    return Order(
        id=row.id,
        user_id=row.user_id,
        total_price=row.total_price,
        status=row.status,
        paid_at=row.paid_at,
        cancelled_at=row.cancelled_at,
        shipping_fee=row.shipping_fee,
        is_direct=row.is_direct,
        recipient_name=row.recipient_name,
        recipient_phone=row.recipient_phone,
        address=row.address,
        created_at=row.created_at,
        items=[OrderItem(variant_id=i.variant_id, product_name=i.product_name, option_name=i.option_name,
                         unit_price=i.unit_price, quantity=i.quantity) for i in items],
    )


class OrderRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def lock_owner(self, user_id: UUID) -> None:
        """같은 사람의 주문·결제·취소를 한 줄로 세운다 (동시 결제로 구매 제한을 넘는 것 방지)."""
        await lock_user(self._session, user_id)

    async def shipping_policy(self) -> ShippingPolicy | None:
        """배송비 설정을 읽기만 한다 (shop_settings는 한 줄뿐인 쇼핑몰 설정 테이블)."""
        row = (await self._session.execute(
            text("SELECT free_shipping_threshold, shipping_fee FROM shop_settings LIMIT 1"))).first()
        return ShippingPolicy(row.free_shipping_threshold, row.shipping_fee) if row else None

    async def _items(self, order_ids: list[UUID]) -> dict[UUID, list[OrderItemModel]]:
        grouped: dict[UUID, list[OrderItemModel]] = {order_id: [] for order_id in order_ids}
        if not order_ids:
            return grouped
        rows = (await self._session.scalars(
            select(OrderItemModel).where(OrderItemModel.order_id.in_(order_ids)).order_by(OrderItemModel.id))).all()
        for item in rows:
            grouped[item.order_id].append(item)
        return grouped

    async def add(self, user_id: UUID, draft: OrderDraft) -> Order:
        """새 주문(pending)과 주문 상품 스냅샷을 저장한다. 금액은 도메인이 계산한 값 그대로 쓴다."""
        order_id = (await self._session.execute(
            insert(OrderModel).values(
                user_id=user_id, total_price=draft.total_price, shipping_fee=draft.shipping_fee,
                recipient_name=draft.recipient.name, recipient_phone=draft.recipient.phone,
                address=draft.recipient.address, is_direct=draft.is_direct,
            ).returning(OrderModel.id))).scalar_one()
        await self._session.execute(insert(OrderItemModel), [
            {"order_id": order_id, "variant_id": item.variant_id, "product_name": item.product_name,
             "option_name": item.option_name, "unit_price": item.unit_price, "quantity": item.quantity}
            for item in draft.items
        ])
        order = await self.get(order_id)
        if order is None:  # 방금 같은 트랜잭션에서 넣은 주문이라 생기면 안 되는 일. 고객 오류로 숨기지 않는다.
            raise RuntimeError("저장한 주문을 다시 읽지 못했어요.")
        return order

    async def get(self, order_id: UUID) -> Order | None:
        row = await self._session.scalar(
            select(OrderModel).where(OrderModel.id == order_id).execution_options(populate_existing=True))
        if row is None:
            return None
        return _to_order(row, (await self._items([row.id]))[row.id])

    async def get_for_update(self, order_id: UUID) -> Order | None:
        """주문 행을 FOR UPDATE로 잠그고 최신 값을 읽는다 (같은 주문 이중 결제·이중 취소 방지)."""
        row = await self._session.scalar(
            select(OrderModel).where(OrderModel.id == order_id).with_for_update()
            .execution_options(populate_existing=True))
        if row is None:
            return None
        return _to_order(row, (await self._items([row.id]))[row.id])

    async def save_status(self, order: Order) -> None:
        """도메인이 바꾼 상태와 결제·취소 시각만 저장한다."""
        await self._session.execute(
            update(OrderModel).where(OrderModel.id == order.id)
            .values(status=order.status.value, paid_at=order.paid_at, cancelled_at=order.cancelled_at))

    async def list_by_user(self, user_id: UUID, status: str | None, keyword: str | None,
                           page: int, size: int) -> tuple[list[Order], int]:
        """내 주문 목록 (최신순). status로 거르고, keyword는 주문 상품명에서 찾는다."""
        conditions = [OrderModel.user_id == user_id]
        if status:
            conditions.append(OrderModel.status == status)
        if keyword:
            conditions.append(OrderModel.id.in_(
                select(OrderItemModel.order_id)
                .where(OrderItemModel.product_name.ilike(f"%{_escape_like(keyword)}%", escape="\\"))))
        total = (await self._session.execute(select(func.count()).select_from(OrderModel).where(*conditions))).scalar_one()
        rows = (await self._session.scalars(
            select(OrderModel).where(*conditions)
            .order_by(OrderModel.created_at.desc(), OrderModel.id.desc())
            .offset((page - 1) * size).limit(size))).all()
        items = await self._items([row.id for row in rows])
        return [_to_order(row, items[row.id]) for row in rows], total


    async def shipment(self, order_id):
        """기록이 없으면 아직 준비 중이다. 결제 전 주문은 표현 계층에서 배송 대상 아님으로 표시한다."""
        row = await self._session.scalar(select(ShipmentModel).where(ShipmentModel.order_id == order_id)
                                         .execution_options(populate_existing=True))
        return Shipment(row.status, row.shipped_at, row.delivered_at) if row else Shipment()

    async def has_dispatched(self, order_id):
        return (await self.shipment(order_id)).status in {"shipped", "delivered"}

    async def save_shipment(self, order_id, shipment, actor_id):
        # 호출자가 주문 행을 잠근 같은 세션에서만 저장하며 Repository는 commit하지 않는다.
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        values = dict(order_id=order_id, status=shipment.status, shipped_at=shipment.shipped_at,
                      delivered_at=shipment.delivered_at, updated_by=actor_id)
        statement = pg_insert(ShipmentModel).values(**values)
        await self._session.execute(statement.on_conflict_do_update(
            index_elements=[ShipmentModel.order_id], set_={k: v for k, v in values.items() if k != "order_id"}))

    async def list_admin(self, status, shipping_status, keyword, page, size):
        """관리자 전체 주문 목록. 검색·필터 이후 개수를 세고 최신순 페이지를 읽는다."""
        conditions = []
        if status:
            conditions.append(OrderModel.status == status)
        if shipping_status:
            conditions.append(OrderModel.status == "paid")
            if shipping_status == "preparing":
                conditions.append(ShipmentModel.order_id.is_(None))
            else:
                conditions.append(ShipmentModel.status == shipping_status)
        if keyword:
            pattern = f"%{_escape_like(keyword)}%"
            conditions.append(or_(OrderModel.recipient_name.ilike(pattern, escape="\\"),
                                  cast(OrderModel.id, Text).ilike(pattern, escape="\\"),
                                  OrderModel.id.in_(select(OrderItemModel.order_id).where(
                                      OrderItemModel.product_name.ilike(pattern, escape="\\")))))
        base = select(OrderModel).outerjoin(ShipmentModel, ShipmentModel.order_id == OrderModel.id).where(*conditions)
        total = (await self._session.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
        rows = (await self._session.scalars(base.order_by(OrderModel.created_at.desc(), OrderModel.id.desc())
                                            .offset((page - 1) * size).limit(size))).all()
        items = await self._items([row.id for row in rows])
        return [_to_order(row, items[row.id]) for row in rows], total
