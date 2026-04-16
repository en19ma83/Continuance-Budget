"""add_asset_loan_linkage

Revision ID: a9e52f7cd0c8
Revises: 2d91ed86db62
Create Date: 2026-04-15 01:41:30.144345

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9e52f7cd0c8'
down_revision: Union[str, None] = '2d91ed86db62'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('assets', sa.Column('linked_loan_id', sa.UUID(), nullable=True))
    op.create_foreign_key(None, 'assets', 'assets', ['linked_loan_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(None, 'assets', type_='foreignkey')
    op.drop_column('assets', 'linked_loan_id')
