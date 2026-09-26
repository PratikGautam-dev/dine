"""automations -- real trigger -> WhatsApp message rules, starting with one wired trigger

Revision ID: 0047
Revises: 0046
Create Date: 2026-09-27

Phase 4 of docs/Spec.md's "Messages & Automations" plan: a real trigger/action model, starting
with an already-real event (feedback_received) instead of inventing a new trigger type. `delay_
minutes` is stored but NOT enforced yet (same "stored, not enforced" pattern Section 14.7 uses
for online_quota/walkin_quota) -- there's no job scheduler in this app for an arbitrary delay,
so every automation sends immediately regardless of its configured delay. automation_runs is a
real log (never a stored counter) so "times triggered" on the portal is always a live count."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0047"
down_revision: Union[str, None] = "0046"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "automations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("trigger_event", sa.Text(), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("delay_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.CheckConstraint(
            "trigger_event IN ('feedback_received')",
            name="automations_trigger_event_chk",
        ),
    )
    op.create_index("idx_automations_hospital_trigger", "automations", ["hospital_id", "trigger_event", "is_active"])

    op.create_table(
        "automation_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("automation_id", sa.Integer(), sa.ForeignKey("automations.id"), nullable=False),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("phone", sa.Text(), nullable=False),
        sa.Column("ran_at", sa.Text(), nullable=False),
    )
    op.create_index("idx_automation_runs_automation", "automation_runs", ["automation_id"])


def downgrade() -> None:
    op.drop_table("automation_runs")
    op.drop_table("automations")
