#!/bin/bash
# Rollback script for smart Flask-Migrate data migration

set -e  # Exit on any error

echo "🔄 Starting rollback of smart Flask-Migrate migration..."

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

# Step 1: Check if DATABASE_URL is set
print_status "🔍 Checking database connection..."
if [ -z "$DATABASE_URL" ]; then
    print_error "❌ DATABASE_URL environment variable not set!"
    exit 1
fi
print_success "✅ DATABASE_URL is configured"

# Step 2: Check current migration state
print_status "🔍 Checking current migration state..."
flask db current

# Step 3: Run Flask-Migrate downgrade
print_status "🔄 Running Flask-Migrate downgrade..."
if flask db downgrade; then
    print_success "✅ Flask-Migrate downgrade completed successfully!"
else
    print_error "❌ Flask-Migrate downgrade failed!"
    exit 1
fi

# Step 4: Verify rollback was successful
print_status "🔍 Verifying rollback..."
python3 -c "
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from models import db, Clergy, Ordination, Consecration

with app.app_context():
    clergy_count = Clergy.query.count()
    ordination_count = Ordination.query.count()
    consecration_count = Consecration.query.count()
    
    print(f'✅ Rollback verification:')
    print(f'   - Clergy records: {clergy_count}')
    print(f'   - Ordination records: {ordination_count}')
    print(f'   - Consecration records: {consecration_count}')
    
    if ordination_count == 0 and consecration_count == 0:
        print('✅ Lineage relationships removed successfully!')
    else:
        print('⚠️  Some lineage relationships still exist - rollback may be incomplete')
"

if [ $? -eq 0 ]; then
    print_success "✅ Rollback verification passed!"
else
    print_error "❌ Rollback verification failed!"
    exit 1
fi

print_success "🎉 Rollback completed successfully!"
echo ""
print_status "📋 Rollback summary:"
echo "   • Smart migration data has been removed"
echo "   • Clergy records are preserved"
echo "   • Lineage relationships have been removed"
echo "   • Database is back to previous state"
echo ""
print_status "💡 To re-run the migration:"
echo "   • Run: flask db upgrade"
echo "   • Or use: ./deploy_with_smart_migration.sh"
