# [application] 관리자 배송도 사용자 → 주문 순서로 잠그고 한 번만 확정한다.
from datetime import datetime, timezone
from typing import Protocol
from uuid import UUID

from orders.application.ports import OrderRepositoryPort, TransactionPort
from orders.domain.exceptions import OrderNotFound
from orders.domain.order import Order
from orders.domain.shipping import Shipment


class AdminOrderPort(OrderRepositoryPort, Protocol):
    async def list_admin(self, status, shipping_status, keyword, page, size) -> tuple[list[Order], int]: ...
    async def shipment(self, order_id: UUID) -> Shipment: ...
    async def save_shipment(self, order_id: UUID, shipment: Shipment, actor_id: UUID) -> None: ...


class AdminOrderService:
    def __init__(self, repository: AdminOrderPort, transaction: TransactionPort):
        self._repository, self._transaction = repository, transaction

    async def list(self, status, shipping_status, keyword, page, size):
        orders, total = await self._repository.list_admin(status, shipping_status, keyword, page, size)
        return [(order, await self._repository.shipment(order.id)) for order in orders], total

    async def advance(self, order_id: UUID, actor_id: UUID, target: str):
        try:
            order = await self._repository.get(order_id)
            if order is None:
                raise OrderNotFound("주문을 찾을 수 없어요.")
            # 결제·취소와 같은 순서로 직렬화해 발송과 취소가 동시에 성공하는 일을 막는다.
            await self._repository.lock_owner(order.user_id)
            order = await self._repository.get_for_update(order_id)
            if order is None:
                raise OrderNotFound("주문을 찾을 수 없어요.")
            shipment = await self._repository.shipment(order_id)
            shipment.advance(order.status.value, target, datetime.now(timezone.utc))
            await self._repository.save_shipment(order_id, shipment, actor_id)
            await self._transaction.commit()
            return order, shipment
        except BaseException:
            await self._transaction.rollback()
            raise
