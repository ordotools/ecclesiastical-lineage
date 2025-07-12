from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os
import json

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

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

@app.route('/')
def index():
    # Check if there are any users in the database
    user_count = User.query.count()
    
    if user_count == 0:
        # No users exist, redirect to signup
        return redirect(url_for('signup'))
    else:
        # Users exist, redirect to login
        return redirect(url_for('login'))

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
        return '<div id="redirect" data-url="' + url_for('login') + '">logout</div>'
    return redirect(url_for('login'))

@app.route('/clergy')
def clergy_list():
    if 'user_id' not in session:
        flash('Please log in to access clergy records.', 'error')
        return redirect(url_for('login'))
    
    clergy_list = Clergy.query.all()
    return render_template('clergy_list.html', clergy_list=clergy_list)

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
        date_of_consecration = request.form.get('date_of_consecration')
        consecrator_id = request.form.get('consecrator_id')
        co_consecrators = request.form.get('co_consecrators')
        notes = request.form.get('notes')
        
        if not name or not rank:
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
        
        # Handle foreign keys
        if ordaining_bishop_id:
            clergy.ordaining_bishop_id = int(ordaining_bishop_id)
        if consecrator_id:
            clergy.consecrator_id = int(consecrator_id)
        
        # Handle co-consecrators
        if co_consecrators:
            co_consecrator_ids = [int(cid.strip()) for cid in co_consecrators.split(',') if cid.strip()]
            clergy.set_co_consecrators(co_consecrator_ids)
        
        db.session.add(clergy)
        db.session.commit()
        
        flash('Clergy record added successfully!', 'success')
        return redirect(url_for('clergy_list'))
    
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
    return render_template('add_clergy.html', all_clergy=all_clergy, all_clergy_data=all_clergy_data)

@app.route('/clergy/<int:clergy_id>')
def view_clergy(clergy_id):
    if 'user_id' not in session:
        flash('Please log in to view clergy records.', 'error')
        return redirect(url_for('login'))
    clergy = Clergy.query.get_or_404(clergy_id)
    return render_template('view_clergy.html', clergy=clergy)

@app.route('/clergy/<int:clergy_id>/edit', methods=['GET', 'POST'])
def edit_clergy(clergy_id):
    if 'user_id' not in session:
        flash('Please log in to edit clergy records.', 'error')
        return redirect(url_for('login'))
    clergy = Clergy.query.get_or_404(clergy_id)
    if request.method == 'POST':
        clergy.name = request.form.get('name')
        clergy.rank = request.form.get('rank')
        clergy.organization = request.form.get('organization')
        date_of_birth = request.form.get('date_of_birth')
        date_of_ordination = request.form.get('date_of_ordination')
        ordaining_bishop_id = request.form.get('ordaining_bishop_id')
        date_of_consecration = request.form.get('date_of_consecration')
        consecrator_id = request.form.get('consecrator_id')
        co_consecrators = request.form.get('co_consecrators')
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
        clergy.ordaining_bishop_id = int(ordaining_bishop_id) if ordaining_bishop_id else None
        clergy.consecrator_id = int(consecrator_id) if consecrator_id else None
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
    return render_template('add_clergy.html', clergy=clergy, all_clergy=all_clergy, all_clergy_data=all_clergy_data, edit_mode=True)

@app.route('/clergy/<int:clergy_id>/delete', methods=['POST'])
def delete_clergy(clergy_id):
    if 'user_id' not in session:
        flash('Please log in to delete clergy records.', 'error')
        return redirect(url_for('login'))
    clergy = Clergy.query.get_or_404(clergy_id)
    db.session.delete(clergy)
    db.session.commit()
    flash('Clergy record deleted successfully!', 'success')
    return redirect(url_for('clergy_list'))

@app.route('/lineage')
def lineage_visualization():
    if 'user_id' not in session:
        flash('Please log in to view lineage visualization.', 'error')
        return redirect(url_for('login'))
    
    # Get all clergy for the visualization
    all_clergy = Clergy.query.all()
    
    # Prepare data for D3.js
    nodes = []
    links = []
    
    # Create nodes for each clergy
    for clergy in all_clergy:
        nodes.append({
            'id': clergy.id,
            'name': clergy.name,
            'rank': clergy.rank,
            'organization': clergy.organization
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

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True) 