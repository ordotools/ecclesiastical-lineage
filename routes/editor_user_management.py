"""Editor user management modal and CRUD routes."""
from flask import request, render_template, session, jsonify
from routes.editor_bp import editor_bp
from utils import require_permission, log_audit_event
from models import User, Role, db


@editor_bp.route('/editor/user-management')
@require_permission('manage_users')
def user_management_modal():
    """HTMX endpoint for user management modal content"""
    user = User.query.get(session['user_id']) if 'user_id' in session else None
    users = User.query.order_by(User.username).all()
    roles = Role.query.order_by(Role.name).all()

    return render_template('editor_panels/user_management.html',
                         user=user,
                         users=users,
                         roles=roles)


@editor_bp.route('/editor/user-management/add', methods=['POST'])
@require_permission('manage_users')
def add_user():
    """Add a new user"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        full_name = data.get('full_name', '').strip()
        password = data.get('password', '').strip()
        role_id = data.get('role_id')
        is_active = data.get('is_active', True)

        if not username:
            return jsonify({'success': False, 'message': 'Username is required'}), 400

        if not password:
            return jsonify({'success': False, 'message': 'Password is required'}), 400

        if not role_id:
            return jsonify({'success': False, 'message': 'Role is required'}), 400

        if User.query.filter_by(username=username).first():
            return jsonify({'success': False, 'message': 'Username already exists'}), 400

        if email and User.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'Email already exists'}), 400

        role = Role.query.get(role_id)
        if not role:
            return jsonify({'success': False, 'message': 'Invalid role'}), 400

        new_user = User(
            username=username,
            email=email if email else None,
            full_name=full_name if full_name else None,
            is_active=is_active
        )
        new_user.set_password(password)
        new_user.role_id = role_id

        db.session.add(new_user)
        db.session.commit()

        log_audit_event(
            user_id=session['user_id'],
            action='create',
            entity_type='user',
            entity_id=new_user.id,
            entity_name=new_user.username,
            details=f'Created user with role: {role.name}'
        )

        return jsonify({
            'success': True,
            'message': f'User "{username}" created successfully',
            'user_id': new_user.id
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Error creating user: {str(e)}'}), 500


@editor_bp.route('/editor/user-management/<int:user_id>/edit', methods=['PUT'])
@require_permission('manage_users')
def edit_user(user_id):
    """Edit an existing user"""
    try:
        data = request.get_json()
        user = User.query.get_or_404(user_id)

        if user.id == session['user_id']:
            return jsonify({'success': False, 'message': 'Cannot edit your own account through this interface'}), 400

        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        full_name = data.get('full_name', '').strip()
        password = data.get('password', '').strip()
        role_id = data.get('role_id')
        is_active = data.get('is_active', True)

        if not username:
            return jsonify({'success': False, 'message': 'Username is required'}), 400

        if not role_id:
            return jsonify({'success': False, 'message': 'Role is required'}), 400

        existing_user = User.query.filter_by(username=username).first()
        if existing_user and existing_user.id != user_id:
            return jsonify({'success': False, 'message': 'Username already exists'}), 400

        if email:
            existing_email = User.query.filter_by(email=email).first()
            if existing_email and existing_email.id != user_id:
                return jsonify({'success': False, 'message': 'Email already exists'}), 400

        role = Role.query.get(role_id)
        if not role:
            return jsonify({'success': False, 'message': 'Invalid role'}), 400

        old_username = user.username
        user.username = username
        user.email = email if email else None
        user.full_name = full_name if full_name else None
        user.is_active = is_active
        user.role_id = role_id

        if password:
            user.set_password(password)

        db.session.commit()

        log_audit_event(
            user_id=session['user_id'],
            action='update',
            entity_type='user',
            entity_id=user.id,
            entity_name=user.username,
            details=f'Updated user from "{old_username}" to "{username}" with role: {role.name}'
        )

        return jsonify({
            'success': True,
            'message': f'User "{username}" updated successfully'
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Error updating user: {str(e)}'}), 500


@editor_bp.route('/editor/user-management/<int:user_id>')
@require_permission('manage_users')
def get_user(user_id):
    """Get user data for editing"""
    try:
        user = User.query.get_or_404(user_id)

        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name,
                'role_id': user.role_id,
                'is_active': user.is_active
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error loading user: {str(e)}'}), 500


@editor_bp.route('/editor/user-management/<int:user_id>/delete', methods=['DELETE'])
@require_permission('manage_users')
def delete_user(user_id):
    """Delete a user"""
    try:
        user = User.query.get_or_404(user_id)

        if user.id == session['user_id']:
            return jsonify({'success': False, 'message': 'Cannot delete your own account'}), 400

        if user.role and user.role.name == 'Super Admin':
            super_admin_count = User.query.join(Role).filter(Role.name == 'Super Admin').count()
            if super_admin_count <= 1:
                return jsonify({'success': False, 'message': 'Cannot delete the last Super Admin'}), 400

        username = user.username
        user_id_for_log = user.id

        db.session.delete(user)
        db.session.commit()

        log_audit_event(
            user_id=session['user_id'],
            action='delete',
            entity_type='user',
            entity_id=user_id_for_log,
            entity_name=username,
            details=f'Deleted user "{username}"'
        )

        return jsonify({
            'success': True,
            'message': f'User "{username}" deleted successfully'
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'Error deleting user: {str(e)}'}), 500
