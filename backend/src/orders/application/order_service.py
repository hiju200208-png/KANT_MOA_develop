# [application] 주문 서비스: 주문 생성·바로 구매·모의 결제·취소·조회. 업무 하나 = 트랜잭션 하나, 실패하면 전부 rollback.
# 잠금 순서는 모든 쓰기에서 같다: 회원 행 → 주문 행 → 옵션 id 오름차순 (데드락 방지, p3-orders skill 4장)
from collections.abc import Callable
from datetime import datetime, timezone
from uuid import UUID

from orders.application.ports import CartRepositoryPort, OrderRepositoryPort, StockPort, TransactionPort
from orders.domain.checkout import Recipient, draft_direct, draft_from_cart, ensure_payable
from orders.domain.exceptions import OrderNotFound
from orders.domain.order import Order


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class OrderService:
    def __init__(self, orders: OrderRepositoryPort, cart: CartRepositoryPort, stock: StockPort,
                 transaction: TransactionPort, now: Callable[[], datetime] = _utc_now):
        self._orders = orders
        self._cart = cart  # 장바구니·옵션 판매 정보·이미 결제한 수량을 읽는 데 쓴다
        self._stock = stock
        self._transaction = transaction
        self._now = now

    async def _get_owned(self, user_id: UUID, order_id: UUID, *, lock: bool) -> Order:
        """주문을 찾고 본인 것인지 확인한다. 없으면 404, 남의 것이면 403용 예외."""
        order = await (self._orders.get_for_update(order_id) if lock else self._orders.get(order_id))
        if order is None:
            raise OrderNotFound("주문을 찾을 수 없어요.")
        order.ensure_owned_by(user_id)
        return order

    async def create_from_cart(self, user_id: UUID, recipient: Recipient) -> Order:
        """장바구니 전체로 결제 대기(pending) 주문을 만든다. 재고는 빼지 않고 장바구니도 그대로 둔다."""
        try:
            await self._orders.lock_owner(user_id)
            lines = await self._cart.list_lines(user_id)
            paid = {line.variant.variant_id: await self._cart.paid_quantity(user_id, line.variant.variant_id)
                    for line in lines}
            draft = draft_from_cart(recipient, lines, paid, await self._orders.shipping_policy())
            order = await self._orders.add(user_id, draft)
            await self._transaction.commit()
            return order
        except BaseException:
            await self._transaction.rollback()
            raise

    async def create_direct(self, user_id: UUID, recipient: Recipient, variant_id: int, quantity: int) -> Order:
        """옵션 하나만 바로 구매 주문(pending, is_direct)으로 만든다. 장바구니와 상관없다."""
        try:
            await self._orders.lock_owner(user_id)
            variant = await self._cart.get_variant(variant_id)
            already_paid = await self._cart.paid_quantity(user_id, variant_id)
            draft = draft_direct(recipient, variant, quantity, already_paid, await self._orders.shipping_policy())
            order = await self._orders.add(user_id, draft)
            await self._transaction.commit()
            return order
        except BaseException:
            await self._transaction.rollback()
            raise

    async def pay(self, user_id: UUID, order_id: UUID) -> Order:
        """모의 결제: 최종 검사 → 재고 차감 → paid → (장바구니 주문이면) 결제한 옵션만 장바구니에서 뺀다.

        중간 어디서 실패해도 rollback되어 주문은 pending, 재고·장바구니는 그대로 남는다.
        """
        try:
            await self._orders.lock_owner(user_id)
            order = await self._get_owned(user_id, order_id, lock=True)
            # 상태부터 본다: pending이 아니면 재고를 건드리기 전에 INVALID_ORDER로 끝낸다 (연타·이중 결제 방지).
            order.pay(self._now())
            quantities = order.quantities
            variant_ids = sorted(quantities)
            await self._stock.lock(variant_ids)
            # 옵션을 잠근 뒤에 읽으므로 판매 상태·구매 제한은 최신 값이다.
            variants = await self._cart.get_variants(variant_ids)
            for variant_id in variant_ids:
                already_paid = await self._cart.paid_quantity(user_id, variant_id)
                ensure_payable(variants.get(variant_id), quantities[variant_id], already_paid)
            for variant_id in variant_ids:
                await self._stock.decrease(variant_id, quantities[variant_id])
            await self._orders.save_status(order)
            if not order.is_direct:
                # 규칙: 결제된 옵션만 장바구니에서 뺀다. 바로 구매는 장바구니를 건드리지 않는다.
                for variant_id in variant_ids:
                    await self._cart.delete_item(user_id, variant_id)
            await self._transaction.commit()
            return order
        except BaseException:
            await self._transaction.rollback()
            raise

    async def cancel(self, user_id: UUID, order_id: UUID) -> Order:
        """주문 취소. 결제 대기 주문은 상태만, 결제 완료 주문은 재고도 한 번 되돌린다."""
        try:
            await self._orders.lock_owner(user_id)
            order = await self._get_owned(user_id, order_id, lock=True)
            needs_restore = order.cancel(self._now())
            if needs_restore:
                quantities = order.quantities
                variant_ids = sorted(quantities)
                await self._stock.lock(variant_ids)
                # 상품이 그 사이 숨김·품절이 됐어도 재고는 되돌린다 (상품 상태는 바꾸지 않음).
                for variant_id in variant_ids:
                    await self._stock.increase(variant_id, quantities[variant_id])
            await self._orders.save_status(order)
            await self._transaction.commit()
            return order
        except BaseException:
            await self._transaction.rollback()
            raise

    async def get(self, user_id: UUID, order_id: UUID) -> Order:
        return await self._get_owned(user_id, order_id, lock=False)

    async def list(self, user_id: UUID, status: str | None, keyword: str | None,
                   page: int, size: int) -> tuple[list[Order], int]:
        return await self._orders.list_by_user(user_id, status, keyword, page, size)
