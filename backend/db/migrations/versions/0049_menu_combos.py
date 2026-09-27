"""menu_combos -- Combo Offers: menu_items.is_combo + menu_item_combo_lines

Revision ID: 0049
Revises: 0048
Create Date: 2026-09-27

A combo is a normal menu_items row (same price, category, availability, stock, image, WhatsApp
ordering path as any other item) flagged `is_combo`, with its contents in the new
menu_item_combo_lines table -- real menu items + a quantity each, not free text. A component must
not itself be a combo (enforced in portal/routes/food_ordering.py, not a DB constraint, same style
every other cross-row validation in that file already uses)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0049"
down_revision: Union[str, None] = "0048"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("menu_items", sa.Column("is_combo", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "menu_item_combo_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("combo_item_id", sa.Text(), sa.ForeignKey("menu_items.id"), nullable=False),
        sa.Column("component_item_id", sa.Text(), sa.ForeignKey("menu_items.id"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("idx_menu_item_combo_lines_combo", "menu_item_combo_lines", ["combo_item_id"])
    op.create_index("idx_menu_item_combo_lines_component", "menu_item_combo_lines", ["component_item_id"])


def downgrade() -> None:
    op.drop_index("idx_menu_item_combo_lines_component", table_name="menu_item_combo_lines")
    op.drop_index("idx_menu_item_combo_lines_combo", table_name="menu_item_combo_lines")
    op.drop_table("menu_item_combo_lines")
    op.drop_column("menu_items", "is_combo")
