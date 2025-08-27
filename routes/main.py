from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify, current_app
from services import clergy as clergy_service
from utils import audit_log, require_permission, generate_breadcrumbs, log_audit_event
from models import Clergy, ClergyComment, User, db, Organization, Rank
import json
import base64

main_bp = Blueprint('main', __name__)

# Main landing page
@main_bp.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('auth.dashboard'))
    return render_template('login.html')

# Lineage visualization
@main_bp.route('/lineage_visualization')
def lineage_visualization():
    try:
        # Allow both logged-in and non-logged-in users to view lineage visualization
        # Get all clergy for the visualization
        all_clergy = Clergy.query.all()
        
        # Get all organizations and ranks for color lookup
        organizations = {org.name: org.color for org in Organization.query.all()}
        ranks = {rank.name: rank.color for rank in Rank.query.all()}

        # SVG placeholder (simple person icon, base64-encoded)
        placeholder_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="24" r="14" fill="#bdc3c7"/><ellipse cx="32" cy="50" rx="20" ry="12" fill="#bdc3c7"/></svg>'''
        placeholder_data_url = 'data:image/svg+xml;base64,' + base64.b64encode(placeholder_svg.encode('utf-8')).decode('utf-8')

        # Prepare data for D3.js
        nodes = []
        links = []
        
        # Create nodes for each clergy, including both colors and image
        for clergy in all_clergy:
            org_color = organizations.get(clergy.organization) or '#2c3e50'
            rank_color = ranks.get(clergy.rank) or '#888888'
            
            # Use actual image if available, otherwise use placeholder
            image_url = clergy.image_url if clergy.image_url else placeholder_data_url
            
            nodes.append({
                'id': clergy.id,
                'name': clergy.name,
                'rank': clergy.rank,
                'organization': clergy.organization,
                'org_color': org_color,
                'rank_color': rank_color,
                'image_url': image_url
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
                try:
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
                except (json.JSONDecodeError, AttributeError) as e:
                    # Skip invalid co-consecrator data
                    current_app.logger.warning(f"Invalid co-consecrator data for clergy {clergy.id}: {e}")
                    continue
        
        return render_template('lineage_visualization.html', 
                             nodes=json.dumps(nodes), 
                             links=json.dumps(links))
    except Exception as e:
        current_app.logger.error(f"Error in lineage_visualization: {e}")
        # Return a simple error page or redirect
        return render_template('lineage_visualization.html', 
                             nodes=json.dumps([]), 
                             links=json.dumps([]),
                             error_message="Unable to load lineage data. Please try again later.")

# User management routes
@main_bp.route('/users')
@require_permission('manage_users')
def user_management():
    return render_template('user_management.html')

@main_bp.route('/users/add', methods=['POST'])
@require_permission('manage_users')
def add_user():
    # Implementation will be moved to services
    return jsonify({'success': False, 'message': 'Not implemented yet'}), 501

@main_bp.route('/users/<int:user_id>/edit', methods=['PUT'])
@require_permission('manage_users')
def edit_user(user_id):
    # Implementation will be moved to services
    return jsonify({'success': False, 'message': 'Not implemented yet'}), 501

@main_bp.route('/users/<int:user_id>/delete', methods=['DELETE'])
@require_permission('manage_users')
def delete_user(user_id):
    # Implementation will be moved to services
    return jsonify({'success': False, 'message': 'Not implemented yet'}), 501

# Comments management
@main_bp.route('/comments')
@require_permission('manage_comments')
def comments_management():
    return render_template('comments_management.html')

@main_bp.route('/comments/<int:comment_id>/resolve', methods=['POST'])
@require_permission('manage_comments')
def resolve_comment(comment_id):
    # Implementation will be moved to services
    return jsonify({'success': False, 'message': 'Not implemented yet'}), 501

# Clergy modal routes
@main_bp.route('/clergy/modal/add')
@require_permission('add_clergy')
def clergy_modal_add():
    return render_template('_clergy_modal.html', clergy=None, action='add')

@main_bp.route('/clergy/modal/<int:clergy_id>/edit')
@require_permission('edit_clergy')
def clergy_modal_edit(clergy_id):
    clergy = Clergy.query.get_or_404(clergy_id)
    return render_template('_clergy_modal.html', clergy=clergy, action='edit')

@main_bp.route('/clergy/modal/<int:clergy_id>/comment')
def clergy_modal_comment(clergy_id):
    clergy = Clergy.query.get_or_404(clergy_id)
    return render_template('_clergy_comment_modal.html', clergy=clergy)

# Utility routes
@main_bp.route('/favicon.ico')
def favicon():
    return '', 204

# Database initialization (for development)
@main_bp.route('/init-db')
def init_db():
    # This should only be available in development
    if not current_app.debug:
        return 'Not available in production', 404
    # Implementation will be moved to services
    return jsonify({'success': False, 'message': 'Not implemented yet'}), 501
