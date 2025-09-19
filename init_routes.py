from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify, render_template_string
from datetime import datetime, timedelta
from uuid import uuid4
import json, re, base64
from functools import wraps
from models import db, User, Role, Permission, Clergy, Rank, Organization, AdminInvite, ClergyComment, AuditLog
from utils import (
    require_permission,
    getContrastColor,
    getBorderStyle,
    from_json,
    log_audit_event,
    validate_password,
    audit_log
)

routes = Blueprint('routes', __name__)

# --- Utility Functions and Decorators ---


# --- Register Jinja2 filters and globals (to be done in app.py after Blueprint registration) ---

# --- All Route Functions (converted from @app.route to @routes.route) ---

# (All route functions from the original app.py are pasted here, with @routes.route and url_for('routes.<endpoint>'))
# This includes login, dashboard, logout, clergy_list, clergy_filter_partial, add_clergy, view_clergy, clergy_json, edit_clergy, delete_clergy, metadata, add_rank, edit_rank, delete_rank, add_organization, edit_organization, delete_organization, lineage_visualization, settings, generate_admin_invite, change_password, admin_invite_signup, clergy_modal_add, clergy_modal_edit, clergy_modal_comment, init_database_endpoint, user_management, add_user, edit_user, delete_user, clergy_comments, add_clergy_comment, comments_management, resolve_comment, view_resolved_comments, audit_logs, etc.
# All @app.route should be @routes.route, and all url_for('...') should be url_for('routes....') where appropriate. 
# --- AUTO-GENERATED ROUTES START ---
@routes.route('/favicon.ico')
def favicon():
    """Serve favicon to prevent 404 errors"""
    return '', 204

@routes.route('/')
def index():
    # Check if user is logged in
    if 'user_id' in session:
        # User is logged in, redirect to dashboard
        return redirect(url_for('routes.dashboard'))
    else:
        # User is not logged in, redirect to lineage visualization
        return redirect(url_for('routes.lineage_visualization'))

@routes.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        flash('Please log in to access the dashboard.', 'error')
        return redirect(url_for('routes.login'))
    
    user = User.query.get(session['user_id'])
    if not user:
        session.clear()
        flash('User not found. Please log in again.', 'error')
        return redirect(url_for('routes.login'))
    
    return render_template('dashboard.html', user=user) 

@routes.route('/lineage_visualization')
def lineage_visualization():
    # Allow both logged-in and non-logged-in users to view lineage visualization
    # Get all clergy for the visualization
    all_clergy = Clergy.query.all()
    
    # Get all organizations and ranks for color lookup
    organizations = {org.name: org.color for org in Organization.query.all()}
    ranks = {rank.name: rank.color for rank in Rank.query.all()}

    # SVG placeholder (simple person icon, base64-encoded)
    placeholder_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="24" r="14" fill="#bdc3c7"/><ellipse cx="32" cy="50" rx="20" ry="12" fill="#bdc3c7"/></svg>'''
    import base64
    placeholder_data_url = 'data:image/svg+xml;base64,' + base64.b64encode(placeholder_svg.encode('utf-8')).decode('utf-8')

    # Prepare data for D3.js
    nodes = []
    links = []
    
    # Create nodes for each clergy, including both colors and image
    for clergy in all_clergy:
        org_color = organizations.get(clergy.organization) or '#2c3e50'
        rank_color = ranks.get(clergy.rank) or '#888888'
        nodes.append({
            'id': clergy.id,
            'name': clergy.name,
            'rank': clergy.rank,
            'organization': clergy.organization,
            'org_color': org_color,
            'rank_color': rank_color,
            'image_url': placeholder_data_url
        })
    
    # Create links for ordinations (black arrows)
    for clergy in all_clergy:
        if clergy.ordaining_bishop_id:
            links.append({
                'source': clergy.ordaining_bishop_id,
                'target': clergy.id,
                'type': 'ordination',
                'date': clergy.date_of_ordination.strftime('%Y-%m-%d') if clergy.date_of_ordination else 'Date unknown',
                'color': '#000000'
            })
    
    # Create links for consecrations (green arrows)
    for clergy in all_clergy:
        if clergy.consecrator_id:
            links.append({
                'source': clergy.consecrator_id,
                'target': clergy.id,
                'type': 'consecration',
                'date': clergy.date_of_consecration.strftime('%Y-%m-%d') if clergy.date_of_consecration else 'Date unknown',
                'color': '#27ae60'
            })
    
    # Create links for co-consecrations (dotted green arrows)
    for clergy in all_clergy:
        if clergy.co_consecrators:
            co_consecrator_ids = clergy.get_co_consecrators()
            for co_consecrator_id in co_consecrator_ids:
                links.append({
                    'source': co_consecrator_id,
                    'target': clergy.id,
                    'type': 'co-consecration',
                    'date': clergy.date_of_consecration.strftime('%Y-%m-%d') if clergy.date_of_consecration else 'Date unknown',
                    'color': '#27ae60',
                    'dashed': True
                })
    
    return render_template('lineage_visualization.html', 
                         nodes=json.dumps(nodes), 
                         links=json.dumps(links)) 