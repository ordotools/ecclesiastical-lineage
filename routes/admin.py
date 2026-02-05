from flask import Blueprint, redirect, url_for, flash, session

admin_bp = Blueprint('admin', __name__)


def _redirect_to_editor_or_login(anchor, feature_name):
    if 'user_id' in session:
        return redirect(url_for('editor.editor') + anchor, code=308)
    flash(f'Please log in to access {feature_name}.', 'error')
    return redirect(url_for('auth.login'), code=308)


@admin_bp.route('/users')
def user_management():
    return _redirect_to_editor_or_login('#user-management', 'user management')


@admin_bp.route('/users/add', methods=['GET'])
def add_user():
    return _redirect_to_editor_or_login('#user-management', 'user management')


@admin_bp.route('/users/<int:user_id>/edit', methods=['GET'])
def edit_user(user_id):
    return _redirect_to_editor_or_login('#user-management', 'user management')


@admin_bp.route('/users/<int:user_id>/delete', methods=['GET'])
def delete_user(user_id):
    return _redirect_to_editor_or_login('#user-management', 'user management')


@admin_bp.route('/comments')
def comments_management():
    return _redirect_to_editor_or_login('#comments-management', 'comments management')


@admin_bp.route('/comments/<int:comment_id>/resolve', methods=['GET'])
def resolve_comment(comment_id):
    return _redirect_to_editor_or_login('#comments-management', 'comments management')
