from flask import Flask
from models import db
from routes import routes
from migrations import run_database_migration
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')

database_url = os.environ.get('DATABASE_URL')
if not database_url:
    raise ValueError("DATABASE_URL environment variable is required. Set it to your PostgreSQL connection string.")

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

app.register_blueprint(routes)

from routes import getContrastColor, getBorderStyle, from_json
app.jinja_env.globals['getContrastColor'] = getContrastColor
app.jinja_env.globals['getBorderStyle'] = getBorderStyle
app.jinja_env.filters['from_json'] = from_json

if __name__ == '__main__':
    with app.app_context():
        run_database_migration(app)
    app.run(debug=True, port=5000)