"""add color to accounts

Revision ID: f1g2h3i4j5k6
Revises: e4a5b6c7d8e9
Create Date: 2026-04-24

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f1g2h3i4j5k6'
down_revision: Union[str, None] = 'e4a5b6c7d8e9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('accounts', sa.Column('color', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('accounts', 'color')
