"""update ordination and consecration validity fields

Revision ID: 20260116_ordination_consecration_validity
Revises: 20260105_add_visualization_settings
Create Date: 2026-01-16 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260116_ordination_consecration_validity'
down_revision = '20260105_add_visualization_settings'
branch_labels = None
depends_on = None

def upgrade():
    # Update ordination table
    # First, add the new column
    op.add_column('ordination', sa.Column('is_doubtfully_valid', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('ordination', sa.Column('is_doubtful_event', sa.Boolean(), nullable=False, server_default='false'))
    
    # Migrate existing data: copy is_doubtful to is_doubtfully_valid
    op.execute("""
        UPDATE ordination 
        SET is_doubtfully_valid = is_doubtful 
        WHERE is_doubtful = true
    """)
    
    # Drop the old column
    op.drop_column('ordination', 'is_doubtful')
    
    # Update consecration table
    # First, add the new columns
    op.add_column('consecration', sa.Column('is_doubtfully_valid', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('consecration', sa.Column('is_doubtful_event', sa.Boolean(), nullable=False, server_default='false'))
    
    # Migrate existing data: copy is_doubtful to is_doubtfully_valid
    op.execute("""
        UPDATE consecration 
        SET is_doubtfully_valid = is_doubtful 
        WHERE is_doubtful = true
    """)
    
    # Drop the old column
    op.drop_column('consecration', 'is_doubtful')

def downgrade():
    # Revert consecration table
    op.add_column('consecration', sa.Column('is_doubtful', sa.Boolean(), nullable=False, server_default='false'))
    op.execute("""
        UPDATE consecration 
        SET is_doubtful = is_doubtfully_valid 
        WHERE is_doubtfully_valid = true
    """)
    op.drop_column('consecration', 'is_doubtful_event')
    op.drop_column('consecration', 'is_doubtfully_valid')
    
    # Revert ordination table
    op.add_column('ordination', sa.Column('is_doubtful', sa.Boolean(), nullable=False, server_default='false'))
    op.execute("""
        UPDATE ordination 
        SET is_doubtful = is_doubtfully_valid 
        WHERE is_doubtfully_valid = true
    """)
    op.drop_column('ordination', 'is_doubtful_event')
    op.drop_column('ordination', 'is_doubtfully_valid')
