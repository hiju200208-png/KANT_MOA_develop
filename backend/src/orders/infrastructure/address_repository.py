# [infrastructure] 배송지 저장소: DB 행 ↔ 도메인 Address 변환. commit하지 않고 필요할 때 flush만 한다.
from uuid import UUID

from sqlalchemy import delete, func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from orders.domain.address import Address, AddressInput
from orders.infrastructure.models import AddressModel

# 목록 순서: 기본 배송지 맨 앞, 나머지는 최근 등록순 (프론트 기존 동작과 같다)
_LIST_ORDER = (AddressModel.is_default.desc(), AddressModel.created_at.desc(), AddressModel.id.desc())


def _to_domain(row: AddressModel) -> Address:
    return Address(
        id=row.id,
        user_id=row.user_id,
        content=AddressInput(
            recipient_name=row.recipient_name,
            recipient_phone=row.recipient_phone,
            postal_code=row.postal_code,
            address1=row.address1,
            address2=row.address2,
            label=row.label,
        ),
        is_default=row.is_default,
        created_at=row.created_at,
    )


def _content_values(content: AddressInput) -> dict:
    return {
        "label": content.label,
        "recipient_name": content.recipient_name,
        "recipient_phone": content.recipient_phone,
        "postal_code": content.postal_code,
        "address1": content.address1,
        "address2": content.address2,
    }


class AddressRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def lock_owner(self, user_id: UUID) -> None:
        """같은 사람의 배송지 변경을 한 줄로 세운다.

        첫 배송지를 동시에 두 번 등록하면 둘 다 기본 배송지가 되려다 UNIQUE 제약에 걸린다.
        회원 행(users)을 FOR UPDATE로 잠가 같은 사람의 요청은 앞 요청이 끝날 때까지 기다리게 한다.
        users는 P1 테이블이라 읽기 잠금만 하고 값은 바꾸지 않는다.
        """
        await self._session.execute(text("SELECT id FROM users WHERE id = :id FOR UPDATE"), {"id": user_id})

    async def list_by_user(self, user_id: UUID, keyword: str | None, page: int, size: int) -> tuple[list[Address], int]:
        condition = [AddressModel.user_id == user_id]
        if keyword:
            # 검색: 배송지명·받는 분·주소에 검색어가 들어간 것 (대소문자 무시).
            # 검색어의 %, _ 는 와일드카드가 아니라 글자 그대로 찾도록 escape한다.
            escaped = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{escaped}%"
            columns = (AddressModel.label, AddressModel.recipient_name, AddressModel.address1, AddressModel.address2)
            condition.append(or_(*(column.ilike(pattern, escape="\\") for column in columns)))
        total = (await self._session.execute(select(func.count()).select_from(AddressModel).where(*condition))).scalar_one()
        rows = (
            await self._session.execute(
                select(AddressModel).where(*condition).order_by(*_LIST_ORDER).limit(size).offset((page - 1) * size)
            )
        ).scalars().all()
        return [_to_domain(row) for row in rows], int(total)

    async def get(self, address_id: int) -> Address | None:
        row = await self._session.get(AddressModel, address_id, populate_existing=True)
        return _to_domain(row) if row else None

    async def count_by_user(self, user_id: UUID) -> int:
        query = select(func.count()).select_from(AddressModel).where(AddressModel.user_id == user_id)
        return int((await self._session.execute(query)).scalar_one())

    async def list_all_by_user(self, user_id: UUID) -> list[Address]:
        rows = (await self._session.execute(select(AddressModel).where(AddressModel.user_id == user_id))).scalars().all()
        return [_to_domain(row) for row in rows]

    async def add(self, user_id: UUID, content: AddressInput, is_default: bool) -> Address:
        row = AddressModel(user_id=user_id, is_default=is_default, **_content_values(content))
        self._session.add(row)
        await self._session.flush()  # id·created_at을 DB에서 받아온다
        await self._session.refresh(row)
        return _to_domain(row)

    async def update_content(self, address_id: int, content: AddressInput) -> None:
        await self._session.execute(
            update(AddressModel).where(AddressModel.id == address_id).values(**_content_values(content))
            .execution_options(synchronize_session=False)
        )

    async def clear_default(self, user_id: UUID) -> None:
        """기존 기본 배송지를 해제한다. UNIQUE 인덱스 때문에 새 기본 지정보다 반드시 먼저 실행한다."""
        await self._session.execute(
            update(AddressModel).where(AddressModel.user_id == user_id, AddressModel.is_default.is_(True))
            .values(is_default=False).execution_options(synchronize_session=False)
        )

    async def mark_default(self, address_id: int) -> None:
        await self._session.execute(
            update(AddressModel).where(AddressModel.id == address_id).values(is_default=True)
            .execution_options(synchronize_session=False)
        )

    async def delete(self, address_id: int) -> None:
        await self._session.execute(
            delete(AddressModel).where(AddressModel.id == address_id).execution_options(synchronize_session=False)
        )
