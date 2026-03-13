"""Editor v2: SPA shell with HTMX-loaded panels. Blueprint uses editor_v2/ templates and static."""
from flask import Blueprint, render_template, request, session, jsonify, current_app
from sqlalchemy.orm import joinedload
from sqlalchemy import text
from datetime import datetime

from models import (
    Clergy,
    User,
    Rank,
    Organization,
    Status,
    Ordination,
    Consecration,
    co_consecrators,
    db,
)
from services import clergy as clergy_service
from routes.editor import FormFields
from utils import require_permission
from routes.main import _lineage_nodes_links, _flat_hierarchy_rows


def _rows_to_tree(rows):
    """Convert flat DFS-ordered rows (with depth) into a nested tree.

    Data contract:
    - Input ``rows`` is an iterable of mapping-like objects where each row
      at minimum exposes:
        - ``id``: ``int`` clergy ID (normalized upstream; see ``panel_left``)
        - ``depth``: ``int`` depth from the root (0-based)
        - other display fields used by the template (e.g. ``name``, ``rank``,
          ``organization``).
    - Return value is a list of tree nodes where each node is a dict with:
        - ``'row'``: the original row mapping
        - ``'children'``: ``list`` of child nodes using the same shape.

    The ``children`` field is always present and is always a list (possibly
    empty) so that the Jinja template can safely recurse without additional
    ``None`` checks.
    """
    stack = []
    root_list = []
    for row in rows:
        depth = row['depth']
        while stack and stack[-1]['row']['depth'] >= depth:
            stack.pop()
        node = {'row': row, 'children': []}
        if stack:
            stack[-1]['children'].append(node)
        else:
            root_list.append(node)
        stack.append(node)
    return root_list


editor_v2_bp = Blueprint(
    'editor_v2_bp',
    __name__,
    url_prefix='/editor-v2',
    template_folder='../editor_v2/templates',
    static_folder='../editor_v2/static',
    static_url_path='/editor-v2/static',
)


@editor_v2_bp.route('/')
@require_permission('edit_clergy')
def shell():
    """Full-page shell (three panels + statusbar)."""
    return render_template('editor_v2/shell.html')


def _all_clergy_list():
    """Return list of { id, name, rank, organization } for non-deleted clergy, ordered by name."""
    all_clergy = (
        Clergy.query.filter(Clergy.is_deleted != True)  # noqa: E712
        .order_by(Clergy.name)
        .all()
    )
    return [
        {
            'id': c.id,
            'name': getattr(c, 'display_name', c.name),
            'rank': c.rank,
            'organization': c.organization,
        }
        for c in all_clergy
    ]


@editor_v2_bp.route('/api/clergy-list')
@require_permission('edit_clergy')
def api_clergy_list():
    """JSON API: full clergy list for search overlay when center panel has not loaded yet."""
    return jsonify(_all_clergy_list())


@editor_v2_bp.route('/panel/left')
@require_permission('edit_clergy')
def panel_left():
    """Left panel snippet for HTMX swap (tiered clergy list, same as lineage menu).

    Context variables/contracts passed to the template:
    - ``rows``: list of flat row dicts, DFS-ordered, where each row has at
      minimum:
        - ``id``: ``int`` clergy ID (normalized here before tree building)
        - ``depth``: ``int`` depth used by ``_rows_to_tree``
        - display fields such as ``name``, ``rank``, ``organization``.
    - ``rows_tree``: list of nested tree nodes produced by ``_rows_to_tree``,
      where each node is a dict: ``{'row': row_dict, 'children': [node, ...]}``.
      The ``children`` key is always present and is always a list.
    - ``deceased_ids``: ``set[int]`` of clergy IDs that have a non-null
      ``date_of_death``; used exclusively for template-level deceased markers.
    """
    nodes, links, _ = _lineage_nodes_links()
    rows = _flat_hierarchy_rows(nodes, links)

    # Normalize and validate clergy IDs on rows so that template usage of
    # node.row.id (for URLs, data attributes, and deceased markers) is safe
    # and consistent. Coerce string IDs like "5" to integers and drop any
    # rows that cannot provide a usable integer ID to avoid broken links.
    normalized_rows = []
    for row in rows:
        raw_id = row.get('id')
        coerced_id = None
        if raw_id is not None:
            try:
                coerced_id = int(raw_id)
            except (TypeError, ValueError):
                coerced_id = None
        if coerced_id is None:
            continue
        normalized_row = dict(row)
        normalized_row['id'] = coerced_id
        normalized_rows.append(normalized_row)

    rows = normalized_rows

    unique_ids = {row['id'] for row in rows}
    if unique_ids:
        deceased = Clergy.query.filter(
            Clergy.id.in_(unique_ids),
            Clergy.date_of_death.isnot(None),
        ).all()
        deceased_ids = {c.id for c in deceased}
    else:
        deceased_ids = set()
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    rows_tree = _rows_to_tree(rows)
    return render_template(
        'editor_v2/snippets/panel_left.html',
        rows=rows,
        rows_tree=rows_tree,
        deceased_ids=deceased_ids,
        user=user,
    )

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

    # Preload bishops for client-side autocomplete in the v2 clergy form.
    # This mirrors the data shape used by legacy clergy forms and modals.
    all_bishops = (
        db.session.query(Clergy)
        .join(Rank, Clergy.rank == Rank.name)
        .filter(Rank.is_bishop == True, Clergy.is_deleted != True)  # noqa: E712
        .order_by(Clergy.name)
        .all()
    )
    all_bishops_suggested = [
        {
            'id': bishop.id,
            'name': getattr(bishop, 'display_name', bishop.name),
            'rank': bishop.rank,
            'organization': bishop.organization,
        }
        for bishop in all_bishops
    ]

    all_clergy_suggested = _all_clergy_list()

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
    has_descendants = bool(_get_direct_dependents(clergy.id)) if clergy else False

    return render_template(
        'editor_v2/snippets/panel_center.html',
        fields=fields,
        clergy=clergy,
        edit_mode=edit_mode,
        user=user,
        has_descendants=has_descendants,
        all_bishops_suggested=all_bishops_suggested,
        all_clergy_suggested=all_clergy_suggested,
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
        'date_unknown': event.date is None and event.year is not None,
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
        'details_unknown': getattr(event, 'details_unknown', False),
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


# Lineage tree caps to avoid huge payloads
MAX_LINEAGE_DEPTH = 10
MAX_LINEAGE_NODES = 500


def _get_direct_dependents(clergy_id):
    """Return list of (clergy_obj, event, role) for direct ordinees/consecrands/co-consecrated."""
    result = []
    ordained_rows = (
        db.session.query(Clergy, Ordination)
        .join(Ordination, Clergy.id == Ordination.clergy_id)
        .filter(
            Ordination.ordaining_bishop_id == clergy_id,
            Clergy.is_deleted == False,  # noqa: E712
            Clergy.exclude_from_visualization != True,  # noqa: E712
        )
        .all()
    )
    for c_obj, evt in ordained_rows:
        result.append((c_obj, evt, 'ordinand'))
    consecrated_rows = (
        db.session.query(Clergy, Consecration)
        .join(Consecration, Clergy.id == Consecration.clergy_id)
        .filter(
            Consecration.consecrator_id == clergy_id,
            Clergy.is_deleted == False,  # noqa: E712
            Clergy.exclude_from_visualization != True,  # noqa: E712
        )
        .all()
    )
    for c_obj, evt in consecrated_rows:
        result.append((c_obj, evt, 'consecrand'))
    co_rows = (
        db.session.query(Clergy, Consecration)
        .join(Consecration, Clergy.id == Consecration.clergy_id)
        .join(co_consecrators, Consecration.id == co_consecrators.c.consecration_id)
        .filter(
            co_consecrators.c.co_consecrator_id == clergy_id,
            Clergy.is_deleted == False,  # noqa: E712
            Clergy.exclude_from_visualization != True,  # noqa: E712
        )
        .all()
    )
    for c_obj, evt in co_rows:
        result.append((c_obj, evt, 'co_consecrator'))
    return result


def _build_descendants_tree(clergy_id, depth, max_depth, max_nodes, nodes_count):
    """Build recursive descendants tree; nodes_count is a list of one int (mutated)."""
    if depth >= max_depth or nodes_count[0] >= max_nodes:
        return []
    dependents = _get_direct_dependents(clergy_id)
    nodes = []
    for c_obj, event, role in dependents:
        if nodes_count[0] >= max_nodes:
            break
        nodes_count[0] += 1
        kind = 'ordination' if isinstance(event, Ordination) else 'consecration'
        node = {
            'clergy': _serialize_clergy_basic(c_obj),
            'event': _serialize_event(event, kind),
            'role': role,
            'lineType': kind,
            'descendants': _build_descendants_tree(
                c_obj.id, depth + 1, max_depth, max_nodes, nodes_count
            ),
        }
        nodes.append(node)
    return nodes


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
            Clergy.exclude_from_visualization != True,  # noqa: E712
        )
        .all()
    )

    direct_ordained_ids = {c_obj.id for c_obj, _ in ordained_rows}

    # Clergy consecrated by this bishop (as principal consecrator)
    consecrated_rows = (
        db.session.query(Clergy, Consecration)
        .join(Consecration, Clergy.id == Consecration.clergy_id)
        .filter(
            Consecration.consecrator_id == cid,
            Clergy.is_deleted == False,  # noqa: E712
            Clergy.exclude_from_visualization != True,  # noqa: E712
        )
        .all()
    )

    direct_consecrated_ids = {c_obj.id for c_obj, _ in consecrated_rows}

    protected_ids = direct_ordained_ids | direct_consecrated_ids

    # Co-consecrated clergy where this bishop served as a co-consecrator
    co_consecrated = []
    for consecration in clergy.consecrations:
        for co in consecration.co_consecrators:
            if not co.is_deleted and not getattr(co, 'exclude_from_visualization', False):
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
                'lineType': 'ordination',
                'descendants': _build_descendants_tree(
                    c_obj.id, 0, MAX_LINEAGE_DEPTH, MAX_LINEAGE_NODES, [0]
                ),
            }
        )
    for c_obj, consecration in consecrated_rows:
        ordained_consecrated.append(
            {
                'clergy': _serialize_clergy_basic(c_obj),
                'event': _serialize_event(consecration, 'consecration'),
                'role': 'consecrand',
                'lineType': 'consecration',
                'descendants': _build_descendants_tree(
                    c_obj.id, 0, MAX_LINEAGE_DEPTH, MAX_LINEAGE_NODES, [0]
                ),
            }
        )
    for item in co_consecrated:
        cid = item['clergy']['id']
        item['lineType'] = 'consecration'
        item['descendants'] = _build_descendants_tree(
            cid, 0, MAX_LINEAGE_DEPTH, MAX_LINEAGE_NODES, [0]
        )

    def _compute_excluded_ids_for_co_consecrators(co_items):
        """Return set of clergy IDs to exclude for co-consecrator-derived lines."""
        excluded_ids = set()

        def _walk(nodes):
            for node in nodes:
                clergy_info = node.get('clergy') or {}
                node_clergy_id = clergy_info.get('id')
                if node_clergy_id is not None:
                    excluded_ids.add(node_clergy_id)
                _walk(node.get('descendants') or [])

        for co_item in co_items:
            clergy_info = co_item.get('clergy') or {}
            co_id = clergy_info.get('id')
            if co_id is not None:
                excluded_ids.add(co_id)
            _walk(co_item.get('descendants') or [])

        return excluded_ids

    excluded_clergy_ids = _compute_excluded_ids_for_co_consecrators(co_consecrated)
    effective_excluded_ids = excluded_clergy_ids - protected_ids

    if effective_excluded_ids:
        ordained_consecrated = [
            item
            for item in ordained_consecrated
            if (item.get('clergy') or {}).get('id') not in effective_excluded_ids
        ]

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
@require_permission('edit_clergy')
def panel_right():
    """Right panel snippet for HTMX swap."""
    return render_template('editor_v2/snippets/panel_right.html')


@editor_v2_bp.route('/panel/statusbar')
@require_permission('edit_clergy')
def panel_statusbar():
    """Statusbar snippet for HTMX swap."""
    user = User.query.get(session['user_id']) if 'user_id' in session else None

    db_status = {
        'status': 'unknown',
        'response_time_ms': None,
        'clergy_count': None,
        'events_count': None,
        'details': None,
    }

    try:
        start_time = datetime.now()
        db.session.execute(text('SELECT 1'))
        db.session.commit()
        response_time_ms = (datetime.now() - start_time).total_seconds() * 1000

        clergy_count = Clergy.query.filter(Clergy.is_deleted != True).count()  # noqa: E712
        ordination_count = Ordination.query.count()
        consecration_count = Consecration.query.count()
        events_count = ordination_count + consecration_count

        db_status.update(
            {
                'status': 'connected',
                'response_time_ms': response_time_ms,
                'clergy_count': clergy_count,
                'events_count': events_count,
                'details': f'{clergy_count} clergy, {events_count} events',
            }
        )
    except Exception as e:
        current_app.logger.error("Editor v2 statusbar DB check failed: %s", e)
        error_str = str(e).lower()
        if any(k in error_str for k in ('connection', 'timeout', 'refused')):
            db_status['status'] = 'error'
        else:
            db_status['status'] = 'warning'

    env_label = None
    try:
        env = current_app.config.get('FLASK_ENV') or current_app.config.get('ENV')
        if env and env.lower() != 'production':
            env_label = env.title()
    except Exception:
        env_label = None

    return render_template(
        'editor_v2/snippets/statusbar.html',
        user=user,
        db_status=db_status,
        env_label=env_label,
    )


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

    update_descendants = request.values.get('update_descendants') in ('1', 'true', 'on')
    if update_descendants and response and getattr(response, 'get_json', None):
        data = response.get_json(silent=True)
        if isinstance(data, dict) and data.get('success'):
            try:
                from services.validation_cascade import compute_cascade_impact, apply_cascade_changes
                changes = compute_cascade_impact(clergy_id)
                count = apply_cascade_changes(changes)
                data['updated_descendants_count'] = count
            except Exception as e:
                current_app.logger.exception("Cascade apply failed: %s", e)
                data['updated_descendants_count'] = 0
            status = getattr(response, 'status_code', None) or 200
            return jsonify(data), status

    return _normalize_clergy_save_result(clergy, response, status_code)
