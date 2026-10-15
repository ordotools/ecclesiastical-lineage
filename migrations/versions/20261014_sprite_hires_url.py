"""Add hires_url to sprite_sheets

Revision ID: 20261014_sprite_hires_url
Revises: 20260726_religious_name
Create Date: 2026-10-14

"""
from alembic import op
import sqlalchemy as sa


revision = '20261014_sprite_hires_url'
down_revision = '20260726_religious_name'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('sprite_sheets', sa.Column('hires_url', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('sprite_sheets', 'hires_url')
