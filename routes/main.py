from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify, current_app, Response, make_response, g
from services import clergy as clergy_service
from services.geocoding import geocoding_service
from utils import audit_log, require_permission, require_permission_api, log_audit_event
from models import Clergy, ClergyComment, User, db, Organization, Rank, Ordination, Consecration, Location, Status
from constants import GREEN_COLOR, BLACK_COLOR
import json
import base64
import requests

main_bp = Blueprint('main', __name__)

# Lightweight health check for keep-alive pings (no DB hit)
@main_bp.route('/health')
def health():
    return 'ok', 200

def _get_location_color(location):
    """Get color for a location based on organization first, then location type"""
    # First try to get color from the linked Organization table
    if location.organization_obj and location.organization_obj.color:
        return location.organization_obj.color
    
    # Fall back to legacy organization text field
    if location.organization:
        # Try to find matching organization in database
        org = Organization.query.filter_by(name=location.organization).first()
        if org and org.color:
            return org.color
    
    # Fall back to location type color
    location_type_colors = {
        'church': '#27ae60',      # Green for churches
        'organization': '#3498db', # Blue for organizations
        'address': '#e74c3c',     # Red for addresses
        'cathedral': '#9b59b6',   # Purple for cathedrals
        'monastery': '#f39c12',   # Orange for monasteries
        'seminary': '#1abc9c',    # Teal for seminaries
        'chapel': '#e74c3c',      # Red for chapels
        'abbey': '#8e44ad'        # Dark purple for abbeys
    }
    
    return location_type_colors.get(location.location_type, '#95a5a6')

# Main landing page - now shows lineage visualization
@main_bp.route('/')
def index():
    return lineage_visualization()

# Chapel view visualization
@main_bp.route('/chapel-view')
def chapel_view():
    current_app.logger.info("=== CHAPEL_VIEW ROUTE CALLED ===")
    
    try:
        # Get all active locations for the visualization with organization relationship
        all_locations = Location.query.options(db.joinedload(Location.organization_obj)).filter(Location.is_active == True, Location.deleted == False).all()
        
        # Log current data status
        current_app.logger.info(f"Found {len(all_locations)} locations in database")
        
        # Prepare data for D3.js visualization
        nodes = []
        links = []  # No links for locations, just glowing dots
        
        # Create nodes for each location with coordinates
        for location in all_locations:
            # Only include locations that have coordinates
            if location.has_coordinates():
                # Determine color based on organization first, then location type
                node_color = _get_location_color(location)
                
                nodes.append({
                    'id': location.id,
                    'name': location.name,
                    'location_type': location.location_type,
                    'pastor_name': location.pastor_name,
                    'organization': location.organization,
                    'organization_id': location.organization_id,
                    'organization_name': location.organization_obj.name if location.organization_obj else None,
                    'address': location.get_full_address(),
                    'city': location.city,
                    'country': location.country,
                    'latitude': location.latitude,
                    'longitude': location.longitude,
                    'color': node_color,
                    'notes': location.notes
                })
        
        current_app.logger.info(f"Chapel view visualization: {len(nodes)} location nodes created")
        
        # Safely serialize data to JSON
        try:
            nodes_json = json.dumps(nodes)
            links_json = json.dumps(links)
            current_app.logger.info(f"JSON serialization successful: {len(nodes)} nodes, {len(links)} links")
        except (TypeError, ValueError) as e:
            current_app.logger.error(f"Error serializing data to JSON: {e}")
            raise e
            
        current_app.logger.info(f"=== RENDERING CHAPEL_VIEW TEMPLATE WITH {len(nodes)} NODES AND {len(links)} LINKS ===")
        
        # Get current user if logged in
        user = None
        if 'user_id' in session:
            user = User.query.get(session['user_id'])
        
        return render_template('chapel_view.html', 
                             nodes_json=nodes_json, 
                             links_json=links_json,
                             user=user)
    except Exception as e:
        current_app.logger.error(f"Error in chapel view visualization: {e}")
        error_message = f"Error loading chapel view visualization: {str(e)}"
        return render_template('chapel_view.html', 
                             nodes_json='[]', 
                             links_json='[]',
                             error_message=error_message,
                             user=None)

@main_bp.route('/api/chapel-locations')
def api_chapel_locations():
    """API endpoint to get location data for chapel view visualization"""
    try:
        # Get all active locations for the visualization with organization relationship
        all_locations = Location.query.options(db.joinedload(Location.organization_obj)).filter(Location.is_active == True, Location.deleted == False).all()
        
        # Prepare data for D3.js visualization
        nodes = []
        
        # Create nodes for each location with coordinates
        for location in all_locations:
            # Only include locations that have coordinates
            if location.has_coordinates():
                # Determine color based on organization first, then location type
                node_color = _get_location_color(location)
                
                nodes.append({
                    'id': location.id,
                    'name': location.name,
                    'location_type': location.location_type,
                    'pastor_name': location.pastor_name,
                    'organization': location.organization,
                    'organization_id': location.organization_id,
                    'organization_name': location.organization_obj.name if location.organization_obj else None,
                    'address': location.get_full_address(),
                    'city': location.city,
                    'country': location.country,
                    'latitude': location.latitude,
                    'longitude': location.longitude,
                    'color': node_color,
                    'notes': location.notes
                })
        
        return jsonify({
            'success': True,
            'nodes': nodes,
            'count': len(nodes)
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting location data: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'nodes': [],
            'count': 0
        }), 500

# Location management routes
@main_bp.route('/locations')
@require_permission('manage_metadata')
def locations_list():
    """List all locations"""
    locations = Location.query.filter(Location.is_active == True, Location.deleted == False).all()
    return render_template('locations_list.html', locations=locations)

@main_bp.route('/locations/add', methods=['GET', 'POST'])
@require_permission('manage_metadata')
def add_location():
    """Add a new location"""
    if request.method == 'POST':
        try:
            # Handle organization_id
            organization_id = request.form.get('organization_id')
            if organization_id:
                organization_id = int(organization_id)
            else:
                organization_id = None
            
            location = Location(
                name=request.form['name'],
                address=request.form.get('street_address'),  # Map street_address to address field
                city=request.form.get('city'),
                state_province=request.form.get('state_province'),
                country=request.form.get('country'),
                postal_code=request.form.get('postal_code'),
                latitude=float(request.form['latitude']) if request.form.get('latitude') else None,
                longitude=float(request.form['longitude']) if request.form.get('longitude') else None,
                location_type=request.form.get('location_type', 'church'),
                pastor_name=request.form.get('pastor_name'),
                organization=request.form.get('organization'),  # Keep legacy field
                organization_id=organization_id,  # New foreign key field
                notes=request.form.get('notes'),
                deleted=request.form.get('deleted') == 'true',
                created_by=session.get('user_id')
            )
            
            db.session.add(location)
            db.session.commit()
            
            log_audit_event(
                user_id=session.get('user_id'),
                action='create',
                entity_type='location',
                entity_id=location.id,
                entity_name=location.name,
                details=f"Created location: {location.name}"
            )
            
            # Check if this is an AJAX request
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            
            if is_ajax:
                # Load the organization relationship for the response
                db.session.refresh(location)
                return jsonify({
                    'success': True,
                    'message': 'Location added successfully!',
                    'location': {
                        'id': location.id,
                        'name': location.name,
                        'address': location.address,
                        'city': location.city,
                        'state_province': location.state_province,
                        'country': location.country,
                        'postal_code': location.postal_code,
                        'latitude': location.latitude,
                        'longitude': location.longitude,
                        'location_type': location.location_type,
                        'pastor_name': location.pastor_name,
                        'organization': location.organization,
                        'organization_id': location.organization_id,
                        'organization_name': location.organization_obj.name if location.organization_obj else None,
                        'notes': location.notes,
                        'deleted': location.deleted
                    }
                })
            else:
                flash('Location added successfully!', 'success')
                return redirect(url_for('main.locations_list'))
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error adding location: {e}")
            
            # Check if this is an AJAX request
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            
            if is_ajax:
                return jsonify({
                    'success': False,
                    'message': f'Error adding location: {str(e)}'
                }), 400
            else:
                flash('Error adding location. Please try again.', 'error')
    
    # Get organizations for dropdown
    organizations = Organization.query.all()
    return render_template('location_form.html', location=None, organizations=organizations)

@main_bp.route('/locations/<int:location_id>/edit', methods=['GET', 'POST'])
@require_permission('manage_metadata')
def edit_location(location_id):
    """Edit an existing location"""
    location = Location.query.get_or_404(location_id)
    
    if request.method == 'POST':
        try:
            # Handle organization_id
            organization_id = request.form.get('organization_id')
            if organization_id:
                organization_id = int(organization_id)
            else:
                organization_id = None
            
            location.name = request.form['name']
            location.address = request.form.get('street_address')  # Map street_address to address field
            location.city = request.form.get('city')
            location.state_province = request.form.get('state_province')
            location.country = request.form.get('country')
            location.postal_code = request.form.get('postal_code')
            location.latitude = float(request.form['latitude']) if request.form.get('latitude') else None
            location.longitude = float(request.form['longitude']) if request.form.get('longitude') else None
            location.location_type = request.form.get('location_type', 'church')
            location.pastor_name = request.form.get('pastor_name')
            location.organization = request.form.get('organization')  # Keep legacy field
            location.organization_id = organization_id  # New foreign key field
            location.notes = request.form.get('notes')
            location.deleted = request.form.get('deleted') == 'true'
            
            db.session.commit()
            
            log_audit_event(
                user_id=session.get('user_id'),
                action='update',
                entity_type='location',
                entity_id=location.id,
                entity_name=location.name,
                details=f"Updated location: {location.name}"
            )
            
            # Check if this is an AJAX request
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            
            if is_ajax:
                # Load the organization relationship for the response
                db.session.refresh(location)
                return jsonify({
                    'success': True,
                    'message': 'Location updated successfully!',
                    'location': {
                        'id': location.id,
                        'name': location.name,
                        'address': location.address,
                        'city': location.city,
                        'state_province': location.state_province,
                        'country': location.country,
                        'postal_code': location.postal_code,
                        'latitude': location.latitude,
                        'longitude': location.longitude,
                        'location_type': location.location_type,
                        'pastor_name': location.pastor_name,
                        'organization': location.organization,
                        'organization_id': location.organization_id,
                        'organization_name': location.organization_obj.name if location.organization_obj else None,
                        'notes': location.notes,
                        'deleted': location.deleted
                    }
                })
            else:
                flash('Location updated successfully!', 'success')
                return redirect(url_for('main.locations_list'))
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error updating location: {e}")
            
            # Check if this is an AJAX request
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            
            if is_ajax:
                return jsonify({
                    'success': False,
                    'message': f'Error updating location: {str(e)}'
                }), 400
            else:
                flash('Error updating location. Please try again.', 'error')
    
    # Get organizations for dropdown
    organizations = Organization.query.all()
    return render_template('location_form.html', location=location, organizations=organizations)

@main_bp.route('/locations/<int:location_id>/delete', methods=['POST'])
@require_permission('manage_metadata')
def delete_location(location_id):
    """Delete a location (soft delete)"""
    location = Location.query.get_or_404(location_id)
    
    try:
        location.is_active = False
        db.session.commit()
        
        log_audit_event(
            user_id=session.get('user_id'),
            action='delete',
            entity_type='location',
            entity_id=location.id,
            entity_name=location.name,
            details=f"Deleted location: {location.name}"
        )
        
        flash('Location deleted successfully!', 'success')
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting location: {e}")
        flash('Error deleting location. Please try again.', 'error')
    
    return redirect(url_for('main.locations_list'))

@main_bp.route('/locations/<int:location_id>')
def view_location(location_id):
    """View location details"""
    location = Location.query.get_or_404(location_id)
    return render_template('location_details.html', location=location)

# Lineage visualization (moved from /lineage_visualization to root)
def lineage_visualization():
    current_app.logger.debug("=== LINEAGE_VISUALIZATION ROUTE CALLED ===")
    
    # Allow both logged-in and non-logged-in users to view lineage visualization
    
    try:
        # Allow both logged-in and non-logged-in users to view lineage visualization
        # Get only active (non-deleted) clergy for the visualization with relationships loaded
        from sqlalchemy.orm import joinedload
        all_clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators),
            joinedload(Clergy.statuses)  # Eager load statuses to prevent N+1 queries
        ).filter(Clergy.is_deleted != True).all()
        
        # Cache organizations and ranks in Flask g object for request duration
        if not hasattr(g, 'organizations'):
            g.organizations = {org.name: org.color for org in Organization.query.all()}
        if not hasattr(g, 'ranks'):
            g.ranks = {rank.name: rank.color for rank in Rank.query.all()}
        organizations = g.organizations
        ranks = g.ranks

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
            
            # Parse image_data JSON once and cache the result
            image_data = None
            if clergy.image_data:
                try:
                    image_data = json.loads(clergy.image_data)
                except (json.JSONDecodeError, AttributeError):
                    pass
            
            # Get image URL - prefer lineage size for visualization, fallback to original
            image_url = placeholder_data_url
            if image_data:
                # Use lineage size (48x48) for visualization performance
                image_url = image_data.get('lineage', image_data.get('detail', image_data.get('original', '')))
            
            # Fallback to clergy.image_url if no image_data or parsing failed
            if not image_url or image_url == placeholder_data_url:
                image_url = clergy.image_url if clergy.image_url else placeholder_data_url
            
            # Get high-resolution image URL from cached image_data
            high_res_image_url = None
            if image_data:
                high_res_image_url = image_data.get('detail') or image_data.get('original')
            
            # Get clergy statuses
            statuses_data = [
                {
                    'id': status.id,
                    'name': status.name,
                    'description': status.description,
                    'icon': status.icon,
                    'color': status.color,
                    'badge_position': status.badge_position
                }
                for status in clergy.statuses
            ]
            
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
                'bio': clergy.notes,
                'statuses': statuses_data
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
                        'color': BLACK_COLOR
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
                        'color': GREEN_COLOR
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
                        'color': GREEN_COLOR,
                        'dashed': True
                    })
        
        current_app.logger.debug(f"Lineage visualization: {len(nodes)} nodes, {len(links)} links created")
        
        # Safely serialize data to JSON
        try:
            nodes_json = json.dumps(nodes)
            links_json = json.dumps(links)
            current_app.logger.debug(f"JSON serialization successful: {len(nodes)} nodes, {len(links)} links")
        except (TypeError, ValueError) as e:
            current_app.logger.error(f"Error serializing data to JSON: {e}")
            raise e
            
        current_app.logger.debug(f"=== RENDERING TEMPLATE WITH {len(nodes)} NODES AND {len(links)} LINKS ===")
        
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
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators),
            joinedload(Clergy.statuses)  # Eager load statuses to prevent N+1 queries
        ).filter(Clergy.is_deleted != True).all()
        
        # Cache organizations and ranks in Flask g object for request duration
        if not hasattr(g, 'organizations'):
            g.organizations = {org.name: org.color for org in Organization.query.all()}
        if not hasattr(g, 'ranks'):
            g.ranks = {rank.name: rank.color for rank in Rank.query.all()}
        organizations = g.organizations
        ranks = g.ranks

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
            
            # Parse image_data JSON once and cache the result
            image_data = None
            if clergy.image_data:
                try:
                    image_data = json.loads(clergy.image_data)
                except (json.JSONDecodeError, AttributeError):
                    pass
            
            # Get image URL - prefer lineage size for visualization, fallback to original
            image_url = placeholder_data_url
            if image_data:
                # Use lineage size (48x48) for visualization performance
                image_url = image_data.get('lineage', image_data.get('detail', image_data.get('original', '')))
            
            # Fallback to clergy.image_url if no image_data or parsing failed
            if not image_url or image_url == placeholder_data_url:
                image_url = clergy.image_url if clergy.image_url else placeholder_data_url
            
            # Get high-resolution image URL from cached image_data
            high_res_image_url = None
            if image_data:
                high_res_image_url = image_data.get('detail') or image_data.get('original')
            
            # Get clergy statuses
            statuses_data = [
                {
                    'id': status.id,
                    'name': status.name,
                    'description': status.description,
                    'icon': status.icon,
                    'color': status.color,
                    'badge_position': status.badge_position
                }
                for status in clergy.statuses
            ]
            
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
                'bio': clergy.notes,
                'statuses': statuses_data
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
                        'color': BLACK_COLOR
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
                        'color': GREEN_COLOR
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
                        'color': GREEN_COLOR,
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
    
    # Eagerly load ordination and consecration relationships
    from sqlalchemy.orm import joinedload
    clergy = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
        joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
    ).filter(Clergy.id == clergy_id).first_or_404()
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
    
    # Eagerly load ordination and consecration relationships
    from sqlalchemy.orm import joinedload
    clergy = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
        joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
    ).filter(Clergy.id == clergy_id).first_or_404()
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
    # Eagerly load ordination and consecration relationships
    from sqlalchemy.orm import joinedload
    clergy = Clergy.query.options(
        joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
        joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
        joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
    ).filter(Clergy.id == clergy_id).first_or_404()
    return render_template('_clergy_comment_modal.html', clergy=clergy)

@main_bp.route('/clergy/relationships/<int:clergy_id>')
def clergy_relationships(clergy_id):
    """Get clergy relationships for lineage visualization"""
    try:
        # Eagerly load ordination and consecration relationships
        from sqlalchemy.orm import joinedload
        clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
        ).filter(Clergy.id == clergy_id).first_or_404()
        
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
                        'color': BLACK_COLOR
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
                        'color': GREEN_COLOR
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
    statuses = Status.query.order_by(Status.badge_position, Status.name).all()
    
    # Render the form template with proper cancel URL pointing back to lineage visualization
    return render_template('_clergy_form_modal.html',
                         fields={
                             'form_action': url_for('main.add_clergy_from_lineage'),
                             'ranks': ranks,
                             'organizations': organizations,
                             'statuses': statuses,
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

# API endpoint for checking and creating pastors
@main_bp.route('/api/check-and-create-pastor', methods=['POST'])
@require_permission('add_clergy')
def check_and_create_pastor():
    """Check if pastor exists by name and create them if they don't"""
    try:
        data = request.get_json()
        pastor_name = data.get('pastor_name', '').strip()
        
        if not pastor_name:
            return jsonify({'success': True, 'pastor_id': None})
        
        # Check if pastor already exists
        existing_pastor = Clergy.query.filter_by(name=pastor_name).first()
        if existing_pastor:
            return jsonify({
                'success': True, 
                'pastor_id': existing_pastor.id,
                'pastor_name': existing_pastor.name,
                'created': False
            })
        
        # Create new pastor with rank 'Pastor' (or 'Priest' if more appropriate)
        new_pastor = Clergy(
            name=pastor_name,
            rank='Pastor',
            notes=f'Auto-created pastor record for {pastor_name}'
        )
        db.session.add(new_pastor)
        db.session.flush()  # Get the ID
        
        # Log the creation
        log_audit_event(
            action='create',
            entity_type='clergy',
            entity_id=new_pastor.id,
            entity_name=new_pastor.name,
            details={
                'rank': new_pastor.rank,
                'auto_created': True,
                'reason': 'Missing pastor for chapel/location'
            }
        )
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'pastor_id': new_pastor.id,
            'pastor_name': new_pastor.name,
            'created': True,
            'message': f'Created new pastor record for {pastor_name}'
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error creating pastor: {str(e)}')
        return jsonify({
            'success': False,
            'message': f'Error creating pastor: {str(e)}'
        }), 500

# Test route for pastor creation functionality
@main_bp.route('/test-pastor-form')
def test_pastor_form():
    """Test route to verify pastor creation functionality"""
    return current_app.send_static_file('test_pastor_form.html')

# Test API endpoint for pastor creation (no authentication required for testing)
@main_bp.route('/api/test-check-and-create-pastor', methods=['POST'])
def test_check_and_create_pastor():
    """Test version of pastor creation API that doesn't require authentication"""
    try:
        data = request.get_json()
        pastor_name = data.get('pastor_name', '').strip()
        
        if not pastor_name:
            return jsonify({'success': True, 'pastor_id': None})
        
        # Check if pastor already exists
        existing_pastor = Clergy.query.filter_by(name=pastor_name).first()
        if existing_pastor:
            return jsonify({
                'success': True, 
                'pastor_id': existing_pastor.id,
                'pastor_name': existing_pastor.name,
                'created': False
            })
        
        # Create new pastor with rank 'Pastor'
        new_pastor = Clergy(
            name=pastor_name,
            rank='Pastor',
            notes=f'Test-created pastor record for {pastor_name}'
        )
        db.session.add(new_pastor)
        db.session.flush()  # Get the ID
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'pastor_id': new_pastor.id,
            'pastor_name': new_pastor.name,
            'created': True,
            'message': f'Test-created new pastor record for {pastor_name}'
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error in test pastor creation: {str(e)}')
        return jsonify({
            'success': False,
            'message': f'Error creating pastor: {str(e)}'
        }), 500

# Test API endpoint for location creation (no authentication required for testing)
@main_bp.route('/api/test-locations-add', methods=['POST'])
def test_add_location():
    """Test version of location creation API that doesn't require authentication"""
    try:
        # Handle organization_id
        organization_id = request.form.get('organization_id')
        if organization_id:
            organization_id = int(organization_id)
        else:
            organization_id = None
        
        location = Location(
            name=request.form['name'],
            address=request.form.get('street_address'),  # Map street_address to address field
            city=request.form.get('city'),
            state_province=request.form.get('state_province'),
            country=request.form.get('country'),
            postal_code=request.form.get('postal_code'),
            latitude=float(request.form['latitude']) if request.form.get('latitude') else None,
            longitude=float(request.form['longitude']) if request.form.get('longitude') else None,
            location_type=request.form.get('location_type', 'church'),
            pastor_name=request.form.get('pastor_name'),
            organization=request.form.get('organization'),  # Keep legacy field
            organization_id=organization_id,  # New foreign key field
            notes=request.form.get('notes'),
            deleted=False,
            created_by=None  # No user for test
        )
        
        db.session.add(location)
        db.session.commit()
        
        # Load the organization relationship for the response
        db.session.refresh(location)
        
        return jsonify({
            'success': True,
            'message': 'Test location added successfully!',
            'location': {
                'id': location.id,
                'name': location.name,
                'address': location.address,
                'city': location.city,
                'state_province': location.state_province,
                'country': location.country,
                'postal_code': location.postal_code,
                'latitude': location.latitude,
                'longitude': location.longitude,
                'location_type': location.location_type,
                'pastor_name': location.pastor_name,
                'organization': location.organization,
                'organization_id': location.organization_id,
                'organization_name': location.organization_obj.name if location.organization_obj else None,
                'notes': location.notes,
                'deleted': location.deleted
            }
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error adding test location: {e}')
        return jsonify({
            'success': False,
            'message': f'Error adding location: {str(e)}'
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
        })

@main_bp.route('/api/organizations')
def api_organizations():
    """API endpoint to get organization data with colors"""
    try:
        # Get all organizations
        organizations = Organization.query.all()
        
        org_data = []
        for org in organizations:
            org_data.append({
                'id': org.id,
                'name': org.name,
                'abbreviation': org.abbreviation,
                'description': org.description,
                'color': org.color
            })
        
        return jsonify({
            'success': True,
            'organizations': org_data,
            'count': len(org_data)
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting organization data: {e}")
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

# Geocoding API endpoints
@main_bp.route('/api/geocode', methods=['POST'])
def geocode_address():
    """Geocode an address to get coordinates"""
    try:
        data = request.get_json()
        address = data.get('address', '').strip()
        
        if not address:
            return jsonify({'error': 'Address is required'}), 400
        
        # Check if geocoding service is configured
        if not geocoding_service.is_configured():
            return jsonify({'error': 'Geocoding service not configured'}), 503
        
        # Get coordinates
        result = geocoding_service.geocode_address(address)
        
        if result:
            return jsonify({
                'success': True,
                'latitude': result['latitude'],
                'longitude': result['longitude'],
                'formatted_address': result['formatted_address'],
                'city': result.get('city'),
                'state': result.get('state'),
                'country': result.get('country'),
                'postcode': result.get('postcode'),
                'confidence': result.get('confidence', 0)
            })
        else:
            return jsonify({'error': 'Address not found'}), 404
            
    except Exception as e:
        current_app.logger.error(f"Geocoding error: {e}")
        return jsonify({'error': 'Geocoding failed'}), 500

@main_bp.route('/api/reverse-geocode', methods=['POST'])
def reverse_geocode():
    """Reverse geocode coordinates to get address"""
    try:
        data = request.get_json()
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        if latitude is None or longitude is None:
            return jsonify({'error': 'Latitude and longitude are required'}), 400
        
        # Check if geocoding service is configured
        if not geocoding_service.is_configured():
            return jsonify({'error': 'Geocoding service not configured'}), 503
        
        # Get address
        result = geocoding_service.reverse_geocode(float(latitude), float(longitude))
        
        if result:
            return jsonify({
                'success': True,
                'formatted_address': result['formatted_address'],
                'city': result.get('city'),
                'state': result.get('state'),
                'country': result.get('country'),
                'postcode': result.get('postcode'),
                'confidence': result.get('confidence', 0)
            })
        else:
            return jsonify({'error': 'Address not found for coordinates'}), 404
            
    except Exception as e:
        current_app.logger.error(f"Reverse geocoding error: {e}")
        return jsonify({'error': 'Reverse geocoding failed'}), 500

@main_bp.route('/api/geocoding-status', methods=['GET'])
def geocoding_status():
    """Check if geocoding service is available"""
    return jsonify({
        'configured': geocoding_service.is_configured(),
        'service': 'OpenCage' if geocoding_service.is_configured() else None
    })

@main_bp.route('/api/countries')
def api_countries():
    """API endpoint to get list of countries"""
    current_app.logger.info("=== COUNTRIES API CALLED ===")
    try:
        # Comprehensive list of countries for international address support
        countries = [
            # North America
            'United States', 'Canada', 'Mexico', 'Guatemala', 'Belize', 'El Salvador', 
            'Honduras', 'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Jamaica', 
            'Haiti', 'Dominican Republic', 'Puerto Rico', 'Trinidad and Tobago',
            
            # South America
            'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 
            'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Guyana', 'Suriname',
            
            # Europe
            'United Kingdom', 'Ireland', 'France', 'Germany', 'Italy', 'Spain', 
            'Portugal', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 
            'Poland', 'Czech Republic', 'Slovakia', 'Hungary', 'Romania', 
            'Bulgaria', 'Greece', 'Croatia', 'Slovenia', 'Serbia', 'Montenegro',
            'Bosnia and Herzegovina', 'Macedonia', 'Albania', 'Moldova', 'Ukraine',
            'Belarus', 'Lithuania', 'Latvia', 'Estonia', 'Finland', 'Sweden',
            'Norway', 'Denmark', 'Iceland', 'Russia', 'Turkey',
            
            # Asia
            'China', 'Japan', 'South Korea', 'North Korea', 'Mongolia', 'India',
            'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Bhutan', 'Myanmar',
            'Thailand', 'Vietnam', 'Laos', 'Cambodia', 'Malaysia', 'Singapore',
            'Indonesia', 'Philippines', 'Brunei', 'Taiwan', 'Hong Kong', 'Macau',
            'Afghanistan', 'Iran', 'Iraq', 'Israel', 'Palestine', 'Jordan',
            'Lebanon', 'Syria', 'Saudi Arabia', 'United Arab Emirates', 'Qatar',
            'Bahrain', 'Kuwait', 'Oman', 'Yemen', 'Kazakhstan', 'Uzbekistan',
            'Turkmenistan', 'Tajikistan', 'Kyrgyzstan', 'Georgia', 'Armenia',
            'Azerbaijan',
            
            # Africa
            'Egypt', 'Libya', 'Tunisia', 'Algeria', 'Morocco', 'Sudan', 'South Sudan',
            'Ethiopia', 'Eritrea', 'Djibouti', 'Somalia', 'Kenya', 'Uganda',
            'Tanzania', 'Rwanda', 'Burundi', 'Democratic Republic of the Congo',
            'Republic of the Congo', 'Central African Republic', 'Chad', 'Cameroon',
            'Nigeria', 'Niger', 'Mali', 'Burkina Faso', 'Senegal', 'Gambia',
            'Guinea-Bissau', 'Guinea', 'Sierra Leone', 'Liberia', 'Ivory Coast',
            'Ghana', 'Togo', 'Benin', 'South Africa', 'Namibia', 'Botswana',
            'Zimbabwe', 'Zambia', 'Malawi', 'Mozambique', 'Madagascar', 'Mauritius',
            'Seychelles', 'Comoros', 'Angola', 'Equatorial Guinea', 'Gabon',
            'São Tomé and Príncipe', 'Cape Verde', 'Mauritania',
            
            # Oceania
            'Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Solomon Islands',
            'Vanuatu', 'New Caledonia', 'Samoa', 'Tonga', 'Kiribati', 'Tuvalu',
            'Nauru', 'Palau', 'Marshall Islands', 'Micronesia',
            
            # Special territories and dependencies
            'Vatican City', 'San Marino', 'Monaco', 'Liechtenstein', 'Andorra',
            'Greenland', 'Faroe Islands', 'Bermuda', 'Cayman Islands', 'British Virgin Islands',
            'US Virgin Islands', 'Guam', 'Northern Mariana Islands', 'American Samoa',
            'Cook Islands', 'French Polynesia', 'New Caledonia', 'Wallis and Futuna',
            'Pitcairn Islands', 'Falkland Islands', 'South Georgia and South Sandwich Islands',
            'Antarctica'
        ]
        
        # Get unique countries from existing locations to add any missing ones
        existing_countries = db.session.query(Location.country).filter(
            Location.country.isnot(None),
            Location.country != ''
        ).distinct().all()
        
        # Add any countries from existing data that aren't in our list
        existing_names = {country[0] for country in existing_countries if country[0]}
        for existing_country in existing_names:
            if existing_country not in countries:
                countries.append(existing_country)
        
        # Convert to list of country objects and sort alphabetically
        country_list = [{'name': country} for country in countries]
        country_list.sort(key=lambda x: x['name'])
        
        current_app.logger.info(f"Returning {len(country_list)} countries")
        
        return jsonify({
            'success': True,
            'countries': country_list
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting countries: {e}")
        return jsonify({'error': 'Failed to get countries'}), 500

@main_bp.route('/api/living-clergy')
def api_living_clergy():
    """API endpoint to get list of living clergy for pastor selection"""
    current_app.logger.info("=== LIVING CLERGY API CALLED ===")
    try:
        from datetime import date
        
        # Get clergy who are alive (no date of death or date of death is in the future)
        # Also exclude deleted clergy
        living_clergy = Clergy.query.filter(
            Clergy.is_deleted != True,
            db.or_(
                Clergy.date_of_death.is_(None),
                Clergy.date_of_death > date.today()
            )
        ).order_by(Clergy.name).all()
        
        # Convert to list of clergy objects
        clergy_list = []
        for person in living_clergy:
            clergy_list.append({
                'id': person.id,
                'name': person.name,
                'rank': person.rank or 'Unknown',
                'organization': person.organization or ''
            })
        
        current_app.logger.info(f"Returning {len(clergy_list)} living clergy")
        
        return jsonify({
            'success': True,
            'clergy': clergy_list
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting living clergy: {e}")
        return jsonify({'error': 'Failed to get clergy list'}), 500

@main_bp.route('/geocoding-test')
def geocoding_test():
    """Test page for geocoding functionality"""
    return render_template('geocoding_test.html')
