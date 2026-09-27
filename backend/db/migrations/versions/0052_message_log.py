"""message_log -- real send/receive counts for Messages & Automations analytics

Revision ID: 0052
Revises: 0051
Create Date: 2026-09-28

The Messages & Automations page's "Performance Analytics" card showed hardcoded fake numbers
(1,248 sent / 98.2% delivery / 42% response) because nothing in this app logged individual
WhatsApp sends or receives -- core/whatsapp.py's WhatsAppClient only wrote to the app logger.
This table gives it a real (if minimal) source: one row per outbound send attempt (status
sent/failed, from the WhatsApp API's own HTTP response) and one row per inbound message received,
written from core/whatsapp.py's send_* methods and webhook/dispatch.py's _process_message()
respectively. No delivered/read status -- that needs Meta's own status-callback webhook, which
this migration deliberately does not add (out of scope, same as WhatsApp template management)."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0052"
down_revision: Union[str, None] = "0051"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "message_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("hospital_id", sa.Integer(), sa.ForeignKey("hospitals.id"), nullable=False),
        sa.Column("direction", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_check_constraint("message_log_direction_chk", "message_log", "direction IN ('inbound', 'outbound')")
    op.create_check_constraint("message_log_status_chk", "message_log", "status IS NULL OR status IN ('sent', 'failed')")
    op.create_index("idx_message_log_hospital_created", "message_log", ["hospital_id", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_message_log_hospital_created", table_name="message_log")
    op.drop_table("message_log")
