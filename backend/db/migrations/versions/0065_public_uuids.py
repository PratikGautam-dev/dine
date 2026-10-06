"""public UUIDs for customers and orders, used in URLs; integer ids stay internal for foreign keys

Existing rows are backfilled with a random UUID when the column is added, so every customer and
order already has one. New rows get one from the column default."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0065"
down_revision: Union[str, None] = "0064"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("patients", "food_orders"):
        op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS public_id TEXT NOT NULL DEFAULT gen_random_uuid()::text")
        op.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS uq_{table}_public_id ON {table} (public_id)")


def downgrade() -> None:
    for table in ("patients", "food_orders"):
        op.execute(f"DROP INDEX IF EXISTS uq_{table}_public_id")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS public_id")
