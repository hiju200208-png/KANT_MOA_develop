# [test] 주문 서비스용 가짜 저장소·재고·트랜잭션 (DB 없음)
# 실제 트랜잭션처럼 commit 전 변경은 pending에 쌓고, rollback하면 주문·재고·장바구니를 함께 버린다.
import copy
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from orders.domain.cart import CartVariant
from orders.domain.checkout import ShippingPolicy
from orders.domain.exceptions import OutOfStock, VariantNotFound
from orders.domain.order import Order

NOW = datetime(2026, 10, 27, 12, 0, tzinfo=timezone.utc)


def variant(variant_id, **overrides) -> CartVariant:
    values = {"variant_id": variant_id, "product_id": 10 + variant_id, "product_name": f"상품{variant_id}",
              "thumbnail_path": None, "option_name": "기본", "unit_price": 10000, "stock": 5,
              "max_per_user": 4, "product_status": "on_sale"}
    values.update(overrides)
    return CartVariant(**values)


class _Pending:
    """saved ↔ pending 복사본을 관리하는 공통 부분."""

    def __init__(self):
        self.saved: dict = {}
        self.pending: dict | None = None

    @property
    def data(self) -> dict:
        if self.pending is None:
            self.pending = copy.deepcopy(self.saved)
        return self.pending

    def commit(self):
        if self.pending is not None:
            self.saved, self.pending = self.pending, None

    def rollback(self):
        self.pending = None


class FakeOrderRepository(_Pending):
    def __init__(self):
        super().__init__()
        self.policy: ShippingPolicy | None = ShippingPolicy(50000, 3000)
        self.locked_users: list = []
        self.locked_orders: list = []
        self.created = 0

    async def lock_owner(self, user_id):
        self.locked_users.append(user_id)

    async def shipping_policy(self):
        return self.policy

    async def add(self, user_id, draft):
        self.created += 1
        order = Order(id=uuid4(), user_id=user_id, total_price=draft.total_price, shipping_fee=draft.shipping_fee,
                      is_direct=draft.is_direct, recipient_name=draft.recipient.name,
                      recipient_phone=draft.recipient.phone, address=draft.recipient.address,
                      created_at=NOW + timedelta(minutes=self.created), items=list(draft.items))
        self.data[order.id] = order
        return copy.deepcopy(order)

    async def get(self, order_id):
        order = self.data.get(order_id)
        return copy.deepcopy(order) if order else None

    async def get_for_update(self, order_id):
        self.locked_orders.append(order_id)
        return await self.get(order_id)

    async def save_status(self, order):
        self.data[order.id] = copy.deepcopy(order)

    async def list_by_user(self, user_id, status, keyword, page, size):
        rows = [o for o in self.data.values() if o.user_id == user_id and (not status or o.status == status)
                and (not keyword or any(keyword in i.product_name for i in o.items))]
        rows.sort(key=lambda o: o.created_at, reverse=True)
        return rows[(page - 1) * size: page * size], len(rows)

    def seed(self, order: Order) -> Order:
        self.saved[order.id] = order
        return order


class FakeStock(_Pending):
    """재고 창구 흉내. saved는 {variant_id: 재고}. 잠근 순서를 기록한다."""

    def __init__(self, stock: dict[int, int]):
        super().__init__()
        self.saved = dict(stock)
        self.lock_calls: list[list[int]] = []
        self.locked: set[int] = set()

    async def lock(self, variant_ids):
        self.lock_calls.append(list(variant_ids))
        missing = set(variant_ids) - set(self.data)
        if missing:
            raise VariantNotFound("판매하지 않는 상품이 있어요.")
        self.locked = set(variant_ids)

    async def decrease(self, variant_id, quantity):
        assert variant_id in self.locked, "잠그지 않은 옵션을 바꾸려 함"
        if self.data[variant_id] < quantity:
            raise OutOfStock("품절")
        self.data[variant_id] -= quantity

    async def increase(self, variant_id, quantity):
        assert variant_id in self.locked, "잠그지 않은 옵션을 바꾸려 함"
        self.data[variant_id] += quantity


class FakeUnitOfWork:
    """주문·장바구니·재고 저장소를 한 번에 commit/rollback하는 가짜 트랜잭션."""

    def __init__(self, *repos):
        self.repos, self.commits, self.rollbacks = repos, 0, 0

    async def commit(self):
        for repo in self.repos:
            if hasattr(repo, "commit"):
                repo.commit()
            else:  # 장바구니 가짜 저장소(conftest)는 saved/pending만 있다
                if repo.pending is not None:
                    repo.saved, repo.pending = repo.pending, None
        self.commits += 1

    async def rollback(self):
        for repo in self.repos:
            repo.pending = None
        self.rollbacks += 1
