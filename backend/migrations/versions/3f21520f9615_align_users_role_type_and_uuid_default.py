"""align users role type and uuid default

Revision ID: 3f21520f9615
Revises: b49bcc205bbc
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3f21520f9615"
down_revision: Union[str, Sequence[str], None] = "b49bcc205bbc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """회원 데이터는 유지하고 자료형과 기본값을 정렬합니다."""
    op.alter_column(
        "users",
        "role",
        schema="public",
        existing_type=sa.String(length=5),
        type_=sa.Text(),
        existing_nullable=False,
        existing_server_default=sa.text("'USER'"),
    )

    op.alter_column(
        "users",
        "id",
        schema="public",
        existing_type=sa.UUID(),
        existing_nullable=False,
        server_default=sa.text("gen_random_uuid()"),
    )


def downgrade() -> None:
    """이 revision 이전의 자료형과 기본값으로 되돌립니다."""
    op.alter_column(
        "users",
        "id",
        schema="public",
        existing_type=sa.UUID(),
        existing_nullable=False,
        server_default=None,
    )

    op.alter_column(
        "users",
        "role",
        schema="public",
        existing_type=sa.Text(),
        type_=sa.String(length=5),
        existing_nullable=False,
        existing_server_default=sa.text("'USER'"),
    )