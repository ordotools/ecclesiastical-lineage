from models import db, Role, Permission, User
from datetime import datetime
from sqlalchemy import inspect

def initialize_roles_and_permissions():
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
        'export_data': 'Export data from the system',
        'view_audit_logs': 'View audit logs and system history'
    }
    for perm_name, perm_desc in permissions.items():
        perm = Permission.query.filter_by(name=perm_name).first()
        if not perm:
            perm = Permission(name=perm_name, description=perm_desc)
            db.session.add(perm)
    roles_config = {
        'Super Admin': {
            'description': 'Full system access and administration',
            'permissions': list(permissions.keys())
        },
        'Admin': {
            'description': 'System administration with limited user management',
            'permissions': ['view_clergy', 'add_clergy', 'edit_clergy', 'delete_clergy', 
                          'manage_metadata', 'add_comments', 'view_comments', 
                          'resolve_comments', 'view_lineage', 'export_data', 'view_audit_logs']
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
            db.session.flush()
        for perm_name in role_config['permissions']:
            perm = Permission.query.filter_by(name=perm_name).first()
            if perm and perm not in role.permissions:
                role.permissions.append(perm)
    db.session.commit()

def run_database_migration(app):
    with app.app_context():
        print("🔧 Running database migration...")
        db.create_all()
        print("✅ All tables created")
        initialize_roles_and_permissions()
        print("✅ Roles and permissions initialized")
        inspector = inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('user')]
        required_columns = ['email', 'full_name', 'is_active', 'created_at', 'last_login', 'role_id']
        missing_columns = [col for col in required_columns if col not in columns]
        if missing_columns:
            print(f"❌ Missing columns: {missing_columns}")
            print("🔧 Adding missing columns...")
            for col in missing_columns:
                try:
                    with db.engine.connect() as conn:
                        if col == 'email':
                            conn.execute(db.text("ALTER TABLE \"user\" ADD COLUMN email VARCHAR(120)"))
                        elif col == 'full_name':
                            conn.execute(db.text("ALTER TABLE \"user\" ADD COLUMN full_name VARCHAR(200)"))
                        elif col == 'is_active':
                            conn.execute(db.text("ALTER TABLE \"user\" ADD COLUMN is_active BOOLEAN DEFAULT true"))
                        elif col == 'created_at':
                            conn.execute(db.text("ALTER TABLE \"user\" ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
                        elif col == 'last_login':
                            conn.execute(db.text("ALTER TABLE \"user\" ADD COLUMN last_login TIMESTAMP"))
                        elif col == 'role_id':
                            conn.execute(db.text("ALTER TABLE \"user\" ADD COLUMN role_id INTEGER"))
                        conn.commit()
                    print(f"✅ Added column: {col}")
                except Exception as e:
                    print(f"⚠️  Column {col} might already exist: {e}")
        super_admin_role = Role.query.filter_by(name='Super Admin').first()
        if super_admin_role:
            existing_users = User.query.filter_by(role_id=None).all()
            for user in existing_users:
                user.role_id = super_admin_role.id
                user.is_active = True
                if not user.created_at:
                    user.created_at = datetime.utcnow()
            db.session.commit()
            print(f"✅ Updated {len(existing_users)} users with Super Admin role")
        print("✅ Database migration completed successfully!") 