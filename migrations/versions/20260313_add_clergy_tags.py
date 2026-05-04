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
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'tag' not in existing_tables:
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

    if 'clergy_tags' not in existing_tables:
        op.create_table(
            'clergy_tags',
            sa.Column('clergy_id', sa.Integer(), nullable=False),
            sa.Column('tag_id', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(['clergy_id'], ['clergy.id']),
            sa.ForeignKeyConstraint(['tag_id'], ['tag.id']),
            sa.PrimaryKeyConstraint('clergy_id', 'tag_id'),
        )

    seed_tags = [
        ('invalid', 'Invalid', '#e74c3c'),
        ('valid', 'Valid', '#27ae60'),
        ('doubtful', 'Doubtful', '#f39c12'),
        ('sub_cond', 'sub cond.', '#8e44ad'),
        ('unlikely', 'Unlikely', '#95a5a6'),
    ]
    for name, label, color_hex in seed_tags:
        conn.execute(
            sa.text("""
                INSERT INTO tag (name, label, color_hex, is_system, created_at)
                VALUES (:name, :label, :color_hex, true, :now)
                ON CONFLICT (name) DO NOTHING
            """),
            {"name": name, "label": label, "color_hex": color_hex, "now": datetime.utcnow()},
        )


def downgrade():
    op.drop_table('clergy_tags')
    op.drop_table('tag')

