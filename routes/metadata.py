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
    user = get_current_user()
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.is_json
    data = request.get_json() if is_ajax else request.form
    result = edit_rank_service(rank_id, data, user)
    if is_ajax:
        return jsonify(result), (200 if result.get('success') else 400)
    flash(result['message'], 'success' if result.get('success') else 'error')
    return redirect(url_for('settings.metadata'))

# Delete Rank
@metadata_bp.route('/metadata/rank/<int:rank_id>/delete', methods=['DELETE', 'POST'])
def delete_rank(rank_id):
    user = get_current_user()
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.is_json
    result = delete_rank_service(rank_id, user)
    if is_ajax:
        return jsonify(result), (200 if result.get('success') else 400)
    flash(result['message'], 'success' if result.get('success') else 'error')
    return redirect(url_for('settings.metadata'))

# Add Organization
@metadata_bp.route('/metadata/organization/add', methods=['POST'])
def add_organization():
    user = get_current_user()
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.is_json
    data = request.get_json() if is_ajax else request.form
    result = add_organization_service(data, user)
    if is_ajax:
        return jsonify(result), (200 if result.get('success') else 400)
    flash(result['message'], 'success' if result.get('success') else 'error')
    return redirect(url_for('settings.metadata'))

# Edit Organization
@metadata_bp.route('/metadata/organization/<int:org_id>/edit', methods=['PUT', 'POST'])
def edit_organization(org_id):
    user = get_current_user()
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.is_json
    data = request.get_json() if is_ajax else request.form
    result = edit_organization_service(org_id, data, user)
    if is_ajax:
        return jsonify(result), (200 if result.get('success') else 400)
    flash(result['message'], 'success' if result.get('success') else 'error')
    return redirect(url_for('settings.metadata'))

# Delete Organization
@metadata_bp.route('/metadata/organization/<int:org_id>/delete', methods=['DELETE', 'POST'])
def delete_organization(org_id):
    user = get_current_user()
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.is_json
    result = delete_organization_service(org_id, user)
    if is_ajax:
        return jsonify(result), (200 if result.get('success') else 400)
    flash(result['message'], 'success' if result.get('success') else 'error')
    return redirect(url_for('settings.metadata')) 