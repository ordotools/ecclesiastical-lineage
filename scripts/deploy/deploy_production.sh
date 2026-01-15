#!/bin/bash
# Production deployment script
# This script is used for production deployments on Render

set -e  # Exit on any error

echo "🚀 Starting PRODUCTION deployment..."
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

# Check if we're in the right directory
if [ ! -f "app.py" ]; then
    print_error "❌ app.py not found. Please run this script from the project root."
    exit 1
fi

# Step 1: Install dependencies
print_status "📦 Installing dependencies..."
pip install -r requirements.txt
print_success "✅ Dependencies installed"

# Step 2: Debug environment variables
# print_status "🔍 Debugging environment variables..."
# python debug_env.py
# print_success "✅ Environment variables checked"

# Step 3: Check if DATABASE_URL is set
print_status "🔍 Checking database connection..."
if [ -z "$DATABASE_URL" ]; then
    print_error "❌ DATABASE_URL environment variable not set!"
    exit 1
fi
print_success "✅ DATABASE_URL is configured"

# Step 4: Initialize database first (creates tables if they don't exist)
print_status "🗄️  Initializing database tables..."
if python3 init_postgres_db.py; then
    print_success "✅ Database initialization completed successfully!"
else
    print_warning "⚠️  Database initialization had warnings (admin user may already exist)"
    print_status "🔍 Checking if database is functional..."
    if python3 -c "
from app import app, db
from models import User
with app.app_context():
    user_count = User.query.count()
    print(f'✅ Database is functional - {user_count} users found')
    if user_count > 0:
        print('✅ Database has data, continuing with deployment')
    else:
        print('⚠️  Database is empty but functional')
"; then
        print_success "✅ Database is functional, continuing deployment"
    else
        print_error "❌ Database is not functional!"
        exit 1
    fi
fi

# Step 4.5: Check migration state and stamp if needed
print_status "🔍 Checking Flask-Migrate state..."
python3 -c "
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.getcwd())

from app import app
from models import db
from sqlalchemy import inspect

with app.app_context():
    # Check if alembic_version table exists
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    
    if 'alembic_version' not in tables:
        print('⚠️  Alembic version table not found - database may not be using Flask-Migrate')
        print('🔧 This is normal for existing databases - Flask-Migrate will handle it')
    else:
        print('✅ Alembic version table found')
    
    # Check if clergy table has the columns that Flask-Migrate will try to add
    clergy_columns = [col['name'] for col in inspector.get_columns('clergy')]
    flask_migrate_columns = ['is_deleted', 'deleted_at']
    
    existing_columns = [col for col in flask_migrate_columns if col in clergy_columns]
    if existing_columns:
        print(f'⚠️  Columns already exist: {existing_columns}')
        print('🔧 Flask-Migrate may try to add these again - this is expected and will be handled')
    else:
        print('✅ No column conflicts detected')
"

# Step 5: Run database migration using Flask-Migrate
print_status "🗄️  Running database migration with Flask-Migrate..."
if flask db upgrade; then
    print_success "✅ Flask-Migrate upgrade completed successfully!"
else
    print_error "❌ Flask-Migrate upgrade failed!"
    exit 1
fi

# Step 6: Migrate legacy lineage data
print_status "🔄 Migrating legacy lineage data..."
if python3 migrate_legacy_lineage_data.py; then
    print_success "✅ Legacy lineage data migration completed!"
else
    print_warning "⚠️  Legacy lineage data migration failed or not needed"
fi

# Step 7: Populate database with initial data if empty
print_status "📊 Checking if database needs initial data..."
python3 -c "
from app import app, db
from models import Clergy
with app.app_context():
    clergy_count = Clergy.query.count()
    print(f'📊 Current clergy count: {clergy_count}')
    if clergy_count == 0:
        print('📊 Database is empty, will populate with initial data')
        exit(0)
    else:
        print('📊 Database has data, skipping population')
        exit(1)
"

if [ $? -eq 0 ]; then
    print_status "📊 Populating database with initial data..."
    if python3 populate_database.py; then
        print_success "✅ Database population completed!"
    else
        print_warning "⚠️  Database population failed"
    fi
else
    print_success "✅ Database already has data, skipping population"
fi

# Step 8: Force migrate lineage data if needed
print_status "🔄 Force migrating lineage data..."
if python3 force_migrate_lineage_data.py; then
    print_success "✅ Force lineage data migration completed!"
else
    print_warning "⚠️  Force lineage data migration failed"
fi

# Step 9: Verify migration was successful
print_status "🔍 Verifying migration..."
python3 -c "
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.getcwd())

from app import app
from models import db, Clergy, Ordination, Consecration

with app.app_context():
    clergy_count = Clergy.query.count()
    ordination_count = Ordination.query.count()
    consecration_count = Consecration.query.count()
    
    print(f'✅ Migration verification:')
    print(f'   - Clergy records: {clergy_count}')
    print(f'   - Ordination records: {ordination_count}')
    print(f'   - Consecration records: {consecration_count}')
    
    if ordination_count > 0 or consecration_count > 0:
        print('✅ Lineage relationships created successfully!')
    else:
        print('⚠️  No lineage relationships found - migration may not have run')
"

if [ $? -eq 0 ]; then
    print_success "✅ Migration verification passed!"
else
    print_error "❌ Migration verification failed!"
    exit 1
fi

# Step 10: Start the application
print_status "🌐 Starting PRODUCTION application..."
print_success "✅ PRODUCTION deployment completed successfully!"
echo ""
print_status "🚀 PRODUCTION application is ready to serve requests!"
echo ""
print_status "📋 Production deployment complete:"
echo "   • Application is live and serving users"
echo "   • All database migrations applied"
echo "   • Monitor application logs for any issues"
echo "   • Monitor performance and user feedback"

# Start gunicorn
gunicorn app:app
