"""Editor shell: main panels and form endpoints. Submodules register on editor_bp."""
from flask import render_template, request, session, jsonify, current_app
from routes.editor_bp import editor_bp
from utils import require_permission
from models import (
    Clergy, User, db, Organization, Rank, Ordination, Consecration,
    Location, Status, SpriteSheet, ClergySpritePosition, LineageRoot
)
from constants import GREEN_COLOR, BLACK_COLOR
import json
import base64
from routes.main import _lineage_nodes_links, _flat_hierarchy_rows

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


# Validity logic must match docs/VALIDITY_RULES.md and static/js/validity-rules.js
# (Table A effective status, getEffectiveStatus, getWorstStatus, bishop summary / Table C).

STATUS_PRIORITY = {
    'invalid': 4,
    'doubtfully_valid': 3,
    'doubtful_event': 2,
    'sub_conditione': 1,
    'valid': 0
}

EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS = ('valid', 'sub_conditione')


def _get_effective_status(record):
    """Effective status from record (Table A). Matches validity-rules.js getEffectiveStatus."""
    if record is None:
        return 'valid'
    validity = 'valid'
    if getattr(record, 'is_invalid', False):
        validity = 'invalid'
    elif getattr(record, 'is_doubtfully_valid', False):
        validity = 'doubtfully_valid'

    if validity == 'invalid':
        return 'invalid'
    if validity == 'doubtfully_valid':
        return 'doubtfully_valid'
    if getattr(record, 'is_doubtful_event', False):
        return 'doubtful_event'
    if getattr(record, 'is_sub_conditione', False):
        return 'sub_conditione'
    return 'valid'


def _get_validity_value(record):
    if getattr(record, 'is_invalid', False):
        return 'invalid'
    if getattr(record, 'is_doubtfully_valid', False):
        return 'doubtfully_valid'
    return 'valid'


def _get_worst_status(statuses):
    """Worst (lowest validity) status by Table A priority. Matches validity-rules.js getWorstStatus."""
    if not statuses:
        return 'invalid'
    worst = None
    for status in statuses:
        if worst is None or STATUS_PRIORITY.get(status, 0) > STATUS_PRIORITY.get(worst, 0):
            worst = status
    return worst or 'invalid'


def _get_bishop_summary(bishop):
    """Bishop validity summary for rules 6–8 / Table C. Matches validity-rules.js bishop summary."""
    ordination_statuses = [_get_effective_status(o) for o in bishop.ordinations]
    consecration_statuses = [_get_effective_status(c) for c in bishop.consecrations]
    has_valid_ordination = (
        not ordination_statuses
        or any(s in EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS for s in ordination_statuses)
    )
    has_valid_consecration = (
        not consecration_statuses
        or any(s in EFFECTIVE_STATUS_VALID_FOR_GIVING_ORDERS for s in consecration_statuses)
    )
    return {
        'has_valid_ordination': has_valid_ordination,
        'has_valid_consecration': has_valid_consecration,
        'worst_ordination_status': _get_worst_status(ordination_statuses),
        'worst_consecration_status': _get_worst_status(consecration_statuses),
    }

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

    clergy_list_data = []
    bishop_ids = set()
    for clergy in clergy_list:
        ordinations_data = []
        for ordination in clergy.ordinations:
            if ordination.ordaining_bishop_id:
                bishop_ids.add(ordination.ordaining_bishop_id)
            ordinations_data.append({
                'id': ordination.id,
                'ordaining_bishop_id': ordination.ordaining_bishop_id,
                'date': ordination.date.isoformat() if ordination.date else None,
                'date_unknown': ordination.date is None,
                'year': ordination.year,
                'validity': _get_validity_value(ordination),
                'is_sub_conditione': ordination.is_sub_conditione,
                'is_doubtful_event': ordination.is_doubtful_event,
                'is_invalid': ordination.is_invalid,
                'is_doubtfully_valid': ordination.is_doubtfully_valid
            })
        consecrations_data = []
        for consecration in clergy.consecrations:
            if consecration.consecrator_id:
                bishop_ids.add(consecration.consecrator_id)
            consecrations_data.append({
                'id': consecration.id,
                'consecrator_id': consecration.consecrator_id,
                'date': consecration.date.isoformat() if consecration.date else None,
                'date_unknown': consecration.date is None,
                'year': consecration.year,
                'validity': _get_validity_value(consecration),
                'is_sub_conditione': consecration.is_sub_conditione,
                'is_doubtful_event': consecration.is_doubtful_event,
                'is_invalid': consecration.is_invalid,
                'is_doubtfully_valid': consecration.is_doubtfully_valid
            })
        clergy_list_data.append({
            'id': clergy.id,
            'name': clergy.name,
            'display_name': getattr(clergy, 'display_name', None),
            'ordinations': ordinations_data,
            'consecrations': consecrations_data
        })

    bishop_validity_map = {}
    if bishop_ids:
        bishops = Clergy.query.options(
            db.joinedload(Clergy.ordinations),
            db.joinedload(Clergy.consecrations)
        ).filter(Clergy.id.in_(bishop_ids)).all()
        for bishop in bishops:
            bishop_validity_map[bishop.id] = _get_bishop_summary(bishop)

    return render_template('editor_panels/clergy_list.html',
                         clergy_list=clergy_list,
                         organizations=organizations,
                         user=user,
                         sprite_sheet_data=sprite_sheet_data,
                         clergy_list_data_json=json.dumps(clergy_list_data),
                         bishop_validity_map_json=json.dumps(bishop_validity_map),
                         search='',
                         exclude_priests=False,
                         exclude_coconsecrators=False,
                         exclude_organizations=[],
                         show_deleted=False)


@editor_bp.route('/api/bishop-validity/<int:bishop_id>')
@require_permission('edit_clergy')
def bishop_validity(bishop_id):
    """Return validity summary for a bishop's ordinations and consecrations."""
    bishop = Clergy.query.options(
        db.joinedload(Clergy.ordinations),
        db.joinedload(Clergy.consecrations)
    ).filter(Clergy.id == bishop_id).first_or_404()
    return jsonify(_get_bishop_summary(bishop))


@editor_bp.route('/editor/api/validation-impact/bulk-update', methods=['POST'])
@require_permission('edit_clergy')
def validation_impact_bulk_update():
    """
    Bulk-update validity flags for ordinations and consecrations.

    Expects JSON body:
      {
        "root_clergy_id": <int>,  # ID of the clergy from whose perspective the panel is open
        "changes": [
          {
            "type": "ordination" | "consecration",
            "id": <int>,  # Ordination/Consecration ID
            "new_validity": "valid" | "doubtfully_valid" | "invalid"
          },
          ...
        ]
      }

    The handler updates validity-related flags and is_inherited:
      - "valid":            is_invalid = False, is_doubtfully_valid = False, is_inherited = False
      - "doubtfully_valid": is_invalid = False, is_doubtfully_valid = True,  is_inherited = True
      - "invalid":          is_invalid = True,  is_doubtfully_valid = False, is_inherited = True

    Other flags such as is_sub_conditione and is_doubtful_event are left unchanged.
    """
    payload = request.get_json(silent=True) or {}

    root_clergy_id = payload.get('root_clergy_id')
    changes = payload.get('changes') or []

    if root_clergy_id is None or not isinstance(root_clergy_id, int):
        return jsonify({'error': 'root_clergy_id must be provided as an integer'}), 400

    if not isinstance(changes, list):
        return jsonify({'error': 'changes must be a list'}), 400

    updated_ordination_ids = []
    updated_consecration_ids = []
    affected_clergy_ids = set()

    VALID_VALIDITY_VALUES = {'valid', 'doubtfully_valid', 'invalid'}

    try:
        for change in changes:
            if not isinstance(change, dict):
                continue

            change_type = change.get('type')
            change_id = change.get('id')
            new_validity = change.get('new_validity')

            if change_type not in ('ordination', 'consecration'):
                continue
            if not isinstance(change_id, int):
                continue
            if new_validity not in VALID_VALIDITY_VALUES:
                continue

            if change_type == 'ordination':
                record = Ordination.query.get(change_id)
            else:
                record = Consecration.query.get(change_id)

            if not record:
                continue

            # Update validity flags based on new_validity while preserving other flags.
            if new_validity == 'valid':
                record.is_invalid = False
                record.is_doubtfully_valid = False
            elif new_validity == 'doubtfully_valid':
                record.is_invalid = False
                record.is_doubtfully_valid = True
            elif new_validity == 'invalid':
                record.is_invalid = True
                record.is_doubtfully_valid = False

            if new_validity in ('invalid', 'doubtfully_valid'):
                record.is_inherited = True
            elif new_validity == 'valid':
                record.is_inherited = False

            if change_type == 'ordination':
                updated_ordination_ids.append(record.id)
                affected_clergy_ids.add(record.clergy_id)
                if record.ordaining_bishop_id:
                    affected_clergy_ids.add(record.ordaining_bishop_id)
            else:
                updated_consecration_ids.append(record.id)
                affected_clergy_ids.add(record.clergy_id)
                if record.consecrator_id:
                    affected_clergy_ids.add(record.consecrator_id)

        if updated_ordination_ids or updated_consecration_ids:
            db.session.commit()
        else:
            # Nothing to update; no-op but still return a 200 response.
            return jsonify({
                'root_clergy_id': root_clergy_id,
                'updated_count': 0,
                'updated_ordination_ids': [],
                'updated_consecration_ids': [],
                'affected_clergy_ids': []
            })

        return jsonify({
            'root_clergy_id': root_clergy_id,
            'updated_count': len(updated_ordination_ids) + len(updated_consecration_ids),
            'updated_ordination_ids': updated_ordination_ids,
            'updated_consecration_ids': updated_consecration_ids,
            'affected_clergy_ids': sorted(affected_clergy_ids),
        })
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error in validation impact bulk update: {e}")
        return jsonify({'error': 'Failed to apply bulk validation updates'}), 500


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
        from sqlalchemy.orm import joinedload
        from services.lineage import get_ancestors_of_roots

        all_clergy = Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator)
        ).filter(Clergy.is_deleted != True).all()
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
                        'date': ordination.display_date,
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
                        'date': consecration.display_date,
                        'is_sub_conditione': consecration.is_sub_conditione,
                        'is_doubtfully_valid': consecration.is_doubtfully_valid,
                        'is_doubtful_event': consecration.is_doubtful_event,
                        'is_invalid': consecration.is_invalid
                    })

        root_clergy_ids = [lr.clergy_id for lr in LineageRoot.query.all()]
        if root_clergy_ids:
            exclude_ids = get_ancestors_of_roots(root_clergy_ids, links)
            visible_ids = {c.id for c in all_clergy} - exclude_ids
            nodes = [n for n in nodes if n['id'] in visible_ids]
            links = [l for l in links if l['source'] in visible_ids and l['target'] in visible_ids]

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


def _get_lineage_roots():
    """Return list of Clergy that are lineage roots."""
    return list(Clergy.query.filter(Clergy.id.in_(db.session.query(LineageRoot.clergy_id))).all())


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
                             user=user,
                             lineage_roots=_get_lineage_roots())
    else:
        return render_template('editor_panels/clergy_form.html',
                             fields=fields,
                             clergy=None,
                             edit_mode=False,
                             user=user,
                             lineage_roots=_get_lineage_roots())


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
                             context_clergy_id=None,
                             lineage_roots=_get_lineage_roots())
    else:
        return render_template('clergy_form_content.html',
                             fields=fields,
                             clergy=None,
                             edit_mode=False,
                             user=user,
                             context_type=None,
                             context_clergy_id=None,
                             lineage_roots=_get_lineage_roots())


@editor_bp.route('/editor/lineage-menu')
@require_permission('edit_clergy')
def editor_lineage_menu():
    """HTMX endpoint for the center panel lineage menu in the editor."""
    try:
        nodes, links, _ = _lineage_nodes_links()
        rows = _flat_hierarchy_rows(nodes, links)
        user = User.query.get(session['user_id']) if 'user_id' in session else None
        return render_template('editor_lineage_menu.html', rows=rows, user=user)
    except Exception as e:
        current_app.logger.error(f"Error in editor lineage menu: {e}")
        return render_template('editor_lineage_menu.html', rows=[], user=None,
                               error_message=f"Unable to load editor lineage menu data. Error: {str(e)}")
