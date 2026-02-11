"""Add year column and make date nullable for ordination/consecration (date unknown feature)

Revision ID: 20260211_date_unknown
Revises: 20260116_ordination_consecration_validity
Create Date: 2026-02-11

"""
from alembic import op
import sqlalchemy as sa

revision = '20260211_date_unknown'
down_revision = '20260116_ordination_consecration_validity'
branch_labels = None
depends_on = None


def upgrade():
    # Add year column to ordination and consecration
    op.add_column('ordination', sa.Column('year', sa.Integer(), nullable=True))
    op.add_column('consecration', sa.Column('year', sa.Integer(), nullable=True))

    # Make date nullable for both tables (existing rows keep date; no data change)
    op.alter_column(
        'ordination',
        'date',
        existing_type=sa.Date(),
        nullable=True,
    )
    op.alter_column(
        'consecration',
        'date',
        existing_type=sa.Date(),
        nullable=True,
    )


def downgrade():
    # Restore NOT NULL on date: set missing dates to placeholder
    op.execute("UPDATE ordination SET date = '1900-01-01' WHERE date IS NULL")
    op.execute("UPDATE consecration SET date = '1900-01-01' WHERE date IS NULL")

    op.alter_column(
        'ordination',
        'date',
        existing_type=sa.Date(),
        nullable=False,
    )
    op.alter_column(
        'consecration',
        'date',
        existing_type=sa.Date(),
        nullable=False,
    )

    op.drop_column('ordination', 'year')
    op.drop_column('consecration', 'year')
