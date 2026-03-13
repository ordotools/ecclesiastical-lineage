"""Add Tag model and clergy-tags association

Revision ID: 20260313_add_clergy_tags
Revises: 20260312_details_unknown
Create Date: 2026-03-13

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '20260313_add_clergy_tags'
down_revision = '20260312_details_unknown'
branch_labels = None
depends_on = None


def upgrade():
    # Create tag table
    op.create_table(
        'tag',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=False),
        sa.Column('color_hex', sa.String(length=7), nullable=False),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('name'),
    )

    # Create clergy_tags association table
    op.create_table(
        'clergy_tags',
        sa.Column('clergy_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['clergy_id'], ['clergy.id']),
        sa.ForeignKeyConstraint(['tag_id'], ['tag.id']),
        sa.PrimaryKeyConstraint('clergy_id', 'tag_id'),
    )

    # Seed default system tags for validity-related states
    conn = op.get_bind()
    tag_table = sa.table(
        'tag',
        sa.column('name', sa.String),
        sa.column('label', sa.String),
        sa.column('color_hex', sa.String),
        sa.column('is_system', sa.Boolean),
        sa.column('created_at', sa.DateTime),
    )

    now = datetime.utcnow()
    op.bulk_insert(
        tag_table,
        [
            {
                'name': 'invalid',
                'label': 'Invalid',
                'color_hex': '#e74c3c',
                'is_system': True,
                'created_at': now,
            },
            {
                'name': 'valid',
                'label': 'Valid',
                'color_hex': '#27ae60',
                'is_system': True,
                'created_at': now,
            },
            {
                'name': 'doubtful',
                'label': 'Doubtful',
                'color_hex': '#f39c12',
                'is_system': True,
                'created_at': now,
            },
            {
                'name': 'sub_cond',
                'label': 'sub cond.',
                'color_hex': '#8e44ad',
                'is_system': True,
                'created_at': now,
            },
            {
                'name': 'unlikely',
                'label': 'Unlikely',
                'color_hex': '#95a5a6',
                'is_system': True,
                'created_at': now,
            },
        ],
    )


def downgrade():
    op.drop_table('clergy_tags')
    op.drop_table('tag')

