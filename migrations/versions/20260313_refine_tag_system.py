"""Refine validity-related tag system

Revision ID: 20260313_refine_tag_system
Revises: 20260313_add_clergy_tags
Create Date: 2026-03-13

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


revision = "20260313_refine_tag_system"
down_revision = "20260313_add_clergy_tags"
branch_labels = None
depends_on = None


OLD_SYSTEM_TAG_NAMES = ("invalid", "doubtful", "sub_cond", "unlikely")


def _ensure_tag(conn, name, label, color_hex, is_system):
    """Create or update a tag row with the given properties."""
    result = conn.execute(
        sa.text("SELECT id FROM tag WHERE name = :name"),
        {"name": name},
    ).fetchone()

    now = datetime.utcnow()

    if result is None:
        conn.execute(
            sa.text(
                """
                INSERT INTO tag (name, label, color_hex, is_system, created_at)
                VALUES (:name, :label, :color_hex, :is_system, :created_at)
                """
            ),
            {
                "name": name,
                "label": label,
                "color_hex": color_hex,
                "is_system": is_system,
                "created_at": now,
            },
        )
    else:
        conn.execute(
            sa.text(
                """
                UPDATE tag
                SET label = :label,
                    color_hex = :color_hex,
                    is_system = :is_system
                WHERE id = :id
                """
            ),
            {
                "id": result[0],
                "label": label,
                "color_hex": color_hex,
                "is_system": is_system,
            },
        )


def upgrade():
    conn = op.get_bind()

    # First, remove any clergy_tags entries that reference the old system tags.
    conn.execute(
        sa.text(
            """
            DELETE FROM clergy_tags
            WHERE tag_id IN (
                SELECT id FROM tag WHERE name IN :old_names
            )
            """
        ).bindparams(sa.bindparam("old_names", expanding=True)),
        {"old_names": list(OLD_SYSTEM_TAG_NAMES)},
    )

    # Remove the old system tag rows themselves.
    conn.execute(
        sa.text(
            """
            DELETE FROM tag
            WHERE name IN :old_names
            """
        ).bindparams(sa.bindparam("old_names", expanding=True)),
        {"old_names": list(OLD_SYSTEM_TAG_NAMES)},
    )

    # Ensure the existing "valid" tag remains a system tag with the desired appearance.
    _ensure_tag(
        conn,
        name="valid",
        label="Valid",
        color_hex="#27ae60",
        is_system=True,
    )

    # New system tags for priestly and episcopal validity states.
    _ensure_tag(
        conn,
        name="invalid_priest",
        label="Invalid Priest",
        color_hex="#c0392b",
        is_system=True,
    )
    _ensure_tag(
        conn,
        name="invalid_bishop",
        label="Invalid Bishop",
        color_hex="#e74c3c",
        is_system=True,
    )
    _ensure_tag(
        conn,
        name="doubtful_priest",
        label="Doubtful Priest",
        color_hex="#e67e22",
        is_system=True,
    )
    _ensure_tag(
        conn,
        name="doubtful_bishop",
        label="Doubtful Bishop",
        color_hex="#f39c12",
        is_system=True,
    )

    # User-only tag.
    _ensure_tag(
        conn,
        name="uneducated",
        label="Uneducated",
        color_hex="#7f8c8d",
        is_system=False,
    )


def downgrade():
    conn = op.get_bind()

    # Remove clergy_tags entries for the new tags (including user tag).
    conn.execute(
        sa.text(
            """
            DELETE FROM clergy_tags
            WHERE tag_id IN (
                SELECT id FROM tag
                WHERE name IN :names
            )
            """
        ).bindparams(sa.bindparam("names", expanding=True)),
        {
            "names": [
                "invalid_priest",
                "invalid_bishop",
                "doubtful_priest",
                "doubtful_bishop",
                "uneducated",
            ]
        },
    )

    # Delete the new tag rows.
    conn.execute(
        sa.text(
            """
            DELETE FROM tag
            WHERE name IN :names
            """
        ).bindparams(sa.bindparam("names", expanding=True)),
        {
            "names": [
                "invalid_priest",
                "invalid_bishop",
                "doubtful_priest",
                "doubtful_bishop",
                "uneducated",
            ]
        },
    )

    # Recreate the old system tags that were removed.
    now = datetime.utcnow()
    for name, label, color in [
        ("invalid", "Invalid", "#e74c3c"),
        ("doubtful", "Doubtful", "#f39c12"),
        ("sub_cond", "sub cond.", "#8e44ad"),
        ("unlikely", "Unlikely", "#95a5a6"),
    ]:
        _ensure_tag(
            conn,
            name=name,
            label=label,
            color_hex=color,
            is_system=True,
        )

