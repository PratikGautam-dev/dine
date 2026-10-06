"""saved delivery addresses per WhatsApp customer (up to 5, enforced in the repository layer)"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0064"
down_revision: Union[str, None] = "0063"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customer_addresses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hospital_id", sa.Integer(), nullable=False),
        sa.Column("phone", sa.Text(), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_index("ix_customer_addresses_phone", "customer_addresses", ["hospital_id", "phone"])


def downgrade() -> None:
    op.drop_index("ix_customer_addresses_phone", table_name="customer_addresses")
    op.drop_table("customer_addresses")
