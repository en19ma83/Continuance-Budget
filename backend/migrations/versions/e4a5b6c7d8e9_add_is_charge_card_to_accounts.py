"""add is_charge_card to accounts

Revision ID: e4a5b6c7d8e9
Revises: f5a6b7c8d9e0
Create Date: 2026-04-20

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e4a5b6c7d8e9'
down_revision: Union[str, None] = 'f5a6b7c8d9e0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('accounts', sa.Column('is_charge_card', sa.Boolean(), nullable=True, server_default='false'))
    # Update existing rows to false
    op.execute("UPDATE accounts SET is_charge_card = false WHERE is_charge_card IS NULL")
    # Make it non-nullable if desired, but nullable=True is safer for now.


def downgrade() -> None:
    op.drop_column('accounts', 'is_charge_card')
