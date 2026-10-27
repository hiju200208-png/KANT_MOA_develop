# [presentation] P3 API 의존성: 로그인 사용자와 요청마다 같은 세션을 쓰는 서비스를 만든다.
from fastapi import Depends
from orders.application.admin_order_service import AdminOrderService
from sqlalchemy.ext.asyncio import AsyncSession

from auth.presentation.dependencies import get_current_user  # noqa: F401 - P3 라우터가 여기서 가져다 쓴다
from database import get_session
from orders.application.address_service import AddressService
from orders.application.cart_service import CartService
from orders.application.order_service import OrderService
from orders.infrastructure.address_repository import AddressRepository
from orders.infrastructure.cart_repository import CartRepository
from orders.infrastructure.order_repository import OrderRepository
from orders.infrastructure.stock_adapter import ProductStockAdapter
from orders.infrastructure.transaction import SessionTransaction


async def get_address_service(session: AsyncSession = Depends(get_session)) -> AddressService:
    return AddressService(AddressRepository(session), SessionTransaction(session))


async def get_cart_service(session: AsyncSession = Depends(get_session)) -> CartService:
    return CartService(CartRepository(session), SessionTransaction(session))


async def get_order_service(session: AsyncSession = Depends(get_session)) -> OrderService:
    # 주문·장바구니·재고가 모두 같은 세션을 써야 결제·취소가 한 트랜잭션으로 묶인다.
    return OrderService(OrderRepository(session), CartRepository(session), ProductStockAdapter(session),
                        SessionTransaction(session))



async def get_admin_order_service(session: AsyncSession = Depends(get_session)) -> AdminOrderService:
    return AdminOrderService(OrderRepository(session), SessionTransaction(session))
