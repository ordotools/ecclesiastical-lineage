"""add organization_id to location table

Revision ID: 20251004_135343
Revises: 
Create Date: 2025-10-04 13:53:43.619038

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20251004_135343'
down_revision = '06b2f2a91947'
branch_labels = None
depends_on = None

def upgrade():
    # Add organization_id column to location table
    op.add_column('location', sa.Column('organization_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_location_organization_id', 'location', 'organization', ['organization_id'], ['id'])

def downgrade():
    # Remove the foreign key constraint and column
    op.drop_constraint('fk_location_organization_id', 'location', type_='foreignkey')
    op.drop_column('location', 'organization_id')
