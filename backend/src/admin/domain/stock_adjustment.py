"""관리자 재고 조정 요청 규칙 (순수 Python).

- 재고 자체의 규칙(0 미만 불가)은 P2 상품 도메인의 increase_stock / decrease_stock이 담당한다.
- 이 모듈은 "관리자가 보낸 조정 요청이 올바른가"와 조정 결과의 모양만 다룬다.
- FastAPI·SQLAlchemy·Pydantic을 import하지 않는다 (docs/PROJECT2.md 구조 계약).
"""

from dataclasses import dataclass

MIN_CHANGE = -10_000
MAX_CHANGE = 10_000
MAX_REASON_LENGTH = 100


class AdminDomainError(Exception):
    """관리자 도메인 예외의 기본형. 표현 계층이 HTTP 상태와 {code, message}로 바꾼다."""

    message = "요청을 처리할 수 없어요."

    def __init__(self, message: str | None = None):
        super().__init__(message or self.message)
        self.message = message or self.message


class InvalidStockAdjustment(AdminDomainError):
    """조정 수량·사유가 규칙에 맞지 않음 → 422."""

    message = "재고 조정 값을 확인해주세요."


class ProductNotFound(AdminDomainError):
    """없는 상품 → 404."""

    message = "상품을 찾을 수 없어요."


class VariantNotFound(AdminDomainError):
    """없는 옵션이거나 다른 상품의 옵션 → 404."""

    message = "옵션을 찾을 수 없어요."


@dataclass(frozen=True)
class StockAdjustment:
    """관리자 재고 조정 요청. 재고를 '몇 개로'가 아니라 '몇 개 늘리거나 줄일지(증감)'로 받는다."""

    change: int
    reason: str | None = None

    def __post_init__(self) -> None:
        # bool은 int의 하위 타입이라 True가 1로 통과하지 않도록 막는다.
        if isinstance(self.change, bool) or not isinstance(self.change, int):
            raise InvalidStockAdjustment("조정 수량은 정수여야 해요.")
        if self.change == 0:
            raise InvalidStockAdjustment("조정 수량은 0이 될 수 없어요.")
        if not MIN_CHANGE <= self.change <= MAX_CHANGE:
            raise InvalidStockAdjustment(
                f"조정 수량은 {MIN_CHANGE}~{MAX_CHANGE} 사이여야 해요."
            )

        reason = self.reason.strip() if isinstance(self.reason, str) else self.reason
        if reason is not None and not isinstance(reason, str):
            raise InvalidStockAdjustment("사유는 문자열이어야 해요.")
        if reason is not None and len(reason) > MAX_REASON_LENGTH:
            raise InvalidStockAdjustment(f"사유는 {MAX_REASON_LENGTH}자 이하로 적어주세요.")
        # 빈 사유는 없음(None)으로 통일한다.
        object.__setattr__(self, "reason", reason or None)

    @property
    def is_increase(self) -> bool:
        return self.change > 0

    @property
    def quantity(self) -> int:
        """P2 increase_stock / decrease_stock에 넘길 양수 수량."""
        return abs(self.change)


@dataclass(frozen=True)
class StockAdjustmentResult:
    """조정 결과. 응답 {variant_id, before, after, change}의 원본."""

    variant_id: int
    before: int
    after: int

    def __post_init__(self) -> None:
        if self.before < 0 or self.after < 0:
            raise InvalidStockAdjustment("재고는 0보다 작을 수 없어요.")
        if self.before == self.after:
            raise InvalidStockAdjustment("조정 전후 재고가 같아요.")

    @property
    def change(self) -> int:
        return self.after - self.before


def ensure_variant_in_product(product_id: int, variant_product_id: int | None) -> None:
    """옵션이 요청한 상품에 속하는지 확인한다. 아니면 다른 상품의 옵션 id로 보고 404."""
    if variant_product_id is None or variant_product_id != product_id:
        raise VariantNotFound()
