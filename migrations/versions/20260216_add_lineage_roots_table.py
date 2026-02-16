"""Add lineage_roots table

Revision ID: 20260216_lineage_roots
Revises: 20260211_date_unknown
Create Date: 2026-02-16

"""
from alembic import op
import sqlalchemy as sa


revision = '20260216_lineage_roots'
down_revision = '20260211_date_unknown'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'lineage_roots' not in inspector.get_table_names():
        op.create_table(
            'lineage_roots',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('clergy_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['clergy_id'], ['clergy.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('clergy_id', name='uq_lineage_roots_clergy_id')
        )


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'lineage_roots' in inspector.get_table_names():
        op.drop_table('lineage_roots')
