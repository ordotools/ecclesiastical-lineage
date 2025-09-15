from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

# Association table for role-permission relationship
role_permissions = db.Table('role_permissions',
    db.Column('role_id', db.Integer, db.ForeignKey('role.id'), primary_key=True),
    db.Column('permission_id', db.Integer, db.ForeignKey('permission.id'), primary_key=True)
)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    full_name = db.Column(db.String(200), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    role_id = db.Column(db.Integer, db.ForeignKey('role.id'), nullable=False)
    role = db.relationship('Role', backref='users')
    comments = db.relationship('ClergyComment', backref='author', lazy='dynamic', cascade='all, delete-orphan')

    def set_password(self, password):
        from werkzeug.security import generate_password_hash
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        from werkzeug.security import check_password_hash
        return check_password_hash(self.password_hash, password)

    def has_permission(self, permission):
        return self.role and self.role.has_permission(permission)

    def can_edit_clergy(self):
        return self.has_permission('edit_clergy')

    def can_delete_clergy(self):
        return self.has_permission('delete_clergy')

    def can_manage_metadata(self):
        return self.has_permission('manage_metadata')

    def can_manage_users(self):
        return self.has_permission('manage_users')

    def can_comment(self):
        return self.has_permission('add_comments')

    def can_resolve_comments(self):
        return self.has_permission('resolve_comments')

    def can_view_audit_logs(self):
        return self.has_permission('view_audit_logs')

    def is_admin(self):
        return self.role and self.role.name == 'Super Admin'

    def is_admin_or_super_admin(self):
        return self.role and self.role.name in ['Super Admin', 'Admin']

class Role(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    permissions = db.relationship('Permission', secondary=role_permissions, backref='roles')

    def has_permission(self, permission_name):
        perms = getattr(self, 'permissions', [])
        return any(p.name == permission_name for p in perms)

    def __repr__(self):
        return f'<Role {self.name}>'

class Permission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Permission {self.name}>'

class Clergy(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    rank = db.Column(db.String(100), nullable=False)
    papal_name = db.Column(db.String(200), nullable=True)  # Papal name for popes
    organization = db.Column(db.String(200))
    date_of_birth = db.Column(db.Date)
    date_of_ordination = db.Column(db.Date)
    ordaining_bishop_id = db.Column(db.Integer, db.ForeignKey('clergy.id'))
    date_of_consecration = db.Column(db.Date)
    consecrator_id = db.Column(db.Integer, db.ForeignKey('clergy.id'))
    co_consecrators = db.Column(db.Text)
    date_of_death = db.Column(db.Date)
    notes = db.Column(db.Text)
    image_url = db.Column(db.Text)  # Store base64 image data or file path
    image_data = db.Column(db.Text)  # Store JSON with multiple image sizes
    ordaining_bishop = db.relationship('Clergy', foreign_keys=[ordaining_bishop_id], remote_side=[id])
    consecrator = db.relationship('Clergy', foreign_keys=[consecrator_id], remote_side=[id])
    is_deleted = db.Column(db.Boolean, default=False)
    deleted_at = db.Column(db.DateTime, nullable=True)

    def set_co_consecrators(self, co_consecrator_ids):
        if co_consecrator_ids:
            self.co_consecrators = json.dumps(co_consecrator_ids)
        else:
            self.co_consecrators = None

    def get_co_consecrators(self):
        if self.co_consecrators:
            return json.loads(self.co_consecrators)
        return []

    def was_alive_on(self, date):
        """Return True if this clergy was alive on the given date (or if date unknown, assume alive)."""
        if not date:
            return True
        if self.date_of_birth and date < self.date_of_birth:
            return False
        if self.date_of_death and date > self.date_of_death:
            return False
        return True

    def was_bishop_on(self, date):
        """Return True if this clergy was a bishop on the given date (or if date unknown, assume yes if currently bishop)."""
        if not date:
            return self.rank and 'bishop' in self.rank.lower()
        
        # If they're not currently a bishop, they weren't a bishop on that date
        if not self.rank or 'bishop' not in self.rank.lower():
            return False
        
        # Check if they were alive on that date
        if not self.was_alive_on(date):
            return False
        
        # Check if they were already a bishop on that date
        # If they have a consecration date, they must have been consecrated before or on that date
        if self.date_of_consecration and date < self.date_of_consecration:
            return False
        
        return True

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
    abbreviation = db.Column(db.String(20), unique=True)
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
    invited_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    role_id = db.Column(db.Integer, db.ForeignKey('role.id'), nullable=True)
    max_uses = db.Column(db.Integer, default=1)
    current_uses = db.Column(db.Integer, default=0)
    expires_in_hours = db.Column(db.Integer, default=24)

    def is_valid(self):
        return self.current_uses < self.max_uses and datetime.utcnow() < self.expires_at

    def can_be_used_by_role(self, user_role):
        if not self.role_id:
            return True
        target_role = Role.query.get(self.role_id)
        if not target_role:
            return False
        if user_role.name == 'Super Admin':
            return True
        if user_role.name == 'Admin':
            return target_role.name != 'Super Admin'
        return target_role.name == user_role.name

class ClergyComment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    clergy_id = db.Column(db.Integer, db.ForeignKey('clergy.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    field_name = db.Column(db.String(50), nullable=True)
    is_public = db.Column(db.Boolean, default=True)
    is_resolved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    clergy = db.relationship('Clergy', backref='comments')

    def __repr__(self):
        return f'<ClergyComment {self.id} on Clergy {self.clergy_id}>'

class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.Integer, nullable=True)
    entity_name = db.Column(db.String(200), nullable=True)
    details = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship('User', backref='audit_logs')

    def __repr__(self):
        return f'<AuditLog {self.action} on {self.entity_type} by {self.user_id}>' 