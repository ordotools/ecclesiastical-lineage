from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify, current_app
from services import clergy as clergy_service
from utils import audit_log, require_permission, log_audit_event
from models import Clergy, ClergyComment, User, db, Organization, Rank, Ordination, Consecration
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
    current_app.logger.info("=== LINEAGE_VISUALIZATION ROUTE CALLED ===")
    try:
        # Check if we have any ordination/consecration data
        ordination_count = Ordination.query.count()
        consecration_count = Consecration.query.count()
        
        # Log current data status
        current_app.logger.info(f"Found {ordination_count} ordinations and {consecration_count} consecrations in database")
        
        # Allow both logged-in and non-logged-in users to view lineage visualization
        # Get only active (non-deleted) clergy for the visualization with relationships loaded
        from sqlalchemy.orm import joinedload
        all_clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
        ).filter(Clergy.is_deleted != True).all()
        
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
                'name': clergy.papal_name if (clergy.rank and clergy.rank.lower() == 'pope' and clergy.papal_name) else clergy.name,
                'rank': clergy.rank,
                'organization': clergy.organization,
                'org_color': org_color,
                'rank_color': rank_color,
                'image_url': image_url,
                'high_res_image_url': high_res_image_url,
                'ordinations_count': len(clergy.ordinations),
                'consecrations_count': len(clergy.consecrations),
                'bio': clergy.notes
            })
        
        # Create links for ordinations (black arrows)
        for clergy in all_clergy:
            for ordination in clergy.ordinations:
                if ordination.ordaining_bishop:
                    links.append({
                        'source': ordination.ordaining_bishop.id,
                        'target': clergy.id,
                        'type': 'ordination',
                        'date': ordination.date.strftime('%Y-%m-%d') if ordination.date else '',
                        'color': '#000000'
                    })
        
        # Create links for consecrations (green arrows)
        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                if consecration.consecrator:
                    links.append({
                        'source': consecration.consecrator.id,
                        'target': clergy.id,
                        'type': 'consecration',
                        'date': consecration.date.strftime('%Y-%m-%d') if consecration.date else '',
                        'color': '#27ae60'
                    })
        
        # Create links for co-consecrations (dotted green arrows)
        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                for co_consecrator in consecration.co_consecrators:
                    links.append({
                        'source': co_consecrator.id,
                        'target': clergy.id,
                        'type': 'co-consecration',
                        'date': consecration.date.strftime('%Y-%m-%d') if consecration.date else '',
                        'color': '#27ae60',
                        'dashed': True
                    })
        
        current_app.logger.info(f"Lineage visualization: {len(nodes)} nodes, {len(links)} links created")
        
        # Safely serialize data to JSON
        try:
            nodes_json = json.dumps(nodes)
            links_json = json.dumps(links)
            current_app.logger.info(f"JSON serialization successful: {len(nodes)} nodes, {len(links)} links")
        except (TypeError, ValueError) as e:
            current_app.logger.error(f"Error serializing data to JSON: {e}")
            raise e
            
        current_app.logger.info(f"=== RENDERING TEMPLATE WITH {len(nodes)} NODES AND {len(links)} LINKS ===")
        return render_template('lineage_visualization.html', 
                             nodes=nodes_json, 
                             links=links_json)
    except Exception as e:
        current_app.logger.error(f"Error in lineage_visualization: {e}")
        import traceback
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        # Return a simple error page or redirect
        return render_template('lineage_visualization.html', 
                             nodes=json.dumps([]), 
                             links=json.dumps([]),
                             error_message=f"Unable to load lineage data. Error: {str(e)}")

@main_bp.route('/clergy/lineage-data')
def get_lineage_data():
    """API endpoint to get lineage data as JSON for AJAX requests"""
    try:
        # Check if we have any ordination/consecration data
        ordination_count = Ordination.query.count()
        consecration_count = Consecration.query.count()
        
        # Log current data status
        current_app.logger.info(f"API endpoint: Found {ordination_count} ordinations and {consecration_count} consecrations in database")
    
    except Exception as e:
        current_app.logger.error(f"Error checking data counts: {e}")
    
    try:
        # Allow both logged-in and non-logged-in users to view lineage data
        # Get only active (non-deleted) clergy for the visualization with relationships loaded
        from sqlalchemy.orm import joinedload
        all_clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
        ).filter(Clergy.is_deleted != True).all()
        
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
                'name': clergy.papal_name if (clergy.rank and clergy.rank.lower() == 'pope' and clergy.papal_name) else clergy.name,
                'rank': clergy.rank,
                'organization': clergy.organization,
                'org_color': org_color,
                'rank_color': rank_color,
                'image_url': image_url,
                'high_res_image_url': high_res_image_url,
                'ordinations_count': len(clergy.ordinations),
                'consecrations_count': len(clergy.consecrations),
                'bio': clergy.notes
            })
        
        # Create links for ordinations (black arrows)
        for clergy in all_clergy:
            for ordination in clergy.ordinations:
                if ordination.ordaining_bishop:
                    links.append({
                        'source': ordination.ordaining_bishop.id,
                        'target': clergy.id,
                        'type': 'ordination',
                        'date': ordination.date.strftime('%Y-%m-%d') if ordination.date else '',
                        'color': '#000000'
                    })
        
        # Create links for consecrations (green arrows)
        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                if consecration.consecrator:
                    links.append({
                        'source': consecration.consecrator.id,
                        'target': clergy.id,
                        'type': 'consecration',
                        'date': consecration.date.strftime('%Y-%m-%d') if consecration.date else '',
                        'color': '#27ae60'
                    })
        
        # Create links for co-consecrations (dotted green arrows)
        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                for co_consecrator in consecration.co_consecrators:
                    links.append({
                        'source': co_consecrator.id,
                        'target': clergy.id,
                        'type': 'co-consecration',
                        'date': consecration.date.strftime('%Y-%m-%d') if consecration.date else '',
                        'color': '#27ae60',
                        'dashed': True
                    })
        
        return jsonify({
            'success': True,
            'nodes': nodes,
            'links': links
        })
    except Exception as e:
        current_app.logger.error(f"Error in get_lineage_data: {e}")
        return jsonify({
            'success': False,
            'message': 'Unable to load lineage data. Please try again later.'
        }), 500

@main_bp.route('/test-migration')
def test_migration():
    """Test endpoint to verify routing is working"""
    return jsonify({
        'success': True,
        'message': 'Test endpoint working'
    })

@main_bp.route('/admin/force-migrate-lineage', methods=['GET', 'POST'])
def force_migrate_lineage():
    """Admin endpoint to force migrate lineage data"""
    try:
        from datetime import datetime
        from sqlalchemy import text
        
        print("🔄 Starting FORCED lineage data migration...")
        
        # Clear existing data
        db.session.execute(text("DELETE FROM co_consecrators"))
        db.session.execute(text("DELETE FROM consecration"))
        db.session.execute(text("DELETE FROM ordination"))
        db.session.commit()
        print("✅ Cleared existing data")
        
        # Get all clergy with relationships loaded
        from sqlalchemy.orm import joinedload
        all_clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
        ).filter(Clergy.is_deleted != True).all()
        print(f"📊 Found {len(all_clergy)} clergy records")
        
        # Create synthetic lineage data
        ordination_count = 0
        consecration_count = 0
        
        # Create ordinations for priests (assume they were ordained by bishops)
        bishops = [c for c in all_clergy if c.rank and 'bishop' in c.rank.lower()]
        priests = [c for c in all_clergy if c.rank and 'priest' in c.rank.lower()]
        
        print(f"📊 Found {len(bishops)} bishops and {len(priests)} priests")
        
        # Create ordinations for priests
        for priest in priests[:10]:  # Limit to first 10 for testing
            if bishops:
                ordaining_bishop = bishops[0]  # Use first bishop as ordaining bishop
                
                ordination = Ordination(
                    clergy_id=priest.id,
                    date=datetime.now().date(),
                    ordaining_bishop_id=ordaining_bishop.id,
                    is_sub_conditione=False,
                    is_doubtful=False,
                    is_invalid=False,
                    notes=f"Migrated ordination for {priest.name}",
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                db.session.add(ordination)
                ordination_count += 1
        
        # Create consecrations for bishops
        for i, bishop in enumerate(bishops[1:], 1):  # Skip first bishop
            consecrator = bishops[0]  # Use first bishop as consecrator
            
            consecration = Consecration(
                clergy_id=bishop.id,
                date=datetime.now().date(),
                consecrator_id=consecrator.id,
                is_sub_conditione=False,
                is_doubtful=False,
                is_invalid=False,
                notes=f"Migrated consecration for {bishop.name}",
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(consecration)
            consecration_count += 1
        
        print(f"✅ Created {ordination_count} ordination records")
        print(f"✅ Created {consecration_count} consecration records")
        
        # Commit all changes
        db.session.commit()
        print("🎉 Force migration completed successfully!")
        
        return jsonify({
            'success': True,
            'message': f'Lineage data migration completed: {ordination_count} ordinations, {consecration_count} consecrations'
        })
    except Exception as e:
        current_app.logger.error(f"Error in force_migrate_lineage: {e}")
        import traceback
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'message': f'Migration failed: {str(e)}'
        }), 500

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

@main_bp.route('/clergy/edit_from_lineage/<int:clergy_id>')
@require_permission('edit_clergy')
def edit_clergy_from_lineage(clergy_id):
    """Edit clergy from lineage visualization with modal context"""
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
    
    # Get bishops data for autocomplete
    all_bishops = db.session.query(Clergy).join(Rank, Clergy.rank == Rank.name).filter(
        Rank.is_bishop == True,
        Clergy.is_deleted != True
    ).all()
    
    all_bishops_suggested = [
        {
            'id': bishop.id,
            'name': getattr(bishop, 'display_name', bishop.name),
            'rank': bishop.rank,
            'organization': bishop.organization
        }
        for bishop in all_bishops
    ]
    
    return render_template('_clergy_form_modal.html', 
                         fields={
                             'form_action': url_for('clergy.edit_clergy', clergy_id=clergy_id),
                             'ranks': ranks,
                             'organizations': organizations,
                             'cancel_url': '#'  # Will be handled by JavaScript to close modal
                         },
                         clergy=clergy, 
                         edit_mode=True, 
                         user=user,
                         all_bishops_suggested=all_bishops_suggested)

@main_bp.route('/clergy/modal/<int:clergy_id>/comment')
def clergy_modal_comment(clergy_id):
    clergy = Clergy.query.get_or_404(clergy_id)
    return render_template('_clergy_comment_modal.html', clergy=clergy)

@main_bp.route('/clergy/relationships/<int:clergy_id>')
def clergy_relationships(clergy_id):
    """Get clergy relationships for lineage visualization"""
    try:
        clergy = Clergy.query.get_or_404(clergy_id)
        
        # Get ordaining bishop from new ordination table
        ordaining_bishop = None
        primary_ordination = clergy.get_primary_ordination()
        if primary_ordination and primary_ordination.ordaining_bishop:
            ordaining_bishop = primary_ordination.ordaining_bishop
        
        # Get consecrator from new consecration table
        consecrator = None
        primary_consecration = clergy.get_primary_consecration()
        if primary_consecration and primary_consecration.consecrator:
            consecrator = primary_consecration.consecrator
        
        # Get ordained clergy (clergy ordained by this person) from new ordination table
        from models import Ordination
        ordained_clergy = db.session.query(Clergy).join(Ordination, Clergy.id == Ordination.clergy_id).filter(
            Ordination.ordaining_bishop_id == clergy_id,
            Clergy.is_deleted == False
        ).all()
        
        # Get consecrated clergy (clergy consecrated by this person) from new consecration table
        from models import Consecration
        consecrated_clergy = db.session.query(Clergy).join(Consecration, Clergy.id == Consecration.clergy_id).filter(
            Consecration.consecrator_id == clergy_id,
            Clergy.is_deleted == False
        ).all()
        
        # Get co-consecrated clergy from new consecration table
        co_consecrated_clergy = []
        for consecration in clergy.consecrations:
            for co_consecrator in consecration.co_consecrators:
                if not co_consecrator.is_deleted:
                    co_consecrated_clergy.append(co_consecrator)
        
        return jsonify({
            'success': True,
            'ordaining_bishop': {
                'id': ordaining_bishop.id,
                'name': ordaining_bishop.papal_name if (ordaining_bishop.rank and ordaining_bishop.rank.lower() == 'pope' and ordaining_bishop.papal_name) else ordaining_bishop.name
            } if ordaining_bishop else None,
            'consecrator': {
                'id': consecrator.id,
                'name': consecrator.papal_name if (consecrator.rank and consecrator.rank.lower() == 'pope' and consecrator.papal_name) else consecrator.name
            } if consecrator else None,
            'ordained_clergy': [
                {
                    'id': c.id,
                    'name': c.papal_name if (c.rank and c.rank.lower() == 'pope' and c.papal_name) else c.name,
                    'rank': c.rank,
                    'organization': c.organization
                } for c in ordained_clergy
            ],
            'consecrated_clergy': [
                {
                    'id': c.id,
                    'name': c.papal_name if (c.rank and c.rank.lower() == 'pope' and c.papal_name) else c.name,
                    'rank': c.rank,
                    'organization': c.organization
                } for c in consecrated_clergy
            ],
            'co_consecrated_clergy': [
                {
                    'id': c.id,
                    'name': c.papal_name if (c.rank and c.rank.lower() == 'pope' and c.papal_name) else c.name,
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
    # Get current user if logged in
    user = None
    if 'user_id' in session:
        from models import User
        user = User.query.get(session['user_id'])
    
    return render_template('_clergy_info_panel.html', user=user)

@main_bp.route('/debug-lineage')
def debug_lineage():
    """Debug endpoint to check lineage data"""
    try:
        # Get all clergy for the visualization with relationships loaded
        from sqlalchemy.orm import joinedload
        all_clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
        ).filter(Clergy.is_deleted != True).all()
        
        # Get all organizations and ranks for color lookup
        organizations = {org.name: org.color for org in Organization.query.all()}
        ranks = {rank.name: rank.color for rank in Rank.query.all()}

        # Prepare data for D3.js
        nodes = []
        links = []
        
        # Create nodes for each clergy
        for clergy in all_clergy:
            org_color = organizations.get(clergy.organization) or '#2c3e50'
            rank_color = ranks.get(clergy.rank) or '#888888'
            nodes.append({
                'id': clergy.id,
                'name': clergy.papal_name if (clergy.rank and clergy.rank.lower() == 'pope' and clergy.papal_name) else clergy.name,
                'rank': clergy.rank,
                'organization': clergy.organization,
                'org_color': org_color,
                'rank_color': rank_color
            })
        
        # Create links for ordinations (black arrows)
        for clergy in all_clergy:
            for ordination in clergy.ordinations:
                if ordination.ordaining_bishop:
                    links.append({
                        'source': ordination.ordaining_bishop.id,
                        'target': clergy.id,
                        'type': 'ordination',
                        'date': ordination.date.strftime('%Y-%m-%d') if ordination.date else '',
                        'color': '#000000'
                    })
        
        # Create links for consecrations (green arrows)
        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                if consecration.consecrator:
                    links.append({
                        'source': consecration.consecrator.id,
                        'target': clergy.id,
                        'type': 'consecration',
                        'date': consecration.date.strftime('%Y-%m-%d') if consecration.date else '',
                        'color': '#27ae60'
                    })
        
        return jsonify({
            'nodes_count': len(nodes),
            'links_count': len(links),
            'nodes': nodes[:5],  # First 5 nodes
            'links': links[:5],  # First 5 links
            'sample_ordination_links': [l for l in links if l['type'] == 'ordination'][:3],
            'sample_consecration_links': [l for l in links if l['type'] == 'consecration'][:3]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@main_bp.route('/test-fixes')
def test_fixes():
    """Test page to verify fixes"""
    from flask import current_app
    return current_app.send_static_file('test_fixes.html')

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
        'ordinations_count': len(clergy.ordinations),
        'consecrations_count': len(clergy.consecrations),
        'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None
    } if clergy else None
)
@require_permission('add_clergy')
def add_clergy_from_lineage():
    """Add clergy from lineage visualization with context - now uses new dynamic form system"""
    from services import clergy as clergy_service
    
    # Get context parameters
    context_type = request.args.get('context_type')  # 'ordination' or 'consecration'
    context_clergy_id = request.args.get('context_clergy_id')  # ID of the clergy providing context
    
    # Use the new dynamic form system
    return clergy_service.add_clergy_handler()

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
