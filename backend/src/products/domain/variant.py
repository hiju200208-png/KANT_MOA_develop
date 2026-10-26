from dataclasses import dataclass


class InvalidStock(ValueError):
    """재고·수량이 유효한 정수가 아님."""


class InsufficientStock(ValueError):
    """요청 수량보다 현재 재고가 적음."""


MAX_STOCK = 2_147_483_647  # PostgreSQL integer 범위


@dataclass
class ProductVariant:
    id: int
    product_id: int
    stock: int
    option_name: str = "기본"
    extra_price: int = 0
    max_per_user: int | None = 4
    sort_order: int = 0

    def __post_init__(self) -> None:
        self._validate_stock()

    def _validate_stock(self) -> None:
        if type(self.stock) is not int or not 0 <= self.stock <= MAX_STOCK:
            raise InvalidStock("재고는 0 이상인 정수여야 해요.")

    def _validate_quantity(self, quantity: int) -> None:
        self._validate_stock()
        if type(quantity) is not int or quantity <= 0:
            raise InvalidStock("수량은 양의 정수여야 해요.")

    def increase_stock(self, quantity: int) -> int:
        self._validate_quantity(quantity)
        if self.stock + quantity > MAX_STOCK:
            raise InvalidStock("저장 가능한 재고 범위를 초과했어요.")
        self.stock += quantity
        return self.stock

    def decrease_stock(self, quantity: int) -> int:
        self._validate_quantity(quantity)
        if quantity > self.stock:
            raise InsufficientStock("재고가 부족해요.")
        self.stock -= quantity
        return self.stock
