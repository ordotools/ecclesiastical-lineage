from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify, current_app, Response, make_response
from services import clergy as clergy_service
from utils import audit_log, require_permission, require_permission_api, log_audit_event
from models import Clergy, ClergyComment, User, db, Organization, Rank, Ordination, Consecration
import json
import base64
import requests

main_bp = Blueprint('main', __name__)

# Main landing page - now shows lineage visualization
@main_bp.route('/')
def index():
    return lineage_visualization()

# Lineage visualization (moved from /lineage_visualization to root)
def lineage_visualization():
    current_app.logger.info("=== LINEAGE_VISUALIZATION ROUTE CALLED ===")
    
    # Allow both logged-in and non-logged-in users to view lineage visualization
    
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
            
            # Get image URL - prefer lineage size for visualization, fallback to original
            image_url = placeholder_data_url
            if clergy.image_data:
                try:
                    image_data = json.loads(clergy.image_data)
                    # Use lineage size (48x48) for visualization performance
                    image_url = image_data.get('lineage', image_data.get('detail', image_data.get('original', '')))
                except (json.JSONDecodeError, AttributeError):
                    pass
            
            # Fallback to clergy.image_url if no image_data or parsing failed
            if not image_url or image_url == placeholder_data_url:
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
        
        # Get current user if logged in
        user = None
        if 'user_id' in session:
            user = User.query.get(session['user_id'])
        
        return render_template('lineage_visualization.html', 
                             nodes_json=nodes_json, 
                             links_json=links_json,
                             user=user)
    except Exception as e:
        current_app.logger.error(f"Error in lineage_visualization: {e}")
        import traceback
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        # Return a simple error page or redirect
        return render_template('lineage_visualization.html', 
                             nodes_json=json.dumps([]), 
                             links_json=json.dumps([]),
                             error_message=f"Unable to load lineage data. Error: {str(e)}")

# Backward compatibility route
@main_bp.route('/lineage_visualization')
def lineage_visualization_alias():
    return lineage_visualization()

@main_bp.route('/clergy/lineage-data')
def get_lineage_data():
    """API endpoint to get lineage data as JSON for AJAX requests"""
    # Allow both logged-in and non-logged-in users to access lineage data
    
    try:
        # Check if we have any ordination/consecration data
        ordination_count = Ordination.query.count()
        consecration_count = Consecration.query.count()
        

        # If no data exists, create some synthetic data
        if ordination_count == 0 and consecration_count == 0:
            current_app.logger.info("No lineage data found, creating synthetic data...")
            
            from datetime import datetime
            
            # Get all clergy with relationships loaded
            from sqlalchemy.orm import joinedload
            all_clergy = Clergy.query.options(
                joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
                joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
                joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
            ).filter(Clergy.is_deleted != True).all()
            
            # Create synthetic lineage data
            bishops = [c for c in all_clergy if c.rank and 'bishop' in c.rank.lower()]
            priests = [c for c in all_clergy if c.rank and 'priest' in c.rank.lower()]
            
            current_app.logger.info(f"Found {len(bishops)} bishops and {len(priests)} priests")
            
            # Create ordinations for priests
            for priest in priests[:10]:  # Limit to first 10
                if bishops:
                    ordaining_bishop = bishops[0]
                    
                    ordination = Ordination(
                        clergy_id=priest.id,
                        date=datetime.now().date(),
                        ordaining_bishop_id=ordaining_bishop.id,
                        is_sub_conditione=False,
                        is_doubtful=False,
                        is_invalid=False,
                        notes=f"Synthetic ordination for {priest.name}",
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    db.session.add(ordination)
            
            # Create consecrations for bishops
            for i, bishop in enumerate(bishops[1:], 1):
                consecrator = bishops[0]
                
                consecration = Consecration(
                    clergy_id=bishop.id,
                    date=datetime.now().date(),
                    consecrator_id=consecrator.id,
                    is_sub_conditione=False,
                    is_doubtful=False,
                    is_invalid=False,
                    notes=f"Synthetic consecration for {bishop.name}",
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                db.session.add(consecration)
            
            db.session.commit()
            current_app.logger.info("Synthetic lineage data created successfully")
        

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
            
            # Get image URL - prefer lineage size for visualization, fallback to original
            image_url = placeholder_data_url
            if clergy.image_data:
                try:
                    image_data = json.loads(clergy.image_data)
                    # Use lineage size (48x48) for visualization performance
                    image_url = image_data.get('lineage', image_data.get('detail', image_data.get('original', '')))
                except (json.JSONDecodeError, AttributeError):
                    pass
            
            # Fallback to clergy.image_url if no image_data or parsing failed
            if not image_url or image_url == placeholder_data_url:
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
def user_management():
    # Redirect to editor user management panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#user-management')
    else:
        flash('Please log in to access user management.', 'error')
        return redirect(url_for('auth.login'))

@main_bp.route('/users/add', methods=['POST'])
def add_user():
    # Redirect to editor user management panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#user-management')
    else:
        flash('Please log in to access user management.', 'error')
        return redirect(url_for('auth.login'))

@main_bp.route('/users/<int:user_id>/edit', methods=['PUT'])
def edit_user(user_id):
    # Redirect to editor user management panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#user-management')
    else:
        flash('Please log in to access user management.', 'error')
        return redirect(url_for('auth.login'))

@main_bp.route('/users/<int:user_id>/delete', methods=['DELETE'])
def delete_user(user_id):
    # Redirect to editor user management panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#user-management')
    else:
        flash('Please log in to access user management.', 'error')
        return redirect(url_for('auth.login'))

# Comments management
@main_bp.route('/comments')
def comments_management():
    # Redirect to editor comments management panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#comments-management')
    else:
        flash('Please log in to access comments management.', 'error')
        return redirect(url_for('auth.login'))

@main_bp.route('/comments/<int:comment_id>/resolve', methods=['POST'])
def resolve_comment(comment_id):
    # Redirect to editor comments management panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#comments-management')
    else:
        flash('Please log in to access comments management.', 'error')
        return redirect(url_for('auth.login'))

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
    
    return render_template('_clergy_modal.html', 
                         clergy=None, 
                         action='add',
                         all_clergy_data=all_clergy_data,
                         all_bishops_suggested=all_bishops_suggested,
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
    
    return render_template('_clergy_modal.html', 
                         clergy=clergy, 
                         action='edit',
                         all_clergy_data=all_clergy_data,
                         all_bishops_suggested=all_bishops_suggested,
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
                         all_clergy_data=all_clergy_data,
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
        ordained_clergy = db.session.query(Clergy).join(Ordination, Clergy.id == Ordination.clergy_id).filter(
            Ordination.ordaining_bishop_id == clergy_id,
            Clergy.is_deleted == False
        ).all()
        
        # Get consecrated clergy (clergy consecrated by this person) from new consecration table
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

@main_bp.route('/test-bishop-creation')
def test_bishop_creation():
    """Test page for bishop creation functionality"""
    return current_app.send_static_file('test_bishop_creation.html')

@main_bp.route('/test-clergy-form', methods=['GET', 'POST'])
def test_clergy_form():
    """Temporary test route to display the clergy form template"""
    from models import Rank, Organization, Clergy, User
    
    # Get current user if logged in
    user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
    
    # Handle POST requests (form submission)
    if request.method == 'POST':
        try:
            # Use the existing clergy service to create clergy from form
            clergy = clergy_service.create_clergy_from_form(request.form)
            
            # Check if this is an AJAX request
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            
            if is_ajax:
                return jsonify({
                    'success': True, 
                    'message': f'Clergy record "{clergy.name}" created successfully!', 
                    'redirect': url_for('main.index')
                })
            
            flash(f'Clergy record "{clergy.name}" created successfully!', 'success')
            return redirect(url_for('main.index'))
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f'Error creating clergy: {str(e)}')
            
            # Check if this is an AJAX request
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            
            if is_ajax:
                return jsonify({'success': False, 'message': str(e)}), 400
            
            flash(f'Error creating clergy record: {str(e)}', 'error')
    
    # GET request - show the form
    # Get sample data for the form
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    
    # Create a mock fields object with the required data
    fields = {
        'form_action': url_for('main.test_clergy_form'),
        'ranks': ranks,
        'organizations': organizations,
        'cancel_url': url_for('main.index')
    }
    
    # Render the test template that uses the macro
    return render_template('test_clergy_form.html',
                         fields=fields,
                         clergy=None,
                         edit_mode=False,
                         user=user,
                         redirect_url=url_for('main.index'),
                         use_htmx=True,
                         context_type=None,
                         context_clergy_id=None)

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
    from models import Rank, Organization, Clergy, User
    
    # Get context parameters
    context_type = request.args.get('context_type')  # 'ordination' or 'consecration'
    context_clergy_id = request.args.get('context_clergy_id')  # ID of the clergy providing context
    
    if request.method == 'POST':
        # Handle POST requests with custom redirect logic
        try:
            clergy = clergy_service.create_clergy_from_form(request.form)
            
            # Check if this is an HTMX request
            is_htmx = request.headers.get('HX-Request') == 'true'
            
            if is_htmx:
                # For HTMX requests, return a response that will trigger redirect to lineage visualization
                response = make_response('<script>window.location.href = "' + url_for('main.index') + '";</script>')
                response.headers['HX-Trigger'] = 'redirect'
                return response
            
            # Handle regular AJAX requests
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
                return jsonify({'success': True, 'message': 'Clergy record added successfully!', 'redirect': url_for('main.index')})
            
            flash('Clergy record added successfully!', 'success')
            return redirect(url_for('main.index'))
        except Exception as e:
            db.session.rollback()
            
            # Check if this is an HTMX request
            is_htmx = request.headers.get('HX-Request') == 'true'
            if is_htmx:
                response = make_response(f'<div class="alert alert-danger">Error: {str(e)}</div>')
                return response, 400
            
            # Handle regular AJAX requests
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
                return jsonify({'success': False, 'message': str(e)}), 400
            flash('Error adding clergy record.', 'error')
            return redirect(url_for('main.index'))
    
    # For GET requests, render the form with proper cancel URL
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
    
    # Get bishops data for autocomplete
    all_bishops = Clergy.query.filter(
        Clergy.rank.ilike('%bishop%'),
        Clergy.is_deleted != True
    ).order_by(Clergy.name).all()
    
    all_bishops_suggested = [
        {
            'id': bishop.id,
            'name': getattr(bishop, 'display_name', bishop.name),
            'rank': bishop.rank,
            'organization': bishop.organization
        }
        for bishop in all_bishops
    ]
    
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    
    # Render the form template with proper cancel URL pointing back to lineage visualization
    return render_template('_clergy_form_modal.html',
                         fields={
                             'form_action': url_for('main.add_clergy_from_lineage'),
                             'ranks': ranks,
                             'organizations': organizations,
                             'cancel_url': url_for('main.index')  # This is the key fix!
                         },
                         edit_mode=False,
                         user=user,
                         redirect_url=url_for('main.index'),  # Also fix HTMX redirect
                         use_htmx=True,
                         context_type=context_type,
                         context_clergy_id=context_clergy_id,
                         all_bishops_suggested=all_bishops_suggested)

def favicon():
    return '', 204

# API endpoint for checking and creating bishops
@main_bp.route('/api/check-and-create-bishops', methods=['POST'])
@require_permission('add_clergy')
def check_and_create_bishops():
    """Check if bishops exist by name and create them if they don't"""
    try:
        data = request.get_json()
        bishop_names = data.get('bishop_names', [])
        
        if not bishop_names:
            return jsonify({'success': True, 'bishop_mapping': {}})
        
        bishop_mapping = {}
        
        for name in bishop_names:
            name = name.strip()
            if not name:
                continue
                
            # Check if bishop already exists
            existing_bishop = Clergy.query.filter_by(name=name).first()
            if existing_bishop:
                bishop_mapping[name] = existing_bishop.id
            else:
                # Create new bishop with rank 'Bishop'
                new_bishop = Clergy(
                    name=name,
                    rank='Bishop',
                    notes=f'Auto-created bishop record for {name}'
                )
                db.session.add(new_bishop)
                db.session.flush()  # Get the ID
                bishop_mapping[name] = new_bishop.id
                
                # Log the creation
                log_audit_event(
                    action='create',
                    entity_type='clergy',
                    entity_id=new_bishop.id,
                    entity_name=new_bishop.name,
                    details={
                        'rank': new_bishop.rank,
                        'auto_created': True,
                        'reason': 'Missing bishop for ordination/consecration'
                    }
                )
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'bishop_mapping': bishop_mapping,
            'message': f'Created {len([b for b in bishop_mapping.values() if b])} new bishop records'
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error creating bishops: {str(e)}')
        return jsonify({
            'success': False,
            'message': f'Error creating bishops: {str(e)}'
        }), 500

# Database initialization (for development)
@main_bp.route('/init-db')
def init_db():
    # This should only be available in development
    if not current_app.debug:
        return 'Not available in production', 404
    # Implementation will be moved to services
    return jsonify({'success': False, 'message': 'Not implemented yet'}), 501

@main_bp.route('/api/process-cropped-image', methods=['POST'])
@require_permission_api('edit_clergy')
def process_cropped_image():
    """
    Process a cropped image and generate small (lineage) and large (detail) versions
    """
    try:
        current_app.logger.info("=== PROCESS_CROPPED_IMAGE ENDPOINT CALLED ===")
        
        data = request.get_json()
        if not data:
            current_app.logger.error("No data provided in request")
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        cropped_image_data = data.get('cropped_image_data')
        clergy_id = data.get('clergy_id')
        original_object_key = data.get('original_object_key')
        
        if not cropped_image_data or not clergy_id:
            current_app.logger.error(f"Missing required parameters - cropped_image_data: {bool(cropped_image_data)}, clergy_id: {clergy_id}")
            return jsonify({'success': False, 'error': 'Missing required parameters'}), 400
        
        # Get the image upload service
        from services.image_upload import get_image_upload_service
        image_upload_service = get_image_upload_service()
        
        # Process the cropped image
        result = image_upload_service.process_cropped_image(
            cropped_image_data, 
            clergy_id, 
            original_object_key
        )
        
        if result['success']:
            return jsonify({
                'success': True,
                'image_data': result['urls']
            })
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 500
            
    except Exception as e:
        current_app.logger.error(f"Error processing cropped image: {e}")
        import traceback
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@main_bp.route('/proxy-image')
def proxy_image():
    """
    Proxy images from Backblaze B2 to avoid CORS issues
    Usage: /proxy-image?url=<encoded_backblaze_url>
    """
    image_url = request.args.get('url')
    if not image_url:
        return 'Missing URL parameter', 400
    
    try:
        # Fetch the image from Backblaze B2
        response = requests.get(image_url, timeout=30)
        response.raise_for_status()
        
        # Return the image with proper headers
        return Response(
            response.content,
            mimetype=response.headers.get('content-type', 'image/jpeg'),
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'public, max-age=3600'  # Cache for 1 hour
            }
        )
    except requests.RequestException as e:
        current_app.logger.error(f"Error proxying image {image_url}: {e}")
        return 'Error fetching image', 500
