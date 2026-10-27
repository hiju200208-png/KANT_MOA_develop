# [infrastructure] 배송 기록은 별도 테이블에 저장해 기존 결제 상태와 분리한다.
from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class ShipmentModel(Base):
    __tablename__ = "order_shipments"
    __table_args__ = (
        CheckConstraint("status in ('shipped', 'delivered')", name="ck_order_shipments_status"),
        CheckConstraint("(status='shipped' AND delivered_at IS NULL) OR "
                        "(status='delivered' AND delivered_at IS NOT NULL AND delivered_at >= shipped_at)",
                        name="ck_order_shipments_times"),
    )
    order_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("orders.id"), primary_key=True)
    status: Mapped[str] = mapped_column(Text)
    shipped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_by: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True))

