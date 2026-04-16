"""add_accounts_and_transfers

Revision ID: e1475721a72d
Revises: e042d86e9c6e
Create Date: 2026-04-14 10:18:06.369657

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1475721a72d'
down_revision: Union[str, None] = 'e042d86e9c6e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create accounts table
    op.create_table('accounts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=True),
        sa.Column('entity', sa.String(), nullable=False),
        sa.Column('is_on_budget', sa.Boolean(), nullable=True),
        sa.Column('starting_balance', sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_accounts_id'), 'accounts', ['id'], unique=False)
    
    # Update recurring_rules
    op.add_column('recurring_rules', sa.Column('account_id', sa.UUID(), nullable=True))
    op.add_column('recurring_rules', sa.Column('transfer_to_account_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_rules_account', 'recurring_rules', 'accounts', ['account_id'], ['id'])
    op.create_foreign_key('fk_rules_transfer', 'recurring_rules', 'accounts', ['transfer_to_account_id'], ['id'])
    
    # Update ledger_entries
    op.add_column('ledger_entries', sa.Column('account_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_ledger_account', 'ledger_entries', 'accounts', ['account_id'], ['id'])
    op.drop_column('ledger_entries', 'entity')
    
    # Update statement_transactions
    op.add_column('statement_transactions', sa.Column('account_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_stmt_account', 'statement_transactions', 'accounts', ['account_id'], ['id'])


def downgrade() -> None:
    op.drop_column('statement_transactions', 'account_id')
    op.add_column('ledger_entries', sa.Column('entity', sa.String(), nullable=True))
    op.drop_column('ledger_entries', 'account_id')
    op.drop_column('recurring_rules', 'transfer_to_account_id')
    op.drop_column('recurring_rules', 'account_id')
    op.drop_index(op.f('ix_accounts_id'), table_name='accounts')
    op.drop_table('accounts')
