"""add gst treatment to rules and ledger entries

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-04-19

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, None] = 'e4f5a6b7c8d9'
branch_labels = None
depends_on = None

gst_enum = sa.Enum('BAS_INCL', 'BAS_EXCL', 'GST_FREE', 'N_A', name='gsttreatment')


def upgrade() -> None:
    gst_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('recurring_rules', sa.Column('gst_treatment', gst_enum, nullable=True))
    op.add_column('ledger_entries', sa.Column('gst_treatment', gst_enum, nullable=True))


def downgrade() -> None:
    op.drop_column('ledger_entries', 'gst_treatment')
    op.drop_column('recurring_rules', 'gst_treatment')
    gst_enum.drop(op.get_bind(), checkfirst=True)
