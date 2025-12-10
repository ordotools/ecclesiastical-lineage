"""add wiki_page table

Revision ID: 20251210_add_wiki_page
Revises: c8646ef3459c
Create Date: 2025-12-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251210_add_wiki_page'
down_revision = 'c8646ef3459c'
branch_labels = None
depends_on = None

def upgrade():
    # Create wiki_page table
    op.create_table('wiki_page',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('clergy_id', sa.Integer(), nullable=True),
        sa.Column('markdown', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('edit_count', sa.Integer(), nullable=True, default=0),
        sa.Column('last_editor_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['clergy_id'], ['clergy.id'], ),
        sa.ForeignKeyConstraint(['last_editor_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    # Drop wiki_page table
    op.drop_table('wiki_page')
