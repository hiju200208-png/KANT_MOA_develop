"""[migration] 결제 상태를 보존하고 관리자 배송 기록 테이블만 추가한다."""
from alembic import op

revision = "4c726d1a91ab"
down_revision = "3f21520f9615"
branch_labels = None
depends_on = None

# 기존 테이블·주문·상품·재고는 변경하지 않는다. 테스트도 같은 DDL을 빈 전용 DB에 적용한다.
UPGRADE_SQL = """
CREATE TABLE order_shipments (
    order_id uuid PRIMARY KEY REFERENCES orders(id),
    status text NOT NULL CONSTRAINT ck_order_shipments_status CHECK (status IN ('shipped','delivered')),
    shipped_at timestamptz NOT NULL,
    delivered_at timestamptz,
    updated_by uuid NOT NULL,
    CONSTRAINT ck_order_shipments_times CHECK (
        (status='shipped' AND delivered_at IS NULL) OR
        (status='delivered' AND delivered_at IS NOT NULL AND delivered_at >= shipped_at)
    )
);
"""


def upgrade():
    op.execute(UPGRADE_SQL)


def downgrade():
    # 명시적인 downgrade만 배송 기록을 삭제한다. 공용 DB에서 임의 실행하지 않는다.
    op.drop_table("order_shipments")
