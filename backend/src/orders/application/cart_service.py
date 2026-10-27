# [application] 장바구니 서비스: 담기·수량 변경·삭제·비회원 병합. 변경 후에는 갱신된 장바구니 전체를 돌려준다.
# 여기서는 재고를 바꾸지 않는다 (재고 차감은 결제 단계에서 P2 함수로만 한다).
from uuid import UUID

from orders.application.ports import CartRepositoryPort, TransactionPort
from orders.domain.cart import (
    Cart,
    CartLine,
    build_cart,
    combine_guest_items,
    ensure_can_hold,
    ensure_visible,
    merge_cap,
    merged_quantity,
    validate_quantity,
)
from orders.domain.exceptions import CartItemNotFound


class CartService:
    def __init__(self, cart: CartRepositoryPort, transaction: TransactionPort):
        self._cart = cart
        self._transaction = transaction

    async def get_cart(self, user_id: UUID) -> Cart:
        return build_cart(await self._cart.list_lines(user_id))

    async def preview(self, items: list[tuple[int, int]]) -> Cart:
        """비회원 장바구니·바로 구매 주문서용: 로그인 없이 옵션 정보를 장바구니 모양으로 보여준다 (저장하지 않음).

        규칙: 같은 옵션은 수량을 합치고 0 이하 줄은 버린다. 없는 옵션·숨김 상품은 회원 장바구니처럼 뺀다.
        """
        combined = combine_guest_items(items)
        variants = await self._cart.get_variants(sorted(combined))
        return build_cart([CartLine(variants[v], q) for v, q in combined.items() if v in variants])

    async def _check_and_set(self, user_id: UUID, variant_id: int, quantity: int) -> None:
        """옵션을 다시 읽어 담을 수 있는지 확인한 뒤 수량을 저장한다."""
        variant = ensure_visible(await self._cart.get_variant(variant_id))
        already_paid = await self._cart.paid_quantity(user_id, variant_id)
        ensure_can_hold(variant, quantity, already_paid)
        await self._cart.set_quantity(user_id, variant_id, quantity)

    async def add(self, user_id: UUID, variant_id: int, quantity: int) -> Cart:
        """규칙: 이미 담긴 옵션이면 수량을 더한다. 더한 결과로 재고·구매 제한을 확인한다."""
        validate_quantity(quantity)
        try:
            await self._cart.lock_owner(user_id)
            current = await self._cart.get_quantity(user_id, variant_id) or 0
            await self._check_and_set(user_id, variant_id, current + quantity)
            cart = await self.get_cart(user_id)
            await self._transaction.commit()
            return cart
        except BaseException:
            await self._transaction.rollback()
            raise

    async def change_quantity(self, user_id: UUID, variant_id: int, quantity: int) -> Cart:
        """장바구니에 있는 옵션의 수량을 quantity로 바꾼다 (더하지 않고 덮어씀)."""
        validate_quantity(quantity)
        try:
            await self._cart.lock_owner(user_id)
            if await self._cart.get_quantity(user_id, variant_id) is None:
                raise CartItemNotFound("장바구니에 없는 상품이에요.")
            await self._check_and_set(user_id, variant_id, quantity)
            cart = await self.get_cart(user_id)
            await self._transaction.commit()
            return cart
        except BaseException:
            await self._transaction.rollback()
            raise

    async def remove(self, user_id: UUID, variant_id: int) -> Cart:
        try:
            await self._cart.lock_owner(user_id)
            if not await self._cart.delete_item(user_id, variant_id):
                raise CartItemNotFound("장바구니에 없는 상품이에요.")
            cart = await self.get_cart(user_id)
            await self._transaction.commit()
            return cart
        except BaseException:
            await self._transaction.rollback()
            raise

    async def merge_guest(self, user_id: UUID, items: list[tuple[int, int]]) -> Cart:
        """로그인 직후 브라우저(비회원) 장바구니를 서버 장바구니에 합친다.

        규칙(예전 merge_cart와 같음): 같은 옵션은 수량을 더하고, 옵션별 상한 min(재고, 구매 제한)을 넘지 않는다.
        판매 중이 아니거나 없는 옵션은 오류 없이 건너뛴다 (로그인 흐름이 막히지 않게).
        """
        combined = combine_guest_items(items)
        try:
            await self._cart.lock_owner(user_id)
            variants = await self._cart.get_variants(sorted(combined))
            for variant_id, incoming in combined.items():
                cap = merge_cap(variants.get(variant_id))
                if cap <= 0:
                    continue
                existing = await self._cart.get_quantity(user_id, variant_id) or 0
                await self._cart.set_quantity(user_id, variant_id, merged_quantity(existing, incoming, cap))
            cart = await self.get_cart(user_id)
            await self._transaction.commit()
            return cart
        except BaseException:
            await self._transaction.rollback()
            raise
