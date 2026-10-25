"""응용 계층이 바깥(P2 상품 저장소·DB 트랜잭션)에 기대하는 모양.

실제 구현은 infrastructure에서 P2 함수로 연결한다 (팀 합의 10/25):
- 잠금 조회는 P2 repository의 get_variants_for_update(variant_ids) 한 곳만 사용
  (with_for_update(), 여러 옵션은 id 오름차순으로 잠금)
- 재고 증감은 P2 상품 도메인의 increase_stock / decrease_stock만 사용 (0 미만 불가 규칙도 P2)
"""

from typing import Protocol


class LockedVariant(Protocol):
    """잠금 조회된 옵션. P2 모델/도메인 객체가 이 속성만 가지면 된다."""

    id: int
    product_id: int
    stock: int


class VariantStockPort(Protocol):
    async def lock_variant(self, variant_id: int) -> LockedVariant | None:
        """옵션 행을 FOR UPDATE로 잠그고 가져온다. 없으면 None."""

    async def increase_stock(self, variant: LockedVariant, quantity: int) -> int:
        """P2 increase_stock 적용 후 저장(flush). 바뀐 재고를 돌려준다."""

    async def decrease_stock(self, variant: LockedVariant, quantity: int) -> int:
        """P2 decrease_stock 적용 후 저장(flush). 재고 부족이면 P2 예외를 그대로 올린다."""


class TransactionPort(Protocol):
    async def commit(self) -> None: ...

    async def rollback(self) -> None: ...
