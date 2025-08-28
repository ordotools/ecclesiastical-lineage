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
        # Get only active (non-deleted) clergy for the visualization
        all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
        
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
            
            # Get high-resolution image URL from image_data if available
            high_res_image_url = None
            if clergy.image_data:
                try:
                    image_data = json.loads(clergy.image_data)
                    high_res_image_url = image_data.get('detail') or image_data.get('original')
                except (json.JSONDecodeError, AttributeError):
                    pass
            
            nodes.append({
                'id': clergy.id,
                'name': clergy.name,
                'rank': clergy.rank,
                'organization': clergy.organization,
                'org_color': org_color,
                'rank_color': rank_color,
                'image_url': image_url,
                'high_res_image_url': high_res_image_url,
                'ordination_date': clergy.date_of_ordination.strftime('%Y-%m-%d') if clergy.date_of_ordination else 'Not specified',
                'consecration_date': clergy.date_of_consecration.strftime('%Y-%m-%d') if clergy.date_of_consecration else 'Not specified',
                'bio': clergy.notes
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
    from models import Rank, Organization, Clergy, User
    
    # Get the current user
    user = User.query.get(session.get('user_id'))
    
    # Get the same data that add_clergy_handler provides
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': getattr(clergy_member, 'display_name', clergy_member.name),
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    
    return render_template('_clergy_modal.html', 
                         clergy=None, 
                         action='add',
                         all_clergy_data=all_clergy_data,
                         ranks=ranks,
                         organizations=organizations,
                         user=user)



@main_bp.route('/clergy/modal/<int:clergy_id>/edit')
@require_permission('edit_clergy')
def clergy_modal_edit(clergy_id):
    from models import Rank, Organization, Clergy, User
    
    clergy = Clergy.query.get_or_404(clergy_id)
    user = User.query.get(session.get('user_id'))
    
    # Get the same data that edit_clergy_handler provides
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': getattr(clergy_member, 'display_name', clergy_member.name),
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    
    return render_template('_clergy_modal.html', 
                         clergy=clergy, 
                         action='edit',
                         all_clergy_data=all_clergy_data,
                         ranks=ranks,
                         organizations=organizations,
                         user=user)

@main_bp.route('/clergy/modal/<int:clergy_id>/comment')
def clergy_modal_comment(clergy_id):
    clergy = Clergy.query.get_or_404(clergy_id)
    return render_template('_clergy_comment_modal.html', clergy=clergy)

@main_bp.route('/clergy/relationships/<int:clergy_id>')
def clergy_relationships(clergy_id):
    """Get clergy relationships for lineage visualization"""
    try:
        clergy = Clergy.query.get_or_404(clergy_id)
        
        # Get ordaining bishop
        ordaining_bishop = None
        if clergy.ordaining_bishop_id:
            ordaining_bishop = Clergy.query.get(clergy.ordaining_bishop_id)
        
        # Get consecrator
        consecrator = None
        if clergy.consecrator_id:
            consecrator = Clergy.query.get(clergy.consecrator_id)
        
        # Get ordained clergy (clergy ordained by this person)
        ordained_clergy = Clergy.query.filter_by(
            ordaining_bishop_id=clergy_id,
            is_deleted=False
        ).all()
        
        # Get consecrated clergy (clergy consecrated by this person)
        consecrated_clergy = Clergy.query.filter_by(
            consecrator_id=clergy_id,
            is_deleted=False
        ).all()
        
        # Get co-consecrated clergy
        co_consecrated_clergy = []
        if clergy.co_consecrators:
            try:
                co_consecrator_ids = clergy.get_co_consecrators()
                for co_id in co_consecrator_ids:
                    co_clergy = Clergy.query.get(co_id)
                    if co_clergy and not co_clergy.is_deleted:
                        co_consecrated_clergy.append(co_clergy)
            except (json.JSONDecodeError, AttributeError):
                pass
        
        return jsonify({
            'success': True,
            'ordaining_bishop': {
                'id': ordaining_bishop.id,
                'name': ordaining_bishop.name
            } if ordaining_bishop else None,
            'consecrator': {
                'id': consecrator.id,
                'name': consecrator.name
            } if consecrator else None,
            'ordained_clergy': [
                {
                    'id': c.id,
                    'name': c.name,
                    'rank': c.rank,
                    'organization': c.organization
                } for c in ordained_clergy
            ],
            'consecrated_clergy': [
                {
                    'id': c.id,
                    'name': c.name,
                    'rank': c.rank,
                    'organization': c.organization
                } for c in consecrated_clergy
            ],
            'co_consecrated_clergy': [
                {
                    'id': c.id,
                    'name': c.name,
                    'rank': c.rank,
                    'organization': c.organization
                } for c in co_consecrated_clergy
            ]
        })
    except Exception as e:
        current_app.logger.error(f"Error getting clergy relationships: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@main_bp.route('/clergy/info-panel')
def clergy_info_panel():
    """Serve the clergy info panel template"""
    return render_template('_clergy_info_panel.html')

@main_bp.route('/clergy/add_from_lineage', methods=['GET', 'POST'])
@audit_log(
    action='create',
    entity_type='clergy',
    get_entity_id=lambda clergy: clergy.id if clergy else None,
    get_entity_name=lambda clergy: clergy.name if clergy else None,
    get_details=lambda clergy: {
        'rank': clergy.rank,
        'organization': clergy.organization,
        'date_of_birth': clergy.date_of_birth.isoformat() if clergy.date_of_birth else None,
        'date_of_ordination': clergy.date_of_ordination.isoformat() if clergy.date_of_ordination else None,
        'date_of_consecration': clergy.date_of_consecration.isoformat() if clergy.date_of_consecration else None,
        'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None
    } if clergy else None
)
@require_permission('add_clergy')
def add_clergy_from_lineage():
    """Add clergy from lineage visualization with context"""
    from models import Rank, Organization, Clergy, User
    
    # Get the current user
    user = User.query.get(session.get('user_id'))
    
    # Get context parameters
    context_type = request.args.get('context_type')  # 'ordination' or 'consecration'
    context_clergy_id = request.args.get('context_clergy_id')  # ID of the clergy providing context
    
    if request.method == 'POST':
        # Handle form submission
        try:
            # Get form data
            name = request.form.get('name')
            rank = request.form.get('rank')
            organization = request.form.get('organization')
            date_of_birth = request.form.get('date_of_birth')
            date_of_ordination = request.form.get('date_of_ordination')
            date_of_consecration = request.form.get('date_of_consecration')
            date_of_death = request.form.get('date_of_death')
            notes = request.form.get('notes')
            
            # Debug: Log received form data
            current_app.logger.info(f"Received form data: name={name}, rank={rank}, organization={organization}, ordaining_bishop_id={request.form.get('ordaining_bishop_id')}, consecrator_id={request.form.get('consecrator_id')}")
            
            # Debug: Log all form data to see what's missing
            current_app.logger.info(f"All form data: {dict(request.form)}")
            
            # Debug: Log context variables
            current_app.logger.info(f"Context from URL args: context_type={request.args.get('context_type')}, context_clergy_id={request.args.get('context_clergy_id')}")
            
            # Debug: Log context from form
            current_app.logger.info(f"Context from form: context_type={request.form.get('context_type')}, context_clergy_id={request.form.get('context_clergy_id')}")
            
            # Get context from form data (preferred) or URL args (fallback)
            context_type = request.form.get('context_type') or request.args.get('context_type')
            context_clergy_id = request.form.get('context_clergy_id') or request.args.get('context_clergy_id')
            
            current_app.logger.info(f"Final context: context_type='{context_type}', context_clergy_id={context_clergy_id}")
            
            # Create new clergy member
            new_clergy = Clergy(
                name=name,
                rank=rank,
                organization=organization,
                date_of_birth=date_of_birth if date_of_birth else None,
                date_of_ordination=date_of_ordination if date_of_ordination else None,
                date_of_consecration=date_of_consecration if date_of_consecration else None,
                date_of_death=date_of_death if date_of_death else None,
                notes=notes,
                ordaining_bishop_id=request.form.get('ordaining_bishop_id') if request.form.get('ordaining_bishop_id') and request.form.get('ordaining_bishop_id') != 'None' else None,
                consecrator_id=request.form.get('consecrator_id') if request.form.get('consecrator_id') and request.form.get('consecrator_id') != 'None' else None
            )
            
            # Add to database
            db.session.add(new_clergy)
            db.session.flush()  # Get the ID without committing yet
            
            # Automatically establish relationships based on context
            if context_type and context_clergy_id:
                context_clergy = Clergy.query.get(context_clergy_id)
                current_app.logger.info(f"Establishing relationship: context_type={context_type}, context_clergy_id={context_clergy_id}, context_clergy_name={context_clergy.name if context_clergy else 'None'}")
                
                if context_type == 'ordination':
                    # User is adding clergy from "Ordained by" section
                    # New clergy BECOMES the ordaining bishop of current clergy
                    # (Don't set ordaining_bishop_id on new clergy)
                    # We'll update the current clergy after creating the new one
                    current_app.logger.info(f"New clergy will become ordaining bishop of clergy {context_clergy.id}")
                    
                elif context_type == 'consecration':
                    # User is adding clergy from "Consecrated by" section  
                    # New clergy BECOMES the consecrator of current clergy
                    # (Don't set consecrator_id on new clergy)
                    # We'll update the current clergy after creating the new one
                    current_app.logger.info(f"New clergy will become consecrator of clergy {context_clergy.id}")
                    
                elif context_type == 'ordained':
                    # User is adding clergy from "Ordained" section
                    # New clergy should have current clergy as ordaining bishop
                    new_clergy.ordaining_bishop_id = context_clergy.id
                    current_app.logger.info(f"Set ordaining_bishop_id to {context_clergy.id}")
                    
                elif context_type == 'consecrated':
                    # User is adding clergy from "Consecrated" section
                    # New clergy should have current clergy as consecrator
                    new_clergy.consecrator_id = context_clergy.id
                    current_app.logger.info(f"Set consecrator_id to {context_clergy.id}")
            
            # Now handle the reverse relationships for "ordination" and "consecration" contexts
            current_app.logger.info(f"Checking relationship update: context_type='{context_type}', context_clergy_id={context_clergy_id}")
            current_app.logger.info(f"Context type in list check: {context_type in ['ordination', 'consecration']}")
            
            if context_type in ['ordination', 'consecration'] and context_clergy_id:
                current_app.logger.info(f"Relationship update condition met, proceeding...")
                # Re-query the context clergy to ensure it's in the current session
                context_clergy = Clergy.query.get(context_clergy_id)
                if context_clergy:
                    current_app.logger.info(f"Found context clergy: {context_clergy.id} - {context_clergy.name}")
                    if context_type == 'ordination':
                        # Update current clergy to have new clergy as ordaining bishop
                        context_clergy.ordaining_bishop_id = new_clergy.id
                        current_app.logger.info(f"Updated clergy {context_clergy.id} to have ordaining_bishop_id {new_clergy.id}")
                    elif context_type == 'consecration':
                        # Update current clergy to have new clergy as consecrator
                        context_clergy.consecrator_id = new_clergy.id
                        current_app.logger.info(f"Updated clergy {context_clergy.id} to have consecrator_id {new_clergy.id}")
                else:
                    current_app.logger.error(f"Could not find context clergy with ID {context_clergy_id}")
            else:
                current_app.logger.info(f"Relationship update condition NOT met: context_type='{context_type}', context_clergy_id={context_clergy_id}")
            
            # Commit all changes
            db.session.commit()
            
            # Verify the update was successful
            if context_type in ['ordination', 'consecration'] and context_clergy_id:
                updated_clergy = Clergy.query.get(context_clergy_id)
                if updated_clergy:
                    if context_type == 'ordination':
                        current_app.logger.info(f"Verification: clergy {updated_clergy.id} now has ordaining_bishop_id = {updated_clergy.ordaining_bishop_id}")
                    elif context_type == 'consecration':
                        current_app.logger.info(f"Verification: clergy {updated_clergy.id} now has consecrator_id = {updated_clergy.consecrator_id}")
            
            return jsonify({
                'success': True,
                'message': 'Clergy record added successfully!',
                'clergy_id': new_clergy.id,
                'context_type': context_type,
                'context_clergy_id': context_clergy_id
            })
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error adding clergy: {e}")
            return jsonify({
                'success': False,
                'message': f'Error adding clergy: {str(e)}'
            }), 500
    
    # GET request - show the form
    # Get the same data that add_clergy_handler provides
    all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': getattr(clergy_member, 'display_name', clergy_member.name),
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    
    # Pre-populate context if provided
    context_clergy = None
    if context_clergy_id:
        context_clergy = Clergy.query.get(context_clergy_id)
    
    # Pre-populate form fields based on context
    pre_populated_clergy = None
    if context_clergy and context_type:
        pre_populated_clergy = type('ClergyContext', (), {
            'name': '',
            'rank': '',
            'organization': context_clergy.organization,
            # For "ordination" and "consecration" contexts, new clergy BECOMES the ordaining bishop/consecrator
            # So don't pre-fill these fields
            'ordaining_bishop_id': None,  # Will be set after creation
            'consecrator_id': None,       # Will be set after creation
            'date_of_birth': None,
            'date_of_ordination': None,
            'date_of_consecration': None,
            'date_of_death': None,
            'notes': None
        })()
        
        current_app.logger.info(f"Pre-populating form: context_type={context_type}, context_clergy_id={context_clergy_id}, ordaining_bishop_id={pre_populated_clergy.ordaining_bishop_id}, consecrator_id={pre_populated_clergy.consecrator_id}, organization={pre_populated_clergy.organization}")
    
    return render_template('_clergy_form_modal.html', 
                         fields={
                             'form_action': url_for('main.add_clergy_from_lineage'),  # Use our own route
                             'ranks': ranks,
                             'organizations': organizations,
                             'cancel_url': '#'  # Will be handled by JavaScript to close modal
                         },
                         clergy=pre_populated_clergy, 
                         edit_mode=False, 
                         user=user,
                         context_type=context_type,
                         context_clergy_id=context_clergy_id)

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
