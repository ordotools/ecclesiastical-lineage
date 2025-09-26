from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify
from models import db, Rank, Organization, User
from services.metadata import (
    edit_rank_service, delete_rank_service, add_organization_service,
    edit_organization_service, delete_organization_service
)

metadata_bp = Blueprint('metadata', __name__)

def get_current_user():
    if 'user_id' in session:
        return User.query.get(session['user_id'])
    return None

# Edit Rank
@metadata_bp.route('/metadata/rank/<int:rank_id>/edit', methods=['PUT', 'POST'])
def edit_rank(rank_id):
    # Redirect to editor metadata panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#metadata')
    else:
        flash('Please log in to access metadata management.', 'error')
        return redirect(url_for('auth.login'))

# Delete Rank
@metadata_bp.route('/metadata/rank/<int:rank_id>/delete', methods=['DELETE', 'POST'])
def delete_rank(rank_id):
    # Redirect to editor metadata panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#metadata')
    else:
        flash('Please log in to access metadata management.', 'error')
        return redirect(url_for('auth.login'))

# Add Organization
@metadata_bp.route('/metadata/organization/add', methods=['POST'])
def add_organization():
    # Redirect to editor metadata panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#metadata')
    else:
        flash('Please log in to access metadata management.', 'error')
        return redirect(url_for('auth.login'))

# Edit Organization
@metadata_bp.route('/metadata/organization/<int:org_id>/edit', methods=['PUT', 'POST'])
def edit_organization(org_id):
    # Redirect to editor metadata panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#metadata')
    else:
        flash('Please log in to access metadata management.', 'error')
        return redirect(url_for('auth.login'))

# Delete Organization
@metadata_bp.route('/metadata/organization/<int:org_id>/delete', methods=['DELETE', 'POST'])
def delete_organization(org_id):
    # Redirect to editor metadata panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#metadata')
    else:
        flash('Please log in to access metadata management.', 'error')
        return redirect(url_for('auth.login')) 