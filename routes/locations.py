from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify, current_app
from utils import require_permission, log_audit_event
from models import db, Organization, Location

locations_bp = Blueprint('locations', __name__)


def _get_location_color(location):
    """Get color for a location based on organization first, then location type"""
    if location.organization_obj and location.organization_obj.color:
        return location.organization_obj.color
    if location.organization:
        org = Organization.query.filter_by(name=location.organization).first()
        if org and org.color:
            return org.color
    location_type_colors = {
        'church': '#27ae60',
        'organization': '#3498db',
        'address': '#e74c3c',
        'cathedral': '#9b59b6',
        'monastery': '#f39c12',
        'seminary': '#1abc9c',
        'chapel': '#e74c3c',
        'abbey': '#8e44ad'
    }
    return location_type_colors.get(location.location_type, '#95a5a6')


@locations_bp.route('/api/chapel-locations')
def api_chapel_locations():
    """API endpoint to get location data for chapel view visualization"""
    try:
        all_locations = Location.query.options(db.joinedload(Location.organization_obj)).filter(Location.is_active == True, Location.deleted == False).all()
        nodes = []
        for location in all_locations:
            if location.has_coordinates():
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
        return jsonify({'success': True, 'nodes': nodes, 'count': len(nodes)})
    except Exception as e:
        current_app.logger.error(f"Error getting location data: {e}")
        return jsonify({'success': False, 'error': str(e), 'nodes': [], 'count': 0}), 500


@locations_bp.route('/locations')
@require_permission('manage_metadata')
def locations_list():
    """List all locations"""
    locations = Location.query.filter(Location.is_active == True, Location.deleted == False).all()
    return render_template('locations_list.html', locations=locations)


@locations_bp.route('/locations/add', methods=['GET', 'POST'])
@require_permission('manage_metadata')
def add_location():
    """Add a new location"""
    if request.method == 'POST':
        try:
            organization_id = request.form.get('organization_id')
            organization_id = int(organization_id) if organization_id else None
            location = Location(
                name=request.form['name'],
                address=request.form.get('street_address'),
                city=request.form.get('city'),
                state_province=request.form.get('state_province'),
                country=request.form.get('country'),
                postal_code=request.form.get('postal_code'),
                latitude=float(request.form['latitude']) if request.form.get('latitude') else None,
                longitude=float(request.form['longitude']) if request.form.get('longitude') else None,
                location_type=request.form.get('location_type', 'church'),
                pastor_name=request.form.get('pastor_name'),
                organization=request.form.get('organization'),
                organization_id=organization_id,
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
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
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
            flash('Location added successfully!', 'success')
            return redirect(url_for('locations.locations_list'))
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error adding location: {e}")
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
                return jsonify({'success': False, 'message': f'Error adding location: {str(e)}'}), 400
            flash('Error adding location. Please try again.', 'error')
    organizations = Organization.query.all()
    return render_template('location_form.html', location=None, organizations=organizations)


@locations_bp.route('/locations/<int:location_id>/edit', methods=['GET', 'POST'])
@require_permission('manage_metadata')
def edit_location(location_id):
    """Edit an existing location"""
    location = Location.query.get_or_404(location_id)
    if request.method == 'POST':
        try:
            organization_id = request.form.get('organization_id')
            organization_id = int(organization_id) if organization_id else None
            location.name = request.form['name']
            location.address = request.form.get('street_address')
            location.city = request.form.get('city')
            location.state_province = request.form.get('state_province')
            location.country = request.form.get('country')
            location.postal_code = request.form.get('postal_code')
            location.latitude = float(request.form['latitude']) if request.form.get('latitude') else None
            location.longitude = float(request.form['longitude']) if request.form.get('longitude') else None
            location.location_type = request.form.get('location_type', 'church')
            location.pastor_name = request.form.get('pastor_name')
            location.organization = request.form.get('organization')
            location.organization_id = organization_id
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
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
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
            flash('Location updated successfully!', 'success')
            return redirect(url_for('locations.locations_list'))
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error updating location: {e}")
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
                return jsonify({'success': False, 'message': f'Error updating location: {str(e)}'}), 400
            flash('Error updating location. Please try again.', 'error')
    organizations = Organization.query.all()
    return render_template('location_form.html', location=location, organizations=organizations)


@locations_bp.route('/locations/<int:location_id>/delete', methods=['POST'])
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
    return redirect(url_for('locations.locations_list'))


@locations_bp.route('/locations/<int:location_id>')
def view_location(location_id):
    """View location details"""
    location = Location.query.get_or_404(location_id)
    return render_template('location_details.html', location=location)
