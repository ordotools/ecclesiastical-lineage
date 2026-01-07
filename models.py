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
    date_of_death = db.Column(db.Date)
    notes = db.Column(db.Text)
    image_url = db.Column(db.Text)  # Store base64 image data or file path
    image_data = db.Column(db.Text)  # Store JSON with multiple image sizes
    is_deleted = db.Column(db.Boolean, default=False)
    deleted_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    statuses = db.relationship('Status', secondary='clergy_statuses', backref='clergy_members')
    events = db.relationship('ClergyEvent', backref='clergy', cascade='all, delete-orphan')

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
            # Check if their rank is flagged as a bishop
            if self.rank:
                rank_obj = Rank.query.filter_by(name=self.rank).first()
                return rank_obj and rank_obj.is_bishop
            return False
        
        # Check if their rank is flagged as a bishop
        if self.rank:
            rank_obj = Rank.query.filter_by(name=self.rank).first()
            if not rank_obj or not rank_obj.is_bishop:
                return False
        else:
            return False
        
        # Check if they were alive on that date
        if not self.was_alive_on(date):
            return False
        
        # Check if they were already a bishop on that date
        # Check new consecrations table for valid consecrations before the date
        valid_consecrations = [c for c in self.consecrations if c.date <= date and not c.is_invalid]
        if valid_consecrations:
            return True
        
        return False

    def get_primary_ordination(self):
        """Get the primary (non-sub conditione) ordination if it exists."""
        for ordination in self.ordinations:
            if not ordination.is_sub_conditione and not ordination.is_invalid:
                return ordination
        return None

    def get_primary_consecration(self):
        """Get the primary (non-sub conditione) consecration if it exists."""
        for consecration in self.consecrations:
            if not consecration.is_sub_conditione and not consecration.is_invalid:
                return consecration
        return None

    def get_all_ordinations(self):
        """Get all ordinations ordered by date."""
        return sorted(self.ordinations, key=lambda x: x.date)

    def get_all_consecrations(self):
        """Get all consecrations ordered by date."""
        return sorted(self.consecrations, key=lambda x: x.date)

    def __repr__(self):
        return f'<Clergy {self.name}>'

class Rank(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    color = db.Column(db.String(7), nullable=False, default="#000000")
    is_bishop = db.Column(db.Boolean, nullable=False, default=False)
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

# Association table for co-consecrators
co_consecrators = db.Table('co_consecrators',
    db.Column('consecration_id', db.Integer, db.ForeignKey('consecration.id'), primary_key=True),
    db.Column('co_consecrator_id', db.Integer, db.ForeignKey('clergy.id'), primary_key=True)
)

# Association table for clergy statuses
clergy_statuses = db.Table('clergy_statuses',
    db.Column('clergy_id', db.Integer, db.ForeignKey('clergy.id'), primary_key=True),
    db.Column('status_id', db.Integer, db.ForeignKey('status.id'), primary_key=True),
    db.Column('created_at', db.DateTime, default=datetime.utcnow),
    db.Column('created_by', db.Integer, db.ForeignKey('user.id'), nullable=True),
    db.Column('notes', db.Text, nullable=True)
)

class Status(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    icon = db.Column(db.String(50), nullable=False)  # FontAwesome icon class
    color = db.Column(db.String(7), nullable=False)  # Hex color
    badge_position = db.Column(db.Integer, nullable=False, default=0)  # Position around node (0-7)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Status {self.name}>'

class Ordination(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    clergy_id = db.Column(db.Integer, db.ForeignKey('clergy.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    ordaining_bishop_id = db.Column(db.Integer, db.ForeignKey('clergy.id'), nullable=True)
    is_sub_conditione = db.Column(db.Boolean, default=False, nullable=False)
    is_doubtful = db.Column(db.Boolean, default=False, nullable=False)
    is_invalid = db.Column(db.Boolean, default=False, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    clergy = db.relationship('Clergy', foreign_keys=[clergy_id], backref='ordinations')
    ordaining_bishop = db.relationship('Clergy', foreign_keys=[ordaining_bishop_id], backref='ordinations_performed')
    
    def __repr__(self):
        return f'<Ordination {self.clergy.name if self.clergy else self.clergy_id} on {self.date}>'

class Consecration(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    clergy_id = db.Column(db.Integer, db.ForeignKey('clergy.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    consecrator_id = db.Column(db.Integer, db.ForeignKey('clergy.id'), nullable=True)
    is_sub_conditione = db.Column(db.Boolean, default=False, nullable=False)
    is_doubtful = db.Column(db.Boolean, default=False, nullable=False)
    is_invalid = db.Column(db.Boolean, default=False, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    clergy = db.relationship('Clergy', foreign_keys=[clergy_id], backref='consecrations')
    consecrator = db.relationship('Clergy', foreign_keys=[consecrator_id], backref='consecrations_performed')
    co_consecrators = db.relationship('Clergy', secondary=co_consecrators, backref='co_consecrations_performed')
    
    def __repr__(self):
        return f'<Consecration {self.clergy.name if self.clergy else self.clergy_id} on {self.date}>'

class ClergyEvent(db.Model):
    __tablename__ = 'clergy_events'

    id = db.Column(db.Integer, primary_key=True)
    clergy_id = db.Column(db.Integer, db.ForeignKey('clergy.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    event_type = db.Column(db.String(120), nullable=True)
    event_date = db.Column(db.Date, nullable=True)
    event_year = db.Column(db.Integer, nullable=False)
    event_end_date = db.Column(db.Date, nullable=True)
    event_end_year = db.Column(db.Integer, nullable=True)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        clergy_name = self.clergy.name if self.clergy else self.clergy_id
        return f'<ClergyEvent {self.title} for {clergy_name}>'

class Location(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)  # Church name, organization name, etc.
    address = db.Column(db.Text, nullable=True)  # Full address
    city = db.Column(db.String(100), nullable=True)
    state_province = db.Column(db.String(100), nullable=True)
    country = db.Column(db.String(100), nullable=True)
    postal_code = db.Column(db.String(20), nullable=True)
    latitude = db.Column(db.Float, nullable=True)  # For precise positioning
    longitude = db.Column(db.Float, nullable=True)  # For precise positioning
    location_type = db.Column(db.String(50), nullable=False, default='church')  # church, organization, address, etc.
    pastor_name = db.Column(db.String(200), nullable=True)  # Current pastor/leader
    organization = db.Column(db.String(200), nullable=True)  # Associated organization (legacy text field)
    organization_id = db.Column(db.Integer, db.ForeignKey('organization.id'), nullable=True)  # Foreign key to Organization table
    notes = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    creator = db.relationship('User', backref='created_locations')
    organization_obj = db.relationship('Organization', backref='locations')  # Relationship to Organization table

    def __repr__(self):
        return f'<Location {self.name}>'

    def get_full_address(self):
        """Return formatted full address"""
        parts = []
        if self.address:
            parts.append(self.address)
        if self.city:
            parts.append(self.city)
        if self.state_province:
            parts.append(self.state_province)
        if self.postal_code:
            parts.append(self.postal_code)
        if self.country:
            parts.append(self.country)
        return ', '.join(parts) if parts else ''

    def has_coordinates(self):
        """Check if location has valid coordinates"""
        return self.latitude is not None and self.longitude is not None


class SpriteSheet(db.Model):
    """Track sprite sheet versions"""
    __tablename__ = 'sprite_sheets'
    
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.Text, nullable=False)  # Public URL of the sprite sheet
    object_key = db.Column(db.String(500), nullable=False)  # Backblaze object key
    thumbnail_size = db.Column(db.Integer, nullable=False, default=48)  # Size of each thumbnail
    images_per_row = db.Column(db.Integer, nullable=False, default=20)  # Thumbnails per row
    sprite_width = db.Column(db.Integer, nullable=False)  # Total width of sprite sheet
    sprite_height = db.Column(db.Integer, nullable=False)  # Total height of sprite sheet
    num_images = db.Column(db.Integer, nullable=False)  # Number of images in sprite sheet
    is_current = db.Column(db.Boolean, default=True)  # Mark the current/latest sprite sheet
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    positions = db.relationship('ClergySpritePosition', backref='sprite_sheet', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<SpriteSheet {self.id} - {self.num_images} images - {"CURRENT" if self.is_current else "OLD"}>'


class ClergySpritePosition(db.Model):
    """Track each clergy member's position in a sprite sheet"""
    __tablename__ = 'clergy_sprite_positions'
    
    id = db.Column(db.Integer, primary_key=True)
    clergy_id = db.Column(db.Integer, db.ForeignKey('clergy.id'), nullable=False)
    sprite_sheet_id = db.Column(db.Integer, db.ForeignKey('sprite_sheets.id'), nullable=False)
    x_position = db.Column(db.Integer, nullable=False)  # X coordinate in pixels
    y_position = db.Column(db.Integer, nullable=False)  # Y coordinate in pixels
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    clergy = db.relationship('Clergy', backref='sprite_positions')
    
    # Unique constraint: one position per clergy per sprite sheet
    __table_args__ = (db.UniqueConstraint('clergy_id', 'sprite_sheet_id', name='_clergy_sprite_uc'),)
    
    def __repr__(self):
        return f'<ClergySpritePosition clergy_id={self.clergy_id} sprite_sheet_id={self.sprite_sheet_id} pos=({self.x_position},{self.y_position})>'

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

class WikiPage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=True) # Optional title, especially if linked to clergy
    clergy_id = db.Column(db.Integer, db.ForeignKey('clergy.id'), nullable=True)
    markdown = db.Column(db.Text, nullable=True) # The actual content
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    edit_count = db.Column(db.Integer, default=0)
    is_visible = db.Column(db.Boolean, default=True)
    category = db.Column(db.String(100), nullable=True)
    is_deleted = db.Column(db.Boolean, default=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    last_editor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)

    # Relationships
    clergy = db.relationship('Clergy', backref='wiki_page')
    author = db.relationship('User', foreign_keys=[author_id], backref='authored_wiki_pages')
    last_editor = db.relationship('User', foreign_keys=[last_editor_id], backref='edited_wiki_pages')

    def __repr__(self):
        return f'<WikiPage {self.title or self.id}>'

class VisualizationSettings(db.Model):
    """Store visualization style preferences that persist across all users"""
    id = db.Column(db.Integer, primary_key=True)
    setting_key = db.Column(db.String(100), unique=True, nullable=False)
    setting_value = db.Column(db.Text, nullable=False)  # JSON string
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<VisualizationSettings {self.setting_key}>'
