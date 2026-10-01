"""feedback.order_id -- optionally link a rating to the order it's about

Revision ID: 0058
Revises: 0057
Create Date: 2026-10-01

Nullable: the WhatsApp feedback flow (flows/router.py's give_feedback dispatch) resolves the
guest's most recent food order at rating time and passes it through, but a guest with no orders
yet (or any future non-order feedback source) still gets a row with order_id = NULL. No backfill
of historical feedback rows -- there's no reliable way to infer which order a past rating was
about."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0058"
down_revision: Union[str, None] = "0057"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("feedback", sa.Column("order_id", sa.Integer(), sa.ForeignKey("food_orders.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("feedback", "order_id")
