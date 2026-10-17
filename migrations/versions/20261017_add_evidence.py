"""Add evidence table (sources attached to clergy dates and event fields)

Revision ID: 20261017_add_evidence
Revises: 20261014_sprite_hires_url
Create Date: 2026-10-17

"""
from alembic import op
import sqlalchemy as sa


revision = '20261017_add_evidence'
down_revision = '20261014_sprite_hires_url'
branch_labels = None
depends_on = None


def upgrade():
    # app startup's db.create_all() may have made it already (from models.Evidence, same shape).
    if 'evidence' in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        'evidence',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('clergy_id', sa.Integer(), sa.ForeignKey('clergy.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ordination_id', sa.Integer(), sa.ForeignKey('ordination.id', ondelete='CASCADE'), nullable=True),
        sa.Column('consecration_id', sa.Integer(), sa.ForeignKey('consecration.id', ondelete='CASCADE'), nullable=True),
        sa.Column('field', sa.String(40), nullable=False),
        sa.Column('kind', sa.String(10), nullable=False),
        sa.Column('url', sa.Text(), nullable=True),
        sa.Column('thumb_url', sa.Text(), nullable=True),
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('user.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.CheckConstraint("kind IN ('photo', 'pdf', 'link', 'text')", name='ck_evidence_kind'),
        sa.CheckConstraint('ordination_id IS NULL OR consecration_id IS NULL', name='ck_evidence_one_event'),
    )
    op.create_index('ix_evidence_clergy_id', 'evidence', ['clergy_id'])


def downgrade():
    op.drop_index('ix_evidence_clergy_id', table_name='evidence')
    op.drop_table('evidence')
