"""update wiki_page table

Revision ID: 20251211_update_wiki_page
Revises: 20251210_add_wiki_page
Create Date: 2025-12-11 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251211_update_wiki_page'
down_revision = '20251210_add_wiki_page'
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to wiki_page table
    op.add_column('wiki_page', sa.Column('is_visible', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('wiki_page', sa.Column('category', sa.String(length=100), nullable=True))
    op.add_column('wiki_page', sa.Column('is_deleted', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('wiki_page', sa.Column('author_id', sa.Integer(), nullable=True))
    
    # Create foreign key for author_id
    op.create_foreign_key(None, 'wiki_page', 'user', ['author_id'], ['id'])
    
    # Remove server defaults after creation so they are just regular defaults in python
    op.alter_column('wiki_page', 'is_visible', server_default=None)
    op.alter_column('wiki_page', 'is_deleted', server_default=None)


def downgrade():
    # Remove foreign key first
    op.drop_constraint(None, 'wiki_page', type_='foreignkey')
    
    # Drop columns
    op.drop_column('wiki_page', 'author_id')
    op.drop_column('wiki_page', 'is_deleted')
    op.drop_column('wiki_page', 'category')
    op.drop_column('wiki_page', 'is_visible')
