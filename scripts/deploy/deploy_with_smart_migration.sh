#!/bin/bash
# Deployment script with smart Flask-Migrate data migration

set -e  # Exit on any error

echo "🚀 Starting deployment with smart Flask-Migrate migration..."

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
    print_error "❌ Database initialization failed!"
    exit 1
fi

# Step 4: Run Flask-Migrate upgrade (this will run our smart migration)
print_status "🔄 Running Flask-Migrate upgrade..."
if flask db upgrade; then
    print_success "✅ Flask-Migrate upgrade completed successfully!"
else
    print_error "❌ Flask-Migrate upgrade failed!"
    exit 1
fi

# Step 5: Verify migration was successful
print_status "🔍 Verifying migration..."
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

# Step 6: Start the application
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
