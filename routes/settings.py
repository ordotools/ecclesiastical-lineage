from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify
from models import db, User, Role, AdminInvite, AuditLog, ClergyComment, Clergy, Rank, Organization
from utils import generate_breadcrumbs, log_audit_event, validate_password
from datetime import datetime, timedelta
from uuid import uuid4

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/settings')
def settings():
    if 'user_id' not in session or not session.get('is_admin'):
        flash('Admin access required.', 'error')
        return redirect(url_for('auth.login'))
    user = User.query.get(session['user_id'])
    
    # Filter roles based on user permissions
    all_roles = Role.query.order_by(Role.name).all()
    available_roles = []
    
    for role in all_roles:
        # Super Admin can invite anyone
        if user.is_admin():
            available_roles.append(role)
        # Admin can invite anyone except Super Admin
        elif user.role and user.role.name == 'Admin':
            if role.name != 'Super Admin':
                available_roles.append(role)
        # Regular users cannot invite anyone
        else:
            break
    
    breadcrumbs = generate_breadcrumbs('settings')
    return render_template('settings.html', user=user, roles=available_roles, breadcrumbs=breadcrumbs)

@settings_bp.route('/settings/invite', methods=['POST'])
def generate_admin_invite():
    if 'user_id' not in session or not session.get('is_admin'):
        flash('Admin access required.', 'error')
        return redirect(url_for('auth.login'))
    
    user = User.query.get(session['user_id'])
    
    # Get form parameters
    role_id = request.form.get('role_id')
    expires_in_hours = int(request.form.get('expires_in_hours', 24))
    max_uses = int(request.form.get('max_uses', 1))
    
    if not role_id:
        flash('Please select a role for the invited user.', 'error')
        return redirect(url_for('settings.settings'))
    
    # Validate the role exists
    role = Role.query.get(role_id)
    if not role:
        flash('Selected role does not exist.', 'error')
        return redirect(url_for('settings.settings'))
    
    # Check permissions based on user role
    if not user.is_admin():
        # Admin can only invite non-Super Admin roles
        if role.name == 'Super Admin':
            flash('You do not have permission to invite Super Admin users.', 'error')
            return redirect(url_for('settings.settings'))
    
    # Enforce restrictions for admin roles
    if role.name in ['Super Admin', 'Admin']:
        expires_in_hours = 24  # Fixed 24 hours for admin roles
        max_uses = 1  # Fixed 1 use for admin roles
    else:
        # Validate parameters for regular roles
        if expires_in_hours < 1 or expires_in_hours > 168:  # 1 hour to 1 week
            flash('Expiration time must be between 1 and 168 hours.', 'error')
            return redirect(url_for('settings.settings'))
        
        if max_uses < 1 or max_uses > 100:  # 1 to 100 uses
            flash('Maximum uses must be between 1 and 100.', 'error')
            return redirect(url_for('settings.settings'))
    
    # Generate unique token and expiry
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
    
    # Log admin invite generation
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
    
    invite_link = url_for('settings.admin_invite_signup', token=token, _external=True)
    
    # Filter roles for display
    all_roles = Role.query.order_by(Role.name).all()
    available_roles = []
    
    for r in all_roles:
        if user.is_admin():
            available_roles.append(r)
        elif user.role and user.role.name == 'Admin':
            if r.name != 'Super Admin':
                available_roles.append(r)
    
    breadcrumbs = generate_breadcrumbs('settings')
    return render_template('settings.html', user=user, roles=available_roles, invite_link=invite_link, breadcrumbs=breadcrumbs)

@settings_bp.route('/settings/change-password', methods=['POST'])
def change_password():
    if 'user_id' not in session:
        flash('You must be logged in to change your password.', 'error')
        return redirect(url_for('auth.login'))
    
    user = User.query.get(session['user_id'])
    if not user:
        flash('User not found.', 'error')
        return redirect(url_for('auth.login'))
    
    current_password = request.form.get('current_password')
    new_password = request.form.get('new_password')
    confirm_password = request.form.get('confirm_password')
    
    # Validate current password
    if not user.check_password(current_password):
        flash('Current password is incorrect.', 'error')
        return redirect(url_for('settings.settings'))
    
    # Check if new password and confirmation match
    if new_password != confirm_password:
        flash('New password and confirmation do not match.', 'error')
        return redirect(url_for('settings.settings'))
    
    # Validate new password strength
    is_valid, message = validate_password(new_password)
    if not is_valid:
        flash(f'Password validation failed: {message}', 'error')
        return redirect(url_for('settings.settings'))
    
    # Update password
    user.set_password(new_password)
    db.session.commit()
    
    # Log password change
    log_audit_event(
        action='change_password',
        entity_type='user',
        entity_id=user.id,
        entity_name=user.username,
        details={'password_changed': True}
    )
    
    flash('Password changed successfully!', 'success')
    return redirect(url_for('settings.settings')) 

@settings_bp.route('/metadata')
def metadata():
    if 'user_id' not in session or not session.get('is_admin'):
        flash('Admin access required.', 'error')
        return redirect(url_for('auth.login'))
    user = User.query.get(session['user_id'])
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    clergy_ranks = db.session.query(Clergy.rank).distinct().filter(Clergy.rank.isnot(None)).all()
    clergy_organizations = db.session.query(Clergy.organization).distinct().filter(Clergy.organization.isnot(None)).all()
    clergy_rank_list = [rank[0] for rank in clergy_ranks]
    clergy_organization_list = [org[0] for org in clergy_organizations]
    breadcrumbs = generate_breadcrumbs('metadata')
    return render_template('metadata.html', user=user, ranks=ranks, organizations=organizations, clergy_ranks=clergy_rank_list, clergy_organizations=clergy_organization_list, breadcrumbs=breadcrumbs) 

@settings_bp.route('/metadata/rank/add', methods=['POST'])
def add_rank():
    if 'user_id' not in session or not session.get('is_admin'):
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    data = request.get_json()
    rank_name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    color = data.get('color', '#000000').strip() or '#000000'
    is_bishop = data.get('is_bishop', False)
    if not rank_name:
        return jsonify({'success': False, 'message': 'Rank name is required'}), 400
    existing_rank = Rank.query.filter_by(name=rank_name).first()
    if existing_rank:
        return jsonify({'success': False, 'message': 'Rank already exists'}), 400
    try:
        new_rank = Rank(name=rank_name, description=description, color=color, is_bishop=is_bishop)
        db.session.add(new_rank)
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'Rank "{rank_name}" added successfully',
            'rank': {
                'id': new_rank.id,
                'name': new_rank.name,
                'description': new_rank.description,
                'color': new_rank.color,
                'is_bishop': new_rank.is_bishop
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error adding rank'}), 500

@settings_bp.route('/user_management')
def user_management():
    if 'user_id' not in session or not session.get('is_admin'):
        flash('Admin access required.', 'error')
        return redirect(url_for('auth.login'))
    user = User.query.get(session['user_id'])
    breadcrumbs = generate_breadcrumbs('user_management')
    return render_template('user_management.html', user=user, breadcrumbs=breadcrumbs)

@settings_bp.route('/comments_management')
def comments_management():
    if 'user_id' not in session or not session.get('is_admin'):
        flash('Admin access required.', 'error')
        return redirect(url_for('auth.login'))
    user = User.query.get(session['user_id'])
    comments = ClergyComment.query.order_by(ClergyComment.created_at.desc()).all()
    breadcrumbs = generate_breadcrumbs('comments_management')
    return render_template('comments_management.html', user=user, comments=comments, breadcrumbs=breadcrumbs)

@settings_bp.route('/audit_logs')
def audit_logs():
    if 'user_id' not in session or not session.get('is_admin'):
        flash('Admin access required.', 'error')
        return redirect(url_for('auth.login'))
    
    user = User.query.get(session['user_id'])
    page = request.args.get('page', 1, type=int)
    action_filter = request.args.get('action', '')
    entity_type_filter = request.args.get('entity_type', '')
    user_filter = request.args.get('user', '')
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')
    
    # Build query
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
    
    breadcrumbs = generate_breadcrumbs('audit_logs')
    return render_template('audit_logs.html', 
                         audit_logs=audit_logs,
                         user=user,
                         breadcrumbs=breadcrumbs,
                         action_filter=action_filter,
                         entity_type_filter=entity_type_filter,
                         user_filter=user_filter,
                         date_from=date_from,
                         date_to=date_to) 