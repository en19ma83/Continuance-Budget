"""Add multi-user isolation: user_id on data tables, email on users

Revision ID: b1c2d3e4f5a6
Revises: f3a1b2c4d5e6
Create Date: 2026-04-17 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'f3a1b2c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('email', sa.String(), nullable=True))
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    op.add_column('accounts', sa.Column('user_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_accounts_user_id'), 'accounts', ['user_id'], unique=False)
    op.create_foreign_key('fk_accounts_user_id', 'accounts', 'users', ['user_id'], ['id'])

    op.add_column('assets', sa.Column('user_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_assets_user_id'), 'assets', ['user_id'], unique=False)
    op.create_foreign_key('fk_assets_user_id', 'assets', 'users', ['user_id'], ['id'])

    op.add_column('recurring_rules', sa.Column('user_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_recurring_rules_user_id'), 'recurring_rules', ['user_id'], unique=False)
    op.create_foreign_key('fk_recurring_rules_user_id', 'recurring_rules', 'users', ['user_id'], ['id'])

    op.add_column('ledger_entries', sa.Column('user_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_ledger_entries_user_id'), 'ledger_entries', ['user_id'], unique=False)
    op.create_foreign_key('fk_ledger_entries_user_id', 'ledger_entries', 'users', ['user_id'], ['id'])

    op.add_column('statement_transactions', sa.Column('user_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_statement_transactions_user_id'), 'statement_transactions', ['user_id'], unique=False)
    op.create_foreign_key('fk_statement_transactions_user_id', 'statement_transactions', 'users', ['user_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_statement_transactions_user_id', 'statement_transactions', type_='foreignkey')
    op.drop_index(op.f('ix_statement_transactions_user_id'), table_name='statement_transactions')
    op.drop_column('statement_transactions', 'user_id')

    op.drop_constraint('fk_ledger_entries_user_id', 'ledger_entries', type_='foreignkey')
    op.drop_index(op.f('ix_ledger_entries_user_id'), table_name='ledger_entries')
    op.drop_column('ledger_entries', 'user_id')

    op.drop_constraint('fk_recurring_rules_user_id', 'recurring_rules', type_='foreignkey')
    op.drop_index(op.f('ix_recurring_rules_user_id'), table_name='recurring_rules')
    op.drop_column('recurring_rules', 'user_id')

    op.drop_constraint('fk_assets_user_id', 'assets', type_='foreignkey')
    op.drop_index(op.f('ix_assets_user_id'), table_name='assets')
    op.drop_column('assets', 'user_id')

    op.drop_constraint('fk_accounts_user_id', 'accounts', type_='foreignkey')
    op.drop_index(op.f('ix_accounts_user_id'), table_name='accounts')
    op.drop_column('accounts', 'user_id')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_column('users', 'email')
