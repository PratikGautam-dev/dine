"""Branch-scoped follow-ups flagged as worth doing after the gap-closing plan: per-branch
Razorpay credentials, per-branch staff access, and multi-branch offers.

Revision ID: 0060
Revises: 0059
Create Date: 2026-10-01

1. branches.razorpay_key_id/razorpay_key_secret_ref/razorpay_webhook_secret_ref -- nullable,
   same "unset = inherit the hospital-wide default" convention as service_charge_pct etc.
   (migration 0055). A branch with its own credentials settles to its own Razorpay account
   instead of the tenant's shared one.
2. staff_branches -- a staff member with NO rows here is unrestricted (today's unchanged
   behavior, every branch visible); one or more rows restricts them to exactly those branches.
   Additive, opt-in per staff member, not a default-on access-control rewrite.
3. offer_branches -- replaces Phase F's single nullable offers.branch_id with a real many-to-many
   (an offer can now be restricted to SEVERAL specific branches, not just one). Existing
   single-branch values are backfilled into the join table; offers.branch_id itself is dropped
   since nothing in production has ever used it (Phase F shipped this same session, never
   exercised by real traffic)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0060"
down_revision: Union[str, None] = "0059"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("branches", sa.Column("razorpay_key_id", sa.Text(), nullable=True))
    op.add_column("branches", sa.Column("razorpay_key_secret_ref", sa.Text(), nullable=True))
    op.add_column("branches", sa.Column("razorpay_webhook_secret_ref", sa.Text(), nullable=True))

    op.create_table(
        "staff_branches",
        sa.Column("identity_id", sa.Integer(), sa.ForeignKey("identities.id"), primary_key=True),
        sa.Column("branch_id", sa.Text(), sa.ForeignKey("branches.id"), primary_key=True),
    )

    op.create_table(
        "offer_branches",
        sa.Column("offer_id", sa.Integer(), sa.ForeignKey("offers.id"), primary_key=True),
        sa.Column("branch_id", sa.Text(), sa.ForeignKey("branches.id"), primary_key=True),
    )
    op.execute(
        "INSERT INTO offer_branches (offer_id, branch_id) "
        "SELECT id, branch_id FROM offers WHERE branch_id IS NOT NULL"
    )
    op.drop_column("offers", "branch_id")


def downgrade() -> None:
    op.add_column("offers", sa.Column("branch_id", sa.Text(), sa.ForeignKey("branches.id"), nullable=True))
    op.execute(
        "UPDATE offers SET branch_id = ob.branch_id FROM offer_branches ob "
        "WHERE ob.offer_id = offers.id"
    )
    op.drop_table("offer_branches")
    op.drop_table("staff_branches")
    op.drop_column("branches", "razorpay_webhook_secret_ref")
    op.drop_column("branches", "razorpay_key_secret_ref")
    op.drop_column("branches", "razorpay_key_id")
