from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from services import auth as auth_service
from utils import audit_log, validate_password, is_safe_redirect_url
from models import AdminInvite, User, db
from datetime import datetime

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        flash('Please log in to access the dashboard.', 'error')
        return redirect(url_for('auth.login'))
    
    from models import User
    user = User.query.get(session['user_id'])
    if not user:
        session.clear()
        flash('User not found. Please log in again.', 'error')
        return redirect(url_for('auth.login'))
    
    # Redirect logged-in users to editor instead of showing dashboard
    return redirect(url_for('editor.editor'))

@auth_bp.route('/signup', methods=['GET', 'POST'])
@audit_log(
    action='create',
    entity_type='user',
    get_entity_id=lambda user: user.id if user else None,
    get_entity_name=lambda user: user.username if user else None,
    get_details=lambda user: {
        'username': user.username,
        'role': user.role.name,
        'is_first_user': True
    } if user else None
)
def signup():
    return auth_service.signup_handler()

@auth_bp.route('/login', methods=['GET', 'POST'])
@audit_log(
    action='login',
    entity_type='user',
    get_entity_id=lambda user: user.id if user else None,
    get_entity_name=lambda user: user.username if user else None,
    get_details=lambda user: {'login_method': 'password'} if user else None
)
def login():
    return auth_service.login_handler()

@auth_bp.route('/logout')
@audit_log(
    action='logout',
    entity_type='user',
    get_entity_id=lambda user: user.id if user else None,
    get_entity_name=lambda user: user.username if user else None,
    get_details=lambda user: None
)
def logout():
    session.clear()
    flash('You have been logged out.', 'info')
    
    # Validate and get safe redirect URL
    next_url = request.args.get('next')
    if next_url and is_safe_redirect_url(next_url):
        safe_redirect = next_url
    else:
        safe_redirect = url_for('main.index')
    
    return redirect(safe_redirect)

@auth_bp.route('/admin_invite_signup/<token>', methods=['GET', 'POST'])
def admin_invite_signup(token):
    # Check if invite is valid
    invite = AdminInvite.query.filter_by(token=token).first()
    if not invite or invite.expires_at < datetime.utcnow() or invite.current_uses >= invite.max_uses:
        flash('Invalid or expired invite link.', 'error')
        return redirect(url_for('auth.login'))
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if password != confirm_password:
            flash('Passwords do not match.', 'error')
            return render_template('signup.html', invite_token=token)
        
        # Validate password strength
        is_valid, message = validate_password(password)
        if not is_valid:
            flash(f'Password validation failed: {message}', 'error')
            return render_template('signup.html', invite_token=token)
        
        # Check if username already exists
        if User.query.filter_by(username=username).first():
            flash('Username already exists.', 'error')
            return render_template('signup.html', invite_token=token)
        
        # Create user
        user = User(username=username, role_id=invite.role_id)
        user.set_password(password)
        db.session.add(user)
        
        # Update invite usage
        invite.current_uses += 1
        db.session.commit()
        
        flash('Account created successfully! You can now log in.', 'success')
        return redirect(url_for('auth.login'))
    
    return render_template('signup.html', invite_token=token) 