"""add visualization_settings table

Revision ID: 20260105_add_visualization_settings
Revises: 20260104_add_sprite_sheet_tables
Create Date: 2025-01-05 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from datetime import datetime
import json

# revision identifiers, used by Alembic.
revision = '20260105_add_visualization_settings'
down_revision = '20260104_add_sprite_sheet_tables'
branch_labels = None
depends_on = None

def upgrade():
    # Create visualization_settings table
    op.create_table('visualization_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('setting_key', sa.String(length=100), nullable=False),
        sa.Column('setting_value', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('setting_key')
    )
    
    # Insert default visualization styles
    default_styles = {
        'node': {
            'outer_radius': 30,
            'inner_radius': 24,
            'image_size': 48,
            'stroke_width': 3
        },
        'link': {
            'ordination_color': '#1c1c1c',  # BLACK_COLOR
            'consecration_color': '#11451e',  # GREEN_COLOR
            'stroke_width': 2
        },
        'label': {
            'font_size': 12,
            'color': '#ffffff',
            'dy': 35
        }
    }
    
    # Insert default styles record
    op.execute(
        sa.text("""
            INSERT INTO visualization_settings (setting_key, setting_value, updated_at)
            VALUES ('visualization_styles', :styles, :now)
        """).bindparam(
            styles=json.dumps(default_styles),
            now=datetime.utcnow()
        )
    )

def downgrade():
    # Drop visualization_settings table
    op.drop_table('visualization_settings')

