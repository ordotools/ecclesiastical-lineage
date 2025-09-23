from flask import Flask
from models import db, User, Role
# from init_routes import routes  # Temporarily disabled due to route conflicts
from routes.auth import auth_bp
from routes.clergy import clergy_bp
from routes.main import main_bp
from migrations import run_database_migration, initialize_roles_and_permissions
import os
from dotenv import load_dotenv
from utils import getContrastColor, getBorderStyle, from_json
from routes.settings import settings_bp
from routes.metadata import metadata_bp
from flask_migrate import Migrate
from sqlalchemy import inspect
from urllib.parse import urlparse, urlunparse

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')

database_url = os.environ.get('DATABASE_URL')
if not database_url:
    raise ValueError("DATABASE_URL environment variable is required. Set it to your PostgreSQL connection string.")

# Fix SSL connection issues for Render PostgreSQL
def fix_database_url(url):
    """Fix database URL to handle SSL connections properly on Render"""
    if url.startswith('postgres://'):
        # Convert postgres:// to postgresql://
        url = url.replace('postgres://', 'postgresql://', 1)
    
    # Parse the URL
    parsed = urlparse(url)
    
    # Add SSL mode parameters for Render PostgreSQL
    if 'onrender.com' in parsed.hostname or 'render.com' in parsed.hostname:
        # Add SSL mode and other parameters for Render
        if parsed.query:
            query = parsed.query + '&sslmode=require'
        else:
            query = 'sslmode=require'
        
        # Reconstruct URL with SSL parameters
        fixed_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            query,
            parsed.fragment
        ))
        return fixed_url
    
    return url

# Apply the fix to the database URL
fixed_database_url = fix_database_url(database_url)
app.config['SQLALCHEMY_DATABASE_URI'] = fixed_database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Additional database configuration for better connection handling
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
    'connect_args': {
        'connect_timeout': 10,
        'application_name': 'ecclesiastical_lineage'
    }
}

db.init_app(app)

migrate = Migrate(app, db)

def ensure_database_schema():
    """Ensure all required database columns exist."""
    with app.app_context():
        try:
            # Create all tables first
            db.create_all()
            print("✅ All tables created")
            
            # Check if required columns exist in clergy table
            inspector = inspect(db.engine)
            clergy_columns = [col['name'] for col in inspector.get_columns('clergy')]
            required_clergy_columns = ['image_url', 'image_data', 'is_deleted', 'deleted_at']
            
            missing_clergy_columns = [col for col in required_clergy_columns if col not in clergy_columns]
            
            if missing_clergy_columns:
                print(f"⚠️  Missing clergy columns: {missing_clergy_columns}")
                print("🔧 Adding missing columns...")
                
                for col in missing_clergy_columns:
                    try:
                        with db.engine.connect() as conn:
                            if col == 'image_url':
                                conn.execute(db.text('ALTER TABLE clergy ADD COLUMN image_url TEXT'))
                            elif col == 'image_data':
                                conn.execute(db.text('ALTER TABLE clergy ADD COLUMN image_data TEXT'))
                            elif col == 'is_deleted':
                                conn.execute(db.text('ALTER TABLE clergy ADD COLUMN is_deleted BOOLEAN DEFAULT false'))
                            elif col == 'deleted_at':
                                conn.execute(db.text('ALTER TABLE clergy ADD COLUMN deleted_at TIMESTAMP'))
                            conn.commit()
                        print(f"✅ Added column: {col}")
                    except Exception as e:
                        print(f"⚠️  Column {col} might already exist: {e}")
            else:
                print("✅ All required clergy columns exist")
            
            # Initialize roles and permissions
            from migrations import initialize_roles_and_permissions
            initialize_roles_and_permissions()
            print("✅ Roles and permissions initialized")
            
        except Exception as e:
            print(f"⚠️  Database schema check failed: {e}")

def ensure_admin_user():
    """Ensure there is at least one Super Admin user in the database"""
    try:
        # Check if any Super Admin users exist
        super_admin_role = Role.query.filter_by(name='Super Admin').first()
        if not super_admin_role:
            print("🔧 No Super Admin role found, initializing roles and permissions...")
            initialize_roles_and_permissions()
            super_admin_role = Role.query.filter_by(name='Super Admin').first()
        
        if super_admin_role:
            existing_admin = User.query.filter_by(role_id=super_admin_role.id).first()
            if not existing_admin:
                print("👤 No Super Admin user found, creating default admin user...")
                admin_user = User(
                    username="admin",
                    role_id=super_admin_role.id
                )
                admin_user.set_password("admin123")
                db.session.add(admin_user)
                db.session.commit()
                print("✅ Default admin user created successfully!")
                print("   Username: admin")
                print("   Password: admin123")
                print("   ⚠️  IMPORTANT: Change this password after first login!")
            else:
                print(f"ℹ️  Super Admin user already exists: {existing_admin.username}")
        else:
            print("❌ Failed to create or find Super Admin role")
    except Exception as e:
        print(f"⚠️  Admin user creation failed: {e}")
        db.session.rollback()

# Ensure database schema is set up
ensure_database_schema()

# app.register_blueprint(routes)  # Temporarily disabled due to route conflicts
app.register_blueprint(auth_bp)
app.register_blueprint(clergy_bp)
app.register_blueprint(main_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(metadata_bp)

app.jinja_env.globals['getContrastColor'] = getContrastColor
app.jinja_env.globals['getBorderStyle'] = getBorderStyle
app.jinja_env.filters['from_json'] = from_json

# Run database migration on startup using Flask-Migrate
with app.app_context():
    # Temporarily skip Flask-Migrate upgrade due to migration chain issue
    # from flask_migrate import upgrade
    # try:
    #     upgrade()
    #     print("✅ Flask-Migrate upgrade completed")
    # except Exception as e:
    #     print(f"⚠️  Flask-Migrate upgrade failed, running fallback migration: {e}")
    #     run_database_migration(app)
    print("🔧 Running fallback migration...")
    run_database_migration(app)
    
    # Ensure admin user exists
    ensure_admin_user()

if __name__ == '__main__':
    app.run(debug=True, port=5001)
