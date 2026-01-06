"""add_clergy_status_system

Revision ID: c8646ef3459c
Revises: 20251004_135343
Create Date: 2025-10-13 14:16:10.568969

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = 'c8646ef3459c'
down_revision = '20251004_135343'
branch_labels = None
depends_on = None


def upgrade():
    # Get connection to check if tables exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    
    # Create status table only if it doesn't exist
    if 'status' not in existing_tables:
        op.create_table(
            'status',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=50), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('icon', sa.String(length=50), nullable=False),
            sa.Column('color', sa.String(length=7), nullable=False),
            sa.Column('badge_position', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('name')
        )

    # Create clergy_statuses association table only if it doesn't exist
    if 'clergy_statuses' not in existing_tables:
        op.create_table(
            'clergy_statuses',
            sa.Column('clergy_id', sa.Integer(), nullable=False),
            sa.Column('status_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('created_by', sa.Integer(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(['clergy_id'], ['clergy.id'], ),
            sa.ForeignKeyConstraint(['status_id'], ['status.id'], ),
            sa.ForeignKeyConstraint(['created_by'], ['user.id'], ),
            sa.PrimaryKeyConstraint('clergy_id', 'status_id')
        )

    # Insert initial status data only if status table is empty
    result = conn.execute(sa.text("SELECT COUNT(*) FROM status"))
    count = result.scalar()
    
    if count == 0:
        status_table = sa.table('status',
            sa.column('name', sa.String),
            sa.column('description', sa.Text),
            sa.column('icon', sa.String),
            sa.column('color', sa.String),
            sa.column('badge_position', sa.Integer),
            sa.column('created_at', sa.DateTime)
        )

        op.bulk_insert(status_table, [
        {
            'name': 'invalid',
            'description': 'Ordination or consecration is invalid',
            'icon': 'fa-times-circle',
            'color': '#e74c3c',
            'badge_position': 0,
            'created_at': datetime.utcnow()
        },
        {
            'name': 'doubtful',
            'description': 'Ordination or consecration is doubtful',
            'icon': 'fa-question-circle',
            'color': '#f39c12',
            'badge_position': 1,
            'created_at': datetime.utcnow()
        },
        {
            'name': 'not recommended',
            'description': 'Not recommended for lineage',
            'icon': 'fa-hand-paper',
            'color': '#d68910',
            'badge_position': 2,
            'created_at': datetime.utcnow()
        },
        {
            'name': 'unknown',
            'description': 'Status or details unknown',
            'icon': 'fa-circle-question',
            'color': '#95a5a6',
            'badge_position': 3,
            'created_at': datetime.utcnow()
        },
        {
            'name': 'forbidden',
            'description': 'Forbidden or excommunicated',
            'icon': 'fa-ban',
            'color': '#c0392b',
            'badge_position': 4,
            'created_at': datetime.utcnow()
        },
        {
            'name': 'pending',
            'description': 'Pending verification',
            'icon': 'fa-clock',
            'color': '#3498db',
            'badge_position': 5,
            'created_at': datetime.utcnow()
        },
        {
            'name': 'deceased',
            'description': 'Deceased',
            'icon': 'fa-cross',
            'color': '#34495e',
            'badge_position': 6,
            'created_at': datetime.utcnow()
        },
        {
            'name': 'retired',
            'description': 'Retired from active ministry',
            'icon': 'fa-person-walking',
            'color': '#7f8c8d',
            'badge_position': 7,
            'created_at': datetime.utcnow()
        },
        {
            'name': 'resigned',
            'description': 'Resigned from position',
            'icon': 'fa-door-open',
            'color': '#95a5a6',
            'badge_position': 0,
            'created_at': datetime.utcnow()
        }
        ])


def downgrade():
    # Drop tables in reverse order
    op.drop_table('clergy_statuses')
    op.drop_table('status')
