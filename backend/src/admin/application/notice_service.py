"""관리자 공지 서비스: 조회는 그대로, 등록·수정·삭제는 commit/rollback을 이 서비스가 관리한다."""

from typing import Protocol

from admin.application.ports import TransactionPort
from admin.domain.notice import AdminNoticeRow, InvalidNotice, NoticeChanges, NoticeDraft, NoticeNotFound


class NoticeRepositoryPort(Protocol):
    async def list_notices(self, artist: str | None, page: int, size: int) -> tuple[list[AdminNoticeRow], int]: ...

    async def get_notice(self, notice_id: int) -> AdminNoticeRow | None: ...

    async def find_artist_id(self, slug: str) -> int | None: ...

    async def product_exists(self, product_id: int) -> bool: ...

    async def insert_notice(self, values: dict) -> int: ...

    async def update_notice(self, notice_id: int, values: dict) -> bool: ...

    async def delete_notice(self, notice_id: int) -> bool: ...


class AdminNoticeService:
    def __init__(self, notices: NoticeRepositoryPort, transaction: TransactionPort):
        self._notices = notices
        self._transaction = transaction

    async def list_notices(self, artist: str | None, page: int, size: int):
        return await self._notices.list_notices(artist, page, size)

    async def get_notice(self, notice_id: int) -> AdminNoticeRow:
        notice = await self._notices.get_notice(notice_id)
        if notice is None:
            raise NoticeNotFound()
        return notice

    async def _to_db_values(self, values: dict) -> dict:
        """artist_slug → artist_id 변환, 연결 대상 존재 확인."""
        db = {k: v for k, v in values.items() if k != "artist_slug"}
        if "artist_slug" in values:
            slug = values["artist_slug"]
            if slug is None:
                db["artist_id"] = None
            else:
                artist_id = await self._notices.find_artist_id(slug)
                if artist_id is None:
                    raise InvalidNotice("아티스트를 확인해주세요.")
                db["artist_id"] = artist_id
        if values.get("product_id") is not None and not await self._notices.product_exists(values["product_id"]):
            raise InvalidNotice("연결할 상품을 확인해주세요.")
        return db

    async def create(self, draft: NoticeDraft) -> AdminNoticeRow:
        try:
            values = await self._to_db_values(
                {
                    "title": draft.title,
                    "body": draft.body,
                    "artist_slug": draft.artist_slug,
                    "product_id": draft.product_id,
                    "is_pinned": draft.is_pinned,
                    "show_in_topbar": draft.show_in_topbar,
                }
            )
            notice_id = await self._notices.insert_notice(values)
            notice = await self._notices.get_notice(notice_id)
            await self._transaction.commit()
            return notice
        except BaseException:
            await self._transaction.rollback()
            raise

    async def update(self, notice_id: int, changes: NoticeChanges) -> AdminNoticeRow:
        try:
            values = await self._to_db_values(changes.values)
            if not await self._notices.update_notice(notice_id, values):
                raise NoticeNotFound()
            notice = await self._notices.get_notice(notice_id)
            await self._transaction.commit()
            return notice
        except BaseException:
            await self._transaction.rollback()
            raise

    async def delete(self, notice_id: int) -> None:
        try:
            if not await self._notices.delete_notice(notice_id):
                raise NoticeNotFound()
            await self._transaction.commit()
        except BaseException:
            await self._transaction.rollback()
            raise
