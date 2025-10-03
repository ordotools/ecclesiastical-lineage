"""Fix is_bishop field for Bishop and Archbishop ranks

Revision ID: 2f11157c9eef
Revises: ffca03f86792
Create Date: 2025-09-29 13:37:25.613051

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2f11157c9eef'
down_revision = 'ffca03f86792'
branch_labels = None
depends_on = None


def upgrade():
    # Update Bishop and Archbishop ranks to have is_bishop=True
    op.execute("UPDATE rank SET is_bishop = true WHERE name IN ('Bishop', 'Archbishop')")


def downgrade():
    # Revert Bishop and Archbishop ranks to have is_bishop=False
    op.execute("UPDATE rank SET is_bishop = false WHERE name IN ('Bishop', 'Archbishop')")
