"""Shared editor blueprint; route modules register on this to keep url_for('editor.<endpoint>')."""
from flask import Blueprint

editor_bp = Blueprint('editor', __name__)
