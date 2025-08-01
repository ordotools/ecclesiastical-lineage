from flask import Flask
from models import db
from init_routes import routes
from routes.auth import auth_bp
from routes.clergy import clergy_bp
from migrations import run_database_migration
import os
from dotenv import load_dotenv
from utils import getContrastColor, getBorderStyle, from_json
from routes.settings import settings_bp
from routes.metadata import metadata_bp
from flask_migrate import Migrate

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

# Now you can use the 'flask db' CLI commands to manage migrations

app.register_blueprint(routes)
app.register_blueprint(auth_bp)
app.register_blueprint(clergy_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(metadata_bp)

app.jinja_env.globals['getContrastColor'] = getContrastColor
app.jinja_env.globals['getBorderStyle'] = getBorderStyle
app.jinja_env.filters['from_json'] = from_json

if __name__ == '__main__':
    with app.app_context():
        run_database_migration(app)
    app.run(debug=True, port=5000)