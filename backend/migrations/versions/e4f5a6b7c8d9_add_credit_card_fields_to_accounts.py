"""add credit card fields to accounts

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-04-19

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, None] = 'd3e4f5a6b7c8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('accounts', sa.Column('credit_limit', sa.Float(), nullable=True))
    op.add_column('accounts', sa.Column('balance_tracking_method', sa.String(), nullable=True))
    op.add_column('accounts', sa.Column('statement_date', sa.Integer(), nullable=True))
    op.add_column('accounts', sa.Column('statement_due_days', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('accounts', 'statement_due_days')
    op.drop_column('accounts', 'statement_date')
    op.drop_column('accounts', 'balance_tracking_method')
    op.drop_column('accounts', 'credit_limit')
