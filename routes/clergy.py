from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify
from services import clergy as clergy_service
from services.clergy import soft_delete_clergy_handler
from utils import audit_log, require_permission, generate_breadcrumbs, log_audit_event
from models import Clergy, ClergyComment, db

clergy_bp = Blueprint('clergy', __name__)

@clergy_bp.route('/clergy')
def clergy_list():
    return clergy_service.clergy_list_handler()

@clergy_bp.route('/clergy/add', methods=['GET', 'POST'])
@audit_log(
    action='create',
    entity_type='clergy',
    get_entity_id=lambda clergy: clergy.id if clergy else None,
    get_entity_name=lambda clergy: clergy.name if clergy else None,
    get_details=lambda clergy: {
        'rank': clergy.rank,
        'organization': clergy.organization,
        'date_of_birth': clergy.date_of_birth.isoformat() if clergy.date_of_birth else None,
        'date_of_ordination': clergy.date_of_ordination.isoformat() if clergy.date_of_ordination else None,
        'date_of_consecration': clergy.date_of_consecration.isoformat() if clergy.date_of_consecration else None,
        'date_of_death': clergy.date_of_death.isoformat() if clergy.date_of_death else None
    } if clergy else None
)
@require_permission('add_clergy')
def add_clergy():
    return clergy_service.add_clergy_handler()

@clergy_bp.route('/clergy/<int:clergy_id>')
def view_clergy(clergy_id):
    return clergy_service.view_clergy_handler(clergy_id)

@clergy_bp.route('/clergy/<int:clergy_id>/edit', methods=['GET', 'POST'])
@require_permission('edit_clergy')
def edit_clergy(clergy_id):
    return clergy_service.edit_clergy_handler(clergy_id)

@clergy_bp.route('/clergy/filter_partial')
def clergy_filter_partial():
    return clergy_service.clergy_filter_partial_handler()

@clergy_bp.route('/clergy/<int:clergy_id>/json')
def clergy_json(clergy_id):
    clergy = Clergy.query.get_or_404(clergy_id)
    return jsonify(clergy.to_dict())

@clergy_bp.route('/clergy/<int:clergy_id>/comments')
def clergy_comments(clergy_id):
    clergy = Clergy.query.get_or_404(clergy_id)
    breadcrumbs = generate_breadcrumbs('clergy_comments', clergy.name)
    return render_template('clergy_comments.html', clergy=clergy, breadcrumbs=breadcrumbs)

@clergy_bp.route('/clergy/<int:clergy_id>/add-comment', methods=['POST'])
def add_clergy_comment(clergy_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not authenticated'}), 401

    clergy = Clergy.query.get_or_404(clergy_id)
    comment_text = request.form.get('content', '').strip()
    field_name = request.form.get('field_name', '')
    is_public = request.form.get('is_public', '1') == '1'

    if not comment_text:
        return jsonify({'success': False, 'message': 'Comment cannot be empty'}), 400

    comment = ClergyComment(
        clergy_id=clergy_id,
        author_id=session['user_id'],
        content=comment_text,
        field_name=field_name,
        is_public=is_public
    )

    db.session.add(comment)
    db.session.commit()

    log_audit_event(
        action='add_comment',
        entity_type='clergy_comment',
        entity_id=comment.id,
        entity_name=f"Comment on {clergy.name}",
        details={'clergy_id': clergy_id, 'comment': comment_text}
    )

    return jsonify({
        'success': True,
        'comment': {
            'id': comment.id,
            'content': comment.content,
            'timestamp': comment.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'user': comment.author.username
        }
    })

@clergy_bp.route('/clergy/<int:clergy_id>/resolved-comments')
def view_resolved_comments(clergy_id):
    clergy = Clergy.query.get_or_404(clergy_id)
    resolved_comments = ClergyComment.query.filter_by(
        clergy_id=clergy_id, 
        status='resolved'
    ).order_by(ClergyComment.timestamp.desc()).all()
    
    breadcrumbs = generate_breadcrumbs('resolved_comments', clergy.name)
    return render_template('resolved_comments.html', 
                         clergy=clergy, 
                         comments=resolved_comments,
                         breadcrumbs=breadcrumbs) 

@clergy_bp.route('/clergy/<int:clergy_id>/delete', methods=['POST'])
@require_permission('delete_clergy')
def delete_clergy(clergy_id):
    from utils import log_audit_event
    user = None
    if 'user_id' in session:
        user = session['user_id']
    result = soft_delete_clergy_handler(clergy_id, user)
    if result['success']:
        clergy = Clergy.query.get(clergy_id)
        log_audit_event(
            action='soft_delete',
            entity_type='clergy',
            entity_id=clergy_id,
            entity_name=clergy.name if clergy else None,
            details={'message': result['message']}
        )
    return jsonify(result) 



@clergy_bp.route('/clergy/filtered-bishops')
def get_filtered_bishops():
    return clergy_service.get_filtered_bishops_handler() 