"""customer loyalty points ledger, VIP override, customer tags, and the restaurant's VIP threshold

Additive only: every new column has a safe default or is nullable, so existing customers and
restaurants behave exactly as before until a paid order actually writes to the ledger.

loyalty_transactions is the audit trail behind patients.loyalty_points. The unique index on
(order_id, kind) is what stops a repeated "paid" event from awarding points twice."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0062"
down_revision: Union[str, None] = "0061"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hospitals", sa.Column("vip_spend_threshold_paise", sa.Integer(), nullable=False, server_default="1000000"))
    op.add_column("patients", sa.Column("tags", sa.Text(), nullable=False, server_default="[]"))
    op.add_column("patients", sa.Column("is_vip_override", sa.Boolean(), nullable=True))
    op.create_table(
        "loyalty_transactions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hospital_id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_index(
        "uq_loyalty_order_kind", "loyalty_transactions", ["order_id", "kind"], unique=True,
        postgresql_where=sa.text("order_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_loyalty_order_kind", table_name="loyalty_transactions")
    op.drop_table("loyalty_transactions")
    op.drop_column("patients", "is_vip_override")
    op.drop_column("patients", "tags")
    op.drop_column("hospitals", "vip_spend_threshold_paise")
