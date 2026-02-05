from flask import Blueprint, redirect, url_for, flash, session

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/users')
def user_management():
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#user-management', code=308)
    flash('Please log in to access user management.', 'error')
    return redirect(url_for('auth.login'), code=308)


@admin_bp.route('/users/add', methods=['GET'])
def add_user():
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#user-management', code=308)
    flash('Please log in to access user management.', 'error')
    return redirect(url_for('auth.login'), code=308)


@admin_bp.route('/users/<int:user_id>/edit', methods=['GET'])
def edit_user(user_id):
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#user-management', code=308)
    flash('Please log in to access user management.', 'error')
    return redirect(url_for('auth.login'), code=308)


@admin_bp.route('/users/<int:user_id>/delete', methods=['GET'])
def delete_user(user_id):
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#user-management', code=308)
    flash('Please log in to access user management.', 'error')
    return redirect(url_for('auth.login'), code=308)


@admin_bp.route('/comments')
def comments_management():
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#comments-management', code=308)
    flash('Please log in to access comments management.', 'error')
    return redirect(url_for('auth.login'), code=308)


@admin_bp.route('/comments/<int:comment_id>/resolve', methods=['GET'])
def resolve_comment(comment_id):
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + '#comments-management', code=308)
    flash('Please log in to access comments management.', 'error')
    return redirect(url_for('auth.login'), code=308)
