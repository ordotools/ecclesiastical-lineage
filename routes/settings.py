from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify
from models import db, User, Role, AdminInvite, AuditLog, ClergyComment, Clergy, Rank, Organization
from utils import log_audit_event, validate_password
from datetime import datetime, timedelta
from uuid import uuid4

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/settings')
def settings():
    # Redirect to editor settings panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#settings')
    else:
        flash('Please log in to access settings.', 'error')
        return redirect(url_for('auth.login'))

@settings_bp.route('/settings/invite', methods=['POST'])
def generate_admin_invite():
    # Redirect to editor settings panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#settings')
    else:
        flash('Please log in to access settings.', 'error')
        return redirect(url_for('auth.login'))

@settings_bp.route('/settings/change-password', methods=['POST'])
def change_password():
    # Redirect to editor settings panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#settings')
    else:
        flash('Please log in to access settings.', 'error')
        return redirect(url_for('auth.login')) 

@settings_bp.route('/metadata')
def metadata():
    # Redirect to editor metadata panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#metadata')
    else:
        flash('Please log in to access metadata management.', 'error')
        return redirect(url_for('auth.login')) 

@settings_bp.route('/metadata/rank/add', methods=['POST'])
def add_rank():
    # Redirect to editor metadata panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#metadata')
    else:
        flash('Please log in to access metadata management.', 'error')
        return redirect(url_for('auth.login'))

@settings_bp.route('/user_management')
def user_management():
    # Redirect to editor user management panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#user-management')
    else:
        flash('Please log in to access user management.', 'error')
        return redirect(url_for('auth.login'))

@settings_bp.route('/comments_management')
def comments_management():
    # Redirect to editor comments management panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#comments-management')
    else:
        flash('Please log in to access comments management.', 'error')
        return redirect(url_for('auth.login'))

@settings_bp.route('/audit_logs')
def audit_logs():
    # Redirect to editor audit logs panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#audit-logs')
    else:
        flash('Please log in to access audit logs.', 'error')
        return redirect(url_for('auth.login')) 