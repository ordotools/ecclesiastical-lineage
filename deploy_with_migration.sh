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

# Step 5: Run database migration using Flask-Migrate
print_status "🗄️  Running database migration with Flask-Migrate..."
if python3 -c "
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import Role, Permission, User
from sqlalchemy import inspect

with app.app_context():
    # Create all tables first
    db.create_all()
    print('✅ All tables created')
    
    # Initialize roles and permissions
    from migrations import initialize_roles_and_permissions
    initialize_roles_and_permissions()
    print('✅ Roles and permissions initialized')
    
    # Check if required columns exist in clergy table
    inspector = inspect(db.engine)
    clergy_columns = [col['name'] for col in inspector.get_columns('clergy')]
    required_clergy_columns = ['image_url', 'image_data', 'is_deleted', 'deleted_at', 'papal_name']
    
    missing_clergy_columns = [col for col in required_clergy_columns if col not in clergy_columns]
    
    if missing_clergy_columns:
        print(f'⚠️  Missing clergy columns: {missing_clergy_columns}')
        print('🔧 Adding missing columns...')
        
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
                    elif col == 'papal_name':
                        conn.execute(db.text('ALTER TABLE clergy ADD COLUMN papal_name VARCHAR(200)'))
                    conn.commit()
                print(f'✅ Added column: {col}')
            except Exception as e:
                print(f'⚠️  Column {col} might already exist: {e}')
    else:
        print('✅ All required clergy columns exist')
    
    # Check if user table has required columns
    user_columns = [col['name'] for col in inspector.get_columns('user')]
    required_user_columns = ['email', 'full_name', 'is_active', 'created_at', 'last_login', 'role_id']
    
    missing_user_columns = [col for col in required_user_columns if col not in user_columns]
    
    if missing_user_columns:
        print(f'⚠️  Missing user columns: {missing_user_columns}')
        print('🔧 Adding missing columns...')
        
        for col in missing_user_columns:
            try:
                with db.engine.connect() as conn:
                    if col == 'email':
                        conn.execute(db.text('ALTER TABLE \"user\" ADD COLUMN email VARCHAR(120)'))
                    elif col == 'full_name':
                        conn.execute(db.text('ALTER TABLE \"user\" ADD COLUMN full_name VARCHAR(200)'))
                    elif col == 'is_active':
                        conn.execute(db.text('ALTER TABLE \"user\" ADD COLUMN is_active BOOLEAN DEFAULT true'))
                    elif col == 'created_at':
                        conn.execute(db.text('ALTER TABLE \"user\" ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'))
                    elif col == 'last_login':
                        conn.execute(db.text('ALTER TABLE \"user\" ADD COLUMN last_login TIMESTAMP'))
                    elif col == 'role_id':
                        conn.execute(db.text('ALTER TABLE \"user\" ADD COLUMN role_id INTEGER'))
                    conn.commit()
                print(f'✅ Added column: {col}')
            except Exception as e:
                print(f'⚠️  Column {col} might already exist: {e}')
    else:
        print('✅ All required user columns exist')
    
    # Check if required tables exist
    tables = inspector.get_table_names()
    required_tables = ['role', 'permission', 'role_permissions', 'clergy_comment']
    
    missing_tables = [table for table in required_tables if table not in tables]
    
    if missing_tables:
        print(f'❌ Missing tables: {missing_tables}')
        sys.exit(1)
    else:
        print('✅ All required tables exist')
"; then
    print_success "✅ Database migration completed successfully!"
else
    print_error "❌ Database migration failed!"
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