# [domain] 장바구니: 담을 수 있는지 판단, 비회원 병합 상한, 합계 계산
# 담기 단계의 재고·구매 제한 검사는 '안내용'이다. 실제 재고 차감과 최종 검증은 결제 단계에서 다시 한다.
from dataclasses import dataclass

from orders.domain.exceptions import (
    InvalidCartQuantity,
    OutOfStock,
    PurchaseLimitExceeded,
    VariantNotFound,
    VariantUnavailable,
)

# 규칙: 옵션 한 줄에 담을 수 있는 최대 수량 (서버가 정한 상한, 실제 한도는 재고·구매 제한이 더 작다)
MAX_QUANTITY = 99
# 규칙: 비회원 장바구니를 한 번에 합칠 수 있는 최대 줄 수
MAX_MERGE_ITEMS = 50

ON_SALE = "on_sale"
HIDDEN = "hidden"


@dataclass(frozen=True)
class CartVariant:
    """담으려는 옵션의 현재 판매 정보 (P2 상품·옵션 테이블에서 읽은 값)."""

    variant_id: int
    product_id: int
    product_name: str
    thumbnail_path: str | None
    option_name: str
    unit_price: int  # 상품 기본가 + 옵션 추가금
    stock: int
    max_per_user: int | None  # None = 무제한
    product_status: str  # on_sale / sold_out / hidden

    @property
    def is_hidden(self) -> bool:
        return self.product_status == HIDDEN

    @property
    def is_on_sale(self) -> bool:
        return self.product_status == ON_SALE


@dataclass(frozen=True)
class CartLine:
    """장바구니 한 줄 = 옵션 + 담은 수량."""

    variant: CartVariant
    quantity: int

    @property
    def is_available(self) -> bool:
        """규칙: 판매 중이고 재고가 담은 수량 이상이어야 지금 주문할 수 있다."""
        return self.variant.is_on_sale and self.variant.stock >= self.quantity

    @property
    def line_price(self) -> int:
        return self.variant.unit_price * self.quantity


@dataclass(frozen=True)
class Cart:
    lines: list[CartLine]

    @property
    def total_quantity(self) -> int:
        """헤더 뱃지용: 보이는 모든 줄의 수량 합."""
        return sum(line.quantity for line in self.lines)

    @property
    def total_price(self) -> int:
        """규칙: 표시용 합계는 지금 주문할 수 있는 줄만 더한다."""
        return sum(line.line_price for line in self.lines if line.is_available)


def build_cart(lines: list[CartLine]) -> Cart:
    """규칙: 숨김 상품은 장바구니 화면에서 뺀다 (DB 행은 남겨서 다시 공개되면 보인다)."""
    return Cart([line for line in lines if not line.variant.is_hidden])


def validate_quantity(quantity: int) -> None:
    """규칙: 수량은 1개 이상, MAX_QUANTITY 이하의 정수."""
    if isinstance(quantity, bool) or not isinstance(quantity, int) or not 1 <= quantity <= MAX_QUANTITY:
        raise InvalidCartQuantity(f"수량은 1~{MAX_QUANTITY}개 사이로 입력해주세요.")


def ensure_visible(variant: CartVariant | None) -> CartVariant:
    """없는 옵션이나 숨김 상품은 '없는 상품'으로 다룬다."""
    if variant is None or variant.is_hidden:
        raise VariantNotFound("판매하지 않는 상품이에요.")
    return variant


def ensure_can_hold(variant: CartVariant, quantity: int, already_paid: int) -> None:
    """장바구니에 quantity개를 둘 수 있는지 확인한다 (안내용 검사).

    규칙 순서: 판매 중인지 → 재고가 충분한지 → 1인 구매 제한(이미 결제한 수량 포함)을 넘지 않는지
    """
    validate_quantity(quantity)
    if not variant.is_on_sale:
        raise VariantUnavailable(f"'{variant.product_name} {variant.option_name}'은(는) 지금 판매하지 않아요.")
    if quantity > variant.stock:
        raise OutOfStock(f"'{variant.product_name} {variant.option_name}'의 재고가 부족해요. (남은 수량 {variant.stock}개)")
    if variant.max_per_user is not None and already_paid + quantity > variant.max_per_user:
        raise PurchaseLimitExceeded(
            f"'{variant.product_name} {variant.option_name}'은(는) 1인당 {variant.max_per_user}개까지 살 수 있어요."
        )


def merge_cap(variant: CartVariant | None) -> int:
    """비회원 장바구니를 합칠 때 이 옵션에 담을 수 있는 최대 수량.

    규칙: 판매 중이 아니거나 없는 옵션은 0 (건너뜀), 그 외에는 min(재고, 구매 제한, MAX_QUANTITY).
    예전 merge_cart RPC와 같은 기준이다.
    """
    if variant is None or not variant.is_on_sale:
        return 0
    limit = variant.max_per_user if variant.max_per_user is not None else variant.stock
    return max(0, min(variant.stock, limit, MAX_QUANTITY))


def merged_quantity(existing: int, incoming: int, cap: int) -> int:
    """규칙: 이미 담긴 수량 + 비회원 수량을 더하되 상한을 넘지 않는다."""
    return min(existing + incoming, cap)


def combine_guest_items(items: list[tuple[int, int]]) -> dict[int, int]:
    """비회원 장바구니에 같은 옵션이 여러 줄 있으면 수량을 합치고, 0 이하 수량 줄은 버린다."""
    if len(items) > MAX_MERGE_ITEMS:
        raise InvalidCartQuantity(f"한 번에 합칠 수 있는 장바구니는 {MAX_MERGE_ITEMS}줄까지예요.")
    combined: dict[int, int] = {}
    for variant_id, quantity in items:
        if quantity > 0:
            combined[variant_id] = combined.get(variant_id, 0) + quantity
    return combined
