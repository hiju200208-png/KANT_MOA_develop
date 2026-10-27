# [infrastructure] P3 테이블 ORM 매핑: 001_create_tables.sql에 이미 있는 테이블과 똑같이 맞춘다. DDL 실행 없음.
from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, DateTime, Identity, Index, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class AddressModel(Base):
    """배송지 (addresses). 주문은 주소를 문자열로 따로 저장하므로 orders와 FK가 없다."""

    __tablename__ = "addresses"
    __table_args__ = (
        # 규칙: 사용자마다 기본 배송지는 최대 1개 (DB 부분 UNIQUE 인덱스와 같은 이름·조건)
        Index("addresses_one_default_per_user", "user_id", unique=True, postgresql_where=text("is_default")),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    # DB에는 users(id) FK(ON DELETE CASCADE)가 이미 있다. users ORM 모델(P1)이 main에 없어서
    # 여기서 ForeignKey를 선언하면 저장할 때 'users 테이블을 찾을 수 없음' 오류가 난다 → P1 병합 후 다시 맞춘다.
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True))
    label: Mapped[str | None] = mapped_column(Text)
    recipient_name: Mapped[str] = mapped_column(Text)
    recipient_phone: Mapped[str] = mapped_column(Text)
    postal_code: Mapped[str] = mapped_column(Text)
    address1: Mapped[str] = mapped_column(Text)
    address2: Mapped[str | None] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
