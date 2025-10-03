"""Add deleted column to location table

Revision ID: simple_add_location_deleted
Revises: 4c4903a27386
Create Date: 2025-10-03 20:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'simple_add_location_deleted'
down_revision = '4c4903a27386'
branch_labels = None
depends_on = None


def upgrade():
    # Simply add the deleted column to location table
    with op.batch_alter_table('location', schema=None) as batch_op:
        batch_op.add_column(sa.Column('deleted', sa.Boolean(), nullable=True, server_default='false'))


def downgrade():
    # Remove the deleted column from location table
    with op.batch_alter_table('location', schema=None) as batch_op:
        batch_op.drop_column('deleted')
