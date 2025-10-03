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
    # Add the deleted column to location table if it doesn't exist
    from sqlalchemy import inspect
    
    # Get connection to check existing columns
    connection = op.get_bind()
    inspector = inspect(connection)
    tables = inspector.get_table_names()
    
    # Check if location table exists and add column if it doesn't exist
    if 'location' in tables:
        location_columns = [col['name'] for col in inspector.get_columns('location')]
        
        if 'deleted' not in location_columns:
            with op.batch_alter_table('location', schema=None) as batch_op:
                batch_op.add_column(sa.Column('deleted', sa.Boolean(), nullable=True, server_default='false'))
        else:
            print("⚠️  Column 'deleted' already exists in location table")


def downgrade():
    # Remove the deleted column from location table if it exists
    from sqlalchemy import inspect
    
    # Get connection to check existing columns
    connection = op.get_bind()
    inspector = inspect(connection)
    tables = inspector.get_table_names()
    
    # Check if location table exists and remove column if it exists
    if 'location' in tables:
        location_columns = [col['name'] for col in inspector.get_columns('location')]
        
        if 'deleted' in location_columns:
            with op.batch_alter_table('location', schema=None) as batch_op:
                batch_op.drop_column('deleted')
        else:
            print("⚠️  Column 'deleted' does not exist in location table")
