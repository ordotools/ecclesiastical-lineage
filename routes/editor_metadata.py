"""Editor metadata, comments, statistics panels and rank/organization CRUD."""
from flask import request, render_template, session, jsonify, current_app
from routes.editor_bp import editor_bp
from utils import require_permission, log_audit_event
from models import (
    Clergy, ClergyComment, User, db, Organization, Rank,
    Ordination, Consecration, AuditLog
)
from datetime import datetime
from sqlalchemy import text


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

    comments = ClergyComment.query.order_by(ClergyComment.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return render_template('editor_panels/comments.html', comments=comments)


@editor_bp.route('/editor/statistics')
@require_permission('edit_clergy')
def statistics_panel():
    """HTMX endpoint for the bottom panel statistics tab"""
    total_clergy = Clergy.query.filter(Clergy.is_deleted != True).count()
    total_bishops = Clergy.query.filter(
        Clergy.is_deleted != True,
        Clergy.rank.in_(['Bishop', 'Archbishop', 'Cardinal', 'Pope'])
    ).count()
    total_priests = Clergy.query.filter(
        Clergy.is_deleted != True,
        Clergy.rank == 'Priest'
    ).count()

    org_stats = db.session.query(
        Clergy.organization,
        db.func.count(Clergy.id).label('count')
    ).filter(
        Clergy.is_deleted != True,
        Clergy.organization.isnot(None)
    ).group_by(Clergy.organization).order_by(db.desc('count')).all()

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


@editor_bp.route('/editor/metadata/rank/add', methods=['POST'])
def add_rank():
    """HTMX endpoint for adding a new rank"""
    from services.metadata import add_rank_service

    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to manage metadata.'})

    user = User.query.get(session['user_id'])
    if not user or not user.is_active:
        return jsonify({'success': False, 'message': 'User not found or inactive.'})

    if not user.has_permission('manage_metadata'):
        return jsonify({'success': False, 'message': 'You do not have permission to manage metadata.'})

    data = request.get_json() or request.form.to_dict()

    if 'is_bishop' in data:
        data['is_bishop'] = data['is_bishop'] in ['true', 'on', '1', True]

    result = add_rank_service(data, user)

    if result['success']:
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

    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to manage metadata.'})

    user = User.query.get(session['user_id'])
    if not user or not user.is_active:
        return jsonify({'success': False, 'message': 'User not found or inactive.'})

    if not user.has_permission('manage_metadata'):
        return jsonify({'success': False, 'message': 'You do not have permission to manage metadata.'})

    data = request.get_json() or request.form.to_dict()

    if 'is_bishop' in data:
        data['is_bishop'] = data['is_bishop'] in ['true', 'on', '1', True]

    result = edit_rank_service(rank_id, data, user)

    if result['success']:
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

    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to manage metadata.'})

    user = User.query.get(session['user_id'])
    if not user or not user.is_active:
        return jsonify({'success': False, 'message': 'User not found or inactive.'})

    if not user.has_permission('manage_metadata'):
        return jsonify({'success': False, 'message': 'You do not have permission to manage metadata.'})

    rank = Rank.query.get(rank_id)
    rank_name = rank.name if rank else f"ID {rank_id}"

    result = delete_rank_service(rank_id, user)

    if result['success']:
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
        log_audit_event(
            user_id=session['user_id'],
            action='update',
            entity_type='organization',
            entity_id=org_id,
            entity_name=result['organization']['name'],
            details=f'Updated organization to "{result["organization"]["name"]}"'
        )

    return jsonify(result)


@editor_bp.route('/editor/metadata/organization/<int:org_id>/delete', methods=['DELETE', 'POST'])
def delete_organization(org_id):
    """HTMX endpoint for deleting an organization"""
    from services.metadata import delete_organization_service

    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to manage metadata.'})

    user = User.query.get(session['user_id'])
    if not user or not user.is_active:
        return jsonify({'success': False, 'message': 'User not found or inactive.'})

    if not user.has_permission('manage_metadata'):
        return jsonify({'success': False, 'message': 'You do not have permission to manage metadata.'})

    org = Organization.query.get(org_id)
    org_name = org.name if org else f"ID {org_id}"

    result = delete_organization_service(org_id, user)

    if result['success']:
        log_audit_event(
            user_id=session['user_id'],
            action='delete',
            entity_type='organization',
            entity_id=org_id,
            entity_name=org_name,
            details=f'Deleted organization "{org_name}"'
        )

    return jsonify(result)


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
        start_time = datetime.now()
        db.session.execute(text('SELECT 1'))
        db.session.commit()
        response_time = (datetime.now() - start_time).total_seconds() * 1000

        clergy_count = Clergy.query.count()
        ordination_count = Ordination.query.count()
        consecration_count = Consecration.query.count()

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
