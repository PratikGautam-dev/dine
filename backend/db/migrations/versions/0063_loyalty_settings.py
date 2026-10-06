"""per-restaurant loyalty settings (points earn rate, VIP threshold, redemption, VIP benefit, on/off)

Additive: one JSON text column with an empty default. Missing keys fall back to the defaults in
db/repositories/hospitals.py, so existing restaurants keep today's behaviour until they change it."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0063"
down_revision: Union[str, None] = "0062"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hospitals", sa.Column("loyalty_settings", sa.Text(), nullable=False, server_default="{}"))


def downgrade() -> None:
    op.drop_column("hospitals", "loyalty_settings")
