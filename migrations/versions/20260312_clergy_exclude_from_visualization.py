"""Add exclude_from_visualization flag to clergy and backfill from lineage_roots

Revision ID: 20260312_clergy_exclude
Revises: 20260306_inherited_other
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa


revision = '20260312_clergy_exclude'
down_revision = '20260306_inherited_other'
branch_labels = None
depends_on = None


def upgrade():
    # Add exclude_from_visualization column to clergy
    op.add_column(
        'clergy',
        sa.Column('exclude_from_visualization', sa.Boolean(), nullable=False, server_default='false'),
    )

    # Backfill from lineage_roots if the table exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'lineage_roots' in inspector.get_table_names():
        op.execute(
            sa.text(
                """
                UPDATE clergy
                SET exclude_from_visualization = true
                WHERE id IN (SELECT clergy_id FROM lineage_roots)
                """
            )
        )


def downgrade():
    op.drop_column('clergy', 'exclude_from_visualization')

