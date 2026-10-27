# [application] 배송지 서비스: 조회 → 도메인 규칙 → 저장 → commit, 실패하면 rollback
from uuid import UUID

from orders.application.ports import AddressRepositoryPort, TransactionPort
from orders.domain.address import Address, AddressInput, ensure_can_add, is_default_on_create, pick_next_default
from orders.domain.exceptions import AddressNotFound


class AddressService:
    def __init__(self, addresses: AddressRepositoryPort, transaction: TransactionPort):
        self._addresses = addresses
        self._transaction = transaction

    async def _get_owned(self, user_id: UUID, address_id: int) -> Address:
        """배송지를 찾고 본인 것인지 확인한다. 없으면 404, 남의 것이면 403용 예외."""
        address = await self._addresses.get(address_id)
        if address is None:
            raise AddressNotFound("배송지를 찾을 수 없어요.")
        address.ensure_owned_by(user_id)
        return address

    async def list(self, user_id: UUID, keyword: str | None, page: int, size: int) -> tuple[list[Address], int]:
        return await self._addresses.list_by_user(user_id, keyword, page, size)

    async def get(self, user_id: UUID, address_id: int) -> Address:
        return await self._get_owned(user_id, address_id)

    async def create(self, user_id: UUID, content: AddressInput, make_default: bool) -> Address:
        try:
            # 같은 사람의 동시 요청이 기본 배송지를 둘 만들지 않도록 먼저 줄을 세운다.
            await self._addresses.lock_owner(user_id)
            count = await self._addresses.count_by_user(user_id)
            ensure_can_add(count)
            is_default = is_default_on_create(count, make_default)
            if is_default and count > 0:
                # 규칙: 새 기본 배송지를 넣기 전에 기존 기본을 먼저 해제한다 (기본은 항상 1개).
                await self._addresses.clear_default(user_id)
            address = await self._addresses.add(user_id, content, is_default)
            await self._transaction.commit()
            return address
        except BaseException:
            await self._transaction.rollback()
            raise

    async def update(self, user_id: UUID, address_id: int, content: AddressInput, make_default: bool) -> Address:
        try:
            await self._addresses.lock_owner(user_id)
            address = await self._get_owned(user_id, address_id)
            await self._addresses.update_content(address_id, content)
            # 규칙: make_default=False는 무시한다. 기본 해제는 다른 배송지를 기본으로 지정해서만 한다.
            if make_default and not address.is_default:
                await self._addresses.clear_default(user_id)
                await self._addresses.mark_default(address_id)
            updated = await self._addresses.get(address_id)
            if updated is None:  # 잠근 뒤라 거의 없지만, 없으면 저장하지 않고 404로 끝낸다.
                raise AddressNotFound("배송지를 찾을 수 없어요.")
            await self._transaction.commit()
            return updated
        except BaseException:
            await self._transaction.rollback()
            raise

    async def delete(self, user_id: UUID, address_id: int) -> None:
        try:
            await self._addresses.lock_owner(user_id)
            address = await self._get_owned(user_id, address_id)
            await self._addresses.delete(address_id)
            if address.is_default:
                # 규칙: 기본 배송지를 지웠으면 남은 것 중 가장 최근 배송지를 새 기본으로 한다.
                remaining = await self._addresses.list_all_by_user(user_id)
                next_default = pick_next_default(remaining)
                if next_default is not None:
                    await self._addresses.mark_default(next_default.id)
            await self._transaction.commit()
        except BaseException:
            await self._transaction.rollback()
            raise

    async def set_default(self, user_id: UUID, address_id: int) -> None:
        try:
            await self._addresses.lock_owner(user_id)
            address = await self._get_owned(user_id, address_id)
            if not address.is_default:
                # 기존 해제 → 새로 지정 순서를 지켜야 UNIQUE 인덱스에 걸리지 않는다.
                await self._addresses.clear_default(user_id)
                await self._addresses.mark_default(address_id)
            await self._transaction.commit()
        except BaseException:
            await self._transaction.rollback()
            raise
