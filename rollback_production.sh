#!/bin/bash
# Production rollback script for Render

set -e  # Exit on any error

echo "🔄 Starting PRODUCTION rollback..."

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

print_error() {
    echo -e "${RED}$1${NC}"
}

# Check current migration state
print_status "🔍 Checking current migration state..."
flask db current

# Run rollback
print_status "🔄 Running rollback..."
if flask db downgrade; then
    print_success "✅ Rollback completed successfully!"
else
    print_error "❌ Rollback failed!"
    exit 1
fi

# Verify rollback
print_status "🔍 Verifying rollback..."
python3 -c "
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
        print('⚠️  Some lineage relationships still exist')
"

print_success "🎉 Production rollback completed!"
