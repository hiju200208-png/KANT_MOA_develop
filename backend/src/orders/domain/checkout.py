# [domain] 주문서 만들기: 받는 분 검사, 주문 가능 여부(안내용), 결제 직전 최종 검사, 배송비 계산
# 가격은 항상 서버가 DB에서 읽은 값으로 계산한다. 화면이 보낸 가격·합계는 쓰지 않는다.
import re
from dataclasses import dataclass

from orders.domain.cart import CartLine, CartVariant
from orders.domain.exceptions import (
    CartEmpty,
    InvalidOrderValue,
    InvalidRecipient,
    PurchaseLimitExceeded,
    VariantUnavailable,
)
from orders.domain.order import OrderItem

# 칸별 최대 글자 수. 주소는 기본주소(200)+상세주소(200)를 합친 문자열이라 넉넉하게 둔다.
MAX_RECIPIENT_NAME = 50
MAX_ORDER_ADDRESS = 401
# 규칙: 바로 구매 한 번에 살 수 있는 최대 수량 (장바구니 한 줄 상한과 같다)
MAX_DIRECT_QUANTITY = 99

# 규칙: 휴대폰 번호는 숫자만 남겼을 때 01로 시작하는 10~11자리 (배송지 검사와 같은 기준)
_PHONE = re.compile(r"01\d{8,9}")


@dataclass(frozen=True)
class Recipient:
    """주문서의 받는 분 정보. 주문에는 이 값이 문자열 그대로 저장된다 (배송지를 고쳐도 지난 주문은 그대로)."""

    name: str
    phone: str
    address: str

    def __post_init__(self) -> None:
        name = (self.name or "").strip()
        if not name or len(name) > MAX_RECIPIENT_NAME:
            raise InvalidRecipient(f"받는 분 이름은 1~{MAX_RECIPIENT_NAME}자로 입력해주세요.")
        phone = (self.phone or "").strip()
        if not _PHONE.fullmatch(re.sub(r"\D", "", phone)) or len(phone) > 20:
            raise InvalidRecipient("휴대폰 번호를 정확히 입력해주세요.")
        address = (self.address or "").strip()
        if not address or len(address) > MAX_ORDER_ADDRESS:
            raise InvalidRecipient("배송 주소를 입력해주세요.")
        # 값이 바뀌지 않는(frozen) 객체라서, 만들 때 정리한 값만 이 방법으로 넣는다.
        object.__setattr__(self, "name", name)
        object.__setattr__(self, "phone", phone)
        object.__setattr__(self, "address", address)


@dataclass(frozen=True)
class ShippingPolicy:
    """쇼핑몰 배송비 설정 (shop_settings)."""

    free_shipping_threshold: int
    shipping_fee: int


@dataclass(frozen=True)
class OrderDraft:
    """저장하기 전의 새 주문. 금액은 모두 여기서 계산이 끝난 값이다."""

    recipient: Recipient
    items: list[OrderItem]
    shipping_fee: int
    is_direct: bool

    @property
    def items_price(self) -> int:
        return sum(item.line_price for item in self.items)

    @property
    def total_price(self) -> int:
        """규칙: 실제 결제 금액 = 상품 금액 + 배송비."""
        return self.items_price + self.shipping_fee


def calc_shipping_fee(items_price: int, policy: ShippingPolicy | None) -> int:
    """규칙: 상품 금액이 무료배송 기준 이상이면 0원, 미만이면 배송비. 설정이 없으면 0원."""
    if policy is None or items_price >= policy.free_shipping_threshold:
        return 0
    return policy.shipping_fee


def validate_direct_quantity(quantity: int) -> None:
    """규칙: 바로 구매 수량은 1~MAX_DIRECT_QUANTITY개 정수. 벗어나면 INVALID_ORDER (예전 create_direct_order와 같다)."""
    if isinstance(quantity, bool) or not isinstance(quantity, int) or not 1 <= quantity <= MAX_DIRECT_QUANTITY:
        raise InvalidOrderValue(f"수량은 1~{MAX_DIRECT_QUANTITY}개 사이로 입력해주세요.")


def _label(variant: CartVariant) -> str:
    return f"'{variant.product_name} {variant.option_name}'"


def ensure_orderable(variant: CartVariant | None, quantity: int, already_paid: int) -> CartVariant:
    """주문서를 만들 때의 검사 (안내용, 최종 검사는 결제 때 한 번 더 한다).

    규칙(예전 create_order와 같음): 없거나 판매 중이 아니거나 재고가 모자라면 UNAVAILABLE_ITEM,
    이미 결제한 수량 + 이번 수량이 1인 구매 제한을 넘으면 PURCHASE_LIMIT_EXCEEDED.
    """
    if variant is None or not variant.is_on_sale or variant.stock < quantity:
        name = _label(variant) if variant is not None else "상품"
        raise VariantUnavailable(f"{name}은(는) 판매 중지되었거나 재고가 부족해요. 장바구니를 확인해주세요.")
    ensure_within_limit(variant, quantity, already_paid)
    return variant


def ensure_within_limit(variant: CartVariant, quantity: int, already_paid: int) -> None:
    """규칙: 옵션별로 이미 결제(paid)한 수량 + 이번 수량 <= max_per_user. None이면 제한 없음."""
    if variant.max_per_user is not None and already_paid + quantity > variant.max_per_user:
        raise PurchaseLimitExceeded(f"{_label(variant)}은(는) 1인당 {variant.max_per_user}개까지 살 수 있어요.")


def ensure_payable(variant: CartVariant | None, quantity: int, already_paid: int) -> None:
    """결제 직전 최종 검사. 옵션은 이미 잠근 뒤라 최신 값이다.

    규칙: 판매 중이 아니면 결제할 수 없고(P2 계약: 판매 가능 상태 확인은 P3 책임), 구매 제한을 넘으면 안 된다.
    재고 부족은 여기서 보지 않고 P2 decrease_stock이 판단한다 (재고 규칙은 한 곳에만 둔다).
    """
    if variant is None or not variant.is_on_sale:
        name = _label(variant) if variant is not None else "상품"
        raise VariantUnavailable(f"{name}은(는) 지금 판매하지 않아 결제할 수 없어요.")
    ensure_within_limit(variant, quantity, already_paid)


def snapshot(variant: CartVariant, quantity: int) -> OrderItem:
    """주문 당시 상품명·옵션명·단가를 복사해 주문 상품 한 줄을 만든다."""
    return OrderItem(variant_id=variant.variant_id, product_name=variant.product_name,
                     option_name=variant.option_name, unit_price=variant.unit_price, quantity=quantity)


def draft_from_cart(recipient: Recipient, lines: list[CartLine], paid: dict[int, int],
                    policy: ShippingPolicy | None) -> OrderDraft:
    """장바구니 전체로 새 주문을 만든다.

    규칙: 장바구니가 비면 CART_EMPTY. 숨김 상품이 남아 있어도 판매 중이 아니므로 UNAVAILABLE_ITEM.
    paid는 옵션별로 이미 결제한 수량이다.
    """
    if not lines:
        raise CartEmpty("장바구니가 비어 있어요.")
    items = [snapshot(ensure_orderable(line.variant, line.quantity, paid.get(line.variant.variant_id, 0)),
                      line.quantity)
             for line in lines]
    items_price = sum(item.line_price for item in items)
    return OrderDraft(recipient, items, calc_shipping_fee(items_price, policy), is_direct=False)


def draft_direct(recipient: Recipient, variant: CartVariant | None, quantity: int, already_paid: int,
                 policy: ShippingPolicy | None) -> OrderDraft:
    """옵션 하나로 바로 구매 주문을 만든다. 장바구니와 상관없다."""
    validate_direct_quantity(quantity)
    item = snapshot(ensure_orderable(variant, quantity, already_paid), quantity)
    return OrderDraft(recipient, [item], calc_shipping_fee(item.line_price, policy), is_direct=True)
