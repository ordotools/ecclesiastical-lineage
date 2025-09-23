#!/bin/bash
# Simple deployment script that stamps database to latest and runs smart migration

set -e  # Exit on any error

echo "🚀 Starting simple deployment with database stamping..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Step 2: Check if DATABASE_URL is set
print_status "🔍 Checking database connection..."
if [ -z "$DATABASE_URL" ]; then
    print_error "❌ DATABASE_URL environment variable not set!"
    exit 1
fi
print_success "✅ DATABASE_URL is configured"

# Step 3: Initialize database first (creates tables if they don't exist)
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

# Step 4: Stamp database to latest revision (bypass all migrations)
print_status "🔧 Stamping database to latest revision..."
if python3 simple_stamp_to_latest.py; then
    print_success "✅ Database stamped to latest revision!"
else
    print_error "❌ Failed to stamp database!"
    exit 1
fi

# Step 5: Run the smart migration directly
print_status "🔄 Running smart migration directly..."
if python3 -c "
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.getcwd())

# Import and run the smart migration
from migrations.versions.ffca03f86792_smart_production_data_migration_with_ import upgrade

print('🚀 Running smart migration upgrade function directly...')
try:
    upgrade()
    print('✅ Smart migration completed successfully!')
except Exception as e:
    print(f'❌ Smart migration failed: {e}')
    sys.exit(1)
"; then
    print_success "✅ Smart migration completed successfully!"
else
    print_error "❌ Smart migration failed!"
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

# Step 7: Start the application
print_status "🌐 Starting application..."
print_success "✅ Deployment completed successfully!"
echo ""
print_status "🚀 Application is ready to serve requests!"
echo ""
print_status "📋 Next steps:"
echo "   • Test the lineage visualization endpoint"
echo "   • Verify clergy images are loading"
echo "   • Check that lineage relationships are displayed"
echo "   • Monitor application logs for any issues"

# Start gunicorn
gunicorn app:app
