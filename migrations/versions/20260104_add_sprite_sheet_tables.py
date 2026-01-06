"""add sprite sheet tables

Revision ID: 20260104_add_sprite_sheet_tables
Revises: 20251211_update_wiki_page
Create Date: 2026-01-04 22:40:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260104_add_sprite_sheet_tables'
down_revision = '20251211_update_wiki_page'
branch_labels = None
depends_on = None

def upgrade():
    # Create sprite_sheets table
    op.create_table('sprite_sheets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('object_key', sa.String(length=500), nullable=False),
        sa.Column('thumbnail_size', sa.Integer(), nullable=False, server_default='48'),
        sa.Column('images_per_row', sa.Integer(), nullable=False, server_default='20'),
        sa.Column('sprite_width', sa.Integer(), nullable=False),
        sa.Column('sprite_height', sa.Integer(), nullable=False),
        sa.Column('num_images', sa.Integer(), nullable=False),
        sa.Column('is_current', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create clergy_sprite_positions table
    op.create_table('clergy_sprite_positions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clergy_id', sa.Integer(), nullable=False),
        sa.Column('sprite_sheet_id', sa.Integer(), nullable=False),
        sa.Column('x_position', sa.Integer(), nullable=False),
        sa.Column('y_position', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['clergy_id'], ['clergy.id'], ),
        sa.ForeignKeyConstraint(['sprite_sheet_id'], ['sprite_sheets.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('clergy_id', 'sprite_sheet_id', name='_clergy_sprite_uc')
    )

def downgrade():
    # Drop tables in reverse order
    op.drop_table('clergy_sprite_positions')
    op.drop_table('sprite_sheets')

