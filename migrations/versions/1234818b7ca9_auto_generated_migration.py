"""Auto-generated migration

Revision ID: 1234818b7ca9
Revises: 20260216_lineage_roots
Create Date: 2026-03-04 10:10:29.943641

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '1234818b7ca9'
down_revision = '20260216_lineage_roots'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'validation_rules' in inspector.get_table_names():
        op.drop_table('validation_rules')


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'validation_rules' not in inspector.get_table_names():
        op.create_table('validation_rules',
            sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
            sa.Column('name', sa.VARCHAR(length=200), autoincrement=False, nullable=False),
            sa.Column('scope', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
            sa.Column('target_field', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
            sa.Column('comparison_field', sa.VARCHAR(length=100), autoincrement=False, nullable=True),
            sa.Column('operator', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
            sa.Column('comparison_value', sa.VARCHAR(length=255), autoincrement=False, nullable=True),
            sa.Column('severity', sa.VARCHAR(length=20), autoincrement=False, nullable=False),
            sa.Column('message', sa.TEXT(), autoincrement=False, nullable=False),
            sa.Column('enabled', sa.BOOLEAN(), autoincrement=False, nullable=False),
            sa.Column('created_by', sa.INTEGER(), autoincrement=False, nullable=True),
            sa.Column('updated_by', sa.INTEGER(), autoincrement=False, nullable=True),
            sa.Column('created_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
            sa.Column('updated_at', postgresql.TIMESTAMP(), autoincrement=False, nullable=True),
            sa.ForeignKeyConstraint(['created_by'], ['user.id'], name=op.f('validation_rules_created_by_fkey')),
            sa.ForeignKeyConstraint(['updated_by'], ['user.id'], name=op.f('validation_rules_updated_by_fkey')),
            sa.PrimaryKeyConstraint('id', name=op.f('validation_rules_pkey'))
        )
