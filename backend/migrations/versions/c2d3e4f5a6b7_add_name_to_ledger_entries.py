"""Add name column to ledger_entries

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-04-17 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ledger_entries', sa.Column('name', sa.String(), nullable=True))
    op.create_index(op.f('ix_ledger_entries_name'), 'ledger_entries', ['name'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ledger_entries_name'), table_name='ledger_entries')
    op.drop_column('ledger_entries', 'name')
