from flask import render_template, request, redirect, url_for, flash, session
from models import db, User, Role
from utils import validate_password, generate_breadcrumbs
from datetime import datetime

def signup_handler():
    # Check if there are already users in the database
    user_count = User.query.count()
    if user_count > 0:
        flash('Signup is only available for the first user (admin).', 'error')
        if request.headers.get('HX-Request'):
            return None, render_template('flash_messages.html')
        return None, redirect(url_for('auth.login'))

    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        confirm_password = request.form['confirm_password']

        if not username or not password:
            flash('Username and password are required.', 'error')
            if request.headers.get('HX-Request'):
                return None, render_template('flash_messages.html')
            return None, render_template('signup.html')

        if password != confirm_password:
            flash('Passwords do not match.', 'error')
            if request.headers.get('HX-Request'):
                return None, render_template('flash_messages.html')
            return None, render_template('signup.html')

        if User.query.filter_by(username=username).first():
            flash('Username already exists.', 'error')
            if request.headers.get('HX-Request'):
                return None, render_template('flash_messages.html')
            return None, render_template('signup.html')

        # Validate password strength
        is_valid, message = validate_password(password)
        if not is_valid:
            flash(f'Password validation failed: {message}', 'error')
            if request.headers.get('HX-Request'):
                return None, render_template('flash_messages.html')
            return None, render_template('signup.html')

        # Get or create Super Admin role
        super_admin_role = Role.query.filter_by(name='Super Admin').first()
        if not super_admin_role:
            # Initialize roles if they don't exist
            from routes import initialize_roles_and_permissions
            initialize_roles_and_permissions()
            super_admin_role = Role.query.filter_by(name='Super Admin').first()

        # Create the first user as Super Admin
        user = User(username=username, role_id=super_admin_role.id)
        user.set_password(password)

        db.session.add(user)
        db.session.commit()

        # No direct log_audit_event call here; handled by decorator
        flash('Admin account created successfully! Please log in.', 'success')
        if request.headers.get('HX-Request'):
            # Return a special response for HTMX to handle redirect
            return user, '<div id="redirect" data-url="' + url_for('auth.login') + '">redirect</div><script>setTimeout(function(){window.location.href="' + url_for('auth.login') + '";},1000);</script>'
        return user, redirect(url_for('auth.login'))

    breadcrumbs = generate_breadcrumbs('signup')
    return None, render_template('signup.html', breadcrumbs=breadcrumbs)

def login_handler():
    from models import User, db
    from datetime import datetime
    from flask import request, session, flash, render_template, redirect, url_for
    from utils import generate_breadcrumbs

    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password) and user.is_active:
            session['user_id'] = user.id
            session['username'] = user.username
            session['role'] = user.role.name if user.role else 'Unknown'
            session['is_admin'] = user.is_admin()
            user.last_login = datetime.utcnow()
            db.session.commit()
            flash(f'Welcome back, {username}!', 'success')
            if request.headers.get('HX-Request'):
                return user, render_template('login_spinner.html', redirect_url=url_for('routes.dashboard'))
            return user, redirect(url_for('routes.dashboard'))
        else:
            flash('Invalid username or password.', 'error')
            if request.headers.get('HX-Request'):
                return None, render_template('flash_messages.html')
            return None, render_template('login.html', breadcrumbs=generate_breadcrumbs('login'))
    breadcrumbs = generate_breadcrumbs('login')
    return None, render_template('login.html', breadcrumbs=breadcrumbs)

def logout_handler():
    from models import User
    from flask import session, flash, render_template, redirect, url_for, request
    user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
    session.clear()
    flash('You have been logged out.', 'info')
    if request.headers.get('HX-Request'):
        return user, render_template('login_spinner.html', redirect_url=url_for('routes.lineage_visualization'))
    return user, redirect(url_for('routes.lineage_visualization')) 