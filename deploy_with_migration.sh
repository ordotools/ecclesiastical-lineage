#!/bin/bash
# Comprehensive deployment script with database migration support

set -e  # Exit on any error

echo "🚀 Starting comprehensive deployment..."

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
python debug_env.py
print_success "✅ Environment variables checked"

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
    print_error "❌ Database initialization failed!"
    exit 1
fi

# Step 5: Run database migration (this adds new columns and tables)
print_status "🗄️  Running database migration..."
if python3 migrate_to_rbac.py; then
    print_success "✅ Database migration completed successfully!"
else
    print_error "❌ Database migration failed! This is required for the application to work."
    print_error "   The application requires RBAC columns that are added by the migration."
    exit 1
fi

# Step 6: Verify migration was successful
print_status "🔍 Verifying migration..."
python3 -c "
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from sqlalchemy import inspect

with app.app_context():
    inspector = inspect(db.engine)
    
    # Check if user table has required columns
    columns = [col['name'] for col in inspector.get_columns('user')]
    required_columns = ['email', 'full_name', 'is_active', 'created_at', 'last_login', 'role_id']
    
    missing_columns = [col for col in required_columns if col not in columns]
    
    if missing_columns:
        print(f'❌ Missing columns: {missing_columns}')
        sys.exit(1)
    else:
        print('✅ All required columns exist')
    
    # Check if required tables exist
    tables = inspector.get_table_names()
    required_tables = ['role', 'permission', 'role_permissions', 'clergy_comment']
    
    missing_tables = [table for table in required_tables if table not in tables]
    
    if missing_tables:
        print(f'❌ Missing tables: {missing_tables}')
        sys.exit(1)
    else:
        print('✅ All required tables exist')
"

if [ $? -eq 0 ]; then
    print_success "✅ Migration verification passed!"
else
    print_error "❌ Migration verification failed!"
    exit 1
fi

# Step 7: Start the application
print_status "🌐 Starting application..."
print_success "✅ Deployment completed successfully!"
echo ""
print_status "🚀 Application is ready to serve requests!"
echo ""
print_status "📋 Next steps:"
echo "   • Test the application endpoints"
echo "   • Verify user authentication works"
echo "   • Check that all features are functioning"
echo "   • Monitor application logs for any issues"

# Start gunicorn
gunicorn app:app 