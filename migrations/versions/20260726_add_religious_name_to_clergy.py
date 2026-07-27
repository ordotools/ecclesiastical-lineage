"""Add religious_name field to clergy table

Revision ID: 20260726_religious_name
Revises: 20260313_refine_tag_system
Create Date: 2026-07-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = '20260726_religious_name'
down_revision = '20260313_refine_tag_system'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    inspector = inspect(connection)
    tables = inspector.get_table_names()

    if 'clergy' not in tables:
        return

    clergy_columns = [col['name'] for col in inspector.get_columns('clergy')]
    if 'religious_name' not in clergy_columns:
        with op.batch_alter_table('clergy', schema=None) as batch_op:
            batch_op.add_column(sa.Column('religious_name', sa.String(length=200), nullable=True))
    else:
        print("Column 'religious_name' already exists in clergy table")


def downgrade():
    connection = op.get_bind()
    inspector = inspect(connection)
    tables = inspector.get_table_names()

    if 'clergy' not in tables:
        return

    clergy_columns = [col['name'] for col in inspector.get_columns('clergy')]
    if 'religious_name' in clergy_columns:
        with op.batch_alter_table('clergy', schema=None) as batch_op:
            batch_op.drop_column('religious_name')
