"""Editor settings panel and password/invite routes."""
from flask import request, render_template, session, jsonify, url_for
from routes.editor_bp import editor_bp
from utils import require_permission, log_audit_event, validate_password
from models import User, Role, db, AdminInvite
from datetime import datetime, timedelta
from uuid import uuid4


@editor_bp.route('/editor/settings')
@require_permission('edit_clergy')
def settings_panel():
    """HTMX endpoint for the settings panel"""
    user = User.query.get(session['user_id']) if 'user_id' in session else None

    all_roles = Role.query.order_by(Role.name).all()
    available_roles = []

    for role in all_roles:
        if user.is_admin():
            available_roles.append(role)
        elif user.role and user.role.name == 'Admin':
            if role.name != 'Super Admin':
                available_roles.append(role)
        else:
            break

    return render_template('editor_panels/settings.html',
                         user=user,
                         roles=available_roles)


@editor_bp.route('/editor/settings/change-password', methods=['POST'])
@require_permission('edit_clergy')
def change_password():
    """HTMX endpoint for changing password from settings panel"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'You must be logged in to change your password.'})

    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'success': False, 'message': 'User not found.'})

    current_password = request.form.get('current_password')
    new_password = request.form.get('new_password')
    confirm_password = request.form.get('confirm_password')

    if not user.check_password(current_password):
        return jsonify({'success': False, 'message': 'Current password is incorrect.'})

    if new_password != confirm_password:
        return jsonify({'success': False, 'message': 'New password and confirmation do not match.'})

    is_valid, message = validate_password(new_password)
    if not is_valid:
        return jsonify({'success': False, 'message': f'Password validation failed: {message}'})

    user.set_password(new_password)
    db.session.commit()

    log_audit_event(
        action='change_password',
        entity_type='user',
        entity_id=user.id,
        entity_name=user.username,
        details={'password_changed': True}
    )

    return jsonify({'success': True, 'message': 'Password changed successfully!'})


@editor_bp.route('/editor/settings/invite', methods=['POST'])
@require_permission('manage_users')
def generate_admin_invite():
    """HTMX endpoint for generating admin invite from settings panel"""
    if 'user_id' not in session or not session.get('is_admin'):
        return jsonify({'success': False, 'message': 'Admin access required.'})

    user = User.query.get(session['user_id'])

    role_id = request.form.get('role_id')
    expires_in_hours = int(request.form.get('expires_in_hours', 24))
    max_uses = int(request.form.get('max_uses', 1))

    if not role_id:
        return jsonify({'success': False, 'message': 'Please select a role for the invited user.'})

    role = Role.query.get(role_id)
    if not role:
        return jsonify({'success': False, 'message': 'Selected role does not exist.'})

    if not user.is_admin():
        if role.name == 'Super Admin':
            return jsonify({'success': False, 'message': 'You do not have permission to invite Super Admin users.'})

    if role.name in ['Super Admin', 'Admin']:
        expires_in_hours = 24
        max_uses = 1
    else:
        if expires_in_hours < 1 or expires_in_hours > 168:
            return jsonify({'success': False, 'message': 'Expiration time must be between 1 and 168 hours.'})

        if max_uses < 1 or max_uses > 100:
            return jsonify({'success': False, 'message': 'Maximum uses must be between 1 and 100.'})

    token = str(uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)

    invite = AdminInvite(
        token=token,
        expires_at=expires_at,
        invited_by=session['user_id'],
        role_id=role_id,
        expires_in_hours=expires_in_hours,
        max_uses=max_uses,
        current_uses=0
    )

    db.session.add(invite)
    db.session.commit()

    log_audit_event(
        action='generate_invite',
        entity_type='admin_invite',
        entity_id=invite.id,
        entity_name=f"User invite for {token[:8]}...",
        details={
            'token': token,
            'expires_at': expires_at.isoformat(),
            'invited_by': session['user_id'],
            'role_id': role_id,
            'role_name': role.name,
            'expires_in_hours': expires_in_hours,
            'max_uses': max_uses
        }
    )

    invite_link = url_for('auth.admin_invite_signup', token=token, _external=True)

    return jsonify({
        'success': True,
        'message': f'Invite link generated successfully for {role.name} role.',
        'invite_link': invite_link
    })
