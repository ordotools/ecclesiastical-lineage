from flask import Flask
from models import db
# from init_routes import routes  # Temporarily disabled due to route conflicts
from routes.auth import auth_bp
from routes.clergy import clergy_bp
from routes.main import main_bp
from migrations import run_database_migration
import os
from dotenv import load_dotenv
from utils import getContrastColor, getBorderStyle, from_json
from routes.settings import settings_bp
from routes.metadata import metadata_bp
from flask_migrate import Migrate
from sqlalchemy import inspect

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')

database_url = os.environ.get('DATABASE_URL')
if not database_url:
    raise ValueError("DATABASE_URL environment variable is required. Set it to your PostgreSQL connection string.")

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

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

if __name__ == '__main__':
    with app.app_context():
        run_database_migration(app)
    app.run(debug=True, port=5001)
