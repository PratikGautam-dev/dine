"""menu_combo_items -- Combo Offers: menu_items.combo_item_count

Revision ID: 0049
Revises: 0048
Create Date: 2026-09-27

A combo is just a menu item with combo_item_count set (how many dishes it bundles) -- everything
else (name, price, description, category, availability, stock, image, ordering) is the exact same
menu_items row and the exact same WhatsApp ordering path every other item already uses. No separate
combo_items/combo_lines table: the bundled dishes are named in the item's own `description`, which
the WhatsApp bot already renders verbatim."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0049"
down_revision: Union[str, None] = "0048"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("menu_items", sa.Column("combo_item_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("menu_items", "combo_item_count")
