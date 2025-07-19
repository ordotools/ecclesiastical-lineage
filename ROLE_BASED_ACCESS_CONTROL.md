# Role-Based Access Control System

## Overview

The ecclesiastical lineage application now features a comprehensive role-based access control (RBAC) system that provides granular permissions for different types of users. This system allows for better collaboration, data integrity, and user management.

## Role Hierarchy

### 1. **Super Admin** (Full System Access)
- **Description**: Complete system administration and control
- **Permissions**: All permissions in the system
- **Use Case**: System administrators who need full access to manage everything

**Capabilities:**
- Manage all users and roles
- Full clergy and metadata management
- System configuration
- Database administration
- Generate admin invites
- Resolve comments and feedback

### 2. **Editor** (Content Management)
- **Description**: Full content management capabilities
- **Permissions**: All content-related permissions except user management
- **Use Case**: Senior clergy or administrators who manage ecclesiastical records

**Capabilities:**
- Add, edit, delete clergy records
- Manage metadata (ranks, organizations)
- View all data and lineage visualizations
- Add and resolve comments
- Export data
- Cannot manage users or system settings

### 3. **Contributor** (Limited Editing)
- **Description**: Can add and edit clergy records with approval workflow
- **Permissions**: Basic editing with comment capabilities
- **Use Case**: Clergy members or researchers who contribute data

**Capabilities:**
- Add new clergy records
- Edit existing clergy records
- Add comments and suggestions
- View all data and lineage visualizations
- Cannot delete records or manage metadata

### 4. **Reviewer** (Feedback & Comments)
- **Description**: Can view records and provide feedback
- **Permissions**: View and comment permissions only
- **Use Case**: Scholars, researchers, or interested parties who provide feedback

**Capabilities:**
- View all clergy records and lineage
- Add comments and suggestions
- Flag records for review
- Cannot edit records directly

### 5. **Viewer** (Read-Only)
- **Description**: Read-only access to clergy records and lineage
- **Permissions**: View permissions only
- **Use Case**: General public, researchers, or anyone who needs to view data

**Capabilities:**
- View clergy records and lineage visualization
- Search and filter data
- No editing capabilities

## Permission System

### Core Permissions

| Permission | Description | Roles |
|------------|-------------|-------|
| `view_clergy` | View clergy records | All roles |
| `add_clergy` | Add new clergy records | Super Admin, Editor, Contributor |
| `edit_clergy` | Edit existing clergy records | Super Admin, Editor, Contributor |
| `delete_clergy` | Delete clergy records | Super Admin, Editor |
| `manage_metadata` | Manage ranks and organizations | Super Admin, Editor |
| `manage_users` | Manage user accounts and roles | Super Admin |
| `add_comments` | Add comments to clergy records | Super Admin, Editor, Contributor, Reviewer |
| `view_comments` | View comments on clergy records | Super Admin, Editor, Contributor, Reviewer |
| `resolve_comments` | Resolve comments and feedback | Super Admin, Editor |
| `view_lineage` | View lineage visualization | All roles |
| `export_data` | Export data from the system | Super Admin, Editor |

## Database Schema

### New Models

#### User Model (Enhanced)
```python
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
    comments = db.relationship('ClergyComment', backref='author', lazy='dynamic')
```

#### Role Model
```python
class Role(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    permissions = db.relationship('Permission', secondary='role_permissions', backref='roles')
```

#### Permission Model
```python
class Permission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

#### ClergyComment Model
```python
class ClergyComment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    clergy_id = db.Column(db.Integer, db.ForeignKey('clergy.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_public = db.Column(db.Boolean, default=True)
    is_resolved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

## Implementation Features

### 1. Permission Decorators
```python
@require_permission('edit_clergy')
def edit_clergy(clergy_id):
    # Function implementation
```

### 2. User Permission Methods
```python
user.can_edit_clergy()      # Check if user can edit clergy
user.can_delete_clergy()    # Check if user can delete clergy
user.can_manage_metadata()  # Check if user can manage metadata
user.can_manage_users()     # Check if user can manage users
user.can_comment()          # Check if user can add comments
user.is_admin()            # Check if user is Super Admin
```

### 3. Role-Based UI
- Dashboard shows different features based on user permissions
- Settings page displays user's role and permissions
- Clergy view shows/hides edit buttons based on permissions
- Comments system for feedback and collaboration

### 4. User Management Interface
- Add new users with specific roles
- Edit existing users and their permissions
- Deactivate/reactivate user accounts
- Prevent deletion of the last Super Admin

## Migration Guide

### For Existing Installations

1. **Database Migration**: The new system requires database schema changes
2. **Role Initialization**: Run the initialization function to create default roles
3. **User Migration**: Existing admin users will be assigned the "Super Admin" role
4. **Permission Updates**: All existing routes now use permission decorators

### For New Installations

1. **First User**: The first user created will automatically be assigned "Super Admin" role
2. **Role Setup**: Default roles and permissions are created automatically
3. **User Creation**: Use the user management interface to create additional users

## Security Considerations

### 1. Permission Validation
- All sensitive operations are protected by permission decorators
- Server-side validation ensures users cannot bypass UI restrictions
- Role-based access control prevents unauthorized access

### 2. User Management
- Only Super Admins can manage users
- Password strength requirements enforced
- Account deactivation capability
- Prevention of last Super Admin deletion

### 3. Comment System
- Public comments for transparency
- Resolution system for feedback management
- Author tracking for accountability

## Usage Examples

### Creating a New User
```python
# Through the web interface
POST /users/add
{
    "username": "researcher1",
    "email": "researcher@example.com",
    "full_name": "Dr. John Smith",
    "role_id": 3,  # Contributor role
    "password": "SecurePass123!"
}
```

### Checking Permissions in Templates
```html
{% if user.can_edit_clergy() %}
<a href="{{ url_for('edit_clergy', clergy_id=clergy.id) }}" class="btn btn-primary">Edit</a>
{% endif %}

{% if user.can_comment() %}
<a href="{{ url_for('clergy_comments', clergy_id=clergy.id) }}" class="btn btn-info">Comments</a>
{% endif %}
```

### Adding Comments
```python
# Through the web interface
POST /clergy/{clergy_id}/comments/add
{
    "content": "This record needs verification of the consecration date."
}
```

## Benefits

1. **Scalability**: Easy to add new roles and permissions
2. **Security**: Granular access control prevents unauthorized actions
3. **Collaboration**: Multiple users can contribute with appropriate permissions
4. **Audit Trail**: Comments and user actions are tracked
5. **Flexibility**: Different user types can have appropriate access levels
6. **Data Integrity**: Controlled editing prevents accidental data corruption

## Future Enhancements

1. **Approval Workflow**: For Contributor edits requiring Editor approval
2. **Audit Logging**: Detailed tracking of all user actions
3. **Role Templates**: Predefined role configurations for common use cases
4. **Bulk Operations**: Permission-based bulk editing capabilities
5. **API Access**: Role-based API permissions for external integrations 