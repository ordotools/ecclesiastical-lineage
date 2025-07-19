from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, render_template_string
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
import json
import re
from uuid import uuid4
from dotenv import load_dotenv
from functools import wraps

# Import psycopg3 for PostgreSQL connections
try:
    import psycopg
except ImportError:
    print("Warning: psycopg3 not found. Install with: pip install psycopg[binary]")

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')

# Get database URL - PostgreSQL is required
database_url = os.environ.get('DATABASE_URL')
if not database_url:
    raise ValueError("DATABASE_URL environment variable is required. Set it to your PostgreSQL connection string.")

# Debug: Print database URL (without sensitive info)
if database_url and 'postgresql' in database_url:
    # Mask the password in the URL for logging
    if '@' in database_url:
        parts = database_url.split('@')
        if ':' in parts[0]:
            user_pass = parts[0].split(':')
            if len(user_pass) >= 3:  # postgresql://user:pass@host
                masked_url = f"{user_pass[0]}:{user_pass[1]}:***@{parts[1]}"
                print(f"🔍 Database URL: {masked_url}")
    else:
        print(f"🔍 Database URL: {database_url}")

# Parse and validate the database URL
try:
    from urllib.parse import urlparse
    parsed_url = urlparse(database_url)
    print(f"🔍 Parsed URL - Scheme: {parsed_url.scheme}, Host: {parsed_url.hostname}, Port: {parsed_url.port}, Database: {parsed_url.path[1:]}")
except Exception as e:
    print(f"❌ URL parsing error: {e}")

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Handle database URL for Render and ensure psycopg3 compatibility
if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace('postgres://', 'postgresql://', 1)

# Configure SQLAlchemy for PostgreSQL connections
if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgresql://'):
    # Force SQLAlchemy to use psycopg3 by updating the URL
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace('postgresql://', 'postgresql+psycopg://', 1)
    
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'connect_args': {
            'connect_timeout': 10
        }
    }
    
    # Debug: Print the final database URI (masked)
    final_uri = app.config['SQLALCHEMY_DATABASE_URI']
    if '@' in final_uri:
        parts = final_uri.split('@')
        if ':' in parts[0]:
            user_pass = parts[0].split(':')
            if len(user_pass) >= 3:
                masked_final_uri = f"{user_pass[0]}:{user_pass[1]}:***@{parts[1]}"
                print(f"🔧 Final Database URI: {masked_final_uri}")
    else:
        print(f"🔧 Final Database URI: {final_uri}")

db = SQLAlchemy(app)

# Test database connection on startup
def test_database_connection():
    try:
        with app.app_context():
            # Try to connect to the database
            db.engine.connect()
            print("✅ Database connection test successful")
        return True
    except Exception as e:
        print(f"❌ Database connection test failed: {e}")
        print(f"🔍 Engine URL: {db.engine.url}")
        return False

# Test the connection when the app starts
if __name__ == '__main__':
    test_database_connection()

# Color contrast utility function for Jinja2 templates
def getContrastColor(hexColor):
    """Calculate the appropriate text color (black or white) for a given background color."""
    if not hexColor or not hexColor.startswith('#'):
        return 'black'
    
    # Convert hex to RGB
    hex = hexColor.replace('#', '')
    if len(hex) != 6:
        return 'black'
    
    try:
        r = int(hex[0:2], 16)
        g = int(hex[2:4], 16)
        b = int(hex[4:6], 16)
        
        # Calculate relative luminance (WCAG 2.1 formula)
        luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        
        # Return white for dark backgrounds, black for light backgrounds
        return 'white' if luminance <= 0.5 else 'black'
    except (ValueError, IndexError):
        return 'black'

def getBorderStyle(hexColor):
    """Get border style for very light colors to ensure visibility. Always returns a string that is either empty or starts with a semicolon."""
    if not hexColor or not hexColor.startswith('#'):
        return ''
    hex = hexColor.replace('#', '')
    if len(hex) != 6:
        return ''
    try:
        r = int(hex[0:2], 16)
        g = int(hex[2:4], 16)
        b = int(hex[4:6], 16)
        luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        if luminance > 0.8:
            return '; border: 1px solid #ccc'
        return ''
    except (ValueError, IndexError):
        return ''

# Make the functions available to Jinja2 templates
app.jinja_env.globals['getContrastColor'] = getContrastColor
app.jinja_env.globals['getBorderStyle'] = getBorderStyle

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    full_name = db.Column(db.String(200), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # Role relationship
    role_id = db.Column(db.Integer, db.ForeignKey('role.id'), nullable=False)
    role = db.relationship('Role', backref='users')
    
    # Comments relationship
    comments = db.relationship('ClergyComment', backref='author', lazy='dynamic', cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def has_permission(self, permission):
        """Check if user has a specific permission"""
        return self.role and self.role.has_permission(permission)
    
    def can_edit_clergy(self):
        """Check if user can edit clergy records"""
        return self.has_permission('edit_clergy')
    
    def can_delete_clergy(self):
        """Check if user can delete clergy records"""
        return self.has_permission('delete_clergy')
    
    def can_manage_metadata(self):
        """Check if user can manage metadata"""
        return self.has_permission('manage_metadata')
    
    def can_manage_users(self):
        """Check if user can manage users"""
        return self.has_permission('manage_users')
    
    def can_comment(self):
        """Check if user can add comments"""
        return self.has_permission('add_comments')
    
    def is_admin(self):
        """Backward compatibility - check if user is super admin"""
        return self.role and self.role.name == 'Super Admin'

class Role(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Permissions relationship
    permissions = db.relationship('Permission', secondary='role_permissions', backref='roles')
    
    def has_permission(self, permission_name):
        """Check if role has a specific permission"""
        return any(p.name == permission_name for p in self.permissions)
    
    def __repr__(self):
        return f'<Role {self.name}>'

class Permission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Permission {self.name}>'

# Association table for role-permission relationship
role_permissions = db.Table('role_permissions',
    db.Column('role_id', db.Integer, db.ForeignKey('role.id'), primary_key=True),
    db.Column('permission_id', db.Integer, db.ForeignKey('permission.id'), primary_key=True)
)

class ClergyComment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    clergy_id = db.Column(db.Integer, db.ForeignKey('clergy.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_public = db.Column(db.Boolean, default=True)
    is_resolved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to clergy
    clergy = db.relationship('Clergy', backref='comments')
    
    def __repr__(self):
        return f'<ClergyComment {self.id} on Clergy {self.clergy_id}>'

def validate_password(password):
    """
    Validate password strength requirements:
    - At least 8 characters long
    - Contains at least one uppercase letter
    - Contains at least one lowercase letter
    - Contains at least one digit
    - Contains at least one special character
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)"
    
    return True, "Password meets all requirements"

class Clergy(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    rank = db.Column(db.String(100), nullable=False)
    organization = db.Column(db.String(200))
    date_of_birth = db.Column(db.Date)
    date_of_ordination = db.Column(db.Date)
    ordaining_bishop_id = db.Column(db.Integer, db.ForeignKey('clergy.id'))
    date_of_consecration = db.Column(db.Date)
    consecrator_id = db.Column(db.Integer, db.ForeignKey('clergy.id'))
    co_consecrators = db.Column(db.Text)  # JSON array of clergy IDs
    date_of_death = db.Column(db.Date)
    notes = db.Column(db.Text)
    
    # Relationships
    ordaining_bishop = db.relationship('Clergy', foreign_keys=[ordaining_bishop_id], remote_side=[id])
    consecrator = db.relationship('Clergy', foreign_keys=[consecrator_id], remote_side=[id])
    
    def set_co_consecrators(self, co_consecrator_ids):
        """Set co-consecrators as a JSON array"""
        if co_consecrator_ids:
            self.co_consecrators = json.dumps(co_consecrator_ids)
        else:
            self.co_consecrators = None
    
    def get_co_consecrators(self):
        """Get co-consecrators as a list of IDs"""
        if self.co_consecrators:
            return json.loads(self.co_consecrators)
        return []
    
    def __repr__(self):
        return f'<Clergy {self.name}>'

class Rank(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    color = db.Column(db.String(7), nullable=False, default="#000000")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Rank {self.name}>'

class Organization(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), unique=True, nullable=False)
    abbreviation = db.Column(db.String(20), unique=True)  # Short code for the organization
    description = db.Column(db.Text)
    color = db.Column(db.String(7), nullable=False, default="#27ae60")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Organization {self.name}>'

class AdminInvite(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(128), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    invited_by = db.Column(db.Integer, db.ForeignKey('user.id'))  # Who created the invite

    def is_valid(self):
        return not self.used and datetime.utcnow() < self.expires_at


def require_permission(permission):
    """Decorator to require a specific permission"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                flash('Please log in to access this feature.', 'error')
                return redirect(url_for('login'))
            
            user = User.query.get(session['user_id'])
            if not user or not user.is_active:
                session.clear()
                flash('User not found or inactive. Please log in again.', 'error')
                return redirect(url_for('login'))
            
            if not user.has_permission(permission):
                flash('You do not have permission to access this feature.', 'error')
                return redirect(url_for('dashboard'))
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


@app.route('/')
def index():
    # Check if user is logged in
    if 'user_id' in session:
        # User is logged in, redirect to dashboard
        return redirect(url_for('dashboard'))
    else:
        # User is not logged in, redirect to lineage visualization
        return redirect(url_for('lineage_visualization'))

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    # Check if there are already users in the database
    user_count = User.query.count()
    
    if user_count > 0:
        flash('Signup is only available for the first user (admin).', 'error')
        if request.headers.get('HX-Request'):
            return render_template('flash_messages.html')
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        
        if not username or not password:
            flash('Username and password are required.', 'error')
            if request.headers.get('HX-Request'):
                return render_template('flash_messages.html')
            return render_template('signup.html')
        
        if password != confirm_password:
            flash('Passwords do not match.', 'error')
            if request.headers.get('HX-Request'):
                return render_template('flash_messages.html')
            return render_template('signup.html')
        
        if User.query.filter_by(username=username).first():
            flash('Username already exists.', 'error')
            if request.headers.get('HX-Request'):
                return render_template('flash_messages.html')
            return render_template('signup.html')
        
        # Validate password strength
        is_valid, message = validate_password(password)
        if not is_valid:
            flash(f'Password validation failed: {message}', 'error')
            if request.headers.get('HX-Request'):
                return render_template('flash_messages.html')
            return render_template('signup.html')
        
        # Get or create Super Admin role
        super_admin_role = Role.query.filter_by(name='Super Admin').first()
        if not super_admin_role:
            # Initialize roles if they don't exist
            initialize_roles_and_permissions()
            super_admin_role = Role.query.filter_by(name='Super Admin').first()
        
        # Create the first user as Super Admin
        user = User(username=username, role_id=super_admin_role.id)
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        flash('Admin account created successfully! Please log in.', 'success')
        if request.headers.get('HX-Request'):
            # Return a special response for HTMX to handle redirect
            return '<div id="redirect" data-url="' + url_for('login') + '">redirect</div><script>setTimeout(function(){window.location.href="' + url_for('login') + '";},1000);</script>'
        return redirect(url_for('login'))
    
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password) and user.is_active:
            session['user_id'] = user.id
            session['username'] = user.username
            session['role'] = user.role.name if user.role else 'Unknown'
            session['is_admin'] = user.is_admin()
            
            # Update last login
            user.last_login = datetime.utcnow()
            db.session.commit()
            
            flash(f'Welcome back, {username}!', 'success')
            if request.headers.get('HX-Request'):
                # Return a loading page with spinner for HTMX to handle redirect
                return render_template_string('''
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: linear-gradient(135deg, 
                        rgba(26, 37, 48, 0.98) 0%, 
                        rgba(34, 49, 63, 0.95) 25%,
                        rgba(44, 62, 80, 0.92) 50%,
                        rgba(52, 73, 94, 0.90) 75%,
                        rgba(26, 37, 48, 0.95) 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 99999;
                    margin: 0;
                    padding: 0;
                ">
                    <div style="
                        text-align: center;
                        padding: 2rem;
                        background: rgba(44, 62, 80, 0.8);
                        border-radius: 16px;
                        box-shadow: 0 8px 32px rgba(44, 62, 80, 0.3);
                        backdrop-filter: blur(16px);
                        -webkit-backdrop-filter: blur(16px);
                    ">
                        <div class="lds-ring" style="color: rgba(255, 255, 255, 0.9);">
                            <div></div>
                            <div></div>
                            <div></div>
                            <div></div>
                        </div>
                    </div>
                    <style>
                        .lds-ring,
                        .lds-ring div {
                          box-sizing: border-box;
                        }
                        .lds-ring {
                          display: inline-block;
                          position: relative;
                          width: 80px;
                          height: 80px;
                        }
                        .lds-ring div {
                          box-sizing: border-box;
                          display: block;
                          position: absolute;
                          width: 64px;
                          height: 64px;
                          margin: 8px;
                          border: 8px solid currentColor;
                          border-radius: 50%;
                          animation: lds-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
                          border-color: currentColor transparent transparent transparent;
                        }
                        .lds-ring div:nth-child(1) {
                          animation-delay: -0.45s;
                        }
                        .lds-ring div:nth-child(2) {
                          animation-delay: -0.3s;
                        }
                        .lds-ring div:nth-child(3) {
                          animation-delay: -0.15s;
                        }
                        @keyframes lds-ring {
                          0% {
                            transform: rotate(0deg);
                          }
                          100% {
                            transform: rotate(360deg);
                          }
                        }
                    </style>
                    <div id="redirect" data-url="{{ url_for('dashboard') }}" style="display:none;">redirect</div>
                </div>
                <script>
                    // Handle login redirect
                    setTimeout(function() {
                        const redirectDiv = document.getElementById('redirect');
                        if (redirectDiv) {
                            const url = redirectDiv.getAttribute('data-url');
                            window.location.href = url;
                        }
                    }, 1000);
                </script>
                ''')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password.', 'error')
            if request.headers.get('HX-Request'):
                return render_template('flash_messages.html')
    
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        flash('Please log in to access the dashboard.', 'error')
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])
    if not user:
        session.clear()
        flash('User not found. Please log in again.', 'error')
        return redirect(url_for('login'))
    
    return render_template('dashboard.html', user=user)

@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'info')
    if request.headers.get('HX-Request'):
        # Return a loading page with spinner for HTMX to handle redirect
        return render_template_string('''
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, 
                rgba(26, 37, 48, 0.98) 0%, 
                rgba(34, 49, 63, 0.95) 25%,
                rgba(44, 62, 80, 0.92) 50%,
                rgba(52, 73, 94, 0.90) 75%,
                rgba(26, 37, 48, 0.95) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            margin: 0;
            padding: 0;
        ">
            <div style="
                text-align: center;
                padding: 2rem;
                background: rgba(44, 62, 80, 0.8);
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(44, 62, 80, 0.3);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
            ">
                <div class="lds-ring" style="color: rgba(255, 255, 255, 0.9);">
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
            </div>
            <style>
                .lds-ring,
                .lds-ring div {
                  box-sizing: border-box;
                }
                .lds-ring {
                  display: inline-block;
                  position: relative;
                  width: 80px;
                  height: 80px;
                }
                .lds-ring div {
                  box-sizing: border-box;
                  display: block;
                  position: absolute;
                  width: 64px;
                  height: 64px;
                  margin: 8px;
                  border: 8px solid currentColor;
                  border-radius: 50%;
                  animation: lds-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
                  border-color: currentColor transparent transparent transparent;
                }
                .lds-ring div:nth-child(1) {
                  animation-delay: -0.45s;
                }
                .lds-ring div:nth-child(2) {
                  animation-delay: -0.3s;
                }
                .lds-ring div:nth-child(3) {
                  animation-delay: -0.15s;
                }
                @keyframes lds-ring {
                  0% {
                    transform: rotate(0deg);
                  }
                  100% {
                    transform: rotate(360deg);
                  }
                }
            </style>
            <div id="redirect" data-url="{{ url_for('lineage_visualization') }}" style="display:none;">logout</div>
        </div>
        <script>
            // Handle logout redirect
            setTimeout(function() {
                const redirectDiv = document.getElementById('redirect');
                if (redirectDiv) {
                    const url = redirectDiv.getAttribute('data-url');
                    window.location.href = url;
                }
            }, 1000);
        </script>
        ''')
    return redirect(url_for('lineage_visualization'))

@app.route('/clergy')
def clergy_list():
    if 'user_id' not in session:
        flash('Please log in to access clergy records.', 'error')
        return redirect(url_for('login'))
    
    # Get filter parameters from request
    exclude_priests = request.args.get('exclude_priests') == '1'
    exclude_coconsecrators = request.args.get('exclude_coconsecrators') == '1'
    exclude_organizations = request.args.getlist('exclude_organizations')
    search = request.args.get('search', '').strip()

    # Start with all clergy
    query = Clergy.query

    # Exclude priests if requested
    if exclude_priests:
        query = query.filter(Clergy.rank != 'Priest')

    # Exclude co-consecrators if requested (exclude any clergy who are listed as a co-consecrator for anyone)
    if exclude_coconsecrators:
        # Get all co-consecrator IDs
        all_clergy = Clergy.query.all()
        coconsecrator_ids = set()
        for c in all_clergy:
            coconsecrator_ids.update(c.get_co_consecrators())
        if coconsecrator_ids:
            query = query.filter(~Clergy.id.in_(coconsecrator_ids))

    # Exclude selected organizations
    if exclude_organizations:
        query = query.filter(~Clergy.organization.in_(exclude_organizations))

    # Search by name if provided
    if search:
        query = query.filter(Clergy.name.ilike(f'%{search}%'))

    clergy_list = query.all()

    # Prefix names based on rank
    for clergy in clergy_list:
        if clergy.rank.lower() == 'bishop':
            clergy.display_name = f"Most. Rev. {clergy.name}"
        elif clergy.rank.lower() == 'priest':
            clergy.display_name = f"Rev. {clergy.name}"
        else:
            clergy.display_name = clergy.name

    # Get all organizations for the filter dropdown
    organizations = Organization.query.order_by(Organization.name).all()
    org_abbreviation_map = {org.name: org.abbreviation for org in organizations}
    org_color_map = {org.name: org.color for org in organizations}

    # Get ranks and all clergy for modal dropdowns
    ranks = Rank.query.order_by(Rank.name).all()
    all_clergy = Clergy.query.all()
    # Add this block to serialize all clergy for JS
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': getattr(clergy_member, 'display_name', clergy_member.name),
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    import json
    all_clergy_json = json.dumps(all_clergy_data)

    # Get current user for permission checks
    user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
    
    return render_template('clergy_list.html', 
                         clergy_list=clergy_list, 
                         org_abbreviation_map=org_abbreviation_map,
                         org_color_map=org_color_map,
                         organizations=organizations,
                         ranks=ranks,
                         all_clergy=all_clergy,
                         all_clergy_json=all_clergy_json,
                         exclude_priests=exclude_priests,
                         exclude_coconsecrators=exclude_coconsecrators,
                         exclude_organizations=exclude_organizations,
                         search=search,
                         user=user)

@app.route('/clergy/filter_partial')
def clergy_filter_partial():
    if 'user_id' not in session:
        return '', 401
    # Get filter parameters from request
    exclude_priests = request.args.get('exclude_priests') == '1'
    exclude_coconsecrators = request.args.get('exclude_coconsecrators') == '1'
    exclude_organizations = request.args.getlist('exclude_organizations')
    search = request.args.get('search', '').strip()

    query = Clergy.query
    if exclude_priests:
        query = query.filter(Clergy.rank != 'Priest')
    if exclude_coconsecrators:
        all_clergy = Clergy.query.all()
        coconsecrator_ids = set()
        for c in all_clergy:
            coconsecrator_ids.update(c.get_co_consecrators())
        if coconsecrator_ids:
            query = query.filter(~Clergy.id.in_(coconsecrator_ids))
    if exclude_organizations:
        query = query.filter(~Clergy.organization.in_(exclude_organizations))
    if search:
        query = query.filter(Clergy.name.ilike(f'%{search}%'))
    clergy_list = query.all()

    # Prefix names based on rank
    for clergy in clergy_list:
        if clergy.rank.lower() == 'bishop':
            clergy.display_name = f"Most. Rev. {clergy.name}"
        elif clergy.rank.lower() == 'priest':
            clergy.display_name = f"Rev. {clergy.name}"
        else:
            clergy.display_name = clergy.name

    organizations = Organization.query.order_by(Organization.name).all()
    org_abbreviation_map = {org.name: org.abbreviation for org in organizations}
    org_color_map = {org.name: org.color for org in organizations}
    return render_template('clergy_table_body.html', clergy_list=clergy_list, org_abbreviation_map=org_abbreviation_map, org_color_map=org_color_map)

@app.route('/clergy/add', methods=['GET', 'POST'])
@require_permission('add_clergy')
def add_clergy():
    if 'user_id' not in session:
        flash('Please log in to add clergy records.', 'error')
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        name = request.form.get('name')
        rank = request.form.get('rank')
        organization = request.form.get('organization')
        date_of_birth = request.form.get('date_of_birth')
        date_of_ordination = request.form.get('date_of_ordination')
        ordaining_bishop_id = request.form.get('ordaining_bishop_id')
        ordaining_bishop_input = request.form.get('ordaining_bishop_input')
        date_of_consecration = request.form.get('date_of_consecration')
        consecrator_id = request.form.get('consecrator_id')
        consecrator_input = request.form.get('consecrator_input')
        co_consecrators = request.form.get('co_consecrators')
        date_of_death = request.form.get('date_of_death')
        notes = request.form.get('notes')

        # Detect AJAX (modal) submission
        content_type = request.headers.get('Content-Type', '')
        is_ajax = (
            request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
            content_type.startswith('multipart/form-data') or
            content_type == 'application/x-www-form-urlencoded'
        )
        try:
            if not name or not rank:
                if is_ajax:
                    return jsonify({'success': False, 'message': 'Name and rank are required.'}), 400
                flash('Name and rank are required.', 'error')
                return render_template('add_clergy.html')

            clergy = Clergy(
                name=name,
                rank=rank,
                organization=organization,
                notes=notes
            )

            # Handle dates
            if date_of_birth:
                clergy.date_of_birth = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
            if date_of_ordination:
                clergy.date_of_ordination = datetime.strptime(date_of_ordination, '%Y-%m-%d').date()
            if date_of_consecration:
                clergy.date_of_consecration = datetime.strptime(date_of_consecration, '%Y-%m-%d').date()
            if date_of_death:
                clergy.date_of_death = datetime.strptime(date_of_death, '%Y-%m-%d').date()

            # Handle ordaining bishop (allow new name)
            if ordaining_bishop_id and ordaining_bishop_id != 'None':
                clergy.ordaining_bishop_id = int(ordaining_bishop_id)
            elif ordaining_bishop_input:
                existing = Clergy.query.filter_by(name=ordaining_bishop_input.strip()).first()
                if existing:
                    clergy.ordaining_bishop_id = existing.id
                else:
                    new_bishop = Clergy(name=ordaining_bishop_input.strip(), rank='Bishop')
                    db.session.add(new_bishop)
                    db.session.flush()
                    clergy.ordaining_bishop_id = new_bishop.id

            # Handle consecrator (allow new name)
            if consecrator_id and consecrator_id != 'None':
                clergy.consecrator_id = int(consecrator_id)
            elif consecrator_input:
                existing = Clergy.query.filter_by(name=consecrator_input.strip()).first()
                if existing:
                    clergy.consecrator_id = existing.id
                else:
                    new_bishop = Clergy(name=consecrator_input.strip(), rank='Bishop')
                    db.session.add(new_bishop)
                    db.session.flush()
                    clergy.consecrator_id = new_bishop.id

            # Handle co-consecrators
            if co_consecrators:
                co_consecrator_ids = [int(cid.strip()) for cid in co_consecrators.split(',') if cid.strip()]
                clergy.set_co_consecrators(co_consecrator_ids)

            db.session.add(clergy)
            db.session.commit()

            if is_ajax:
                return jsonify({'success': True, 'message': 'Clergy record added successfully!'})
            flash('Clergy record added successfully!', 'success')
            return redirect(url_for('clergy_list'))
        except Exception as e:
            db.session.rollback()
            if is_ajax:
                return jsonify({'success': False, 'message': str(e)}), 400
            flash('Error adding clergy record.', 'error')
            return render_template('add_clergy.html')
    
    # Get all clergy for dropdowns
    all_clergy = Clergy.query.all()
    # Convert to list of dictionaries for JSON serialization
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': clergy_member.name,
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    
    # Get ranks and organizations from metadata
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    
    return render_template('add_clergy.html', 
                         all_clergy=all_clergy, 
                         all_clergy_data=all_clergy_data,
                         ranks=ranks,
                         organizations=organizations)

@app.route('/clergy/<int:clergy_id>')
def view_clergy(clergy_id):
    if 'user_id' not in session:
        flash('Please log in to view clergy records.', 'error')
        return redirect(url_for('login'))
    clergy = Clergy.query.get_or_404(clergy_id)
    
    # Get organization abbreviation mapping
    organizations = Organization.query.all()
    org_abbreviation_map = {org.name: org.abbreviation for org in organizations}
    org_color_map = {org.name: org.color for org in organizations}
    
    return render_template('view_clergy.html', 
                         clergy=clergy, 
                         org_abbreviation_map=org_abbreviation_map,
                         org_color_map=org_color_map)

@app.route('/clergy/<int:clergy_id>/json')
def clergy_json(clergy_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Authentication required'}), 401
    
    clergy = Clergy.query.get_or_404(clergy_id)
    
    return jsonify({
        'id': clergy.id,
        'name': clergy.name,
        'rank': clergy.rank,
        'organization': clergy.organization,
        'date_of_birth': clergy.date_of_birth.strftime('%Y-%m-%d') if clergy.date_of_birth else None,
        'date_of_ordination': clergy.date_of_ordination.strftime('%Y-%m-%d') if clergy.date_of_ordination else None,
        'ordaining_bishop_id': clergy.ordaining_bishop_id,
        'date_of_consecration': clergy.date_of_consecration.strftime('%Y-%m-%d') if clergy.date_of_consecration else None,
        'consecrator_id': clergy.consecrator_id,
        'notes': clergy.notes
    })

@app.route('/clergy/<int:clergy_id>/edit', methods=['GET', 'POST'])
@require_permission('edit_clergy')
def edit_clergy(clergy_id):
    if 'user_id' not in session:
        flash('Please log in to edit clergy records.', 'error')
        return redirect(url_for('login'))
    
    clergy = Clergy.query.get_or_404(clergy_id)
    
    if request.method == 'POST':
        # Handle AJAX request (fetch/FormData or X-Requested-With)
        content_type = request.headers.get('Content-Type', '')
        is_ajax = (
            request.headers.get('X-Requested-With') == 'XMLHttpRequest' or
            content_type.startswith('multipart/form-data') or
            content_type == 'application/x-www-form-urlencoded'
        )
        if is_ajax:
            try:
                clergy.name = request.form.get('name')
                clergy.rank = request.form.get('rank')
                clergy.organization = request.form.get('organization')
                date_of_birth = request.form.get('date_of_birth')
                date_of_ordination = request.form.get('date_of_ordination')
                ordaining_bishop_id = request.form.get('ordaining_bishop_id')
                ordaining_bishop_input = request.form.get('ordaining_bishop_input')
                date_of_consecration = request.form.get('date_of_consecration')
                consecrator_id = request.form.get('consecrator_id')
                consecrator_input = request.form.get('consecrator_input')
                co_consecrators = request.form.get('co_consecrators')
                date_of_death = request.form.get('date_of_death')
                clergy.notes = request.form.get('notes')
                
                if date_of_birth:
                    clergy.date_of_birth = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
                else:
                    clergy.date_of_birth = None
                if date_of_ordination:
                    clergy.date_of_ordination = datetime.strptime(date_of_ordination, '%Y-%m-%d').date()
                else:
                    clergy.date_of_ordination = None
                if date_of_consecration:
                    clergy.date_of_consecration = datetime.strptime(date_of_consecration, '%Y-%m-%d').date()
                else:
                    clergy.date_of_consecration = None
                if date_of_death:
                    clergy.date_of_death = datetime.strptime(date_of_death, '%Y-%m-%d').date()
                else:
                    clergy.date_of_death = None
                
                # Handle ordaining bishop (allow new name)
                if ordaining_bishop_id and ordaining_bishop_id != 'None':
                    clergy.ordaining_bishop_id = int(ordaining_bishop_id)
                elif ordaining_bishop_input:
                    existing = Clergy.query.filter_by(name=ordaining_bishop_input.strip()).first()
                    if existing:
                        clergy.ordaining_bishop_id = existing.id
                    else:
                        new_bishop = Clergy(name=ordaining_bishop_input.strip(), rank='Bishop')
                        db.session.add(new_bishop)
                        db.session.flush()
                        clergy.ordaining_bishop_id = new_bishop.id
                else:
                    clergy.ordaining_bishop_id = None

                # Handle consecrator (allow new name)
                if consecrator_id and consecrator_id != 'None':
                    clergy.consecrator_id = int(consecrator_id)
                elif consecrator_input:
                    existing = Clergy.query.filter_by(name=consecrator_input.strip()).first()
                    if existing:
                        clergy.consecrator_id = existing.id
                    else:
                        new_bishop = Clergy(name=consecrator_input.strip(), rank='Bishop')
                        db.session.add(new_bishop)
                        db.session.flush()
                        clergy.consecrator_id = new_bishop.id
                else:
                    clergy.consecrator_id = None
                
                if co_consecrators:
                    co_consecrator_ids = [int(cid.strip()) for cid in co_consecrators.split(',') if cid.strip()]
                    clergy.set_co_consecrators(co_consecrator_ids)
                else:
                    clergy.set_co_consecrators([])
                
                db.session.commit()
                return jsonify({'success': True, 'message': 'Clergy record updated successfully!'})
            except Exception as e:
                db.session.rollback()
                return jsonify({'success': False, 'message': str(e)}), 400
        # Handle regular form submission (fallback)
        clergy.name = request.form.get('name')
        clergy.rank = request.form.get('rank')
        clergy.organization = request.form.get('organization')
        date_of_birth = request.form.get('date_of_birth')
        date_of_ordination = request.form.get('date_of_ordination')
        ordaining_bishop_id = request.form.get('ordaining_bishop_id')
        ordaining_bishop_input = request.form.get('ordaining_bishop_input')
        date_of_consecration = request.form.get('date_of_consecration')
        consecrator_id = request.form.get('consecrator_id')
        consecrator_input = request.form.get('consecrator_input')
        co_consecrators = request.form.get('co_consecrators')
        date_of_death = request.form.get('date_of_death')
        clergy.notes = request.form.get('notes')
        if date_of_birth:
            clergy.date_of_birth = datetime.strptime(date_of_birth, '%Y-%m-%d').date()
        else:
            clergy.date_of_birth = None
        if date_of_ordination:
            clergy.date_of_ordination = datetime.strptime(date_of_ordination, '%Y-%m-%d').date()
        else:
            clergy.date_of_ordination = None
        if date_of_consecration:
            clergy.date_of_consecration = datetime.strptime(date_of_consecration, '%Y-%m-%d').date()
        else:
            clergy.date_of_consecration = None
        if date_of_death:
            clergy.date_of_death = datetime.strptime(date_of_death, '%Y-%m-%d').date()
        else:
            clergy.date_of_death = None
        clergy.ordaining_bishop_id = int(ordaining_bishop_id) if ordaining_bishop_id and ordaining_bishop_id != 'None' else None
        clergy.consecrator_id = int(consecrator_id) if consecrator_id and consecrator_id != 'None' else None
        if co_consecrators:
            co_consecrator_ids = [int(cid.strip()) for cid in co_consecrators.split(',') if cid.strip()]
            clergy.set_co_consecrators(co_consecrator_ids)
        else:
            clergy.set_co_consecrators([])
        db.session.commit()
        flash('Clergy record updated successfully!', 'success')
        return redirect(url_for('clergy_list'))
    
    all_clergy = Clergy.query.all()
    # Convert to list of dictionaries for JSON serialization
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': clergy_member.name,
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    
    # Get ranks and organizations from metadata
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    
    return render_template('add_clergy.html', 
                         clergy=clergy, 
                         all_clergy=all_clergy, 
                         all_clergy_data=all_clergy_data,
                         ranks=ranks,
                         organizations=organizations,
                         edit_mode=True)

@app.route('/clergy/<int:clergy_id>/delete', methods=['POST'])
@require_permission('delete_clergy')
def delete_clergy(clergy_id):
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    if 'user_id' not in session:
        if is_ajax:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        flash('Please log in to delete clergy records.', 'error')
        return redirect(url_for('login'))
    clergy = Clergy.query.get_or_404(clergy_id)
    try:
        # Clean up ordaining_bishop_id and consecrator_id references
        referencing_clergy = Clergy.query.filter(
            (Clergy.ordaining_bishop_id == clergy_id) | (Clergy.consecrator_id == clergy_id)
        ).all()
        for c in referencing_clergy:
            if c.ordaining_bishop_id == clergy_id:
                c.ordaining_bishop_id = None
            if c.consecrator_id == clergy_id:
                c.consecrator_id = None
        # Clean up co-consecrator references
        all_clergy = Clergy.query.all()
        for c in all_clergy:
            co_consecrators = c.get_co_consecrators()
            if clergy_id in co_consecrators:
                co_consecrators = [cid for cid in co_consecrators if cid != clergy_id]
                c.set_co_consecrators(co_consecrators)
        db.session.delete(clergy)
        db.session.commit()
        if is_ajax:
            return jsonify({'success': True, 'message': 'Clergy record deleted successfully!'})
        flash('Clergy record deleted successfully!', 'success')
        return redirect(url_for('clergy_list'))
    except Exception as e:
        db.session.rollback()
        if is_ajax:
            return jsonify({'success': False, 'message': str(e)}), 500
        flash('Error deleting clergy record.', 'error')
        return redirect(url_for('clergy_list'))

@app.route('/metadata')
@require_permission('manage_metadata')
def metadata():
    if 'user_id' not in session:
        flash('Please log in to access metadata.', 'error')
        return redirect(url_for('login'))
    
    # Get ranks and organizations from the dedicated tables
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    
    # Also get counts from clergy records for reference
    clergy_ranks = db.session.query(Clergy.rank).distinct().filter(Clergy.rank.isnot(None)).all()
    clergy_organizations = db.session.query(Clergy.organization).distinct().filter(Clergy.organization.isnot(None)).all()
    
    clergy_rank_list = [rank[0] for rank in clergy_ranks]
    clergy_organization_list = [org[0] for org in clergy_organizations]
    
    return render_template('metadata.html', 
                         ranks=ranks, 
                         organizations=organizations,
                         clergy_ranks=clergy_rank_list,
                         clergy_organizations=clergy_organization_list)

@app.route('/metadata/rank/add', methods=['POST'])
@require_permission('manage_metadata')
def add_rank():
    if 'user_id' not in session or not session.get('is_admin'):
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    
    data = request.get_json()
    rank_name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    color = data.get('color', '#000000').strip() or '#000000'
    
    if not rank_name:
        return jsonify({'success': False, 'message': 'Rank name is required'}), 400
    
    # Check if rank already exists
    existing_rank = Rank.query.filter_by(name=rank_name).first()
    if existing_rank:
        return jsonify({'success': False, 'message': 'Rank already exists'}), 400
    
    try:
        new_rank = Rank(name=rank_name, description=description, color=color)
        db.session.add(new_rank)
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'Rank "{rank_name}" added successfully',
            'rank': {
                'id': new_rank.id,
                'name': new_rank.name,
                'description': new_rank.description,
                'color': new_rank.color
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error adding rank'}), 500

@app.route('/metadata/rank/<int:rank_id>/edit', methods=['PUT'])
@require_permission('manage_metadata')
def edit_rank(rank_id):
    if 'user_id' not in session or not session.get('is_admin'):
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    
    rank = Rank.query.get_or_404(rank_id)
    data = request.get_json()
    rank_name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    color = data.get('color', '#000000').strip() or '#000000'
    
    if not rank_name:
        return jsonify({'success': False, 'message': 'Rank name is required'}), 400
    
    # Check if new name conflicts with existing rank (excluding current rank)
    existing_rank = Rank.query.filter_by(name=rank_name).first()
    if existing_rank and existing_rank.id != rank_id:
        return jsonify({'success': False, 'message': 'Rank name already exists'}), 400
    
    try:
        old_name = rank.name
        rank.name = rank_name
        rank.description = description
        rank.color = color
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'Rank "{old_name}" updated to "{rank_name}" successfully',
            'rank': {
                'id': rank.id,
                'name': rank.name,
                'description': rank.description,
                'color': rank.color
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error updating rank'}), 500

@app.route('/metadata/rank/<int:rank_id>/delete', methods=['DELETE'])
@require_permission('manage_metadata')
def delete_rank(rank_id):
    if 'user_id' not in session or not session.get('is_admin'):
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    
    rank = Rank.query.get_or_404(rank_id)
    
    # Check if rank is used in clergy records
    clergy_using_rank = Clergy.query.filter_by(rank=rank.name).first()
    if clergy_using_rank:
        return jsonify({
            'success': False, 
            'message': f'Cannot delete rank "{rank.name}" - it is used by clergy records'
        }), 400
    
    try:
        db.session.delete(rank)
        db.session.commit()
        return jsonify({'success': True, 'message': f'Rank "{rank.name}" deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error deleting rank'}), 500

@app.route('/metadata/organization/add', methods=['POST'])
@require_permission('manage_metadata')
def add_organization():
    if 'user_id' not in session or not session.get('is_admin'):
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    
    data = request.get_json()
    org_name = data.get('name', '').strip()
    abbreviation = data.get('abbreviation', '').strip()
    description = data.get('description', '').strip()
    color = data.get('color', '#27ae60').strip() or '#27ae60'
    
    if not org_name:
        return jsonify({'success': False, 'message': 'Organization name is required'}), 400
    
    # Check if organization already exists
    existing_org = Organization.query.filter_by(name=org_name).first()
    if existing_org:
        return jsonify({'success': False, 'message': 'Organization already exists'}), 400
    
    # Check if abbreviation already exists (if provided)
    if abbreviation:
        existing_abbr = Organization.query.filter_by(abbreviation=abbreviation).first()
        if existing_abbr:
            return jsonify({'success': False, 'message': f'Abbreviation "{abbreviation}" already exists'}), 400
    
    try:
        new_org = Organization(name=org_name, abbreviation=abbreviation, description=description, color=color)
        db.session.add(new_org)
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'Organization "{org_name}" added successfully',
            'organization': {
                'id': new_org.id,
                'name': new_org.name,
                'abbreviation': new_org.abbreviation,
                'description': new_org.description,
                'color': new_org.color
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error adding organization'}), 500

@app.route('/metadata/organization/<int:org_id>/edit', methods=['PUT'])
@require_permission('manage_metadata')
def edit_organization(org_id):
    if 'user_id' not in session or not session.get('is_admin'):
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    
    org = Organization.query.get_or_404(org_id)
    data = request.get_json()
    org_name = data.get('name', '').strip()
    abbreviation = data.get('abbreviation', '').strip()
    description = data.get('description', '').strip()
    color = data.get('color', '#27ae60').strip() or '#27ae60'
    
    if not org_name:
        return jsonify({'success': False, 'message': 'Organization name is required'}), 400
    
    # Check if new name conflicts with existing organization (excluding current org)
    existing_org = Organization.query.filter_by(name=org_name).first()
    if existing_org and existing_org.id != org_id:
        return jsonify({'success': False, 'message': 'Organization name already exists'}), 400
    
    # Check if new abbreviation conflicts with existing organization (excluding current org)
    if abbreviation:
        existing_abbr = Organization.query.filter_by(abbreviation=abbreviation).first()
        if existing_abbr and existing_abbr.id != org_id:
            return jsonify({'success': False, 'message': f'Abbreviation "{abbreviation}" already exists'}), 400
    
    try:
        old_name = org.name
        org.name = org_name
        org.abbreviation = abbreviation if abbreviation else None
        org.description = description
        org.color = color
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'Organization "{old_name}" updated to "{org_name}" successfully',
            'organization': {
                'id': org.id,
                'name': org.name,
                'abbreviation': org.abbreviation,
                'description': org.description,
                'color': org.color
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error updating organization'}), 500

@app.route('/metadata/organization/<int:org_id>/delete', methods=['DELETE'])
@require_permission('manage_metadata')
def delete_organization(org_id):
    if 'user_id' not in session or not session.get('is_admin'):
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    
    org = Organization.query.get_or_404(org_id)
    
    # Check if organization is used in clergy records
    clergy_using_org = Clergy.query.filter_by(organization=org.name).first()
    if clergy_using_org:
        return jsonify({
            'success': False, 
            'message': f'Cannot delete organization "{org.name}" - it is used by clergy records'
        }), 400
    
    try:
        db.session.delete(org)
        db.session.commit()
        return jsonify({'success': True, 'message': f'Organization "{org.name}" deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error deleting organization'}), 500

@app.route('/lineage')
def lineage_visualization():
    # Allow both logged-in and non-logged-in users to view lineage visualization
    # Get all clergy for the visualization
    all_clergy = Clergy.query.all()
    
    # Get all organizations and ranks for color lookup
    organizations = {org.name: org.color for org in Organization.query.all()}
    ranks = {rank.name: rank.color for rank in Rank.query.all()}

    # SVG placeholder (simple person icon, base64-encoded)
    placeholder_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="24" r="14" fill="#bdc3c7"/><ellipse cx="32" cy="50" rx="20" ry="12" fill="#bdc3c7"/></svg>'''
    import base64
    placeholder_data_url = 'data:image/svg+xml;base64,' + base64.b64encode(placeholder_svg.encode('utf-8')).decode('utf-8')

    # Prepare data for D3.js
    nodes = []
    links = []
    
    # Create nodes for each clergy, including both colors and image
    for clergy in all_clergy:
        org_color = organizations.get(clergy.organization) or '#2c3e50'
        rank_color = ranks.get(clergy.rank) or '#888888'
        nodes.append({
            'id': clergy.id,
            'name': clergy.name,
            'rank': clergy.rank,
            'organization': clergy.organization,
            'org_color': org_color,
            'rank_color': rank_color,
            'image_url': placeholder_data_url
        })
    
    # Create links for ordinations (black arrows)
    for clergy in all_clergy:
        if clergy.ordaining_bishop_id:
            links.append({
                'source': clergy.ordaining_bishop_id,
                'target': clergy.id,
                'type': 'ordination',
                'date': clergy.date_of_ordination.strftime('%Y-%m-%d') if clergy.date_of_ordination else 'Date unknown',
                'color': '#000000'
            })
    
    # Create links for consecrations (green arrows)
    for clergy in all_clergy:
        if clergy.consecrator_id:
            links.append({
                'source': clergy.consecrator_id,
                'target': clergy.id,
                'type': 'consecration',
                'date': clergy.date_of_consecration.strftime('%Y-%m-%d') if clergy.date_of_consecration else 'Date unknown',
                'color': '#27ae60'
            })
    
    # Create links for co-consecrations (dotted green arrows)
    for clergy in all_clergy:
        if clergy.co_consecrators:
            co_consecrator_ids = clergy.get_co_consecrators()
            for co_consecrator_id in co_consecrator_ids:
                links.append({
                    'source': co_consecrator_id,
                    'target': clergy.id,
                    'type': 'co-consecration',
                    'date': clergy.date_of_consecration.strftime('%Y-%m-%d') if clergy.date_of_consecration else 'Date unknown',
                    'color': '#27ae60',
                    'dashed': True
                })
    
    return render_template('lineage_visualization.html', 
                         nodes=json.dumps(nodes), 
                         links=json.dumps(links))

@app.route('/settings')
def settings():
    if 'user_id' not in session or not session.get('is_admin'):
        flash('Admin access required.', 'error')
        return redirect(url_for('login'))
    user = User.query.get(session['user_id'])
    return render_template('settings.html', user=user)

@app.route('/settings/invite', methods=['POST'])
def generate_admin_invite():
    if 'user_id' not in session or not session.get('is_admin'):
        flash('Admin access required.', 'error')
        return redirect(url_for('login'))
    # Generate unique token and expiry (24 hours)
    token = str(uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=24)
    invite = AdminInvite(token=token, expires_at=expires_at, invited_by=session['user_id'])
    db.session.add(invite)
    db.session.commit()
    invite_link = url_for('admin_invite_signup', token=token, _external=True)
    user = User.query.get(session['user_id'])
    return render_template('settings.html', user=user, invite_link=invite_link)

@app.route('/settings/change-password', methods=['POST'])
def change_password():
    if 'user_id' not in session:
        flash('You must be logged in to change your password.', 'error')
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])
    if not user:
        flash('User not found.', 'error')
        return redirect(url_for('login'))
    
    current_password = request.form.get('current_password')
    new_password = request.form.get('new_password')
    confirm_password = request.form.get('confirm_password')
    
    # Validate current password
    if not user.check_password(current_password):
        flash('Current password is incorrect.', 'error')
        return redirect(url_for('settings'))
    
    # Check if new password and confirmation match
    if new_password != confirm_password:
        flash('New password and confirmation do not match.', 'error')
        return redirect(url_for('settings'))
    
    # Validate new password strength
    is_valid, message = validate_password(new_password)
    if not is_valid:
        flash(f'Password validation failed: {message}', 'error')
        return redirect(url_for('settings'))
    
    # Update password
    user.set_password(new_password)
    db.session.commit()
    
    flash('Password changed successfully!', 'success')
    return redirect(url_for('settings'))

@app.route('/admin/invite/<token>', methods=['GET', 'POST'])
def admin_invite_signup(token):
    invite = AdminInvite.query.filter_by(token=token).first()
    if not invite or not invite.is_valid():
        flash('This invite link is invalid or has expired.', 'error')
        return redirect(url_for('login'))
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        if not username or not password:
            flash('Username and password are required.', 'error')
            return render_template('signup.html', invite_token=token)
        if password != confirm_password:
            flash('Passwords do not match.', 'error')
            return render_template('signup.html', invite_token=token)
        if User.query.filter_by(username=username).first():
            flash('Username already exists.', 'error')
            return render_template('signup.html', invite_token=token)
        
        # Validate password strength
        is_valid, message = validate_password(password)
        if not is_valid:
            flash(f'Password validation failed: {message}', 'error')
            return render_template('signup.html', invite_token=token)
        
        # Get Super Admin role
        super_admin_role = Role.query.filter_by(name='Super Admin').first()
        if not super_admin_role:
            initialize_roles_and_permissions()
            super_admin_role = Role.query.filter_by(name='Super Admin').first()
        
        user = User(username=username, role_id=super_admin_role.id)
        user.set_password(password)
        db.session.add(user)
        invite.used = True
        db.session.commit()
        flash('Admin account created successfully! Please log in.', 'success')
        return redirect(url_for('login'))
    return render_template('signup.html', invite_token=token)

@app.route('/clergy/modal/add')
def clergy_modal_add():
    if 'user_id' not in session:
        return '', 401
    all_clergy = Clergy.query.all()
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': getattr(clergy_member, 'display_name', clergy_member.name),
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    return render_template('clergy_modal_wrapper.html',
        clergy=None,
        all_clergy_data=all_clergy_data,
        ranks=ranks,
        organizations=organizations,
        edit_mode=False
    )

@app.route('/clergy/modal/<int:clergy_id>/edit')
def clergy_modal_edit(clergy_id):
    if 'user_id' not in session:
        return '', 401
    clergy = Clergy.query.get_or_404(clergy_id)
    all_clergy = Clergy.query.all()
    all_clergy_data = [
        {
            'id': clergy_member.id,
            'name': getattr(clergy_member, 'display_name', clergy_member.name),
            'rank': clergy_member.rank,
            'organization': clergy_member.organization
        }
        for clergy_member in all_clergy
    ]
    ranks = Rank.query.order_by(Rank.name).all()
    organizations = Organization.query.order_by(Organization.name).all()
    return render_template('clergy_modal_wrapper.html',
        clergy=clergy,
        all_clergy_data=all_clergy_data,
        ranks=ranks,
        organizations=organizations,
        edit_mode=True
    )

@app.route('/init-db')
def init_database_endpoint():
    """Initialize database tables - for development/debugging only"""
    try:
        print("🔍 Manual Database Initialization via endpoint")
        print("=" * 50)
        
        # Test connection
        print("🔍 Testing database connection...")
        db.engine.connect()
        print("✅ Database connection successful")
        
        # Check existing tables
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        existing_tables = inspector.get_table_names()
        print(f"📋 Existing tables: {existing_tables}")
        
        # Create tables
        print("📊 Creating database tables...")
        db.create_all()
        print("✅ Database tables created successfully!")
        
        # Verify tables were created
        inspector = inspect(db.engine)
        new_tables = inspector.get_table_names()
        print(f"📋 All tables after creation: {new_tables}")
        
        # Create admin user
        existing_admin = User.query.filter_by(is_admin=True).first()
        if not existing_admin:
            print("👤 Creating admin user...")
            admin_user = User(
                username="admin",
                is_admin=True
            )
            admin_user.set_password("admin123")
            db.session.add(admin_user)
            db.session.commit()
            print("✅ Admin user created successfully!")
            print("Username: admin")
            print("Password: admin123")
        else:
            print(f"ℹ️  Admin user already exists: {existing_admin.username}")
        
        # Initialize roles and permissions
        initialize_roles_and_permissions()
        print("✅ Roles and Permissions initialized.")

        print("=" * 50)
        print("✅ Database initialization completed successfully!")
        
        return jsonify({
            'success': True,
            'message': 'Database initialized successfully!',
            'tables_created': new_tables,
            'admin_created': existing_admin is None
        })
        
    except Exception as e:
        print(f"❌ Error during database initialization: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def initialize_roles_and_permissions():
    """Initialize default roles and permissions"""
    # Create permissions
    permissions = {
        'view_clergy': 'View clergy records',
        'add_clergy': 'Add new clergy records',
        'edit_clergy': 'Edit existing clergy records',
        'delete_clergy': 'Delete clergy records',
        'manage_metadata': 'Manage ranks and organizations',
        'manage_users': 'Manage user accounts and roles',
        'add_comments': 'Add comments to clergy records',
        'view_comments': 'View comments on clergy records',
        'resolve_comments': 'Resolve comments and feedback',
        'view_lineage': 'View lineage visualization',
        'export_data': 'Export data from the system'
    }
    
    for perm_name, perm_desc in permissions.items():
        perm = Permission.query.filter_by(name=perm_name).first()
        if not perm:
            perm = Permission(name=perm_name, description=perm_desc)
            db.session.add(perm)
    
    # Create roles with their permissions
    roles_config = {
        'Super Admin': {
            'description': 'Full system access and administration',
            'permissions': list(permissions.keys())
        },
        'Editor': {
            'description': 'Full content management capabilities',
            'permissions': ['view_clergy', 'add_clergy', 'edit_clergy', 'delete_clergy', 
                          'manage_metadata', 'add_comments', 'view_comments', 
                          'resolve_comments', 'view_lineage', 'export_data']
        },
        'Contributor': {
            'description': 'Can add and edit clergy records with approval workflow',
            'permissions': ['view_clergy', 'add_clergy', 'edit_clergy', 'add_comments', 
                          'view_comments', 'view_lineage']
        },
        'Reviewer': {
            'description': 'Can view records and provide feedback',
            'permissions': ['view_clergy', 'add_comments', 'view_comments', 'view_lineage']
        },
        'Viewer': {
            'description': 'Read-only access to clergy records and lineage',
            'permissions': ['view_clergy', 'view_lineage']
        }
    }
    
    for role_name, role_config in roles_config.items():
        role = Role.query.filter_by(name=role_name).first()
        if not role:
            role = Role(name=role_name, description=role_config['description'])
            db.session.add(role)
            db.session.flush()  # Get the role ID
        
        # Add permissions to role
        for perm_name in role_config['permissions']:
            perm = Permission.query.filter_by(name=perm_name).first()
            if perm and perm not in role.permissions:
                role.permissions.append(perm)
    
    db.session.commit()

@app.route('/users')
@require_permission('manage_users')
def user_management():
    """User management page for admins"""
    users = User.query.all()
    roles = Role.query.all()
    return render_template('user_management.html', users=users, roles=roles)

@app.route('/users/add', methods=['POST'])
@require_permission('manage_users')
def add_user():
    """Add a new user"""
    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    full_name = data.get('full_name', '').strip()
    role_id = data.get('role_id')
    password = data.get('password', '').strip()
    
    if not username or not password or not role_id:
        return jsonify({'success': False, 'message': 'Username, password, and role are required'}), 400
    
    # Validate password strength
    is_valid, message = validate_password(password)
    if not is_valid:
        return jsonify({'success': False, 'message': f'Password validation failed: {message}'}), 400
    
    # Check if username already exists
    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'message': 'Username already exists'}), 400
    
    # Check if email already exists (if provided)
    if email and User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'Email already exists'}), 400
    
    try:
        user = User(
            username=username,
            email=email if email else None,
            full_name=full_name if full_name else None,
            role_id=role_id
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'User "{username}" created successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name,
                'role': user.role.name,
                'is_active': user.is_active
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error creating user'}), 500

@app.route('/users/<int:user_id>/edit', methods=['PUT'])
@require_permission('manage_users')
def edit_user(user_id):
    """Edit an existing user"""
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    full_name = data.get('full_name', '').strip()
    role_id = data.get('role_id')
    is_active = data.get('is_active', True)
    
    if not username or not role_id:
        return jsonify({'success': False, 'message': 'Username and role are required'}), 400
    
    # Check if new username conflicts with existing user (excluding current user)
    existing_user = User.query.filter_by(username=username).first()
    if existing_user and existing_user.id != user_id:
        return jsonify({'success': False, 'message': 'Username already exists'}), 400
    
    # Check if new email conflicts with existing user (excluding current user)
    if email:
        existing_email = User.query.filter_by(email=email).first()
        if existing_email and existing_email.id != user_id:
            return jsonify({'success': False, 'message': 'Email already exists'}), 400
    
    try:
        old_username = user.username
        user.username = username
        user.email = email if email else None
        user.full_name = full_name if full_name else None
        user.role_id = role_id
        user.is_active = is_active
        
        # Update password if provided
        if data.get('password'):
            is_valid, message = validate_password(data['password'])
            if not is_valid:
                return jsonify({'success': False, 'message': f'Password validation failed: {message}'}), 400
            user.set_password(data['password'])
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'User "{old_username}" updated successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name,
                'role': user.role.name,
                'is_active': user.is_active
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error updating user'}), 500

@app.route('/users/<int:user_id>/delete', methods=['DELETE'])
@require_permission('manage_users')
def delete_user(user_id):
    """Delete a user"""
    user = User.query.get_or_404(user_id)
    
    # Prevent deleting the last Super Admin
    if user.role.name == 'Super Admin':
        super_admin_count = User.query.join(Role).filter(Role.name == 'Super Admin').count()
        if super_admin_count <= 1:
            return jsonify({'success': False, 'message': 'Cannot delete the last Super Admin user'}), 400
    
    try:
        username = user.username
        db.session.delete(user)
        db.session.commit()
        return jsonify({'success': True, 'message': f'User "{username}" deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error deleting user'}), 500

@app.route('/clergy/<int:clergy_id>/comments')
def clergy_comments(clergy_id):
    """Get comments for a clergy member"""
    clergy = Clergy.query.get_or_404(clergy_id)
    comments = clergy.comments.filter_by(is_public=True).order_by(ClergyComment.created_at.desc()).all()
    return render_template('clergy_comments.html', clergy=clergy, comments=comments)

@app.route('/clergy/<int:clergy_id>/comments/add', methods=['POST'])
@require_permission('add_comments')
def add_clergy_comment(clergy_id):
    """Add a comment to a clergy record"""
    clergy = Clergy.query.get_or_404(clergy_id)
    content = request.form.get('content', '').strip()
    
    if not content:
        return jsonify({'success': False, 'message': 'Comment content is required'}), 400
    
    try:
        comment = ClergyComment(
            clergy_id=clergy_id,
            author_id=session['user_id'],
            content=content
        )
        db.session.add(comment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Comment added successfully',
            'comment': {
                'id': comment.id,
                'content': comment.content,
                'author': comment.author.username,
                'created_at': comment.created_at.strftime('%Y-%m-%d %H:%M:%S')
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error adding comment'}), 500

@app.route('/comments/<int:comment_id>/resolve', methods=['POST'])
@require_permission('resolve_comments')
def resolve_comment(comment_id):
    """Mark a comment as resolved"""
    comment = ClergyComment.query.get_or_404(comment_id)
    
    try:
        comment.is_resolved = True
        db.session.commit()
        return jsonify({'success': True, 'message': 'Comment marked as resolved'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Error resolving comment'}), 500


if __name__ == '__main__':
    import sys
    port = 5000
    if '--port' in sys.argv:
        try:
            port = int(sys.argv[sys.argv.index('--port') + 1])
        except (ValueError, IndexError):
            pass
    
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=port) 