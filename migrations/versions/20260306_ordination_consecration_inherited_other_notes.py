"""Add is_inherited, is_other, optional_notes to ordination and consecration

Revision ID: 20260306_inherited_other
Revises: 1234818b7ca9
Create Date: 2026-03-06

"""
from alembic import op
import sqlalchemy as sa

revision = '20260306_inherited_other'
down_revision = '1234818b7ca9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'ordination',
        sa.Column('is_inherited', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'ordination',
        sa.Column('is_other', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'ordination',
        sa.Column('optional_notes', sa.Text(), nullable=True),
    )
    op.add_column(
        'consecration',
        sa.Column('is_inherited', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'consecration',
        sa.Column('is_other', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'consecration',
        sa.Column('optional_notes', sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column('ordination', 'optional_notes')
    op.drop_column('ordination', 'is_other')
    op.drop_column('ordination', 'is_inherited')
    op.drop_column('consecration', 'optional_notes')
    op.drop_column('consecration', 'is_other')
    op.drop_column('consecration', 'is_inherited')
