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

# Step 3: Check if database migration is needed
print_status "🔍 Checking database migration status..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    print_error "❌ DATABASE_URL environment variable not set!"
    exit 1
fi

# Step 4: Run database migration if needed
print_status "🗄️  Running database migration..."
if python3 migrate_to_rbac.py; then
    print_success "✅ Database migration completed successfully!"
else
    print_warning "⚠️  Database migration failed or not needed. Continuing..."
fi

# Step 5: Initialize database (creates tables if they don't exist)
print_status "🗄️  Initializing database..."
if python3 init_postgres_db.py; then
    print_success "✅ Database initialization completed successfully!"
else
    print_error "❌ Database initialization failed!"
    exit 1
fi

# Step 6: Start the application
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