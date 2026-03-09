"""Editor v2: SPA shell with HTMX-loaded panels. Blueprint uses editor_v2/ templates and static."""
from flask import Blueprint, render_template, request, session, jsonify
from sqlalchemy.orm import joinedload

from models import (
    Clergy,
    User,
    Rank,
    Organization,
    Status,
    Ordination,
    Consecration,
    LineageRoot,
    db,
)
from services import clergy as clergy_service
from routes.editor import FormFields
from utils import require_permission

editor_v2_bp = Blueprint(
    'editor_v2_bp',
    __name__,
    url_prefix='/editor-v2',
    template_folder='../editor_v2/templates',
    static_folder='../editor_v2/static',
    static_url_path='/editor-v2/static',
)


@editor_v2_bp.route('/')
def shell():
    """Full-page shell (three panels + statusbar)."""
    return render_template('editor_v2/shell.html')


@editor_v2_bp.route('/panel/left')
@require_permission('edit_clergy')
def panel_left():
    """Left panel snippet for HTMX swap (clergy list)."""
    clergy_list = Clergy.query.order_by(Clergy.name).all()
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    return render_template(
        'editor_v2/snippets/panel_left.html',
        clergy_list=clergy_list,
        user=user,
    )


def _get_lineage_roots():
    """Return list of Clergy that are lineage roots."""
    return list(Clergy.query.filter(Clergy.id.in_(db.session.query(LineageRoot.clergy_id))).all())


@editor_v2_bp.route('/panel/center')
@require_permission('edit_clergy')
def panel_center():
    """Center panel snippet for HTMX swap."""
    clergy_id_raw = request.args.get('clergy_id')
    ranks = Rank.query.all()
    organizations = Organization.query.all()
    statuses = Status.query.order_by(Status.badge_position, Status.name).all()
    fields = FormFields(ranks, organizations, statuses)
    user = User.query.get(session['user_id']) if 'user_id' in session else None

    clergy = None
    if clergy_id_raw is not None:
        try:
            cid = int(clergy_id_raw)
            clergy = (
                Clergy.query.options(
                    joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
                    joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
                    joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators),
                )
                .filter(Clergy.id == cid)
                .first()
            )
        except (ValueError, TypeError):
            pass

    edit_mode = bool(clergy)
    lineage_roots = _get_lineage_roots()

    return render_template(
        'editor_v2/snippets/panel_center.html',
        fields=fields,
        clergy=clergy,
        edit_mode=edit_mode,
        user=user,
        lineage_roots=lineage_roots,
    )


def _effective_status_for_event(event):
    """Return a simple effective status label for an ordination/consecration event.

    This intentionally does not perform any range or timeline logic; it only
    reflects the per-event flags on the record.
    """
    if event.is_invalid:
        return 'invalid'
    if event.is_sub_conditione:
        return 'sub_conditione'
    if getattr(event, 'is_doubtfully_valid', False) or getattr(event, 'is_doubtful_event', False):
        return 'doubtful'
    return 'valid'


def _serialize_event(event, kind):
    """Serialize an Ordination or Consecration to a raw event dict."""
    return {
        'id': event.id,
        'kind': kind,
        'date': event.date.isoformat() if event.date else None,
        'year': event.year,
        'display_date': event.display_date,
        'is_sub_conditione': event.is_sub_conditione,
        'is_doubtfully_valid': getattr(event, 'is_doubtfully_valid', False),
        'is_doubtful_event': getattr(event, 'is_doubtful_event', False),
        'is_invalid': event.is_invalid,
        'effective_status': _effective_status_for_event(event),
        'notes': event.notes,
        'is_inherited': getattr(event, 'is_inherited', False),
        'is_other': getattr(event, 'is_other', False),
        'optional_notes': getattr(event, 'optional_notes', None),
    }


def _serialize_clergy_basic(clergy):
    """Serialize basic clergy fields used by the right-panel JS."""
    if not clergy:
        return None
    name = (
        clergy.papal_name
        if (clergy.rank and clergy.rank.lower() == 'pope' and clergy.papal_name)
        else clergy.name
    )
    return {
        'id': clergy.id,
        'name': name,
        'rank': clergy.rank,
        'organization': clergy.organization,
    }


def _normalize_clergy_save_result(clergy, response, status_code=None):
    """Normalize mixed clergy save responses into a JSON envelope for Editor v2.

    Always returns (json_response, http_status).
    """
    # Unpack common (response, status_code) tuple shapes if passed through.
    if isinstance(response, tuple) and status_code is None:
        # (resp, code) or (resp, headers) – only care about int status here
        if len(response) == 2 and isinstance(response[1], int):
            response, status_code = response
        elif len(response) >= 3 and isinstance(response[1], int):
            response, status_code = response[0], response[1]

    # Try to handle Flask Response objects that may already be JSON.
    from flask import Response  # Local import to avoid unused import warnings elsewhere

    if isinstance(response, Response):
        data = None
        try:
            data = response.get_json(silent=True)
        except Exception:
            data = None

        # If it's already a JSON envelope with success/message/clergy_id, pass through.
        if isinstance(data, dict) and 'success' in data:
            envelope = {
                'success': bool(data.get('success')),
                'message': data.get('message') or '',
            }
            if 'clergy_id' in data:
                envelope['clergy_id'] = data['clergy_id']
            http_status = status_code or response.status_code or 200
            return jsonify(envelope), http_status

        # Detect legacy HTMX redirect/script success responses.
        body = ''
        try:
            body = (response.get_data(as_text=True) or '').strip()
        except Exception:
            body = ''

        if '<script' in body and 'window.location.href' in body:
            message = 'Clergy record saved successfully.'
            envelope = {'success': True, 'message': message}
            if getattr(clergy, 'id', None) is not None:
                envelope['clergy_id'] = clergy.id
            http_status = status_code or 200
            return jsonify(envelope), http_status

        # Any other non-JSON Response is treated as an error for v2.
        http_status = status_code or response.status_code or 500
        return (
            jsonify(
                {
                    'success': False,
                    'message': 'An error occurred while saving clergy record.',
                }
            ),
            http_status,
        )

    # Dict-like payloads (rare in current handlers but handled defensively).
    if isinstance(response, dict):
        success = bool(response.get('success', True))
        envelope = {
            'success': success,
            'message': response.get('message') or '',
        }
        if 'clergy_id' in response:
            envelope['clergy_id'] = response['clergy_id']
        http_status = status_code or (200 if success else 400)
        return jsonify(envelope), http_status

    # Fallback: unexpected type – treat as failure for the SPA.
    http_status = status_code or 500
    return (
        jsonify(
            {
                'success': False,
                'message': 'Unexpected response while saving clergy record.',
            }
        ),
        http_status,
    )


@editor_v2_bp.route('/panel/ordained-consecrated-data')
@require_permission('edit_clergy')
def ordained_consecrated_data():
    """JSON API: raw ordination/consecration data for center clergy and dependents.

    This endpoint intentionally avoids any range-building or cross-event validity
    logic. It only exposes the underlying events and flags so that frontend JS
    can compute ranges and groupings.
    """
    clergy_id_raw = request.args.get('clergy_id')
    if not clergy_id_raw:
        return jsonify({'success': False, 'message': 'clergy_id is required'}), 400

    try:
        cid = int(clergy_id_raw)
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Invalid clergy_id'}), 400

    clergy = (
        Clergy.query.options(
            joinedload(Clergy.ordinations).joinedload(Ordination.ordaining_bishop),
            joinedload(Clergy.consecrations).joinedload(Consecration.consecrator),
            joinedload(Clergy.consecrations).joinedload(Consecration.co_consecrators),
        )
        .filter(Clergy.id == cid)
        .first()
    )
    if not clergy or clergy.is_deleted:
        return jsonify({'success': False, 'message': 'Clergy not found'}), 404

    # Form clergy events (their own ordinations and consecrations)
    form_ordinations = [
        _serialize_event(o, 'ordination') for o in clergy.get_all_ordinations()
    ]
    form_consecrations = [
        _serialize_event(c, 'consecration') for c in clergy.get_all_consecrations()
    ]

    # Clergy ordained by this bishop
    ordained_rows = (
        db.session.query(Clergy, Ordination)
        .join(Ordination, Clergy.id == Ordination.clergy_id)
        .filter(
            Ordination.ordaining_bishop_id == cid,
            Clergy.is_deleted == False,  # noqa: E712
        )
        .all()
    )

    # Clergy consecrated by this bishop (as principal consecrator)
    consecrated_rows = (
        db.session.query(Clergy, Consecration)
        .join(Consecration, Clergy.id == Consecration.clergy_id)
        .filter(
            Consecration.consecrator_id == cid,
            Clergy.is_deleted == False,  # noqa: E712
        )
        .all()
    )

    # Co-consecrated clergy where this bishop served as a co-consecrator
    co_consecrated = []
    for consecration in clergy.consecrations:
        for co in consecration.co_consecrators:
            if not co.is_deleted:
                co_consecrated.append(
                    {
                        'clergy': _serialize_clergy_basic(co),
                        'event': _serialize_event(consecration, 'consecration'),
                        'role': 'co_consecrator',
                    }
                )

    ordained_consecrated = []
    for c_obj, ordination in ordained_rows:
        ordained_consecrated.append(
            {
                'clergy': _serialize_clergy_basic(c_obj),
                'event': _serialize_event(ordination, 'ordination'),
                'role': 'ordinand',
            }
        )
    for c_obj, consecration in consecrated_rows:
        ordained_consecrated.append(
            {
                'clergy': _serialize_clergy_basic(c_obj),
                'event': _serialize_event(consecration, 'consecration'),
                'role': 'consecrand',
            }
        )
    ordained_consecrated.extend(co_consecrated)

    return jsonify(
        {
            'success': True,
            'clergy': _serialize_clergy_basic(clergy),
            'form_events': {
                'ordinations': form_ordinations,
                'consecrations': form_consecrations,
            },
            'ordained_consecrated': ordained_consecrated,
        }
    )


@editor_v2_bp.route('/panel/right')
def panel_right():
    """Right panel snippet for HTMX swap."""
    return render_template('editor_v2/snippets/panel_right.html')


@editor_v2_bp.route('/panel/statusbar')
def panel_statusbar():
    """Statusbar snippet for HTMX swap."""
    return render_template('editor_v2/snippets/statusbar.html')


@editor_v2_bp.route('/clergy/add', methods=['POST'])
@require_permission('edit_clergy')
def clergy_add_v2():
    """Editor v2: add clergy via JSON API, reusing core service logic."""
    result = clergy_service.add_clergy_handler()

    clergy = None
    response = None
    status_code = None

    # Handler may return:
    # - (clergy, response)
    # - (clergy, response, status_code)
    # - bare response
    if isinstance(result, tuple):
        if len(result) == 2:
            clergy, response = result
        elif len(result) >= 3:
            clergy, response, status_code = result[0], result[1], result[2]
    else:
        response = result

    return _normalize_clergy_save_result(clergy, response, status_code)


@editor_v2_bp.route('/clergy/<int:clergy_id>/edit', methods=['POST'])
@require_permission('edit_clergy')
def clergy_edit_v2(clergy_id):
    """Editor v2: edit clergy via JSON API, reusing core service logic."""
    result = clergy_service.edit_clergy_handler(clergy_id)

    clergy = None
    response = None
    status_code = None

    # Handler may eventually mirror add_clergy_handler and return:
    # - (clergy, response)
    # - (clergy, response, status_code)
    # - bare response (current behavior)
    if isinstance(result, tuple):
        if len(result) == 2:
            clergy, response = result
        elif len(result) >= 3:
            clergy, response, status_code = result[0], result[1], result[2]
    else:
        response = result

    return _normalize_clergy_save_result(clergy, response, status_code)
