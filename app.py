from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, render_template_string
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
import json
from add_sample_data import add_sample_data
from uuid import uuid4
from dotenv import load_dotenv

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

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Handle database URL for Render and ensure psycopg3 compatibility
if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace('postgres://', 'postgresql://', 1)

# Configure SQLAlchemy to use psycopg3 for PostgreSQL connections
if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgresql://'):
    # Force SQLAlchemy to use psycopg3 by updating the URL
    if 'psycopg2' not in app.config['SQLALCHEMY_DATABASE_URI']:
        app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace('postgresql://', 'postgresql+psycopg://', 1)
    
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'connect_args': {
            'connect_timeout': 10
        }
    }

db = SQLAlchemy(app)

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
    is_admin = db.Column(db.Boolean, default=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

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
        
        # Create the first user as admin
        user = User(username=username, is_admin=True)
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        flash('Admin account created successfully! Please log in.', 'success')
        if request.headers.get('HX-Request'):
            # Return a special response for HTMX to handle redirect
            return '<div id="redirect" data-url="' + url_for('login') + '">redirect</div>'
        return redirect(url_for('login'))
    
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            session['user_id'] = user.id
            session['username'] = user.username
            session['is_admin'] = user.is_admin
            flash(f'Welcome back, {username}!', 'success')
            if request.headers.get('HX-Request'):
                # Return a special response for HTMX to handle redirect
                return '<div id="redirect" data-url="' + url_for('dashboard') + '">redirect</div>'
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
        # Return a special response for HTMX to handle redirect
        return '<div id="redirect" data-url="' + url_for('lineage_visualization') + '">logout</div>'
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
                         search=search)

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
        user = User(username=username, is_admin=True)
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