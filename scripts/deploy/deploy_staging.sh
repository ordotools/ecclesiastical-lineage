#!/bin/bash
# Staging deployment script
# This script is used for staging deployments on Render

set -e  # Exit on any error

echo "🚀 Starting STAGING deployment..."
echo "=================================="

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
print_status "🔍 Debugging environment variables..."
python scripts/database/debug_env.py
print_success "✅ Environment variables checked"

# Step 3: Check if DATABASE_URL is set
print_status "🔍 Checking database connection..."
if [ -z "$DATABASE_URL" ]; then
    print_error "❌ DATABASE_URL environment variable not set!"
    exit 1
fi
print_success "✅ DATABASE_URL is configured"

# Step 4: Check database connection
print_status "🔍 Checking database connection..."
if python3 -c "
from app import app, db
from models import User
with app.app_context():
    try:
        user_count = User.query.count()
        print(f'✅ Database is functional - {user_count} users found')
        if user_count > 0:
            print('✅ Database has data, continuing with deployment')
        else:
            print('⚠️  Database is empty but functional')
    except Exception as e:
        print(f'❌ Database connection failed: {e}')
        exit(1)
"; then
    print_success "✅ Database is functional, continuing deployment"
else
    print_error "❌ Database is not functional!"
    exit 1
fi

# Step 4: Fix Flask-Migrate state properly
print_status "🔧 Fixing Flask-Migrate state properly..."
if python3 scripts/migration/fix_flask_migrate_properly.py; then
    print_success "✅ Flask-Migrate state fixed properly!"
else
    print_error "❌ Failed to fix Flask-Migrate state!"
    exit 1
fi

# Step 5: Run database migration using Flask-Migrate
print_status "🗄️  Running Flask-Migrate database migration..."
if python3 -c "
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.getcwd())

from app import app, db
from flask_migrate import upgrade

with app.app_context():
    print('🔧 Running Flask-Migrate upgrade...')
    upgrade()
    print('✅ Flask-Migrate upgrade completed successfully!')
    
    # Initialize roles and permissions
    from migrations import initialize_roles_and_permissions
    initialize_roles_and_permissions()
    print('✅ Roles and permissions initialized')
"; then
    print_success "✅ Database migration completed successfully!"
else
    print_error "❌ Database migration failed!"
    exit 1
fi

# Step 6: Verify database is ready
print_status "🔍 Verifying database..."
python3 -c "
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.getcwd())

from app import app, db
from sqlalchemy import inspect

with app.app_context():
    inspector = inspect(db.engine)
    
    # Check if location table has required columns (including deleted column)
    if 'location' in inspector.get_table_names():
        location_columns = [col['name'] for col in inspector.get_columns('location')]
        required_location_columns = ['deleted']
        
        missing_location_columns = [col for col in required_location_columns if col not in location_columns]
        
        if missing_location_columns:
            print(f'❌ Missing location columns: {missing_location_columns}')
            sys.exit(1)
        else:
            print('✅ All required location columns exist (including deleted column)')
    
    # Check if clergy table has required columns
    clergy_columns = [col['name'] for col in inspector.get_columns('clergy')]
    required_clergy_columns = ['image_url', 'image_data', 'is_deleted', 'deleted_at', 'papal_name']
    
    missing_clergy_columns = [col for col in required_clergy_columns if col not in clergy_columns]
    
    if missing_clergy_columns:
        print(f'❌ Missing clergy columns: {missing_clergy_columns}')
        sys.exit(1)
    else:
        print('✅ All required clergy columns exist')
    
    # Check if user table has required columns
    user_columns = [col['name'] for col in inspector.get_columns('user')]
    required_user_columns = ['email', 'full_name', 'is_active', 'created_at', 'last_login', 'role_id']
    
    missing_user_columns = [col for col in required_user_columns if col not in user_columns]
    
    if missing_user_columns:
        print(f'❌ Missing user columns: {missing_user_columns}')
        sys.exit(1)
    else:
        print('✅ All required user columns exist')
    
    # Check if required tables exist
    tables = inspector.get_table_names()
    required_tables = ['role', 'permission', 'role_permissions', 'clergy_comment', 'location']
    
    missing_tables = [table for table in required_tables if table not in tables]
    
    if missing_tables:
        print(f'❌ Missing tables: {missing_tables}')
        sys.exit(1)
    else:
        print('✅ All required tables exist')
"

if [ $? -eq 0 ]; then
    print_success "✅ Database verification passed!"
else
    print_error "❌ Database verification failed!"
    exit 1
fi

# Step 7: Start the application
print_status "🌐 Starting STAGING application..."
print_success "✅ STAGING deployment completed successfully!"
echo ""
print_status "🚀 STAGING application is ready to serve requests!"
echo ""
print_status "📋 Next steps:"
echo "   • Test the staging application endpoints"
echo "   • Verify user authentication works"
echo "   • Check that all features are functioning"
echo "   • Monitor application logs for any issues"
echo "   • When ready, merge to main for production deployment"

# Start gunicorn
gunicorn app:app
