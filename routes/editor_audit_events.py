"""Editor audit logs, events, and permanent delete routes."""
from flask import request, render_template, session, jsonify, current_app
from routes.editor_bp import editor_bp
from utils import require_permission, log_audit_event
from services.clergy import permanently_delete_clergy_handler
from models import Clergy, User, db, AuditLog, ClergyEvent


@editor_bp.route('/editor/audit-logs')
@require_permission('view_audit_logs')
def audit_logs_panel():
    """HTMX endpoint for the bottom panel audit logs tab"""
    page = request.args.get('page', 1, type=int)
    per_page = 50

    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return render_template('editor_panels/audit_logs.html', logs=logs)


@editor_bp.route('/editor/audit-logs-check')
@require_permission('view_audit_logs')
def audit_logs_check():
    """API endpoint to check for new audit logs since a given ID"""
    since_id = request.args.get('since', 0, type=int)

    new_logs = AuditLog.query.filter(
        AuditLog.id > since_id
    ).order_by(AuditLog.created_at.desc()).limit(10).all()

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
    from datetime import datetime

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


@editor_bp.route('/editor/permanently-delete-clergy', methods=['POST'])
@require_permission('delete_clergy')
def permanently_delete_clergy():
    """Permanently delete selected clergy records"""
    try:
        data = request.get_json()
        clergy_ids = data.get('clergy_ids', [])

        if not clergy_ids:
            return jsonify({'success': False, 'message': 'No clergy IDs provided'})

        try:
            clergy_ids = [int(id) for id in clergy_ids]
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': 'Invalid clergy ID format'})

        user = User.query.get(session['user_id']) if 'user_id' in session else None

        result = permanently_delete_clergy_handler(clergy_ids, user)

        return jsonify(result)

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error processing request: {str(e)}'})


@editor_bp.route('/editor/audit-logs-management')
@require_permission('view_audit_logs')
def audit_logs_management_modal():
    """HTMX endpoint for audit logs management modal content"""
    from datetime import datetime

    page = request.args.get('page', 1, type=int)
    action_filter = request.args.get('action', '')
    entity_type_filter = request.args.get('entity_type', '')
    user_filter = request.args.get('user', '')
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')

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
