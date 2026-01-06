from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify, current_app
from services import clergy as clergy_service
from services.clergy import permanently_delete_clergy_handler
from utils import audit_log, require_permission, log_audit_event
from models import Clergy, ClergyComment, User, db, Organization, Rank, Ordination, Consecration, AuditLog, Role, AdminInvite, Location, Status, ClergyEvent, SpriteSheet, ClergySpritePosition
from constants import GREEN_COLOR, BLACK_COLOR
from datetime import datetime
from sqlalchemy import text
import json
import base64

editor_bp = Blueprint('editor', __name__)

@editor_bp.route('/editor')
@require_permission('edit_clergy')
def editor():
    """Main editor interface with 4-panel layout"""
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    return render_template('editor.html', user=user)

@editor_bp.route('/editor/clergy-list')
@require_permission('edit_clergy')  
def clergy_list_panel():
    """HTMX endpoint for the left panel clergy list"""
    # Load ALL clergy data for client-side filtering
    # The JavaScript will handle all filtering including search, priests, deleted, etc.
    clergy_list = Clergy.query.order_by(Clergy.name).all()
    organizations = Organization.query.all()
    
    user = User.query.get(session['user_id']) if 'user_id' in session else None

    return render_template('editor_panels/clergy_list.html', 
                         clergy_list=clergy_list, 
                         organizations=organizations,
                         user=user,
                         search='',  # No initial search
                         exclude_priests=False,  # No initial filters
                         exclude_coconsecrators=False,
                         exclude_organizations=[],
                         show_deleted=False)

@editor_bp.route('/editor/chapel-list')
@require_permission('edit_clergy')
def chapel_list_panel():
    """HTMX endpoint for the left panel chapel list"""
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    
    # Get all active locations (chapels) from the database with organization relationship
    # Filter for church-related location types
    church_types = ['church', 'cathedral', 'chapel', 'monastery', 'seminary', 'abbey']
    locations = Location.query.options(db.joinedload(Location.organization_obj)).filter(
        Location.is_active == True,
        Location.deleted == False,
        Location.location_type.in_(church_types)
    ).order_by(Location.name).all()
    
    return render_template('editor_panels/chapel_list.html', user=user, locations=locations)

@editor_bp.route('/editor/chapel-form')
@editor_bp.route('/editor/chapel-form/<int:location_id>')
@require_permission('edit_clergy')
def chapel_form_panel(location_id=None):
    """HTMX endpoint for the right panel chapel form"""
    print("=== CHAPEL FORM ROUTE CALLED ===")
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    print(f"User: {user}, Location ID: {location_id}")
    
    # Get organizations for dropdown
    organizations = Organization.query.all()
    print(f"Found {len(organizations)} organizations for dropdown")
    
    location = None
    if location_id:
        location = Location.query.get(location_id)
        if not location:
            return "Location not found", 404
    
    try:
        result = render_template('editor_panels/location_form_panel.html', user=user, location=location, organizations=organizations)
        print("Chapel form template rendered successfully")
        return result
    except Exception as e:
        print(f"Error rendering chapel form template: {e}")
        return f"Error: {e}", 500

@editor_bp.route('/editor/visualization')
@require_permission('edit_clergy')
def visualization_panel():
    """HTMX endpoint for the center panel visualization"""
    try:
        # Get only active clergy for the visualization
        all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
        
        # Get all organizations and ranks for color lookup
        organizations = {org.name: org.color for org in Organization.query.all()}
        ranks = {rank.name: rank.color for rank in Rank.query.all()}

        # SVG placeholder for clergy without images
        placeholder_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="24" r="14" fill="#bdc3c7"/><ellipse cx="32" cy="50" rx="20" ry="12" fill="#bdc3c7"/></svg>'''
        placeholder_data_url = 'data:image/svg+xml;base64,' + base64.b64encode(placeholder_svg.encode('utf-8')).decode('utf-8')

        # Prepare data for D3.js
        nodes = []
        links = []
        
        # Create nodes for each clergy
        for clergy in all_clergy:
            # Determine node color based on organization or rank
            node_color = '#3498db'  # Default blue
            if clergy.organization and clergy.organization in organizations:
                node_color = organizations[clergy.organization]
            elif clergy.rank and clergy.rank in ranks:
                node_color = ranks[clergy.rank]

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
            
            nodes.append({
                'id': clergy.id,
                'name': clergy.name,
                'papal_name': clergy.papal_name if hasattr(clergy, 'papal_name') else None,
                'rank': clergy.rank,
                'organization': clergy.organization,
                'color': node_color,
                'image_url': image_url,
                'date_of_birth': clergy.date_of_birth.isoformat() if clergy.date_of_birth else None,
                'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None,
                'is_deleted': clergy.is_deleted
            })

        # Create links for ordinations (black lines)
        for clergy in all_clergy:
            for ordination in clergy.ordinations:
                if ordination.ordaining_bishop and not ordination.ordaining_bishop.is_deleted:
                    links.append({
                        'source': ordination.ordaining_bishop.id,
                        'target': clergy.id,
                        'type': 'ordination',
                        'color': BLACK_COLOR,  # Black for ordinations
                        'date': ordination.date.isoformat() if ordination.date else None,
                        'is_sub_conditione': ordination.is_sub_conditione,
                        'is_doubtful': ordination.is_doubtful,
                        'is_invalid': ordination.is_invalid
                    })

        # Create links for consecrations (green lines)
        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                if consecration.consecrator and not consecration.consecrator.is_deleted:
                    links.append({
                        'source': consecration.consecrator.id,
                        'target': clergy.id,
                        'type': 'consecration',
                        'color': GREEN_COLOR,  # Green for consecrations
                        'date': consecration.date.isoformat() if consecration.date else None,
                        'is_sub_conditione': consecration.is_sub_conditione,
                        'is_doubtful': consecration.is_doubtful,
                        'is_invalid': consecration.is_invalid
                    })

        # Convert to JSON for JavaScript
        nodes_json = json.dumps(nodes)
        links_json = json.dumps(links)

        return render_template('editor_panels/visualization.html', 
                             nodes_json=nodes_json, 
                             links_json=links_json)
    
    except Exception as e:
        current_app.logger.error(f"Error in visualization panel: {e}")
        return render_template('editor_panels/visualization.html', 
                             error_message=f"Error loading visualization: {str(e)}",
                             nodes_json='[]',
                             links_json='[]')

@editor_bp.route('/editor/globe-view')
@require_permission('edit_clergy')
def globe_view_panel():
    """HTMX endpoint for the center panel globe view"""
    try:
        # Get all active locations (chapels, churches, etc.) for the globe visualization with organization relationship
        all_locations = Location.query.options(db.joinedload(Location.organization_obj)).filter(Location.is_active == True, Location.deleted == False).all()
        
        # Prepare data for D3.js globe visualization
        nodes = []
        links = []
        
        # Create nodes for each location with coordinates
        for location in all_locations:
            # Only include locations that have coordinates
            if location.has_coordinates():
                # Import the color function from main.py
                from routes.main import _get_location_color
                
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

        # Convert to JSON for JavaScript
        nodes_json = json.dumps(nodes)
        links_json = json.dumps(links)

        return render_template('editor_panels/globe_view.html', 
                             nodes_json=nodes_json, 
                             links_json=links_json)
    
    except Exception as e:
        current_app.logger.error(f"Error in globe view panel: {e}")
        return render_template('editor_panels/globe_view.html', 
                             error_message=f"Error loading globe view: {str(e)}",
                             nodes_json='[]',
                             links_json='[]')

@editor_bp.route('/editor/clergy-form')
@editor_bp.route('/editor/clergy-form/<int:clergy_id>')
@require_permission('edit_clergy')
def clergy_form_panel(clergy_id=None):
    """HTMX endpoint for the right panel clergy form"""
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    
    # Get form data
    ranks = Rank.query.all()
    organizations = Organization.query.all()
    statuses = Status.query.order_by(Status.badge_position, Status.name).all()
    
    # Debug: Log rank data
    print("=== RANK DEBUG ===")
    for rank in ranks:
        print(f"Rank: {rank.name}, is_bishop: {rank.is_bishop}")
    print("==================")
    
    # Create fields object for the form
    class FormFields:
        def __init__(self, ranks, organizations, statuses):
            self.ranks = ranks
            self.organizations = organizations
            self.statuses = statuses
            self.form_action = None
            self.cancel_url = None
    
    fields = FormFields(ranks, organizations, statuses)
    
    if clergy_id:
        # Edit mode - eagerly load ordination and consecration relationships
        from sqlalchemy.orm import joinedload
        clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
        ).filter(Clergy.id == clergy_id).first_or_404()
        return render_template('editor_panels/clergy_form.html', 
                             fields=fields, 
                             clergy=clergy, 
                             edit_mode=True, 
                             user=user)
    else:
        # Add mode
        return render_template('editor_panels/clergy_form.html', 
                             fields=fields, 
                             clergy=None, 
                             edit_mode=False, 
                             user=user)

@editor_bp.route('/editor/clergy-form-content')
@editor_bp.route('/editor/clergy-form-content/<int:clergy_id>')
@require_permission('edit_clergy')
def clergy_form_content(clergy_id=None):
    """HTMX endpoint for the clergy form content only"""
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    
    # Get form data
    ranks = Rank.query.all()
    organizations = Organization.query.all()
    statuses = Status.query.order_by(Status.badge_position, Status.name).all()
    
    # Debug: Log rank data
    print("=== RANK DEBUG (content) ===")
    for rank in ranks:
        print(f"Rank: {rank.name}, is_bishop: {rank.is_bishop}")
    print("============================")
    
    # Create fields object for the form
    class FormFields:
        def __init__(self, ranks, organizations, statuses):
            self.ranks = ranks
            self.organizations = organizations
            self.statuses = statuses
            self.form_action = None
            self.cancel_url = None
    
    fields = FormFields(ranks, organizations, statuses)
    
    if clergy_id:
        # Edit mode - eagerly load ordination and consecration relationships
        from sqlalchemy.orm import joinedload
        clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
        ).filter(Clergy.id == clergy_id).first_or_404()
        
        # Debug logging for consecration data
        print(f"=== CONSECRATION DEBUG (clergy-form-content) ===")
        print(f"Clergy ID: {clergy_id}")
        print(f"Clergy Name: {clergy.name}")
        print(f"Clergy Rank: {clergy.rank}")
        print(f"Number of ordinations: {len(clergy.ordinations)}")
        print(f"Number of consecrations: {len(clergy.consecrations)}")
        for i, consecration in enumerate(clergy.consecrations):
            print(f"  Consecration {i+1}: ID={consecration.id}, Date={consecration.date}")
            print(f"    Consecrator: {consecration.consecrator.name if consecration.consecrator else 'None'}")
            print(f"    Co-consecrators: {[cc.name for cc in consecration.co_consecrators]}")
        print("===============================================")
        
        return render_template('clergy_form_content.html', 
                             fields=fields, 
                             clergy=clergy, 
                             edit_mode=True, 
                             user=user,
                             context_type=None,
                             context_clergy_id=None)
    else:
        # Add mode
        return render_template('clergy_form_content.html', 
                             fields=fields, 
                             clergy=None, 
                             edit_mode=False, 
                             user=user,
                             context_type=None,
                             context_clergy_id=None)

@editor_bp.route('/editor/audit-logs')
@require_permission('view_audit_logs')
def audit_logs_panel():
    """HTMX endpoint for the bottom panel audit logs tab"""
    page = request.args.get('page', 1, type=int)
    per_page = 50
    
    # Get recent audit logs
    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return render_template('editor_panels/audit_logs.html', logs=logs)

@editor_bp.route('/editor/audit-logs-check')
@require_permission('view_audit_logs')
def audit_logs_check():
    """API endpoint to check for new audit logs since a given ID"""
    since_id = request.args.get('since', 0, type=int)
    
    # Get new logs since the given ID
    new_logs = AuditLog.query.filter(
        AuditLog.id > since_id
    ).order_by(AuditLog.created_at.desc()).limit(10).all()
    
    # Convert to JSON-serializable format
    logs_data = []
    for log in new_logs:
        logs_data.append({
            'id': log.id,
            'action': log.action,
            'entity_name': log.entity_name,
            'entity_type': log.entity_type,
            'created_at': log.created_at.isoformat(),
            'user': {
                'username': log.user.username if log.user else None
            } if log.user else None
        })
    
    return jsonify({
        'new_logs': logs_data,
        'count': len(logs_data)
    })

@editor_bp.route('/editor/events')
@require_permission('edit_clergy')
def events_panel():
    """HTMX endpoint for managing clergy events"""
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    clergy_list = Clergy.query.filter(Clergy.is_deleted != True).order_by(Clergy.name).all()
    selected_id = request.args.get('clergy_id', type=int)
    clergy_options = [{
        'id': clergy.id,
        'name': clergy.name,
        'rank': clergy.rank,
        'organization': clergy.organization
    } for clergy in clergy_list]
    event_types_query = (
        db.session.query(ClergyEvent.event_type)
        .filter(ClergyEvent.event_type.isnot(None))
        .distinct()
        .order_by(ClergyEvent.event_type.asc())
        .all()
    )
    event_types = [row[0] for row in event_types_query if row[0]]

    selected_clergy = None
    if selected_id:
        selected_clergy = Clergy.query.get(selected_id)
    if not selected_clergy and clergy_list:
        selected_clergy = clergy_list[0]

    events = []
    if selected_clergy:
        events = (ClergyEvent.query.filter_by(clergy_id=selected_clergy.id)
                  .order_by(ClergyEvent.event_date.desc(),
                            ClergyEvent.event_year.desc(),
                            ClergyEvent.created_at.desc())
                  .all())

    return render_template(
        'editor_panels/events.html',
        user=user,
        clergy_list=clergy_list,
        selected_clergy=selected_clergy,
        events=events,
        clergy_options=clergy_options,
        event_types=event_types
    )

@editor_bp.route('/editor/events/<int:clergy_id>/table')
@require_permission('edit_clergy')
def clergy_events_table(clergy_id):
    """Return the event table for a given clergy member"""
    clergy = Clergy.query.get_or_404(clergy_id)
    events = (ClergyEvent.query.filter_by(clergy_id=clergy_id)
              .order_by(ClergyEvent.event_date.desc(),
                        ClergyEvent.event_year.desc(),
                        ClergyEvent.created_at.desc())
              .all())

    return render_template(
        'editor_panels/partials/clergy_events_table.html',
        clergy=clergy,
        events=events
    )

@editor_bp.route('/editor/events/add', methods=['POST'])
@require_permission('edit_clergy')
def add_clergy_event():
    """Create a new event tied to a clergy member"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to add events.'}), 401

    try:
        clergy_id = int(request.form.get('clergy_id', 0))
    except (TypeError, ValueError):
        return jsonify({'success': False, 'message': 'Invalid clergy selection.'}), 400

    clergy = Clergy.query.get(clergy_id)
    if not clergy or clergy.is_deleted:
        return jsonify({'success': False, 'message': 'Selected clergy member was not found.'}), 404

    title = (request.form.get('title') or '').strip()
    if not title:
        return jsonify({'success': False, 'message': 'Event title is required.'}), 400

    event_type = (request.form.get('event_type') or '').strip() or None
    description = (request.form.get('description') or '').strip() or None
    event_date_value = (request.form.get('event_date') or '').strip()
    event_year_value = (request.form.get('event_year') or '').strip()
    event_end_date_value = (request.form.get('event_end_date') or '').strip()
    event_end_year_value = (request.form.get('event_end_year') or '').strip()

    event_date = None
    event_year = None
    event_end_date = None
    event_end_year = None

    if event_date_value:
        try:
            event_date = datetime.strptime(event_date_value, '%Y-%m-%d').date()
            event_year = event_date.year
        except ValueError:
            return jsonify({'success': False, 'message': 'Invalid date format. Use YYYY-MM-DD.'}), 400

    if event_year is None:
        if not event_year_value:
            return jsonify({'success': False, 'message': 'Please provide a year or a full date.'}), 400
        try:
            event_year = int(event_year_value)
        except ValueError:
            return jsonify({'success': False, 'message': 'Event year must be a number.'}), 400
        if event_year < 0:
            return jsonify({'success': False, 'message': 'Year must be a positive number.'}), 400

    if event_end_date_value:
        if not event_date and not event_year:
            return jsonify({'success': False, 'message': 'Specify a start date or year before setting an end date.'}), 400
        try:
            event_end_date = datetime.strptime(event_end_date_value, '%Y-%m-%d').date()
            event_end_year = event_end_date.year
        except ValueError:
            return jsonify({'success': False, 'message': 'Invalid end date format. Use YYYY-MM-DD.'}), 400

    if not event_end_date and event_end_year_value:
        try:
            event_end_year = int(event_end_year_value)
        except ValueError:
            return jsonify({'success': False, 'message': 'Event end year must be a number.'}), 400
        if event_end_year < 0:
            return jsonify({'success': False, 'message': 'End year must be a positive number.'}), 400

    if event_end_date and event_date and event_end_date < event_date:
        return jsonify({'success': False, 'message': 'End date cannot be before the start date.'}), 400

    if event_end_year is not None and event_year is not None and event_end_year < event_year:
        return jsonify({'success': False, 'message': 'End year cannot be before the start year.'}), 400

    try:
        new_event = ClergyEvent(
            clergy_id=clergy.id,
            title=title,
            event_type=event_type,
            event_date=event_date,
            event_year=event_year,
            event_end_date=event_end_date,
            event_end_year=event_end_year,
            description=description
        )
        db.session.add(new_event)
        db.session.commit()

        log_audit_event(
            action='add_event',
            entity_type='clergy_event',
            entity_id=new_event.id,
            entity_name=title,
            details={
                'clergy_id': clergy.id,
                'event_year': event_year,
                'event_date': event_date.isoformat() if event_date else None,
                'event_end_year': event_end_year,
                'event_end_date': event_end_date.isoformat() if event_end_date else None
            }
        )

        return jsonify({
            'success': True,
            'message': 'Event saved successfully.',
            'event_id': new_event.id,
            'clergy_id': clergy.id
        })
    except Exception as exc:
        db.session.rollback()
        current_app.logger.error(f'Failed to create clergy event: {exc}')
        return jsonify({'success': False, 'message': 'Unable to save event. Please try again.'}), 500

@editor_bp.route('/editor/metadata')
@require_permission('manage_metadata')
def metadata_panel():
    """HTMX endpoint for the bottom panel metadata tab"""
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    
    return render_template('editor_panels/metadata.html', 
                         ranks=ranks, 
                         organizations=organizations)

@editor_bp.route('/editor/comments')
@require_permission('view_comments')
def comments_panel():
    """HTMX endpoint for the bottom panel comments tab"""
    page = request.args.get('page', 1, type=int)
    per_page = 25
    
    # Get recent comments
    comments = ClergyComment.query.order_by(ClergyComment.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return render_template('editor_panels/comments.html', comments=comments)

@editor_bp.route('/editor/statistics')
@require_permission('edit_clergy')
def statistics_panel():
    """HTMX endpoint for the bottom panel statistics tab"""
    # Calculate basic statistics
    total_clergy = Clergy.query.filter(Clergy.is_deleted != True).count()
    total_bishops = Clergy.query.filter(
        Clergy.is_deleted != True,
        Clergy.rank.in_(['Bishop', 'Archbishop', 'Cardinal', 'Pope'])
    ).count()
    total_priests = Clergy.query.filter(
        Clergy.is_deleted != True,
        Clergy.rank == 'Priest'
    ).count()
    
    # Count by organization
    org_stats = db.session.query(
        Clergy.organization,
        db.func.count(Clergy.id).label('count')
    ).filter(
        Clergy.is_deleted != True,
        Clergy.organization.isnot(None)
    ).group_by(Clergy.organization).order_by(db.desc('count')).all()
    
    # Count by rank
    rank_stats = db.session.query(
        Clergy.rank,
        db.func.count(Clergy.id).label('count')
    ).filter(
        Clergy.is_deleted != True,
        Clergy.rank.isnot(None)
    ).group_by(Clergy.rank).order_by(db.desc('count')).all()
    
    statistics = {
        'total_clergy': total_clergy,
        'total_bishops': total_bishops,
        'total_priests': total_priests,
        'org_stats': org_stats,
        'rank_stats': rank_stats
    }
    
    return render_template('editor_panels/statistics.html', statistics=statistics)

@editor_bp.route('/editor/permanently-delete-clergy', methods=['POST'])
@require_permission('delete_clergy')
def permanently_delete_clergy():
    """Permanently delete selected clergy records"""
    try:
        data = request.get_json()
        clergy_ids = data.get('clergy_ids', [])
        
        if not clergy_ids:
            return jsonify({'success': False, 'message': 'No clergy IDs provided'})
        
        # Convert to integers
        try:
            clergy_ids = [int(id) for id in clergy_ids]
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid clergy ID format'})
        
        # Get user for audit logging
        user = User.query.get(session['user_id']) if 'user_id' in session else None
        
        # Call the service function
        result = permanently_delete_clergy_handler(clergy_ids, user)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error processing request: {str(e)}'})

@editor_bp.route('/editor/settings')
@require_permission('edit_clergy')
def settings_panel():
    """HTMX endpoint for the settings panel"""
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    
    # Filter roles based on user permissions
    all_roles = Role.query.order_by(Role.name).all()
    available_roles = []
    
    for role in all_roles:
        # Super Admin can invite anyone
        if user.is_admin():
            available_roles.append(role)
        # Admin can invite anyone except Super Admin
        elif user.role and user.role.name == 'Admin':
            if role.name != 'Super Admin':
                available_roles.append(role)
        # Regular users cannot invite anyone
        else:
            break
    
    return render_template('editor_panels/settings.html', 
                         user=user, 
                         roles=available_roles)

@editor_bp.route('/editor/settings/change-password', methods=['POST'])
@require_permission('edit_clergy')
def change_password():
    """HTMX endpoint for changing password from settings panel"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to change your password.'})
    
    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'success': False, 'message': 'User not found.'})
    
    current_password = request.form.get('current_password')
    new_password = request.form.get('new_password')
    confirm_password = request.form.get('confirm_password')
    
    # Validate current password
    if not user.check_password(current_password):
        return jsonify({'success': False, 'message': 'Current password is incorrect.'})
    
    # Check if new password and confirmation match
    if new_password != confirm_password:
        return jsonify({'success': False, 'message': 'New password and confirmation do not match.'})
    
    # Validate new password strength
    from utils import validate_password
    is_valid, message = validate_password(new_password)
    if not is_valid:
        return jsonify({'success': False, 'message': f'Password validation failed: {message}'})
    
    # Update password
    user.set_password(new_password)
    db.session.commit()
    
    # Log password change
    from utils import log_audit_event
    log_audit_event(
        action='change_password',
        entity_type='user',
        entity_id=user.id,
        entity_name=user.username,
        details={'password_changed': True}
    )
    
    return jsonify({'success': True, 'message': 'Password changed successfully!'})

@editor_bp.route('/editor/settings/invite', methods=['POST'])
@require_permission('manage_users')
def generate_admin_invite():
    """HTMX endpoint for generating admin invite from settings panel"""
    if 'user_id' not in session or not session.get('is_admin'):
        return jsonify({'success': False, 'message': 'Admin access required.'})
    
    user = User.query.get(session['user_id'])
    
    # Get form parameters
    role_id = request.form.get('role_id')
    expires_in_hours = int(request.form.get('expires_in_hours', 24))
    max_uses = int(request.form.get('max_uses', 1))
    
    if not role_id:
        return jsonify({'success': False, 'message': 'Please select a role for the invited user.'})
    
    # Validate the role exists
    role = Role.query.get(role_id)
    if not role:
        return jsonify({'success': False, 'message': 'Selected role does not exist.'})
    
    # Check permissions based on user role
    if not user.is_admin():
        # Admin can only invite non-Super Admin roles
        if role.name == 'Super Admin':
            return jsonify({'success': False, 'message': 'You do not have permission to invite Super Admin users.'})
    
    # Enforce restrictions for admin roles
    if role.name in ['Super Admin', 'Admin']:
        expires_in_hours = 24  # Fixed 24 hours for admin roles
        max_uses = 1  # Fixed 1 use for admin roles
    else:
        # Validate parameters for regular roles
        if expires_in_hours < 1 or expires_in_hours > 168:  # 1 hour to 1 week
            return jsonify({'success': False, 'message': 'Expiration time must be between 1 and 168 hours.'})
        
        if max_uses < 1 or max_uses > 100:  # 1 to 100 uses
            return jsonify({'success': False, 'message': 'Maximum uses must be between 1 and 100.'})
    
    # Generate unique token and expiry
    from datetime import datetime, timedelta
    from uuid import uuid4
    token = str(uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)
    
    invite = AdminInvite(
        token=token, 
        expires_at=expires_at, 
        invited_by=session['user_id'], 
        role_id=role_id,
        expires_in_hours=expires_in_hours,
        max_uses=max_uses,
        current_uses=0
    )
    
    db.session.add(invite)
    db.session.commit()
    
    # Log admin invite generation
    from utils import log_audit_event
    log_audit_event(
        action='generate_invite',
        entity_type='admin_invite',
        entity_id=invite.id,
        entity_name=f"User invite for {token[:8]}...",
        details={
            'token': token,
            'expires_at': expires_at.isoformat(),
            'invited_by': session['user_id'],
            'role_id': role_id,
            'role_name': role.name,
            'expires_in_hours': expires_in_hours,
            'max_uses': max_uses
        }
    )
    
    invite_link = url_for('auth.admin_invite_signup', token=token, _external=True)
    
    return jsonify({
        'success': True, 
        'message': f'Invite link generated successfully for {role.name} role.',
        'invite_link': invite_link
    })

@editor_bp.route('/editor/user-management')
@require_permission('manage_users')
def user_management_modal():
    """HTMX endpoint for user management modal content"""
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    users = User.query.order_by(User.username).all()
    roles = Role.query.order_by(Role.name).all()
    
    return render_template('editor_panels/user_management.html', 
                         user=user, 
                         users=users, 
                         roles=roles)

@editor_bp.route('/editor/user-management/add', methods=['POST'])
@require_permission('manage_users')
def add_user():
    """Add a new user"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        full_name = data.get('full_name', '').strip()
        password = data.get('password', '').strip()
        role_id = data.get('role_id')
        is_active = data.get('is_active', True)
        
        # Validation
        if not username:
            return jsonify({'success': False, 'message': 'Username is required'}), 400
        
        if not password:
            return jsonify({'success': False, 'message': 'Password is required'}), 400
        
        if not role_id:
            return jsonify({'success': False, 'message': 'Role is required'}), 400
        
        # Check if username already exists
        if User.query.filter_by(username=username).first():
            return jsonify({'success': False, 'message': 'Username already exists'}), 400
        
        # Check if email already exists (if provided)
        if email and User.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already exists'}), 400
        
        # Get role
        role = Role.query.get(role_id)
        if not role:
            return jsonify({'success': False, 'message': 'Invalid role'}), 400
        
        # Create user
        new_user = User(
            username=username,
            email=email if email else None,
            full_name=full_name if full_name else None,
            is_active=is_active
        )
        new_user.set_password(password)
        new_user.role_id = role_id
        
        db.session.add(new_user)
        db.session.commit()
        
        # Log audit event
        log_audit_event(
            user_id=session['user_id'],
            action='create',
            entity_type='user',
            entity_id=new_user.id,
            entity_name=new_user.username,
            details=f'Created user with role: {role.name}'
        )
        
        return jsonify({
            'success': True,
            'message': f'User "{username}" created successfully',
            'user_id': new_user.id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Error creating user: {str(e)}'}), 500

@editor_bp.route('/editor/user-management/<int:user_id>/edit', methods=['PUT'])
@require_permission('manage_users')
def edit_user(user_id):
    """Edit an existing user"""
    try:
        data = request.get_json()
        user = User.query.get_or_404(user_id)
        
        # Don't allow editing the current user's password/role through this interface
        if user.id == session['user_id']:
            return jsonify({'success': False, 'message': 'Cannot edit your own account through this interface'}), 400
        
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        full_name = data.get('full_name', '').strip()
        password = data.get('password', '').strip()
        role_id = data.get('role_id')
        is_active = data.get('is_active', True)
        
        # Validation
        if not username:
            return jsonify({'success': False, 'message': 'Username is required'}), 400
        
        if not role_id:
            return jsonify({'success': False, 'message': 'Role is required'}), 400
        
        # Check if username already exists (excluding current user)
        existing_user = User.query.filter_by(username=username).first()
        if existing_user and existing_user.id != user_id:
            return jsonify({'success': False, 'message': 'Username already exists'}), 400
        
        # Check if email already exists (excluding current user)
        if email:
            existing_email = User.query.filter_by(email=email).first()
            if existing_email and existing_email.id != user_id:
                return jsonify({'success': False, 'message': 'Email already exists'}), 400
        
        # Get role
        role = Role.query.get(role_id)
        if not role:
            return jsonify({'success': False, 'message': 'Invalid role'}), 400
        
        # Update user
        old_username = user.username
        user.username = username
        user.email = email if email else None
        user.full_name = full_name if full_name else None
        user.is_active = is_active
        user.role_id = role_id
        
        # Update password if provided
        if password:
            user.set_password(password)
        
        db.session.commit()
        
        # Log audit event
        log_audit_event(
            user_id=session['user_id'],
            action='update',
            entity_type='user',
            entity_id=user.id,
            entity_name=user.username,
            details=f'Updated user from "{old_username}" to "{username}" with role: {role.name}'
        )
        
        return jsonify({
            'success': True,
            'message': f'User "{username}" updated successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Error updating user: {str(e)}'}), 500

@editor_bp.route('/editor/user-management/<int:user_id>')
@require_permission('manage_users')
def get_user(user_id):
    """Get user data for editing"""
    try:
        user = User.query.get_or_404(user_id)
        
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name,
                'role_id': user.role_id,
                'is_active': user.is_active
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error loading user: {str(e)}'}), 500

@editor_bp.route('/editor/user-management/<int:user_id>/delete', methods=['DELETE'])
@require_permission('manage_users')
def delete_user(user_id):
    """Delete a user"""
    try:
        user = User.query.get_or_404(user_id)
        
        # Don't allow deleting the current user
        if user.id == session['user_id']:
            return jsonify({'success': False, 'message': 'Cannot delete your own account'}), 400
        
        # Don't allow deleting the last Super Admin
        if user.role and user.role.name == 'Super Admin':
            super_admin_count = User.query.join(Role).filter(Role.name == 'Super Admin').count()
            if super_admin_count <= 1:
                return jsonify({'success': False, 'message': 'Cannot delete the last Super Admin'}), 400
        
        username = user.username
        user_id_for_log = user.id
        
        db.session.delete(user)
        db.session.commit()
        
        # Log audit event
        log_audit_event(
            user_id=session['user_id'],
            action='delete',
            entity_type='user',
            entity_id=user_id_for_log,
            entity_name=username,
            details=f'Deleted user "{username}"'
        )
        
        return jsonify({
            'success': True,
            'message': f'User "{username}" deleted successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Error deleting user: {str(e)}'}), 500

@editor_bp.route('/editor/metadata-management')
@require_permission('manage_metadata')
def metadata_management_modal():
    """HTMX endpoint for metadata management modal content"""
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    
    return render_template('editor_panels/metadata_management.html', 
                         ranks=ranks, 
                         organizations=organizations)

@editor_bp.route('/editor/comments-management')
@require_permission('view_comments')
def comments_management_modal():
    """HTMX endpoint for comments management modal content"""
    page = request.args.get('page', 1, type=int)
    per_page = 25
    
    comments = ClergyComment.query.order_by(ClergyComment.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return render_template('editor_panels/comments_management.html', 
                         comments=comments)

# Metadata Management HTMX Endpoints

@editor_bp.route('/editor/metadata/rank/add', methods=['POST'])
def add_rank():
    """HTMX endpoint for adding a new rank"""
    from services.metadata import add_rank_service
    from utils import log_audit_event
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to manage metadata.'})
    
    user = User.query.get(session['user_id'])
    if not user or not user.is_active:
        return jsonify({'success': False, 'message': 'User not found or inactive.'})
    
    if not user.has_permission('manage_metadata'):
        return jsonify({'success': False, 'message': 'You do not have permission to manage metadata.'})
    
    data = request.get_json() or request.form.to_dict()
    
    # Convert checkbox value to boolean
    if 'is_bishop' in data:
        data['is_bishop'] = data['is_bishop'] in ['true', 'on', '1', True]
    
    result = add_rank_service(data, user)
    
    if result['success']:
        # Log audit event
        log_audit_event(
            user_id=session['user_id'],
            action='create',
            entity_type='rank',
            entity_id=result['rank']['id'],
            entity_name=result['rank']['name'],
            details=f'Added rank "{result["rank"]["name"]}"'
        )
    
    return jsonify(result)

@editor_bp.route('/editor/metadata/rank/<int:rank_id>/edit', methods=['PUT', 'POST'])
def edit_rank(rank_id):
    """HTMX endpoint for editing a rank"""
    from services.metadata import edit_rank_service
    from utils import log_audit_event
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to manage metadata.'})
    
    user = User.query.get(session['user_id'])
    if not user or not user.is_active:
        return jsonify({'success': False, 'message': 'User not found or inactive.'})
    
    if not user.has_permission('manage_metadata'):
        return jsonify({'success': False, 'message': 'You do not have permission to manage metadata.'})
    
    data = request.get_json() or request.form.to_dict()
    
    # Convert checkbox value to boolean
    if 'is_bishop' in data:
        data['is_bishop'] = data['is_bishop'] in ['true', 'on', '1', True]
    
    result = edit_rank_service(rank_id, data, user)
    
    if result['success']:
        # Log audit event
        log_audit_event(
            user_id=session['user_id'],
            action='update',
            entity_type='rank',
            entity_id=rank_id,
            entity_name=result['rank']['name'],
            details=f'Updated rank to "{result["rank"]["name"]}"'
        )
    
    return jsonify(result)

@editor_bp.route('/editor/metadata/rank/<int:rank_id>/delete', methods=['DELETE', 'POST'])
def delete_rank(rank_id):
    """HTMX endpoint for deleting a rank"""
    from services.metadata import delete_rank_service
    from utils import log_audit_event
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to manage metadata.'})
    
    user = User.query.get(session['user_id'])
    if not user or not user.is_active:
        return jsonify({'success': False, 'message': 'User not found or inactive.'})
    
    if not user.has_permission('manage_metadata'):
        return jsonify({'success': False, 'message': 'You do not have permission to manage metadata.'})
    
    # Get rank name before deletion for audit log
    rank = Rank.query.get(rank_id)
    rank_name = rank.name if rank else f"ID {rank_id}"
    
    result = delete_rank_service(rank_id, user)
    
    if result['success']:
        # Log audit event
        log_audit_event(
            user_id=session['user_id'],
            action='delete',
            entity_type='rank',
            entity_id=rank_id,
            entity_name=rank_name,
            details=f'Deleted rank "{rank_name}"'
        )
    
    return jsonify(result)

@editor_bp.route('/editor/metadata/rank/<int:rank_id>')
@require_permission('manage_metadata')
def get_rank(rank_id):
    """HTMX endpoint for getting a single rank"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to manage metadata.'})
    
    user = User.query.get(session['user_id'])
    if not user or not user.is_active:
        return jsonify({'success': False, 'message': 'User not found or inactive.'})
    
    if not user.has_permission('manage_metadata'):
        return jsonify({'success': False, 'message': 'You do not have permission to manage metadata.'})
    
    rank = Rank.query.get(rank_id)
    if not rank:
        return jsonify({'success': False, 'message': 'Rank not found'})
    
    return jsonify({
        'success': True,
        'rank': {
            'id': rank.id,
            'name': rank.name,
            'description': rank.description,
            'color': rank.color,
            'is_bishop': rank.is_bishop
        }
    })

@editor_bp.route('/editor/metadata/organization/<int:org_id>')
@require_permission('manage_metadata')
def get_organization(org_id):
    """HTMX endpoint for getting a single organization"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to manage metadata.'})
    
    user = User.query.get(session['user_id'])
    if not user or not user.is_active:
        return jsonify({'success': False, 'message': 'User not found or inactive.'})
    
    if not user.has_permission('manage_metadata'):
        return jsonify({'success': False, 'message': 'You do not have permission to manage metadata.'})
    
    org = Organization.query.get(org_id)
    if not org:
        return jsonify({'success': False, 'message': 'Organization not found'})
    
    return jsonify({
        'success': True,
        'organization': {
            'id': org.id,
            'name': org.name,
            'abbreviation': org.abbreviation,
            'description': org.description,
            'color': org.color
        }
    })

@editor_bp.route('/editor/metadata/organization/add', methods=['POST'])
def add_organization():
    """HTMX endpoint for adding a new organization"""
    from services.metadata import add_organization_service
    from utils import log_audit_event
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to manage metadata.'})
    
    user = User.query.get(session['user_id'])
    if not user or not user.is_active:
        return jsonify({'success': False, 'message': 'User not found or inactive.'})
    
    if not user.has_permission('manage_metadata'):
        return jsonify({'success': False, 'message': 'You do not have permission to manage metadata.'})
    
    data = request.get_json() or request.form.to_dict()
    
    result = add_organization_service(data, user)
    
    if result['success']:
        # Log audit event
        log_audit_event(
            user_id=session['user_id'],
            action='create',
            entity_type='organization',
            entity_id=result['organization']['id'],
            entity_name=result['organization']['name'],
            details=f'Added organization "{result["organization"]["name"]}"'
        )
    
    return jsonify(result)

@editor_bp.route('/editor/metadata/organization/<int:org_id>/edit', methods=['PUT', 'POST'])
def edit_organization(org_id):
    """HTMX endpoint for editing an organization"""
    from services.metadata import edit_organization_service
    from utils import log_audit_event
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to manage metadata.'})
    
    user = User.query.get(session['user_id'])
    if not user or not user.is_active:
        return jsonify({'success': False, 'message': 'User not found or inactive.'})
    
    if not user.has_permission('manage_metadata'):
        return jsonify({'success': False, 'message': 'You do not have permission to manage metadata.'})
    
    data = request.get_json() or request.form.to_dict()
    
    result = edit_organization_service(org_id, data, user)
    
    if result['success']:
        # Log audit event
        log_audit_event(
            user_id=session['user_id'],
            action='update',
            entity_type='organization',
            entity_id=org_id,
            entity_name=result['organization']['name'],
            details=f'Updated organization to "{result["organization"]["name"]}"'
        )
    
    return jsonify(result)

# Status Bar API Endpoints

@editor_bp.route('/api/stats/clergy-count')
@require_permission('edit_clergy')
def api_clergy_count():
    """API endpoint for clergy count in status bar"""
    try:
        count = Clergy.query.count()
        return jsonify({'count': count})
    except Exception as e:
        current_app.logger.error(f"Error getting clergy count: {str(e)}")
        return jsonify({'count': 0, 'error': str(e)}), 500

@editor_bp.route('/api/stats/records-count')
@require_permission('edit_clergy')
def api_records_count():
    """API endpoint for total records count in status bar"""
    try:
        # Count all records across different tables
        clergy_count = Clergy.query.count()
        ordination_count = Ordination.query.count()
        consecration_count = Consecration.query.count()
        comment_count = ClergyComment.query.count()
        
        total_records = clergy_count + ordination_count + consecration_count + comment_count
        return jsonify({'count': total_records})
    except Exception as e:
        current_app.logger.error(f"Error getting records count: {str(e)}")
        return jsonify({'count': 0, 'error': str(e)}), 500

@editor_bp.route('/api/stats/db-status')
@require_permission('edit_clergy')
def api_db_status():
    """API endpoint for database connection status in status bar"""
    try:
        # Test database connection with a simple query
        start_time = datetime.now()
        db.session.execute(text('SELECT 1'))
        db.session.commit()
        response_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Check if we can query clergy table specifically
        clergy_count = Clergy.query.count()
        ordination_count = Ordination.query.count()
        consecration_count = Consecration.query.count()
        
        # Get database info
        db_info = {
            'status': 'connected',
            'details': f'Response time: {response_time:.1f}ms, {clergy_count} clergy, {ordination_count + consecration_count} events',
            'response_time': f'{response_time:.1f}ms',
            'clergy_count': clergy_count,
            'ordination_count': ordination_count,
            'consecration_count': consecration_count
        }
        
        return jsonify(db_info)
    except Exception as e:
        current_app.logger.error(f"Database connection error: {str(e)}")
        
        # Check if it's a connection error vs other error
        error_str = str(e).lower()
        if 'connection' in error_str or 'timeout' in error_str or 'refused' in error_str:
            return jsonify({
                'status': 'error',
                'details': f'Connection failed: {str(e)[:50]}...',
                'error': str(e)
            })
        else:
            return jsonify({
                'status': 'warning',
                'details': f'Query error: {str(e)[:50]}...',
                'error': str(e)
            })

@editor_bp.route('/api/sprite-sheet')
def get_sprite_sheet():
    """API endpoint to get the current sprite sheet URL and mapping"""
    try:
        # Get the current sprite sheet from database
        sprite_sheet = SpriteSheet.query.filter_by(is_current=True).first()
        
        if sprite_sheet:
            # Get all positions for this sprite sheet
            positions = ClergySpritePosition.query.filter_by(sprite_sheet_id=sprite_sheet.id).all()
            
            # Build mapping dictionary
            mapping = {pos.clergy_id: (pos.x_position, pos.y_position) for pos in positions}
            
            return jsonify({
                'success': True,
                'url': sprite_sheet.url,
                'mapping': mapping,
                'thumbnail_size': sprite_sheet.thumbnail_size,
                'images_per_row': sprite_sheet.images_per_row,
                'sprite_width': sprite_sheet.sprite_width,
                'sprite_height': sprite_sheet.sprite_height
            })
        else:
            # No sprite sheet exists - generate on demand
            from services.image_upload import get_image_upload_service
            
            image_upload_service = get_image_upload_service()
            if not image_upload_service.backblaze_configured:
                return jsonify({
                    'success': False,
                    'error': 'Image storage not configured'
                }), 500
            
            # Get all active clergy (include ALL clergy, placeholders will be used for those without images)
            all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
            
            if not all_clergy:
                return jsonify({
                    'success': False,
                    'error': 'No clergy found'
                }), 404
            
            # Create sprite sheet (this will save to database)
            # Placeholders will be automatically added for clergy without images
            result = image_upload_service.create_sprite_sheet(all_clergy)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'url': result['url'],
                    'mapping': result['mapping'],
                    'thumbnail_size': result['thumbnail_size'],
                    'images_per_row': result['images_per_row'],
                    'sprite_width': result['sprite_width'],
                    'sprite_height': result['sprite_height']
                })
            else:
                return jsonify({
                    'success': False,
                    'error': result.get('error', 'Failed to create sprite sheet')
                }), 500
                
    except Exception as e:
        current_app.logger.error(f"Error getting sprite sheet: {e}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@editor_bp.route('/editor/metadata/organization/<int:org_id>/delete', methods=['DELETE', 'POST'])
def delete_organization(org_id):
    """HTMX endpoint for deleting an organization"""
    from services.metadata import delete_organization_service
    from utils import log_audit_event
    
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to manage metadata.'})
    
    user = User.query.get(session['user_id'])
    if not user or not user.is_active:
        return jsonify({'success': False, 'message': 'User not found or inactive.'})
    
    if not user.has_permission('manage_metadata'):
        return jsonify({'success': False, 'message': 'You do not have permission to manage metadata.'})
    
    # Get organization name before deletion for audit log
    org = Organization.query.get(org_id)
    org_name = org.name if org else f"ID {org_id}"
    
    result = delete_organization_service(org_id, user)
    
    if result['success']:
        # Log audit event
        log_audit_event(
            user_id=session['user_id'],
            action='delete',
            entity_type='organization',
            entity_id=org_id,
            entity_name=org_name,
            details=f'Deleted organization "{org_name}"'
        )
    
    return jsonify(result)

@editor_bp.route('/editor/audit-logs-management')
@require_permission('view_audit_logs')
def audit_logs_management_modal():
    """HTMX endpoint for audit logs management modal content"""
    page = request.args.get('page', 1, type=int)
    action_filter = request.args.get('action', '')
    entity_type_filter = request.args.get('entity_type', '')
    user_filter = request.args.get('user', '')
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')
    
    # Build query
    query = AuditLog.query
    
    if action_filter:
        query = query.filter(AuditLog.action == action_filter)
    if entity_type_filter:
        query = query.filter(AuditLog.entity_type == entity_type_filter)
    if user_filter:
        query = query.join(User).filter(User.username == user_filter)
    if date_from:
        query = query.filter(AuditLog.created_at >= datetime.strptime(date_from, '%Y-%m-%d'))
    if date_to:
        query = query.filter(AuditLog.created_at <= datetime.strptime(date_to, '%Y-%m-%d'))
    
    audit_logs = query.order_by(AuditLog.created_at.desc()).paginate(
        page=page, per_page=50, error_out=False
    )
    
    return render_template('editor_panels/audit_logs_management.html', 
                         audit_logs=audit_logs,
                         action_filter=action_filter,
                         entity_type_filter=entity_type_filter,
                         user_filter=user_filter,
                         date_from=date_from,
                         date_to=date_to)
