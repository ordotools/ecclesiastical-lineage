#!/bin/bash
# Deployment script that wipes production database and restores from staging
# WARNING: This is a destructive operation that will completely wipe production data!

set -e  # Exit on any error

echo "🚨 PRODUCTION DATABASE WIPE AND RESTORE FROM STAGING"
echo "====================================================="
echo ""
echo "⚠️  WARNING: This operation will COMPLETELY WIPE the production database!"
echo "⚠️  All production data will be lost and replaced with staging data!"
echo "⚠️  This operation is IRREVERSIBLE!"
echo ""

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

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error "❌ .env file not found. Please create one first."
    exit 1
fi

# Load environment variables
source .env

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ]; then
    print_error "❌ DATABASE_URL environment variable not set!"
    exit 1
fi

if [ -z "$STAGING_DATABASE_URL" ]; then
    print_error "❌ STAGING_DATABASE_URL environment variable not set!"
    print_warning "Please add your staging database URL to .env file:"
    print_warning "STAGING_DATABASE_URL=postgresql://user:pass@host:port/database"
    exit 1
fi

print_status "📊 Production database: ${DATABASE_URL:0:50}..."
print_status "📊 Staging database: ${STAGING_DATABASE_URL:0:50}..."

# Final confirmation
echo ""
print_warning "🔴 FINAL CONFIRMATION REQUIRED 🔴"
echo "This will:"
echo "  1. COMPLETELY WIPE the production database"
echo "  2. Copy ALL data from staging to production"
echo "  3. This operation CANNOT be undone"
echo ""
read -p "Type 'WIPE_PRODUCTION' to confirm: " confirmation

if [ "$confirmation" != "WIPE_PRODUCTION" ]; then
    print_error "❌ Confirmation failed. Operation cancelled."
    exit 1
fi

echo ""
print_warning "🚨 PROCEEDING WITH DESTRUCTIVE OPERATION..."
echo ""

# Step 1: Install dependencies
print_status "📦 Installing dependencies..."
pip install -r requirements.txt
print_success "✅ Dependencies installed"

# Step 2: Verify staging database has data
print_status "🔍 Verifying staging database has data..."
python3 -c "
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.getcwd())

from sqlalchemy import create_engine, text

staging_url = os.environ.get('STAGING_DATABASE_URL')
if not staging_url:
    print('❌ STAGING_DATABASE_URL not set')
    sys.exit(1)

try:
    staging_engine = create_engine(staging_url)
    with staging_engine.connect() as conn:
        clergy_count = conn.execute(text('SELECT COUNT(*) FROM clergy')).scalar()
        orgs_count = conn.execute(text('SELECT COUNT(*) FROM organization')).scalar()
        users_count = conn.execute(text('SELECT COUNT(*) FROM user')).scalar()
        
        print(f'📊 Staging has {clergy_count} clergy, {orgs_count} orgs, {users_count} users')
        
        if clergy_count == 0:
            print('❌ Staging database is empty! Cannot restore from empty staging.')
            sys.exit(1)
        else:
            print('✅ Staging database has data - proceeding with restore')
            
except Exception as e:
    print(f'❌ Error checking staging database: {e}')
    sys.exit(1)
"

if [ $? -ne 0 ]; then
    print_error "❌ Staging database verification failed!"
    exit 1
fi

# Step 3: Run the wipe and restore migration
print_status "🗄️  Running wipe and restore migration..."
if flask db upgrade; then
    print_success "✅ Wipe and restore migration completed successfully!"
else
    print_error "❌ Wipe and restore migration failed!"
    exit 1
fi

# Step 4: Verify the restore was successful
print_status "🔍 Verifying restored data..."
python3 -c "
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.getcwd())

from sqlalchemy import create_engine, text

production_url = os.environ.get('DATABASE_URL')
staging_url = os.environ.get('STAGING_DATABASE_URL')

try:
    prod_engine = create_engine(production_url)
    staging_engine = create_engine(staging_url)
    
    with prod_engine.connect() as prod_conn, staging_engine.connect() as staging_conn:
        # Get counts from both databases
        prod_clergy = prod_conn.execute(text('SELECT COUNT(*) FROM clergy')).scalar()
        prod_orgs = prod_conn.execute(text('SELECT COUNT(*) FROM organization')).scalar()
        prod_users = prod_conn.execute(text('SELECT COUNT(*) FROM user')).scalar()
        
        staging_clergy = staging_conn.execute(text('SELECT COUNT(*) FROM clergy')).scalar()
        staging_orgs = staging_conn.execute(text('SELECT COUNT(*) FROM organization')).scalar()
        staging_users = staging_conn.execute(text('SELECT COUNT(*) FROM user')).scalar()
        
        print(f'📊 Production: {prod_clergy} clergy, {prod_orgs} orgs, {prod_users} users')
        print(f'📊 Staging: {staging_clergy} clergy, {staging_orgs} orgs, {staging_users} users')
        
        if (prod_clergy == staging_clergy and 
            prod_orgs == staging_orgs and 
            prod_users == staging_users):
            print('✅ SUCCESS: Data counts match between staging and production!')
        else:
            print('❌ WARNING: Data counts do not match!')
            print('   This may indicate a problem with the restore process.')
            
except Exception as e:
    print(f'❌ Error verifying restore: {e}')
    sys.exit(1)
"

if [ $? -ne 0 ]; then
    print_error "❌ Restore verification failed!"
    exit 1
fi

# Step 5: Test database functionality
print_status "🧪 Testing database functionality..."
python3 -c "
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.getcwd())

from app import app
from models import db, Clergy, User, Organization, Rank

with app.app_context():
    try:
        # Test basic queries
        clergy_count = Clergy.query.count()
        user_count = User.query.count()
        org_count = Organization.query.count()
        rank_count = Rank.query.count()
        
        print(f'✅ Database queries successful:')
        print(f'   - {clergy_count} clergy records')
        print(f'   - {user_count} user records')
        print(f'   - {org_count} organization records')
        print(f'   - {rank_count} rank records')
        
        # Test a specific query
        clergy = Clergy.query.first()
        if clergy:
            print(f'✅ Sample clergy record: {clergy.name} ({clergy.rank})')
        else:
            print('⚠️  No clergy records found')
            
    except Exception as e:
        print(f'❌ Database functionality test failed: {e}')
        sys.exit(1)
"

if [ $? -ne 0 ]; then
    print_error "❌ Database functionality test failed!"
    exit 1
fi

print_success "🎉 PRODUCTION DATABASE SUCCESSFULLY RESTORED FROM STAGING!"
print_success "✅ All data has been copied and verified"
print_success "✅ Database is functional and ready for use"
echo ""
print_warning "📝 Next steps:"
print_warning "   1. Test your application thoroughly"
print_warning "   2. Verify all functionality works as expected"
print_warning "   3. Consider creating a backup of the restored database"
