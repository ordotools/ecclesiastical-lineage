"""Add details_unknown flag to ordination and consecration

Revision ID: 20260312_details_unknown
Revises: 20260312_clergy_exclude
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa


revision = '20260312_details_unknown'
down_revision = '20260312_clergy_exclude'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'ordination',
        sa.Column('details_unknown', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'consecration',
        sa.Column('details_unknown', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade():
    op.drop_column('consecration', 'details_unknown')
    op.drop_column('ordination', 'details_unknown')

