"""Editor shell: main panels and form endpoints. Submodules register on editor_bp."""
from flask import render_template, request, session, jsonify, current_app
from routes.editor_bp import editor_bp
from utils import require_permission
from models import (
    Clergy, User, db, Organization, Rank, Ordination, Consecration,
    Location, Status, SpriteSheet, ClergySpritePosition
)
from constants import GREEN_COLOR, BLACK_COLOR
import json
import base64

from routes import editor_visualization_api  # noqa: F401 - registers routes
from routes import editor_audit_events  # noqa: F401
from routes import editor_settings  # noqa: F401
from routes import editor_user_management  # noqa: F401
from routes import editor_metadata  # noqa: F401


class FormFields:
    """Shared form context for clergy form panel and form content endpoints."""

    def __init__(self, ranks, organizations, statuses):
        self.ranks = ranks
        self.organizations = organizations
        self.statuses = statuses
        self.form_action = None
        self.cancel_url = None


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
    clergy_list = Clergy.query.order_by(Clergy.name).all()
    organizations = Organization.query.all()

    user = User.query.get(session['user_id']) if 'user_id' in session else None

    sprite_sheet_data = None
    try:
        sprite_sheet = SpriteSheet.query.filter_by(is_current=True).first()
        if sprite_sheet:
            positions = ClergySpritePosition.query.filter_by(sprite_sheet_id=sprite_sheet.id).all()
            mapping = {pos.clergy_id: (pos.x_position, pos.y_position) for pos in positions}
            sprite_sheet_data = {
                'url': sprite_sheet.url,
                'mapping': mapping,
                'thumbnail_size': sprite_sheet.thumbnail_size,
                'images_per_row': sprite_sheet.images_per_row,
                'sprite_width': sprite_sheet.sprite_width,
                'sprite_height': sprite_sheet.sprite_height
            }
    except Exception as e:
        current_app.logger.warning(f"Could not load sprite sheet for clergy list: {e}")

    return render_template('editor_panels/clergy_list.html',
                         clergy_list=clergy_list,
                         organizations=organizations,
                         user=user,
                         sprite_sheet_data=sprite_sheet_data,
                         search='',
                         exclude_priests=False,
                         exclude_coconsecrators=False,
                         exclude_organizations=[],
                         show_deleted=False)


@editor_bp.route('/editor/chapel-list')
@require_permission('edit_clergy')
def chapel_list_panel():
    """HTMX endpoint for the left panel chapel list"""
    user = User.query.get(session['user_id']) if 'user_id' in session else None

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
    user = User.query.get(session['user_id']) if 'user_id' in session else None

    organizations = Organization.query.all()

    location = None
    if location_id:
        location = Location.query.get(location_id)
        if not location:
            return "Location not found", 404

    try:
        return render_template('editor_panels/location_form_panel.html', user=user, location=location, organizations=organizations)
    except Exception as e:
        return f"Error: {e}", 500


@editor_bp.route('/editor/visualization')
@require_permission('edit_clergy')
def visualization_panel():
    """HTMX endpoint for the center panel visualization"""
    try:
        all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
        organizations = {org.name: org.color for org in Organization.query.all()}
        ranks = {rank.name: rank.color for rank in Rank.query.all()}

        placeholder_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="24" r="14" fill="#bdc3c7"/><ellipse cx="32" cy="50" rx="20" ry="12" fill="#bdc3c7"/></svg>'''
        placeholder_data_url = 'data:image/svg+xml;base64,' + base64.b64encode(placeholder_svg.encode('utf-8')).decode('utf-8')

        nodes = []
        links = []

        for clergy in all_clergy:
            org_color = organizations.get(clergy.organization) or '#2c3e50'
            rank_color = ranks.get(clergy.rank) or '#888888'

            image_url = placeholder_data_url
            if clergy.image_data:
                try:
                    image_data = json.loads(clergy.image_data)
                    image_url = image_data.get('lineage', image_data.get('detail', image_data.get('original', '')))
                except (json.JSONDecodeError, AttributeError):
                    pass

            if not image_url or image_url == placeholder_data_url:
                image_url = clergy.image_url if clergy.image_url else placeholder_data_url

            nodes.append({
                'id': clergy.id,
                'name': clergy.name,
                'papal_name': clergy.papal_name if hasattr(clergy, 'papal_name') else None,
                'rank': clergy.rank,
                'organization': clergy.organization,
                'org_color': org_color,
                'rank_color': rank_color,
                'image_url': image_url,
                'date_of_birth': clergy.date_of_birth.isoformat() if clergy.date_of_birth else None,
                'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None,
                'is_deleted': clergy.is_deleted
            })

        for clergy in all_clergy:
            for ordination in clergy.ordinations:
                if ordination.ordaining_bishop and not ordination.ordaining_bishop.is_deleted:
                    links.append({
                        'source': ordination.ordaining_bishop.id,
                        'target': clergy.id,
                        'type': 'ordination',
                        'color': BLACK_COLOR,
                        'date': ordination.date.isoformat() if ordination.date else None,
                        'is_sub_conditione': ordination.is_sub_conditione,
                        'is_doubtfully_valid': ordination.is_doubtfully_valid,
                        'is_doubtful_event': ordination.is_doubtful_event,
                        'is_invalid': ordination.is_invalid
                    })

        for clergy in all_clergy:
            for consecration in clergy.consecrations:
                if consecration.consecrator and not consecration.consecrator.is_deleted:
                    links.append({
                        'source': consecration.consecrator.id,
                        'target': clergy.id,
                        'type': 'consecration',
                        'color': GREEN_COLOR,
                        'date': consecration.date.isoformat() if consecration.date else None,
                        'is_sub_conditione': consecration.is_sub_conditione,
                        'is_doubtfully_valid': consecration.is_doubtfully_valid,
                        'is_doubtful_event': consecration.is_doubtful_event,
                        'is_invalid': consecration.is_invalid
                    })

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
        from routes.locations import _get_location_color

        all_locations = Location.query.options(db.joinedload(Location.organization_obj)).filter(Location.is_active == True, Location.deleted == False).all()
        nodes = []
        links = []

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

    ranks = Rank.query.all()
    organizations = Organization.query.all()
    statuses = Status.query.order_by(Status.badge_position, Status.name).all()
    fields = FormFields(ranks, organizations, statuses)

    if clergy_id:
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

    ranks = Rank.query.all()
    organizations = Organization.query.all()
    statuses = Status.query.order_by(Status.badge_position, Status.name).all()
    fields = FormFields(ranks, organizations, statuses)

    if clergy_id:
        from sqlalchemy.orm import joinedload
        clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators)
        ).filter(Clergy.id == clergy_id).first_or_404()
        return render_template('clergy_form_content.html',
                             fields=fields,
                             clergy=clergy,
                             edit_mode=True,
                             user=user,
                             context_type=None,
                             context_clergy_id=None)
    else:
        return render_template('clergy_form_content.html',
                             fields=fields,
                             clergy=None,
                             edit_mode=False,
                             user=user,
                             context_type=None,
                             context_clergy_id=None)
