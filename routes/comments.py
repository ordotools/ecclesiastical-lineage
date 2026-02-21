"""Comment API: resolve and other JSON endpoints used by clergy comment UI."""
from flask import Blueprint, jsonify, session
from utils import require_permission_api, log_audit_event
from models import ClergyComment, db

comments_bp = Blueprint('comments', __name__, url_prefix='/comments')


@comments_bp.route('/<int:comment_id>/resolve', methods=['POST'])
@require_permission_api('resolve_comments')
def resolve_comment(comment_id):
    comment = ClergyComment.query.get_or_404(comment_id)
    if comment.is_resolved:
        return jsonify({'success': True, 'message': 'Already resolved'})

    comment.is_resolved = True
    db.session.commit()

    log_audit_event(
        user_id=session['user_id'],
        action='resolve_comment',
        entity_type='clergy_comment',
        entity_id=comment.id,
        entity_name=f"Comment on clergy {comment.clergy_id}",
        details={'clergy_id': comment.clergy_id}
    )

    return jsonify({'success': True})
