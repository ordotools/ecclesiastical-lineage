from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify, make_response
from services import clergy as clergy_service
from services.clergy import soft_delete_clergy_handler
from utils import audit_log, require_permission, log_audit_event
from models import Clergy, ClergyComment, db

clergy_bp = Blueprint('clergy', __name__)

@clergy_bp.route('/clergy')
def clergy_list():
    # Redirect to editor clergy list panel
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#clergy-list')
    else:
        flash('Please log in to access clergy management.', 'error')
        return redirect(url_for('auth.login'))

@clergy_bp.route('/clergy/add', methods=['GET', 'POST'])
def add_clergy():
    if 'user_id' not in session:
        flash('Please log in to access clergy management.', 'error')
        return redirect(url_for('auth.login'))
    
    if request.method == 'POST':
        # Handle form submission
        try:
            print(f"Processing clergy form submission with data: {dict(request.form)}")
            clergy, response = clergy_service.add_clergy_handler()
            print(f"Clergy created successfully: {clergy.name} (ID: {clergy.id})")
            return response
        except Exception as e:
            print(f"Error in clergy form submission: {e}")
            import traceback
            traceback.print_exc()
            
            # Check if this is an HTMX request
            is_htmx = request.headers.get('HX-Request') == 'true'
            if is_htmx:
                response = make_response(f'<div class="alert alert-danger">Error: {str(e)}</div>')
                return response, 400
            
            # Handle regular AJAX requests
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
                return jsonify({'success': False, 'message': str(e)}), 400
            
            flash(f'Error adding clergy record: {str(e)}', 'error')
            return redirect(url_for('editor.editor') + '#clergy-form')
    else:
        # GET request - redirect to editor clergy form panel
        return redirect(url_for('editor.editor') + '#clergy-form')

@clergy_bp.route('/clergy/<int:clergy_id>')
def view_clergy(clergy_id):
    # Redirect to editor clergy form panel with specific clergy
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + f'#clergy-form/{clergy_id}')
    else:
        flash('Please log in to access clergy management.', 'error')
        return redirect(url_for('auth.login'))

@clergy_bp.route('/clergy/<int:clergy_id>/edit', methods=['GET', 'POST'])
def edit_clergy(clergy_id):
    if 'user_id' not in session:
        flash('Please log in to access clergy management.', 'error')
        return redirect(url_for('auth.login'))
    
    if request.method == 'POST':
        # Handle form submission
        try:
            response = clergy_service.edit_clergy_handler(clergy_id)
            return response
        except Exception as e:
            # Check if this is an HTMX request
            is_htmx = request.headers.get('HX-Request') == 'true'
            if is_htmx:
                response = make_response(f'<div class="alert alert-danger">Error: {str(e)}</div>')
                return response, 400
            
            # Handle regular AJAX requests
            is_ajax = (
                request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
                request.headers.get('Content-Type', '').startswith('multipart/form-data') or
                request.headers.get('Content-Type', '') == 'application/x-www-form-urlencoded'
            )
            if is_ajax:
                return jsonify({'success': False, 'message': str(e)}), 400
            
            flash(f'Error updating clergy record: {str(e)}', 'error')
            return redirect(url_for('editor.editor') + f'#clergy-form/{clergy_id}')
    else:
        # GET request - redirect to editor clergy form panel with specific clergy
        return redirect(url_for('editor.editor') + f'#clergy-form/{clergy_id}')

@clergy_bp.route('/clergy/filter_partial')
def clergy_filter_partial():
    return clergy_service.clergy_filter_partial_handler()

@clergy_bp.route('/clergy/<int:clergy_id>/json')
def clergy_json(clergy_id):
    clergy = Clergy.query.get_or_404(clergy_id)
    return jsonify(clergy.to_dict())

@clergy_bp.route('/api/search_bishops')
def search_bishops():
    """API endpoint to search for bishops for autocomplete"""
    query = request.args.get('q', '').strip()
    
    if len(query) < 2:
        return '<div class="dropdown-item text-muted">Type at least 2 characters to search</div>'
    
    # Search for bishops and priests (they can be co-consecrators)
    bishops = Clergy.query.filter(
        Clergy.name.ilike(f'%{query}%'),
        Clergy.is_deleted == False,
        Clergy.rank.in_(['Bishop', 'Archbishop', 'Cardinal', 'Pope', 'Priest'])
    ).limit(10).all()
    
    if not bishops:
        return '<div class="dropdown-item text-muted">No bishops found</div>'
    
    html = ''
    for bishop in bishops:
        display_name = getattr(bishop, 'display_name', bishop.name)
        html += f'''
        <div class="dropdown-item bishop-search-result" 
             data-id="{bishop.id}" 
             data-name="{bishop.name}"
             data-display-name="{display_name}"
             style="cursor: pointer;">
            <strong>{display_name}</strong>
            <br>
            <small class="text-muted">{bishop.rank}</small>
        </div>
        '''
    
    return html

@clergy_bp.route('/clergy/<int:clergy_id>/comments')
def clergy_comments(clergy_id):
    clergy = Clergy.query.get_or_404(clergy_id)
    return render_template('clergy_comments.html', clergy=clergy)

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
    
    return render_template('resolved_comments.html', 
                         clergy=clergy, 
                         comments=resolved_comments) 

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